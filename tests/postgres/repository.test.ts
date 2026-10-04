import { uploadScanContract } from '../fixtures/upload-scan-contract.ts';
import { uploadOrphanContract } from '../fixtures/upload-orphan-contract.ts';
import { uploadLegacyInventoryContract } from '../fixtures/upload-legacy-inventory-contract.ts';
import {
  uploadLegacyRecoveryContract,
  seedLegacyRecoveryFixture,
  actualR2LegacyRecoveryLedgerContract,
} from '../fixtures/upload-legacy-recovery-contract.ts';
import { createPostgresUploadLegacyRecoveryStore } from '@hyperbug/database-postgres';
import { createPostgresUploadLegacyInventoryStore } from '@hyperbug/database-postgres';
import { uploadLegacyInventorySql as pgLegacyInventorySql } from '../../packages/database/postgres/src/upload-legacy-inventory.ts';
import { formUploadQuota } from '../fixtures/form-submission-contract.ts';
import {
  uploadMultipartContract,
  multipartTestQuota,
} from '../fixtures/upload-multipart-contract.ts';
import { formSubmissionContract } from '../fixtures/form-submission-contract.ts';
import { contentProjectionContract } from '../fixtures/content-projection-contract.ts';
import { contentDefinitionContract } from '../fixtures/content-definition-contract.ts';
import {
  uploadIntentContract,
  uploadTestQuota,
} from '../fixtures/upload-intent-contract.ts';
import { createPostgresUploadIntentStore } from '@hyperbug/database-postgres';
import {
  createPostgresContentProjectionStore,
  createPostgresCommentStore,
  createPostgresContentDefinitionStore,
} from '@hyperbug/database-postgres';
import {
  keyRegistryRuntimeProof,
  minimumPasswordRegistryProof,
} from '../fixtures/key-registry-runtime.ts';
import { rateCounterContract } from '../fixtures/rate-counter-contract.ts';
import { checkSensitiveRateLimit } from '../../packages/security/src/rate-limit.ts';
import { checkSensitiveRateAdmission } from '../../packages/security/src/abuse-keys.ts';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { verifyAccountPassword } from '../../packages/server/src/account-password.ts';
import { createNodeStandardPasswordService } from '../../apps/api-node/src/standard-password.ts';
import { loadDeploymentConfig } from '../../packages/config/src/deployment.ts';
import {
  expectedStandardPasswordRehashObservation,
  observeStandardPasswordRehash,
  rehashInitialParameters,
  rehashSupersededParameters,
} from '../fixtures/standard-password-rehash-contract.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { postgresNodeBindings } from '../fixtures/postgres-node-bindings.ts';
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
  createPostgresAuditRepository,
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
  seedInstanceRoleUpgrade,
  seedTokenAssuranceUpgrade,
  seedPreviousSchema,
  seedTemplateUpgrade,
  seedUploadUpgrade,
  seedScanUpgrade,
  snapshotLegacyRecoveryUpgrade,
  verifyRejectedUpgrade,
} from '../fixtures/migration-contract.ts';
import {
  auditRepositoryContract,
  measureAuditQueries,
} from '../fixtures/audit-contract.ts';
let verifyUpgrade: () => Promise<void>;
let verifyTemplateUpgrade: () => Promise<void>;
let verifyUploadUpgrade: () => Promise<void>;
let verifyScanUpgrade: () => Promise<void>;
let verifyLegacyRecoveryUpgrade: () => Promise<void>;
let pool: Pool;
uploadLegacyInventoryContract(() => ({
  harness,
  uploads: createPostgresUploadIntentStore(pool, formUploadQuota),
  definitions: createPostgresContentDefinitionStore(pool),
  inventory: createPostgresUploadLegacyInventoryStore(pool),
  profile: 'postgres',
  explain: (projectId) =>
    harness.query(
      `EXPLAIN (ANALYZE, FORMAT JSON, TIMING OFF) ${pgLegacyInventorySql}`,
      [projectId, '00000000-0000-0000-0000-000000000000', 21],
    ),
}));
uploadOrphanContract(() => ({
  harness,
  uploads: createPostgresUploadIntentStore(pool, formUploadQuota),
  definitions: createPostgresContentDefinitionStore(pool),
}));
uploadScanContract(() => ({
  harness,
  store: createPostgresUploadIntentStore(pool, uploadTestQuota),
}));
uploadIntentContract(() => ({
  harness,
  store: createPostgresUploadIntentStore(pool, uploadTestQuota),
}));
uploadMultipartContract(() => ({
  harness,
  store: createPostgresUploadIntentStore(pool, multipartTestQuota),
}));
let harness: RepositoryHarness;
actualR2LegacyRecoveryLedgerContract(
  () => ({
    harness,
    inventory: createPostgresUploadLegacyInventoryStore(pool),
    store: createPostgresUploadLegacyRecoveryStore(pool),
  }),
  'postgres',
);
uploadLegacyRecoveryContract(() => ({
  harness,
  inventory: createPostgresUploadLegacyInventoryStore(pool),
  store: createPostgresUploadLegacyRecoveryStore(pool),
}));
it('legacy recovery PostgreSQL reference guard observes a decision committed after its insert began waiting on the project lock', async () => {
  const f = await seedLegacyRecoveryFixture(
    harness,
    createPostgresUploadLegacyInventoryStore(pool),
    'finalized',
  );
  const gate = await pool.connect(),
    writer = await pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await gate.query('BEGIN');
    await gate.query('SELECT id FROM projects WHERE id = $1 FOR UPDATE', [
      f.claim.projectId,
    ]);
    const pid = Number(
      (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,
    );
    pending = writer.query(
      "INSERT INTO attachments (id,project_id,upload_intent_id,issue_id,object_key,object_version,checksum,media_type,size_bytes,created_at) VALUES ($1,$2,$3,$4,$5,'historical-version','historical-checksum','text/plain',3,$6)",
      [
        crypto.randomUUID(),
        f.claim.projectId,
        f.claim.id,
        f.issueId,
        f.absence.key,
        f.claim.now,
      ],
    );
    const denied = expect(pending).rejects.toMatchObject({ code: '23514' });
    await vi.waitFor(async () => {
      expect(
        (
          await pool.query(
            'SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1',
            [pid],
          )
        ).rows[0]?.wait_event_type,
      ).toBe('Lock');
    });
    await gate.query(
      "INSERT INTO upload_legacy_recoveries (intent_id,project_id,principal_id,decision_id,decision,state,lease_id,lease_expires_at,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,'deleting',$6,$7,$8)",
      [
        f.claim.id,
        f.claim.projectId,
        f.claim.principalId,
        f.claim.decision.decisionId,
        JSON.stringify(f.claim.decision),
        f.claim.leaseId,
        f.claim.leaseExpiresAt,
        f.claim.now,
      ],
    );
    await gate.query('COMMIT');
    await denied;
    expect(
      (await createPostgresUploadLegacyRecoveryStore(pool).get(f.claim))?.state,
    ).toBe('deleting');
    expect(await f.counters()).toEqual([
      [5, 10, 2],
      [5, 10, 2],
    ]);
  } finally {
    await gate.query('ROLLBACK');
    await pending?.catch(() => {});
    writer.release();
    gate.release();
  }
});
let verifyInstanceRoleUpgrade: () => Promise<void>;
let verifyTokenAssuranceUpgrade: () => Promise<void>;
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
  for (const migration of migrations.slice(1)) {
    if (migration.name === '0023_instance_roles')
      verifyInstanceRoleUpgrade = await seedInstanceRoleUpgrade(harness);
    if (migration.name === '0024_token_assurance')
      verifyTokenAssuranceUpgrade = await seedTokenAssuranceUpgrade(harness);
    if (migration.name === '0018_template_versions')
      verifyTemplateUpgrade = await seedTemplateUpgrade(harness);
    if (migration.name === '0019_upload_reservations')
      verifyUploadUpgrade = await seedUploadUpgrade(harness);
    if (migration.name === '0021_upload_scans')
      verifyScanUpgrade = await seedScanUpgrade(harness);
    if (migration.name === '0022_upload_legacy_recovery')
      verifyLegacyRecoveryUpgrade =
        await snapshotLegacyRecoveryUpgrade(harness);
    await apply(migration.statements);
    if (migration.name === '0023_instance_roles')
      await verifyInstanceRoleUpgrade();
  }
});
afterAll(async () => {
  await pool?.end();
});
repositoryContract(() => harness);
contentDefinitionContract(
  () => ({ harness, store: createPostgresContentDefinitionStore(pool) }),
  'postgres',
);
formSubmissionContract(() => ({
  harness,
  store: createPostgresContentDefinitionStore(pool),
  uploads: createPostgresUploadIntentStore(pool, {
    maxFileBytes: 4,
    projectBytes: 100,
    principalBytes: 100,
    projectPending: 40,
    principalPending: 40,
  }),
}));
contentProjectionContract(() => ({
  harness,
  projections: createPostgresContentProjectionStore(pool),
  comments: createPostgresCommentStore(pool),
}));
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

