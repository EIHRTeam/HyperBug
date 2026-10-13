import { expect, it } from 'vitest';
import { createNodeVolumetricLimiter } from '../../apps/api-node/src/rate-limit.ts';

it('bounds per-process volumetric entries and work per request', async () => {
  const limiter = createNodeVolumetricLimiter({
    limit: 2,
    windowMs: 60000,
    maxKeys: 1,
  });
  const first = 'a'.repeat(64);
  const second = 'b'.repeat(64);
  expect(await limiter.consume(first, 120000)).toEqual({ allowed: true });
  expect(await limiter.consume(first, 120000)).toEqual({ allowed: true });
  expect(await limiter.consume(first, 120000)).toEqual({
    allowed: false,
    reason: 'limited',
  });
  expect(await limiter.consume(second, 120000)).toEqual({
    allowed: false,
    reason: 'unavailable',
  });
  expect(await limiter.consume(second, 180000)).toEqual({ allowed: true });
  expect(await limiter.consume('raw-ip', 180000)).toEqual({
    allowed: false,
    reason: 'unavailable',
  });
});
