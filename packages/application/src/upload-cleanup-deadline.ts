import {
  UploadIntentError,
  validateUploadLease,
  type UploadLease,
} from './upload-intents.ts';

/** Internal distinction lets a page stop after provider work may have outlived its caller. */
export class UploadCleanupTimeoutError extends UploadIntentError {}

export function createUploadCleanupDeadline(
  lease?: UploadLease,
  clock: () => number = Date.now,
) {
  const checkLease = () => {
    const now = clock();
    if (lease) {
      if (now >= lease.leaseExpiresAt)
        throw new UploadCleanupTimeoutError('UPLOAD_LEASE_LOST');
      validateUploadLease({ ...lease, now });
    }
    return now;
  };
  const startedAt = checkLease();
  const waitMs = lease
    ? Math.min(30000, lease.leaseExpiresAt - startedAt)
    : 30000;
  const controller = new AbortController();
  const wallDeadline = Date.now() + waitMs;
  let closed = false;
  let expired: UploadCleanupTimeoutError | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = new UploadCleanupTimeoutError(
        lease && lease.leaseExpiresAt - startedAt <= 30000
          ? 'UPLOAD_LEASE_LOST'
          : 'UPLOAD_UNAVAILABLE',
      );
      reject(expired);
      controller.abort();
    }, waitMs);
  });
  // The deadline can expire between storage calls (e.g. during a database mutation).
  void timeout.catch(() => {});
  const check = () => {
    if (expired) throw expired;
    if (closed) throw new UploadIntentError('UPLOAD_UNAVAILABLE');
    checkLease();
    if (Date.now() >= wallDeadline) {
      expired = new UploadCleanupTimeoutError('UPLOAD_UNAVAILABLE');
      controller.abort();
      throw expired;
    }
  };
  return {
    async wait<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
      check();
      let result: T;
      try {
        result = await Promise.race([
          Promise.resolve().then(() => {
            check();
            return operation(controller.signal);
          }),
          timeout,
        ]);
      } catch (error) {
        throw expired ?? error;
      }
      // A late result must not trigger another operation or release accounting.
      check();
      return result;
    },
    check,
    close() {
      closed = true;
      if (timer !== undefined) clearTimeout(timer);
      controller.abort();
    },
  };
}
