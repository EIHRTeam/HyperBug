/* eslint-disable no-await-in-loop -- One bounded response chunk at a time. */
import type { BlobDigest } from './blob-promotion.ts';
import type { AttachmentScanner } from './scan-upload.ts';
import { guardScannerServiceInput } from './scanner-service-stream.ts';
import {
  scannerServiceProtocol,
  scannerServiceReplyMaxBytes,
  validateScannerServiceInput,
  validateScannerServiceReply,
  validateScannerServiceSecret,
} from './scanner-service-protocol.ts';
import type { ScanOutcome } from './upload-scans.ts';

export interface ScannerServiceTransport {
  send(input: {
    body: ReadableStream<Uint8Array>;
    headers: Record<string, string>;
    signal: AbortSignal;
  }): Promise<{
    status: number;
    contentType: string | null;
    body: ReadableStream<Uint8Array> | null;
  }>;
}
/** Fixed configured trusted transport only; no public result callback or arbitrary destination. */
export function createScannerServiceClient(
  transport: ScannerServiceTransport,
  createDigest: () => BlobDigest,
  secret: string,
  timeoutMs = 60000,
): AttachmentScanner {
  validateScannerServiceSecret(secret);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 60000)
    throw new Error('Invalid scanner service configuration');
  return {
    async scan(input) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      input.signal.addEventListener('abort', abort, { once: true });
      if (input.signal.aborted) abort();
      let timer: ReturnType<typeof setTimeout>;
      let guarded: ReturnType<typeof guardScannerServiceInput> | undefined;
      let responseReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      const cancel = () => {
        guarded?.stop();
        const reader = responseReader;
        if (reader)
          void reader
            .cancel()
            .catch(() => {})
            .finally(() => reader.releaseLock());
      };
      const denied = new Promise<ScanOutcome>((resolve) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            cancel();
            resolve({ status: 'failed', failure: 'timeout' });
          },
          { once: true },
        );
        timer = setTimeout(abort, timeoutMs);
        if (controller.signal.aborted)
          resolve({ status: 'failed', failure: 'timeout' });
      });
      const operation = (async (): Promise<ScanOutcome> => {
        try {
          controller.signal.throwIfAborted();
          const requestId = crypto.randomUUID();
          validateScannerServiceInput({
            requestId,
            sizeBytes: input.sizeBytes,
            contentType: input.contentType,
          });
          guarded = guardScannerServiceInput(
            input.body,
            input.sizeBytes,
            controller.signal,
            createDigest,
          );
          const response = await transport.send({
            body: guarded.body,
            signal: controller.signal,
            headers: {
              authorization: `Bearer ${secret}`,
              'content-type': 'application/octet-stream',
              'cache-control': 'no-store',
              'x-hyperbug-scanner-protocol': scannerServiceProtocol,
              'x-hyperbug-scan-id': requestId,
              'x-hyperbug-scan-size': String(input.sizeBytes),
              'x-hyperbug-scan-type': input.contentType,
            },
          });
          if (controller.signal.aborted || response.status !== 200) {
            void response.body?.cancel().catch(() => {});
            return {
              status: 'failed',
              failure: controller.signal.aborted ? 'timeout' : 'unavailable',
            };
          }
          if (
            response.contentType?.toLowerCase().split(';')[0]?.trim() !==
              'application/json' ||
            !response.body
          ) {
            void response.body?.cancel().catch(() => {});
            return { status: 'failed', failure: 'invalid-result' };
          }
          responseReader = response.body.getReader();
          const bytes = new Uint8Array(scannerServiceReplyMaxBytes);
          let length = 0;
          try {
            for (;;) {
              const next = await responseReader.read();
              controller.signal.throwIfAborted();
              if (next.done) break;
              if (
                !(next.value instanceof Uint8Array) ||
                next.value.byteLength === 0 ||
                next.value.byteLength > bytes.length - length
              )
                throw new Error();
              bytes.set(next.value, length);
              length += next.value.byteLength;
            }
            const reply = validateScannerServiceReply(
              JSON.parse(
                new TextDecoder('utf-8', {
                  fatal: true,
                  ignoreBOM: true,
                }).decode(bytes.subarray(0, length)),
              ),
            );
            if (reply.requestId !== requestId)
              return { status: 'failed', failure: 'invalid-result' };
            if (reply.outcome.status === 'failed') return reply.outcome;
            const identity = guarded.identity;
            if (!identity)
              return { status: 'failed', failure: guarded.failure };
            if (
              identity.sizeBytes !== reply.identity!.sizeBytes ||
              identity.sha256 !== reply.identity!.sha256
            )
              return { status: 'failed', failure: 'identity' };
            return reply.outcome;
          } catch {
            return {
              status: 'failed',
              failure: controller.signal.aborted ? 'timeout' : 'invalid-result',
            };
          }
        } catch {
          return {
            status: 'failed',
            failure: controller.signal.aborted ? 'timeout' : 'unavailable',
          };
        }
      })();
      try {
        return await Promise.race([operation, denied]);
      } finally {
        clearTimeout(timer!);
        input.signal.removeEventListener('abort', abort);
        controller.abort();
        cancel();
      }
    },
  };
}
