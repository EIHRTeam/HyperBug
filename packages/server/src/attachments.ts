import {
  attachmentIsDeliverable,
  attachmentBlobMatches,
  attachmentRange,
  exactBlobStream,
  type AttachmentStore,
  type AttachmentRecord,
  type BlobStore,
  type BlobRead,
  type IssueRepository,
  type CommentStore,
} from '@hyperbug/application';
import { credentialFactsOf, requireAuthorizedAction } from './authorization.ts';
import {
  projectBearer,
  requireVisibleProject,
  type ProjectContext,
} from './projects.ts';
import { RequestFailure, publicFailure } from './errors.ts';
import { withDeadline } from './bounds.ts';

export interface AttachmentContext extends ProjectContext {
  attachments: AttachmentStore;
  blobs: BlobStore;
  issues: IssueRepository;
  comments: CommentStore | null;
}
export function parseMediaOrigin(
  value: string,
  protectedOrigins: readonly string[],
  environment: string,
): string {
  try {
    const url = new URL(value);
    if (
      url.origin !== value ||
      url.username ||
      url.password ||
      url.hostname.includes('*') ||
      (url.protocol !== 'https:' &&
        !(
          environment === 'local' &&
          url.protocol === 'http:' &&
          (url.hostname === 'localhost' ||
            url.hostname === '[::1]' ||
            /^127\.\d+\.\d+\.\d+$/.test(url.hostname))
        )) ||
      url.hostname.endsWith('.') ||
      protectedOrigins.some(
        (origin) => mediaHostname(new URL(origin).hostname) === url.hostname,
      )
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error('Invalid isolated media origin');
  }
}

function mediaHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '');
}

/** Scheme/port/Host mismatches on the media hostname must never reach auth routes. */
export function isAttachmentMediaRequest(
  request: Request,
  origin: string,
): boolean {
  const hostname = new URL(origin).hostname;
  if (mediaHostname(new URL(request.url).hostname) === hostname) return true;
  const host = request.headers.get('host');
  if (host === null) return false;
  try {
    return mediaHostname(new URL(`http://${host}`).hostname) === hostname;
  } catch {
    return false;
  }
}

