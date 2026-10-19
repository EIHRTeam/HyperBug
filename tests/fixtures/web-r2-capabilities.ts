import { AwsClient } from 'aws4fetch';
import type { BlobAuthorization, BlobCapability } from '@hyperbug/application';

/** Test-only loopback SigV4 signer for the native Miniflare R2 S3 endpoint.
 * Production R2 account endpoints/signing and bucket CORS are unchanged. */
export function browserR2Capabilities(
  endpoint: string,
  bucket: string,
  credentials: { accessKeyId: string; secretAccessKey: string },
): BlobAuthorization {
  const base = new URL(endpoint);
  if (
    base.protocol !== 'http:' ||
    base.hostname !== '127.0.0.1' ||
    base.pathname !== '/cdn-cgi/local/r2/s3' ||
    base.search ||
    base.hash ||
    !/^[a-z0-9-]+$/.test(bucket)
  )
    throw new Error('Invalid local R2 fixture endpoint');
  const signer = new AwsClient({
    ...credentials,
    region: 'auto',
    service: 's3',
  });
  async function sign(
    key: string,
    method: 'PUT' | 'GET',
    seconds: number,
    headers: Record<string, string>,
    query: Record<string, string> = {},
  ): Promise<BlobCapability> {
    const url = new URL(`${endpoint}/${bucket}/${key}`);
    url.searchParams.set('X-Amz-Expires', String(seconds));
    for (const [name, value] of Object.entries(query))
      url.searchParams.set(name, value);
    const issuedAt = Math.floor(Date.now() / 1000) * 1000;
    const request = await signer.sign(url.href, {
      method,
      headers,
      aws: {
        signQuery: true,
        allHeaders: true,
        datetime: new Date(issuedAt).toISOString().replace(/[:-]|\.\d{3}/g, ''),
      },
    });
    return {
      method,
      url: request.url,
      headers,
      expiresAt: issuedAt + seconds * 1000,
    };
  }
  return {
    upload: (input) =>
      sign(input.key, 'PUT', input.expiresInSeconds, {
        'content-type': input.contentType,
      }),
    uploadPart: (input) =>
      sign(
        input.key,
        'PUT',
        input.expiresInSeconds,
        {},
        { uploadId: input.uploadId, partNumber: String(input.partNumber) },
      ),
    download: (input) =>
      sign(
        input.key,
        'GET',
        input.expiresInSeconds,
        {},
        {
          'response-content-type': input.contentType,
          'response-content-disposition': input.contentDisposition,
        },
      ),
  };
}
