import type { RateCounterStore } from '@hyperbug/security';

export const rateCleanupIntervalMs = 5 * 60 * 1000;
const batchSize = 1000;

/** Bounded, non-overlapping cleanup; a failed batch is retried on the next tick. */
export function startNodeRateCounterCleanup(store: RateCounterStore) {
  let active: Promise<number> | null = null;
  const run = (nowMs: number): Promise<number> => {
    if (active) return active;
    const attempt = Promise.resolve().then(() =>
      store.purgeExpired(nowMs, batchSize),
    );
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
      console.error('Rate counter cleanup unavailable');
    });
  }, rateCleanupIntervalMs);
  timer.unref();
  return Object.freeze({
    run,
    async close(): Promise<void> {
      clearInterval(timer);
      await active?.catch(() => {});
    },
  });
}
