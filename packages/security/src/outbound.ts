export interface OutboundOperation {
  readonly method: 'GET' | 'POST';
  /** Exact relative path and optional fixed query string. */
  readonly path: string;
}

/** Fixed, operator-controlled HTTPS origins and request operations. */
export interface OutboundDestination {
  readonly id: string;
  readonly origin: string;
  readonly operations: readonly OutboundOperation[];
}

export interface OutboundLimits {
  readonly destinations: readonly OutboundDestination[];
  readonly maxConcurrent: number;
  readonly timeoutMs: number;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
}

export interface OutboundRequest {
  readonly destination: string;
  readonly path: string;
  readonly method?: 'GET' | 'POST';
  readonly headers?: HeadersInit;
  readonly body?: Uint8Array;
  readonly signal?: AbortSignal;
}

export interface OutboundResult {
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Uint8Array;
}

export type OutboundFailureCode =
  | 'INVALID_POLICY'
  | 'DESTINATION_FORBIDDEN'
  | 'REQUEST_TOO_LARGE'
  | 'RESPONSE_TOO_LARGE'
  | 'OVERLOADED'
  | 'TIMEOUT'
  | 'UPSTREAM_REJECTED'
  | 'UNAVAILABLE';

export class OutboundFailure extends Error {
  readonly code: OutboundFailureCode;
  constructor(code: OutboundFailureCode) {
    super(code);
    this.name = 'OutboundFailure';
    this.code = code;
  }
}

