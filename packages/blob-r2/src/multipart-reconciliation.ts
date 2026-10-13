import { AwsClient } from 'aws4fetch';
import {
  BlobStoreError,
  createBoundedMultipartReconciler,
  multipartAbortable,
  type UploadMultipartReconciler,
} from '@hyperbug/application';
import type { R2SigningConfig } from './index.ts';
import { readR2MultipartPage, r2MissingUpload } from './multipart-xml.ts';

/** S3 discovery complements the native binding's CRUD; no query-signed capability escapes. */
export function createR2MultipartReconciler(
  config: R2SigningConfig,
  transport: (outbound: Request) => Promise<Response> = (outbound) =>
    fetch(outbound),
): UploadMultipartReconciler {
  if (
    !/^[0-9a-f]{32}$/.test(config.accountId) ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket) ||
    typeof config.credentials?.accessKeyId !== 'string' ||
    !config.credentials.accessKeyId ||
    typeof config.credentials.secretAccessKey !== 'string' ||
    !config.credentials.secretAccessKey
  )
    throw new BlobStoreError('BLOB_INVALID');
  const bucket = config.bucket;
  const base = `https://${config.accountId}.r2.cloudflarestorage.com/${bucket}`;
  const signer = new AwsClient({
    ...config.credentials,
    service: 's3',
    region: 'auto',
  });
  async function request(
    url: URL,
    method: 'GET' | 'DELETE',
    signal: AbortSignal,
  ): Promise<Response> {
    const signed = await multipartAbortable(signal, () =>
      signer.sign(url.toString(), {
        method,
        signal,
        // workerd rejects `error` during Request construction despite current docs.
        // Manual mode prevents any forwarding; every redirect response is refused below.
        redirect: 'manual',
        cache: 'no-store',
        aws: { signQuery: false },
      }),
    );
    return multipartAbortable(signal, async () => {
      const response = await transport(signed);
      if (
        signal.aborted ||
        response.redirected ||
        (response.status >= 300 && response.status < 400)
      ) {
        void response.body?.cancel().catch(() => {});
        throw new BlobStoreError('BLOB_UNAVAILABLE');
      }
      return response;
    });
  }
  return createBoundedMultipartReconciler({
    async list(input) {
      const url = new URL(base);
      url.searchParams.set('uploads', '');
      url.searchParams.set('prefix', input.key);
      url.searchParams.set('max-uploads', String(input.maxUploads));
      if (input.keyMarker !== undefined)
        url.searchParams.set('key-marker', input.keyMarker);
      if (input.uploadIdMarker !== undefined)
        url.searchParams.set('upload-id-marker', input.uploadIdMarker);
      const response = await request(url, 'GET', input.signal);
      if (response.status !== 200) {
        void response.body?.cancel().catch(() => {});
        throw new BlobStoreError('BLOB_UNAVAILABLE');
      }
      return readR2MultipartPage(response, input.signal, bucket, input.key);
    },
    async abort(input) {
      const url = new URL(`${base}/${input.key}`);
      url.searchParams.set('uploadId', input.uploadId);
      const response = await request(url, 'DELETE', input.signal);
      if (response.status === 204) {
        void response.body?.cancel().catch(() => {});
        return;
      }
      if (
        response.status === 404 &&
        (await r2MissingUpload(response, input.signal))
      )
        return;
      void response.body?.cancel().catch(() => {});
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    },
  });
}
