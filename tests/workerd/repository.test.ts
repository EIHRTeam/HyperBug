import {
  keyRegistryContract,
  keyRegistryBoundsContract,
  measureKeyRegistry,
} from '../fixtures/key-registry-contract.ts';
import type { KeyRegistry } from '../../packages/security/src/index.ts';
import type {
  RateCounterStore,
  RateCounterWrite,
} from '../../packages/security/src/rate-limit.ts';
import { abuseSubjectDigest } from '../../packages/security/src/rate-limit.ts';
import { checkSensitiveRateLimit } from '../../packages/security/src/rate-limit.ts';
import { rateCounterContract } from '../fixtures/rate-counter-contract.ts';
import {
  checkAccountLockout,
  recordAccountFailure,
  clearAccountLockout,
  type AccountLockoutStore,
} from '../../packages/security/src/account-lockout.ts';
import { progressiveAccountDelayMs } from '../../packages/security/src/account-delay.ts';
import { verifyAccountPassword } from '../../packages/server/src/account-password.ts';
import { execFileSync } from 'node:child_process';
import type { IssueRepository } from '@hyperbug/application';
import { mvpSchemaContract } from '../fixtures/mvp-schema-contract.ts';
import { afterAll, beforeAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import {
  createD1Repository,
  createD1AccountRegistrationStore,
} from '@hyperbug/database-d1';
import type { D1Database } from '@cloudflare/workers-types';
import {
  repositoryContract,
  measureRepositoryQueries,
  type RepositoryHarness,
} from '../fixtures/repository-contract.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import {
  seedKeyPurposeUpgrade,
  verifyKeyPurposeUpgrade,
} from '../fixtures/key-purpose-migration.ts';
import {
  seedPreviousSchema,
  verifyRejectedUpgrade,
} from '../fixtures/migration-contract.ts';
let registry: KeyRegistry;
let rateCounters: RateCounterStore;
let accountLockouts: AccountLockoutStore;
let runtimeDigest: () => Promise<unknown>;
let verifyUpgrade: () => Promise<void>;
let mf: Miniflare;
let harness: RepositoryHarness;
let measuredQueries: () => string[];
let registrationDb: D1Database;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/database-worker'),
      compatibilityDate: '2026-09-16',
      d1Databases: ['DB', 'FRESH', 'INVALID', 'KEY_UPGRADE'],
    }),
  );
  const db = await mf.getD1Database('DB');
  registrationDb = db as unknown as D1Database;
  const queries: string[] = [];
  measuredQueries = () => queries;
  const base = await mf.ready;
  async function call<T>(
    method:
      | keyof IssueRepository
      | 'registryInspect'
      | 'registryLoad'
      | 'registryMutate'
      | 'registryGet'
      | 'rateIncrement'
      | 'rateDigestProof'
      | 'ratePurge'
      | 'lockoutGet'
      | 'lockoutFailure'
      | 'lockoutClear'
      | 'lockoutPurge',
    input: unknown,
  ): Promise<T> {
    const response = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, input }),
    });
    const payload = (await response.json()) as {
      value: T;
      queries: string[];
      error?: { code: string };
    };
    queries.push(...payload.queries);
    if (payload.error)
      throw Object.assign(new Error(payload.error.code), {
        code: payload.error.code,
      });
    return payload.value;
  }
  registry = {
    async inspect(signal) {
      signal.throwIfAborted();
      return call('registryInspect', null);
    },
    async load(purpose, signal) {
      signal.throwIfAborted();
      return call('registryLoad', purpose);
    },
    async getRecord(id, signal) {
      signal.throwIfAborted();
      return call('registryGet', id);
    },
    mutate: (input) => call('registryMutate', input),
  };
  rateCounters = {
    increment: (input: RateCounterWrite) => call('rateIncrement', input),
    purgeExpired: (nowMs, limit) => call('ratePurge', { nowMs, limit }),
  };
  accountLockouts = {
    get: (subject, nowMs) => call('lockoutGet', { subject, nowMs }),
    recordFailure: (subject, nowMs, policy) =>
      call('lockoutFailure', { subject, nowMs, policy }),
    clear: (subject) => call('lockoutClear', subject),
    purgeExpired: (nowMs, limit) => call('lockoutPurge', { nowMs, limit }),
  };
  runtimeDigest = () => call('rateDigestProof', null);
  const repository: IssueRepository = {
    createIssue: (input) => call('createIssue', input),
    editIssue: (input) => call('editIssue', input),
    getIssue: (projectId, id) => call('getIssue', { projectId, id }),
    listIssues: (input) => call('listIssues', input),
  };
  const migrations = await migrationStatements('d1');
  const foundation = migrations[0];
  if (!foundation) throw new Error('Foundation migration is missing');
  await db.batch(foundation.statements.map((sql) => db.prepare(sql)));
  harness = {
    repository,
    query: async (sql, values = []) =>
      (
        await db
          .prepare(sql)
          .bind(...values)
          .all<Record<string, unknown>>()
      ).results,
  };
  verifyUpgrade = await seedPreviousSchema(harness);
  for (const migration of migrations.slice(1))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
});
afterAll(async () => {
  await mf?.dispose();
});
repositoryContract(() => harness);
rateCounterContract(() => rateCounters);

