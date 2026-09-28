import { expect, it } from 'vitest';
import {
  SecretKeyProvider,
  encodeBase64Url,
  encryptSecret,
  decryptSecret,
  rewrapSecret,
  generateOpaqueCredential,
  digestCredential,
  migrateCredentialDigest,
  verifyCredential,
  blindIndexCandidates,
  type KeyRegistry,
  type KeyReference,
  type RegistryMutation,
  type ProtectedValue,
} from '../../packages/security/src/index.ts';

export interface KeyRegistryHarness {
  registry: KeyRegistry;
  second: KeyRegistry;
  query(sql: string, values?: unknown[]): Promise<Record<string, unknown>[]>;
}
const signal = () => new AbortController().signal;
const id = () => crypto.randomUUID();
const now = 1789800000000;
const ref = (
  purpose: KeyReference['purpose'],
  name: string,
  version = 1,
): KeyReference => ({ purpose, id: name, version });
const digest = (key: KeyReference): ProtectedValue => ({
  v: 1,
  alg: 'HS256',
  key,
  digest: encodeBase64Url(new Uint8Array(32).fill(23)),
});
async function mutation(
  registry: KeyRegistry,
  change: RegistryMutation['change'],
  overrides: Partial<RegistryMutation> = {},
) {
  return registry.mutate({
    expectedGeneration: (await registry.inspect(signal())).generation,
    auditId: id(),
    requestId: id(),
    now,
    change,
    ...overrides,
  });
}