it('rehashes a superseded credential at login with the real Node provider', async () => {
  const deployment = loadDeploymentConfig({}, 'node');
  const observation = await observeStandardPasswordRehash({
    store: createPostgresAccountRegistrationStore(pool),
    initialService: createNodeStandardPasswordService(
      deployment,
      {
        current: rehashInitialParameters,
        maximum: rehashInitialParameters,
      },
      1,
      rehashInitialParameters.memoryKiB,
    ),
    supersededService: createNodeStandardPasswordService(
      deployment,
      {
        current: rehashSupersededParameters,
        maximum: rehashSupersededParameters,
      },
      1,
      rehashSupersededParameters.memoryKiB,
    ),
    password: 'test password',
    nowMs: 1789900800000,
  });
  expect(observation).toEqual(expectedStandardPasswordRehashObservation());
}, 30000);

it('uses the Node root private key and PostgreSQL counter together', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-abuse-pg-'));
  const keyFile = join(directory, 'abuse.json');
  let configured: ReturnType<typeof configureNodeAbuseAdmission> | undefined;
  try {
    await writeFile(keyFile, abuseKeyFixture(), { mode: 0o600 });
    configured = configureNodeAbuseAdmission(
      { ...postgresNodeBindings(), keyFile },
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
  const configured = configureNodeAbuseAdmission(
    {
      ...postgresNodeBindings(),
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

it('snapshots legacy templates at their known revision with no invented history', async () => {
  await verifyTemplateUpgrade();
});
it('upgrades 0000 with linked aggregates and receipts intact', async () => {
  await verifyUpgrade();
});
it('migrates a fresh database and protects history from truncation', async () => {
  await pool.query('CREATE DATABASE hyperbug_fresh');
  const fresh = new Pool({ database: 'hyperbug_fresh' });
  try {
    expect((await migratePostgres(fresh)).pending).toHaveLength(25);
    expect((await migratePostgres(fresh, true)).applied).toHaveLength(25);
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
    ).toBe(49);
    await expect(
      fresh.query('TRUNCATE upload_legacy_recoveries'),
    ).rejects.toThrow('Retain legacy cleanup target');
    await expect(fresh.query('TRUNCATE audit_events')).rejects.toThrow(
      'append-only',
    );
    await expect(
      fresh.query('TRUNCATE issue_template_versions'),
    ).rejects.toThrow('append-only');
    await expect(fresh.query('TRUNCATE form_submissions')).rejects.toThrow(
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

auditRepositoryContract(() => ({
  repository: createPostgresAuditRepository(pool),
  query: harness.query,
}));
it('uses indexed bounded audit pages against 4000 events', async () => {
  await measureAuditQueries(
    { repository: createPostgresAuditRepository(pool), query: harness.query },
    'postgres',
  );
}, 30000);

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

it('preserves historical upload quota accounting through the additive migration', async () => {
  await verifyUploadUpgrade();
});

it('scan migration quarantines unsupported legacy clean claims without changing immutable identity or used quota', async () => {
  await verifyScanUpgrade();
});

it('legacy recovery migration preserves populated identities, links, lifecycle and accounting without implicit decisions', async () => {
  await verifyLegacyRecoveryUpgrade();
});

it('backfills pre-existing session, code and token assurance without upgrading it', async () => {
  await verifyTokenAssuranceUpgrade();
});
