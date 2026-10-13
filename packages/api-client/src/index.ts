import { operations, type OperationTypes } from './operations.ts';
export type { OperationTypes } from './operations.ts';
export type * from '@hyperbug/contracts';

export type Operation = {
  [K in keyof OperationTypes]: K extends
    | `${string} /api/v1/${string}`
    | `${string} /health/${string}`
    | 'POST /auth/token'
    | 'POST /auth/token/revoke'
    ? K
    : never;
}[keyof OperationTypes];
export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly idempotencyKey?: string;
  /** Explicitly enable receipt/resource-protected mutation replay. */
  readonly retryMutation?: boolean;
}
export type RequestInput<K extends Operation> = RequestOptions &
  (keyof OperationTypes[K]['params'] extends never
    ? { params?: never }
    : { params: OperationTypes[K]['params'] }) &
  (OperationTypes[K]['body'] extends undefined
    ? { body?: never }
    : { body: OperationTypes[K]['body'] }) & {
    query?: OperationTypes[K]['query'];
  };
export interface ClientOptions {
  readonly baseUrl: string;
  /** Read from memory for each attempt. The client never persists a token. */
  readonly getToken?: () => string | null | Promise<string | null>;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
  /** Additional attempts: 0–2, within one total request deadline. */
  readonly maxRetries?: number;
  readonly maxResponseBytes?: number;
}
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly ambiguous: boolean;
  constructor(
    status: number,
    code: string,
    requestId: string | null = null,
    ambiguous = false,
  ) {
    super(
      status
        ? `API request failed (${status}).`
        : 'API request could not complete.',
    );
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.ambiguous = ambiguous;
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function boundedInteger(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new ApiClientError(0, 'CLIENT_CONFIGURATION');
  return value;
}
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = () => reject(new ApiClientError(0, 'CANCELLED'));
    if (signal.aborted) {
      stop();
      return;
    }
    signal.addEventListener('abort', stop, { once: true });
    work
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', stop));
  });
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(new ApiClientError(0, 'CANCELLED'));
    };
    if (signal.aborted) {
      reject(new ApiClientError(0, 'CANCELLED'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    signal.addEventListener('abort', stop, { once: true });
  });
}
async function readJson(
  response: Response,
  maximum: number,
  signal: AbortSignal,
): Promise<unknown> {
  if (!response.body)
    throw new ApiClientError(response.status, 'INVALID_RESPONSE');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    async function readNext(): Promise<void> {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) return;
      length += value.byteLength;
      if (length > maximum)
        throw new ApiClientError(response.status, 'RESPONSE_TOO_LARGE');
      chunks.push(value);
      return readNext();
    }
    await readNext();
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    // Do not allow a broken transport's cancellation promise to extend a deadline.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createApiClient(options: ClientOptions) {
  let base: URL;
  try {
    base = new URL(options.baseUrl);
  } catch {
    throw new ApiClientError(0, 'CLIENT_CONFIGURATION');
  }
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/' ||
    (base.protocol !== 'https:' &&
      !(
        base.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
      ))
  )
    throw new ApiClientError(0, 'CLIENT_CONFIGURATION');
  const fetcher = options.fetch ?? globalThis.fetch;
  const retries = boundedInteger(options.maxRetries ?? 2, 0, 2);
  const timeout = boundedInteger(options.timeoutMs ?? 10000, 1, 120000);
  const responseLimit = boundedInteger(
    options.maxResponseBytes ?? 8 * 1024 * 1024,
    1024,
    64 * 1024 * 1024,
  );
  return {
    async request<K extends Operation>(
      operation: K,
      ...args: {} extends RequestInput<K>
        ? [input?: RequestInput<K>]
        : [input: RequestInput<K>]
    ): Promise<OperationTypes[K]['response']> {
      const input = (args[0] ?? {}) as RequestOptions & {
        params?: Record<string, string>;
        query?: Record<string, unknown>;
        body?: unknown;
      };
      const metadata = operations[operation];
      if (
        !metadata ||
        (!metadata.path.startsWith('/api/v1/') &&
          !metadata.path.startsWith('/health/') &&
          !['/auth/token', '/auth/token/revoke'].includes(metadata.path))
      )
        throw new ApiClientError(0, 'CLIENT_CONFIGURATION');
      if (
        input.idempotencyKey !== undefined &&
        (metadata.replay !== 'key' ||
          !/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey))
      )
        throw new ApiClientError(0, 'INVALID_IDEMPOTENCY_KEY');
      const path = metadata.path.replace(
        /\{([A-Za-z][A-Za-z0-9]*)\}/g,
        (_, key: string) => {
          const value = input.params?.[key];
          if (
            !value ||
            value === '.' ||
            value === '..' ||
            value.length > 1024 ||
            [...value].some(
              (character) =>
                character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
            )
          )
            throw new ApiClientError(0, 'INVALID_PARAMETERS');
          return encodeURIComponent(value);
        },
      );
      const url = new URL(path, base);
      for (const [name, value] of Object.entries(input.query ?? {})) {
        if (value === undefined) continue;
        if (!['string', 'number', 'boolean'].includes(typeof value))
          throw new ApiClientError(0, 'INVALID_PARAMETERS');
        url.searchParams.set(name, String(value));
      }
      const unsafe = !['GET', 'HEAD'].includes(metadata.method);
      const canReplay =
        !unsafe ||
        (input.retryMutation === true &&
          ((metadata.replay === 'key' && input.idempotencyKey !== undefined) ||
            metadata.replay === 'resource'));
      let serialized: string | undefined;
      try {
        serialized =
          input.body === undefined
            ? undefined
            : metadata.contentType === 'application/x-www-form-urlencoded'
              ? new URLSearchParams(
                  input.body as Record<string, string>,
                ).toString()
              : JSON.stringify(input.body);
      } catch {
        throw new ApiClientError(0, 'INVALID_PARAMETERS');
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      let timedOut = false;
      const totalTimeout = boundedInteger(
        input.timeoutMs ?? timeout,
        1,
        120000,
      );
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, totalTimeout);
      input.signal?.addEventListener('abort', abort, { once: true });
      if (input.signal?.aborted) controller.abort();
      let sent = false;
      try {
        const send = async (
          attempt: number,
        ): Promise<OperationTypes[K]['response']> => {
          if (controller.signal.aborted)
            throw new ApiClientError(
              0,
              timedOut ? 'TIMEOUT' : 'CANCELLED',
              null,
              sent && unsafe,
            );
          const headers = new Headers({ Accept: 'application/json' });
          if (serialized !== undefined)
            headers.set('Content-Type', metadata.contentType);
          if (input.idempotencyKey)
            headers.set('Idempotency-Key', input.idempotencyKey);
          if (
            metadata.authentication === 'bearer' ||
            metadata.authentication === 'optional-bearer'
          ) {
            const token = await abortable(
              Promise.resolve(options.getToken?.() ?? null),
              controller.signal,
            );
            if (token !== null) {
              if (!/^at_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))
                throw new ApiClientError(0, 'INVALID_TOKEN');
              headers.set('Authorization', `Bearer ${token}`);
            }
          }
          let response: Response;
          try {
            sent = true;
            response = await abortable(
              fetcher(url, {
                method: metadata.method,
                headers,
                credentials: 'omit',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                cache: 'no-store',
                signal: controller.signal,
                ...(serialized === undefined ? {} : { body: serialized }),
              }),
              controller.signal,
            );
          } catch {
            if (controller.signal.aborted)
              throw new ApiClientError(
                0,
                timedOut ? 'TIMEOUT' : 'CANCELLED',
                null,
                unsafe,
              );
            if (!canReplay || attempt >= retries)
              throw new ApiClientError(0, 'NETWORK_ERROR', null, unsafe);
            await delay(100 * 2 ** attempt, controller.signal);
            return send(attempt + 1);
          }
          if (
            canReplay &&
            attempt < retries &&
            [429, 502, 503, 504].includes(response.status)
          ) {
            const hint = response.headers.get('retry-after');
            const wait =
              hint && /^[0-9]+$/.test(hint)
                ? Number(hint) * 1000
                : 100 * 2 ** attempt;
            if (wait <= 2000 && wait < totalTimeout) {
              void response.body?.cancel().catch(() => {});
              await delay(wait, controller.signal);
              return send(attempt + 1);
            }
          }
          if (response.status === 204)
            return undefined as OperationTypes[K]['response'];
          if (!response.ok) {
            let code = 'HTTP_ERROR';
            const headerId = response.headers.get('x-request-id');
            let requestId = headerId && uuid.test(headerId) ? headerId : null;
            try {
              const payload = (await readJson(
                response,
                Math.min(responseLimit, 16384),
                controller.signal,
              )) as { error?: { code?: unknown; requestId?: unknown } };
              if (
                typeof payload?.error?.code === 'string' &&
                /^[A-Z][A-Z0-9_]{0,79}$/.test(payload.error.code)
              )
                code = payload.error.code;
              if (
                typeof payload?.error?.requestId === 'string' &&
                uuid.test(payload.error.requestId)
              )
                requestId = payload.error.requestId;
            } catch {
              /* Raw body, exception and provider messages never cross the client error boundary. */
            }
            throw new ApiClientError(
              response.status,
              code,
              requestId,
              unsafe && response.status >= 500,
            );
          }
          if (
            !response.headers
              .get('content-type')
              ?.toLowerCase()
              .startsWith('application/json')
          ) {
            void response.body?.cancel().catch(() => {});
            throw new ApiClientError(response.status, 'INVALID_RESPONSE');
          }
          try {
            return (await readJson(
              response,
              responseLimit,
              controller.signal,
            )) as OperationTypes[K]['response'];
          } catch (error) {
            if (error instanceof ApiClientError)
              throw new ApiClientError(
                error.status,
                error.code,
                error.requestId,
                unsafe,
              );
            throw new ApiClientError(
              response.status,
              'INVALID_RESPONSE',
              null,
              unsafe,
            );
          }
        };
        return await send(0);
      } catch (error) {
        if (controller.signal.aborted)
          throw new ApiClientError(
            0,
            timedOut ? 'TIMEOUT' : 'CANCELLED',
            null,
            sent && unsafe,
          );
        if (error instanceof ApiClientError) throw error;
        throw new ApiClientError(0, 'CLIENT_ERROR', null, sent && unsafe);
      } finally {
        clearTimeout(timer);
        input.signal?.removeEventListener('abort', abort);
      }
    },
  };
}
