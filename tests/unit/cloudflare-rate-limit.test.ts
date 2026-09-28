import { expect, it } from 'vitest';
import { createCloudflareVolumetricLimiter } from '../../apps/api-cloudflare/src/rate-limit.ts';

it('treats the location-scoped binding as approximate and denies its failures', async () => {
  const key = 'a'.repeat(64);
  const binding = {
    limit: async ({ key: supplied }: { key: string }) => {
      expect(supplied).toBe(key);
      return { success: false };
    },
  };
  expect(
    await createCloudflareVolumetricLimiter(binding).consume(key, 120000),
  ).toEqual({
    allowed: false,
    reason: 'limited',
  });
  expect(
    await createCloudflareVolumetricLimiter({
      limit: async () => {
        throw new Error('provider details');
      },
    }).consume(key, 120000),
  ).toEqual({ allowed: false, reason: 'unavailable' });
  expect(
    await createCloudflareVolumetricLimiter(binding).consume('raw-ip', 120000),
  ).toEqual({
    allowed: false,
    reason: 'unavailable',
  });
});
