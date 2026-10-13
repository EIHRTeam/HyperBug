import { expect, it } from 'vitest';
import type { AccountLockoutStore } from '../../packages/security/src/account-lockout.ts';
import {
  requireAccountLockoutAdmission,
  requireAccountLockoutFailureRecorded,
  requireAccountLockoutCleared,
} from '../../packages/server/src/account-lockout.ts';

const subject = {
  category: 'login' as const,
  dimension: 'account' as const,
  keyVersion: 1,
  digest: 'a'.repeat(64),
};

function store(get: AccountLockoutStore['get']): AccountLockoutStore {
  return {
    get,
    recordFailure: async () => {
      throw new Error('unused');
    },
    clear: async () => {},
    purgeExpired: async () => 0,
  };
}

function intent(
  lockouts: AccountLockoutStore,
  signal = new AbortController().signal,
) {
  return {
    store: lockouts,
    subjects: [subject],
    nowMs: 1000,
    signal,
    timeoutMs: 100,
  };
}

it('admits an unlocked account and gives a bounded retry hint for a lock', async () => {
  await expect(
    requireAccountLockoutAdmission(intent(store(async () => null))),
  ).resolves.toBeUndefined();
  await expect(
    requireAccountLockoutAdmission(
      intent(
        store(async () => ({
          failedAttempts: 2,
          notBeforeMs: 2500,
          expiresAtMs: 61000,
        })),
      ),
    ),
  ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 2 });
});

it('denies store outage, stalled reads and invalid deadlines', async () => {
  await expect(
    requireAccountLockoutAdmission(
      intent(
        store(async () => {
          throw new Error('private D1 detail');
        }),
      ),
    ),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  await expect(
    requireAccountLockoutAdmission({
      ...intent(store(async () => new Promise<never>(() => {}))),
      timeoutMs: 20,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  await expect(
    requireAccountLockoutAdmission({
      ...intent(store(async () => null)),
      timeoutMs: 0,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
});

it('requires durable failure and success transitions before completion', async () => {
  const writes: string[] = [];
  const lockouts: AccountLockoutStore = {
    get: async () => null,
    recordFailure: async () => {
      writes.push('failure');
      return { failedAttempts: 1, notBeforeMs: 2000, expiresAtMs: 61000 };
    },
    clear: async () => {
      writes.push('clear');
    },
    purgeExpired: async () => 0,
  };
  const selected = intent(lockouts);
  await requireAccountLockoutFailureRecorded({
    ...selected,
    policy: {
      initialMs: 1000,
      maximumMs: 30000,
      failuresPerStep: 2,
      resetAfterMs: 60000,
    },
  });
  await requireAccountLockoutCleared(selected);
  expect(writes).toEqual(['failure', 'clear']);
  await expect(
    requireAccountLockoutFailureRecorded({
      ...selected,
      store: {
        ...lockouts,
        recordFailure: async () => {
          throw new Error('private write detail');
        },
      },
      policy: {
        initialMs: 1000,
        maximumMs: 30000,
        failuresPerStep: 2,
        resetAfterMs: 60000,
      },
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  await expect(
    requireAccountLockoutCleared({
      ...selected,
      store: {
        ...lockouts,
        clear: async () => {
          throw new Error('private delete detail');
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
});
