import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { createS3BlobStore, createNodeBlobDigest } from '@hyperbug/blob-s3';
import { createR2BlobAuthorization } from '@hyperbug/blob-r2';
import {
  blobTestPolicy,
  blobKey,
  proveBlobStore,
} from '../fixtures/blob-store-proof.ts';
import { proveBlobPromotion } from '../fixtures/blob-promotion-proof.ts';
import { proveBlobSigning } from '../fixtures/blob-signing-proof.ts';
import { proveMultipartReconciliation } from '../fixtures/multipart-reconciliation-proof.ts';
import { proveLegacyProviderRecovery } from '../fixtures/upload-legacy-provider-proof.ts';
import { proveR2LegacyRecovery } from '../fixtures/r2-legacy-provider-proof.ts';

// Opt in with an ignored mode-0600 JSON file; never pass secrets on the command line.
const path = process.env.HYPERBUG_TEST_R2_CONFIG;
describe.runIf(Boolean(path))(
  'actual R2 S3 service with scoped test credentials (local Node execution)',
  () => {
    let config: { accountId: string; bucket: string; credentialsFile: string };
    let credentials: { accessKeyId: string; secretAccessKey: string };
    let adapter: ReturnType<typeof createS3BlobStore>;
    beforeAll(() => {
      config = JSON.parse(readFileSync(path!, 'utf8'));
      credentials = JSON.parse(readFileSync(config.credentialsFile, 'utf8'));
      adapter = createS3BlobStore({
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        bucket: config.bucket,
        credentials,
        forcePathStyle: true,
        multipart: blobTestPolicy,
      });
    });
    afterAll(() => adapter?.close());
    it('recovers an approved historical record through the direct R2 policy with preserved prefix siblings and late resweep', async () => {
      const client = new S3Client({
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials,
        forcePathStyle: true,
        maxAttempts: 1,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      const address = (key: string) => ({ Bucket: config.bucket, Key: key });
      try {
        const proof = await proveR2LegacyRecovery(
          { ...config, credentials },
          {
            async put(key) {
              await client.send(
                new PutObjectCommand({ ...address(key), Body: 'old' }),
              );
            },
            async head(key) {
              try {
                await client.send(new HeadObjectCommand(address(key)));
                return true;
              } catch (error) {
                if (
                  (error as { $metadata?: { httpStatusCode?: number } })
                    .$metadata?.httpStatusCode === 404
                )
                  return false;
                // eslint-disable-next-line preserve-caught-error -- SDK response/cause can contain private signing details.
                throw new Error('Owned R2 observation failed');
              }
            },
            async create(key) {
              const result = await client.send(
                new CreateMultipartUploadCommand(address(key)),
              );
              if (!result.UploadId)
                throw new Error('Missing owned test session');
              return result.UploadId;
            },
            async writable(key, id) {
              try {
                await client.send(
                  new UploadPartCommand({
                    ...address(key),
                    UploadId: id,
                    PartNumber: 1,
                    Body: 'x',
                  }),
                );
                return true;
              } catch {
                return false;
              }
            },
            async abort(key, id) {
              try {
                await client.send(
                  new AbortMultipartUploadCommand({
                    ...address(key),
                    UploadId: id,
                  }),
                );
              } catch (error) {
                if (!(error instanceof Error && error.name === 'NoSuchUpload'))
                  // eslint-disable-next-line preserve-caught-error -- SDK response/cause can contain private signing details.
                  throw new Error('Owned R2 cleanup failed');
              }
            },
            async delete(key) {
              await client.send(new DeleteObjectCommand(address(key)));
            },
          },
        );
        expect(proof).toMatchObject({
          targetSessions: 21,
          siblingPreserved: true,
          lateReswept: true,
        });
      } finally {
        client.destroy();
      }
    }, 90000);
    it('retains historical objects and sessions when actual R2 cannot establish generic S3 versioning absence', async () => {
      await proveLegacyProviderRecovery(
        {
          endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
          region: 'auto',
          bucket: config.bucket,
          credentials,
          forcePathStyle: true,
        },
        true,
      );
    }, 60000);
    it('discovers and reconciles unknown exact-key multipart sessions on actual R2 S3', async () => {
      await proveMultipartReconciliation(adapter.store, adapter.reconciliation);
    }, 60000);
    it('passes CRUD, metadata, range, conditional, checksum, multipart and 32 MiB streaming proof', async () => {
      const proof = await proveBlobStore(adapter.store);
      expect(proof.largeSize).toBe(32 * 1024 ** 2);
      console.log(JSON.stringify({ environment: 'actual R2 S3', proof }));
    }, 180000);
    it('verifies final-byte SHA256 and promotion overwrite/crash races', async () => {
      const proof = await proveBlobPromotion(
        adapter.store,
        createNodeBlobDigest,
      );
      expect(proof.checks).toContain('staging-overwrite');
      console.log(
        JSON.stringify({ environment: 'actual R2 S3 promotion', proof }),
      );
    }, 120000);
    it('accepts Node presigned capabilities and rejects tampering', async () => {
      const proof = await proveBlobSigning(
        adapter.store,
        adapter.authorization,
      );
      expect(proof.checks).toContain('part-tamper');
    }, 90000);
    it('accepts aws4fetch R2 presigned capabilities and rejects tampering', async () => {
      const authorization = createR2BlobAuthorization({
        ...config,
        credentials,
      });
      const proof = await proveBlobSigning(adapter.store, authorization);
      expect(proof.checks).toContain('part-tamper');
    }, 90000);
    it('independently rejects a raw wrong SHA256 header', async () => {
      const key = blobKey();
      const client = new S3Client({
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        region: 'auto',
        credentials,
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        maxAttempts: 1,
      });
      try {
        let status: number | undefined;
        try {
          await client.send(
            new PutObjectCommand({
              Bucket: config.bucket,
              Key: key,
              Body: new Uint8Array([1, 2, 3]),
              ChecksumSHA256: Buffer.alloc(32).toString('base64'),
            }),
          );
        } catch (error) {
          status = (error as { $metadata?: { httpStatusCode?: number } })
            .$metadata?.httpStatusCode;
        }
        // Assert only the status; SDK objects can contain signed URLs/headers.
        expect(status).toBe(400);
        expect(await adapter.store.head(key)).toBeNull();
      } finally {
        client.destroy();
        await adapter.store.delete(key);
      }
    }, 30000);
  },
);
