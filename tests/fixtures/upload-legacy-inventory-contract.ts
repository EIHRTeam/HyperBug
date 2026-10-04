/* eslint-disable no-await-in-loop -- Bounded sequential fixture insertion and keyset traversal. */
import { expect, it } from 'vitest';
import type {
  ContentDefinitionStore,
  UploadIntentStore,
  UploadLegacyInventoryStore,
  UploadIntentRecord,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import { seedFormSubmissionFixture } from './form-submission-contract.ts';
import { blobKey } from './blob-store-proof.ts';

export function uploadLegacyInventoryContract(
  get: () => {
    harness: RepositoryHarness;
    definitions: ContentDefinitionStore;
    uploads: UploadIntentStore;
    inventory: UploadLegacyInventoryStore;
    explain(projectId: string): Promise<Record<string, unknown>[]>;
    profile: 'd1' | 'postgres';
  },
) {
  const fixture = () =>
    seedFormSubmissionFixture(get().harness, get().definitions);
  const seed = async (
    f: Awaited<ReturnType<typeof fixture>>,
    state: UploadIntentRecord['state'] = 'pending',
    key = `unproven-historical-key/${nextId()}`,
  ) => {
    const id = nextId(),
      at = f.intent().now;
    const finalized = state === 'finalized';
    await f.harness.query(
      `INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, state, created_at, expires_at${finalized ? ', verified_object_version, verified_checksum, actual_bytes' : ''}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?${finalized ? ', ?, ?, ?' : ''})`,
      [
        id,
        f.projectId,
        f.principalId,
        key,
        'application/octet-stream',
        4,
        state,
        at,
        at + 1000,
        ...(finalized ? ['legacy-version', 'legacy-checksum', 3] : []),
      ],
    );
    return { id, projectId: f.projectId, principalId: f.principalId, key };
  };

  it('legacy inventory rejects invalid bounds/cursors and isolates projects without mutating records', async () => {
    const f = await fixture(),
      other = await fixture(),
      store = get().inventory;
    const first = await seed(f),
      foreign = await seed(other);
    const input = { projectId: f.projectId, limit: 20 };
    for (const limit of [0, 21, 1.5, Number.NaN])
      await expect(store.inspect({ ...input, limit })).rejects.toThrow();
    await expect(
      store.inspect({ ...input, after: 'invalid' }),
    ).rejects.toThrow();
    const page = await store.inspect(input);
    expect(page.scanned).toBe(1);
    expect(page.items.map((r) => r.id)).toEqual([first.id]);
    expect(page.items.some((r) => r.id === foreign.id)).toBe(false);
    expect(await store.inspect({ projectId: nextId(), limit: 20 })).toEqual({
      items: [],
      scanned: 0,
      next: null,
    });
    expect(await store.inspect({ ...input, after: first.id })).toEqual({
      items: [],
      scanned: 0,
      next: null,
    });
    expect(await get().uploads.get(first)).toBeNull();
  });

  it('legacy inventory limits base rows before classification and advances through empty current-only pages', async () => {
    const f = await fixture(),
      store = get().inventory,
      uploads = get().uploads,
      at = f.intent().now;
    for (let i = 0; i < 20; i++)
      await uploads.reserve({
        id: nextId(),
        projectId: f.projectId,
        principalId: f.principalId,
        stagingKey: blobKey(),
        finalKey: blobKey('objects'),
        filename: 'current.bin',
        contentType: 'application/octet-stream',
        maxBytes: 1,
        association: { kind: 'issue-draft', draftId: nextId() },
        now: at,
        expiresAt: at + 1000,
      });
    const legacy = await seed(f);
    const first = await store.inspect({ projectId: f.projectId, limit: 20 });
    expect(first).toMatchObject({ items: [], scanned: 20 });
    expect(first.next).not.toBeNull();
    const second = await store.inspect({
      projectId: f.projectId,
      limit: 20,
      after: first.next!,
    });
    expect(second).toMatchObject({ scanned: 1, next: null });
    expect(second.items.map((r) => r.id)).toEqual([legacy.id]);
    const usage = await f.harness.query(
      'SELECT reserved_bytes, used_bytes, reserved_count FROM project_upload_usage WHERE project_id = ?',
      [f.projectId],
    );
    expect(
      usage.map((r) => [
        Number(r.reserved_bytes),
        Number(r.used_bytes),
        Number(r.reserved_count),
      ]),
    ).toEqual([[20, 0, 20]]);
  });

  it('legacy inventory preserves every state and arbitrary historical identity without implicitly adopting or cleaning it', async () => {
    const f = await fixture(),
      store = get().inventory,
      uploads = get().uploads;
    const states = [
      'pending',
      'uploaded',
      'finalized',
      'expired',
      'rejected',
    ] as const;
    const records = [];
    for (const state of states) records.push(await seed(f, state));
    for (const [table, column, id] of [
      ['project_upload_usage', 'project_id', f.projectId],
      ['principal_upload_usage', 'principal_id', f.principalId],
    ] as const)
      await f.harness.query(
        `INSERT INTO ${table} (${column}, reserved_bytes, used_bytes, reserved_count) VALUES (?, 16, 3, 4)`,
        [id],
      );
    const before = await f.harness.query(
      'SELECT * FROM upload_intents WHERE project_id = ? ORDER BY id',
      [f.projectId],
    );
    const page = await store.inspect({ projectId: f.projectId, limit: 20 });
    expect(page.scanned).toBe(5);
    expect(page.next).toBeNull();
    expect(page.items.map((r) => r.state)).toEqual(states);
    expect(page.items.map((r) => r.objectKey)).toEqual(
      records.map((r) => r.key),
    );
    expect(page.items[2]).toMatchObject({
      actualBytes: 3,
      objectVersion: 'legacy-version',
      checksum: 'legacy-checksum',
      hasAttachment: false,
    });
    for (const record of records) expect(await uploads.get(record)).toBeNull();
    expect(
      (
        await uploads.selectCleanup({
          projectId: f.projectId,
          now: f.intent().now + 900000,
          limit: 20,
        })
      ).items,
    ).toEqual([]);
    expect(
      (
        await uploads.selectOrphanCleanup({
          projectId: f.projectId,
          now: f.intent().now + 900000,
          limit: 20,
          retainAfterExpiryMs: 300000,
        })
      ).items,
    ).toEqual([]);
    expect(
      await f.harness.query(
        'SELECT * FROM upload_intents WHERE project_id = ? ORDER BY id',
        [f.projectId],
      ),
    ).toEqual(before);
    for (const [table, column, id] of [
      ['project_upload_usage', 'project_id', f.projectId],
      ['principal_upload_usage', 'principal_id', f.principalId],
    ] as const) {
      const rows = await f.harness.query(
        `SELECT reserved_bytes, used_bytes, reserved_count FROM ${table} WHERE ${column} = ?`,
        [id],
      );
      expect(
        rows.map((r) => [
          Number(r.reserved_bytes),
          Number(r.used_bytes),
          Number(r.reserved_count),
        ]),
      ).toEqual([[16, 3, 4]]);
    }
  });

  it('legacy inventory reports attachment presence even when the parent is hidden or deleted', async () => {
    const f = await fixture(),
      legacy = await seed(f, 'finalized'),
      issue = await f.harness.repository.createIssue(f.intent());
    await f.harness.query(
      "INSERT INTO attachments (id, project_id, upload_intent_id, issue_id, object_key, object_version, checksum, media_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, 'legacy-version', 'legacy-checksum', 'application/octet-stream', 3, ?)",
      [
        nextId(),
        f.projectId,
        legacy.id,
        issue.result.id,
        legacy.key,
        f.intent().now,
      ],
    );
    for (const state of ['visible', 'hidden', 'deleted']) {
      if (state === 'deleted')
        await f.harness.query(
          "UPDATE issues SET moderation = 'hidden', deleted_at = ? WHERE id = ?",
          [f.intent().now, issue.result.id],
        );
      else
        await f.harness.query(
          'UPDATE issues SET moderation = ?, deleted_at = NULL WHERE id = ?',
          [state, issue.result.id],
        );
      const page = await get().inventory.inspect({
        projectId: f.projectId,
        limit: 20,
      });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({
        id: legacy.id,
        hasAttachment: true,
      });
    }
    expect(await get().uploads.get(legacy)).toBeNull();
  });

  it('legacy inventory verifies the limited base query before lifecycle/attachment lookup on the actual database', async () => {
    const f = await fixture();
    for (let i = 0; i < 25; i++) await seed(f);
    const page = await get().inventory.inspect({
      projectId: f.projectId,
      limit: 20,
    });
    expect(page.items).toHaveLength(20);
    expect(page.scanned).toBe(20);
    expect(page.next).toBe(page.items.at(-1)!.id);
    const rows = await get().explain(f.projectId);
    if (get().profile === 'd1') {
      const plan = rows.map((row) => String(row.detail)).join('\n');
      expect(plan).toContain('(project_id=? AND id>?)');
      expect(plan).not.toContain('SCAN upload_intents');
      expect(plan).toContain('LEFT-JOIN');
    } else {
      const plan = rows[0]!['QUERY PLAN'] as {
        Plan: Record<string, unknown>;
      }[];
      const findLimits = (
        node: Record<string, unknown>,
      ): Record<string, unknown>[] => [
        ...(node['Node Type'] === 'Limit' ? [node] : []),
        ...((node.Plans ?? []) as Record<string, unknown>[]).flatMap(
          findLimits,
        ),
      ];
      const limits = findLimits(plan[0]!.Plan);
      expect(limits).toHaveLength(1);
      expect(limits[0]!['Actual Rows']).toBe(21);
      expect(limits[0]!['Actual Loops']).toBe(1);
      expect(plan[0]!.Plan['Actual Rows']).toBe(21);
    }
  });
}