function boundedInteger(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function destinationOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (
      url.protocol !== 'https:' ||
      url.origin !== value ||
      url.username ||
      url.password ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) ||
      host
        .split('.')
        .some(
          (part) =>
            part.length > 63 || part.startsWith('-') || part.endsWith('-'),
        ) ||
      /\.(?:localhost|local|internal|invalid)$/.test(host) ||
      /^(?:\d+\.)+\d+$/.test(host)
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

interface ReviewedDestination {
  readonly origin: string;
  readonly operations: ReadonlySet<string>;
}

function validateLimits(
  limits: OutboundLimits,
): Map<string, ReviewedDestination> {
  if (
    !boundedInteger(limits.maxConcurrent, 1, 32) ||
    !boundedInteger(limits.timeoutMs, 50, 30000) ||
    !boundedInteger(limits.maxRequestBytes, 0, 1048576) ||
    !boundedInteger(limits.maxResponseBytes, 1, 8388608) ||
    !Array.isArray(limits.destinations) ||
    limits.destinations.length > 32
  )
    throw new OutboundFailure('INVALID_POLICY');
  const destinations = new Map<string, ReviewedDestination>();
  for (const item of limits.destinations) {
    const origin = destinationOrigin(item?.origin ?? '');
    if (
      !item ||
      !/^[a-z][a-z0-9-]{0,63}$/.test(item.id) ||
      !origin ||
      destinations.has(item.id) ||
      !Array.isArray(item.operations) ||
      item.operations.length < 1 ||
      item.operations.length > 32
    )
      throw new OutboundFailure('INVALID_POLICY');
    const operations = new Set<string>();
    for (const operation of item.operations) {
      if (
        !operation ||
        (operation.method !== 'GET' && operation.method !== 'POST')
      )
        throw new OutboundFailure('INVALID_POLICY');
      try {
        requestUrl(origin, operation.path);
      } catch {
        throw new OutboundFailure('INVALID_POLICY');
      }
      const key = `${operation.method} ${operation.path}`;
      if (operations.has(key)) throw new OutboundFailure('INVALID_POLICY');
      operations.add(key);
    }
    destinations.set(item.id, { origin, operations });
  }
  return destinations;
}

function requestUrl(origin: string, path: string): string {
  if (
    typeof path !== 'string' ||
    path.length > 4096 ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    path.includes('#') ||
    path.split('?', 1)[0]!.includes('%') ||
    Array.from(path).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    throw new OutboundFailure('DESTINATION_FORBIDDEN');
  try {
    const url = new URL(path, origin);
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      `${url.pathname}${url.search}` !== path
    )
      throw new OutboundFailure('DESTINATION_FORBIDDEN');
    return url.href;
  } catch {
    throw new OutboundFailure('DESTINATION_FORBIDDEN');
  }
}

function requestHeaders(value: HeadersInit | undefined): Headers {
  let headers: Headers;
  try {
    headers = new Headers(value);
  } catch {
    throw new OutboundFailure('DESTINATION_FORBIDDEN');
  }
  let total = 0;
  let count = 0;
  for (const [name, content] of headers) {
    count++;
    total += name.length + content.length;
    if (
      ![
        'accept',
        'authorization',
        'content-type',
        'idempotency-key',
        'x-api-key',
      ].includes(name) ||
      count > 5 ||
      total > 8192
    )
      throw new OutboundFailure('DESTINATION_FORBIDDEN');
  }
  return headers;
}

/** No dynamic origins, IP literals, private network or arbitrary URL support. */
export function createOutboundFetcher(
  limits: OutboundLimits,
  transport: typeof fetch,
): (request: OutboundRequest) => Promise<OutboundResult> {
  const destinations = validateLimits(limits);
  if (typeof transport !== 'function')
    throw new OutboundFailure('INVALID_POLICY');
  const maxConcurrent = limits.maxConcurrent;
  const timeoutMs = limits.timeoutMs;
  const maxRequestBytes = limits.maxRequestBytes;
  const maxResponseBytes = limits.maxResponseBytes;
  let active = 0;
  return async (request) => {
    const destination = destinations.get(request.destination);
    if (!destination) throw new OutboundFailure('DESTINATION_FORBIDDEN');
    const url = requestUrl(destination.origin, request.path);
    const method = request.method ?? 'GET';
    if (method !== 'GET' && method !== 'POST')
      throw new OutboundFailure('DESTINATION_FORBIDDEN');
    if (!destination.operations.has(`${method} ${request.path}`))
      throw new OutboundFailure('DESTINATION_FORBIDDEN');
    const headers = requestHeaders(request.headers);
    if (
      (method === 'GET' && request.body) ||
      (request.body && !(request.body instanceof Uint8Array)) ||
      (request.body && request.body.byteLength > maxRequestBytes)
    )
      throw new OutboundFailure('REQUEST_TOO_LARGE');
    if (request.signal?.aborted) throw new OutboundFailure('UNAVAILABLE');
    if (active >= maxConcurrent) throw new OutboundFailure('OVERLOADED');
    active++;
    const controller = new AbortController();
    let onAbort: () => void = () => undefined;
    const cancellation = new Promise<never>((_, reject) => {
      onAbort = () => {
        controller.abort();
        reject(new OutboundFailure('UNAVAILABLE'));
      };
    });
    request.signal?.addEventListener('abort', onAbort, { once: true });
    if (request.signal?.aborted) onAbort();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new OutboundFailure('TIMEOUT'));
      }, timeoutMs);
    });
    const operation = (async (): Promise<OutboundResult> => {
      try {
        const response = await transport(url, {
          method,
          headers,
          body: request.body ? Uint8Array.from(request.body).buffer : null,
          cache: 'no-store',
          redirect: 'manual',
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          void response.body?.cancel().catch(() => undefined);
          throw new OutboundFailure(
            request.signal?.aborted ? 'UNAVAILABLE' : 'TIMEOUT',
          );
        }
        if (response.status < 200 || response.status >= 300) {
          void response.body?.cancel().catch(() => undefined);
          throw new OutboundFailure('UPSTREAM_REJECTED');
        }
        const declared = response.headers.get('content-length');
        if (
          declared !== null &&
          /^\d+$/.test(declared) &&
          Number(declared) > maxResponseBytes
        ) {
          void response.body?.cancel().catch(() => undefined);
          throw new OutboundFailure('RESPONSE_TOO_LARGE');
        }
        if (!response.body)
          return {
            status: response.status,
            contentType: response.headers.get('content-type'),
            body: new Uint8Array(),
          };
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          try {
            while (true) {
              if (controller.signal.aborted)
                throw new OutboundFailure(
                  request.signal?.aborted ? 'UNAVAILABLE' : 'TIMEOUT',
                );
              // Stream reads must be sequential to enforce the byte cap.
              // oxlint-disable-next-line no-await-in-loop
              const { done, value } = await reader.read();
              if (controller.signal.aborted)
                throw new OutboundFailure(
                  request.signal?.aborted ? 'UNAVAILABLE' : 'TIMEOUT',
                );
              if (done) break;
              size += value.byteLength;
              if (size > maxResponseBytes)
                throw new OutboundFailure('RESPONSE_TOO_LARGE');
              // A transport may reuse its chunk storage on the next read.
              chunks.push(Uint8Array.from(value));
            }
          } catch (error) {
            void reader.cancel().catch(() => undefined);
            throw error;
          } finally {
            reader.releaseLock();
          }
          const body = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            body.set(chunk, offset);
            offset += chunk.byteLength;
          }
          return {
            status: response.status,
            contentType: response.headers.get('content-type'),
            body,
          };
        } finally {
          for (const chunk of chunks) chunk.fill(0);
        }
      } catch (error) {
        if (error instanceof OutboundFailure) throw error;
        throw new OutboundFailure('UNAVAILABLE');
      }
    })();
    void operation.then(
      () => {
        active--;
      },
      () => {
        active--;
      },
    );
    try {
      return await Promise.race([operation, deadline, cancellation]);
    } finally {
      if (timer) clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  };
}
