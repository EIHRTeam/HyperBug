import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  cleanupUploadIntent,
  cleanupUploadPage,
  cleanupOrphanUploadIntent,
  cleanupOrphanUploadPage,
  type BlobStore,
  type UploadIntentRecord,
  type UploadIntentStore,
} from '@hyperbug/application';
import { blobKey, blobTestPolicy } from '../fixtures/blob-store-proof.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 4));
});
afterEach(() => vi.useRealTimers());
const kinds = ['expired', 'orphan'] as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(kind: (typeof kinds)[number]) {
  const now = Date.now();
  const record: UploadIntentRecord = {
    id: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    principalId: crypto.randomUUID(),
    stagingKey: blobKey(),
    finalKey: blobKey('objects'),
    filename: 'fixture.bin',
    contentType: 'application/octet-stream',
    maxBytes: 4,
    association: { kind: 'issue-draft', draftId: crypto.randomUUID() },
    now: now - 900000,
    expiresAt: now - 600000,
    multipart: null,
    scan: null,
    state: kind === 'expired' ? 'expired' : 'finalized',
    revision: 2,
    leaseId: null,
    leaseExpiresAt: null,
    verified: null,
    reservationState: kind === 'expired' ? 'reserved' : 'used',
    scanStatus: 'unscanned',
    policyState: 'deleted',
  };
  const lease = {
    ...record,
    now,
    leaseId: crypto.randomUUID(),
    leaseExpiresAt: now + 300000,
    retainAfterExpiryMs: 600000,
  };
  const unused = async (): Promise<never> => {
    throw new Error('Unused test port');
  };
  const claim = vi.fn(async () => record),
    release = vi.fn(async () => record),
    mutate = vi.fn(async () => record),
    remove = vi.fn(async (_key: string) => {}),
    head = vi.fn(async (_key: string) => null),
    abort = vi.fn(async () => {});
  const intents: UploadIntentStore = {
    selectCleanup: unused,
    selectOrphanCleanup: unused,
    claimOrphanCleanup: claim,
    releaseUsedAfterCleanup: release,
    claimCleanup: claim,
    releaseQuotaAfterCleanup: release,
    mutateMultipart: mutate,
    mutateScan: unused,
    get: unused,
    reserve: unused,
    requestFinalize: unused,
    claim: unused,
    commitVerified: unused,
    rejectVerification: unused,
  };
  const blobs: BlobStore = {
    multipart: blobTestPolicy,
    put: unused,
    get: unused,
    head,
    delete: remove,
    createMultipart: unused,
    uploadPart: unused,
    completeMultipart: unused,
    abortMultipart: abort,
  };
  const deps = {
    intents,
    blobs,
    multipartReconciler: {
      reconcile: vi.fn(async (input: { key: string; signal: AbortSignal }) => ({
        key: input.key,
        remainingUploads: 0 as const,
      })),
    },
  };
  const cleanup = (clock = Date.now) =>
    kind === 'expired'
      ? cleanupUploadIntent(deps, lease, clock)
      : cleanupOrphanUploadIntent(deps, lease, clock);
  const page = (items = 2, hasNext = false) => {
    const candidates = Array.from({ length: items }, (_, i) => ({
      id: i === 0 ? record.id : crypto.randomUUID(),
      projectId: record.projectId,
      principalId: record.principalId,
      state: kind === 'expired' ? ('expired' as const) : ('finalized' as const),
      expiresAt: record.expiresAt,
    }));
    const first = candidates[0]!;
    const after = {
      state: first.state,
      expiresAt: first.expiresAt,
      id: first.id,
    };
    const next = hasNext ? { ...after, id: candidates.at(-1)!.id } : null;
    const selected = { items: candidates, next };
    deps.intents.selectCleanup = async () => ({
      items: candidates.map((candidate) => ({
        ...candidate,
        state: 'expired' as const,
      })),
      next: next ? { ...next, state: 'expired' as const } : null,
    });
    deps.intents.selectOrphanCleanup = async () => selected;
    const query = {
      projectId: record.projectId,
      now,
      limit: 20,
      retainAfterExpiryMs: 600000,
    };
    return {
      candidates,
      after,
      next,
      pending:
        kind === 'expired'
          ? cleanupUploadPage(deps, query)
          : cleanupOrphanUploadPage(deps, query),
    };
  };
  return {
    record,
    lease,
    deps,
    claim,
    release,
    mutate,
    remove,
    head,
    abort,
    cleanup,
    page,
  };
}

