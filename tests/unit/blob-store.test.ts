import { expect, it } from 'vitest';
import {
  BlobStoreError,
  exactBlobStream,
  validateMultipartPolicy,
  validateBlobWrite,
  validateMultipartParts,
  validateDownload,
} from '@hyperbug/application';
import { createR2BlobAuthorization } from '@hyperbug/blob-r2';
import { createS3BlobStore } from '@hyperbug/blob-s3';
import {
  blobKey,
  blobTestPolicy,
  blobTestStream,
} from '../fixtures/blob-store-proof.ts';
it('holds the final chunk until EOF and cancels oversized streams before committing declared bytes', async () => {
  let canceled = false;
  let pulls = 0;
  const source = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(pulls === 1 ? 5 : 1));
      },
      cancel() {
        canceled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const stream = exactBlobStream(source, 5);
  const reader = stream.getReader();
  await expect(reader.read()).rejects.toMatchObject({
    code: 'BLOB_SIZE_MISMATCH',
  });
  expect(canceled).toBe(true);
  expect(pulls).toBe(2);
  reader.releaseLock();
});
it('cancels upstream on consumer cancellation without reading ahead', async () => {
  let canceled = false;
  let pulled = 0;
  const stream = exactBlobStream(
    new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled++;
          controller.enqueue(new Uint8Array(4));
        },
        cancel() {
          canceled = true;
        },
      },
      { highWaterMark: 0 },
    ),
    8,
  );
  const reader = stream.getReader();
  expect(pulled).toBe(0);
  await reader.read();
  expect(pulled).toBe(1);
  await reader.cancel();
  expect(canceled).toBe(true);
  reader.releaseLock();
});
it('bounds metadata, ranges, multipart catalogs and final-key mutation', () => {
  const input = {
    key: blobKey('objects'),
    body: blobTestStream(0),
    size: 0,
    contentType: 'text/plain',
    createOnly: true,
  };
  expect(() => validateBlobWrite(input)).not.toThrow();
  for (const bad of [
    { createOnly: false },
    { contentType: 'text/html\r\nx: y' },
    { key: 'staging/a/../../file.txt' },
    { size: -1 },
    { sha256: 'bad' },
    { metadata: { 'bad\nkey': 'value' } },
    { metadata: { good: '\r\n' } },
  ])
    expect(() => validateBlobWrite({ ...input, ...bad })).toThrow(
      BlobStoreError,
    );
  expect(() =>
    validateMultipartPolicy({ ...blobTestPolicy, maxParts: 10001 }),
  ).toThrow(BlobStoreError);
  expect(() =>
    validateMultipartParts(
      [
        { partNumber: 1, etag: 'one' },
        { partNumber: 1, etag: 'duplicate' },
      ],
      blobTestPolicy,
    ),
  ).toThrow(BlobStoreError);
  expect(() =>
    validateDownload({
      key: blobKey(),
      contentType: 'text/plain',
      contentDisposition: 'attachment; filename="file.txt"',
      expiresInSeconds: 60,
    }),
  ).toThrow(BlobStoreError);
});
it('keeps both signers on staging uploads, short expiry and forced final-object downloads', async () => {
  const r2 = createR2BlobAuthorization({
    accountId: 'a'.repeat(32),
    bucket: 'hyperbug-test',
    credentials: {
      accessKeyId: 'fixture-access',
      secretAccessKey: 'fixture-secret',
    },
  });
  const s3 = createS3BlobStore({
    endpoint: 'https://storage.example.invalid',
    bucket: 'hyperbug-test',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'fixture-access',
      secretAccessKey: 'fixture-secret',
    },
    multipart: blobTestPolicy,
  });
  try {
    for (const signer of [r2, s3.authorization]) {
      const key = blobKey();
      const capability = await signer.upload({
        key,
        contentType: 'text/plain',
        expiresInSeconds: 60,
      });
      const url = new URL(capability.url);
      expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe(
        'content-type;host',
      );
      expect(url.pathname.endsWith(key)).toBe(true);
      expect(capability.headers).toEqual({ 'content-type': 'text/plain' });
      expect(capability.url.includes('fixture-secret')).toBe(false);
      expect(() =>
        signer.upload({
          key: blobKey('objects'),
          contentType: 'text/plain',
          expiresInSeconds: 60,
        }),
      ).toThrow(BlobStoreError);
      expect(() =>
        signer.upload({
          key,
          contentType: 'text/plain',
          expiresInSeconds: 301,
        }),
      ).toThrow(BlobStoreError);
      expect(() =>
        signer.download({
          key: blobKey('objects'),
          contentType: 'text/html',
          contentDisposition: 'inline',
          expiresInSeconds: 60,
        }),
      ).toThrow(BlobStoreError);
    }
  } finally {
    s3.close();
  }
});
it('rejects plaintext non-loopback endpoints and credential-bearing endpoint URLs', () => {
  for (const endpoint of [
    'http://storage.example.invalid',
    'https://user:secret@storage.example.invalid',
    'https://storage.example.invalid?credential=bad',
  ])
    expect(() =>
      createS3BlobStore({
        endpoint,
        bucket: 'hyperbug-test',
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'fixture-access',
          secretAccessKey: 'fixture-secret',
        },
        forcePathStyle: true,
        multipart: blobTestPolicy,
        allowLocalHttp: true,
      }),
    ).toThrow(BlobStoreError);
});