it('registers a User and credential atomically and leaves duplicate handles untouched on D1', async () => {
  const store = createD1AccountRegistrationStore(registrationDb);
  const record = {
    v: 1 as const,
    alg: 'Argon2id' as const,
    memoryKiB: 19456,
    passes: 2,
    parallelism: 1,
    salt: 'AQEBAQEBAQEBAQEBAQEBAQ',
    verifier: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
  };
  const first = {
    principalId: crypto.randomUUID(),
    identityId: crypto.randomUUID(),
    handle: 'registration_d1',
    passwordRecord: record,
    nowMs: 1789689600000,
  };
  expect(await store.register(first)).toEqual({
    status: 'created',
    principalId: first.principalId,
  });
  expect(
    await store.register({
      ...first,
      principalId: crypto.randomUUID(),
      identityId: crypto.randomUUID(),
    }),
  ).toEqual({ status: 'existing' });
  expect(
    await harness.query('SELECT id FROM principals WHERE id = ?', [
      first.principalId,
    ]),
  ).toHaveLength(1);
  expect(
    await harness.query(
      "SELECT id FROM principals WHERE display_name = 'registration_d1'",
    ),
  ).toHaveLength(1);
  expect(
    await harness.query(
      'SELECT identity_id FROM password_credentials WHERE identity_id = ?',
      [first.identityId],
    ),
  ).toHaveLength(1);
  await expect(
    store.register({
      ...first,
      principalId: crypto.randomUUID(),
      identityId: first.identityId,
      handle: 'other_d1',
    }),
  ).rejects.toThrow();
  expect(
    await harness.query(
      "SELECT id FROM principals WHERE display_name = 'other_d1'",
    ),
  ).toHaveLength(0);
  const contenders = [crypto.randomUUID(), crypto.randomUUID()].map(
    (principalId) => ({
      ...first,
      principalId,
      identityId: crypto.randomUUID(),
      handle: 'registration_race_d1',
    }),
  );
  const outcomes = await Promise.all(
    contenders.map((input) => store.register(input)),
  );
  expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
    'created',
    'existing',
  ]);
  expect(
    await harness.query(
      "SELECT id FROM principals WHERE display_name = 'registration_race_d1'",
    ),
  ).toHaveLength(1);
});

it('replaces a verified User credential only at its current revision on D1', async () => {
  const store = createD1AccountRegistrationStore(registrationDb);
  const principalId = crypto.randomUUID();
  const identityId = crypto.randomUUID();
  const handle = `rehash_${crypto.randomUUID().slice(0, 8)}`;
  const record = {
    v: 1 as const,
    alg: 'Argon2id' as const,
    memoryKiB: 19456,
    passes: 2,
    parallelism: 1,
    salt: 'AQEBAQEBAQEBAQEBAQEBAQ',
    verifier: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
  };
  const replacement = { ...record, passes: 3 };
  await store.register({
    principalId,
    identityId,
    handle,
    passwordRecord: record,
    nowMs: 1789689600000,
  });
  expect(await store.loadCredential(handle)).toEqual({
    principalId,
    identityId,
    record,
    revision: 1,
  });
  const change = {
    identityId,
    expectedRevision: 1,
    record: replacement,
    nowMs: 1789689600001,
  };
  expect(
    await verifyAccountPassword({
      handle,
      password: 'correct-password',
      service: {
        hash: async () => record,
        verify: async () => ({ verified: true, replacement }),
      },
      store,
      signal: new AbortController().signal,
      nowMs: change.nowMs,
    }),
  ).toEqual({ principalId, identityId, credentialRevision: 2 });
  expect(await store.replaceCredential(change)).toBe(false);
  expect(await store.loadCredential(handle)).toMatchObject({
    record: replacement,
    revision: 2,
  });
  await registrationDb
    .prepare("UPDATE principals SET status = 'suspended' WHERE id = ?")
    .bind(principalId)
    .run();
  expect(await store.loadCredential(handle)).toBeNull();
  expect(
    await store.replaceCredential({ ...change, expectedRevision: 2 }),
  ).toBe(false);
});

