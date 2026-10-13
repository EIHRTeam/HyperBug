import { assertId } from '@hyperbug/domain';
import {
  BlobStoreError,
  assertBlobKey,
  assertBlobSize,
  assertBlobType,
  type BlobStore,
  type BlobRead,
} from './blob-store.ts';

/** One digest per operation; implementations must not retain the complete input. */
export interface BlobDigest {
  write(chunk: Uint8Array): Promise<void>;
  finish(): Promise<string>;
  abort(): Promise<void>;
}
export interface BlobPromotion {
  intentId: string;
  stagingKey: string;
  finalKey: string;
  maxBytes: number;
  contentType: string;
  filename: string;
}
export interface VerifiedBlob {
  key: string;
  size: number;
  sha256: string;
  contentType: string;
  providerVersion: string | null;
  scanStatus: 'unscanned';
}
const knownTypes: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  zip: 'application/zip',
  gz: 'application/gzip',
};
function assertFilename(filename: string, contentType: string): void {
  if (
    !filename ||
    Array.from(filename).length > 255 ||
    filename !== filename.trim() ||
    /[\p{Cc}\p{Cs}\\/]/u.test(filename) ||
    filename === '.' ||
    filename === '..'
  )
    throw new BlobStoreError('BLOB_CONTENT_INVALID');
  const extension = filename.split('.').at(-1)?.toLowerCase();
  const expected =
    extension && Object.hasOwn(knownTypes, extension)
      ? knownTypes[extension]
      : undefined;
  if (
    expected &&
    contentType !== expected &&
    contentType !== 'application/octet-stream'
  )
    throw new BlobStoreError('BLOB_CONTENT_INVALID');
}
function assertMagic(contentType: string, prefix: Uint8Array): void {
  const starts = (bytes: readonly number[], offset = 0) =>
    bytes.every((b, i) => prefix[offset + i] === b);
  const text = (value: string, offset = 0) =>
    starts(
      Array.from(value, (c) => c.charCodeAt(0)),
      offset,
    );
  const valid =
    contentType === 'image/png'
      ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : contentType === 'image/jpeg'
        ? starts([255, 216, 255])
        : contentType === 'image/gif'
          ? text('GIF87a') || text('GIF89a')
          : contentType === 'image/webp'
            ? text('RIFF') && text('WEBP', 8)
            : contentType === 'application/pdf'
              ? text('%PDF-')
              : contentType === 'application/zip'
                ? starts([80, 75, 3, 4]) ||
                  starts([80, 75, 5, 6]) ||
                  starts([80, 75, 7, 8])
                : contentType === 'application/gzip'
                  ? starts([31, 139, 8])
                  : true;
  if (!valid) throw new BlobStoreError('BLOB_CONTENT_INVALID');
}
async function inspectFinal(
  object: BlobRead,
  input: BlobPromotion,
  createDigest: () => BlobDigest,
): Promise<VerifiedBlob> {
  if (
    object.key !== input.finalKey ||
    object.metadata['intent-id'] !== input.intentId ||
    object.contentType !== input.contentType ||
    object.size > input.maxBytes ||
    object.bodySize !== object.size
  ) {
    await object.body.cancel().catch(() => {});
    throw new BlobStoreError('BLOB_CONTENT_INVALID');
  }
  const digest = createDigest();
  const reader = object.body.getReader();
  const prefix = new Uint8Array(64);
  let prefixSize = 0;
  let total = 0;
  try {
    for (;;) {
      // Serial reads/writes bound memory and preserve backpressure on the digest sink.
      // oxlint-disable-next-line no-await-in-loop
      const next = await reader.read();
      if (next.done) break;
      if (next.value.byteLength > input.maxBytes - total)
        throw new BlobStoreError('BLOB_SIZE_MISMATCH');
      total += next.value.byteLength;
      const count = Math.min(prefix.length - prefixSize, next.value.byteLength);
      prefix.set(next.value.subarray(0, count), prefixSize);
      prefixSize += count;
      // oxlint-disable-next-line no-await-in-loop
      await digest.write(next.value);
    }
    if (total !== object.size) throw new BlobStoreError('BLOB_SIZE_MISMATCH');
    assertMagic(input.contentType, prefix.subarray(0, prefixSize));
    const sha256 = await digest.finish();
    if (!/^[0-9a-f]{64}$/.test(sha256))
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    return {
      key: input.finalKey,
      size: total,
      sha256,
      contentType: input.contentType,
      providerVersion: object.version,
      scanStatus: 'unscanned',
    };
  } catch (error) {
    await digest.abort().catch(() => {});
    throw error instanceof BlobStoreError
      ? error
      : new BlobStoreError('BLOB_UNAVAILABLE');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
/**
 * Bounded background-processing primitive, never a public finalize/release endpoint.
 * Caller must first reauthorize and acquire a persisted lease/reservation with these keys.
 * It must persist the verified result or mark rejection and schedule owned cleanup.
 */
export async function promoteStagingBlob(
  store: BlobStore,
  createDigest: () => BlobDigest,
  input: BlobPromotion,
): Promise<VerifiedBlob> {
  assertId(input.intentId);
  assertBlobKey(input.stagingKey, true);
  assertBlobKey(input.finalKey);
  if (!input.finalKey.startsWith('objects/'))
    throw new BlobStoreError('BLOB_INVALID');
  assertBlobSize(input.maxBytes);
  assertBlobType(input.contentType);
  assertFilename(input.filename, input.contentType);
  let final = await store.get(input.finalKey);
  if (!final) {
    const staging = await store.get(input.stagingKey);
    if (!staging) throw new BlobStoreError('BLOB_NOT_FOUND');
    if (
      staging.size > input.maxBytes ||
      staging.contentType !== input.contentType ||
      staging.bodySize !== staging.size
    ) {
      await staging.body.cancel().catch(() => {});
      throw new BlobStoreError('BLOB_CONTENT_INVALID');
    }
    try {
      await store.put({
        key: input.finalKey,
        body: staging.body,
        size: staging.size,
        contentType: input.contentType,
        metadata: { 'intent-id': input.intentId },
        createOnly: true,
      });
    } catch (error) {
      await staging.body.cancel().catch(() => {});
      // Another worker may have completed the same persisted intent lease before our PUT.
      if (
        !(error instanceof BlobStoreError) ||
        error.code !== 'BLOB_PRECONDITION'
      )
        throw error;
    }
    final = await store.get(input.finalKey);
    if (!final) throw new BlobStoreError('BLOB_UNAVAILABLE');
  }
  // Resume from a crash after object creation even if a reusable staging capability overwrote it.
  // Actual immutable final bytes, authored intent identity and policy are always inspected.
  return inspectFinal(final, input, createDigest);
}
