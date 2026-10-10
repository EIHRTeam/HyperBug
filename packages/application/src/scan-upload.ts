import type { BlobStore } from './blob-store.ts';
import type { BlobDigest } from './blob-promotion.ts';
import {
  UploadIntentError,
  type UploadIntentStore,
  type UploadLease,
} from './upload-intents.ts';
import type { AuthorizeUpload } from './uploads.ts';
import {
  attachmentScanPolicyVersion,
  validateScanOutcome,
  type ScanOutcome,
  type ScanFailure,
} from './upload-scans.ts';

/** Trusted configured hook; no client result callback or arbitrary outbound URL. */
export interface AttachmentScanner {
  scan(input: {
    body: ReadableStream<Uint8Array>;
    sizeBytes: number;
    contentType: string;
    signal: AbortSignal;
  }): Promise<ScanOutcome>;
}
export interface UploadScanDependencies {
  intents: UploadIntentStore;
  blobs: BlobStore;
  createDigest: () => BlobDigest;
  scanner: AttachmentScanner | null;
  timeoutMs?: number;
}
/** Independent background handler, with no Module 09 dispatch or scanner supplied by default. */
export async function scanVerifiedUpload(
  deps: UploadScanDependencies,
  authorize: AuthorizeUpload,
  lease: UploadLease,
  clock: () => number = Date.now,
) {
  const live = () => {
    const now = clock();
    if (now >= lease.leaseExpiresAt)
      throw new UploadIntentError('UPLOAD_LEASE_LOST');
    return { ...lease, now };
  };
  const before = await deps.intents.get(lease);
  if (!before) throw new UploadIntentError('UPLOAD_NOT_FOUND');
  await authorize(lease, before.association);
  if (!deps.scanner) throw new UploadIntentError('UPLOAD_UNAVAILABLE');
  const timeoutMs = deps.timeoutMs ?? 60000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 60000)
    throw new UploadIntentError('UPLOAD_INVALID');
  const record = await deps.intents.mutateScan({
    ...live(),
    kind: 'claim',
    policyVersion: attachmentScanPolicyVersion,
  });
  if (record.policyState === 'ready') return record;
  const expected = record.verified!;
  const controller = new AbortController();
  let source: ReadableStreamDefaultReader<Uint8Array> | null = null;
  const digestRef: { value: BlobDigest | null } = { value: null };
  const failureRef: { value: ScanFailure } = { value: 'unavailable' };
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    controller.abort();
    const reader = source;
    if (reader)
      void reader
        .cancel()
        .then(() => reader.releaseLock())
        .catch(() => {});
  };
  const timeout = new Promise<ScanOutcome>((resolve) => {
    timer = setTimeout(
      () => {
        stop();
        resolve({ status: 'failed', failure: 'timeout' });
      },
      Math.min(timeoutMs, lease.leaseExpiresAt - clock()),
    );
  });
  let outcome: ScanOutcome;
  try {
    const operation = (async (): Promise<ScanOutcome> => {
      const object = await deps.blobs.get(record.finalKey);
      if (controller.signal.aborted) {
        void object?.body.cancel().catch(() => {});
        return { status: 'failed', failure: 'timeout' };
      }
      if (
        !object ||
        object.key !== record.finalKey ||
        object.metadata['intent-id'] !== record.id ||
        object.contentType !== record.contentType ||
        object.size !== expected.size ||
        object.bodySize !== expected.size
      ) {
        void object?.body.cancel().catch(() => {});
        return { status: 'failed', failure: 'identity' };
      }
      source = object.body.getReader();
      digestRef.value = deps.createDigest();
      let total = 0,
        consumed = false;
      const body = new ReadableStream<Uint8Array>(
        {
          async pull(sink) {
            try {
              if (controller.signal.aborted) throw new Error();
              const chunk = await source!.read();
              if (controller.signal.aborted) throw new Error();
              if (chunk.done) {
                if (
                  total !== expected.size ||
                  (await digestRef.value!.finish()) !== expected.sha256
                ) {
                  failureRef.value = 'identity';
                  throw new Error();
                }
                consumed = true;
                sink.close();
                return;
              }
              if (chunk.value.byteLength > expected.size - total) {
                failureRef.value = 'identity';
                throw new Error();
              }
              total += chunk.value.byteLength;
              await digestRef.value!.write(chunk.value);
              sink.enqueue(chunk.value);
            } catch {
              sink.error(new UploadIntentError('UPLOAD_UNAVAILABLE'));
            }
          },
          cancel() {
            void source?.cancel().catch(() => {});
          },
        },
        { highWaterMark: 0 },
      );
      let result: ScanOutcome;
      try {
        result = await deps.scanner!.scan({
          body,
          sizeBytes: expected.size,
          contentType: record.contentType,
          signal: controller.signal,
        });
      } catch {
        return { status: 'failed', failure: failureRef.value };
      }
      try {
        validateScanOutcome(result);
      } catch {
        return { status: 'failed', failure: 'invalid-result' };
      }
      if (failureRef.value === 'identity')
        return { status: 'failed', failure: failureRef.value };
      if (result.status !== 'failed' && !consumed)
        return { status: 'failed', failure: 'partial' };
      return result;
    })();
    outcome = await Promise.race([operation, timeout]);
  } catch {
    outcome = { status: 'failed', failure: failureRef.value };
  } finally {
    clearTimeout(timer!);
    stop();
    void digestRef.value?.abort().catch(() => {});
  }
  await authorize(lease, record.association);
  const saved = await deps.intents.mutateScan({
    ...live(),
    kind: 'commit',
    outcome,
  });
  if (outcome.status !== 'clean') return saved;
  await authorize(lease, saved.association);
  return deps.intents.mutateScan({
    ...live(),
    kind: 'release',
    policyVersion: attachmentScanPolicyVersion,
    attemptId: lease.leaseId,
  });
}
