import { BlobStoreError, assertBlobKey } from './blob-store.ts';
import type { UploadMultipartReconciler } from './upload-cleanup.ts';

export interface MultipartDiscoveryPage {
  truncated: boolean | undefined;
  uploads: { key: string | undefined; id: string | undefined }[];
  groupedPrefixes: number;
  nextKey: string | undefined;
  nextId: string | undefined;
}
/** Internal provider port, scoped by Core to one backend-owned staging key. */
export interface MultipartDiscoveryPort {
  list(input: {
    key: string;
    maxUploads: 20;
    keyMarker?: string;
    uploadIdMarker?: string;
    signal: AbortSignal;
  }): Promise<MultipartDiscoveryPage>;
  abort(input: {
    key: string;
    uploadId: string;
    signal: AbortSignal;
  }): Promise<void>;
}

/** Cooperative I/O cancellation plus a hard caller wait bound, even for a stalled provider. */
export async function multipartAbortable<T>(
  signal: AbortSignal,
  task: () => Promise<T>,
): Promise<T> {
  if (signal.aborted) throw new BlobStoreError('BLOB_UNAVAILABLE');
  let abort = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(new BlobStoreError('BLOB_UNAVAILABLE'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (signal.aborted) throw new BlobStoreError('BLOB_UNAVAILABLE');
        return task();
      }),
      stopped,
    ]);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

/** Twenty-item pages, five-page/100-ID discovery, sequential abort and complete absence. */
export function createBoundedMultipartReconciler(
  provider: MultipartDiscoveryPort,
): UploadMultipartReconciler {
  return {
    async reconcile(input) {
      assertBlobKey(input.key, true);
      const timeout = new AbortController();
      const signal = AbortSignal.any([input.signal, timeout.signal]);
      const timer = setTimeout(() => timeout.abort(), 30000);
      const check = () => {
        if (signal.aborted) throw new BlobStoreError('BLOB_UNAVAILABLE');
      };
      async function discover(): Promise<string[]> {
        const uploads = new Set<string>(),
          markers = new Set<string>();
        let next: { keyMarker?: string; uploadIdMarker: string } | undefined;
        for (let page = 0; page < 5; page++) {
          check();
          // Continuation is sequential and must be validated before another page.
          // eslint-disable-next-line no-await-in-loop
          const result = await multipartAbortable(signal, () =>
            provider.list({
              key: input.key,
              maxUploads: 20,
              ...next,
              signal,
            }),
          );
          check();
          if (
            !result ||
            typeof result.truncated !== 'boolean' ||
            !Array.isArray(result.uploads) ||
            result.uploads.length > 20 ||
            result.groupedPrefixes !== 0
          )
            throw new BlobStoreError('BLOB_UNAVAILABLE');
          for (const upload of result.uploads) {
            if (
              !upload ||
              upload.key !== input.key ||
              typeof upload.id !== 'string' ||
              !validId(upload.id) ||
              uploads.has(upload.id)
            )
              throw new BlobStoreError('BLOB_UNAVAILABLE');
            uploads.add(upload.id);
          }
          if (!result.truncated) return [...uploads];
          if (
            (result.nextKey !== undefined && result.nextKey !== input.key) ||
            typeof result.nextId !== 'string' ||
            !validId(result.nextId) ||
            markers.has(result.nextId)
          )
            throw new BlobStoreError('BLOB_UNAVAILABLE');
          markers.add(result.nextId);
          // Preserve an absent key marker on providers whose upload marker alone continues.
          next = {
            ...(result.nextKey === undefined ? {} : { keyMarker: input.key }),
            uploadIdMarker: result.nextId,
          };
        }
        throw new BlobStoreError('BLOB_UNAVAILABLE');
      }
      try {
        const uploads = await discover();
        for (const uploadId of uploads) {
          check();
          // Sequential aborts share the same total deadline and bound concurrency to one.
          // eslint-disable-next-line no-await-in-loop
          await multipartAbortable(signal, () =>
            provider.abort({ key: input.key, uploadId, signal }),
          );
        }
        if ((await discover()).length !== 0)
          throw new BlobStoreError('BLOB_UNAVAILABLE');
        check();
        return { key: input.key, remainingUploads: 0 };
      } catch {
        throw new BlobStoreError('BLOB_UNAVAILABLE');
      } finally {
        clearTimeout(timer);
        timeout.abort();
      }
    },
  };
}
function validId(value: string): boolean {
  return (
    value.length > 0 && value.length <= 2048 && !/[\p{Cc}\p{Cs}]/u.test(value)
  );
}
