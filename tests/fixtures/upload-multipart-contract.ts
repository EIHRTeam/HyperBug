import { it, expect } from 'vitest';
import {
  cleanupUploadIntent,
  type UploadIntentStore,
  type UploadQuotaPolicy,
  type ReserveUpload,
  type BlobStore,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import { blobKey } from './blob-store-proof.ts';

const now = 1791000000000,
  partBytes = 5 * 1024 ** 2,
  maxBytes = 8 * 1024 ** 2;
export const multipartTestQuota: UploadQuotaPolicy = {
  maxFileBytes: 32 * 1024 ** 2,
  projectBytes: 100 * 1024 ** 2,
  principalBytes: 100 * 1024 ** 2,
  projectPending: 16,
  principalPending: 16,
};
export function uploadMultipartContract(
  get: () => { harness: RepositoryHarness; store: UploadIntentStore },
) {
  const query = (sql: string, args: (string | number)[] = []) =>
    get().harness.query(sql, args);
  async function fixture() {
    const projectId = nextId(),
      principalId = nextId();
    await query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [projectId, `multipart-${projectId}`, 'Multipart', now, now],
    );
    await query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Multipart', ?)",
      [principalId, now],
    );
    const input: ReserveUpload = {
      id: nextId(),
      projectId,
      principalId,
      now,
      expiresAt: now + 60000,
      stagingKey: blobKey(),
      finalKey: blobKey('objects'),
      filename: 'fixture.bin',
      contentType: 'application/octet-stream',
      maxBytes,
      association: { kind: 'issue-draft', draftId: nextId() },
      multipartPlan: { partBytes, maxParts: 2 },
    };
    const store = get().store;
    await store.reserve(input);
    return { store, input };
  }
  const lease = (input: ReserveUpload, time = now) => ({
    ...input,
    now: time,
    leaseId: nextId(),
    leaseExpiresAt: time + 1000,
  });
  const usage = async (input: ReserveUpload) => {
    for (const [kind, id] of [
      ['project', input.projectId],
      ['principal', input.principalId],
    ]) {
      const row = (
        await query(
          `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
          [id!],
        )
      )[0]!;
      expect([
        Number(row.reserved_bytes),
        Number(row.used_bytes),
        Number(row.reserved_count),
      ]).toEqual([maxBytes, 0, 1]);
    }
  };
  async function active() {
    const f = await fixture(),
      token = lease(f.input);
    await f.store.mutateMultipart({ ...token, kind: 'claim-create' });
    await f.store.mutateMultipart({
      ...token,
      kind: 'created',
      uploadId: 'private-provider-id',
    });
    return f;
  }
  async function completeCatalog() {
    const f = await active();
    let revision = (await f.store.get(f.input))!.multipart!.revision;
    for (const part of [
      { partNumber: 1, sizeBytes: partBytes, etag: 'first' },
      { partNumber: 2, sizeBytes: 1024 ** 2, etag: 'second' },
    ]) {
      revision = (
        await f.store.mutateMultipart({
          ...f.input,
          kind: 'part',
          now,
          expectedRevision: revision,
          part,
        })
      ).multipart!.revision;
    }
    return { ...f, revision };
  }
  it('multipart physical constraints reject missing provider identity, foreign projects and malformed catalogs', async () => {
    const { input } = await fixture();
    for (const [sql, args] of [
      [
        "UPDATE upload_multipart_sessions SET state = 'active' WHERE intent_id = ?",
        [input.id],
      ],
      [
        "UPDATE upload_multipart_sessions SET parts = '{}' WHERE intent_id = ?",
        [input.id],
      ],
      [
        "UPDATE upload_multipart_sessions SET parts = '[{},{},{}]' WHERE intent_id = ?",
        [input.id],
      ],
      [
        'UPDATE upload_multipart_sessions SET project_id = ? WHERE intent_id = ?',
        [nextId(), input.id],
      ],
    ] as [string, string[]][])
      await expect(query(sql, args)).rejects.toThrow();
    expect((await get().store.get(input))!.multipart).toMatchObject({
      state: 'planned',
      parts: [],
      uploadId: null,
    });
    await usage(input);
  });
  it('multipart reservation replays atomically and rejects a changed transfer plan without changing quota', async () => {
    const { store, input } = await fixture();
    const records = await Promise.all(
      Array.from({ length: 8 }, () => store.reserve(input)),
    );
    expect(
      records.every(
        (r) => r.multipart?.state === 'planned' && r.multipart.revision === 1,
      ),
    ).toBe(true);
    await expect(
      store.reserve({
        ...input,
        multipartPlan: { partBytes: maxBytes, maxParts: 1 },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    await expect(
      store.reserve({
        ...input,
        id: nextId(),
        multipartPlan: { partBytes: 1, maxParts: maxBytes },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    await usage(input);
  });
  it('multipart creation has one fenced winner and hides the session from other owners/projects', async () => {
    const { store, input } = await fixture();
    const tokens = Array.from({ length: 8 }, () => lease(input));
    const results = await Promise.allSettled(
      tokens.map((token) =>
        store.mutateMultipart({ ...token, kind: 'claim-create' }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const winner = tokens[results.findIndex((r) => r.status === 'fulfilled')]!;
    await expect(
      store.mutateMultipart({
        ...winner,
        kind: 'created',
        leaseId: nextId(),
        uploadId: 'wrong',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    await store.mutateMultipart({
      ...winner,
      kind: 'created',
      uploadId: 'private-provider-id',
    });
    await expect(
      store.mutateMultipart({ ...lease(input), kind: 'claim-create' }),
    ).resolves.toMatchObject({
      multipart: { state: 'active', uploadId: 'private-provider-id' },
    });
    for (const other of [
      { ...input, principalId: nextId() },
      { ...input, projectId: nextId() },
    ]) {
      expect(await store.get(other)).toBeNull();
      await expect(
        store.mutateMultipart({ ...lease(other), kind: 'claim-create' }),
      ).rejects.toMatchObject({ code: 'UPLOAD_NOT_FOUND' });
    }
    await expect(store.requestFinalize(input, now)).rejects.toMatchObject({
      code: 'UPLOAD_CONFLICT',
    });
    await usage(input);
  });
  it('multipart receipts use optimistic concurrency with exact replay and bounded parts', async () => {
    const { store, input } = await active();
    const revision = (await store.get(input))!.multipart!.revision;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, n) =>
        store.mutateMultipart({
          ...input,
          now,
          kind: 'part',
          expectedRevision: revision,
          part: { partNumber: 1, etag: `etag-${n}`, sizeBytes: partBytes },
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const current = (await store.get(input))!;
    const part = current.multipart!.parts[0]!;
    const replay = await store.mutateMultipart({
      ...input,
      now,
      kind: 'part',
      expectedRevision: revision,
      part,
    });
    expect(replay.revision).toBe(current.revision);
    for (const invalid of [
      { ...part, partNumber: 3 },
      { ...part, sizeBytes: partBytes + 1 },
      { ...part, etag: 'bad\nvalue' },
    ]) {
      await expect(
        store.mutateMultipart({
          ...input,
          now,
          kind: 'part',
          expectedRevision: current.multipart!.revision,
          part: invalid,
        }),
      ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    }
    await usage(input);
  });
  it.each(['gap', 'short-first', 'too-large'])(
    'multipart completion rejects a %s catalog without taking a lease',
    async (kind) => {
      const { store, input } = await active();
      let revision = (await store.get(input))!.multipart!.revision;
      const parts =
        kind === 'gap'
          ? [{ partNumber: 2, sizeBytes: 1, etag: 'second' }]
          : [
              {
                partNumber: 1,
                sizeBytes: kind === 'short-first' ? 1 : partBytes,
                etag: 'first',
              },
              {
                partNumber: 2,
                sizeBytes: kind === 'too-large' ? partBytes : 1,
                etag: 'second',
              },
            ];
      for (const part of parts)
        revision = (
          await store.mutateMultipart({
            ...input,
            now,
            kind: 'part',
            expectedRevision: revision,
            part,
          })
        ).multipart!.revision;
      await expect(
        store.mutateMultipart({
          ...lease(input),
          kind: 'claim-complete',
          expectedRevision: revision,
        }),
      ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
      expect((await store.get(input))!.leaseId).toBeNull();
      await usage(input);
    },
  );
  it('multipart completion freezes receipts, fences stale workers and converts only verified bytes once', async () => {
    const { store, input, revision } = await completeCatalog();
    const tokens = Array.from({ length: 8 }, () => lease(input));
    const results = await Promise.allSettled(
      tokens.map((token) =>
        store.mutateMultipart({
          ...token,
          kind: 'claim-complete',
          expectedRevision: revision,
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const winner = tokens[results.findIndex((r) => r.status === 'fulfilled')]!;
    await expect(
      store.mutateMultipart({
        ...input,
        now,
        kind: 'part',
        expectedRevision: revision,
        part: { partNumber: 2, etag: 'changed', sizeBytes: 1 },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    await expect(
      store.mutateMultipart({ ...lease(input), kind: 'claim-abort' }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    const newer = lease(input, now + 1000);
    await store.mutateMultipart({
      ...newer,
      kind: 'claim-complete',
      expectedRevision: (await store.get(input))!.multipart!.revision,
    });
    await expect(
      store.mutateMultipart({
        ...winner,
        now: now + 1001,
        kind: 'completed',
        valid: true,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    await store.mutateMultipart({ ...newer, kind: 'completed', valid: true });
    await usage(input);
    await store.requestFinalize(input, now + 1001);
    const processing = lease(input, now + 1001);
    await store.claim(processing);
    const verified = {
      key: input.finalKey,
      size: 6 * 1024 ** 2,
      sha256: 'a'.repeat(64),
      contentType: input.contentType,
      providerVersion: null,
      scanStatus: 'unscanned' as const,
    };
    await Promise.all(
      Array.from({ length: 8 }, () =>
        store.commitVerified({ ...processing, verified }),
      ),
    );
    for (const [kind, id] of [
      ['project', input.projectId],
      ['principal', input.principalId],
    ]) {
      const row = (
        await query(
          `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
          [id!],
        )
      )[0]!;
      expect([
        Number(row.reserved_bytes),
        Number(row.used_bytes),
        Number(row.reserved_count),
      ]).toEqual([0, verified.size, 0]);
    }
    expect(await store.get(input)).toMatchObject({
      scanStatus: 'unscanned',
      policyState: 'quarantined',
    });
  });
  it('multipart abort fences completion and retains quotas until expired storage cleanup', async () => {
    const { store, input, revision } = await completeCatalog();
    const token = lease(input);
    await store.mutateMultipart({ ...token, kind: 'claim-abort' });
    await expect(
      store.mutateMultipart({
        ...lease(input),
        kind: 'claim-complete',
        expectedRevision: revision,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    await store.mutateMultipart({ ...token, kind: 'aborted' });
    await expect(
      store.mutateMultipart({ ...lease(input), kind: 'claim-abort' }),
    ).resolves.toMatchObject({ multipart: { state: 'aborted' } });
    await usage(input);
    const calls: string[] = [];
    const blobs = {
      abortMultipart: async () => {
        calls.push('abort');
      },
      delete: async () => {
        calls.push('delete');
      },
      head: async () => null,
    } as unknown as BlobStore;
    const cleanup = lease(input, input.expiresAt + 300000);
    await cleanupUploadIntent(
      { intents: store, blobs },
      cleanup,
      () => cleanup.now,
    );
    await cleanupUploadIntent(
      { intents: store, blobs },
      cleanup,
      () => cleanup.now,
    );
    expect(calls).toEqual([
      'abort',
      'delete',
      'delete',
      'abort',
      'delete',
      'delete',
    ]);
    expect(await store.get(input)).toMatchObject({
      reservationState: 'released',
      multipart: { state: 'aborted' },
    });
    expect(
      Number(
        (
          await query(
            'SELECT reserved_bytes FROM principal_upload_usage WHERE principal_id = ?',
            [input.principalId],
          )
        )[0]!.reserved_bytes,
      ),
    ).toBe(0);
  });
  it('multipart completion replay cannot keep an unverified intent alive past expiry', async () => {
    const { store, input, revision } = await completeCatalog();
    const token = lease(input);
    await store.mutateMultipart({
      ...token,
      kind: 'claim-complete',
      expectedRevision: revision,
    });
    await store.mutateMultipart({ ...token, kind: 'completed', valid: true });
    await expect(
      store.mutateMultipart({
        ...lease(input, input.expiresAt),
        kind: 'claim-complete',
        expectedRevision: revision,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
    await usage(input);
  });
  it('multipart persists known provider bookkeeping after revocation but denies public transitions', async () => {
    const { store, input } = await fixture(),
      token = lease(input);
    await store.mutateMultipart({ ...token, kind: 'claim-create' });
    await query("UPDATE principals SET status = 'suspended' WHERE id = ?", [
      input.principalId,
    ]);
    await store.mutateMultipart({
      ...token,
      kind: 'created',
      uploadId: 'known-after-revocation',
    });
    const revision = (await store.get(input))!.multipart!.revision;
    for (const mutation of [
      { ...lease(input), kind: 'claim-create' as const },
      { ...lease(input), kind: 'claim-abort' as const },
      {
        ...lease(input),
        kind: 'claim-complete' as const,
        expectedRevision: revision,
      },
      {
        ...input,
        now,
        kind: 'part' as const,
        expectedRevision: revision,
        part: { partNumber: 1, etag: 'part', sizeBytes: 1 },
      },
    ])
      await expect(store.mutateMultipart(mutation)).rejects.toMatchObject({
        code: 'UPLOAD_FORBIDDEN',
      });
    await usage(input);
  });
  it('multipart expires public writes and retains unknown creation quota and objects for reconciliation', async () => {
    const { store, input } = await fixture(),
      token = lease(input);
    await store.mutateMultipart({ ...token, kind: 'claim-create' });
    await expect(
      store.mutateMultipart({
        ...lease(input, now + 1000),
        kind: 'claim-create',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    await expect(
      store.mutateMultipart({
        ...lease(input, input.expiresAt),
        kind: 'claim-abort',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
    const blobs = {} as BlobStore;
    const cleanup = lease(input, input.expiresAt + 300000);
    await expect(
      cleanupUploadIntent(
        { intents: store, blobs },
        cleanup,
        () => cleanup.now,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    expect(await store.get(input)).toMatchObject({
      state: 'expired',
      reservationState: 'reserved',
      multipart: { state: 'creating', uploadId: null },
    });
    await usage(input);
  });
  it('multipart trusted reconciliation binds exact keys, retains quota on failure and repeats tombstone discovery', async () => {
    const { store, input } = await fixture();
    await store.mutateMultipart({ ...lease(input), kind: 'claim-create' });
    const cleanupAt = input.expiresAt + 300000;
    let deleted = 0,
      reconciled = 0;
    const blobs = {
      delete: async () => {
        deleted++;
      },
      head: async () => null,
    } as unknown as BlobStore;
    const cleanup = lease(input, cleanupAt);
    await expect(
      cleanupUploadIntent(
        {
          intents: store,
          blobs,
          multipartReconciler: {
            reconcile: async () => ({ key: blobKey(), remainingUploads: 0 }),
          },
        },
        cleanup,
        () => cleanupAt,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    expect(deleted).toBe(0);
    const deps = {
      intents: store,
      blobs,
      multipartReconciler: {
        reconcile: async ({
          key,
          signal,
        }: {
          key: string;
          signal: AbortSignal;
        }) => {
          expect(signal.aborted).toBe(false);
          reconciled++;
          return { key, remainingUploads: 0 as const };
        },
      },
    };
    expect(
      await cleanupUploadIntent(deps, cleanup, () => cleanupAt),
    ).toMatchObject({
      reservationState: 'released',
      multipart: { state: 'creating', uploadId: null },
    });
    const later = lease(input, cleanupAt + 1001);
    await cleanupUploadIntent(deps, later, () => later.now);
    expect(reconciled).toBe(2);
    expect(deleted).toBe(4);
    const counters = await query(
      'SELECT reserved_bytes, reserved_count FROM project_upload_usage WHERE project_id = ?',
      [input.projectId],
    );
    expect(Number(counters[0]!.reserved_bytes)).toBe(0);
    expect(Number(counters[0]!.reserved_count)).toBe(0);
  });
  it('multipart reconciliation fences a provider proof that outlives the cleanup lease before deleting or releasing', async () => {
    const { store, input } = await fixture();
    await store.mutateMultipart({ ...lease(input), kind: 'claim-create' });
    const cleanup = lease(input, input.expiresAt + 300000);
    let tick = cleanup.now,
      deleted = false;
    const blobs = {
      delete: async () => {
        deleted = true;
      },
      head: async () => null,
    } as unknown as BlobStore;
    await expect(
      cleanupUploadIntent(
        {
          intents: store,
          blobs,
          multipartReconciler: {
            reconcile: async ({ key }) => {
              tick = cleanup.leaseExpiresAt;
              return { key, remainingUploads: 0 };
            },
          },
        },
        cleanup,
        () => tick,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    expect(deleted).toBe(false);
    expect(await store.get(input)).toMatchObject({
      reservationState: 'reserved',
      multipart: { state: 'creating' },
    });
    await usage(input);
  });
}
