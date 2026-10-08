import {
  searchStoreContract,
  searchParserContract,
} from '../fixtures/search-contract.ts';
import type { SearchStore } from '@hyperbug/application';
let searchStore: SearchStore;
let parseSearch: Parameters<typeof searchParserContract>[0];
searchStoreContract(() => ({ harness, store: searchStore, measuredQueries }));
searchParserContract((source, principalId) => parseSearch(source, principalId));
import { expiredCleanupContract } from '../fixtures/expired-cleanup-contract.ts';
import { createD1ExpiredCleanupStore } from '@hyperbug/database-d1';
import { uploadScanContract } from '../fixtures/upload-scan-contract.ts';
import { uploadOrphanContract } from '../fixtures/upload-orphan-contract.ts';
import { uploadLegacyInventoryContract } from '../fixtures/upload-legacy-inventory-contract.ts';
import {
  uploadLegacyRecoveryContract,
  seedLegacyRecoveryFixture,
  actualR2LegacyRecoveryLedgerContract,
} from '../fixtures/upload-legacy-recovery-contract.ts';
import { createD1UploadLegacyRecoveryStore } from '@hyperbug/database-d1';
import { createD1UploadLegacyInventoryStore } from '@hyperbug/database-d1';
import { uploadLegacyInventorySql as d1LegacyInventorySql } from '../../packages/database/d1/src/upload-legacy-inventory.ts';
import { validateIssueFormAnswers } from '@hyperbug/application';
import {
  uploadMultipartContract,
  multipartTestQuota,
} from '../fixtures/upload-multipart-contract.ts';
import {
  formSubmissionContract,
  seedFormSubmissionFixture,
  seedFormUpload,
  formUploadQuota,
} from '../fixtures/form-submission-contract.ts';
import { contentProjectionContract } from '../fixtures/content-projection-contract.ts';
import { contentDefinitionContract } from '../fixtures/content-definition-contract.ts';
import {
  uploadIntentContract,
  uploadTestQuota,
} from '../fixtures/upload-intent-contract.ts';
import { createD1UploadIntentStore } from '@hyperbug/database-d1';
import {
  createD1ContentProjectionStore,
  createD1CommentStore,
  createD1ContentDefinitionStore,
} from '@hyperbug/database-d1';
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
import type { AuditRepository } from '../../packages/security/src/index.ts';
let registry: KeyRegistry;
let audit: AuditRepository;
let rateCounters: RateCounterStore;
let accountLockouts: AccountLockoutStore;
let runtimeDigest: () => Promise<unknown>;
let verifyUpgrade: () => Promise<void>;
let verifyTemplateUpgrade: () => Promise<void>;
let verifyUploadUpgrade: () => Promise<void>;
let verifyScanUpgrade: () => Promise<void>;
let verifyLegacyRecoveryUpgrade: () => Promise<void>;
let mf: Miniflare;
let harness: RepositoryHarness;
let measuredQueries: () => string[];
let registrationDb: D1Database;
actualR2LegacyRecoveryLedgerContract(
  () => ({
    harness,
    inventory: createD1UploadLegacyInventoryStore(registrationDb),
    store: createD1UploadLegacyRecoveryStore(registrationDb),
  }),
  'd1',
);
uploadLegacyRecoveryContract(() => ({
  harness,
  inventory: createD1UploadLegacyInventoryStore(registrationDb),
  store: createD1UploadLegacyRecoveryStore(registrationDb),
}));
it('legacy recovery D1 claim rechecks a link arriving after its pre-read before the atomic batch', async () => {
  const f = await seedLegacyRecoveryFixture(
    harness,
    createD1UploadLegacyInventoryStore(registrationDb),
    'finalized',
  );
  let raced = false;
  const database = new Proxy(registrationDb, {
    get(target, property) {
      if (property === 'batch')
        return async (statements: Parameters<D1Database['batch']>[0]) => {
          if (!raced) {
            raced = true;
            await f.link();
          }
          return target.batch(statements);
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await expect(
    createD1UploadLegacyRecoveryStore(database).claim(f.claim),
  ).rejects.toThrow();
  expect(
    await createD1UploadLegacyRecoveryStore(registrationDb).get(f.claim),
  ).toBeNull();
  expect(await f.counters()).toEqual([
    [5, 10, 2],
    [5, 10, 2],
  ]);
});
uploadLegacyInventoryContract(() => ({
  harness,
  uploads: createD1UploadIntentStore(registrationDb, formUploadQuota),
  definitions: createD1ContentDefinitionStore(registrationDb),
  inventory: createD1UploadLegacyInventoryStore(registrationDb),
  profile: 'd1',
  explain: (projectId) =>
    harness.query(`EXPLAIN QUERY PLAN ${d1LegacyInventorySql}`, [
      projectId,
      '00000000-0000-0000-0000-000000000000',
      21,
    ]),
}));
uploadOrphanContract(() => ({
  harness,
  uploads: createD1UploadIntentStore(registrationDb, formUploadQuota),
  definitions: createD1ContentDefinitionStore(registrationDb),
}));
it.each(['link', 'scan'] as const)(
  'orphan D1 claim rechecks %s changes after its pre-read before the CAS batch',
  async (action) => {
    const definitions = createD1ContentDefinitionStore(registrationDb),
      store = createD1UploadIntentStore(registrationDb, formUploadQuota);
    const f = await seedFormSubmissionFixture(harness, definitions),
      upload = await seedFormUpload(
        store,
        f,
        action === 'scan' ? { mode: 'unscanned' } : {},
      );
    const now = upload.expiresAt + 600000,
      lease = {
        ...upload,
        now,
        retainAfterExpiryMs: 600000,
        leaseId: crypto.randomUUID(),
        leaseExpiresAt: now + 1000,
      };
    let changed = false;
    const raced = new Proxy(registrationDb, {
      get(target, property) {
        if (property === 'batch')
          return async (statements: Parameters<D1Database['batch']>[0]) => {
            if (!changed) {
              changed = true;
              if (action === 'scan')
                await store.mutateScan({
                  ...lease,
                  leaseId: crypto.randomUUID(),
                  kind: 'claim',
                  policyVersion: 'orphan-race-policy',
                });
              else {
                const values = {
                  details: 'Retained race content',
                  files: [upload.id],
                };
                await f.harness.repository.createIssue({
                  ...f.intent(),
                  body: validateIssueFormAnswers(f.definition, values).markdown,
                  formSubmission: {
                    formId: f.formId,
                    formVersion: 1,
                    draftId: upload.association.draftId,
                    values,
                  },
                });
              }
            }
            return target.batch(statements);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(
      createD1UploadIntentStore(raced, formUploadQuota).claimOrphanCleanup(
        lease,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    const after = (await store.get(upload))!;
    expect(after.policyState).toBe(action === 'scan' ? 'quarantined' : 'ready');
    expect(after.reservationState).toBe('used');
    expect(after.leaseId).not.toBe(lease.leaseId);
    expect(
      Number(
        (
          await harness.query(
            'SELECT used_bytes FROM project_upload_usage WHERE project_id = ?',
            [f.projectId],
          )
        )[0]!.used_bytes,
      ),
    ).toBe(3);
  },
);
uploadScanContract(() => ({
  harness,
  store: createD1UploadIntentStore(registrationDb, uploadTestQuota),
}));
it('rolls back scan result and intent revision after authorization changes before the D1 batch', async () => {
  const now = Date.now(),
    projectId = crypto.randomUUID(),
    principalId = crypto.randomUUID(),
    id = crypto.randomUUID();
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, `scan-guard-${projectId}`, 'Scan guard', now, now],
  );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Scan guard', ?)",
    [principalId, now],
  );
  const input = {
    id,
    projectId,
    principalId,
    now,
    expiresAt: now + 60000,
    stagingKey: `staging/${id.replaceAll('-', '').repeat(2)}`,
    finalKey: `objects/${id.replaceAll('-', '').repeat(2)}`,
    filename: 'fixture.bin',
    contentType: 'application/octet-stream',
    maxBytes: 4,
    association: { kind: 'issue-draft' as const, draftId: crypto.randomUUID() },
  };
  const store = createD1UploadIntentStore(registrationDb, uploadTestQuota),
    token = {
      ...input,
      leaseId: crypto.randomUUID(),
      leaseExpiresAt: now + 1000,
    };
  await store.reserve(input);
  await store.requestFinalize(input, now);
  await store.claim(token);
  await store.commitVerified({
    ...token,
    verified: {
      key: input.finalKey,
      size: 3,
      sha256: 'a'.repeat(64),
      contentType: input.contentType,
      providerVersion: null,
      scanStatus: 'unscanned',
    },
  });
  token.leaseId = crypto.randomUUID();
  const before = await store.mutateScan({
    ...token,
    kind: 'claim',
    policyVersion: 'attachment-scan-1',
  });
  const raced = new Proxy(registrationDb, {
    get(target, property) {
      if (property === 'batch')
        return async (statements: Parameters<D1Database['batch']>[0]) => {
          await harness.query(
            "UPDATE projects SET visibility = 'private' WHERE id = ?",
            [projectId],
          );
          return target.batch(statements);
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await expect(
    createD1UploadIntentStore(raced, uploadTestQuota).mutateScan({
      ...token,
      kind: 'commit',
      outcome: {
        status: 'clean',
        evidence: {
          engine: 'synthetic-test-scanner',
          engineVersion: 'fixture-1',
          signatureVersion: 'fixture-1',
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  expect(await store.get(input)).toEqual(before);
});
uploadIntentContract(() => ({
  harness,
  store: createD1UploadIntentStore(registrationDb, uploadTestQuota),
}));
uploadMultipartContract(() => ({
  harness,
  store: createD1UploadIntentStore(registrationDb, multipartTestQuota),
}));
it('rolls back multipart catalog, intent and lease when authorization changes before the D1 batch', async () => {
  const now = Date.now(),
    projectId = crypto.randomUUID(),
    principalId = crypto.randomUUID();
  await harness.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [projectId, `mp-guard-${projectId}`, 'Guard', now, now],
  );
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Guard', ?)",
    [principalId, now],
  );
  const id = crypto.randomUUID();
  const input = {
    id,
    projectId,
    principalId,
    now,
    expiresAt: now + 60000,
    stagingKey: `staging/${id.replaceAll('-', '').repeat(2)}`,
    finalKey: `objects/${id.replaceAll('-', '').repeat(2)}`,
    filename: 'fixture.bin',
    contentType: 'application/octet-stream',
    maxBytes: 8 * 1024 ** 2,
    association: { kind: 'issue-draft' as const, draftId: crypto.randomUUID() },
    multipartPlan: { partBytes: 5 * 1024 ** 2, maxParts: 2 },
  };
  const store = createD1UploadIntentStore(registrationDb, multipartTestQuota);
  await store.reserve(input);
  const token = {
    ...input,
    leaseId: crypto.randomUUID(),
    leaseExpiresAt: now + 1000,
  };
  await store.mutateMultipart({ ...token, kind: 'claim-create' });
  const before = await store.mutateMultipart({
    ...token,
    kind: 'created',
    uploadId: 'private-guard-session',
  });
  const racedDb = new Proxy(registrationDb, {
    get(target, property) {
      if (property === 'batch')
        return async (statements: Parameters<D1Database['batch']>[0]) => {
          await harness.query(
            "UPDATE principals SET status = 'suspended' WHERE id = ?",
            [principalId],
          );
          return target.batch(statements);
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  await expect(
    createD1UploadIntentStore(racedDb, multipartTestQuota).mutateMultipart({
      ...input,
      now,
      kind: 'part',
      expectedRevision: before.multipart!.revision,
      part: { partNumber: 1, etag: 'guard-part', sizeBytes: 1 },
    }),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  expect(await store.get(input)).toEqual(before);
});
it.each(['reservation', 'verification'])(
  'rolls back upload %s accounting after permission changes between precheck and D1 batch',
  async (phase) => {
    const now = Date.now(),
      projectId = crypto.randomUUID(),
      principalId = crypto.randomUUID(),
      id = crypto.randomUUID();
    await harness.query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [projectId, `guard-${projectId}`, 'Guard', now, now],
    );
    await harness.query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Guard', ?)",
      [principalId, now],
    );
    const reserved = {
      id,
      projectId,
      principalId,
      stagingKey: `staging/${id.replaceAll('-', '').repeat(2)}`,
      finalKey: `objects/${id.replaceAll('-', '').repeat(2)}`,
      filename: 'fixture.bin',
      contentType: 'application/octet-stream',
      maxBytes: 4,
      association: {
        kind: 'issue-draft' as const,
        draftId: crypto.randomUUID(),
      },
      now,
      expiresAt: now + 60000,
    };
    const store = createD1UploadIntentStore(registrationDb, uploadTestQuota);
    const lease = {
      ...reserved,
      leaseId: crypto.randomUUID(),
      leaseExpiresAt: now + 1000,
    };
    if (phase === 'verification') {
      await store.reserve(reserved);
      await store.requestFinalize(reserved, now);
      await store.claim(lease);
    }
    const racedDb = new Proxy(registrationDb, {
      get(target, property) {
        if (property === 'batch')
          return async (statements: Parameters<D1Database['batch']>[0]) => {
            await harness.query(
              "UPDATE projects SET visibility = 'private' WHERE id = ?",
              [projectId],
            );
            return target.batch(statements);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const raced = createD1UploadIntentStore(racedDb, uploadTestQuota);
    const mutation =
      phase === 'reservation'
        ? raced.reserve(reserved)
        : raced.commitVerified({
            ...lease,
            verified: {
              key: reserved.finalKey,
              size: 3,
              sha256: 'a'.repeat(64),
              contentType: reserved.contentType,
              providerVersion: null,
              scanStatus: 'unscanned',
            },
          });
    await expect(mutation).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
    const counts = await harness.query(
      'SELECT reserved_bytes, used_bytes, reserved_count FROM project_upload_usage WHERE project_id = ?',
      [projectId],
    );
    expect(counts).toEqual(
      phase === 'reservation'
        ? []
        : [{ reserved_bytes: 4, used_bytes: 0, reserved_count: 1 }],
    );
    expect((await store.get(reserved))?.state ?? null).toBe(
      phase === 'reservation' ? null : 'uploaded',
    );
  },
);

let verifyInstanceRoleUpgrade: () => Promise<void>;
let verifyTokenAssuranceUpgrade: () => Promise<void>;
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
      | 'searchIssues'
      | 'parseSearch'
      | 'auditAppend'
      | 'auditList'
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
      | 'lockoutPurge'
      | 'mutateIssue'
      | 'issueVisible'
      | 'relations',
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
  parseSearch = (source, principalId) =>
    call('parseSearch', { source, principalId });
  searchStore = {
    search: async (query) => {
      const result = await call<
        Omit<Awaited<ReturnType<SearchStore['search']>>, 'relations'> & {
          relations: {
            labels: [string, string[]][];
            assignees: [string, string[]][];
          };
        }
      >('searchIssues', query);
      return {
        ...result,
        relations: {
          labels: new Map(result.relations.labels),
          assignees: new Map(result.relations.assignees),
        },
      };
    },
  };
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
  audit = {
    async append(input, signal) {
      signal.throwIfAborted();
      await call('auditAppend', input);
    },
    async list(input, signal) {
      signal.throwIfAborted();
      return call('auditList', input);
    },
  };
  runtimeDigest = () => call('rateDigestProof', null);
  const repository: IssueRepository = {
    createIssue: (input) => call('createIssue', input),
    editIssue: (input) => call('editIssue', input),
    closeIssue: (input) =>
      call('mutateIssue', { operation: 'close', intent: input }),
    reopenIssue: (input) =>
      call('mutateIssue', { operation: 'reopen', intent: input }),
    setIssueLabels: (input) =>
      call('mutateIssue', { operation: 'labels', intent: input }),
    setIssueAssignees: (input) =>
      call('mutateIssue', { operation: 'assignees', intent: input }),
    setIssueType: (input) =>
      call('mutateIssue', { operation: 'type', intent: input }),
    setIssueMilestone: (input) =>
      call('mutateIssue', { operation: 'milestone', intent: input }),
    getIssue: (projectId, id, options) =>
      call('getIssue', { projectId, id, options }),
    issueVisible: (projectId, id, options) =>
      call('issueVisible', { projectId, id, options }),
    listIssues: (input) => call('listIssues', input),
    relations: (projectId, issueIds) =>
      call('relations', { projectId, issueIds: [...issueIds] }),
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
  for (const migration of migrations.slice(1)) {
    if (migration.name === '0024_instance_roles')
      verifyInstanceRoleUpgrade = await seedInstanceRoleUpgrade(harness);
    if (migration.name === '0025_token_assurance')
      verifyTokenAssuranceUpgrade = await seedTokenAssuranceUpgrade(harness);
    if (migration.name === '0019_template_versions')
      verifyTemplateUpgrade = await seedTemplateUpgrade(harness);
    if (migration.name === '0020_upload_reservations')
      verifyUploadUpgrade = await seedUploadUpgrade(harness);
    if (migration.name === '0022_upload_scans')
      verifyScanUpgrade = await seedScanUpgrade(harness);
    if (migration.name === '0023_upload_legacy_recovery')
      verifyLegacyRecoveryUpgrade =
        await snapshotLegacyRecoveryUpgrade(harness);
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    if (migration.name === '0024_instance_roles')
      await verifyInstanceRoleUpgrade();
  }
});
afterAll(async () => {
  await mf?.dispose();
});
repositoryContract(() => harness);
contentDefinitionContract(
  () => ({ harness, store: createD1ContentDefinitionStore(registrationDb) }),
  'd1',
);
it.each(['form', 'principal', 'default'] as const)(
  'rolls back a D1 form submission when %s changes after its pre-read',
  async (mode) => {
    const store = createD1ContentDefinitionStore(registrationDb);
    const fixture = await seedFormSubmissionFixture(harness, store);
    const request = fixture.intent();
    let definition = fixture.definition;
    if (mode === 'default') {
      await harness.query(
        "INSERT INTO labels (id, project_id, name, name_key) VALUES (?, ?, 'Bug', 'bug')",
        [crypto.randomUUID(), fixture.projectId],
      );
      definition = { ...definition, labels: ['bug'] };
      await store.saveForm({
        id: fixture.formId,
        projectId: fixture.projectId,
        expectedRevision: 1,
        enabled: true,
        now: request.now,
        definition,
      });
      request.formSubmission = { ...request.formSubmission!, formVersion: 2 };
    }
    let changed = false;
    const raced = new Proxy(registrationDb, {
      get(target, property) {
        if (property === 'batch')
          return async (statements: Parameters<D1Database['batch']>[0]) => {
            if (!changed) {
              changed = true;
              if (mode === 'form')
                await store.saveForm({
                  id: fixture.formId,
                  projectId: fixture.projectId,
                  expectedRevision: 1,
                  enabled: false,
                  now: request.now + 1,
                  definition,
                });
              else if (mode === 'principal')
                await harness.query(
                  "UPDATE principals SET status = 'suspended' WHERE id = ?",
                  [fixture.principalId],
                );
              else
                await harness.query(
                  "UPDATE labels SET name_key = 'renamed' WHERE project_id = ?",
                  [fixture.projectId],
                );
            }
            return target.batch(statements);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(
      createD1Repository(raced).createIssue(request),
    ).rejects.toMatchObject({
      code:
        mode === 'form'
          ? 'FORM_VERSION_STALE'
          : mode === 'principal'
            ? 'FORM_SUBMISSION_FORBIDDEN'
            : 'FORM_DEFAULTS_INVALID',
    });
    expect(changed).toBe(true);
    for (const table of [
      'issues',
      'form_submissions',
      'timeline_events',
      'outbox',
      'mutation_receipts',
    ])
      expect(
        Number(
          (
            await harness.query(
              `SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`,
              [fixture.projectId],
            )
          )[0]!.count,
        ),
      ).toBe(0);
    expect(
      Number(
        (
          await harness.query(
            'SELECT next_issue_number FROM projects WHERE id = ?',
            [fixture.projectId],
          )
        )[0]!.next_issue_number,
      ),
    ).toBe(1);
  },
);
formSubmissionContract(() => ({
  harness,
  store: createD1ContentDefinitionStore(registrationDb),
  uploads: createD1UploadIntentStore(registrationDb, {
    maxFileBytes: 4,
    projectBytes: 100,
    principalBytes: 100,
    projectPending: 40,
    principalPending: 40,
  }),
}));
it.each(['principal', 'draft', 'rescan', 'result'] as const)(
  'rolls back D1 form attachment consumption after a %s change before the batch',
  async (mode) => {
    const fixture = await seedFormSubmissionFixture(
      harness,
      createD1ContentDefinitionStore(registrationDb),
    );
    const uploads = createD1UploadIntentStore(registrationDb, formUploadQuota);
    const input = await seedFormUpload(uploads, fixture);
    const values = { details: 'Canonical **answers**', files: [input.id] };
    const request = {
      ...fixture.intent(),
      body: validateIssueFormAnswers(fixture.definition, values).markdown,
      formSubmission: {
        formId: fixture.formId,
        formVersion: 1,
        values,
        draftId: input.association.draftId,
      },
    };
    let changed = false;
    const raced = new Proxy(registrationDb, {
      get(target, property) {
        if (property === 'batch')
          return async (statements: Parameters<D1Database['batch']>[0]) => {
            if (!changed) {
              changed = true;
              if (mode === 'principal')
                await harness.query(
                  "UPDATE principals SET status = 'suspended' WHERE id = ?",
                  [fixture.principalId],
                );
              else if (mode === 'draft')
                await harness.query(
                  'UPDATE upload_intent_details SET draft_id = ? WHERE intent_id = ?',
                  [crypto.randomUUID(), input.id],
                );
              else if (mode === 'rescan')
                await uploads.mutateScan({
                  ...input,
                  leaseId: crypto.randomUUID(),
                  leaseExpiresAt: input.now + 1000,
                  kind: 'claim',
                  policyVersion: 'next-scan-policy',
                });
              else {
                await harness.query(
                  "UPDATE upload_intent_details SET policy_state = 'quarantined' WHERE intent_id = ?",
                  [input.id],
                );
                await harness.query(
                  "UPDATE upload_scan_results SET policy_version = 'obsolete' WHERE intent_id = ?",
                  [input.id],
                );
                await harness.query(
                  "UPDATE upload_intent_details SET policy_state = 'ready' WHERE intent_id = ?",
                  [input.id],
                );
              }
            }
            return target.batch(statements);
          };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(
      createD1Repository(raced).createIssue(request),
    ).rejects.toMatchObject({
      code:
        mode === 'principal'
          ? 'FORM_SUBMISSION_FORBIDDEN'
          : 'FORM_ATTACHMENTS_INVALID',
    });
    expect(changed).toBe(true);
    for (const table of [
      'issues',
      'form_submissions',
      'attachments',
      'timeline_events',
      'outbox',
      'mutation_receipts',
    ])
      expect(
        Number(
          (
            await harness.query(
              `SELECT COUNT(*) AS count FROM ${table} WHERE project_id = ?`,
              [fixture.projectId],
            )
          )[0]!.count,
        ),
      ).toBe(0);
    expect(
      Number(
        (
          await harness.query(
            'SELECT next_issue_number FROM projects WHERE id = ?',
            [fixture.projectId],
          )
        )[0]!.next_issue_number,
      ),
    ).toBe(1);
  },
);
contentProjectionContract(() => ({
  harness,
  projections: createD1ContentProjectionStore(registrationDb),
  comments: createD1CommentStore(registrationDb),
}));
rateCounterContract(() => rateCounters);
auditRepositoryContract(() => ({ repository: audit, query: harness.query }));

it('runs audit authorization/failure/redaction/admission checks inside workerd', async () => {
  const response = await fetch(await mf.ready, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'auditScenarios' }),
  });
  const result = (await response.json()) as { value: Record<string, boolean> };
  expect(Object.keys(result.value).length).toBeGreaterThan(20);
  for (const [name, passed] of Object.entries(result.value))
    expect(passed, name).toBe(true);
});
it('uses indexed bounded audit pages against 4000 events', async () => {
  await measureAuditQueries({ repository: audit, query: harness.query }, 'd1');
}, 30000);

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

it('snapshots legacy templates at their known revision with no invented history', async () => {
  await verifyTemplateUpgrade();
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
  ).toBe(46);
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

expiredCleanupContract(() => ({
  harness,
  store: createD1ExpiredCleanupStore(registrationDb),
}));
