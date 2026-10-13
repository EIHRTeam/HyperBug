import type { BlobAuthorization, BlobStore } from '@hyperbug/application';
import { blobKey } from './blob-store-proof.ts';

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
/** Never include URLs, request bodies or provider error bodies in the report. */
export async function proveBlobSigning(
  store: BlobStore,
  authorization: BlobAuthorization,
) {
  const key = blobKey();
  const final = blobKey('objects');
  const send = (url: string, type = 'text/plain') =>
    fetch(url, {
      method: 'PUT',
      headers: { 'content-type': type },
      body: 'portable',
      signal: AbortSignal.timeout(15000),
    });
  try {
    const capability = await authorization.upload({
      key,
      contentType: 'text/plain',
      expiresInSeconds: 60,
    });
    const signed = new URL(capability.url);
    assert(
      signed.searchParams
        .get('X-Amz-SignedHeaders')
        ?.split(';')
        .includes('content-type'),
      'Content-Type was not signed',
    );
    assert(
      signed.searchParams.get('X-Amz-Expires') === '60',
      'Wrong capability TTL',
    );
    assert((await send(capability.url)).status === 200, 'Signed PUT failed');
    assert(
      (await send(capability.url, 'text/html')).status === 403,
      'Changed content type accepted',
    );
    const changedKey = new URL(capability.url);
    changedKey.pathname = changedKey.pathname.replace(key, final);
    assert(
      (await send(changedKey.toString())).status === 403,
      'Changed object key accepted',
    );
    assert(
      (await send(capability.url)).status === 200,
      'Reusable signed PUT failed',
    );
    const stage = await store.get(key);
    assert(
      stage && stage.size === 8 && stage.contentType === 'text/plain',
      'Uploaded metadata missing',
    );
    await store.put({
      key: final,
      body: stage.body,
      size: stage.size,
      contentType: stage.contentType,
      createOnly: true,
    });
    const download = await authorization.download({
      key: final,
      contentType: 'application/octet-stream',
      contentDisposition: 'attachment; filename="file.txt"',
      expiresInSeconds: 60,
    });
    const response = await fetch(download.url, {
      signal: AbortSignal.timeout(15000),
    });
    assert(
      response.status === 200 &&
        response.headers.get('content-disposition') ===
          'attachment; filename="file.txt"' &&
        response.headers.get('content-type') === 'application/octet-stream',
      'Download policy missing',
    );
    assert((await response.text()) === 'portable', 'Wrong signed GET bytes');
    const changedQuery = new URL(download.url);
    changedQuery.searchParams.set('response-content-type', 'text/html');
    assert(
      (await fetch(changedQuery, { signal: AbortSignal.timeout(15000) }))
        .status === 403,
      'Changed response query accepted',
    );
    const upload = await store.createMultipart({
      key,
      contentType: 'text/plain',
    });
    try {
      const part = await authorization.uploadPart({
        ...upload,
        partNumber: 1,
        expiresInSeconds: 60,
      });
      const result = await fetch(part.url, {
        method: 'PUT',
        body: 'multipart',
        signal: AbortSignal.timeout(15000),
      });
      assert(
        result.status === 200 && result.headers.get('etag'),
        'Signed UploadPart failed',
      );
      const changedPart = new URL(part.url);
      changedPart.searchParams.set('partNumber', '2');
      assert(
        (
          await fetch(changedPart, {
            method: 'PUT',
            body: 'tampered',
            signal: AbortSignal.timeout(15000),
          })
        ).status === 403,
        'Changed part number accepted',
      );
      const complete = await store.completeMultipart(upload, [
        { partNumber: 1, etag: result.headers.get('etag')! },
      ]);
      assert(complete.size === 9, 'Signed multipart size mismatch');
    } finally {
      await store.abortMultipart(upload);
    }
    return {
      checks: [
        'signed-put',
        'signed-get',
        'signed-part',
        'signed-content-type',
        'header-tamper',
        'key-tamper',
        'query-tamper',
        'part-tamper',
        'reusable-put',
        'forced-download',
      ],
    };
  } finally {
    await store.delete(key);
    await store.delete(final);
    assert(
      (await store.head(key)) === null && (await store.head(final)) === null,
      'Owned signing objects not removed',
    );
  }
}
