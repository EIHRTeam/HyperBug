import type { InputLimits } from '@hyperbug/config';
import { RequestFailure } from './errors.ts';
import { assertJsonDepth, assertJsonShape } from './input.ts';

export { RequestFailure } from './errors.ts';

export const AUTHORIZATION_TIMEOUT_MS = 1000;
export const STORE_READ_TIMEOUT_MS = 1000;
export const STORE_WRITE_TIMEOUT_MS = 1000;
type DeadlinePolicy = {
  readonly readMs: number;
  readonly writeMs: number;
  readonly securityMs: number;
};
const deadlinePolicies = new WeakMap<AbortSignal, DeadlinePolicy>();
/** Bound by composition per request; standalone helpers use conservative defaults. */
export function bindDeadlinePolicy(
  signal: AbortSignal,
  policy: DeadlinePolicy,
): void {
  deadlinePolicies.set(signal, Object.freeze({ ...policy }));
}
export function securityDecisionTimeoutMs(signal: AbortSignal): number {
  return deadlinePolicies.get(signal)?.securityMs ?? AUTHORIZATION_TIMEOUT_MS;
}
export function storeReadTimeoutMs(signal: AbortSignal): number {
  return deadlinePolicies.get(signal)?.readMs ?? STORE_READ_TIMEOUT_MS;
}
export function storeWriteTimeoutMs(signal: AbortSignal): number {
  return deadlinePolicies.get(signal)?.writeMs ?? STORE_WRITE_TIMEOUT_MS;
}

export async function withDeadline<T>(
  signal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadline = new AbortController();
  const combined = AbortSignal.any([signal, deadline.signal]);
  const policy = deadlinePolicies.get(signal);
  if (policy) deadlinePolicies.set(combined, policy);
  let rejectAbort: (reason: unknown) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => rejectAbort(new RequestFailure('REQUEST_TIMEOUT'));
  combined.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => deadline.abort(), timeoutMs);
  try {
    if (combined.aborted) onAbort();
    return await Promise.race([
      aborted,
      combined.aborted ? aborted : operation(combined),
    ]);
  } finally {
    clearTimeout(timer);
    combined.removeEventListener('abort', onAbort);
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
  limits: InputLimits,
): Promise<unknown> {
  if (!request.body) throw new RequestFailure('INVALID_JSON');
  const reader = request.body.getReader();
  try {
    return await withDeadline(request.signal, timeoutMs, async (signal) => {
      const cancel = () => {
        void reader.cancel().catch(() => {});
      };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          // A ReadableStreamDefaultReader must be read one chunk at a time; the
          // bound is enforced per chunk as it arrives.
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read();
          if (signal.aborted) throw new RequestFailure('REQUEST_TIMEOUT');
          if (done) break;
          length += value.byteLength;
          if (length > maxBytes) throw new RequestFailure('BODY_TOO_LARGE');
          chunks.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        try {
          const text = new TextDecoder('utf-8', {
            fatal: true,
            ignoreBOM: false,
          }).decode(bytes);
          assertJsonDepth(text, limits.maxJsonDepth);
          const value: unknown = JSON.parse(text);
          assertJsonShape(value, limits);
          return value;
        } catch (error) {
          if (error instanceof RequestFailure) throw error;
          throw new RequestFailure('INVALID_JSON');
        }
      } finally {
        signal.removeEventListener('abort', cancel);
      }
    });
  } finally {
    // Cancelling a custom stream can itself wait forever. Do not let cleanup
    // extend the already-enforced request deadline or body-size rejection.
    void reader.cancel().catch(() => {});
  }
}

/** Bounded form reading for the token endpoints; each field stays a string. */
export async function readBoundedForm(
  request: Request,
  maxBytes: number,
  timeoutMs: number,
): Promise<Record<string, string>> {
  if (!request.body) throw new RequestFailure('INVALID_REQUEST');
  const reader = request.body.getReader();
  try {
    const text = await withDeadline(
      request.signal,
      timeoutMs,
      async (signal) => {
        const cancel = () => {
          void reader.cancel().catch(() => {});
        };
        signal.addEventListener('abort', cancel, { once: true });
        try {
          const chunks: Uint8Array[] = [];
          let length = 0;
          while (true) {
            // A ReadableStreamDefaultReader must be read one chunk at a time; the
            // bound is enforced per chunk as it arrives.
            // eslint-disable-next-line no-await-in-loop
            const { done, value } = await reader.read();
            if (signal.aborted) throw new RequestFailure('REQUEST_TIMEOUT');
            if (done) break;
            length += value.byteLength;
            if (length > maxBytes) throw new RequestFailure('BODY_TOO_LARGE');
            chunks.push(value);
          }
          const bytes = new Uint8Array(length);
          let offset = 0;
          for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
          }
          return new TextDecoder('utf-8', {
            fatal: true,
            ignoreBOM: false,
          }).decode(bytes);
        } finally {
          signal.removeEventListener('abort', cancel);
        }
      },
    );
    const fields: Record<string, string> = {};
    for (const [name, value] of new URLSearchParams(text).entries()) {
      // First occurrence wins; a duplicated field never replaces the first.
      if (fields[name] === undefined) fields[name] = value;
    }
    return fields;
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('INVALID_REQUEST');
  } finally {
    void reader.cancel().catch(() => {});
  }
}