it('keeps D1 account lockout failure, admission and reset transitions atomic', async () => {
  const subjects = [1, 2].map((keyVersion) => ({
    category: 'login' as const,
    dimension: 'account' as const,
    keyVersion,
    digest: String(keyVersion).repeat(64),
  }));
  const policy = {
    initialMs: 1000,
    maximumMs: 30000,
    failuresPerStep: 2,
    resetAfterMs: 60000,
  };
  const now = 2200000000000;
  const originalVersion = [subjects[0]!];
  expect(await checkAccountLockout(accountLockouts, subjects, now)).toEqual({
    allowed: true,
  });
  const failures = await Promise.all(
    Array.from({ length: 6 }, () =>
      recordAccountFailure(accountLockouts, originalVersion, now, policy),
    ),
  );
  expect(failures.map((state) => state.failedAttempts).sort()).toEqual([
    1, 2, 3, 4, 5, 6,
  ]);
  const current = await accountLockouts.get(subjects[0]!, now);
  expect(current?.failedAttempts).toBe(6);
  expect(current?.notBeforeMs).toBe(now + progressiveAccountDelayMs(6, policy));
  expect(
    await checkAccountLockout(accountLockouts, originalVersion, now),
  ).toEqual({
    allowed: false,
    reason: 'limited',
    retryAfterSeconds: 4,
  });
  await recordAccountFailure(accountLockouts, subjects, now, policy);
  expect(await accountLockouts.get(subjects[1]!, now)).toMatchObject({
    failedAttempts: 1,
  });
  await clearAccountLockout(accountLockouts, subjects);
  expect(await checkAccountLockout(accountLockouts, subjects, now)).toEqual({
    allowed: true,
  });
  await recordAccountFailure(accountLockouts, subjects, now, policy);
  expect(
    (await accountLockouts.get(subjects[0]!, now + policy.resetAfterMs)) ===
      null,
  ).toBe(true);
  expect(await accountLockouts.purgeExpired(now + policy.resetAfterMs, 1)).toBe(
    1,
  );
  expect(await accountLockouts.purgeExpired(now + policy.resetAfterMs, 1)).toBe(
    1,
  );
});

it('shares D1 sensitive admission between two named Workers', async () => {
  const source = 'dist/database-worker';
  const twin = new Miniflare(
    convertV4MiniflareOptions({
      workers: ['rate-a', 'rate-b'].map((name) => ({
        name,
        modules: workerModules(source),
        compatibilityDate: '2026-09-16',
        d1Databases: { DB: 'rate-shared' },
      })),
    }),
  );
  try {
    const db = await twin.getD1Database('DB', 'rate-a');
    const migration = (await migrationStatements('d1')).find(
      (item) => item.name === '0007_rate_limits',
    );
    if (!migration) throw new Error('Rate counter migration missing');
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const workers = await Promise.all(
      ['rate-a', 'rate-b'].map((name) => twin.getWorker(name)),
    );
    const stores = workers.map((worker): RateCounterStore => ({
      async increment(input) {
        const response = await worker.fetch('http://internal/', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ method: 'rateIncrement', input }),
        });
        const result = (await response.json()) as {
          value?: number;
          error?: { code: string };
        };
        if (!response.ok || result.value === undefined)
          throw new Error(result.error?.code ?? 'Rate write failed');
        return result.value;
      },
      purgeExpired: async () => 0,
    }));
    const subject = {
      category: 'login' as const,
      dimension: 'account' as const,
      keyVersion: 1,
      digest: '9'.repeat(64),
    };
    const rule = { limit: 3, windowMs: 60000, retentionMs: 86400000 };
    const decisions = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        checkSensitiveRateLimit(
          stores[index % 2]!,
          subject,
          rule,
          2300000000000,
        ),
      ),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(3);
    expect(
      decisions
        .filter((decision) => decision.allowed)
        .map((decision) => (decision.allowed ? decision.remaining : -1))
        .sort(),
    ).toEqual([0, 1, 2]);
  } finally {
    await twin.dispose();
  }
});

