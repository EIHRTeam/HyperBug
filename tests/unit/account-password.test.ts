import { expect, it } from 'vitest';
import type { AccountPasswordStore } from '@hyperbug/application';
import type {
  StandardPasswordRecord,
  StandardPasswordService,
} from '../../packages/security/src/standard-password.ts';
import { verifyAccountPassword } from '../../packages/server/src/account-password.ts';

const record: StandardPasswordRecord = {
  v: 1,
  alg: 'Argon2id',
  memoryKiB: 19456,
  passes: 2,
  parallelism: 1,
  salt: 'AQEBAQEBAQEBAQEBAQEBAQ',
  verifier: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
};
const replacement = { ...record, passes: 3 };
const principalId = '00000000-0000-4000-8000-000000000001';
const identityId = '00000000-0000-4000-8000-000000000002';

function fixture() {
  const events: string[] = [];
  let revision = 1;
  let currentRecord = record;
  let active = true;
  let exists = true;
  let stale = false;
  const store: AccountPasswordStore = {
    async loadCredential(handle) {
      events.push(`load:${handle}`);
      return exists && active
        ? { principalId, identityId, record: currentRecord, revision }
        : null;
    },
    async replaceCredential(input) {
      events.push(`replace:${input.expectedRevision}`);
      if (stale || !active || input.expectedRevision !== revision) return false;
      currentRecord = input.record;
      revision++;
      return true;
    },
  };
  const service: StandardPasswordService = {
    async hash() {
      events.push('dummy');
      return record;
    },
    async verify(password) {
      events.push('verify');
      return {
        verified: password === 'correct-password',
        replacement: password === 'correct-password' ? replacement : null,
      };
    },
  };
  const input = {
    handle: 'Example_User',
    password: 'correct-password',
    service,
    store,
    signal: new AbortController().signal,
    nowMs: 1789689600001,
  };
  return {
    events,
    input,
    setExists: (value: boolean) => {
      exists = value;
    },
    setActive: (value: boolean) => {
      active = value;
    },
    setStale: (value: boolean) => {
      stale = value;
    },
  };
}

it('verifies and persists a replacement before returning a revision-bound identity', async () => {
  const test = fixture();
  expect(await verifyAccountPassword(test.input)).toEqual({
    principalId,
    identityId,
    credentialRevision: 2,
  });
  expect(test.events).toEqual([
    'load:example_user',
    'verify',
    'replace:1',
    'load:example_user',
  ]);
});

it('does selected-cost work for an unknown account and gives no identity for wrong passwords', async () => {
  const unknown = fixture();
  unknown.setExists(false);
  expect(await verifyAccountPassword(unknown.input)).toBeNull();
  expect(unknown.events).toEqual(['load:example_user', 'dummy']);
  const wrong = fixture();
  expect(
    await verifyAccountPassword({ ...wrong.input, password: 'wrong-password' }),
  ).toBeNull();
  expect(wrong.events).toEqual(['load:example_user', 'verify']);
});

it('denies stale replacement, suspension and unavailable dependencies', async () => {
  const stale = fixture();
  stale.setStale(true);
  await expect(verifyAccountPassword(stale.input)).rejects.toMatchObject({
    code: 'AUTHORIZATION_UNAVAILABLE',
  });
  const suspended = fixture();
  suspended.setActive(false);
  expect(await verifyAccountPassword(suspended.input)).toBeNull();
  const missing = fixture();
  await expect(
    verifyAccountPassword({ ...missing.input, store: null }),
  ).rejects.toMatchObject({ code: 'AUTHORIZATION_UNAVAILABLE' });
  const outage = fixture();
  await expect(
    verifyAccountPassword({
      ...outage.input,
      store: {
        ...outage.input.store!,
        loadCredential: async () => {
          throw new Error('private storage error');
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'AUTHORIZATION_UNAVAILABLE' });
});

it('denies when the account changes before the final credential read', async () => {
  const test = fixture();
  const original = test.input.store!;
  let loads = 0;
  await expect(
    verifyAccountPassword({
      ...test.input,
      store: {
        ...original,
        loadCredential: async (handle) => {
          loads++;
          return loads === 1 ? original.loadCredential(handle) : null;
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'AUTHORIZATION_UNAVAILABLE' });
  expect(test.events).toEqual(['load:example_user', 'verify', 'replace:1']);
});
