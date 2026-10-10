import type { RateCounterStore } from '@hyperbug/security';
import {
  expiredCleanupBatchSize,
  type ExpiredCleanupStore,
} from '@hyperbug/application';

export const rateCleanupIntervalMs = 5 * 60 * 1000;
const batchSize = 1000;

/** Bounded, non-overlapping cleanup; a failed batch is retried on the next tick. */
export function startNodeRateCounterCleanup(store: RateCounterStore) {
  return startNodeCleanup(
    (nowMs) => store.purgeExpired(nowMs, batchSize),
    'Rate counter cleanup unavailable',
  );
}

export function startNodeExpiredCleanup(
  store: ExpiredCleanupStore,
  retentionMs: number,
  background?: () => Promise<void>,
) {
  return startNodeCleanup(async (nowMs) => {
    const count = await store.purgeExpired(
      nowMs,
      retentionMs,
      expiredCleanupBatchSize,
    );
    await background?.().catch(() => {
      console.error('Async dispatch unavailable');
    });
    return count;
  }, 'Expired cleanup unavailable');
}

function startNodeCleanup(
  purge: (nowMs: number) => Promise<number>,
  failure: string,
) {
  let closed = false;
  let active: Promise<number> | null = null;
  const run = (nowMs: number): Promise<number> => {
    if (closed) return Promise.reject(new Error('Cleanup closed'));
    if (active) return active;
    const attempt = Promise.resolve().then(() => purge(nowMs));
    active = attempt;
    void attempt
      .finally(() => {
        if (active === attempt) active = null;
      })
      .catch(() => {});
    return attempt;
  };
  const timer = setInterval(() => {
    void run(Date.now()).catch(() => {
      console.error(failure);
    });
  }, rateCleanupIntervalMs);
  timer.unref();
  return Object.freeze({
    run,
    async close(): Promise<void> {
      closed = true;
      clearInterval(timer);
      await active?.catch(() => {});
    },
  });
}
