import {
  S3Client,
  GetBucketVersioningCommand,
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  UploadIntentError,
  canonicalUploadLegacyDecision,
  uploadLegacyDecisionJson,
  uploadLegacyRecoveryAccounting,
  multipartAbortable,
  type UploadLegacyRecoveryDecision,
  type UploadLegacyRecoveryProvider,
} from '@hyperbug/application';
import type { S3BlobConfig } from './index.ts';

/** Trusted operator input. Hashing a manifest is not evidence that its claims are true. */
export interface S3LegacyRecoveryApproval {
  decision: UploadLegacyRecoveryDecision;
  ownershipEvidence: Uint8Array;
  accountingEvidence: Uint8Array;
}
export type S3LegacyRecoveryConfig = Omit<S3BlobConfig, 'multipart'> & {
  /** Reviewed SeaweedFS 4.48 upload-ID ordering, explicitly bound into ownership evidence. */
  multipartContinuation?: 's3' | 'seaweedfs-4.48';
};
const unavailable = () => new UploadIntentError('UPLOAD_UNAVAILABLE');
const invalid = () => new UploadIntentError('UPLOAD_INVALID');
function manifest(bytes: Uint8Array, digest: string): unknown {
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < 1 ||
    bytes.byteLength > 16384 ||
    createHash('sha256').update(bytes).digest('hex') !== digest
  )
    throw invalid();
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw invalid();
  }
}
/** Compare closed JSON structures without depending on object property order. */
function equal(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  if (
    !value ||
    !expected ||
    typeof value !== 'object' ||
    typeof expected !== 'object'
  )
    return false;
  if (Array.isArray(value) || Array.isArray(expected)) return false;
  const left = Object.keys(value).sort(),
    right = Object.keys(expected).sort();
  return (
    left.join(',') === right.join(',') &&
    left.every((key) =>
      equal(
        (value as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
      ),
    )
  );
}
function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Buffer.byteLength(value) <= maximum &&
    !/[\p{Cc}\p{Cs}]/u.test(value)
  );
}

