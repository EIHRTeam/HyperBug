/* eslint-disable no-await-in-loop -- Bounded sequential fixture creation and assertions. */
import { expect, it } from 'vitest';
import {
  cleanupOrphanUploadIntent,
  cleanupOrphanUploadPage,
  validateIssueFormAnswers,
  type BlobStore,
  type ContentDefinitionStore,
  type UploadIntentStore,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import {
  seedFormSubmissionFixture,
  seedFormUpload,
} from './form-submission-contract.ts';

const retainAfterExpiryMs = 600000;
/** Real dual-database semantics; blob I/O and clean scan fixtures are explicitly synthetic. */
export function uploadOrphanContract(
  get: () => {
    harness: RepositoryHarness;
    uploads: UploadIntentStore;
    definitions: ContentDefinitionStore;
  },
) {
  const fixture = () =>
    seedFormSubmissionFixture(get().harness, get().definitions);
  const seed = (f: Awaited<ReturnType<typeof fixture>>, mode?: string) =>
    seedFormUpload(get().uploads, f, mode === undefined ? {} : { mode });
  const token = (upload: Awaited<ReturnType<typeof seed>>, delta = 0) => ({
    ...upload,
    retainAfterExpiryMs,
    now: upload.expiresAt + retainAfterExpiryMs + delta,
    leaseId: nextId(),
    leaseExpiresAt: upload.expiresAt + retainAfterExpiryMs + delta + 1000,
  });
  const accounting = async (
    scope: { projectId: string; principalId: string },
    bytes: number,
  ) => {
    for (const [kind, id] of [
      ['project', scope.projectId],
      ['principal', scope.principalId],
    ] as const) {
      const rows = await get().harness.query(
        `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
        [id],
      );
      expect(
        rows.map((r) => [
          Number(r.reserved_bytes),
          Number(r.used_bytes),
          Number(r.reserved_count),
        ]),
      ).toEqual([[0, bytes, 0]]);
    }
  };
  const request = (
    f: Awaited<ReturnType<typeof fixture>>,
    upload: Awaited<ReturnType<typeof seed>>,
  ) => {
    const values = { details: 'Retained content', files: [upload.id] };
    return {
      ...f.intent(),
      body: validateIssueFormAnswers(f.definition, values).markdown,
      formSubmission: {
        formId: f.formId,
        formVersion: 1,
        draftId: upload.association.draftId,
        values,
      },
    };
  };
  it('orphan cleanup requires explicit bounded retention and rejects too-young, foreign and competing scan leases', async () => {
    const f = await fixture(),
      upload = await seed(f, 'unscanned'),
      store = get().uploads;
    const lease = token(upload),
      query = {
        projectId: f.projectId,
        now: lease.now,
        limit: 20,
        retainAfterExpiryMs,
      };
    for (const age of [
      undefined,
      0,
      299999,
      Number.NaN,
      300000.5,
      Number.MAX_SAFE_INTEGER,
    ]) {
      await expect(
        store.selectOrphanCleanup({
          ...query,
          retainAfterExpiryMs: age as number,
        }),
      ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
      await expect(
        store.claimOrphanCleanup({
          ...lease,
          retainAfterExpiryMs: age as number,
        }),
      ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    }
    for (const limit of [0, 21, 1.5])
      await expect(
        store.selectOrphanCleanup({ ...query, limit }),
      ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    expect(
      (await store.selectOrphanCleanup({ ...query, now: lease.now - 1 })).items,
    ).toEqual([]);
    await expect(
      store.claimOrphanCleanup({ ...lease, now: lease.now - 1 }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    await expect(
      store.claimOrphanCleanup({ ...lease, projectId: nextId() }),
    ).rejects.toMatchObject({ code: 'UPLOAD_NOT_FOUND' });
    const scan = {
      ...lease,
      leaseId: nextId(),
      kind: 'claim' as const,
      policyVersion: 'orphan-fixture-policy',
    };
    await store.mutateScan(scan);
    await expect(store.claimOrphanCleanup(lease)).rejects.toMatchObject({
      code: 'UPLOAD_LEASE_LOST',
    });
    expect((await store.selectOrphanCleanup(query)).items).toEqual([]);
    await accounting(upload, 3);
  });
  it('orphan cleanup claims one winner, retires linking/scanning and releases actual used bytes exactly once', async () => {
    const f = await fixture(),
      upload = await seed(f),
      store = get().uploads,
      lease = token(upload);
    const claims = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        store.claimOrphanCleanup({ ...lease, leaseId: nextId() }),
      ),
    );
    const winners = claims.filter((r) => r.status === 'fulfilled');
    expect(winners).toHaveLength(1);
    const winner = (
      winners[0] as PromiseFulfilledResult<
        Awaited<ReturnType<UploadIntentStore['claimOrphanCleanup']>>
      >
    ).value;
    expect(winner).toMatchObject({
      state: 'finalized',
      policyState: 'deleted',
      reservationState: 'used',
      verified: { size: 3 },
    });
    await accounting(upload, 3);
    await expect(
      f.harness.repository.createIssue(request(f, upload)),
    ).rejects.toMatchObject({ code: 'FORM_ATTACHMENTS_INVALID' });
    await expect(
      store.mutateScan({
        ...lease,
        kind: 'claim',
        policyVersion: 'new-policy',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    const release = { ...lease, leaseId: winner.leaseId! };
    await expect(
      store.releaseUsedAfterCleanup({ ...release, leaseId: nextId() }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    await Promise.all(
      Array.from({ length: 8 }, () => store.releaseUsedAfterCleanup(release)),
    );
    await accounting(upload, 0);
    expect(await store.get(upload)).toMatchObject({
      state: 'finalized',
      policyState: 'deleted',
      reservationState: 'released',
      leaseId: null,
    });
    const later = token(upload, 1001);
    await store.claimOrphanCleanup(later);
    await expect(store.releaseUsedAfterCleanup(release)).rejects.toMatchObject({
      code: 'UPLOAD_LEASE_LOST',
    });
    expect((await store.get(upload))!.leaseId).toBe(later.leaseId);
    await store.releaseUsedAfterCleanup(later);
    await accounting(upload, 0);
  });
  it('orphan cleanup never claims linked attachments including hidden or deleted parents', async () => {
    const f = await fixture(),
      upload = await seed(f),
      store = get().uploads,
      lease = token(upload);
    const issue = await f.harness.repository.createIssue(request(f, upload));
    await f.harness.query(
      "UPDATE issues SET moderation = 'hidden', deleted_at = ? WHERE id = ?",
      [lease.now, issue.result.id],
    );
    await expect(store.claimOrphanCleanup(lease)).rejects.toMatchObject({
      code: 'UPLOAD_CONFLICT',
    });
    expect(
      (
        await store.selectOrphanCleanup({
          projectId: f.projectId,
          now: lease.now,
          limit: 20,
          retainAfterExpiryMs,
        })
      ).items,
    ).toEqual([]);
    await accounting(upload, 3);
  });
  it('orphan cleanup and form linking have one atomic winner without partial issue or used-quota changes', async () => {
    const f = await fixture(),
      upload = await seed(f),
      store = get().uploads;
    const outcomes = await Promise.allSettled([
      store.claimOrphanCleanup(token(upload)),
      f.harness.repository.createIssue(request(f, upload)),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const linked = outcomes[1]!.status === 'fulfilled';
    expect(
      await f.harness.query(
        'SELECT id FROM attachments WHERE upload_intent_id = ?',
        [upload.id],
      ),
    ).toHaveLength(linked ? 1 : 0);
    expect(
      await f.harness.query('SELECT id FROM issues WHERE project_id = ?', [
        f.projectId,
      ]),
    ).toHaveLength(linked ? 1 : 0);
    expect((await store.get(upload))!.policyState).toBe(
      linked ? 'ready' : 'deleted',
    );
    await accounting(upload, 3);
  });
  it('orphan cleanup pages bound traversal, skip ineligible records and retain late-write tombstones', async () => {
    const f = await fixture(),
      store = get().uploads,
      uploads = [];
    for (let i = 0; i < 23; i++) uploads.push(await seed(f));
    const lease = token(uploads[0]!),
      query = {
        projectId: f.projectId,
        now: lease.now,
        limit: 20,
        retainAfterExpiryMs,
      };
    await f.harness.query(
      'UPDATE upload_intents SET expires_at = ? WHERE id = ?',
      [lease.now + 1, uploads[21]!.id],
    );
    await store.mutateScan({
      ...token(uploads[22]!),
      kind: 'claim',
      policyVersion: 'different-policy',
    });
    const first = await store.selectOrphanCleanup(query);
    expect(first.items).toHaveLength(20);
    expect(first.next).not.toBeNull();
    const second = await store.selectOrphanCleanup({
      ...query,
      after: first.next!,
    });
    expect(second.items).toHaveLength(1);
    expect(second.next).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((r) => r.id)).size,
    ).toBe(21);
    const retired = uploads.find((upload) => upload.id === first.items[0]!.id)!;
    const claim = token(retired);
    await store.claimOrphanCleanup(claim);
    await store.releaseUsedAfterCleanup(claim);
    expect((await store.selectOrphanCleanup(query)).items[0]).toMatchObject({
      id: retired.id,
      state: 'finalized',
    });
    expect(
      (
        await store.selectOrphanCleanup({
          ...query,
          after: {
            state: 'finalized',
            expiresAt: retired.expiresAt,
            id: retired.id,
          },
        })
      ).items.some((r) => r.id === retired.id),
    ).toBe(false);
  });
  it('orphan physical cleanup retains used quota on failure, resumes and removes late writes without double release', async () => {
    const f = await fixture(),
      upload = await seed(f),
      store = get().uploads;
    const lease = token(upload),
      keys = new Set([upload.stagingKey, upload.finalKey]);
    let failed = true;
    const blobs = {
      async delete(key: string) {
        expect((await store.get(upload))!.policyState).toBe('deleted');
        if (failed && key === upload.finalKey)
          throw new Error('private provider failure');
        keys.delete(key);
      },
      async head(key: string) {
        return keys.has(key) ? {} : null;
      },
    } as unknown as BlobStore;
    await expect(
      cleanupOrphanUploadIntent(
        { intents: store, blobs },
        lease,
        () => lease.now,
      ),
    ).rejects.toThrow();
    await accounting(upload, 3);
    expect((await store.get(upload))!.reservationState).toBe('used');
    failed = false;
    const later = token(upload, 1001);
    await cleanupOrphanUploadIntent(
      { intents: store, blobs },
      later,
      () => later.now,
    );
    await accounting(upload, 0);
    expect(keys.size).toBe(0);
    keys.add(upload.stagingKey);
    const page = await cleanupOrphanUploadPage(
      { intents: store, blobs },
      {
        projectId: f.projectId,
        now: later.now,
        retainAfterExpiryMs,
        limit: 20,
      },
      () => later.now,
    );
    expect(page.results).toEqual([{ id: upload.id, outcome: 'released' }]);
    await accounting(upload, 0);
    expect(keys.size).toBe(0);
  });
  it('orphan used-byte release rolls back on a counter failure and resumes under the original fence', async () => {
    const f = await fixture(),
      upload = await seed(f),
      store = get().uploads,
      lease = token(upload);
    const before = await store.claimOrphanCleanup(lease);
    await f.harness.query(
      'UPDATE principal_upload_usage SET used_bytes = 0 WHERE principal_id = ?',
      [f.principalId],
    );
    await expect(store.releaseUsedAfterCleanup(lease)).rejects.toThrow();
    expect(await store.get(upload)).toEqual(before);
    expect(
      Number(
        (
          await f.harness.query(
            'SELECT used_bytes FROM project_upload_usage WHERE project_id = ?',
            [f.projectId],
          )
        )[0]!.used_bytes,
      ),
    ).toBe(3);
    await f.harness.query(
      'UPDATE principal_upload_usage SET used_bytes = 3 WHERE principal_id = ?',
      [f.principalId],
    );
    await store.releaseUsedAfterCleanup(lease);
    await accounting(upload, 0);
  });
  it('orphan multipart cleanup requires complete discovery and object absence before used-quota release', async () => {
    const f = await fixture(),
      upload = await seed(f),
      store = get().uploads,
      lease = token(upload);
    await f.harness.query(
      "INSERT INTO upload_multipart_sessions (intent_id, project_id, state, provider_upload_id, part_bytes, max_parts) VALUES (?, ?, 'completed', 'synthetic-session', 5242880, 1)",
      [upload.id, upload.projectId],
    );
    let deletes = 0,
      remaining = true;
    const blobs = {
      async delete() {
        deletes++;
      },
      async head() {
        return remaining ? {} : null;
      },
    } as unknown as BlobStore;
    await expect(
      cleanupOrphanUploadIntent(
        { intents: store, blobs },
        lease,
        () => lease.now,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    expect(deletes).toBe(0);
    await accounting(upload, 3);
    const incomplete = {
      reconcile: async () =>
        ({ key: upload.stagingKey, remainingUploads: 1 }) as never,
    };
    await expect(
      cleanupOrphanUploadIntent(
        { intents: store, blobs, multipartReconciler: incomplete },
        lease,
        () => lease.now,
      ),
    ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
    expect(deletes).toBe(0);
    await accounting(upload, 3);
    const complete = {
      reconcile: async (input: { key: string }) => ({
        key: input.key,
        remainingUploads: 0 as const,
      }),
    };
    await expect(
      cleanupOrphanUploadIntent(
        { intents: store, blobs, multipartReconciler: complete },
        lease,
        () => lease.now,
      ),
    ).rejects.toMatchObject({ code: 'BLOB_UNAVAILABLE' });
    expect(deletes).toBe(2);
    await accounting(upload, 3);
    remaining = false;
    await cleanupOrphanUploadIntent(
      { intents: store, blobs, multipartReconciler: complete },
      lease,
      () => lease.now,
    );
    expect(deletes).toBe(4);
    await accounting(upload, 0);
  });
  it('orphan cleanup page continues after a held candidate and retries without releasing other used bytes twice', async () => {
    const f = await fixture(),
      first = await seed(f),
      second = await seed(f),
      store = get().uploads;
    const now = token(first).now,
      keys = new Set([
        first.stagingKey,
        first.finalKey,
        second.stagingKey,
        second.finalKey,
      ]);
    let unavailable = true;
    const blobs = {
      async delete(key: string) {
        if (unavailable && key === first.finalKey)
          throw new Error('private provider failure');
        keys.delete(key);
      },
      async head(key: string) {
        return keys.has(key) ? {} : null;
      },
    } as unknown as BlobStore;
    const query = {
      projectId: f.projectId,
      now,
      limit: 20,
      retainAfterExpiryMs,
    };
    const initial = await cleanupOrphanUploadPage(
      { intents: store, blobs },
      query,
      () => now,
    );
    expect(initial.results.find((r) => r.id === first.id)?.outcome).toBe(
      'held',
    );
    expect(initial.results.find((r) => r.id === second.id)?.outcome).toBe(
      'released',
    );
    await accounting(first, 3);
    unavailable = false;
    const retryAt = now + 300001;
    const retry = await cleanupOrphanUploadPage(
      { intents: store, blobs },
      { ...query, now: retryAt },
      () => retryAt,
    );
    expect(retry.results).toHaveLength(2);
    expect(retry.results.every((r) => r.outcome === 'released')).toBe(true);
    await accounting(first, 0);
    expect(keys.size).toBe(0);
  });
}
