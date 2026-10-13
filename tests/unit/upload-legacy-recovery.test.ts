import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  recoverLegacyUploadPage,
  uploadLegacyRecoveryVersion,
  type UploadLegacyRecoveryAbsence,
  type UploadLegacyRecoveryDecision,
  type UploadLegacyRecoveryRecord,
  type UploadLegacyRecoveryStore,
} from '@hyperbug/application';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 4));
});
afterEach(() => vi.useRealTimers());

function fixture(count = 2, hasNext = false) {
  const now = Date.now(),
    projectId = crypto.randomUUID(),
    principalId = crypto.randomUUID();
  const records: UploadLegacyRecoveryRecord[] = Array.from(
    { length: count },
    () => {
      const id = crypto.randomUUID();
      return {
        id,
        projectId,
        principalId,
        state: 'deleting',
        revision: 1,
        leaseId: crypto.randomUUID(),
        leaseExpiresAt: now - 1,
        createdAt: now - 600000,
        releasedAt: null,
        decision: {
          version: uploadLegacyRecoveryVersion,
          decisionId: crypto.randomUUID(),
          ownershipEvidenceSha256: 'a'.repeat(64),
          accountingEvidenceSha256: 'b'.repeat(64),
          retainAfterExpiryMs: 300000,
          snapshot: {
            id,
            projectId,
            principalId,
            state: 'pending',
            revision: 1,
            objectKey: `historical/${id}`,
            contentType: 'text/plain',
            maxBytes: 4,
            actualBytes: null,
            objectVersion: null,
            checksum: null,
            createdAt: now - 900000,
            expiresAt: now - 600000,
            hasAttachment: false,
          },
        },
      };
    },
  );
  const next = hasNext ? records.at(-1)!.id : null;
  const get = vi.fn(async (scope: { id: string }) =>
    records.find((record) => record.id === scope.id)!,
  );
  const claim = vi.fn(async (scope: { id: string }) => get(scope));
  const release = vi.fn(async (scope: { id: string }) => ({
    ...(await get(scope)),
    state: 'released' as const,
  }));
  const store: UploadLegacyRecoveryStore = {
    get,
    claim,
    release,
    select: async () => ({ items: records, next }),
  };
  const recover = vi.fn(
    async ({ decision }: { decision: UploadLegacyRecoveryDecision }) => ({
      decisionId: decision.decisionId,
      ownershipEvidenceSha256: decision.ownershipEvidenceSha256,
      key: decision.snapshot.objectKey,
      remainingObjects: 0 as const,
      remainingUploads: 0 as const,
    }),
  );
  const page = () =>
    recoverLegacyUploadPage(
      { store, provider: { recover } },
      { projectId, now, limit: 20 },
    );
  return { records, next, store, claim, release, recover, page };
}

it.each([
  { count: 2, hasNext: false, cooperative: false },
  { count: 1, hasNext: true, cooperative: false },
  { count: 2, hasNext: false, cooperative: true },
])(
  'legacy recovery stops after timeout and preserves continuation: $count candidates, next=$hasNext, cooperative=$cooperative',
  async ({ count, hasNext, cooperative }) => {
    const f = fixture(count, hasNext);
    let complete!: (proof: UploadLegacyRecoveryAbsence) => void;
    let signal!: AbortSignal;
    // The provider in this fixture is synthetic; it proves control flow only.
    const provider = {
      recover: vi.fn(
        (input: { signal: AbortSignal }) =>
          new Promise<UploadLegacyRecoveryAbsence>((resolve, reject) => {
            signal = input.signal;
            complete = resolve;
            if (cooperative)
              signal.addEventListener(
                'abort',
                () => reject(new Error('private transport aborted')),
                { once: true },
              );
          }),
      ),
    };
    const pending = recoverLegacyUploadPage(
      { store: f.store, provider },
      { projectId: f.records[0]!.projectId, now: Date.now(), limit: 20 },
    );
    await vi.advanceTimersByTimeAsync(30000);
    expect(await pending).toEqual({
      next: count > 1 ? f.records[0]!.id : f.next,
      results: [{ id: f.records[0]!.id, outcome: 'held' }],
    });
    expect(signal.aborted).toBe(true);
    expect(f.claim).toHaveBeenCalledTimes(1);
    complete({
      decisionId: f.records[0]!.decision.decisionId,
      ownershipEvidenceSha256: 'a'.repeat(64),
      key: f.records[0]!.decision.snapshot.objectKey,
      remainingObjects: 0,
      remainingUploads: 0,
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(provider.recover).toHaveBeenCalledTimes(1);
    expect(f.release).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('legacy recovery continues after settled provider failure and clears the deadline on successful release', async () => {
  const f = fixture();
  f.recover.mockRejectedValueOnce(new Error('private provider failure'));
  expect(await f.page()).toEqual({
    next: null,
    results: [
      { id: f.records[0]!.id, outcome: 'held' },
      { id: f.records[1]!.id, outcome: 'released' },
    ],
  });
  expect(f.claim).toHaveBeenCalledTimes(2);
  expect(f.release).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});
