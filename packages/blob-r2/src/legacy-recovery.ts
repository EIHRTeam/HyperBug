import { AwsClient } from 'aws4fetch';
import {
  UploadIntentError,
  canonicalUploadLegacyDecision,
  uploadLegacyDecisionJson,
  uploadLegacyRecoveryAccounting,
  multipartAbortable,
  type UploadLegacyRecoveryDecision,
  type UploadLegacyRecoveryProvider,
} from '@hyperbug/application';
import type { R2SigningConfig } from './index.ts';
import { readR2MultipartPage, r2MissingUpload } from './multipart-xml.ts';

export interface R2LegacyRecoveryApproval {
  decision: UploadLegacyRecoveryDecision;
  ownershipEvidence: Uint8Array;
  accountingEvidence: Uint8Array;
}
const unavailable = () => new UploadIntentError('UPLOAD_UNAVAILABLE');
const invalid = () => new UploadIntentError('UPLOAD_INVALID');
function equal(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  if (
    !value ||
    !expected ||
    typeof value !== 'object' ||
    typeof expected !== 'object' ||
    Array.isArray(value) ||
    Array.isArray(expected)
  )
    return false;
  const left = Object.keys(value).sort(),
    right = Object.keys(expected).sort();
  return (
    left.join(',') === right.join(',') &&
    left.every((key) =>
      equal(
        (value as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
      ),
    )
  );
}
async function manifest(
  original: Uint8Array,
  digest: string,
): Promise<unknown> {
  if (
    !(original instanceof Uint8Array) ||
    !original.byteLength ||
    original.byteLength > 16384
  )
    throw invalid();
  // Snapshot before asynchronous hashing; caller mutation cannot change approved bytes.
  const bytes = original.slice();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  if (hash !== digest) throw invalid();
  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes),
    );
  } catch {
    throw invalid();
  }
}
function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    new TextEncoder().encode(value).length <= maximum &&
    !/[\p{Cc}\p{Cs}]/u.test(value)
  );
}