export function keyRegistryContract(get: () => KeyRegistryHarness) {
  it('uses current primary state across independent registry instances and never restores revoked keys', async () => {
    const { registry, second } = get();
    const first = ref('envelope-kek', 'registry-first');
    const next = ref('envelope-kek', 'registry-first', 2);
    await mutation(registry, { kind: 'activate', key: first });
    expect((await second.load(first.purpose, signal())).current).toEqual(first);
    await mutation(second, { kind: 'activate', key: next });
    expect((await registry.load(first.purpose, signal())).readable).toEqual([
      next,
      first,
    ]);
    await mutation(registry, { kind: 'revoke', key: first });
    expect((await second.load(first.purpose, signal())).readable).toEqual([
      next,
    ]);
    await expect(
      mutation(second, { kind: 'activate', key: first }),
    ).rejects.toThrow();
    await mutation(second, { kind: 'revoke', key: next });
    await expect(registry.load(next.purpose, signal())).rejects.toThrow();
    await mutation(registry, { kind: 'remove', key: first });
    await expect(
      mutation(registry, { kind: 'activate', key: first }),
    ).rejects.toThrow();
    await expect(
      mutation(registry, { kind: 'revoke', key: first }),
    ).rejects.toThrow();
    await mutation(registry, { kind: 'remove', key: next });
  });

  it('serializes competing generation writes with exactly one audit and no partial rotation', async () => {
    const { registry, second, query } = get();
    const generation = (await registry.inspect(signal())).generation;
    const auditIds = [id(), id()];
    const keys = [
      ref('token-hmac', 'concurrent-a'),
      ref('token-hmac', 'concurrent-b'),
    ];
    const results = await Promise.allSettled(
      keys.map((key, index) =>
        mutation(
          index === 0 ? registry : second,
          { kind: 'activate', key },
          { expectedGeneration: generation, auditId: auditIds[index]! },
        ),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await registry.inspect(signal())).generation).toBe(generation + 1);
    expect(
      await query('SELECT id FROM audit_events WHERE id IN (?, ?)', auditIds),
    ).toHaveLength(1);
    const successful =
      keys[results.findIndex((r) => r.status === 'fulfilled')]!;
    await mutation(registry, { kind: 'revoke', key: successful });
    await mutation(registry, { kind: 'remove', key: successful });
  });

  it('rolls back key state and generation when the required audit insert fails', async () => {
    const { registry, query } = get();
    const auditId = id();
    const key = ref('token-hmac', 'audit-rollback');
    await mutation(registry, { kind: 'activate', key }, { auditId });
    const before = await registry.inspect(signal());
    await expect(
      mutation(registry, { kind: 'revoke', key }, { auditId }),
    ).rejects.toThrow();
    expect(await registry.inspect(signal())).toEqual(before);
    expect(
      await query('SELECT id FROM audit_events WHERE id = ?', [auditId]),
    ).toHaveLength(1);
    await mutation(registry, { kind: 'revoke', key });
    await mutation(registry, { kind: 'remove', key });
  });

  it('accounts protected payload and key references atomically through CAS updates and deletion', async () => {
    const { registry, second, query } = get();
    const first = ref('token-hmac', 'records', 1),
      next = ref('token-hmac', 'records', 2);
    const recordId = id();
    await mutation(registry, { kind: 'activate', key: first });
    await mutation(registry, {
      kind: 'put',
      id: recordId,
      expectedRevision: 0,
      record: digest(first),
    });
    await mutation(registry, { kind: 'activate', key: next });
    await expect(
      mutation(second, { kind: 'remove', key: first }),
    ).rejects.toThrow();
    const before = await registry.inspect(signal());
    await expect(
      mutation(registry, {
        kind: 'put',
        id: recordId,
        expectedRevision: 2,
        record: digest(next),
      }),
    ).rejects.toThrow();
    expect(await registry.inspect(signal())).toEqual(before);
    expect((await registry.getRecord(recordId, signal()))?.record.key).toEqual(
      first,
    );
    await expect(
      mutation(registry, {
        kind: 'put',
        id: id(),
        expectedRevision: 0,
        record: digest(first),
      }),
    ).rejects.toThrow();
    await expect(
      query(
        "UPDATE key_versions SET state = 'removed' WHERE purpose = ? AND key_id = ? AND version = ?",
        [first.purpose, first.id, first.version],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        'DELETE FROM key_versions WHERE purpose = ? AND key_id = ? AND version = ?',
        [first.purpose, first.id, first.version],
      ),
    ).rejects.toThrow();
    await mutation(second, {
      kind: 'put',
      id: recordId,
      expectedRevision: 1,
      record: digest(next),
    });
    expect((await registry.getRecord(recordId, signal()))?.revision).toBe(2);
    await mutation(registry, { kind: 'remove', key: first });
    await expect(
      query(
        "UPDATE key_versions SET state = 'current' WHERE purpose = ? AND key_id = ? AND version = ?",
        [first.purpose, first.id, first.version],
      ),
    ).rejects.toThrow();
    await expect(
      query('UPDATE protected_records SET key_version = 1 WHERE id = ?', [
        recordId,
      ]),
    ).rejects.toThrow();
    await mutation(registry, { kind: 'revoke', key: next });
    await expect(
      mutation(registry, { kind: 'remove', key: next }),
    ).rejects.toThrow();
    await expect(
      mutation(registry, { kind: 'delete', id: recordId, expectedRevision: 1 }),
    ).rejects.toThrow();
    await mutation(registry, {
      kind: 'delete',
      id: recordId,
      expectedRevision: 2,
    });
    await mutation(registry, { kind: 'remove', key: next });
    expect(await registry.getRecord(recordId, signal())).toBeNull();
  });

  it('rolls back payload and its references when auditing a rewrap fails', async () => {
    const { registry } = get();
    const first = ref('token-hmac', 'record-rollback'),
      next = ref('token-hmac', 'record-rollback', 2);
    const recordId = id(),
      auditId = id();
    await mutation(registry, { kind: 'activate', key: first }, { auditId });
    await mutation(registry, {
      kind: 'put',
      id: recordId,
      expectedRevision: 0,
      record: digest(first),
    });
    await mutation(registry, { kind: 'activate', key: next });
    const before = await registry.inspect(signal());
    await expect(
      mutation(
        registry,
        {
          kind: 'put',
          id: recordId,
          expectedRevision: 1,
          record: digest(next),
        },
        { auditId },
      ),
    ).rejects.toThrow();
    expect(await registry.inspect(signal())).toEqual(before);
    expect((await registry.getRecord(recordId, signal()))?.record).toEqual(
      digest(first),
    );
    await mutation(registry, {
      kind: 'delete',
      id: recordId,
      expectedRevision: 1,
    });
    await mutation(registry, { kind: 'remove', key: first });
    await mutation(registry, { kind: 'revoke', key: next });
    await mutation(registry, { kind: 'remove', key: next });
  });

  it('pins every key before backup capture, preserves pins after expiry, and requires explicit destruction', async () => {
    const { registry, second, query } = get();
    const first = ref('envelope-kek', 'backup'),
      next = ref('envelope-kek', 'backup', 2);
    const backupId = id();
    await mutation(registry, { kind: 'activate', key: first });
    await mutation(registry, {
      kind: 'begin-backup',
      id: backupId,
      retainUntil: now + 100,
    });
    await expect(
      mutation(second, { kind: 'activate', key: next }),
    ).rejects.toThrow();
    await mutation(second, { kind: 'revoke', key: first }); // incident response stays available during capture
    await expect(
      mutation(registry, { kind: 'remove', key: first }),
    ).rejects.toThrow();
    await mutation(registry, { kind: 'finish-backup', id: backupId });
    await mutation(registry, { kind: 'activate', key: next });
    await expect(
      mutation(registry, {
        kind: 'release-backup',
        id: backupId,
        destroyed: true,
      }),
    ).rejects.toThrow();
    await expect(
      mutation(registry, { kind: 'remove', key: first }, { now: now + 101 }),
    ).rejects.toThrow();
    await expect(
      mutation(
        registry,
        {
          kind: 'release-backup',
          id: backupId,
          destroyed: false,
        } as unknown as RegistryMutation['change'],
        { now: now + 101 },
      ),
    ).rejects.toThrow();
    expect(
      (await registry.inspect(signal())).keys.find(
        (k) => k.ref.id === first.id && k.ref.version === 1,
      )?.required,
    ).toBe(true);
    await mutation(
      registry,
      { kind: 'release-backup', id: backupId, destroyed: true },
      { now: now + 101 },
    );
    expect(
      await query('SELECT * FROM key_backup_references WHERE backup_id = ?', [
        backupId,
      ]),
    ).toHaveLength(0);
    await mutation(registry, { kind: 'remove', key: first });
    await expect(
      mutation(registry, {
        kind: 'begin-backup',
        id: backupId,
        retainUntil: now + 200,
      }),
    ).rejects.toThrow();
    await mutation(registry, { kind: 'revoke', key: next });
    await mutation(registry, { kind: 'remove', key: next });
  });

  it('bounds blind-index overlap to three readable keys without silently discarding old versions', async () => {
    const { registry } = get();
    const keys = [1, 2, 3, 4].map((v) =>
      ref('blind-index', 'bounded-index', v),
    );
    for (const key of keys.slice(0, 3))
      await mutation(registry, { kind: 'activate', key });
    await expect(
      mutation(registry, { kind: 'activate', key: keys[3]! }),
    ).rejects.toThrow();
    expect(
      (await registry.load('blind-index', signal())).readable,
    ).toHaveLength(3);
    await mutation(registry, { kind: 'remove', key: keys[0]! });
    await mutation(registry, { kind: 'activate', key: keys[3]! });
    for (const key of keys.slice(1)) {
      await mutation(registry, { kind: 'revoke', key });
      await mutation(registry, { kind: 'remove', key });
    }
  });

  it('integrates real envelopes, credential migration and blind-index rotation with the durable registry', async () => {
    const { registry, second, query } = get();
    const purposes = ['envelope-kek', 'token-hmac', 'blind-index'] as const;
    const keys = purposes.flatMap((p) => [
      ref(p, 'integration', 1),
      ref(p, 'integration', 2),
    ]);
    const originalEntries = keys.map((key) => ({
      ref: key,
      material: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
    }));
    let entries = originalEntries;
    const source = {
      read: async () => JSON.stringify({ v: 1, keys: entries }),
    };
    const provider = new SecretKeyProvider(source, registry);
    const other = new SecretKeyProvider(source, second);
    for (const purpose of purposes)
      await mutation(registry, {
        kind: 'activate',
        key: ref(purpose, 'integration', 1),
      });
    const context = {
      resourceType: 'plugin-secret',
      resourceId: id(),
      field: 'value',
      projectId: null,
      schemaVersion: 1,
    };
    const plain = new TextEncoder().encode('seeded-sensitive-payload');
    const envelope = await encryptSecret(provider, plain, context);
    const token = generateOpaqueCredential();
    const credential = await digestCredential(provider, token, context);
    const blind = (
      await blindIndexCandidates(provider, 'private@example.invalid', context)
    )[0]!;
    const records = [envelope, credential, blind];
    const recordIds = records.map(() => id());
    for (const [index, record] of records.entries())
      await mutation(registry, {
        kind: 'put',
        id: recordIds[index]!,
        expectedRevision: 0,
        record,
      });
    const backupId = id();
    await mutation(registry, {
      kind: 'begin-backup',
      id: backupId,
      retainUntil: now + 1,
    });
    await mutation(registry, { kind: 'finish-backup', id: backupId });
    for (const purpose of purposes)
      await mutation(second, {
        kind: 'activate',
        key: ref(purpose, 'integration', 2),
      });
    const rewrapped = await rewrapSecret(other, envelope, context);
    expect(rewrapped.ciphertext).toBe(envelope.ciphertext);
    const migrated = await migrateCredentialDigest(
      other,
      token,
      credential,
      context,
    );
    const candidates = await blindIndexCandidates(
      other,
      'private@example.invalid',
      context,
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[1]).toEqual(blind);
    const replacements = [rewrapped, migrated, candidates[0]!];
    for (const [index, record] of replacements.entries())
      await mutation(second, {
        kind: 'put',
        id: recordIds[index]!,
        expectedRevision: 1,
        record,
      });
    expect(await decryptSecret(provider, rewrapped, context)).toEqual(plain);
    expect(await verifyCredential(provider, token, migrated, context)).toBe(
      true,
    );
    entries = entries.filter((e) => e.ref.version !== 1);
    await expect(provider.current('token-hmac')).rejects.toThrow(); // backup pins include every purpose
    entries = originalEntries;
    for (const purpose of purposes)
      await expect(
        mutation(registry, {
          kind: 'remove',
          key: ref(purpose, 'integration', 1),
        }),
      ).rejects.toThrow();
    await mutation(
      registry,
      { kind: 'release-backup', id: backupId, destroyed: true },
      { now: now + 2 },
    );
    for (const purpose of purposes)
      await mutation(registry, {
        kind: 'remove',
        key: ref(purpose, 'integration', 1),
      });
    const logs = JSON.stringify(
      await query(
        "SELECT * FROM audit_events WHERE system_actor = 'core.key-registry'",
      ),
    );
    for (const secret of [
      'seeded-sensitive-payload',
      'private@example.invalid',
      token,
      envelope.ciphertext,
      credential.digest,
    ])
      expect(logs).not.toContain(secret);
    for (const [index, recordId] of recordIds.entries()) {
      const key = replacements[index]!.key;
      await mutation(registry, { kind: 'revoke', key });
      await expect(other.get(key)).rejects.toThrow();
      await mutation(registry, {
        kind: 'delete',
        id: recordId,
        expectedRevision: 2,
      });
      await mutation(registry, { kind: 'remove', key });
    }
  });

  it('fails closed on cancellation and malformed commands before changing state', async () => {
    const { registry } = get();
    const cancelled = AbortSignal.abort();
    await expect(registry.inspect(cancelled)).rejects.toThrow();
    await expect(registry.getRecord(id(), cancelled)).rejects.toThrow();
    const before = await registry.inspect(signal());
    await expect(
      registry.mutate({
        expectedGeneration: before.generation,
        auditId: id(),
        requestId: id(),
        now,
        change: { kind: 'unknown' },
      } as unknown as RegistryMutation),
    ).rejects.toThrow();
    expect(await registry.inspect(signal())).toEqual(before);
  });
}

