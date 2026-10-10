import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';

it('local Cloudflare queue delivers a validated adapter reference and retries before acknowledgement', async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures'], {
    stdio: 'pipe',
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/async-queue-worker'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat'],
      queueProducers: { TASKS: 'async-events' },
      queueConsumers: {
        'async-events': {
          maxBatchSize: 10,
          maxBatchTimeout: 0,
          maxRetries: 5,
          retryDelay: 0,
        },
      },
    }),
  );
  try {
    expect(
      (await mf.dispatchFetch('http://fixture/', { method: 'POST' })).status,
    ).toBe(200);
    // The adapter's retry delay is deliberately 30 seconds; actual emulation, no fake delivery.
    await expect
      .poll(
        async () =>
          (
            (await (
              await mf.dispatchFetch('http://fixture/')
            ).json()) as unknown[]
          ).length,
        { timeout: 35_000, interval: 500 },
      )
      .toBe(2);
    expect(await (await mf.dispatchFetch('http://fixture/')).json()).toEqual([
      { id: 'search-update:00000000-0000-4000-8000-000000000001', attempts: 1 },
      { id: 'search-update:00000000-0000-4000-8000-000000000001', attempts: 2 },
    ]);
  } finally {
    await mf.dispose();
  }
}, 40_000);