/** One trusted approved record at the fixed direct R2 API; no arbitrary-key operation escapes. */
export async function createR2LegacyRecoveryProvider(
  config: R2SigningConfig,
  approval: R2LegacyRecoveryApproval,
  transport: (request: Request) => Promise<Response> = (request) =>
    fetch(request),
): Promise<{ provider: UploadLegacyRecoveryProvider; close(): void }> {
  const decision = canonicalUploadLegacyDecision(approval.decision);
  const frozenDecision = uploadLegacyDecisionJson(decision),
    key = decision.snapshot.objectKey;
  if (
    !/^[0-9a-f]{32}$/.test(config.accountId) ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket) ||
    !validText(config.credentials?.accessKeyId, 1024) ||
    !validText(config.credentials?.secretAccessKey, 1024) ||
    key.includes('\\') ||
    key.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw invalid();
  const fixed = {
    accountId: config.accountId,
    bucket: config.bucket,
    credentials: { ...config.credentials },
  };
  const [ownership, accounting] = await Promise.all([
    manifest(approval.ownershipEvidence, decision.ownershipEvidenceSha256),
    manifest(approval.accountingEvidence, decision.accountingEvidenceSha256),
  ]);
  if (
    !equal(ownership, {
      version: 'r2-legacy-ownership-1',
      accountId: fixed.accountId,
      bucket: fixed.bucket,
      absencePolicy: 'r2-direct-delete-head-1',
      snapshot: decision.snapshot,
    }) ||
    !equal(accounting, {
      version: 'r2-legacy-accounting-1',
      snapshot: decision.snapshot,
      retained: uploadLegacyRecoveryAccounting(decision),
    })
  )
    throw invalid();
  const base = `https://${fixed.accountId}.r2.cloudflarestorage.com/${fixed.bucket}`;
  const object = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const signer = new AwsClient({
    ...fixed.credentials,
    service: 's3',
    region: 'auto',
  });
  let closed = false,
    busy = false;
  const active = new Set<AbortController>();
  return {
    close() {
      closed = true;
      for (const controller of active) controller.abort();
    },
    provider: {
      async recover(input) {
        if (
          closed ||
          busy ||
          Date.now() - decision.snapshot.expiresAt <
            decision.retainAfterExpiryMs ||
          uploadLegacyDecisionJson(input.decision) !== frozenDecision
        )
          throw unavailable();
        busy = true;
        const timeout = new AbortController();
        active.add(timeout);
        const signal = AbortSignal.any([input.signal, timeout.signal]);
        const timer = setTimeout(() => timeout.abort(), 30000);
        const check = () => {
          if (signal.aborted || closed) throw unavailable();
        };
        const discard = (response: Response) => {
          void response.body?.cancel().catch(() => {});
        };
        async function request(url: URL, method: 'GET' | 'DELETE' | 'HEAD') {
          check();
          const signed = await multipartAbortable(signal, () =>
            signer.sign(url.toString(), {
              method,
              signal,
              redirect: 'manual',
              cache: 'no-store',
              aws: { signQuery: false },
            }),
          );
          check();
          return multipartAbortable(signal, async () => {
            const response = await transport(signed);
            if (
              signal.aborted ||
              closed ||
              response.redirected ||
              (response.status >= 300 && response.status < 400)
            ) {
              discard(response);
              throw unavailable();
            }
            return response;
          });
        }
        async function discover() {
          const exact = new Set<string>(),
            seen = new Set<string>(),
            markers = new Set<string>();
          let next: { key?: string; id: string } | undefined;
          for (let page = 0; page < 5; page++) {
            const url = new URL(base);
            url.searchParams.set('uploads', '');
            url.searchParams.set('prefix', key);
            url.searchParams.set('max-uploads', '20');
            if (next?.key !== undefined)
              url.searchParams.set('key-marker', next.key);
            if (next) url.searchParams.set('upload-id-marker', next.id);
            // eslint-disable-next-line no-await-in-loop -- Bounded sequential continuation.
            const response = await request(url, 'GET');
            if (response.status !== 200) {
              discard(response);
              throw unavailable();
            }
            // eslint-disable-next-line no-await-in-loop -- Reuse bounded XML/body parser within one deadline.
            const result = await readR2MultipartPage(
              response,
              signal,
              fixed.bucket,
              key,
            );
            check();
            if (result.uploads.length > 20 || result.groupedPrefixes !== 0)
              throw unavailable();
            for (const row of result.uploads) {
              if (
                !validText(row.key, 1024) ||
                !row.key.startsWith(key) ||
                !validText(row.id, 2048)
              )
                throw unavailable();
              const identity = JSON.stringify([row.key, row.id]);
              if (seen.has(identity)) throw unavailable();
              seen.add(identity);
              if (row.key === key) exact.add(row.id);
            }
            if (!result.truncated) return [...exact];
            if (
              !result.uploads.length ||
              !validText(result.nextId, 2048) ||
              (result.nextKey !== undefined &&
                (!validText(result.nextKey, 1024) ||
                  !result.nextKey.startsWith(key))) ||
              (result.nextKey === undefined &&
                result.uploads.some((row) => row.key !== key))
            )
              throw unavailable();
            const marker = JSON.stringify([result.nextKey, result.nextId]);
            if (markers.has(marker)) throw unavailable();
            markers.add(marker);
            next = {
              ...(result.nextKey === undefined ? {} : { key: result.nextKey }),
              id: result.nextId,
            };
          }
          throw unavailable();
        }
        async function perform() {
          for (const uploadId of await discover()) {
            const url = new URL(object);
            url.searchParams.set('uploadId', uploadId);
            // eslint-disable-next-line no-await-in-loop -- Abort only exact-key sessions, sequentially.
            const response = await request(url, 'DELETE');
            if (response.status === 204) {
              discard(response);
              continue;
            }
            // Only the closed specific absence error is idempotent.
            if (
              response.status === 404 &&
              // eslint-disable-next-line no-await-in-loop -- Sequential bounded absent-session XML.
              (await r2MissingUpload(response, signal))
            )
              continue;
            discard(response);
            throw unavailable();
          }
          const deleted = await request(new URL(object), 'DELETE');
          discard(deleted);
          if (deleted.status !== 204) throw unavailable();
          const head = await request(new URL(object), 'HEAD');
          discard(head);
          if (head.status !== 404) throw unavailable();
          if ((await discover()).length) throw unavailable();
          check();
          return {
            decisionId: decision.decisionId,
            ownershipEvidenceSha256: decision.ownershipEvidenceSha256,
            key,
            remainingObjects: 0 as const,
            remainingUploads: 0 as const,
          };
        }
        try {
          return await multipartAbortable(signal, perform);
        } catch {
          throw unavailable();
        } finally {
          clearTimeout(timer);
          timeout.abort();
          active.delete(timeout);
          busy = false;
        }
      },
    },
  };
}