/** No authentication routes or cookies exist on the selected origin. */
export function createAttachmentMediaHandler(
  context: AttachmentContext,
  allowedOrigins: readonly string[],
  mediaOrigin: string,
  runtime: 'node' | 'cloudflare' = 'node',
) {
  const origins = Object.freeze([...allowedOrigins]);
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy':
        "sandbox; default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'referrer-policy': 'no-referrer',
      'cross-origin-resource-policy': 'same-site',
      vary: 'Origin',
      'x-request-id': crypto.randomUUID(),
    });
    let acquired: BlobRead | null = null;
    try {
      const url = new URL(request.url);
      const host = request.headers.get('host');
      if (
        url.origin !== mediaOrigin ||
        // Workers supplies the canonical edge URL; local workerd transports
        // rewrite Host. Node also checks Host against absolute request targets.
        (runtime === 'node' &&
          host !== null &&
          `${url.protocol}//${host}` !== mediaOrigin)
      )
        throw new RequestFailure('NOT_FOUND');
      const origin = request.headers.get('origin');
      if (origin !== null && !origins.includes(origin))
        throw new RequestFailure('ORIGIN_FORBIDDEN');
      if (origin !== null) {
        headers.set('access-control-allow-origin', origin);
        headers.set(
          'access-control-expose-headers',
          'content-disposition, content-length, content-range, x-request-id',
        );
      }
      const match =
        /^\/attachments\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.exec(
          url.pathname,
        );
      if (
        !match ||
        url.search ||
        !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      )
        throw new RequestFailure('NOT_FOUND');
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('access-control-request-method');
        const raw = request.headers.get('access-control-request-headers') ?? '';
        const names = raw
          ? raw.split(',').map((name) => name.trim().toLowerCase())
          : [];
        if (
          origin === null ||
          !['GET', 'HEAD'].includes(method ?? '') ||
          raw.length > 128 ||
          names.length > 2 ||
          new Set(names).size !== names.length ||
          names.some((name) => !['authorization', 'range'].includes(name))
        )
          throw new RequestFailure('INVALID_PREFLIGHT');
        headers.set(
          'vary',
          'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
        );
        headers.set('access-control-allow-methods', 'GET, HEAD');
        headers.set('access-control-allow-headers', 'authorization, range');
        headers.set('access-control-max-age', '300');
        return new Response(null, { status: 204, headers });
      }
      const load = () =>
        withDeadline(request.signal, 1000, () =>
          context.attachments.get(match[1]!),
        );
      const file = await load();
      if (!file || !attachmentIsDeliverable(file))
        throw new RequestFailure('NOT_FOUND');
      await permit(request, context, file);
      const rawRange =
        request.method === 'GET' ? request.headers.get('range') : null;
      const range =
        rawRange === null
          ? undefined
          : attachmentRange(rawRange, file.sizeBytes);
      if (range === null) {
        headers.set('content-range', `bytes */${file.sizeBytes}`);
        throw new RequestFailure('ATTACHMENT_RANGE_INVALID');
      }
      const object = await withDeadline(
        request.signal,
        5000,
        async (signal) => {
          if (request.method === 'HEAD')
            return context.blobs.head(file.objectKey);
          const read = await context.blobs.get(file.objectKey, range);
          if (signal.aborted) {
            void read?.body.cancel().catch(() => {});
            return null;
          }
          return read;
        },
      );
      if (!object) throw new RequestFailure('NOT_FOUND');
      acquired = request.method === 'HEAD' ? null : (object as BlobRead);
      if (
        !attachmentBlobMatches(file, object) ||
        (acquired !== null &&
          acquired.bodySize !== (range?.length ?? file.sizeBytes))
      )
        throw new RequestFailure('ATTACHMENT_UNAVAILABLE');
      const current = await load();
      if (
        !current ||
        !attachmentIsDeliverable(current) ||
        JSON.stringify(current) !== JSON.stringify(file)
      )
        throw new RequestFailure('NOT_FOUND');
      await permit(request, context, current);
      if (request.signal.aborted) throw new RequestFailure('REQUEST_TIMEOUT');
      headers.set('content-type', 'application/octet-stream');
      headers.set(
        'content-disposition',
        disposition(file.upload.filename, file.id),
      );
      headers.set('content-length', String(range?.length ?? file.sizeBytes));
      headers.set('accept-ranges', 'bytes');
      if (range)
        headers.set(
          'content-range',
          `bytes ${range.offset}-${range.offset + range.length - 1}/${file.sizeBytes}`,
        );
      const body = acquired
        ? boundedMediaStream(
            exactBlobStream(acquired.body, acquired.bodySize),
            request.signal,
          )
        : null;
      acquired = null;
      return new Response(body, { status: range ? 206 : 200, headers });
    } catch (error) {
      void acquired?.body.cancel().catch(() => {});
      const failure = publicFailure(
        error instanceof RequestFailure
          ? error
          : new RequestFailure('ATTACHMENT_UNAVAILABLE'),
        undefined,
      );
      headers.set('content-type', 'application/json');
      return new Response(
        request.method === 'HEAD'
          ? null
          : JSON.stringify({
              error: {
                code: failure.code,
                message: failure.message,
                requestId: headers.get('x-request-id'),
              },
            }),
        { status: failure.status, headers },
      );
    }
  };
}
async function permit(
  request: Request,
  context: AttachmentContext,
  file: AttachmentRecord,
) {
  await requireVisibleProject(request, context, file.projectId);
  const actor = await projectBearer(request, context);
  if (request.headers.has('authorization') && !actor)
    throw new RequestFailure('AUTHENTICATION_REQUIRED');
  let issueId = file.issueId;
  if (file.commentId !== null) {
    if (!context.comments) throw new RequestFailure('ATTACHMENT_UNAVAILABLE');
    const comment = await withDeadline(request.signal, 1000, () =>
      context.comments!.getById(file.projectId, file.commentId!),
    );
    if (
      !comment ||
      comment.deletedAt !== null ||
      comment.moderation !== 'visible'
    )
      throw new RequestFailure('NOT_FOUND');
    issueId = comment.issueId;
  }
  const issue =
    issueId === null
      ? null
      : await withDeadline(request.signal, 1000, () =>
          context.issues.getIssue(file.projectId, issueId!),
        );
  if (!issue || issue.deletedAt !== null || issue.moderation !== 'visible')
    throw new RequestFailure('NOT_FOUND');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    request: {
      actorId: actor?.principalId ?? null,
      permission: file.commentId === null ? 'issue:read' : 'comment:read',
      target: {
        projectId: file.projectId,
        type: file.commentId === null ? 'issue' : 'comment',
        id: file.commentId ?? issue.id,
      },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
    credential: credentialFactsOf(actor),
  });
}
function disposition(filename: string, id: string): string {
  filename = filename
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cs}\p{Cf}\\/]/gu, '_');
  const ascii =
    filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) ||
    `attachment-${id}`;
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
/** Pull based, one chunk, 30-second idle reads and five-minute total/caller cancellation. */
function boundedMediaStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let done = false;
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const cleanup = () => {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  };
  const stop = (error?: unknown) => {
    if (done) return;
    done = true;
    cleanup();
    void reader
      .cancel()
      .catch(() => {})
      .finally(() => reader.releaseLock());
    if (error) controller.error(error);
  };
  const abort = () => stop(new RequestFailure('REQUEST_TIMEOUT'));
  const timer = setTimeout(abort, 300000);
  return new ReadableStream<Uint8Array>(
    {
      start(value) {
        controller = value;
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      },
      async pull(value) {
        try {
          const next = await withDeadline(signal, 30000, () => reader.read());
          if (done) return;
          if (next.done) {
            done = true;
            cleanup();
            reader.releaseLock();
            value.close();
          } else value.enqueue(next.value);
        } catch (error) {
          stop(error);
        }
      },
      cancel() {
        stop();
      },
    },
    { highWaterMark: 0 },
  );
}
