/* eslint-disable no-await-in-loop -- Sequential isolated ledger fixtures and bounded sweeps. */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  createR2LegacyRecoveryProvider,
  type R2SigningConfig,
} from '@hyperbug/blob-r2';
import { r2LegacySnapshotApproval } from './r2-legacy-provider-proof.ts';
import {
  recoverLegacyUpload,
  recoverLegacyUploadPage,
  uploadLegacyRecoveryVersion,
  type UploadLegacyRecoveryStore,
  type UploadLegacyInventoryStore,
  type UploadLegacyRecoveryClaim,
  type UploadLegacyRecoveryAbsence,
  type UploadLegacyCandidate,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';

export async function seedLegacyRecoveryFixture(
  harness: RepositoryHarness,
  inventory: UploadLegacyInventoryStore,
  state: UploadLegacyCandidate['state'] = 'pending',
  ownedObject?: { key: string; version: string; checksum: string },
) {
  const projectId = nextId(),
    principalId = nextId(),
    id = nextId(),
    created = 1791000000000,
    expiresAt = created + 1000,
    now = expiresAt + 300000;
  await harness.query(
    'INSERT INTO projects (id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)',
    [projectId, `legacy-${id}`, 'Legacy recovery', created, created],
  );
  await harness.query(
    "INSERT INTO principals (id,kind,display_name,created_at) VALUES (?,'user','Legacy owner',?)",
    [principalId, created],
  );
  const key = ownedObject?.key ?? `historical prefix/文件 ${id}`;
  await harness.query(
    `INSERT INTO upload_intents (id,project_id,principal_id,object_key,media_type,max_bytes,state,created_at,expires_at${state === 'finalized' ? ',actual_bytes,verified_object_version,verified_checksum' : ''}) VALUES (?,?,?,?,?,?,?, ?, ?${state === 'finalized' ? ',?,?,?' : ''})`,
    [
      id,
      projectId,
      principalId,
      key,
      'text/plain',
      4,
      state,
      created,
      expiresAt,
      ...(state === 'finalized'
        ? [
            3,
            ownedObject?.version ?? 'historical-version',
            ownedObject?.checksum ?? 'historical-checksum',
          ]
        : []),
    ],
  );
  const reservedBytes = state === 'finalized' ? 5 : 9,
    usedBytes = state === 'finalized' ? 10 : 7,
    reservedCount = state === 'finalized' ? 2 : 3;
  for (const [table, column, value] of [
    ['project_upload_usage', 'project_id', projectId],
    ['principal_upload_usage', 'principal_id', principalId],
  ] as const)
    await harness.query(
      `INSERT INTO ${table} (${column},reserved_bytes,used_bytes,reserved_count) VALUES (?,?,?,?)`,
      [value, reservedBytes, usedBytes, reservedCount],
    );
  const snapshot = (await inventory.inspect({ projectId, limit: 20 }))
    .items[0]!;
  const claim: UploadLegacyRecoveryClaim = {
    id,
    projectId,
    principalId,
    now,
    leaseId: nextId(),
    leaseExpiresAt: now + 60000,
    decision: {
      version: uploadLegacyRecoveryVersion,
      decisionId: nextId(),
      snapshot,
      ownershipEvidenceSha256: 'a'.repeat(64),
      accountingEvidenceSha256: 'b'.repeat(64),
      retainAfterExpiryMs: 300000,
    },
  };
  const absence: UploadLegacyRecoveryAbsence = {
    decisionId: claim.decision.decisionId,
    ownershipEvidenceSha256: claim.decision.ownershipEvidenceSha256,
    key,
    remainingObjects: 0,
    remainingUploads: 0,
  };
  const counters = async () => {
    const result = [];
    for (const [table, column, value] of [
      ['project_upload_usage', 'project_id', projectId],
      ['principal_upload_usage', 'principal_id', principalId],
    ] as const) {
      const row = (
        await harness.query(
          `SELECT reserved_bytes,used_bytes,reserved_count FROM ${table} WHERE ${column} = ?`,
          [value],
        )
      )[0]!;
      result.push([
        Number(row.reserved_bytes),
        Number(row.used_bytes),
        Number(row.reserved_count),
      ]);
    }
    return result;
  };
  const issueId = nextId();
  await harness.query(
    "INSERT INTO issues (id,project_id,number,title,body,author_id,created_at,updated_at,last_mutation_id) VALUES (?,?,1,'Legacy parent','',?,?,?,?)",
    [issueId, projectId, principalId, created, created, nextId()],
  );
  const link = () =>
    harness.query(
      "INSERT INTO attachments (id,project_id,upload_intent_id,issue_id,object_key,object_version,checksum,media_type,size_bytes,created_at) VALUES (?,?,?,?,?,'historical-version','historical-checksum','text/plain',3,?)",
      [nextId(), projectId, id, issueId, key, created],
    );
  return { claim, absence, counters, link, issueId, harness };
}

/** Planned 07.3h/V4 actual-provider + atomic dual-ledger composition; opt-in test bucket only. */
export function actualR2LegacyRecoveryLedgerContract(
  get: () => {
    harness: RepositoryHarness;
    inventory: UploadLegacyInventoryStore;
    store: UploadLegacyRecoveryStore;
  },
  profile: 'd1' | 'postgres',
) {
  const configPath = process.env.HYPERBUG_TEST_R2_CONFIG;
  describe.runIf(Boolean(configPath))(
    `actual remote R2 with ${profile} disposable legacy ledger (Node orchestration)`,
    () => {
      it.each(['pending', 'finalized'] as const)(
        'composes owned %s absence, fenced accounting and late resweep without another decrement',
        async (state) => {
          const privateConfig = JSON.parse(
            readFileSync(configPath!, 'utf8'),
          ) as {
            accountId: string;
            bucket: string;
            credentialsFile: string;
          };
          const config: R2SigningConfig = {
            accountId: privateConfig.accountId,
            bucket: privateConfig.bucket,
            credentials: JSON.parse(
              readFileSync(privateConfig.credentialsFile, 'utf8'),
            ),
          };
          const key = `historical prefix/文件 ${crypto.randomUUID()} ?#%+&`,
            sibling = `${key}-preserved`,
            sessions: { key: string; id: string }[] = [];
          const receiptPath = join(
            dirname(configPath!),
            `r2-ledger-${profile}-${state}-owned-receipt.json`,
          );
          const receipt = (cleaned = false) =>
            writeFileSync(
              receiptPath,
              JSON.stringify({
                accountId: config.accountId,
                bucket: config.bucket,
                key,
                sibling,
                sessions,
                cleaned,
              }),
              { mode: 0o600 },
            );
          receipt(); // Retain exact fresh ownership before any remote mutation.
          const client = new S3Client({
            endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
            region: 'auto',
            credentials: config.credentials,
            forcePathStyle: true,
            maxAttempts: 1,
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
          });
          const address = (target: string) => ({
            Bucket: config.bucket,
            Key: target,
          });
          const put = (target: string) =>
            client.send(
              new PutObjectCommand({
                ...address(target),
                Body: 'old',
                ContentType: 'text/plain',
              }),
            );
          const head = async (target: string) => {
            try {
              return await client.send(new HeadObjectCommand(address(target)));
            } catch (error) {
              if (
                (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                  ?.httpStatusCode === 404
              )
                return null;
              throw error;
            }
          };
          const makeSession = async (target: string) => {
            const created = await client.send(
              new CreateMultipartUploadCommand(address(target)),
            );
            if (!created.UploadId)
              throw new Error('Missing owned test session');
            sessions.push({ key: target, id: created.UploadId });
            receipt();
            return created.UploadId;
          };
          const writable = async (target: string, id: string) => {
            try {
              await client.send(
                new UploadPartCommand({
                  ...address(target),
                  UploadId: id,
                  PartNumber: 1,
                  Body: 'x',
                }),
              );
              return true;
            } catch (error) {
              if (error instanceof Error && error.name === 'NoSuchUpload')
                return false;
              throw error;
            }
          };
          let adapter:
            | Awaited<ReturnType<typeof createR2LegacyRecoveryProvider>>
            | undefined;
          let failure: unknown;
          try {
            await put(key);
            await put(sibling);
            const observed = await head(key);
            expect(observed?.ContentLength).toBe(3);
            expect(observed?.ContentType).toBe('text/plain');
            if (!observed?.ETag) throw new Error('Missing owned test identity');
            const deps = get();
            const f = await seedLegacyRecoveryFixture(
              deps.harness,
              deps.inventory,
              state,
              {
                key,
                version: observed.ETag,
                checksum: createHash('sha256').update('old').digest('hex'),
              },
            );
            const approval = await r2LegacySnapshotApproval(
              config,
              f.claim.decision.snapshot,
            );
            const now = Date.now(),
              claim = {
                ...f.claim,
                now,
                leaseExpiresAt: now + 300000,
                decision: approval.decision,
              };
            const retained =
              state === 'pending'
                ? [
                    [9, 7, 3],
                    [9, 7, 3],
                  ]
                : [
                    [5, 10, 2],
                    [5, 10, 2],
                  ];
            expect(await f.counters()).toEqual(retained);
            const base = await deps.harness.query(
              'SELECT * FROM upload_intents WHERE id = ?',
              [claim.id],
            );
            const first = await makeSession(key),
              second = await makeSession(key),
              other = await makeSession(sibling);
            adapter = await createR2LegacyRecoveryProvider(config, approval);
            const provider = adapter.provider;
            const released = await recoverLegacyUpload(
              {
                store: deps.store,
                provider: {
                  async recover(input) {
                    expect(await deps.store.get(claim)).toMatchObject({
                      state: 'deleting',
                      leaseId: claim.leaseId,
                      decision: approval.decision,
                    });
                    expect(await f.counters()).toEqual(retained);
                    await expect(f.link()).rejects.toThrow();
                    const absence = await provider.recover(input);
                    expect(await head(key)).toBeNull();
                    expect(await writable(key, first)).toBe(false);
                    expect(await writable(key, second)).toBe(false);
                    expect(await writable(sibling, other)).toBe(true);
                    await expect(
                      deps.store.release({
                        ...claim,
                        now: Date.now(),
                        leaseId: crypto.randomUUID(),
                        absence,
                      }),
                    ).rejects.toThrow();
                    expect(await f.counters()).toEqual(retained);
                    return absence;
                  },
                },
              },
              claim,
            );
            expect(released).toMatchObject({
              state: 'released',
              leaseId: null,
              decision: approval.decision,
            });
            expect(await f.counters()).toEqual([
              [5, 7, 2],
              [5, 7, 2],
            ]);
            expect(await head(sibling)).not.toBeNull();
            await put(key);
            const late = await makeSession(key);
            const repeatNow = Date.now();
            const repeated = await recoverLegacyUpload(
              { store: deps.store, provider },
              {
                ...claim,
                now: repeatNow,
                leaseId: crypto.randomUUID(),
                leaseExpiresAt: repeatNow + 300000,
              },
            );
            expect(repeated.releasedAt).toBe(released.releasedAt);
            expect(await head(key)).toBeNull();
            expect(await writable(key, late)).toBe(false);
            expect(await writable(sibling, other)).toBe(true);
            expect(await f.counters()).toEqual([
              [5, 7, 2],
              [5, 7, 2],
            ]);
            expect(
              await deps.harness.query(
                'SELECT * FROM upload_intents WHERE id = ?',
                [claim.id],
              ),
            ).toEqual(base);
            expect(
              await deps.harness.query(
                'SELECT * FROM upload_intent_details WHERE intent_id = ?',
                [claim.id],
              ),
            ).toEqual([]);
            await expect(f.link()).rejects.toThrow();
            await expect(
              deps.harness.query(
                'DELETE FROM upload_legacy_recoveries WHERE intent_id = ?',
                [claim.id],
              ),
            ).rejects.toThrow();
          } catch (error) {
            // Assertions are safe; raw SDK errors can contain private signed request details.
            if (error instanceof Error && error.name === 'AssertionError')
              failure = error;
            else
              failure = new Error(
                'Owned R2/legacy-ledger composition failed; inspect the private ownership receipt',
              );
          } finally {
            try {
              for (const session of sessions) {
                try {
                  await client.send(
                    new AbortMultipartUploadCommand({
                      ...address(session.key),
                      UploadId: session.id,
                    }),
                  );
                } catch (error) {
                  if (
                    !(error instanceof Error && error.name === 'NoSuchUpload')
                  )
                    failure ??= new Error('Owned R2 session cleanup failed');
                }
              }
              for (const target of [key, sibling]) {
                await client.send(new DeleteObjectCommand(address(target)));
                expect(await head(target)).toBeNull();
              }
              for (const session of sessions)
                expect(await writable(session.key, session.id)).toBe(false);
              receipt(true);
            } catch {
              failure ??= new Error(
                'Owned R2 fixture cleanup incomplete; retain the private ownership receipt',
              );
            } finally {
              adapter?.close();
              client.destroy();
            }
          }
          if (failure) throw failure;
        },
        90000,
      );
    },
  );
}

export function uploadLegacyRecoveryContract(
  get: () => {
    harness: RepositoryHarness;
    inventory: UploadLegacyInventoryStore;
    store: UploadLegacyRecoveryStore;
  },
) {
  const fixture = (state: UploadLegacyCandidate['state'] = 'pending') =>
    seedLegacyRecoveryFixture(get().harness, get().inventory, state);
  it('legacy recovery rejects a row adopted after inventory and remains independent of User permissions for approved garbage', async () => {
    const f = await fixture(),
      store = get().store;
    await f.harness.query(
      "INSERT INTO upload_intent_details (intent_id,project_id,filename,final_key,association_kind,draft_id) VALUES (?,?,'current.txt',?,'issue-draft',?)",
      [
        f.claim.id,
        f.claim.projectId,
        `objects/${f.claim.id.replaceAll('-', '').repeat(2)}`,
        nextId(),
      ],
    );
    await expect(store.claim(f.claim)).rejects.toThrow();
    expect(await store.get(f.claim)).toBeNull();
    const archived = await fixture();
    await archived.harness.query(
      "UPDATE projects SET status = 'archived' WHERE id = ?",
      [archived.claim.projectId],
    );
    await archived.harness.query(
      "UPDATE principals SET status = 'suspended' WHERE id = ?",
      [archived.claim.principalId],
    );
    await store.claim(archived.claim);
    expect(
      await store.release({ ...archived.claim, absence: archived.absence }),
    ).toMatchObject({ state: 'released' });
    expect(await archived.counters()).toEqual([
      [5, 7, 2],
      [5, 7, 2],
    ]);
  });
  it('legacy recovery rejects missing provenance, malformed closed decisions and premature retention without writes', async () => {
    const f = await fixture(),
      store = get().store;
    for (const decision of [
      { ...f.claim.decision, ownershipEvidenceSha256: '' },
      { ...f.claim.decision, accountingEvidenceSha256: '' },
      { ...f.claim.decision, retainAfterExpiryMs: 299999 },
      {
        ...f.claim.decision,
        snapshot: { ...f.claim.decision.snapshot, hasAttachment: true },
      },
      {
        ...f.claim.decision,
        snapshot: { ...f.claim.decision.snapshot, objectKey: 'x'.repeat(1025) },
      },
      {
        ...f.claim.decision,
        snapshot: {
          ...f.claim.decision.snapshot,
          objectKey: 'legacy\u0000key',
        },
      },
      { ...f.claim.decision, version: 'future' },
      { ...f.claim.decision, untrusted: true },
    ])
      await expect(
        store.claim({
          ...f.claim,
          decision: decision as typeof f.claim.decision,
        }),
      ).rejects.toThrow();
    await expect(
      store.claim({ ...f.claim, now: f.claim.now - 1 }),
    ).rejects.toThrow();
    expect(await store.get(f.claim)).toBeNull();
    expect(await f.counters()).toEqual([
      [9, 7, 3],
      [9, 7, 3],
    ]);
  });
  it('legacy recovery fences exact owner/project/revision/identity snapshot and rolls back zero-row claims', async () => {
    const f = await fixture(),
      store = get().store;
    for (const snapshot of [
      { ...f.claim.decision.snapshot, principalId: nextId() },
      { ...f.claim.decision.snapshot, projectId: nextId() },
      { ...f.claim.decision.snapshot, revision: 2 },
      { ...f.claim.decision.snapshot, objectKey: 'another historical key' },
      { ...f.claim.decision.snapshot, maxBytes: 5 },
      {
        ...f.claim.decision.snapshot,
        expiresAt: f.claim.decision.snapshot.expiresAt - 1,
      },
    ])
      await expect(
        store.claim({
          ...f.claim,
          decision: { ...f.claim.decision, snapshot },
        }),
      ).rejects.toThrow();
    expect(await store.get(f.claim)).toBeNull();
    await store.claim(f.claim);
    expect((await store.get(f.claim))?.decision).toEqual(f.claim.decision);
  });
  it('legacy recovery excludes every linked parent including hidden/deleted content and never fabricates lifecycle details', async () => {
    const f = await fixture('finalized'),
      store = get().store;
    await f.link();
    for (const mode of ['visible', 'hidden', 'deleted']) {
      if (mode !== 'visible')
        await f.harness.query(
          "UPDATE issues SET moderation = 'hidden' WHERE id = ?",
          [f.issueId],
        );
      if (mode === 'deleted')
        await f.harness.query('UPDATE issues SET deleted_at = ? WHERE id = ?', [
          f.claim.now,
          f.issueId,
        ]);
      await expect(store.claim(f.claim)).rejects.toThrow();
    }
    expect(await store.get(f.claim)).toBeNull();
    expect(
      await f.harness.query(
        'SELECT * FROM upload_intent_details WHERE intent_id = ?',
        [f.claim.id],
      ),
    ).toEqual([]);
    expect(await f.counters()).toEqual([
      [5, 10, 2],
      [5, 10, 2],
    ]);
  });
  it('legacy recovery claim prevents identity changes, future links/adoption, decision replacement and tombstone erasure', async () => {
    const f = await fixture('finalized'),
      store = get().store;
    await store.claim(f.claim);
    await expect(f.link()).rejects.toThrow();
    await expect(
      f.harness.query('UPDATE upload_intents SET max_bytes = 5 WHERE id = ?', [
        f.claim.id,
      ]),
    ).rejects.toThrow();
    await expect(
      f.harness.query(
        'UPDATE upload_intents SET revision = revision + 1 WHERE id = ?',
        [f.claim.id],
      ),
    ).rejects.toThrow();
    await expect(
      f.harness.query(
        "INSERT INTO upload_intent_details (intent_id,project_id,filename,final_key,association_kind,draft_id) VALUES (?,?,'fabricated.txt',?,'issue-draft',?)",
        [f.claim.id, f.claim.projectId, `objects/${'0'.repeat(64)}`, nextId()],
      ),
    ).rejects.toThrow();
    await expect(
      f.harness.query(
        'UPDATE upload_legacy_recoveries SET decision_id = ? WHERE intent_id = ?',
        [nextId(), f.claim.id],
      ),
    ).rejects.toThrow();
    await expect(
      f.harness.query(
        'DELETE FROM upload_legacy_recoveries WHERE intent_id = ?',
        [f.claim.id],
      ),
    ).rejects.toThrow();
    await store.release({ ...f.claim, absence: f.absence });
    await expect(f.link()).rejects.toThrow();
    expect((await store.get(f.claim))?.decision.snapshot.objectKey).toBe(
      f.absence.key,
    );
  });
  it('legacy recovery admits one of eight competing leases and cannot replace its immutable approved decision', async () => {
    const f = await fixture(),
      store = get().store;
    const runs = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        store.claim({ ...f.claim, leaseId: nextId() }),
      ),
    );
    expect(runs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    await expect(
      store.claim({
        ...f.claim,
        decision: { ...f.claim.decision, decisionId: nextId() },
      }),
    ).rejects.toThrow();
    expect(await f.counters()).toEqual([
      [9, 7, 3],
      [9, 7, 3],
    ]);
  });
  it('legacy recovery reclaims expired leases while stale proofs cannot clear a newer lease', async () => {
    const f = await fixture(),
      store = get().store;
    await store.claim(f.claim);
    const next = {
      ...f.claim,
      now: f.claim.leaseExpiresAt,
      leaseId: nextId(),
      leaseExpiresAt: f.claim.leaseExpiresAt + 60000,
    };
    await store.claim(next);
    await expect(
      store.release({ ...f.claim, absence: f.absence }),
    ).rejects.toThrow();
    expect((await store.get(f.claim))?.leaseId).toBe(next.leaseId);
    await store.release({ ...next, absence: f.absence });
  });
  it.each(['pending', 'uploaded', 'expired', 'rejected', 'finalized'] as const)(
    'legacy recovery releases %s accounting once with synthetic exact absence, retaining unrelated counters and base identity',
    async (state) => {
      const f = await fixture(state),
        store = get().store;
      const before = await f.harness.query(
        'SELECT * FROM upload_intents WHERE id = ?',
        [f.claim.id],
      );
      await store.claim(f.claim);
      const runs = await Promise.all(
        Array.from({ length: 8 }, () =>
          store.release({ ...f.claim, absence: f.absence }),
        ),
      );
      expect(runs.every((r) => r.state === 'released')).toBe(true);
      expect(await f.counters()).toEqual([
        [5, 7, 2],
        [5, 7, 2],
      ]);
      expect(
        await f.harness.query('SELECT * FROM upload_intents WHERE id = ?', [
          f.claim.id,
        ]),
      ).toEqual(before);
      const sweep = { ...f.claim, leaseId: nextId() };
      await store.claim(sweep);
      await store.release({ ...sweep, absence: f.absence });
      expect(await f.counters()).toEqual([
        [5, 7, 2],
        [5, 7, 2],
      ]);
    },
  );
  it('legacy recovery denies malformed/wrong-key/wrong-decision/truncated physical proofs without releasing quota', async () => {
    const f = await fixture(),
      store = get().store;
    await store.claim(f.claim);
    for (const absence of [
      { ...f.absence, key: 'unrelated' },
      { ...f.absence, decisionId: nextId() },
      { ...f.absence, ownershipEvidenceSha256: 'c'.repeat(64) },
      { ...f.absence, remainingUploads: 1 },
      { ...f.absence, remainingObjects: 1 },
      { ...f.absence, private: 'unexpected' },
    ])
      await expect(
        store.release({ ...f.claim, absence: absence as typeof f.absence }),
      ).rejects.toThrow();
    expect((await store.get(f.claim))?.state).toBe('deleting');
    expect(await f.counters()).toEqual([
      [9, 7, 3],
      [9, 7, 3],
    ]);
  });
  it('legacy recovery rolls back both accounting and retirement when one retained counter is missing or insufficient', async () => {
    for (const mode of ['missing', 'insufficient']) {
      const f = await fixture(),
        store = get().store;
      await store.claim(f.claim);
      if (mode === 'missing')
        await f.harness.query(
          'DELETE FROM principal_upload_usage WHERE principal_id = ?',
          [f.claim.principalId],
        );
      else
        await f.harness.query(
          'UPDATE principal_upload_usage SET reserved_bytes = 1 WHERE principal_id = ?',
          [f.claim.principalId],
        );
      await expect(
        store.release({ ...f.claim, absence: f.absence }),
      ).rejects.toThrow();
      const project = (
        await f.harness.query(
          'SELECT reserved_bytes FROM project_upload_usage WHERE project_id = ?',
          [f.claim.projectId],
        )
      )[0]!;
      expect(Number(project.reserved_bytes)).toBe(9);
      expect(await store.get(f.claim)).toMatchObject({
        state: 'deleting',
        leaseId: f.claim.leaseId,
        releasedAt: null,
      });
    }
  });
  it('legacy recovery keeps quota on synthetic provider failure/timeout and discards late absence without another mutation', async () => {
    const f = await fixture(),
      store = get().store;
    await expect(
      recoverLegacyUpload(
        {
          store,
          provider: {
            recover: async () => {
              throw new Error('private-provider-detail');
            },
          },
        },
        f.claim,
        () => f.claim.now,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    let complete!: (proof: UploadLegacyRecoveryAbsence) => void;
    let signal!: AbortSignal;
    const timeout = { ...f.claim, leaseExpiresAt: f.claim.now + 100 };
    await expect(
      recoverLegacyUpload(
        {
          store,
          provider: {
            recover: (input) => {
              signal = input.signal;
              return new Promise((resolve) => {
                complete = resolve;
              });
            },
          },
        },
        timeout,
        () => f.claim.now,
      ),
    ).rejects.toThrow();
    expect(signal.aborted).toBe(true);
    complete(f.absence);
    await Promise.resolve();
    expect((await store.get(f.claim))?.state).toBe('deleting');
    expect(await f.counters()).toEqual([
      [9, 7, 3],
      [9, 7, 3],
    ]);
  });
  it('legacy recovery selects bounded approved targets and resumes held/released sweeps without consuming unapproved inventory', async () => {
    const f = await fixture(),
      store = get().store,
      now = f.claim.now + 60000;
    await store.claim(f.claim);
    expect(
      await store.select({
        projectId: f.claim.projectId,
        now: f.claim.now,
        limit: 20,
      }),
    ).toEqual({ items: [], next: null });
    for (const limit of [0, 21, 1.5])
      await expect(
        store.select({ projectId: f.claim.projectId, now, limit }),
      ).rejects.toThrow();
    const first = await recoverLegacyUploadPage(
      {
        store,
        provider: {
          recover: async () => {
            throw new Error('held');
          },
        },
      },
      { projectId: f.claim.projectId, now, limit: 20 },
      () => now,
    );
    expect(first.results).toEqual([{ id: f.claim.id, outcome: 'held' }]);
    const retried = await recoverLegacyUploadPage(
      { store, provider: { recover: async () => f.absence } },
      { projectId: f.claim.projectId, now: now + 300000, limit: 20 },
      () => now + 300000,
    );
    expect(retried.results).toEqual([{ id: f.claim.id, outcome: 'released' }]);
    expect(
      (
        await store.select({
          projectId: f.claim.projectId,
          now: now + 300000,
          limit: 20,
        })
      ).items,
    ).toHaveLength(1);
    expect(await store.select({ projectId: nextId(), now, limit: 20 })).toEqual(
      { items: [], next: null },
    );
  });
  it('legacy recovery limits approved target pages to twenty with one look-ahead and an exact continuation', async () => {
    const f = await fixture(),
      store = get().store;
    await store.claim(f.claim);
    const ids = [f.claim.id];
    for (let index = 0; index < 20; index++) {
      const id = nextId(),
        objectKey = `historical page/${id}`;
      await f.harness.query(
        "INSERT INTO upload_intents (id,project_id,principal_id,object_key,media_type,max_bytes,state,created_at,expires_at) VALUES (?,?,?,?,'text/plain',4,'pending',?,?)",
        [
          id,
          f.claim.projectId,
          f.claim.principalId,
          objectKey,
          f.claim.decision.snapshot.createdAt,
          f.claim.decision.snapshot.expiresAt,
        ],
      );
      const decision = {
        ...f.claim.decision,
        decisionId: nextId(),
        snapshot: { ...f.claim.decision.snapshot, id, objectKey },
      };
      await store.claim({ ...f.claim, id, decision, leaseId: nextId() });
      ids.push(id);
    }
    const query = {
      projectId: f.claim.projectId,
      now: f.claim.leaseExpiresAt,
      limit: 20,
    };
    const held = await store.select({ ...query, now: f.claim.now });
    expect(held).toEqual({ items: [], next: ids[19] });
    expect(
      await store.select({ ...query, now: f.claim.now, after: held.next! }),
    ).toEqual({ items: [], next: null });
    const first = await store.select(query);
    expect(first.items.map((row) => row.id)).toEqual(ids.slice(0, 20));
    expect(first.next).toBe(ids[19]);
    const last = await store.select({ ...query, after: first.next! });
    expect(last.items.map((row) => row.id)).toEqual(ids.slice(20));
    expect(last.next).toBeNull();
  });
}
