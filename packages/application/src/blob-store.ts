/** Internal ports only. Authorization belongs to attachment services, never the store. */
export interface BlobInfo {
  key: string;
  size: number;
  /** Opaque provider validator; never assume this is a digest or immutable identity. */
  etag: string;
  version: string | null;
  contentType: string;
  metadata: Record<string, string>;
}
export interface BlobRead extends BlobInfo {
  /** Delivered bytes; `size` is always the total object size, including ranged reads. */
  bodySize: number;
  body: ReadableStream<Uint8Array>;
}
export interface BlobWrite {
  key: string;
  body: ReadableStream<Uint8Array>;
  size: number;
  contentType: string;
  metadata?: Record<string, string>;
  /** Mandatory for final keys; a failed precondition stores nothing. */
  createOnly: boolean;
  sha256?: string;
}
export interface BlobRange {
  offset: number;
  length: number;
}
export interface BlobMultipart {
  key: string;
  uploadId: string;
}
export interface BlobPart {
  partNumber: number;
  etag: string;
}
export interface BlobMultipartPolicy {
  thresholdBytes: number;
  minPartBytes: number;
  maxPartBytes: number;
  maxParts: number;
}
export interface BlobStore {
  readonly multipart: Readonly<BlobMultipartPolicy>;
  put(input: BlobWrite): Promise<BlobInfo>;
  get(key: string, range?: BlobRange): Promise<BlobRead | null>;
  head(key: string): Promise<BlobInfo | null>;
  delete(key: string): Promise<void>;
  createMultipart(
    input: Pick<BlobWrite, 'key' | 'contentType' | 'metadata'>,
  ): Promise<BlobMultipart>;
  uploadPart(
    upload: BlobMultipart,
    partNumber: number,
    body: ReadableStream<Uint8Array>,
    size: number,
  ): Promise<BlobPart>;
  completeMultipart(
    upload: BlobMultipart,
    parts: readonly BlobPart[],
  ): Promise<BlobInfo>;
  abortMultipart(upload: BlobMultipart): Promise<void>;
}
/** Bearer capabilities: do not log or persist URLs. Upload capabilities only address staging. */
export interface BlobCapability {
  method: 'PUT' | 'GET';
  url: string;
  headers: Record<string, string>;
  expiresAt: number;
}
export interface BlobAuthorization {
  upload(input: {
    key: string;
    contentType: string;
    expiresInSeconds: number;
  }): Promise<BlobCapability>;
  uploadPart(
    input: BlobMultipart & { partNumber: number; expiresInSeconds: number },
  ): Promise<BlobCapability>;
  download(input: {
    key: string;
    expiresInSeconds: number;
    contentType: string;
    contentDisposition: string;
  }): Promise<BlobCapability>;
}
export class BlobStoreError extends Error {
  readonly code:
    | 'BLOB_INVALID'
    | 'BLOB_SIZE_MISMATCH'
    | 'BLOB_CHECKSUM_MISMATCH'
    | 'BLOB_CONTENT_INVALID'
    | 'BLOB_PRECONDITION'
    | 'BLOB_NOT_FOUND'
    | 'BLOB_UNAVAILABLE';
  constructor(code: BlobStoreError['code']) {
    super(code);
    this.name = 'BlobStoreError';
    this.code = code;
  }
}
export function assertBlobKey(key: string, stagingOnly = false): void {
  if (
    !(
      stagingOnly
        ? /^staging\/[0-9a-f]{64}$/
        : /^(?:staging|objects)\/[0-9a-f]{64}$/
    ).test(key)
  )
    throw new BlobStoreError('BLOB_INVALID');
}
export function assertBlobSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > 5 * 1024 ** 3)
    throw new BlobStoreError('BLOB_INVALID');
}
export function assertBlobType(contentType: string): void {
  if (
    contentType.length > 127 ||
    !/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(
      contentType,
    )
  )
    throw new BlobStoreError('BLOB_INVALID');
}
export function validateBlobMetadata(
  metadata: Record<string, string> = {},
): Record<string, string> {
  const entries = Object.entries(metadata);
  if (
    entries.length > 16 ||
    entries.reduce((n, [k, v]) => n + k.length + v.length, 0) > 1024 ||
    entries.some(
      ([k, v]) =>
        !/^[a-z][a-z0-9-]{0,63}$/.test(k) || !/^[\x20-\x7e]*$/.test(v),
    )
  )
    throw new BlobStoreError('BLOB_INVALID');
  return Object.fromEntries(entries);
}
export function validateBlobWrite(input: BlobWrite): void {
  assertBlobKey(input.key);
  assertBlobSize(input.size);
  assertBlobType(input.contentType);
  validateBlobMetadata(input.metadata);
  if (
    (input.key.startsWith('objects/') && !input.createOnly) ||
    (input.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(input.sha256))
  )
    throw new BlobStoreError('BLOB_INVALID');
}
export function validateBlobRange(range?: BlobRange): void {
  if (
    range &&
    (!Number.isSafeInteger(range.offset) ||
      range.offset < 0 ||
      !Number.isSafeInteger(range.length) ||
      range.length < 1 ||
      !Number.isSafeInteger(range.offset + range.length))
  )
    throw new BlobStoreError('BLOB_INVALID');
}
export function validateMultipartPolicy(
  input: BlobMultipartPolicy,
): Readonly<BlobMultipartPolicy> {
  const min = 5 * 1024 ** 2;
  if (
    Object.values(input).some((v) => !Number.isSafeInteger(v)) ||
    input.minPartBytes < min ||
    input.maxPartBytes < input.minPartBytes ||
    input.maxPartBytes > 5 * 1024 ** 3 ||
    input.thresholdBytes < input.minPartBytes ||
    input.thresholdBytes > 5 * 1024 ** 3 ||
    input.maxParts < 1 ||
    input.maxParts > 10000
  )
    throw new BlobStoreError('BLOB_INVALID');
  return Object.freeze({ ...input });
}
export function validateMultipart(upload: BlobMultipart): void {
  assertBlobKey(upload.key, true);
  if (
    upload.uploadId.length < 1 ||
    upload.uploadId.length > 2048 ||
    hasControl(upload.uploadId)
  )
    throw new BlobStoreError('BLOB_INVALID');
}
function hasControl(value: string): boolean {
  return Array.from(value).some(
    (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
  );
}
export function validatePartNumber(partNumber: number, maxParts = 10000): void {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > maxParts)
    throw new BlobStoreError('BLOB_INVALID');
}
export function validateMultipartParts(
  parts: readonly BlobPart[],
  policy: BlobMultipartPolicy,
): BlobPart[] {
  if (parts.length < 1 || parts.length > policy.maxParts)
    throw new BlobStoreError('BLOB_INVALID');
  const result = parts.map((p, i) => {
    if (
      p.partNumber !== i + 1 ||
      !p.etag ||
      p.etag.length > 256 ||
      hasControl(p.etag)
    )
      throw new BlobStoreError('BLOB_INVALID');
    return { ...p };
  });
  return result;
}
export function validateCapabilityExpiry(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 300)
    throw new BlobStoreError('BLOB_INVALID');
}
export function validateDownload(input: {
  key: string;
  contentType: string;
  contentDisposition: string;
  expiresInSeconds: number;
}): void {
  assertBlobKey(input.key);
  if (
    !input.key.startsWith('objects/') ||
    !/^attachment; filename="[a-zA-Z0-9._-]{1,128}"$/.test(
      input.contentDisposition,
    )
  )
    throw new BlobStoreError('BLOB_INVALID');
  assertBlobType(input.contentType);
  validateCapabilityExpiry(input.expiresInSeconds);
}
/** Pull-based, at most one producer chunk retained; cancels on oversize, short read or cancellation. */
export function exactBlobStream(
  body: ReadableStream<Uint8Array>,
  size: number,
): ReadableStream<Uint8Array> {
  assertBlobSize(size);
  const reader = body.getReader();
  let received = 0;
  let finished = false;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const next = await reader.read();
          if (next.done) {
            finished = true;
            reader.releaseLock();
            if (received !== size)
              throw new BlobStoreError('BLOB_SIZE_MISMATCH');
            controller.close();
          } else {
            if (
              !(next.value instanceof Uint8Array) ||
              next.value.byteLength > size - received
            )
              throw new BlobStoreError('BLOB_SIZE_MISMATCH');
            received += next.value.byteLength;
            // Hold the final chunk until EOF is proven. Otherwise a Content-Length
            // receiver could commit before a later surplus chunk is detected.
            if (received === size) {
              const end = await reader.read();
              if (!end.done) throw new BlobStoreError('BLOB_SIZE_MISMATCH');
              finished = true;
              reader.releaseLock();
              controller.enqueue(next.value);
              controller.close();
            } else controller.enqueue(next.value);
          }
        } catch (error) {
          if (!finished) {
            finished = true;
            await reader.cancel().catch(() => {});
            reader.releaseLock();
          }
          controller.error(
            error instanceof BlobStoreError
              ? error
              : new BlobStoreError('BLOB_UNAVAILABLE'),
          );
        }
      },
      async cancel() {
        if (!finished) {
          finished = true;
          try {
            await reader.cancel();
          } finally {
            reader.releaseLock();
          }
        }
      },
    },
    { highWaterMark: 0 },
  );
}
