import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createS3MultipartReconciler } from './multipart-reconciliation.ts';
import { Readable } from 'node:stream';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  BlobStoreError,
  assertBlobKey,
  assertBlobSize,
  assertBlobType,
  exactBlobStream,
  validateBlobWrite,
  validateBlobRange,
  validateBlobMetadata,
  validateMultipartPolicy,
  validateMultipart,
  validatePartNumber,
  validateMultipartParts,
  validateCapabilityExpiry,
  validateDownload,
  type BlobStore,
  type BlobInfo,
  type BlobMultipartPolicy,
  type BlobAuthorization,
  type BlobDigest,
  type UploadMultipartReconciler,
} from '@hyperbug/application';

export function createNodeBlobDigest(): BlobDigest {
  const digest = createHash('sha256');
  let finished = false;
  return {
    async write(chunk) {
      if (finished) throw new BlobStoreError('BLOB_UNAVAILABLE');
      digest.update(chunk);
    },
    async finish() {
      if (finished) throw new BlobStoreError('BLOB_UNAVAILABLE');
      finished = true;
      return digest.digest('hex');
    },
    async abort() {
      if (!finished) {
        finished = true;
        digest.destroy();
      }
    },
  };
}

export interface S3BlobConfig {
  endpoint: string;
  bucket: string;
  region: string;
  forcePathStyle: boolean;
  credentials: NonNullable<S3ClientConfig['credentials']>;
  multipart: BlobMultipartPolicy;
  /** Explicit loopback-only allowance for isolated local tests/development. */
  allowLocalHttp?: boolean;
}
function status(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('$metadata' in error))
    return undefined;
  const metadata = error.$metadata;
  return typeof metadata === 'object' &&
    metadata !== null &&
    'httpStatusCode' in metadata &&
    typeof metadata.httpStatusCode === 'number'
    ? metadata.httpStatusCode
    : undefined;
}
function mapped(error: unknown): BlobStoreError {
  if (error instanceof BlobStoreError) return error;
  const code = status(error);
  return new BlobStoreError(
    code === 412 || code === 409
      ? 'BLOB_PRECONDITION'
      : code === 404
        ? 'BLOB_NOT_FOUND'
        : 'BLOB_UNAVAILABLE',
  );
}
export function createS3BlobStore(config: S3BlobConfig): {
  store: BlobStore;
  authorization: BlobAuthorization;
  reconciliation: UploadMultipartReconciler;
  close(): void;
} {
  const endpoint = new URL(config.endpoint);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !['https:', 'http:'].includes(endpoint.protocol) ||
    (endpoint.protocol === 'http:' &&
      !(
        config.allowLocalHttp &&
        ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
      )) ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket) ||
    !config.region
  )
    throw new BlobStoreError('BLOB_INVALID');
  const multipart = validateMultipartPolicy(config.multipart);
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
    // Avoid implicit aws-chunked CRC32 trailers unsupported by some providers.
    // Explicit SHA256 PUT checksums remain opt-in and are verified in the compatibility suite.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 1,
  });
  const address = (key: string) => ({ Bucket: config.bucket, Key: key });
  const objectInfo = (
    key: string,
    object: {
      ContentLength?: number | undefined;
      ETag?: string | undefined;
      VersionId?: string | undefined;
      ContentType?: string | undefined;
      Metadata?: Record<string, string> | undefined;
    },
  ): BlobInfo => {
    if (
      !Number.isSafeInteger(object.ContentLength) ||
      object.ContentLength! < 0 ||
      !object.ETag
    )
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    return {
      key,
      size: object.ContentLength!,
      etag: object.ETag.replace(/^"|"$/g, ''),
      version: object.VersionId ?? null,
      contentType: object.ContentType ?? 'application/octet-stream',
      metadata: { ...object.Metadata },
    };
  };
  async function safe<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw mapped(error);
    }
  }
  function checksumStream(
    stream: ReadableStream<Uint8Array>,
    expected: string,
  ): ReadableStream<Uint8Array> {
    const reader = stream.getReader();
    const hash = createHash('sha256');
    let finished = false;
    return new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          try {
            const next = await reader.read();
            if (next.done) {
              finished = true;
              reader.releaseLock();
              if (!timingSafeEqual(hash.digest(), Buffer.from(expected, 'hex')))
                throw new BlobStoreError('BLOB_CHECKSUM_MISMATCH');
              controller.close();
            } else {
              hash.update(next.value);
              controller.enqueue(next.value);
            }
          } catch (error) {
            if (!finished) {
              finished = true;
              await reader.cancel().catch(() => {});
              reader.releaseLock();
            }
            controller.error(error);
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
  async function sendStream<T>(
    stream: ReadableStream<Uint8Array>,
    size: number,
    operation: (body: Readable, signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const body = Readable.from(exactBlobStream(stream, size), {
      objectMode: false,
    });
    const controller = new AbortController();
    let sourceError: unknown;
    // A streaming source can fail before the SDK attaches its own listeners.
    // Abort the HTTP request as well, including a short body with Content-Length.
    body.on('error', (error: unknown) => {
      sourceError = error;
      controller.abort();
    });
    try {
      return await operation(body, controller.signal);
    } catch (error) {
      throw mapped(sourceError ?? error);
    } finally {
      body.destroy();
    }
  }
  const store: BlobStore = {
    multipart,
    async put(input) {
      validateBlobWrite(input);
      return sendStream(
        input.sha256 ? checksumStream(input.body, input.sha256) : input.body,
        input.size,
        async (body, signal) => {
          const output = await client.send(
            new PutObjectCommand({
              ...address(input.key),
              Body: body,
              ContentLength: input.size,
              ContentType: input.contentType,
              Metadata: validateBlobMetadata(input.metadata),
              ...(input.createOnly ? { IfNoneMatch: '*' } : {}),
              ...(input.sha256
                ? {
                    ChecksumSHA256: Buffer.from(input.sha256, 'hex').toString(
                      'base64',
                    ),
                  }
                : {}),
            }),
            { abortSignal: signal },
          );
          return objectInfo(input.key, {
            ...output,
            ContentLength: input.size,
            ContentType: input.contentType,
            Metadata: input.metadata,
          });
        },
      );
    },
    async get(key, range) {
      assertBlobKey(key);
      validateBlobRange(range);
      try {
        const output = await client.send(
          new GetObjectCommand({
            ...address(key),
            ...(range
              ? {
                  Range: `bytes=${range.offset}-${range.offset + range.length - 1}`,
                }
              : {}),
          }),
        );
        if (!output.Body) throw new BlobStoreError('BLOB_UNAVAILABLE');
        // GET describes the snapshot actually read. Never pair a later HEAD with this body.
        const object = objectInfo(key, output);
        const bodySize = object.size;
        if (range) {
          const match = /^bytes \d+-\d+\/(\d+)$/.exec(
            output.ContentRange ?? '',
          );
          if (!match || !Number.isSafeInteger(Number(match[1])))
            throw new BlobStoreError('BLOB_UNAVAILABLE');
          object.size = Number(match[1]);
        }
        return {
          ...object,
          bodySize,
          body: exactBlobStream(output.Body.transformToWebStream(), bodySize),
        };
      } catch (error) {
        if (status(error) === 404) return null;
        throw mapped(error);
      }
    },
    async head(key) {
      assertBlobKey(key);
      try {
        return objectInfo(
          key,
          await client.send(new HeadObjectCommand(address(key))),
        );
      } catch (error) {
        if (status(error) === 404) return null;
        throw mapped(error);
      }
    },
    async delete(key) {
      assertBlobKey(key);
      await safe(() => client.send(new DeleteObjectCommand(address(key))));
    },
    async createMultipart(input) {
      assertBlobKey(input.key, true);
      assertBlobType(input.contentType);
      const metadata = validateBlobMetadata(input.metadata);
      return safe(async () => {
        const output = await client.send(
          new CreateMultipartUploadCommand({
            ...address(input.key),
            ContentType: input.contentType,
            Metadata: metadata,
          }),
        );
        if (!output.UploadId) throw new BlobStoreError('BLOB_UNAVAILABLE');
        return { key: input.key, uploadId: output.UploadId };
      });
    },
    async uploadPart(upload, partNumber, stream, size) {
      validateMultipart(upload);
      validatePartNumber(partNumber, multipart.maxParts);
      assertBlobSize(size);
      if (size < 1 || size > multipart.maxPartBytes)
        throw new BlobStoreError('BLOB_INVALID');
      return sendStream(stream, size, async (body, signal) => {
        const output = await client.send(
          new UploadPartCommand({
            ...address(upload.key),
            UploadId: upload.uploadId,
            PartNumber: partNumber,
            Body: body,
            ContentLength: size,
          }),
          { abortSignal: signal },
        );
        if (!output.ETag) throw new BlobStoreError('BLOB_UNAVAILABLE');
        return { partNumber, etag: output.ETag };
      });
    },
    async completeMultipart(upload, parts) {
      validateMultipart(upload);
      const ordered = validateMultipartParts(parts, multipart);
      return safe(async () => {
        const output = await client.send(
          new CompleteMultipartUploadCommand({
            ...address(upload.key),
            UploadId: upload.uploadId,
            MultipartUpload: {
              Parts: ordered.map((p) => ({
                PartNumber: p.partNumber,
                ETag: p.etag,
              })),
            },
          }),
        );
        const object = await store.head(upload.key);
        if (
          !object ||
          !output.ETag ||
          object.etag !== output.ETag.replace(/^"|"$/g, '')
        )
          throw new BlobStoreError('BLOB_UNAVAILABLE');
        return object;
      });
    },
    async abortMultipart(upload) {
      validateMultipart(upload);
      try {
        await client.send(
          new AbortMultipartUploadCommand({
            ...address(upload.key),
            UploadId: upload.uploadId,
          }),
        );
      } catch (error) {
        if (status(error) !== 404) throw mapped(error);
      }
    },
  };
  async function sign(
    command: PutObjectCommand | GetObjectCommand | UploadPartCommand,
    method: 'PUT' | 'GET',
    seconds: number,
    headers: Record<string, string>,
  ) {
    const issuedAt = Math.floor(Date.now() / 1000) * 1000;
    try {
      const options = {
        expiresIn: seconds,
        signableHeaders: new Set(Object.keys(headers)),
        signingDate: new Date(issuedAt),
      };
      const url =
        command instanceof GetObjectCommand
          ? await getSignedUrl(client, command, options)
          : command instanceof PutObjectCommand
            ? await getSignedUrl(client, command, options)
            : await getSignedUrl(client, command, options);
      return { method, url, headers, expiresAt: issuedAt + seconds * 1000 };
    } catch {
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    }
  }
  const authorization: BlobAuthorization = {
    upload(input) {
      assertBlobKey(input.key, true);
      assertBlobType(input.contentType);
      validateCapabilityExpiry(input.expiresInSeconds);
      return sign(
        new PutObjectCommand({
          ...address(input.key),
          ContentType: input.contentType,
        }),
        'PUT',
        input.expiresInSeconds,
        { 'content-type': input.contentType },
      );
    },
    uploadPart(input) {
      validateMultipart(input);
      validatePartNumber(input.partNumber, multipart.maxParts);
      validateCapabilityExpiry(input.expiresInSeconds);
      return sign(
        new UploadPartCommand({
          ...address(input.key),
          UploadId: input.uploadId,
          PartNumber: input.partNumber,
        }),
        'PUT',
        input.expiresInSeconds,
        {},
      );
    },
    download(input) {
      validateDownload(input);
      return sign(
        new GetObjectCommand({
          ...address(input.key),
          ResponseContentType: input.contentType,
          ResponseContentDisposition: input.contentDisposition,
        }),
        'GET',
        input.expiresInSeconds,
        {},
      );
    },
  };
  return {
    store,
    authorization,
    reconciliation: createS3MultipartReconciler(client, config.bucket),
    close: () => client.destroy(),
  };
}
export { createS3MultipartReconciler } from './multipart-reconciliation.ts';
export {
  createS3LegacyRecoveryProvider,
  type S3LegacyRecoveryApproval,
  type S3LegacyRecoveryConfig,
} from './legacy-recovery.ts';
