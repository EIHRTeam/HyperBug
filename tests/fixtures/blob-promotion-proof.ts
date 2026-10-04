import {
  BlobStoreError,
  promoteStagingBlob,
  type BlobStore,
  type BlobDigest,
} from '@hyperbug/application';
import { blobKey, blobTestStream } from './blob-store-proof.ts';
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
async function invalid(operation: () => Promise<unknown>) {
  try {
    await operation();
  } catch (error) {
    assert(
      error instanceof BlobStoreError && error.code === 'BLOB_CONTENT_INVALID',
      'Unexpected validation failure',
    );
    return;
  }
  throw new Error('Invalid content accepted');
}
export async function proveBlobPromotion(
  store: BlobStore,
  createDigest: () => BlobDigest,
) {
  const keys = Array.from({ length: 8 }, (_, i) =>
    blobKey(i % 2 === 0 ? 'staging' : 'objects'),
  );
  const base = {
    intentId: crypto.randomUUID(),
    stagingKey: keys[0]!,
    finalKey: keys[1]!,
    maxBytes: 1024,
    contentType: 'application/octet-stream',
    filename: 'fixture.bin',
  };
  const payload = new Uint8Array(257);
  for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', payload)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  try {
    await store.put({
      key: base.stagingKey,
      body: blobTestStream(257),
      size: 257,
      contentType: base.contentType,
      createOnly: false,
    });
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        promoteStagingBlob(store, createDigest, base),
      ),
    );
    assert(
      results.every(
        (r) =>
          r.key === base.finalKey &&
          r.sha256 === sha256 &&
          r.size === 257 &&
          r.scanStatus === 'unscanned',
      ),
      'Promotion race did not verify one immutable object',
    );
    await store.put({
      key: base.stagingKey,
      body: blobTestStream(1025, 1),
      size: 1025,
      contentType: base.contentType,
      createOnly: false,
    });
    const resume = await promoteStagingBlob(store, createDigest, base);
    assert(
      resume.sha256 === sha256 && resume.size === 257,
      'Staging overwrite changed final bytes',
    );
    await store.delete(base.stagingKey);
    const withoutStage = await promoteStagingBlob(store, createDigest, base);
    assert(
      withoutStage.sha256 === sha256,
      'Crash resume relied on removed staging object',
    );
    const prototypeExtension = await promoteStagingBlob(store, createDigest, {
      ...base,
      filename: 'fixture.constructor',
    });
    assert(
      prototypeExtension.sha256 === sha256,
      'Unknown prototype-name extension rejected',
    );
    await invalid(() =>
      promoteStagingBlob(store, createDigest, {
        ...base,
        intentId: crypto.randomUUID(),
      }),
    );
    assert(
      (await store.head(base.finalKey))?.size === 257,
      'Rejected verification deleted another intent object',
    );
    const png = {
      ...base,
      intentId: crypto.randomUUID(),
      stagingKey: keys[2]!,
      finalKey: keys[3]!,
      contentType: 'image/png',
      filename: 'fixture.png',
    };
    await store.put({
      key: png.stagingKey,
      body: blobTestStream(257),
      size: 257,
      contentType: png.contentType,
      createOnly: false,
    });
    await invalid(() => promoteStagingBlob(store, createDigest, png));
    const valid = {
      ...base,
      intentId: crypto.randomUUID(),
      stagingKey: keys[4]!,
      finalKey: keys[5]!,
      contentType: 'image/png',
      filename: 'fixture.png',
    };
    const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    await store.put({
      key: valid.stagingKey,
      body: new ReadableStream({
        start(c) {
          c.enqueue(image);
          c.close();
        },
      }),
      size: image.length,
      contentType: valid.contentType,
      createOnly: false,
    });
    const inspected = await promoteStagingBlob(store, createDigest, valid);
    assert(
      inspected.size === image.length && inspected.scanStatus === 'unscanned',
      'Known magic rejected',
    );
    await invalid(() =>
      promoteStagingBlob(store, createDigest, {
        ...valid,
        filename: 'mismatch.jpg',
      }),
    );
    await invalid(() =>
      promoteStagingBlob(store, createDigest, { ...base, maxBytes: 256 }),
    );
    return {
      checks: [
        '8-way-promotion',
        'final-byte-sha256',
        'staging-overwrite',
        'crash-resume-without-staging',
        'intent-binding',
        'misleading-mime',
        'extension',
        'size',
        'explicit-unscanned',
      ],
      sha256,
    };
  } finally {
    await Promise.all(keys.map((key) => store.delete(key)));
  }
}
