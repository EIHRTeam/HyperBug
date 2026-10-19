import type {
  R2Bucket,
  R2Object,
  FixedLengthStream as PlatformFixedLengthStream,
  Crypto as PlatformCrypto,
} from '@cloudflare/workers-types';
import { AwsClient } from 'aws4fetch';
export { createR2MultipartReconciler } from './multipart-reconciliation.ts';
export {
  createR2LegacyRecoveryProvider,
  type R2LegacyRecoveryApproval,
} from './legacy-recovery.ts';
import {
  BlobStoreError,
  assertBlobKey,
  assertBlobSize,
  assertBlobType,
  validateBlobWrite,
  validateBlobRange,
  validateBlobMetadata,
  validateMultipartPolicy,
  validateMultipart,
  validatePartNumber,
  validateMultipartParts,
  validateCapabilityExpiry,
  validateDownload,
  exactBlobStream,
  type BlobStore,
  type BlobInfo,
  type BlobMultipartPolicy,
  type BlobAuthorization,
  type BlobDigest,
} from '@hyperbug/application';

// Runtime constructor, validated against the published Workers declarations.
declare const FixedLengthStream: typeof PlatformFixedLengthStream;
declare const crypto: PlatformCrypto;

export function createR2BlobDigest(): BlobDigest {
  const digest = new crypto.DigestStream('SHA-256');
  // Attach a rejection handler immediately; aborted invalid streams never leak a promise rejection.
  const result = digest.digest.then(
    (bytes) =>
      Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    () => null,
  );
  const writer = digest.getWriter();
  let finished = false;
  return {
    async write(chunk) {
      if (finished) throw new BlobStoreError('BLOB_UNAVAILABLE');
      await writer.write(chunk);
    },
    async finish() {
      if (finished) throw new BlobStoreError('BLOB_UNAVAILABLE');
      finished = true;
      try {
        await writer.close();
        const hex = await result;
        if (!hex) throw new BlobStoreError('BLOB_UNAVAILABLE');
        return hex;
      } finally {
        writer.releaseLock();
      }
    },
    async abort() {
      if (!finished) {
        finished = true;
        try {
          await writer.abort();
        } finally {
          writer.releaseLock();
        }
      }
    },
  };
}

function info(object: R2Object): BlobInfo {
  return {
    key: object.key,
    size: object.size,
    etag: object.etag,
    version: object.version,
    contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
    metadata: { ...object.customMetadata },
  };
}
/** Native binding CRUD/multipart. Separate S3 credentials authorize only direct capabilities. */
export function createR2BlobStore(
  bucket: R2Bucket,
  policy: BlobMultipartPolicy,
): BlobStore {
  const multipart = validateMultipartPolicy(policy);
  // FixedLengthStream prevents unknown-length streams from reaching R2 and enforces byte count.
  async function withBody<T>(
    body: ReadableStream<Uint8Array>,
    size: number,
    operation: (stream: PlatformFixedLengthStream['readable']) => Promise<T>,
  ): Promise<T> {
    const bounded = exactBlobStream(body, size);
    const fixed = new FixedLengthStream(size);
    const reader = bounded.getReader();
    const writer = fixed.writable.getWriter();
    const pump = (async () => {
      try {
        for (;;) {
          // Sequential pull/write preserves storage backpressure and bounded memory.
          // oxlint-disable-next-line no-await-in-loop
          const next = await reader.read();
          if (next.done) break;
          // oxlint-disable-next-line no-await-in-loop
          await writer.write(next.value);
        }
        await writer.close();
      } catch (error) {
        await writer.abort(error).catch(() => {});
        throw error;
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
        writer.releaseLock();
      }
    })();
    const storing = Promise.resolve()
      .then(() => operation(fixed.readable))
      .catch(async (error: unknown) => {
        await reader.cancel().catch(() => {});
        // Unblock a writer if R2 rejected without consuming the request body.
        await writer.abort(error).catch(() => {});
        throw error;
      });
    const results = await Promise.allSettled([storing, pump]);
    const result = results[0];
    const pumped = results[1];
    if (result.status === 'rejected') throw result.reason;
    if (pumped.status === 'rejected') throw pumped.reason;
    return result.value;
  }
  async function safe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw error instanceof BlobStoreError
        ? error
        : new BlobStoreError('BLOB_UNAVAILABLE');
    }
  }
  return {
    multipart,
    async put(input) {
      validateBlobWrite(input);
      return safe(() =>
        withBody(input.body, input.size, async (body) => {
          const object = await bucket.put(input.key, body, {
            httpMetadata: { contentType: input.contentType },
            customMetadata: validateBlobMetadata(input.metadata),
            ...(input.createOnly ? { onlyIf: { etagDoesNotMatch: '*' } } : {}),
            ...(input.sha256 ? { sha256: input.sha256 } : {}),
          });
          if (!object) throw new BlobStoreError('BLOB_PRECONDITION');
          return info(object);
        }),
      );
    },
    async get(key, range) {
      assertBlobKey(key);
      validateBlobRange(range);
      return safe(async () => {
        const object = await bucket.get(key, range ? { range } : {});
        if (!object) return null;
        const reader = object.body.getReader();
        const body = new ReadableStream<Uint8Array>(
          {
            async pull(controller) {
              try {
                const next = await reader.read();
                if (next.done) {
                  reader.releaseLock();
                  controller.close();
                } else controller.enqueue(next.value);
              } catch {
                controller.error(new BlobStoreError('BLOB_UNAVAILABLE'));
              }
            },
            async cancel() {
              try {
                await reader.cancel();
              } finally {
                reader.releaseLock();
              }
            },
          },
          { highWaterMark: 0 },
        );
        const bodySize = range
          ? Math.min(range.length, Math.max(0, object.size - range.offset))
          : object.size;
        return {
          ...info(object),
          bodySize,
          body: exactBlobStream(body, bodySize),
        };
      });
    },
    async head(key) {
      assertBlobKey(key);
      return safe(async () => {
        const object = await bucket.head(key);
        return object ? info(object) : null;
      });
    },
    async delete(key) {
      assertBlobKey(key);
      await safe(() => bucket.delete(key));
    },
    async createMultipart(input) {
      assertBlobKey(input.key, true);
      assertBlobType(input.contentType);
      const metadata = validateBlobMetadata(input.metadata);
      return safe(async () => {
        const upload = await bucket.createMultipartUpload(input.key, {
          httpMetadata: { contentType: input.contentType },
          customMetadata: metadata,
        });
        return { key: upload.key, uploadId: upload.uploadId };
      });
    },
    async uploadPart(upload, partNumber, body, size) {
      validateMultipart(upload);
      validatePartNumber(partNumber, multipart.maxParts);
      assertBlobSize(size);
      if (size < 1 || size > multipart.maxPartBytes)
        throw new BlobStoreError('BLOB_INVALID');
      return safe(() =>
        withBody(body, size, (stream) =>
          bucket
            .resumeMultipartUpload(upload.key, upload.uploadId)
            .uploadPart(partNumber, stream),
        ),
      );
    },
    async completeMultipart(upload, parts) {
      validateMultipart(upload);
      const ordered = validateMultipartParts(parts, multipart);
      return safe(async () => {
        const completed = await bucket
          .resumeMultipartUpload(upload.key, upload.uploadId)
          // S3 UploadPart responses quote ETags; the native binding expects the bare value.
          .complete(
            ordered.map((part) => ({
              ...part,
              etag: part.etag.replace(/^"|"$/g, ''),
            })),
          );
        // Actual R2 completion may omit metadata that the local emulator returns.
        // Hydrate the completed staging object; this is never release evidence.
        const object = await bucket.head(upload.key);
        if (!object || object.etag !== completed.etag)
          throw new BlobStoreError('BLOB_PRECONDITION');
        return info(object);
      });
    },
    async abortMultipart(upload) {
      validateMultipart(upload);
      await safe(() =>
        bucket.resumeMultipartUpload(upload.key, upload.uploadId).abort(),
      );
    },
  };
}

