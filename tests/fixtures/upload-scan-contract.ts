import { it, expect } from 'vitest';
import {
  attachmentScanPolicyVersion,
  type UploadIntentStore,
  type UploadIntentRecord,
  type ScanOutcome,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';
import { blobKey } from './blob-store-proof.ts';
const now = 1791000000000;
export const syntheticClean = {
  status: 'clean',
  evidence: {
    engine: 'synthetic-test-scanner',
    engineVersion: 'fixture-1',
    signatureVersion: 'fixture-1',
  },
} satisfies ScanOutcome;
export function uploadScanContract(
  get: () => { harness: RepositoryHarness; store: UploadIntentStore },
) {
  const query = (sql: string, args: (string | number)[] = []) =>
    get().harness.query(sql, args);
  async function fixture() {
    const projectId = nextId(),
      principalId = nextId();
    await query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [projectId, `scan-${projectId}`, 'Scan', now, now],
    );
    await query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Scan', ?)",
      [principalId, now],
    );
    const input = {
      id: nextId(),
      projectId,
      principalId,
      stagingKey: blobKey(),
      finalKey: blobKey('objects'),
      filename: 'fixture.bin',
      contentType: 'application/octet-stream',
      maxBytes: 4,
      now,
      expiresAt: now + 60000,
      association: { kind: 'issue-draft' as const, draftId: nextId() },
    };
    const store = get().store;
    await store.reserve(input);
    await store.requestFinalize(input, now);
    const token = { ...input, leaseId: nextId(), leaseExpiresAt: now + 1000 };
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
    return { input, store, token: { ...token, leaseId: nextId() } };
  }
  const claim = async (f: Awaited<ReturnType<typeof fixture>>) =>
    f.store.mutateScan({
      ...f.token,
      kind: 'claim',
      policyVersion: attachmentScanPolicyVersion,
    });
  const accounting = async (input: {
    projectId: string;
    principalId: string;
  }) => {
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
      ]).toEqual([0, 3, 0]);
    }
  };
  it('scan claims have one winner and an expired worker cannot overwrite a newer result', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        f.store.mutateScan({
          ...f.token,
          leaseId: nextId(),
          kind: 'claim',
          policyVersion: attachmentScanPolicyVersion,
        }),
      ),
    );
    const winner = results.find(
      (r): r is PromiseFulfilledResult<UploadIntentRecord> =>
        r.status === 'fulfilled',
    )!.value;
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const newer = {
      ...f.token,
      leaseId: nextId(),
      now: now + 1000,
      leaseExpiresAt: now + 2000,
    };
    await f.store.mutateScan({
      ...newer,
      kind: 'claim',
      policyVersion: attachmentScanPolicyVersion,
    });
    await expect(
      f.store.mutateScan({
        ...f.token,
        leaseId: winner.leaseId!,
        now: now + 1001,
        kind: 'commit',
        outcome: syntheticClean,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
    expect(await f.store.get(f.input)).toMatchObject({
      scanStatus: 'pending',
      policyState: 'quarantined',
      scan: { attemptId: newer.leaseId },
    });
    await accounting(f.input);
  });
  it('scan result and release are separate idempotent fenced transactions bound to immutable identity and current policy', async () => {
    const f = await fixture();
    await claim(f);
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        f.store.mutateScan({
          ...f.token,
          kind: 'commit',
          outcome: syntheticClean,
        }),
      ),
    );
    expect(
      outcomes.every(
        (r) => r.scanStatus === 'clean' && r.policyState === 'quarantined',
      ),
    ).toBe(true);
    const before = (await f.store.get(f.input))!;
    await expect(
      f.store.mutateScan({
        ...f.token,
        kind: 'release',
        attemptId: nextId(),
        policyVersion: attachmentScanPolicyVersion,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    await expect(
      f.store.mutateScan({
        ...f.token,
        kind: 'release',
        attemptId: f.token.leaseId,
        policyVersion: 'future-policy',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    await Promise.all(
      Array.from({ length: 8 }, () =>
        f.store.mutateScan({
          ...f.token,
          kind: 'release',
          attemptId: f.token.leaseId,
          policyVersion: attachmentScanPolicyVersion,
        }),
      ),
    );
    expect(await f.store.get(f.input)).toMatchObject({
      scanStatus: 'clean',
      policyState: 'ready',
      leaseId: null,
      revision: before.revision + 1,
    });
    for (const sql of [
      "UPDATE upload_scan_results SET policy_version = 'changed' WHERE intent_id = ?",
      'DELETE FROM upload_scan_results WHERE intent_id = ?',
      "UPDATE upload_intents SET verified_checksum = '" +
        'b'.repeat(64) +
        "' WHERE id = ?",
    ])
      await expect(query(sql, [f.input.id])).rejects.toThrow();
    await accounting(f.input);
  });
  it('scan clean results survive a release crash but a new scan attempt invalidates stale release', async () => {
    const f = await fixture();
    await claim(f);
    await f.store.mutateScan({
      ...f.token,
      kind: 'commit',
      outcome: syntheticClean,
    });
    const recovered = {
      ...f.token,
      leaseId: nextId(),
      now: now + 1000,
      leaseExpiresAt: now + 2000,
    };
    await f.store.mutateScan({
      ...recovered,
      kind: 'release',
      attemptId: f.token.leaseId,
      policyVersion: attachmentScanPolicyVersion,
    });
    const rescan = { ...recovered, leaseId: nextId() };
    await f.store.mutateScan({
      ...rescan,
      kind: 'claim',
      policyVersion: 'future-policy',
    });
    await expect(
      f.store.mutateScan({
        ...rescan,
        kind: 'release',
        attemptId: f.token.leaseId,
        policyVersion: attachmentScanPolicyVersion,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
    expect(await f.store.get(f.input)).toMatchObject({
      scanStatus: 'pending',
      policyState: 'quarantined',
    });
    await accounting(f.input);
  });
  it.each(['infected', 'failed', 'identity'] as const)(
    'scan %s never releases content or reduces used quota',
    async (kind) => {
      const f = await fixture();
      await claim(f);
      const outcome: ScanOutcome =
        kind === 'infected'
          ? { ...syntheticClean, status: 'infected' }
          : {
              status: 'failed',
              failure: kind === 'identity' ? 'identity' : 'unavailable',
            };
      await f.store.mutateScan({ ...f.token, kind: 'commit', outcome });
      await expect(
        f.store.mutateScan({
          ...f.token,
          kind: 'release',
          attemptId: f.token.leaseId,
          policyVersion: attachmentScanPolicyVersion,
        }),
      ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
      expect(await f.store.get(f.input)).toMatchObject({
        scanStatus: kind === 'infected' ? 'infected' : 'failed',
        policyState: kind === 'failed' ? 'quarantined' : 'rejected',
        leaseId: null,
      });
      await accounting(f.input);
    },
  );
  it('scan writes reject foreign scope, malformed evidence and current permission loss', async () => {
    const f = await fixture();
    for (const scope of [
      { ...f.token, principalId: nextId() },
      { ...f.token, projectId: nextId() },
    ])
      await expect(
        f.store.mutateScan({
          ...scope,
          kind: 'claim',
          policyVersion: attachmentScanPolicyVersion,
        }),
      ).rejects.toMatchObject({ code: 'UPLOAD_NOT_FOUND' });
    await claim(f);
    await expect(
      f.store.mutateScan({
        ...f.token,
        kind: 'commit',
        outcome: {
          status: 'clean',
          evidence: { engine: 'x', engineVersion: '', signatureVersion: 'x' },
        },
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID' });
    await query("UPDATE principals SET status = 'suspended' WHERE id = ?", [
      f.input.principalId,
    ]);
    await expect(
      f.store.mutateScan({
        ...f.token,
        kind: 'commit',
        outcome: syntheticClean,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
    await query("UPDATE principals SET status = 'active' WHERE id = ?", [
      f.input.principalId,
    ]);
    await f.store.mutateScan({
      ...f.token,
      kind: 'commit',
      outcome: syntheticClean,
    });
    await query("UPDATE projects SET visibility = 'private' WHERE id = ?", [
      f.input.projectId,
    ]);
    await expect(
      f.store.mutateScan({
        ...f.token,
        kind: 'release',
        attemptId: f.token.leaseId,
        policyVersion: attachmentScanPolicyVersion,
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
    expect(await f.store.get(f.input)).toMatchObject({
      scanStatus: 'clean',
      policyState: 'quarantined',
    });
    await accounting(f.input);
  });
  it('scan database guards reject ready state without a completed matching clean result', async () => {
    const f = await fixture();
    await expect(
      query(
        'UPDATE upload_intent_details SET final_key = ? WHERE intent_id = ?',
        [blobKey('objects'), f.input.id],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        "UPDATE upload_intent_details SET provider_version = 'changed' WHERE intent_id = ?",
        [f.input.id],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        "UPDATE upload_intent_details SET policy_state = 'ready' WHERE intent_id = ?",
        [f.input.id],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        "UPDATE upload_intent_details SET scan_status = 'clean', policy_state = 'ready' WHERE intent_id = ?",
        [f.input.id],
      ),
    ).rejects.toThrow();
    await claim(f);
    await expect(
      query(
        "UPDATE upload_intent_details SET scan_status = 'clean', policy_state = 'ready' WHERE intent_id = ?",
        [f.input.id],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        "UPDATE upload_scan_results SET status = 'clean' WHERE intent_id = ?",
        [f.input.id],
      ),
    ).rejects.toThrow();
    await expect(
      query(
        'UPDATE upload_scan_results SET project_id = ? WHERE intent_id = ?',
        [nextId(), f.input.id],
      ),
    ).rejects.toThrow();
    expect(await f.store.get(f.input)).toMatchObject({
      scanStatus: 'pending',
      policyState: 'quarantined',
    });
  });
}
