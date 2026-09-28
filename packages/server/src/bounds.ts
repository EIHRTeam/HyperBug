import type { InputLimits } from '@hyperbug/config';
import { RequestFailure } from './errors.ts';
import { assertJsonDepth, assertJsonShape } from './input.ts';

export { RequestFailure } from './errors.ts';

export async function withDeadline<T>(
  signal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const deadline = new AbortController();
  const combined = AbortSignal.any([signal, deadline.signal]);
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
