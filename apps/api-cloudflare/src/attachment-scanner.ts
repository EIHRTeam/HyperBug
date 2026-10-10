import type {
  Fetcher,
  AbortController as PlatformAbortController,
} from '@cloudflare/workers-types';
import { createR2BlobDigest } from '@hyperbug/blob-r2';
import {
  createScannerServiceClient,
  scannerServiceUrl,
  type AttachmentScanner,
} from '@hyperbug/application';
declare const AbortController: typeof PlatformAbortController;

/** Explicit private service capability; no ambient Internet fetch, endpoint selection or retry. */
export function configureWorkerAttachmentScanner(
  binding: Pick<Fetcher, 'fetch'> | undefined,
  secret: string | undefined,
): AttachmentScanner | null {
  if (binding === undefined && secret === undefined) return null;
  try {
    if (!binding || typeof binding.fetch !== 'function' || secret === undefined)
      throw new Error();
    return createScannerServiceClient(
      {
        async send(input) {
          const controller = new AbortController();
          const abort = () => controller.abort();
          const cleanup = () =>
            input.signal.removeEventListener('abort', abort);
          input.signal.addEventListener('abort', abort, { once: true });
          if (input.signal.aborted) abort();
          try {
            const response = await binding.fetch(scannerServiceUrl, {
              method: 'POST',
              headers: input.headers,
              body: input.body,
              signal: controller.signal,
              redirect: 'manual',
            });
            const source = response.body?.getReader();
            if (!source) cleanup();
            const body = source
              ? new ReadableStream<Uint8Array>(
                  {
                    async pull(sink) {
                      try {
                        const next = await source.read();
                        if (next.done) {
                          sink.close();
                          source.releaseLock();
                          cleanup();
                          return;
                        }
                        if (!(next.value instanceof Uint8Array))
                          throw new Error();
                        sink.enqueue(next.value);
                      } catch {
                        cleanup();
                        void source
                          .cancel()
                          .catch(() => {})
                          .finally(() => source.releaseLock());
                        sink.error(
                          new Error('Scanner service response failed'),
                        );
                      }
                    },
                    async cancel() {
                      try {
                        await source.cancel();
                      } finally {
                        source.releaseLock();
                        cleanup();
                      }
                    },
                  },
                  { highWaterMark: 0 },
                )
              : null;
            return {
              status: response.status,
              contentType: response.headers.get('content-type'),
              body,
            };
          } catch (error) {
            cleanup();
            throw error;
          }
        },
      },
      createR2BlobDigest,
      secret,
    );
  } catch {
    throw new Error('Invalid attachment scanner service configuration');
  }
}
