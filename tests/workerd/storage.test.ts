import { createHash, createHmac } from 'node:crypto';
import { it, expect } from 'vitest';
import { startLocalS3 } from '../../tooling/local-s3.ts';

it('provides a signed local S3 PUT/HEAD/GET/DELETE service and rejects invalid signatures', async () => {
  const storage = await startLocalS3();
  const url = new URL(`${storage.endpoint}/${storage.bucket}/foundation.txt`);
  const hash = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const hmac = (key: string | Buffer, value: string) =>
    createHmac('sha256', key).update(value).digest();
  const request = (
    method: string,
    body = '',
    secret = storage.credentials.secretAccessKey,
  ) => {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const date = timestamp.slice(0, 8);
    const scope = `${date}/auto/s3/aws4_request`;
    const headers = {
      'x-amz-date': timestamp,
      'x-amz-content-sha256': hash(body),
    };
    const signed = 'host;x-amz-content-sha256;x-amz-date';
    const canonical = `${method}\n${url.pathname}\n\nhost:${url.host}\nx-amz-content-sha256:${hash(body)}\nx-amz-date:${timestamp}\n\n${signed}\n${hash(body)}`;
    const key = hmac(
      hmac(hmac(hmac(`AWS4${secret}`, date), 'auto'), 's3'),
      'aws4_request',
    );
    const signature = hmac(
      key,
      `AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`,
    ).toString('hex');
    return fetch(url, {
      method,
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${storage.credentials.accessKeyId}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
      },
      ...(method === 'PUT' ? { body } : {}),
    });
  };
  try {
    const invalid = await request('PUT', 'forbidden', 'invalid-test-key');
    expect(invalid.status).toBe(403);
    await invalid.text();
    const put = await request('PUT', 'local storage proof');
    expect(put.status).toBe(200);
    await put.text();
    const head = await request('HEAD');
    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('19');
    const get = await request('GET');
    expect(get.status).toBe(200);
    expect(await get.text()).toBe('local storage proof');
    const deleted = await request('DELETE');
    expect(deleted.status).toBe(204);
    await deleted.text();
    const missing = await request('GET');
    expect(missing.status).toBe(404);
    await missing.text();
  } finally {
    await storage.close();
  }
});
