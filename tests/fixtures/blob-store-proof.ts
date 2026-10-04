import {
  BlobStoreError,
  type BlobStore,
  type BlobMultipart,
} from '@hyperbug/application';
export const blobTestPolicy = {
  thresholdBytes: 8 * 1024 ** 2,
  minPartBytes: 5 * 1024 ** 2,
  maxPartBytes: 64 * 1024 ** 2,
  maxParts: 100,
};
export function blobKey(kind: 'staging' | 'objects' = 'staging') {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `${kind}/${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
export function blobTestStream(size: number, seed = 0, onPull?: () => void) {
  let offset = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (offset === size) {
          controller.close();
          return;
        }
        onPull?.();
        const bytes = new Uint8Array(Math.min(65536, size - offset));
        for (let i = 0; i < bytes.length; i++)
          bytes[i] = (offset + i + seed) % 251;
        offset += bytes.length;
        controller.enqueue(bytes);
      },
    },
    { highWaterMark: 0 },
  );
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
async function rejected(
  operation: () => Promise<unknown>,
  code?: BlobStoreError['code'],
) {
  try {
    await operation();
  } catch (error) {
    assert(error instanceof BlobStoreError, 'Provider error leaked');
    assert(
      !code || error.code === code,
      `Unexpected failure code ${error.code}`,
    );
    return;
  }
  throw new Error('Operation unexpectedly succeeded');
}
async function verifyStream(
  body: ReadableStream<Uint8Array>,
  size: number,
  seed = 0,
  start = 0,
) {
  const reader = body.getReader();
  let offset = 0;
  let chunks = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      for (let i = 0; i < next.value.length; i++)
        assert(
          next.value[i] === (start + offset + i + seed) % 251,
          'Stream corrupted',
        );
      offset += next.value.length;
      chunks++;
    }
  } finally {
    reader.releaseLock();
  }
  assert(offset === size, 'Delivered size mismatch');
  return chunks;
}
/** Same proof on workerd/R2 and Node/S3; only bounded chunks cross the port. */
export async function proveBlobStore(store: BlobStore) {
  const keys = Array.from({ length: 7 }, () => blobKey());
  keys.push(blobKey('objects'));
  const uploads: BlobMultipart[] = [];
  const key = keys[0]!;
  try {
    assert(
      (await store.head(key)) === null && (await store.get(key)) === null,
      'Missing object must be null',
    );
    const first = await store.put({
      key,
      body: blobTestStream(257),
      size: 257,
      contentType: 'text/plain',
      metadata: { 'test-tag': 'portable' },
      createOnly: false,
    });
    assert(
      first.size === 257 &&
        first.contentType === 'text/plain' &&
        first.metadata['test-tag'] === 'portable',
      'PUT metadata lost',
    );
    const head = await store.head(key);
    assert(
      head?.etag === first.etag &&
        head.size === 257 &&
        head.metadata['test-tag'] === 'portable',
      'HEAD mismatch',
    );
    const read = await store.get(key);
    assert(read && read.bodySize === 257 && read.size === 257, 'GET missing');
    await verifyStream(read.body, 257);
    const range = await store.get(key, { offset: 10, length: 100 });
    assert(
      range && range.bodySize === 100 && range.size === 257,
      'Range metadata mismatch',
    );
    await verifyStream(range.body, 100, 0, 10);
    await rejected(
      () =>
        store.put({
          key,
          body: blobTestStream(5),
          size: 5,
          contentType: 'text/plain',
          createOnly: true,
        }),
      'BLOB_PRECONDITION',
    );
    const preserved = await store.get(key);
    assert(preserved, 'Conditional PUT removed object');
    await verifyStream(preserved.body, 257);
    const raceKey = keys[7]!;
    const races = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        store.put({
          key: raceKey,
          body: blobTestStream(257),
          size: 257,
          contentType: 'text/plain',
          createOnly: true,
        }),
      ),
    );
    assert(
      races.filter((r) => r.status === 'fulfilled').length === 1,
      'Create-only race did not have exactly one winner',
    );
    assert(
      races.every(
        (r) =>
          r.status === 'fulfilled' ||
          (r.reason instanceof BlobStoreError &&
            r.reason.code === 'BLOB_PRECONDITION'),
      ),
      'Create-only race leaked provider error',
    );
    await rejected(() =>
      store.put({
        key: keys[1]!,
        body: blobTestStream(100),
        size: 99,
        contentType: 'text/plain',
        createOnly: true,
      }),
    );
    await rejected(() =>
      store.put({
        key: keys[2]!,
        body: blobTestStream(99),
        size: 100,
        contentType: 'text/plain',
        createOnly: true,
      }),
    );
    assert(
      (await store.head(keys[1]!)) === null &&
        (await store.head(keys[2]!)) === null,
      'Size mismatch committed an object',
    );
    const payload = new Uint8Array(257);
    for (let i = 0; i < payload.length; i++) payload[i] = i % 251;
    const sha256 = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', payload)),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    await store.put({
      key: keys[3]!,
      body: blobTestStream(257),
      size: 257,
      contentType: 'application/octet-stream',
      sha256,
      createOnly: true,
    });
    await rejected(() =>
      store.put({
        key: keys[4]!,
        body: blobTestStream(257),
        size: 257,
        contentType: 'application/octet-stream',
        sha256: '0'.repeat(64),
        createOnly: true,
      }),
    );
    assert(
      (await store.head(keys[4]!)) === null,
      'Checksum mismatch committed an object',
    );
    const upload = await store.createMultipart({
      key: keys[5]!,
      contentType: 'application/octet-stream',
      metadata: { 'test-tag': 'multipart' },
    });
    uploads.push(upload);
    const one = await store.uploadPart(
      upload,
      1,
      blobTestStream(blobTestPolicy.minPartBytes),
      blobTestPolicy.minPartBytes,
    );
    const two = await store.uploadPart(
      { ...upload },
      2,
      blobTestStream(257, blobTestPolicy.minPartBytes),
      257,
    );
    const completed = await store.completeMultipart(
      { ...upload },
      [one, two].map((part) => ({
        ...part,
        etag: `"${part.etag.replace(/^"|"$/g, '')}"`,
      })),
    );
    assert(
      completed.size === blobTestPolicy.minPartBytes + 257,
      `Multipart size mismatch: ${completed.size}`,
    );
    assert(
      completed.metadata['test-tag'] === 'multipart',
      'Multipart metadata mismatch',
    );
    const multi = await store.get(upload.key);
    assert(multi, 'Completed multipart missing');
    await verifyStream(multi.body, completed.size);
    const aborted = await store.createMultipart({
      key: keys[6]!,
      contentType: 'text/plain',
    });
    uploads.push(aborted);
    await store.uploadPart(aborted, 1, blobTestStream(257), 257);
    await store.abortMultipart(aborted);
    await store.abortMultipart(aborted);
    await rejected(() =>
      store.uploadPart(aborted, 2, blobTestStream(257), 257),
    );
    assert(
      (await store.head(aborted.key)) === null,
      'Aborted multipart visible',
    );
    const largeSize = 32 * 1024 ** 2;
    let producerChunks = 0;
    await store.put({
      key,
      body: blobTestStream(largeSize, 0, () => {
        producerChunks++;
      }),
      size: largeSize,
      contentType: 'application/octet-stream',
      createOnly: false,
    });
    const large = await store.get(key);
    assert(large && large.size === largeSize, 'Large GET missing');
    const consumerChunks = await verifyStream(large.body, largeSize);
    assert(
      producerChunks === 512 && consumerChunks > 1,
      'Large object was not streamed',
    );
    await store.delete(key);
    await store.delete(key);
    assert(
      (await store.head(key)) === null && (await store.get(key)) === null,
      'DELETE failed',
    );
    return {
      checks: [
        'crud',
        'metadata',
        'range',
        'conditional-create',
        '8-way-race',
        'size-mismatch',
        'sha256',
        'checksum-mismatch',
        'multipart-resume',
        'multipart-abort',
        'streaming',
      ],
      largeSize,
      producerChunks,
      consumerChunks,
    };
  } finally {
    await Promise.all(
      uploads.map((upload) => store.abortMultipart(upload).catch(() => {})),
    );
    await Promise.all(keys.map((objectKey) => store.delete(objectKey)));
  }
}
