import { expect, it } from 'vitest';
import {
  checkAccountLockout,
  clearAccountLockout,
  recordAccountFailure,
  type AccountLockoutStore,
} from '../../packages/security/src/account-lockout.ts';

const subject = {
  category: 'login' as const,
  dimension: 'account' as const,
  keyVersion: 1,
  digest: 'a'.repeat(64),
};
const policy = {
  initialMs: 1000,
  maximumMs: 30000,
  failuresPerStep: 2,
  resetAfterMs: 60000,
};

it('denies unavailable and malformed lockout reads without leaking state', async () => {
  const failed: AccountLockoutStore = {
    get: async () => {
      throw new Error('private D1 error');
    },
    recordFailure: async () => {
      throw new Error('unused');
    },
    clear: async () => {},
    purgeExpired: async () => 0,
  };
  expect(await checkAccountLockout(failed, [subject], 1000)).toEqual({
    allowed: false,
    reason: 'unavailable',
    retryAfterSeconds: null,
  });
  expect(
    await checkAccountLockout(
      { ...failed, get: async () => ({ failedAttempts: 0 }) as never },
      [subject],
      1000,
    ),
  ).toMatchObject({ allowed: false, reason: 'unavailable' });
  expect(
    await checkAccountLockout(failed, [subject, subject], 1000),
  ).toMatchObject({
    allowed: false,
    reason: 'unavailable',
  });
});

it('snapshots active versions and requires every failure/reset write', async () => {
  const observed: number[] = [];
  const store: AccountLockoutStore = {
    get: async () => null,
    async recordFailure(key, nowMs) {
      observed.push(key.keyVersion);
      return {
        failedAttempts: 1,
        notBeforeMs: nowMs + 1000,
        expiresAtMs: nowMs + 60000,
      };
    },
    async clear(key) {
      observed.push(-key.keyVersion);
    },
    purgeExpired: async () => 0,
  };
  const versions = [subject, { ...subject, keyVersion: 2 }];
  await recordAccountFailure(store, versions, 1000, policy);
  await clearAccountLockout(store, versions);
  expect(observed.sort((a, b) => a - b)).toEqual([-2, -1, 1, 2]);
  await expect(
    recordAccountFailure(store, [subject], 1000, {
      ...policy,
      resetAfterMs: 500,
    }),
  ).rejects.toThrow();
});