export interface R2SigningConfig {
  accountId: string;
  bucket: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
}
export function createR2BlobAuthorization(
  config: R2SigningConfig,
): BlobAuthorization {
  if (
    !/^[0-9a-f]{32}$/.test(config.accountId) ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket) ||
    !config.credentials.accessKeyId ||
    !config.credentials.secretAccessKey
  )
    throw new BlobStoreError('BLOB_INVALID');
  const signer = new AwsClient({
    ...config.credentials,
    service: 's3',
    region: 'auto',
  });
  async function sign(
    key: string,
    method: 'PUT' | 'GET',
    seconds: number,
    headers: Record<string, string>,
    query: Record<string, string> = {},
  ) {
    const url = new URL(
      `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`,
    );
    url.searchParams.set('X-Amz-Expires', String(seconds));
    for (const [name, value] of Object.entries(query))
      url.searchParams.set(name, value);
    const issuedAt = Math.floor(Date.now() / 1000) * 1000;
    try {
      const request = await signer.sign(url.toString(), {
        method,
        headers,
        aws: {
          signQuery: true,
          allHeaders: true,
          datetime: new Date(issuedAt)
            .toISOString()
            .replace(/[:-]|\.\d{3}/g, ''),
        },
      });
      return {
        method,
        url: request.url,
        headers,
        expiresAt: issuedAt + seconds * 1000,
      };
    } catch {
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    }
  }
  return {
    upload(input) {
      assertBlobKey(input.key, true);
      assertBlobType(input.contentType);
      validateCapabilityExpiry(input.expiresInSeconds);
      return sign(input.key, 'PUT', input.expiresInSeconds, {
        'content-type': input.contentType,
      });
    },
    uploadPart(input) {
      validateMultipart(input);
      validatePartNumber(input.partNumber);
      validateCapabilityExpiry(input.expiresInSeconds);
      return sign(
        input.key,
        'PUT',
        input.expiresInSeconds,
        {},
        { uploadId: input.uploadId, partNumber: String(input.partNumber) },
      );
    },
    download(input) {
      validateDownload(input);
      return sign(
        input.key,
        'GET',
        input.expiresInSeconds,
        {},
        {
          'response-content-type': input.contentType,
          'response-content-disposition': input.contentDisposition,
        },
      );
    },
  };
}
