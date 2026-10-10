import type { BlobDigest } from './blob-promotion.ts';
import type { ScannerServiceIdentity } from './scanner-service-protocol.ts';
import type { ScanFailure } from './upload-scans.ts';

/** Streaming exact-size identity for the bytes actually requested by the next consumer. */
export function guardScannerServiceInput(
  body: ReadableStream<Uint8Array>,
  sizeBytes: number,
  signal: AbortSignal,
  createDigest: () => BlobDigest,
) {
  const source = body.getReader();
  let digest: BlobDigest;
  const release = () => {
    void source
      .cancel()
      .catch(() => {})
      .finally(() => source.releaseLock());
  };
  try {
    digest = createDigest();
  } catch (error) {
    release();
    throw error;
  }
  let total = 0,
    stopped = false;
  let identity: ScannerServiceIdentity | null = null;
  let failure: ScanFailure = 'partial';
  const stop = () => {
    if (stopped) return;
    stopped = true;
    release();
    void digest.abort().catch(() => {});
  };
  const stream = new ReadableStream<Uint8Array>(
    {
      async pull(sink) {
        try {
          signal.throwIfAborted();
          const next = await source.read();
          signal.throwIfAborted();
          if (next.done) {
            if (total !== sizeBytes) throw new Error();
            failure = 'unavailable';
            const sha256 = await digest.finish();
            signal.throwIfAborted();
            if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error();
            identity = Object.freeze({ sizeBytes: total, sha256 });
            sink.close();
            return;
          }
          if (
            !(next.value instanceof Uint8Array) ||
            next.value.byteLength === 0 ||
            next.value.byteLength > sizeBytes - total
          )
            throw new Error();
          total += next.value.byteLength;
          failure = 'unavailable';
          await digest.write(next.value);
          signal.throwIfAborted();
          failure = 'partial';
          sink.enqueue(next.value);
        } catch {
          stop();
          sink.error(new Error('Scanner service input failed'));
        }
      },
      cancel: stop,
    },
    { highWaterMark: 0 },
  );
  return {
    body: stream,
    stop,
    get identity() {
      return identity;
    },
    get failure() {
      return failure;
    },
  };
}
