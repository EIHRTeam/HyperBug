import {
  keyRegistryRuntimeProof,
  minimumPasswordRegistryProof,
} from '../fixtures/key-registry-runtime.ts';
import { rateCounterContract } from '../fixtures/rate-counter-contract.ts';
import { checkSensitiveRateLimit } from '../../packages/security/src/rate-limit.ts';
import { checkSensitiveRateAdmission } from '../../packages/security/src/abuse-keys.ts';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { verifyAccountPassword } from '../../packages/server/src/account-password.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import {
  keyRegistryContract,
  keyRegistryBoundsContract,
  measureKeyRegistry,
} from '../fixtures/key-registry-contract.ts';
import { migratePostgres } from '../../tooling/migrate-postgres.ts';
import { mvpSchemaContract } from '../fixtures/mvp-schema-contract.ts';
import { afterAll, beforeAll, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createPostgresRepository,
  createPostgresKeyRegistry,
  createPostgresRateCounterStore,
  createPostgresAccountRegistrationStore,
} from '@hyperbug/database-postgres';
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
let verifyUpgrade: () => Promise<void>;
let pool: Pool;
let harness: RepositoryHarness;
let measuredQueries: () => string[];
beforeAll(async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error(
      'Use pnpm test:postgres to start an isolated PostgreSQL 18 cluster.',
    );
  pool = new Pool({ max: 12 });
  const queries = vi.spyOn(pool, 'query');
  measuredQueries = () => queries.mock.calls.map(([sql]) => String(sql));
  const migrations = await migrationStatements('postgres');
  const apply = async (statements: string[]) => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      for (const sql of statements) await db.query(sql);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  };
  const foundation = migrations[0];
  if (!foundation) throw new Error('Foundation migration is missing');
  await apply(foundation.statements);
  harness = {
    repository: createPostgresRepository(pool),
    query: async (sql, values = []) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    },
  };
  verifyUpgrade = await seedPreviousSchema(harness);
  for (const migration of migrations.slice(1))
    await apply(migration.statements);
});
afterAll(async () => {
  await pool?.end();
});
repositoryContract(() => harness);
rateCounterContract(() => createPostgresRateCounterStore(pool));