it.each(kinds)(
  '%s cleanup times out a delete without releasing quota or starting more I/O after late completion',
  async (kind) => {
    const f = fixture(kind),
      late = deferred<void>();
    f.remove.mockImplementationOnce(() => late.promise);
    const denied = expect(f.cleanup()).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
    await vi.advanceTimersByTimeAsync(29999);
    expect(f.release).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await denied;
    expect(f.remove).toHaveBeenCalledTimes(1);
    expect(f.head).not.toHaveBeenCalled();
    late.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.remove).toHaveBeenCalledTimes(1);
    expect(f.release).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each(
  kinds.flatMap((kind) => [
    { kind, key: 'staging' as const },
    { kind, key: 'final' as const },
  ]),
)(
  '$kind cleanup holds quota when the $key absence check stalls or rejects late',
  async ({ kind, key }) => {
    const f = fixture(kind),
      late = deferred<null>();
    if (key === 'final') f.head.mockResolvedValueOnce(null);
    f.head.mockImplementationOnce(() => late.promise);
    const denied = expect(f.cleanup()).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
    await vi.advanceTimersByTimeAsync(30000);
    await denied;
    expect(f.remove).toHaveBeenCalledTimes(2);
    expect(f.head).toHaveBeenCalledTimes(key === 'staging' ? 1 : 2);
    late.reject(new Error('private late provider failure'));
    await vi.advanceTimersByTimeAsync(1);
    expect(f.release).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each(kinds)(
  '%s cleanup shares one total storage budget across operations',
  async (kind) => {
    const f = fixture(kind),
      first = deferred<void>(),
      second = deferred<void>();
    f.remove.mockImplementationOnce(() => first.promise);
    f.remove.mockImplementationOnce(() => second.promise);
    const denied = expect(f.cleanup()).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
    await vi.advanceTimersByTimeAsync(20000);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.remove).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    await denied;
    second.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.head).not.toHaveBeenCalled();
    expect(f.release).not.toHaveBeenCalled();
  },
);

it.each(kinds)(
  '%s cleanup caps storage waiting by the lease and rechecks live time after every operation',
  async (kind) => {
    const f = fixture(kind),
      late = deferred<void>();
    f.lease.leaseExpiresAt = Date.now() + 1000;
    f.remove.mockImplementationOnce(() => late.promise);
    const denied = expect(f.cleanup()).rejects.toMatchObject({
      code: 'UPLOAD_LEASE_LOST',
    });
    await vi.advanceTimersByTimeAsync(1000);
    await denied;
    expect(f.remove).toHaveBeenCalledTimes(1);
    late.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.release).not.toHaveBeenCalled();

    const moved = fixture(kind);
    let time = Date.now();
    moved.remove.mockImplementationOnce(async () => {
      time = moved.lease.leaseExpiresAt;
    });
    await expect(moved.cleanup(() => time)).rejects.toMatchObject({
      code: 'UPLOAD_LEASE_LOST',
    });
    expect(moved.remove).toHaveBeenCalledTimes(1);
    expect(moved.release).not.toHaveBeenCalled();
  },
);

it('expired cleanup holds the multipart state/accounting after a stalled known-session abort', async () => {
  const f = fixture('expired'),
    late = deferred<void>();
  f.record.multipart = {
    state: 'active',
    uploadId: 'private-session',
    partBytes: 5 * 1024 ** 2,
    maxParts: 1,
    parts: [],
    revision: 1,
  };
  f.abort.mockImplementationOnce(() => late.promise);
  const denied = expect(f.cleanup()).rejects.toMatchObject({
    code: 'UPLOAD_UNAVAILABLE',
  });
  await vi.advanceTimersByTimeAsync(30000);
  await denied;
  late.resolve();
  await vi.advanceTimersByTimeAsync(1);
  expect(f.mutate).not.toHaveBeenCalled();
  expect(f.remove).not.toHaveBeenCalled();
  expect(f.release).not.toHaveBeenCalled();
});

