import { ApiClientError, type OperationTypes } from '@hyperbug/api-client';
import type { ProductRequest } from './product-state.ts';
type Upload =
  OperationTypes['GET /api/v1/projects/{projectId}/uploads/{uploadId}']['response'];
type Capability =
  OperationTypes['POST /api/v1/projects/{projectId}/uploads/{uploadId}/capability']['response'];
type Association =
  OperationTypes['PUT /api/v1/projects/{projectId}/uploads/{uploadId}']['body']['association'];

export function validateUploadDestination(
  capability: Capability,
  origins: readonly string[],
) {
  const url = new URL(capability.url);
  if (
    !origins.includes(url.origin) ||
    url.username ||
    url.password ||
    url.hash ||
    capability.method !== 'PUT' ||
    !Number.isFinite(Date.parse(capability.expiresAt))
  )
    throw new ApiClientError(0, 'UPLOAD_DESTINATION');
  if (Date.parse(capability.expiresAt) <= Date.now())
    throw new ApiClientError(0, 'UPLOAD_EXPIRED');
  if (
    Object.keys(capability.headers).some(
      (key) =>
        !['content-type', 'content-md5', 'x-amz-checksum-sha256'].includes(
          key.toLowerCase(),
        ),
    )
  )
    throw new ApiClientError(0, 'UPLOAD_HEADERS');
  return url.href;
}
function put(
  capability: Capability,
  body: Blob,
  origins: readonly string[],
  signal: AbortSignal,
  progress: (sent: number) => void,
): Promise<string> {
  const url = validateUploadDestination(capability, origins);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    function fail(code: string, status = 0) {
      reject(new ApiClientError(status, code));
    }
    xhr.open('PUT', url);
    xhr.withCredentials = false;
    xhr.timeout = 60000;
    for (const [key, value] of Object.entries(capability.headers))
      xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => progress(event.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300)
        resolve(xhr.getResponseHeader('etag') ?? '');
      else fail('UPLOAD_TRANSFER', xhr.status);
    };
    xhr.onerror = () => fail('UPLOAD_NETWORK');
    xhr.ontimeout = () => fail('TIMEOUT');
    xhr.onabort = () => fail('CANCELLED');
    xhr.onloadend = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      signal.removeEventListener('abort', abort);
      fail('CANCELLED');
      return;
    }
    xhr.send(body);
  });
}
export async function transferUpload(options: {
  request: ProductRequest;
  projectId: string;
  uploadId: string;
  file: File;
  association: Association;
  origins: readonly string[];
  signal: AbortSignal;
  progress: (sent: number) => void;
}): Promise<Upload> {
  const {
    request,
    projectId,
    uploadId,
    file,
    association,
    signal,
    origins,
    progress,
  } = options;
  const params = { projectId, uploadId };
  let upload = await request(
    'PUT /api/v1/projects/{projectId}/uploads/{uploadId}',
    {
      params,
      body: {
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        maxBytes: file.size,
        association,
      },
      signal,
      retryMutation: true,
    },
  );
  if (upload.state !== 'pending') return upload;
  if (upload.transfer.mode === 'direct') {
    async function send(retry: boolean): Promise<void> {
      const capability = await request(
        'POST /api/v1/projects/{projectId}/uploads/{uploadId}/capability',
        { params, body: {}, signal },
      );
      try {
        await put(capability, file, origins, signal, progress);
      } catch (error) {
        if (
          retry &&
          error instanceof ApiClientError &&
          (error.status === 403 || error.code === 'UPLOAD_EXPIRED')
        )
          return send(false);
        throw error;
      }
    }
    await send(true);
    upload = await request(
      'POST /api/v1/projects/{projectId}/uploads/{uploadId}/finalize',
      { params, body: {}, signal },
    );
  } else {
    let multipart = await request(
      'POST /api/v1/projects/{projectId}/uploads/{uploadId}/multipart',
      { params, body: {}, signal },
    );
    const count = Math.ceil(file.size / multipart.partBytes);
    if (count > multipart.maxParts || count > 100)
      throw new ApiClientError(0, 'UPLOAD_LIMIT');
    async function part(partNumber: number): Promise<void> {
      if (partNumber > count) return;
      const offset = (partNumber - 1) * multipart.partBytes;
      const size = Math.min(multipart.partBytes, file.size - offset);
      if (
        !multipart.parts.some(
          (entry) =>
            entry.partNumber === partNumber && entry.sizeBytes === size,
        )
      ) {
        const partParams = { ...params, partNumber: String(partNumber) };
        async function sendPart(retry: boolean): Promise<string> {
          const capability = await request(
            'POST /api/v1/projects/{projectId}/uploads/{uploadId}/multipart/parts/{partNumber}/capability',
            { params: partParams, body: {}, signal },
          );
          try {
            return await put(
              capability,
              file.slice(offset, offset + size),
              origins,
              signal,
              (sent) => progress(offset + sent),
            );
          } catch (error) {
            if (
              retry &&
              error instanceof ApiClientError &&
              (error.status === 403 || error.code === 'UPLOAD_EXPIRED')
            )
              return sendPart(false);
            throw error;
          }
        }
        const etag = await sendPart(true);
        if (!etag) throw new ApiClientError(0, 'UPLOAD_ETAG');
        multipart = await request(
          'PUT /api/v1/projects/{projectId}/uploads/{uploadId}/multipart/parts/{partNumber}',
          {
            params: partParams,
            body: {
              expectedRevision: multipart.revision,
              etag,
              sizeBytes: size,
            },
            signal,
          },
        );
      }
      progress(offset + size);
      return part(partNumber + 1);
    }
    await part(1);
    upload = await request(
      'POST /api/v1/projects/{projectId}/uploads/{uploadId}/multipart/complete',
      { params, body: { expectedRevision: multipart.revision }, signal },
    );
  }
  return upload;
}