it('registers a User and credential atomically and leaves duplicate handles untouched on PostgreSQL', async () => {
  const store = createPostgresAccountRegistrationStore(pool);
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
    handle: 'registration_pg',
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
    (
      await pool.query(
        "SELECT id FROM principals WHERE display_name = 'registration_pg'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await pool.query(
        'SELECT identity_id FROM password_credentials WHERE identity_id = $1',
        [first.identityId],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    store.register({
      ...first,
      principalId: crypto.randomUUID(),
      identityId: first.identityId,
      handle: 'other_pg',
    }),
  ).rejects.toThrow();
  expect(
    (
      await pool.query(
        "SELECT id FROM principals WHERE display_name = 'other_pg'",
      )
    ).rows,
  ).toHaveLength(0);
  const contenders = [crypto.randomUUID(), crypto.randomUUID()].map(
    (principalId) => ({
      ...first,
      principalId,
      identityId: crypto.randomUUID(),
      handle: 'registration_race_pg',
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
    (
      await pool.query(
        "SELECT id FROM principals WHERE display_name = 'registration_race_pg'",
      )
    ).rows,
  ).toHaveLength(1);
});

it('replaces a verified User credential only at its current revision on PostgreSQL', async () => {
  const store = createPostgresAccountRegistrationStore(pool);
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
  await pool.query("UPDATE principals SET status = 'suspended' WHERE id = $1", [
    principalId,
  ]);
  expect(await store.loadCredential(handle)).toBeNull();
  expect(
    await store.replaceCredential({ ...change, expectedRevision: 2 }),
  ).toBe(false);
});

it('uses the Node root private key and Unix-socket PostgreSQL counter together', async () => {
  const socketDirectory = process.env.PGHOST;
  const databaseName = process.env.PGDATABASE;
  const databaseUser = process.env.PGUSER;
  if (!socketDirectory || !databaseName || !databaseUser)
    throw new Error('Isolated PostgreSQL test cluster is required');
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-abuse-pg-'));
  const keyFile = join(directory, 'abuse.json');
  let configured: ReturnType<typeof configureNodeAbuseAdmission> | undefined;
  try {
    await writeFile(keyFile, abuseKeyFixture(), { mode: 0o600 });
    configured = configureNodeAbuseAdmission(
      { socketDirectory, databaseName, databaseUser, keyFile },
      'local',
    );
    if (!configured.abuse) throw new Error('Abuse admission was not bound');
    // Counter access is configured, but readiness also requires the token key.
    expect(await configured.ready(new AbortController().signal)).toBe(false);
    const checks = [
      {
        dimension: 'account' as const,
        canonicalSubject: 'root-composition@example.org',
        rule: { limit: 1, windowMs: 60000, retentionMs: 86400000 },
      },
      {
        dimension: 'ip' as const,
        canonicalSubject: '192.0.2.64',
        rule: { limit: 1, windowMs: 60000, retentionMs: 86400000 },
      },
    ];
    const first = await checkSensitiveRateAdmission(
      configured.abuse.provider,
      configured.abuse.store,
      'login',
      checks,
      2200000000000,
      new AbortController().signal,
    );
    const second = await checkSensitiveRateAdmission(
      configured.abuse.provider,
      configured.abuse.store,
      'login',
      checks,
      2200000000000,
      new AbortController().signal,
    );
    expect(first.allowed).toBe(true);
    expect(second).toMatchObject({ allowed: false, reason: 'limited' });
  } finally {
    await configured?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

it('keeps the Node key registry available without an abuse key', async () => {
  const socketDirectory = process.env.PGHOST;
  const databaseName = process.env.PGDATABASE;
  const databaseUser = process.env.PGUSER;
  if (!socketDirectory || !databaseName || !databaseUser)
    throw new Error('Isolated PostgreSQL test cluster is required');
  const configured = configureNodeAbuseAdmission(
    {
      socketDirectory,
      databaseName,
      databaseUser,
      keyProviderFile: '/private/keys.json',
    },
    'local',
  );
  try {
    expect(configured.abuse).toBeNull();
    expect(configured.keyRegistry).not.toBeNull();
    const snapshot = await configured.keyRegistry!.inspect(
      new AbortController().signal,
    );
    expect(snapshot.generation).toBeGreaterThan(0);
    expect(await configured.ready(new AbortController().signal)).toBe(false);
  } finally {
    await configured.close();
  }
});

it('shares sensitive admission across two PostgreSQL pools and denies a lost pool', async () => {
  const otherPool = new Pool({ max: 4 });
  let closed = false;
  const first = createPostgresRateCounterStore(pool);
  const second = createPostgresRateCounterStore(otherPool);
  const subject = {
    category: 'login' as const,
    dimension: 'account' as const,
    keyVersion: 1,
    digest: 'f'.repeat(64),
  };
  const rule = { limit: 3, windowMs: 60000, retentionMs: 86400000 };
  const now = 2200000000000;
  const retryAfterSeconds = Math.ceil(
    (rule.windowMs - (now % rule.windowMs)) / 1000,
  );
  try {
    const decisions = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        checkSensitiveRateLimit(
          index % 2 === 0 ? first : second,
          subject,
          rule,
          now,
        ),
      ),
    );
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    expect(
      decisions
        .filter((decision) => decision.allowed)
        .map((decision) => (decision.allowed ? decision.remaining : -1))
        .sort(),
    ).toEqual([0, 1, 2]);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(3);
    for (const decision of decisions.filter((value) => !value.allowed))
      expect(decision).toMatchObject({
        reason: 'limited',
        retryAfterSeconds,
      });
    await otherPool.end();
    closed = true;
    expect(
      await checkSensitiveRateLimit(second, subject, rule, now + 60000),
    ).toEqual({
      allowed: false,
      reason: 'unavailable',
      retryAfterSeconds: null,
    });
    expect(
      await checkSensitiveRateLimit(first, subject, rule, now + 60000),
    ).toEqual({
      allowed: true,
      remaining: 2,
    });
  } finally {
    if (!closed) await otherPool.end();
  }
});

it('upgrades 0000 with linked aggregates and receipts intact', async () => {
  await verifyUpgrade();
});
it('migrates a fresh database and protects history from truncation', async () => {
  await pool.query('CREATE DATABASE hyperbug_fresh');
  const fresh = new Pool({ database: 'hyperbug_fresh' });
  try {
    expect((await migratePostgres(fresh)).pending).toHaveLength(11);
    expect((await migratePostgres(fresh, true)).applied).toHaveLength(11);
    expect(await migratePostgres(fresh, true)).toEqual({
      applied: [],
      pending: [],
    });
    expect(
      (
        await fresh.query(
          "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name != 'hyperbug_schema_migrations'",
        )
      ).rows[0].count,
    ).toBe(33);
    await expect(fresh.query('TRUNCATE audit_events')).rejects.toThrow(
      'append-only',
    );
    await expect(
      fresh.query(
        "INSERT INTO issue_forms (id, project_id, name) VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Missing project')",
      ),
    ).rejects.toThrow();
    await fresh.query(
      "UPDATE hyperbug_schema_migrations SET checksum = 'invalid' WHERE name = '0000_foundation'",
    );
    await expect(migratePostgres(fresh, true)).rejects.toThrow(
      'immutable expected prefix',
    );
  } finally {
    await fresh.end();
    await pool.query('DROP DATABASE hyperbug_fresh');
  }
});
it('widens key purpose on a populated PostgreSQL registry', async () => {
  await pool.query('CREATE DATABASE hyperbug_key_upgrade');
  const upgraded = new Pool({ database: 'hyperbug_key_upgrade' });
  const migrations = await migrationStatements('postgres');
  const last = migrations[8];
  if (!last) throw new Error('Password-pepper migration missing');
  const apply = async (steps: typeof migrations) => {
    const client = await upgraded.connect();
    try {
      await client.query('BEGIN');
      for (const step of steps)
        for (const statement of step.statements) await client.query(statement);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  const query = async (sql: string, values: unknown[] = []) => {
    let index = 0;
    return (
      await upgraded.query(
        sql.replace(/\?/g, () => `$${++index}`),
        values,
      )
    ).rows as Record<string, unknown>[];
  };
  try {
    await apply(migrations.slice(0, 8));
    await seedKeyPurposeUpgrade(query);
    await apply([last]);
    await verifyKeyPurposeUpgrade(query);
  } finally {
    await upgraded.end();
    await pool.query('DROP DATABASE hyperbug_key_upgrade');
  }
});

it('uses bounded indexed list and detail queries with 4000 issues', async () => {
  await measureRepositoryQueries(harness, 'postgres', measuredQueries);
}, 30000);

mvpSchemaContract(() => harness);

it('rolls back a rejected upgrade and permits retry after explicit data repair', async () => {
  await pool.query('CREATE DATABASE hyperbug_invalid');
  const isolatedPool = new Pool({ database: 'hyperbug_invalid' });
  try {
    const migrations = await migrationStatements('postgres');
    const first = migrations[0];
    const integrity = migrations[1];
    if (!first || !integrity) throw new Error('Migration history missing');
    const apply = async (statements: string[]) => {
      const db = await isolatedPool.connect();
      try {
        await db.query('BEGIN');
        for (const sql of statements) await db.query(sql);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    };
    await apply(first.statements);
    const isolated: RepositoryHarness = {
      repository: createPostgresRepository(isolatedPool),
      query: async (sql, values = []) => {
        let index = 0;
        return (
          await isolatedPool.query(
            sql.replace(/\?/g, () => `$${++index}`),
            values,
          )
        ).rows;
      },
    };
    const verify = await verifyRejectedUpgrade(isolated, () =>
      apply(integrity.statements),
    );
    for (const migration of migrations.slice(2))
      await apply(migration.statements);
    await verify();
  } finally {
    await isolatedPool.end();
    await pool.query('DROP DATABASE hyperbug_invalid');
  }
});

keyRegistryContract(() => ({
  registry: createPostgresKeyRegistry(pool),
  second: createPostgresKeyRegistry(pool),
  query: harness.query,
}));

it('runs durable envelope rotation and revocation inside Node', async () => {
  expect(await keyRegistryRuntimeProof(createPostgresKeyRegistry(pool))).toBe(
    8,
  );
});
it('persists and rotates minimum-tier pepper records inside Node', async () => {
  expect(
    await minimumPasswordRegistryProof(createPostgresKeyRegistry(pool)),
  ).toBe(9);
});

keyRegistryBoundsContract(() => ({
  registry: createPostgresKeyRegistry(pool),
  second: createPostgresKeyRegistry(pool),
  query: harness.query,
}));

it('measures fresh registry reads against 4000 protected records and 500 retained backups', async () => {
  await measureKeyRegistry(
    {
      registry: createPostgresKeyRegistry(pool),
      second: createPostgresKeyRegistry(pool),
      query: harness.query,
    },
    'postgres',
    measuredQueries,
  );
}, 30000);