it.each(kinds)(
  '%s cleanup shares the reconciliation and CRUD deadline and aborts the proof signal',
  async (kind) => {
    const f = fixture(kind),
      proof = deferred<{ key: string; remainingUploads: 0 }>(),
      late = deferred<void>();
    f.record.multipart = {
      state: 'creating',
      uploadId: null,
      partBytes: 5 * 1024 ** 2,
      maxParts: 1,
      parts: [],
      revision: 1,
    };
    f.deps.multipartReconciler.reconcile.mockImplementationOnce(
      () => proof.promise,
    );
    f.remove.mockImplementationOnce(() => late.promise);
    const denied = expect(f.cleanup()).rejects.toMatchObject({
      code: 'UPLOAD_UNAVAILABLE',
    });
    await vi.advanceTimersByTimeAsync(20000);
    proof.resolve({ key: f.record.stagingKey, remainingUploads: 0 });
    await vi.advanceTimersByTimeAsync(0);
    expect(f.remove).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    await denied;
    expect(
      f.deps.multipartReconciler.reconcile.mock.calls[0]![0].signal.aborted,
    ).toBe(true);
    late.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.remove).toHaveBeenCalledTimes(1);
    expect(f.release).not.toHaveBeenCalled();
  },
);

it.each(kinds)(
  '%s cleanup page stops after a timeout and returns the cursor before unattempted candidates',
  async (kind) => {
    const f = fixture(kind),
      late = deferred<void>();
    f.remove.mockImplementationOnce(() => late.promise);
    const page = f.page();
    await vi.advanceTimersByTimeAsync(30000);
    expect(await page.pending).toEqual({
      next: page.after,
      results: [{ id: f.record.id, outcome: 'held' }],
    });
    expect(f.claim).toHaveBeenCalledTimes(1);
    late.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.claim).toHaveBeenCalledTimes(1);
    expect(f.release).not.toHaveBeenCalled();
  },
);

it.each(kinds)(
  '%s cleanup page stops after a stalled multipart proof, including a cooperative abort rejection',
  async (kind) => {
    const f = fixture(kind);
    f.record.multipart = {
      state: 'creating',
      uploadId: null,
      partBytes: 5 * 1024 ** 2,
      maxParts: 1,
      parts: [],
      revision: 1,
    };
    f.deps.multipartReconciler.reconcile.mockImplementationOnce(
      async ({ signal }) =>
        new Promise((_, reject) =>
          signal.addEventListener(
            'abort',
            () => reject(new Error('private aborted transport')),
            { once: true },
          ),
        ),
    );
    const page = f.page();
    await vi.advanceTimersByTimeAsync(30000);
    expect(await page.pending).toEqual({
      next: page.after,
      results: [{ id: f.record.id, outcome: 'held' }],
    });
    expect(f.claim).toHaveBeenCalledTimes(1);
    expect(f.mutate).not.toHaveBeenCalled();
    expect(f.remove).not.toHaveBeenCalled();
    expect(f.release).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it.each(kinds)(
  '%s cleanup page preserves an existing continuation after its last candidate times out',
  async (kind) => {
    const f = fixture(kind),
      late = deferred<void>();
    f.remove.mockImplementationOnce(() => late.promise);
    const page = f.page(1, true);
    await vi.advanceTimersByTimeAsync(30000);
    expect((await page.pending).next).toEqual(page.next);
    late.resolve();
    await vi.advanceTimersByTimeAsync(1);
    expect(f.release).not.toHaveBeenCalled();
  },
);

it.each(kinds)(
  '%s cleanup clears its timer on success and continues the page after a settled failure',
  async (kind) => {
    const f = fixture(kind);
    await f.cleanup();
    expect(f.release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    f.release.mockClear();
    f.claim.mockClear();
    f.remove.mockRejectedValueOnce(new Error('private settled failure'));
    const page = f.page();
    expect(await page.pending).toEqual({
      next: null,
      results: [
        { id: page.candidates[0]!.id, outcome: 'held' },
        { id: page.candidates[1]!.id, outcome: 'released' },
      ],
    });
    expect(f.claim).toHaveBeenCalledTimes(2);
    expect(f.release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  },
);
