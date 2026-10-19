import { it, expect } from 'vitest';
import {
  cleanupUploadPage,
  type BlobStore,
  type UploadIntentStore,
  type UploadQuotaPolicy,
  type ReserveUpload,
  type UploadIntentRecord,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import { blobKey } from './blob-store-proof.ts';
const now = 1791000000000;
export const uploadTestQuota: UploadQuotaPolicy = {
  maxFileBytes: 4,
  projectBytes: 8,
  principalBytes: 8,
  projectPending: 4,
  principalPending: 4,
};
export function uploadIntentContract(
  get: () => { harness: RepositoryHarness; store: UploadIntentStore },
) {
  const query = (sql: string, args: (string | number)[] = []) =>
    get().harness.query(sql, args);
  async function project() {
    const id = nextId();
    await query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, `upload-${id}`, 'Uploads', now, now],
    );
    return id;
  }
  async function principal() {
    const id = nextId();
    await query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Uploader', ?)",
      [id, now],
    );
    return id;
  }
  function input(projectId: string, principalId: string): ReserveUpload {
    return {
      id: nextId(),
      projectId,
      principalId,
      stagingKey: blobKey(),
      finalKey: blobKey('objects'),
      filename: 'fixture.bin',
      contentType: 'application/octet-stream',
      maxBytes: 4,
      association: { kind: 'issue-draft', draftId: nextId() },
      now,
      expiresAt: now + 60000,
    };
  }
  const usage = async (kind: 'project' | 'principal', id: string) =>
    (
      await query(
        `SELECT reserved_bytes, used_bytes, reserved_count FROM ${kind}_upload_usage WHERE ${kind}_id = ?`,
        [id],
      )
    ).map((row) => ({
      reserved: Number(row.reserved_bytes),
      used: Number(row.used_bytes),
      count: Number(row.reserved_count),
    }));
  it('cleanup selection bounds pages and excludes future, live leased, legacy and verified used objects', async () => {
    const store = get().store,
      projectId = await project(),
      actor = await principal();
    const intents = Array.from({ length: 7 }, () => ({
      ...input(projectId, actor),
      maxBytes: 1,
    }));
    const sweepAt = intents[0]!.expiresAt + 300000;
    for (const [index, intent] of intents.entries()) {
      await store.reserve(intent);
      if (index < 3) {
        const lease = {
          ...intent,
          leaseId: nextId(),
          now: sweepAt,
          leaseExpiresAt: sweepAt + 1000,
        };
        await store.claimCleanup(lease);
        await store.releaseQuotaAfterCleanup(lease);
      }
    }
    await query('UPDATE upload_intents SET expires_at = ? WHERE id = ?', [
      sweepAt + 1,
      intents[3]!.id,
    ]);
    await store.claimCleanup({
      ...intents[4]!,
      leaseId: nextId(),
      now: sweepAt,
      leaseExpiresAt: sweepAt + 1000,
    });
    const verified = intents[5]!;
    await store.requestFinalize(verified, now);
    const lease = {
      ...verified,
      leaseId: nextId(),
      now,
      leaseExpiresAt: now + 1000,
    };
    await store.claim(lease);
    await store.commitVerified({
      ...lease,
      verified: {
        key: verified.finalKey,
        size: 1,
        sha256: 'c'.repeat(64),
        contentType: verified.contentType,
        providerVersion: null,
        scanStatus: 'unscanned',
      },
    });
    await query('DELETE FROM upload_intent_details WHERE intent_id = ?', [
      intents[6]!.id,
    ]);
    const first = await store.selectCleanup({
      projectId,
      now: sweepAt,
      limit: 2,
    });
    expect(first.items).toHaveLength(2);
    expect(first.next).not.toBeNull();
    const second = await store.selectCleanup({
      projectId,
      now: sweepAt,
      limit: 2,
      after: first.next!,
    });
    expect(second.items).toHaveLength(1);
    expect(second.next).toBeNull();
    expect(
      [...first.items, ...second.items].map((row) => row.id).sort(),
    ).toEqual(
      intents
        .slice(0, 3)
        .map((row) => row.id)
        .sort(),
    );
    expect(Object.keys(first.items[0]!).sort()).toEqual([
      'expiresAt',
      'id',
      'principalId',
      'projectId',
      'state',
    ]);
    expect(
      (
        await store.selectCleanup({
          projectId: await project(),
          now: sweepAt,
          limit: 2,
        })
      ).items,
    ).toEqual([]);
    for (const limit of [0, 21, 1.5])
      await expect(
        store.selectCleanup({ projectId, now: sweepAt, limit }),
      ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
  });
  it('cleanup page continues after storage failure, resumes and resweeps released late-write tombstones', async () => {
    const store = get().store,
      projectId = await project(),
      actor = await principal();
    const records = Array.from({ length: 3 }, () => ({
      ...input(projectId, actor),
      maxBytes: 1,
    }));
    for (const record of records) await store.reserve(record);
    const sweepAt = records[0]!.expiresAt + 300000;
    const selected = await store.selectCleanup({
      projectId,
      now: sweepAt,
      limit: 2,
    });
    const failed = records.find(
      (record) => record.id === selected.items[0]!.id,
    )!;
    const objects = new Set(records.map((record) => record.stagingKey));
    let fail = true;
    const blobs = {
      delete: async (key: string) => {
        if (fail && key === failed.stagingKey)
          throw new Error('private provider detail');
        objects.delete(key);
      },
      head: async (key: string) => (objects.has(key) ? {} : null),
    } as unknown as BlobStore;
    const first = await cleanupUploadPage(
      { intents: store, blobs },
      { projectId, now: sweepAt, limit: 2 },
      () => sweepAt,
    );
    expect(first.results.map((row) => row.outcome)).toEqual([
      'held',
      'released',
    ]);
    const second = await cleanupUploadPage(
      { intents: store, blobs },
      { projectId, now: sweepAt, limit: 2, after: first.next! },
      () => sweepAt,
    );
    expect(second.results).toHaveLength(1);
    expect(second.results[0]!.outcome).toBe('released');
    expect(await usage('project', projectId)).toEqual([
      { reserved: 1, used: 0, count: 1 },
    ]);
    fail = false;
    for (const record of records) objects.add(record.stagingKey);
    const later = sweepAt + 300001;
    let cursor: typeof first.next = null;
    const outcomes: { id: string; outcome: string }[] = [];
    do {
      const page = await cleanupUploadPage(
        { intents: store, blobs },
        {
          projectId,
          now: later,
          limit: 2,
          ...(cursor ? { after: cursor } : {}),
        },
        () => later,
      );
      outcomes.push(...page.results);
      cursor = page.next;
    } while (cursor);
    expect(outcomes).toHaveLength(3);
    expect(outcomes.every((row) => row.outcome === 'released')).toBe(true);
    expect(objects.size).toBe(0);
    expect(await usage('project', projectId)).toEqual([
      { reserved: 0, used: 0, count: 0 },
    ]);
    expect(
      (await store.selectCleanup({ projectId, now: later, limit: 20 })).items
        .map((row) => row.id)
        .sort(),
    ).toEqual(records.map((row) => row.id).sort());
  });
  it('atomically enforces the global principal quota across concurrent projects', async () => {
    const store = get().store;
    const projects = [await project(), await project()];
    const actor = await principal();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        store.reserve(input(projects[i % 2]!, actor)),
      ),
    );
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    for (const result of outcomes)
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'UPLOAD_QUOTA' });
    expect(await usage('principal', actor)).toEqual([
      { reserved: 8, used: 0, count: 2 },
    ]);
    const sums = await Promise.all(projects.map((id) => usage('project', id)));
    expect(sums.flat().reduce((n, row) => n + row.reserved, 0)).toBe(8);
  });
  it('atomically enforces the project quota across concurrent principals', async () => {
    const store = get().store;
    const projectId = await project();
    const actors = await Promise.all(Array.from({ length: 8 }, principal));
    const outcomes = await Promise.allSettled(
      actors.map((actor) => store.reserve(input(projectId, actor))),
    );
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    expect(await usage('project', projectId)).toEqual([
      { reserved: 8, used: 0, count: 2 },
    ]);
    const sums = await Promise.all(actors.map((id) => usage('principal', id)));
    expect(sums.flat().reduce((n, row) => n + row.reserved, 0)).toBe(8);
  });

  it('enforces the global principal pending-slot limit independently of the byte quota', async () => {
    const store = get().store,
      actor = await principal(),
      projects = [await project(), await project()];
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        store.reserve({ ...input(projects[index % 2]!, actor), maxBytes: 1 }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(4);
    expect(await usage('principal', actor)).toEqual([
      { reserved: 4, used: 0, count: 4 },
    ]);
    for (const result of results)
      if (result.status === 'rejected')
        expect(result.reason).toMatchObject({ code: 'UPLOAD_QUOTA' });
  });
  it('enforces the project pending-slot limit independently across principals', async () => {
    const store = get().store,
      projectId = await project(),
      actors = await Promise.all(Array.from({ length: 8 }, principal));
    const results = await Promise.allSettled(
      actors.map((actor) =>
        store.reserve({ ...input(projectId, actor), maxBytes: 1 }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(4);
    expect(await usage('project', projectId)).toEqual([
      { reserved: 4, used: 0, count: 4 },
    ]);
  });
  it('replays one reservation without double counting and scopes every read to its owner/project', async () => {
    const store = get().store;
    const projectId = await project();
    const actor = await principal();
    const reserved = input(projectId, actor);
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => store.reserve(reserved)),
    );
    expect(outcomes.every((r) => r.id === reserved.id)).toBe(true);
    expect(await usage('project', projectId)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
    expect(
      await store.get({ ...reserved, projectId: await project() }),
    ).toBeNull();
    expect(
      await store.get({ ...reserved, principalId: await principal() }),
    ).toBeNull();
    await expect(
      store.reserve({ ...reserved, filename: 'changed.bin' }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    expect(await usage('principal', actor)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
  });
  it('rolls back quotas and intent creation when the association belongs to another project', async () => {
    const store = get().store;
    const projectId = await project();
    const other = await project();
    const actor = await principal();
    const issue = nextId();
    await query(
      "INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, 1, 'Target', '', ?, ?, ?, ?)",
      [issue, other, actor, now, now, nextId()],
    );
    const reserved = {
      ...input(projectId, actor),
      association: { kind: 'issue' as const, issueId: issue },
    };
    await expect(store.reserve(reserved)).rejects.toMatchObject({
      code: 'UPLOAD_FORBIDDEN',
    });
    expect(await store.get(reserved)).toBeNull();
    expect(await usage('project', projectId)).toEqual([]);
    expect(await usage('principal', actor)).toEqual([]);
  });
  it('rejects expired requests and rechecks principal suspension/project archive on writes', async () => {
    const store = get().store;
    const projectId = await project();
    const actor = await principal();
    const reserved = input(projectId, actor);
    await store.reserve(reserved);
    await expect(
      store.requestFinalize(reserved, reserved.expiresAt),
    ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
    await query("UPDATE principals SET status = 'suspended' WHERE id = ?", [
      actor,
    ]);
    await expect(store.requestFinalize(reserved, now)).rejects.toMatchObject({
      code: 'UPLOAD_FORBIDDEN',
    });
    await query("UPDATE principals SET status = 'active' WHERE id = ?", [
      actor,
    ]);
    await store.requestFinalize(reserved, now);
    await query("UPDATE projects SET status = 'archived' WHERE id = ?", [
      projectId,
    ]);
    await expect(
      store.claim({
        ...reserved,
        leaseId: nextId(),
        now,
        leaseExpiresAt: now + 1000,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
    expect(await usage('project', projectId)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
  });
  it('fences leases and commits verified-byte accounting once under concurrency, without scan/release claims', async () => {
    const store = get().store;
    const projectId = await project();
    const actor = await principal();
    const reserved = input(projectId, actor);
    await store.reserve(reserved);
    await store.requestFinalize(reserved, now);
    const leases = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        store.claim({
          ...reserved,
          leaseId: nextId(),
          now,
          leaseExpiresAt: now + 1000,
        }),
      ),
    );
    const winners = leases.filter(
      (r): r is PromiseFulfilledResult<UploadIntentRecord> =>
        r.status === 'fulfilled',
    );
    expect(winners).toHaveLength(1);
    const stale = winners[0]!.value.leaseId!;
    const leaseId = nextId();
    await store.claim({
      ...reserved,
      leaseId,
      now: now + 1000,
      leaseExpiresAt: now + 2000,
    });
    const verified = {
      key: reserved.finalKey,
      size: 3,
      sha256: 'a'.repeat(64),
      contentType: reserved.contentType,
      providerVersion: null,
      scanStatus: 'unscanned' as const,
    };
    await expect(
      store.commitVerified({
        ...reserved,
        verified,
        leaseId: stale,
        now: now + 1001,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    await expect(
      store.commitVerified({
        ...reserved,
        verified: { ...verified, key: blobKey('objects') },
        leaseId,
        now: now + 1001,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    expect(await usage('project', projectId)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        store.commitVerified({
          ...reserved,
          verified,
          leaseId,
          now: now + 1001,
        }),
      ),
    );
    expect(
      outcomes.every(
        (r) =>
          r.state === 'finalized' &&
          r.verified?.scanStatus === 'unscanned' &&
          r.verified.providerVersion === null,
      ),
    ).toBe(true);
    expect(await usage('project', projectId)).toEqual([
      { reserved: 0, used: 3, count: 0 },
    ]);
    expect(await usage('principal', actor)).toEqual([
      { reserved: 0, used: 3, count: 0 },
    ]);
    expect(
      (
        await query(
          'SELECT policy_state, scan_status, reservation_state FROM upload_intent_details WHERE intent_id = ?',
          [reserved.id],
        )
      )[0],
    ).toEqual({
      policy_state: 'quarantined',
      scan_status: 'unscanned',
      reservation_state: 'used',
    });
    expect(
      (
        await query(
          'SELECT verified_object_version FROM upload_intents WHERE id = ?',
          [reserved.id],
        )
      )[0],
    ).toEqual({ verified_object_version: `sha256:${verified.sha256}` });
    await store.reserve(input(projectId, actor));
    await expect(store.reserve(input(projectId, actor))).rejects.toMatchObject({
      code: 'UPLOAD_QUOTA',
    });
    expect(await usage('principal', actor)).toEqual([
      { reserved: 4, used: 3, count: 1 },
    ]);
  });
  it('expires processing requests and verification even when a lease extends beyond intent expiry', async () => {
    const store = get().store;
    const reserved = input(await project(), await principal());
    await store.reserve(reserved);
    await store.requestFinalize(reserved, now);
    const lease = {
      ...reserved,
      leaseId: nextId(),
      now: reserved.expiresAt - 1,
      leaseExpiresAt: reserved.expiresAt + 1000,
    };
    await store.claim(lease);
    await expect(
      store.requestFinalize(reserved, reserved.expiresAt),
    ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
    await expect(
      store.commitVerified({
        ...lease,
        now: reserved.expiresAt,
        verified: {
          key: reserved.finalKey,
          size: 3,
          sha256: 'b'.repeat(64),
          contentType: reserved.contentType,
          providerVersion: null,
          scanStatus: 'unscanned',
        },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
    expect(await usage('principal', reserved.principalId)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
  });
  it('retains rejected reservations until fenced cleanup and releases exactly once, preserving later leases', async () => {
    const store = get().store;
    const reserved = input(await project(), await principal());
    await store.reserve(reserved);
    await store.requestFinalize(reserved, now);
    const process = {
      ...reserved,
      leaseId: nextId(),
      now,
      leaseExpiresAt: now + 1000,
    };
    await store.claim(process);
    const rejected = await store.rejectVerification(process);
    expect(rejected).toMatchObject({
      state: 'rejected',
      scanStatus: 'unscanned',
      policyState: 'rejected',
      reservationState: 'reserved',
    });
    const cleanup = {
      ...reserved,
      leaseId: nextId(),
      now: reserved.expiresAt + 300000,
      leaseExpiresAt: reserved.expiresAt + 301000,
    };
    await expect(
      store.claimCleanup({ ...cleanup, now: cleanup.now - 1 }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    const claims = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        store.claimCleanup({
          ...cleanup,
          leaseId: index === 0 ? cleanup.leaseId : nextId(),
        }),
      ),
    );
    const winner = claims.find(
      (r): r is PromiseFulfilledResult<UploadIntentRecord> =>
        r.status === 'fulfilled',
    )!.value;
    expect(claims.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const release = { ...cleanup, leaseId: winner.leaseId! };
    await expect(
      store.releaseQuotaAfterCleanup({ ...release, leaseId: nextId() }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    await Promise.all(
      Array.from({ length: 8 }, () => store.releaseQuotaAfterCleanup(release)),
    );
    for (const kind of ['principal', 'project'] as const)
      expect(
        await usage(
          kind,
          kind === 'project' ? reserved.projectId : reserved.principalId,
        ),
      ).toEqual([{ reserved: 0, used: 0, count: 0 }]);
    const later = {
      ...cleanup,
      leaseId: nextId(),
      now: cleanup.now + 1001,
      leaseExpiresAt: cleanup.now + 2000,
    };
    await store.claimCleanup(later);
    await store.releaseQuotaAfterCleanup(release);
    expect((await store.get(reserved))!.leaseId).toBe(later.leaseId);
    expect((await store.releaseQuotaAfterCleanup(later)).leaseId).toBeNull();
  });
  it('checks current content ownership, moderation and deletion on reservation and verification', async () => {
    const store = get().store;
    const projectId = await project(),
      actor = await principal(),
      other = await principal(),
      issue = nextId(),
      comment = nextId();
    await query(
      "INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, 1, 'Target', '', ?, ?, ?, ?)",
      [issue, projectId, other, now, now, nextId()],
    );
    const foreign = {
      ...input(projectId, actor),
      association: { kind: 'issue' as const, issueId: issue },
    };
    await expect(store.reserve(foreign)).rejects.toMatchObject({
      code: 'UPLOAD_FORBIDDEN',
    });
    await query(
      "INSERT INTO comments (id, project_id, issue_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, '', ?, ?)",
      [comment, projectId, issue, actor, now, now],
    );
    const reserved = {
      ...input(projectId, actor),
      association: { kind: 'comment' as const, commentId: comment },
    };
    await store.reserve(reserved);
    await store.requestFinalize(reserved, now);
    const lease = {
      ...reserved,
      leaseId: nextId(),
      now,
      leaseExpiresAt: now + 1000,
    };
    await store.claim(lease);
    await query("UPDATE issues SET moderation = 'hidden' WHERE id = ?", [
      issue,
    ]);
    await expect(
      store.commitVerified({
        ...lease,
        verified: {
          key: reserved.finalKey,
          size: 1,
          sha256: 'c'.repeat(64),
          contentType: reserved.contentType,
          providerVersion: null,
          scanStatus: 'unscanned',
        },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
    await expect(
      store.reserve({
        ...input(projectId, actor),
        association: {
          kind: 'comment-draft',
          draftId: nextId(),
          issueId: issue,
        },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
    await query("UPDATE principals SET kind = 'staff' WHERE id = ?", [actor]);
    await query(
      "INSERT INTO project_roles (project_id, principal_id, role, granted_at) VALUES (?, ?, 'maintainer', ?)",
      [projectId, actor, now],
    );
    await expect(store.requestFinalize(reserved, now)).resolves.toMatchObject({
      state: 'uploaded',
    });
    await query('UPDATE comments SET deleted_at = ? WHERE id = ?', [
      now,
      comment,
    ]);
    await expect(store.requestFinalize(reserved, now)).rejects.toMatchObject({
      code: 'UPLOAD_FORBIDDEN',
    });
    expect(await usage('project', projectId)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
  });
  it('denies public Users on private projects and rechecks revoked Staff membership', async () => {
    const store = get().store;
    const reserved = input(await project(), await principal());
    await query("UPDATE projects SET visibility = 'private' WHERE id = ?", [
      reserved.projectId,
    ]);
    await expect(store.reserve(reserved)).rejects.toMatchObject({
      code: 'UPLOAD_FORBIDDEN',
    });
    await query("UPDATE principals SET kind = 'staff' WHERE id = ?", [
      reserved.principalId,
    ]);
    await query(
      "INSERT INTO project_roles (project_id, principal_id, role, granted_at) VALUES (?, ?, 'triage', ?)",
      [reserved.projectId, reserved.principalId, now],
    );
    await store.reserve(reserved);
    await query(
      'DELETE FROM project_roles WHERE project_id = ? AND principal_id = ?',
      [reserved.projectId, reserved.principalId],
    );
    await expect(store.requestFinalize(reserved, now)).rejects.toMatchObject({
      code: 'UPLOAD_FORBIDDEN',
    });
    expect(await usage('project', reserved.projectId)).toEqual([
      { reserved: 4, used: 0, count: 1 },
    ]);
  });
}