it('derives the same domain-separated abuse digest in Node and workerd', async () => {
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(32).fill(7),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  expect(await runtimeDigest()).toEqual(
    await abuseSubjectDigest(key, 1, 'login', 'account', 'person@example.org'),
  );
});

it('upgrades 0000 with linked aggregates and receipts intact', async () => {
  await verifyUpgrade();
});
it('migrates a fresh database and keeps foreign keys enabled', async () => {
  const db = await mf.getD1Database('FRESH');
  for (const migration of await migrationStatements('d1'))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
  expect(await db.prepare('PRAGMA foreign_key_check').all()).toMatchObject({
    results: [],
  });
  expect(await db.prepare('PRAGMA foreign_keys').first('foreign_keys')).toBe(1);
  expect(
    await db
      .prepare(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger'",
      )
      .first('count'),
  ).toBe(15);
});
it('widens key purpose on a populated D1 registry without losing guards', async () => {
  const db = await mf.getD1Database('KEY_UPGRADE');
  const migrations = await migrationStatements('d1');
  const upgrade = migrations[8];
  if (!upgrade) throw new Error('Password-pepper migration missing');
  for (const migration of migrations.slice(0, 8))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
  const query = async (sql: string, values: unknown[] = []) =>
    (
      await db
        .prepare(sql)
        .bind(...values)
        .all<Record<string, unknown>>()
    ).results;
  await seedKeyPurposeUpgrade(query);
  await db.batch(upgrade.statements.map((sql) => db.prepare(sql)));
  await verifyKeyPurposeUpgrade(query);
  expect(await db.prepare('PRAGMA foreign_key_check').all()).toMatchObject({
    results: [],
  });
  expect(await db.prepare('PRAGMA foreign_keys').first('foreign_keys')).toBe(1);
});
it('rejects INSERT OR REPLACE history rewrites', async () => {
  for (const table of ['audit_events', 'timeline_events']) {
    await expect(
      harness.query(
        `INSERT OR REPLACE INTO ${table} SELECT * FROM ${table} LIMIT 1`,
      ),
    ).rejects.toThrow('append-only');
  }
});

it('uses bounded indexed list and detail queries with 4000 issues', async () => {
  await measureRepositoryQueries(harness, 'd1', measuredQueries);
}, 30000);

mvpSchemaContract(() => harness);

it('rolls back a rejected upgrade and permits retry after explicit data repair', async () => {
  const db = await mf.getD1Database('INVALID');
  const migrations = await migrationStatements('d1');
  const first = migrations[0];
  const integrity = migrations[1];
  if (!first || !integrity) throw new Error('Migration history missing');
  const apply = (statements: string[]) =>
    db.batch(statements.map((sql) => db.prepare(sql)));
  await apply(first.statements);
  const isolated: RepositoryHarness = {
    repository: createD1Repository(db as unknown as D1Database),
    query: async (sql, values = []) =>
      (
        await db
          .prepare(sql)
          .bind(...values)
          .all<Record<string, unknown>>()
      ).results,
  };
  const verify = await verifyRejectedUpgrade(isolated, () =>
    apply(integrity.statements),
  );
  for (const migration of migrations.slice(2))
    await apply(migration.statements);
  await verify();
});

keyRegistryContract(() => ({
  registry,
  second: { ...registry },
  query: harness.query,
}));

it('runs durable envelope rotation and revocation inside workerd', async () => {
  const response = await fetch(await mf.ready, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'registryRuntimeProof' }),
  });
  expect(await response.json()).toMatchObject({ value: 8 });
});
it('persists and rotates minimum-tier pepper records inside workerd', async () => {
  const response = await fetch(await mf.ready, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'minimumPasswordRegistryProof' }),
  });
  expect(await response.json()).toMatchObject({ value: 9 });
});

keyRegistryBoundsContract(() => ({
  registry,
  second: { ...registry },
  query: harness.query,
}));

it('measures fresh registry reads against 4000 protected records and 500 retained backups', async () => {
  await measureKeyRegistry(
    { registry, second: { ...registry }, query: harness.query },
    'd1',
    measuredQueries,
  );
}, 30000);
