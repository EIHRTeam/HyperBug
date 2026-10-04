import { timingSafeEqual } from 'node:crypto';
import { createNodeBlobDigest } from '@hyperbug/blob-s3';
import {
  scannerServiceProtocol,
  scannerServiceUrl,
  validateScannerServiceInput,
  validateScannerServiceSecret,
  validateScanOutcome,
  guardScannerServiceInput,
  type AttachmentScanner,
  type ScanOutcome,
  type ScannerServiceReply,
} from '@hyperbug/application';

/** Private trusted binary service handler; never mounted on the business/public API. */
export function createNodeAttachmentScannerService(
  scanner: AttachmentScanner,
  secret: string,
  timeoutMs = 60000,
) {
  validateScannerServiceSecret(secret);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 60000)
    throw new Error('Invalid scanner service configuration');
  const expected = Buffer.from(`Bearer ${secret}`, 'ascii');
  const pathname = new URL(scannerServiceUrl).pathname;
  return async (request: Request): Promise<Response> => {
    const reject = (status: number) => {
      void request.body?.cancel().catch(() => {});
      return new Response(null, {
        status,
        headers: { 'cache-control': 'no-store' },
      });
    };
    const authorization = request.headers.get('authorization');
    if (authorization?.length !== expected.length) return reject(401);
    const supplied = Buffer.from(authorization, 'utf8');
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    )
      return reject(401);
    const url = new URL(request.url);
    const requestId = request.headers.get('x-hyperbug-scan-id');
    const size = request.headers.get('x-hyperbug-scan-size');
    const contentType = request.headers.get('x-hyperbug-scan-type');
    if (
      request.method !== 'POST' ||
      url.pathname !== pathname ||
      url.search ||
      url.username ||
      url.password ||
      request.headers.get('content-type') !== 'application/octet-stream' ||
      request.headers.has('content-encoding') ||
      request.headers.get('x-hyperbug-scanner-protocol') !==
        scannerServiceProtocol ||
      !requestId ||
      !size ||
      !/^(?:0|[1-9][0-9]{0,7})$/.test(size) ||
      !contentType ||
      !request.body
    )
      return reject(400);
    const sizeBytes = Number(size);
    try {
      validateScannerServiceInput({ requestId, sizeBytes, contentType });
      if (
        request.headers.has('content-length') &&
        request.headers.get('content-length') !== size
      )
        throw new Error();
    } catch {
      return reject(400);
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    let timer: ReturnType<typeof setTimeout>;
    let guarded: ReturnType<typeof guardScannerServiceInput> | undefined;
    const timeout = new Promise<ScanOutcome>((resolve) => {
      controller.signal.addEventListener(
        'abort',
        () => {
          guarded?.stop();
          resolve({ status: 'failed', failure: 'timeout' });
        },
        { once: true },
      );
      timer = setTimeout(abort, timeoutMs);
      if (controller.signal.aborted)
        resolve({ status: 'failed', failure: 'timeout' });
    });
    const work = (async (): Promise<ScanOutcome> => {
      try {
        controller.signal.throwIfAborted();
        guarded = guardScannerServiceInput(
          request.body!,
          sizeBytes,
          controller.signal,
          createNodeBlobDigest,
        );
        const outcome = await scanner.scan({
          body: guarded.body,
          sizeBytes,
          contentType,
          signal: controller.signal,
        });
        controller.signal.throwIfAborted();
        validateScanOutcome(outcome);
        if (outcome.status !== 'failed' && !guarded.identity)
          return { status: 'failed', failure: guarded.failure };
        return outcome;
      } catch {
        return {
          status: 'failed',
          failure: controller.signal.aborted ? 'timeout' : 'unavailable',
        };
      }
    })();
    try {
      const outcome = await Promise.race([work, timeout]);
      const reply: ScannerServiceReply = {
        protocol: scannerServiceProtocol,
        requestId,
        identity: outcome.status === 'failed' ? null : guarded!.identity,
        outcome,
      };
      return Response.json(reply, {
        headers: {
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    } finally {
      clearTimeout(timer!);
      request.signal.removeEventListener('abort', abort);
      controller.abort();
      guarded?.stop();
    }
  };
}