export function keyRegistryBoundsContract(get: () => KeyRegistryHarness) {
  it('caps active key versions at 32 and keeps removed references permanently unavailable', async () => {
    const { registry } = get();
    const keys = Array.from({ length: 33 }, (_, i) =>
      ref('token-hmac', 'capacity', i + 1),
    );
    for (const key of keys.slice(0, 32))
      await mutation(registry, { kind: 'activate', key });
    await expect(
      mutation(registry, { kind: 'activate', key: keys[32]! }),
    ).rejects.toThrow();
    expect((await registry.inspect(signal())).keys).toHaveLength(32);
    await mutation(registry, { kind: 'remove', key: keys[0]! });
    await mutation(registry, { kind: 'activate', key: keys[32]! });
    for (const key of keys.slice(1)) {
      await mutation(registry, { kind: 'revoke', key });
      await mutation(registry, { kind: 'remove', key });
    }
    await expect(
      mutation(registry, { kind: 'activate', key: keys[0]! }),
    ).rejects.toThrow();
  });
  it('serializes backup capture against rotation so every captured key is pinned', async () => {
    const { registry, second, query } = get();
    const first = ref('envelope-kek', 'backup-race', 1),
      next = ref('envelope-kek', 'backup-race', 2);
    await mutation(registry, { kind: 'activate', key: first });
    const generation = (await registry.inspect(signal())).generation;
    const backupId = id();
    const changes: RegistryMutation['change'][] = [
      { kind: 'begin-backup', id: backupId, retainUntil: now + 1 },
      { kind: 'activate', key: next },
    ];
    const results = await Promise.allSettled(
      changes.map((change, i) =>
        mutation(i === 0 ? registry : second, change, {
          expectedGeneration: generation,
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    if (results[0]?.status === 'rejected')
      await mutation(registry, changes[0]!);
    const pins = await query(
      'SELECT purpose, key_id, key_version FROM key_backup_references WHERE backup_id = ?',
      [backupId],
    );
    expect(pins).toHaveLength(results[1]?.status === 'fulfilled' ? 2 : 1);
    await mutation(
      registry,
      { kind: 'release-backup', id: backupId, destroyed: true },
      { now: now + 2 },
    );
    for (const key of results[1]?.status === 'fulfilled'
      ? [first, next]
      : [first]) {
      await mutation(registry, { kind: 'revoke', key });
      await mutation(registry, { kind: 'remove', key });
    }
  });
}

/** Actual adapter SQL and bounded lookup cost against retained records/backups. */
export async function measureKeyRegistry(
  harness: KeyRegistryHarness,
  profile: 'd1' | 'postgres',
  measuredQueries: () => string[],
) {
  const { registry, query } = harness;
  const keys = [1, 2, 3].map((v) => ref('token-hmac', 'query-cost', v));
  for (const key of keys) await mutation(registry, { kind: 'activate', key });
  for (let offset = 0; offset < 4000; offset += 10) {
    const values = Array.from({ length: 10 }, (_, i) => {
      const key = keys[(offset + i) % 2]!;
      return [
        id(),
        key.purpose,
        key.id,
        key.version,
        JSON.stringify(digest(key)),
      ];
    }).flat();
    await query(
      `INSERT INTO protected_records (id, revision, purpose, key_id, key_version, record) VALUES ${Array.from({ length: 10 }, () => '(?, 1, ?, ?, ?, ?)').join(',')}`,
      values,
    );
  }
  const key = keys[2]!;
  for (let offset = 0; offset < 500; offset += 10) {
    const ids = Array.from({ length: 10 }, () => id());
    await query(
      `INSERT INTO key_backups (id, state, retain_until, created_at) VALUES ${ids.map(() => "(?, 'retained', ?, ?)").join(',')}`,
      ids.flatMap((backupId) => [backupId, now + 1000, now]),
    );
    await query(
      `INSERT INTO key_backup_references (backup_id,purpose,key_id,key_version) VALUES ${ids.map(() => '(?, ?, ?, ?)').join(',')}`,
      ids.flatMap((backupId) => [backupId, key.purpose, key.id, key.version]),
    );
  }
  for (let offset = 0; offset < 4000; offset += 10) {
    await query(
      `INSERT INTO key_versions (purpose,key_id,version,state,created_at) VALUES ${Array.from({ length: 10 }, () => "('token-hmac', 'removed-cost', ?, 'removed', ?)").join(',')}`,
      Array.from({ length: 10 }, (_, i) => [offset + i + 1, now]).flat(),
    );
  }
  await query('ANALYZE key_versions');
  await query('ANALYZE protected_records');
  await query('ANALYZE key_backup_references');
  const offset = measuredQueries().length;
  const snapshot = await registry.inspect(signal());
  expect(snapshot.keys).toHaveLength(3);
  expect(snapshot.keys.every((k) => k.required)).toBe(true);
  expect(measuredQueries().length - offset).toBe(1);
  const actualSql = measuredQueries().at(-1);
  if (!actualSql) throw new Error('Registry query capture failed');
  const plan = await query(
    (profile === 'd1'
      ? 'EXPLAIN QUERY PLAN '
      : 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ') + actualSql,
  );
  const encodedPlan = JSON.stringify(plan);
  for (const index of [
    'key_active_versions',
    'protected_record_key',
    'key_backup_reference_key',
  ])
    expect(encodedPlan).toContain(index);
  if (profile === 'postgres') expect(encodedPlan).not.toContain('Seq Scan');
  else {
    expect(encodedPlan).not.toContain('SCAN r');
    expect(encodedPlan).not.toContain('SCAN b');
  }
  const durations: number[] = [];
  for (let index = 0; index < 30; index++) {
    const start = performance.now();
    await registry.inspect(signal());
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir('.local/evidence', { recursive: true });
  await writeFile(
    `.local/evidence/${profile}-key-registry-query.json`,
    JSON.stringify(
      {
        profile,
        fixture: {
          protectedRecords: 4000,
          retainedBackups: 500,
          activeKeys: 3,
          additionalRemovedKeyTombstones: 4000,
        },
        statementsPerSnapshot: 1,
        samples: 30,
        medianMs: durations[15],
        p95Ms: durations[28],
        includesLoopbackHttp: profile === 'd1',
        plan,
      },
      null,
      2,
    ) + '\n',
  );
  // Large fixture is intentionally retained until this disposable database is destroyed.
}
