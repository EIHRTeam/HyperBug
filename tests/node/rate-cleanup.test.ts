import { expect, it, vi } from 'vitest';
import {
  startNodeRateCounterCleanup,
  rateCleanupIntervalMs,
} from '../../apps/api-node/src/rate-cleanup.ts';

it('schedules bounded counter cleanup, retries a failed tick, and stops on close', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-28T00:00:00.000Z'));
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  let calls = 0;
  const purgeExpired = vi.fn(async () => {
    if (++calls === 1) throw new Error('private database failure');
    return 2;
  });
  const cleanup = startNodeRateCounterCleanup({
    increment: async () => 1,
    purgeExpired,
  });
  try {
    await vi.advanceTimersByTimeAsync(rateCleanupIntervalMs);
    expect(purgeExpired).toHaveBeenCalledWith(Date.now(), 1000);
    expect(logged).toHaveBeenCalledWith('Rate counter cleanup unavailable');
    await vi.advanceTimersByTimeAsync(rateCleanupIntervalMs);
    expect(purgeExpired).toHaveBeenCalledTimes(2);
    await cleanup.close();
    await vi.advanceTimersByTimeAsync(rateCleanupIntervalMs);
    expect(purgeExpired).toHaveBeenCalledTimes(2);
  } finally {
    await cleanup.close();
    logged.mockRestore();
    vi.useRealTimers();
  }
});

it('does not overlap counter cleanup when a database call is still pending', async () => {
  vi.useFakeTimers();
  let release!: (value: number) => void;
  const purgeExpired = vi.fn(
    () => new Promise<number>((resolve) => (release = resolve)),
  );
  const cleanup = startNodeRateCounterCleanup({
    increment: async () => 1,
    purgeExpired,
  });
  try {
    await vi.advanceTimersByTimeAsync(rateCleanupIntervalMs);
    await vi.advanceTimersByTimeAsync(rateCleanupIntervalMs);
    expect(purgeExpired).toHaveBeenCalledTimes(1);
    release(1);
    await cleanup.close();
  } finally {
    release?.(1);
    await cleanup.close();
    vi.useRealTimers();
  }
});