/** One approved historical snapshot; never an arbitrary-key BlobStore capability. */
export function createS3LegacyRecoveryProvider(
  config: S3LegacyRecoveryConfig,
  approval: S3LegacyRecoveryApproval,
): { provider: UploadLegacyRecoveryProvider; close(): void } {
  const decision = canonicalUploadLegacyDecision(approval.decision);
  const frozenDecision = uploadLegacyDecisionJson(decision);
  const key = decision.snapshot.objectKey;
  const continuationMode = config.multipartContinuation ?? 's3';
  const endpoint = new URL(config.endpoint);
  // R2's published compatibility contract excludes GetBucketVersioning. An observed
  // empty response is not a supported generic S3 no-history capability.
  const unsupportedVersioning = endpoint.hostname.endsWith(
    '.r2.cloudflarestorage.com',
  );
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    !['https:', 'http:'].includes(endpoint.protocol) ||
    (endpoint.protocol === 'http:' &&
      !(
        config.allowLocalHttp &&
        ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
      )) ||
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket) ||
    !config.region ||
    typeof config.forcePathStyle !== 'boolean' ||
    !['s3', 'seaweedfs-4.48'].includes(continuationMode) ||
    key.includes('\\') ||
    key
      .split('/')
      .some((segment) => !segment || segment === '.' || segment === '..')
  )
    throw invalid();
  if (
    !equal(
      manifest(approval.ownershipEvidence, decision.ownershipEvidenceSha256),
      {
        version: 's3-legacy-ownership-1',
        endpoint: config.endpoint,
        bucket: config.bucket,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        multipartContinuation: continuationMode,
        snapshot: decision.snapshot,
      },
    ) ||
    !equal(
      manifest(approval.accountingEvidence, decision.accountingEvidenceSha256),
      {
        version: 's3-legacy-accounting-1',
        snapshot: decision.snapshot,
        retained: uploadLegacyRecoveryAccounting(decision),
      },
    )
  )
    throw invalid();
  // Copy destination configuration; later caller mutation cannot retarget the approval.
  const fixed = {
    endpoint: config.endpoint,
    bucket: config.bucket,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: config.credentials,
  };
  let closed = false,
    busy = false;
  const clients = new Set<S3Client>();
  return {
    close() {
      closed = true;
      for (const client of clients) client.destroy();
    },
    provider: {
      async recover(input) {
        if (
          unsupportedVersioning ||
          closed ||
          busy ||
          Date.now() - decision.snapshot.expiresAt <
            decision.retainAfterExpiryMs ||
          uploadLegacyDecisionJson(input.decision) !== frozenDecision
        )
          throw unavailable();
        busy = true;
        const timeout = new AbortController();
        const signal = AbortSignal.any([input.signal, timeout.signal]);
        const timer = setTimeout(() => timeout.abort(), 30000);
        const client = new S3Client({
          ...fixed,
          maxAttempts: 1,
          followRegionRedirects: false,
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
        });
        clients.add(client);
        const check = () => {
          if (signal.aborted || closed) throw unavailable();
        };
        const cancel = () => client.destroy();
        signal.addEventListener('abort', cancel, { once: true });
        // The low-priority deserialize response runs before the SDK XML parser on unwind.
        // This client handles only small recovery responses, never an object GET stream.
        client.middlewareStack.add(
          (next, context) => async (args) => {
            const result = await next(args);
            const response = result.response as {
              headers: Record<string, string>;
              body: Readable;
            };
            const body = response.body;
            if (!(body instanceof Readable)) throw unavailable();
            const stop = () => body.destroy(unavailable());
            signal.addEventListener('abort', stop, { once: true });
            try {
              check();
              const length = response.headers['content-length'];
              if (
                (length !== undefined &&
                  (!/^\d+$/.test(length) || Number(length) > 131072)) ||
                (response.headers['content-encoding'] !== undefined &&
                  response.headers['content-encoding'] !== 'identity')
              )
                throw unavailable();
              const chunks: Buffer[] = [];
              let size = 0;
              for await (const chunk of body) {
                check();
                if (!(chunk instanceof Uint8Array)) throw unavailable();
                size += chunk.byteLength;
                if (size > 131072) throw unavailable();
                chunks.push(Buffer.from(chunk));
              }
              check();
              const bytes = Buffer.concat(chunks, size);
              const xml = new TextDecoder('utf-8', { fatal: true }).decode(
                bytes,
              );
              if (context.commandName === 'GetBucketVersioningCommand') {
                // The SDK ignores unknown XML fields; absent parsed Status alone is insufficient.
                // Accept only an explicitly empty never-versioned response, not an arbitrary root.
                if (
                  !/^\s*(?:<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?\s*\?>\s*)?<VersioningConfiguration(?:\s+xmlns=["']http:\/\/s3\.amazonaws\.com\/doc\/2006-03-01\/["'])?\s*(?:\/\s*>|>\s*<\/VersioningConfiguration\s*>)\s*$/.test(
                    xml,
                  )
                )
                  throw unavailable();
              }
              response.body = Readable.from([bytes]);
              return result;
            } catch {
              body.destroy();
              throw unavailable();
            } finally {
              signal.removeEventListener('abort', stop);
            }
          },
          {
            step: 'deserialize',
            priority: 'low',
            name: 'boundedLegacyRecoveryResponse',
          },
        );
        async function unversioned() {
          check();
          const result = await client.send(
            new GetBucketVersioningCommand({ Bucket: fixed.bucket }),
            { abortSignal: signal },
          );
          check();
          if (result.Status !== undefined || result.MFADelete !== undefined)
            throw unavailable();
        }
        async function discover(): Promise<string[]> {
          const exact = new Set<string>(),
            seen = new Set<string>(),
            markers = new Set<string>();
          let marker:
            | { KeyMarker?: string; UploadIdMarker: string }
            | undefined;
          for (let page = 0; page < 5; page++) {
            check();
            // eslint-disable-next-line no-await-in-loop -- Fixed sequential continuation under one deadline.
            const result = await client.send(
              new ListMultipartUploadsCommand({
                Bucket: fixed.bucket,
                Prefix: key,
                MaxUploads: 20,
                ...marker,
              }),
              { abortSignal: signal },
            );
            check();
            const rows = result.Uploads ?? [];
            if (
              typeof result.IsTruncated !== 'boolean' ||
              !Array.isArray(rows) ||
              rows.length > 20 ||
              (result.CommonPrefixes !== undefined &&
                (!Array.isArray(result.CommonPrefixes) ||
                  result.CommonPrefixes.length))
            )
              throw unavailable();
            for (const row of rows) {
              if (
                !validText(row.Key, 1024) ||
                !row.Key.startsWith(key) ||
                !validText(row.UploadId, 2048)
              )
                throw unavailable();
              const identity = JSON.stringify([row.Key, row.UploadId]);
              if (seen.has(identity)) throw unavailable();
              seen.add(identity);
              if (row.Key === key) exact.add(row.UploadId);
            }
            if (!result.IsTruncated) return [...exact];
            if (
              !rows.length ||
              !validText(result.NextUploadIdMarker, 2048) ||
              !rows.some((row) => row.UploadId === result.NextUploadIdMarker) ||
              (result.NextKeyMarker !== undefined &&
                (!validText(result.NextKeyMarker, 1024) ||
                  !rows.some(
                    (row) =>
                      row.Key === result.NextKeyMarker &&
                      row.UploadId === result.NextUploadIdMarker,
                  ))) ||
              (result.NextKeyMarker === undefined &&
                continuationMode !== 'seaweedfs-4.48' &&
                rows.some((row) => row.Key !== key))
            )
              throw unavailable();
            const continuation = JSON.stringify([
              result.NextKeyMarker,
              result.NextUploadIdMarker,
            ]);
            if (markers.has(continuation)) throw unavailable();
            markers.add(continuation);
            marker = {
              ...(result.NextKeyMarker === undefined
                ? {}
                : { KeyMarker: result.NextKeyMarker }),
              UploadIdMarker: result.NextUploadIdMarker,
            };
          }
          throw unavailable();
        }
        async function perform() {
          await unversioned();
          for (const uploadId of await discover()) {
            check();
            try {
              // eslint-disable-next-line no-await-in-loop -- Exact-key sequential abort; preserve siblings.
              await client.send(
                new AbortMultipartUploadCommand({
                  Bucket: fixed.bucket,
                  Key: key,
                  UploadId: uploadId,
                }),
                { abortSignal: signal },
              );
            } catch (error) {
              if (!(error instanceof Error && error.name === 'NoSuchUpload'))
                throw unavailable();
            }
          }
          check();
          await client.send(
            new DeleteObjectCommand({ Bucket: fixed.bucket, Key: key }),
            { abortSignal: signal },
          );
          check();
          try {
            await client.send(
              new HeadObjectCommand({ Bucket: fixed.bucket, Key: key }),
              { abortSignal: signal },
            );
            throw unavailable();
          } catch (error) {
            if (
              !(
                error instanceof Error &&
                error.name === 'NotFound' &&
                '$metadata' in error &&
                (error.$metadata as { httpStatusCode?: number })
                  .httpStatusCode === 404
              )
            )
              throw unavailable();
          }
          if ((await discover()).length) throw unavailable();
          await unversioned();
          check();
          return {
            decisionId: decision.decisionId,
            ownershipEvidenceSha256: decision.ownershipEvidenceSha256,
            key,
            remainingObjects: 0 as const,
            remainingUploads: 0 as const,
          };
        }
        try {
          return await multipartAbortable(signal, perform);
        } catch {
          throw unavailable();
        } finally {
          clearTimeout(timer);
          timeout.abort();
          client.destroy();
          clients.delete(client);
          busy = false;
        }
      },
    },
  };
}
