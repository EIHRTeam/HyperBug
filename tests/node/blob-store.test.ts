import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createS3BlobStore, createNodeBlobDigest } from '@hyperbug/blob-s3';
import { proveBlobPromotion } from '../fixtures/blob-promotion-proof.ts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { startLocalS3 } from '../../tooling/local-s3.ts';
import { startSeaweedTestService } from '../../tooling/seaweed-test-service.ts';
import { proveMultipartReconciliation } from '../fixtures/multipart-reconciliation-proof.ts';
import { proveLegacyProviderRecovery } from '../fixtures/upload-legacy-provider-proof.ts';
import {
  blobTestPolicy,
  proveBlobStore,
  blobKey,
} from '../fixtures/blob-store-proof.ts';
const binary = process.env.HYPERBUG_TEST_SEAWEED;
describe.runIf(Boolean(binary))(
  'real isolated SeaweedFS 4.48 S3 service (not emulation)',
  () => {
    let service: Awaited<ReturnType<typeof startSeaweedTestService>>;
    let adapter: ReturnType<typeof createS3BlobStore>;
    beforeAll(async () => {
      service = await startSeaweedTestService(binary!);
      adapter = createS3BlobStore({ ...service, multipart: blobTestPolicy });
    }, 30000);
    afterAll(async () => {
      adapter?.close();
      await service?.close();
    });
    it('recovers an approved historical key with pagination, sibling preservation and late resweep on the real service', async () => {
      await proveLegacyProviderRecovery({
        ...service,
        multipartContinuation: 'seaweedfs-4.48',
      });
    }, 60000);
    it('passes the portable blob compatibility proof', async () => {
      const proof = await proveBlobStore(adapter.store);
      expect(proof).toMatchObject({
        largeSize: 32 * 1024 ** 2,
        producerChunks: 512,
      });
      console.log(JSON.stringify({ blobStore: service.version, proof }));
    }, 60000);
    it('discovers and reconciles unknown exact-key multipart sessions on the real service', async () => {
      await proveMultipartReconciliation(adapter.store, adapter.reconciliation);
    }, 30000);
    it('verifies immutable promotion and overwrite/crash races on the real service', async () => {
      const proof = await proveBlobPromotion(
        adapter.store,
        createNodeBlobDigest,
      );
      expect(proof.checks).toContain('staging-overwrite');
      expect(proof.checks).toContain('final-byte-sha256');
    }, 60000);
    it('signs PUT/GET/parts and rejects header, key and query tampering', async () => {
      const key = blobKey();
      const final = blobKey('objects');
      try {
        const capability = await adapter.authorization.upload({
          key,
          contentType: 'text/plain',
          expiresInSeconds: 60,
        });
        const signed = new URL(capability.url);
        expect(signed.searchParams.get('X-Amz-SignedHeaders')).toContain(
          'content-type',
        );
        expect(signed.searchParams.get('X-Amz-Expires')).toBe('60');
        expect(signed.searchParams.has('X-Amz-Security-Token')).toBe(false);
        const send = (url: string, type = 'text/plain') =>
          fetch(url, {
            method: 'PUT',
            headers: { 'content-type': type },
            body: 'portable',
          });
        expect((await send(capability.url)).status).toBe(200);
        expect((await send(capability.url, 'text/html')).status).toBe(403);
        const tampered = new URL(capability.url);
        tampered.pathname = tampered.pathname.replace(key, final);
        expect((await send(tampered.toString())).status).toBe(403);
        // A valid signed PUT can be reused until expiry; immutable promotion must account for this.
        expect((await send(capability.url)).status).toBe(200);
        const stage = await adapter.store.get(key);
        expect(stage).not.toBeNull();
        await adapter.store.put({
          key: final,
          body: stage!.body,
          size: stage!.size,
          contentType: 'text/plain',
          createOnly: true,
        });
        const download = await adapter.authorization.download({
          key: final,
          contentType: 'application/octet-stream',
          contentDisposition: 'attachment; filename="file.txt"',
          expiresInSeconds: 60,
        });
        const response = await fetch(download.url);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toBe(
          'attachment; filename="file.txt"',
        );
        expect(await response.text()).toBe('portable');
        const changed = new URL(download.url);
        changed.searchParams.set('response-content-type', 'text/html');
        expect((await fetch(changed)).status).toBe(403);
        const upload = await adapter.store.createMultipart({
          key,
          contentType: 'text/plain',
        });
        try {
          const part = await adapter.authorization.uploadPart({
            ...upload,
            partNumber: 1,
            expiresInSeconds: 60,
          });
          const uploaded = await fetch(part.url, {
            method: 'PUT',
            body: 'multipart',
          });
          expect(uploaded.status).toBe(200);
          const etag = uploaded.headers.get('etag');
          expect(etag).toBeTruthy();
          const complete = await adapter.store.completeMultipart(upload, [
            { partNumber: 1, etag: etag! },
          ]);
          expect(complete.size).toBe(9);
        } finally {
          await adapter.store.abortMultipart(upload);
        }
      } finally {
        await adapter.store.delete(key);
        await adapter.store.delete(final);
      }
    }, 30000);
    it('verifies that the real service rejects a mismatched SHA256 header independently of the adapter', async () => {
      const key = blobKey();
      const client = new S3Client({
        ...service,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
        maxAttempts: 1,
      });
      try {
        await expect(
          client.send(
            new PutObjectCommand({
              Bucket: service.bucket,
              Key: key,
              Body: new Uint8Array([1, 2, 3]),
              ChecksumSHA256: Buffer.alloc(32).toString('base64'),
            }),
          ),
        ).rejects.toMatchObject({ $metadata: { httpStatusCode: 400 } });
        expect(await adapter.store.head(key)).toBeNull();
      } finally {
        client.destroy();
        await adapter.store.delete(key);
      }
    });
  },
);
describe('Node S3 adapter against local R2 S3 emulation', () => {
  let service: Awaited<ReturnType<typeof startLocalS3>>;
  let adapter: ReturnType<typeof createS3BlobStore>;
  beforeAll(async () => {
    service = await startLocalS3();
    adapter = createS3BlobStore({
      ...service,
      allowLocalHttp: true,
      multipart: blobTestPolicy,
    });
  });
  it('verifies immutable promotion and overwrite/crash races in emulation', async () => {
    const proof = await proveBlobPromotion(adapter.store, createNodeBlobDigest);
    expect(proof.checks).toContain('staging-overwrite');
    expect(proof.checks).toContain('final-byte-sha256');
  });
  afterAll(async () => {
    adapter?.close();
    await service?.close();
  });
  it('passes the portable blob compatibility proof in emulation', async () => {
    const proof = await proveBlobStore(adapter.store);
    expect(proof.producerChunks).toBe(512);
  }, 60000);
});
