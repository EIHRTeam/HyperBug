import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { startLocalS3 } from '../../tooling/local-s3.ts';
import { createS3BlobStore, createNodeBlobDigest } from '@hyperbug/blob-s3';
import {
  processUploadIntent,
  cleanupUploadIntent,
  issueUploadCapability,
  issueMultipartPartCapability,
  startMultipartUpload,
  transitionMultipart,
  UploadIntentError,
  type UploadIntentRecord,
  type UploadIntentStore,
  type UploadDependencies,
} from '@hyperbug/application';
import {
  blobKey,
  blobTestPolicy,
  blobTestStream,
} from '../fixtures/blob-store-proof.ts';
let service: Awaited<ReturnType<typeof startLocalS3>>;
let adapter: ReturnType<typeof createS3BlobStore>;
beforeAll(async () => {
  service = await startLocalS3();
  adapter = createS3BlobStore({
    ...service,
    multipart: blobTestPolicy,
    allowLocalHttp: true,
  });
});
function multipartFixture() {
  const f = fixture();
  f.record.state = 'pending';
  f.record.maxBytes = 8 * 1024 ** 2;
  f.record.multipart = {
    state: 'planned',
    uploadId: null,
    partBytes: 5 * 1024 ** 2,
    maxParts: 2,
    parts: [],
    revision: 1,
  };
  f.deps.intents.mutateMultipart = async (input) => {
    Object.assign(f.record, transitionMultipart(f.record, input));
    return f.record;
  };
  return f;
}
it('persists a created provider session even if permission is lost before returning it', async () => {
  const f = multipartFixture();
  let checks = 0;
  await expect(
    startMultipartUpload(
      f.deps,
      async () => {
        if (++checks === 2) throw new UploadIntentError('UPLOAD_FORBIDDEN');
      },
      f.record,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  expect(f.record.multipart).toMatchObject({
    state: 'active',
    uploadId: expect.any(String),
  });
  await adapter.store.abortMultipart({
    key: f.record.stagingKey,
    uploadId: f.record.multipart!.uploadId!,
  });
});
it('compensates a known creation registration failure with provider abort and retains quota', async () => {
  const f = multipartFixture();
  const mutate = f.deps.intents.mutateMultipart;
  f.deps.intents.mutateMultipart = async (input) => {
    if (input.kind === 'created')
      throw new UploadIntentError('UPLOAD_UNAVAILABLE');
    return mutate(input);
  };
  await expect(
    startMultipartUpload(f.deps, async () => {}, f.record),
  ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
  expect(f.record).toMatchObject({
    state: 'rejected',
    reservationState: 'reserved',
    multipart: { state: 'aborted', uploadId: expect.any(String) },
  });
  expect(await adapter.store.head(f.record.stagingKey)).toBeNull();
});
it('reauthorizes multipart part capabilities after signing and denies stale session or expiry', async () => {
  const f = multipartFixture();
  await startMultipartUpload(f.deps, async () => {}, f.record);
  const original = f.deps.capabilities.uploadPart;
  const sign = vi.fn(original);
  f.deps.capabilities.uploadPart = sign;
  f.record.expiresAt = Date.now() + 9500;
  let time = Date.now();
  const capability = await issueMultipartPartCapability(
    f.deps,
    async () => {},
    f.record,
    1,
    () => time,
  );
  expect(new URL(capability.url).searchParams.get('X-Amz-Expires')).toBe('9');
  let checks = 0;
  await expect(
    issueMultipartPartCapability(
      f.deps,
      async () => {
        if (++checks === 2) throw new UploadIntentError('UPLOAD_FORBIDDEN');
      },
      f.record,
      1,
      () => time,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  f.deps.capabilities.uploadPart = async (input) => {
    const result = await original(input);
    f.record.multipart!.state = 'aborting';
    return result;
  };
  await expect(
    issueMultipartPartCapability(
      f.deps,
      async () => {},
      f.record,
      1,
      () => time,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
  f.record.multipart!.state = 'active';
  f.deps.capabilities.uploadPart = async (input) => {
    const result = await original(input);
    time = f.record.expiresAt;
    return result;
  };
  await expect(
    issueMultipartPartCapability(
      f.deps,
      async () => {},
      f.record,
      1,
      () => time,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
  await adapter.store.abortMultipart({
    key: f.record.stagingKey,
    uploadId: f.record.multipart!.uploadId!,
  });
});
afterAll(async () => {
  adapter?.close();
  await service?.close();
});
function fixture() {
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
    now,
    expiresAt: now + 900000,
    multipart: null,
    scan: null,
    state: 'uploaded',
    revision: 2,
    leaseId: null,
    leaseExpiresAt: null,
    verified: null,
    reservationState: 'reserved',
    scanStatus: 'unscanned',
    policyState: 'quarantined',
  };
  const claim = vi.fn(async () => record),
    commit = vi.fn(async () => record),
    reject = vi.fn(async () => record),
    release = vi.fn(async () => record);
  const intents: UploadIntentStore = {
    selectCleanup: async () => ({ items: [], next: null }),
    selectOrphanCleanup: async () => ({ items: [], next: null }),
    claimOrphanCleanup: async () => {
      throw new Error('Unused orphan operation');
    },
    releaseUsedAfterCleanup: async () => {
      throw new Error('Unused orphan operation');
    },
    mutateScan: async () => record,
    mutateMultipart: async () => record,
    get: async () => record,
    reserve: async () => record,
    requestFinalize: async () => record,
    claim,
    claimCleanup: claim,
    commitVerified: commit,
    rejectVerification: reject,
    releaseQuotaAfterCleanup: release,
  };
  const deps: UploadDependencies = {
    intents,
    blobs: adapter.store,
    capabilities: adapter.authorization,
    createDigest: createNodeBlobDigest,
  };
  const lease = {
    ...record,
    leaseId: crypto.randomUUID(),
    now,
    leaseExpiresAt: now + 1000,
  };
  const stage = async (size = 3) => {
    await adapter.store.put({
      key: record.stagingKey,
      size,
      body: blobTestStream(size),
      contentType: record.contentType,
      createOnly: false,
    });
  };
  return { record, deps, lease, claim, commit, reject, release, stage };
}
it('does not commit verification after storage work outlives its persisted lease', async () => {
  const f = fixture();
  await f.stage();
  let time = f.record.now;
  const original = f.deps.blobs;
  f.deps.blobs = {
    ...original,
    async put(input) {
      const result = await original.put(input);
      time += 1000;
      return result;
    },
  };
  await expect(
    processUploadIntent(
      f.deps,
      async () => {},
      f.lease,
      () => time,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
  expect(f.commit).not.toHaveBeenCalled();
  expect(f.reject).not.toHaveBeenCalled();
  expect(await original.head(f.record.finalKey)).not.toBeNull();
});
it('uses live time for successful commit and rechecks authorization after promotion', async () => {
  const f = fixture();
  await f.stage();
  let time = f.record.now;
  const authorize = vi.fn(async () => {
    time += 10;
  });
  await processUploadIntent(f.deps, authorize, f.lease, () => time);

  expect(f.commit).toHaveBeenCalledWith(
    expect.objectContaining({
      now: time,
      verified: expect.objectContaining({ size: 3, scanStatus: 'unscanned' }),
    }),
  );
  const revoked = fixture();
  await revoked.stage();
  let checks = 0;
  await expect(
    processUploadIntent(
      revoked.deps,
      async () => {
        if (++checks === 2) throw new UploadIntentError('UPLOAD_FORBIDDEN');
      },
      revoked.lease,
      () => revoked.record.now,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  expect(revoked.commit).not.toHaveBeenCalled();
});
it('rejects invalid objects using the time after inspection and retains the reservation', async () => {
  const f = fixture();
  await f.stage(5);
  let tick = f.record.now;
  await processUploadIntent(
    f.deps,
    async () => {},
    f.lease,
    () => ++tick,
  );
  expect(f.reject).toHaveBeenCalledWith(
    expect.objectContaining({ now: f.record.now + 2 }),
  );
  expect(f.commit).not.toHaveBeenCalled();
  expect(f.release).not.toHaveBeenCalled();
});
it('does not release cleanup accounting after deletes outlive its lease', async () => {
  const f = fixture();
  await f.stage();
  let time = f.record.now;
  const original = f.deps.blobs;
  f.deps.blobs = {
    ...original,
    async delete(key) {
      await original.delete(key);
      time += 1000;
    },
  };
  await expect(
    cleanupUploadIntent(f.deps, f.lease, () => time),
  ).rejects.toMatchObject({ code: 'UPLOAD_LEASE_LOST' });
  expect(f.release).not.toHaveBeenCalled();
});
it('bounds upload capabilities by remaining intent life and current permission', async () => {
  const f = fixture();
  f.record.state = 'pending';
  f.record.expiresAt = Date.now() + 9500;
  const upload = vi.fn(f.deps.capabilities.upload);
  f.deps.capabilities = { ...f.deps.capabilities, upload };
  const capability = await issueUploadCapability(
    f.deps,
    async () => {},
    f.record,
    Date.now(),
  );
  expect(new URL(capability.url).searchParams.get('X-Amz-Expires')).toBe('9');
  await expect(
    issueUploadCapability(
      f.deps,
      async () => {
        throw new UploadIntentError('UPLOAD_FORBIDDEN');
      },
      f.record,
      f.record.now,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  await expect(
    issueUploadCapability(f.deps, async () => {}, f.record, f.record.expiresAt),
  ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
  await expect(
    issueUploadCapability(
      f.deps,
      async () => {},
      f.record,
      f.record.now,
      () => f.record.expiresAt,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
  expect(upload).toHaveBeenCalledTimes(1);
});

it('withholds direct capabilities after permission loss, finalization or expiry during signing', async () => {
  const f = fixture();
  f.record.state = 'pending';
  const sign = f.deps.capabilities.upload;
  let checks = 0;
  await expect(
    issueUploadCapability(
      f.deps,
      async () => {
        if (++checks === 2) throw new UploadIntentError('UPLOAD_FORBIDDEN');
      },
      f.record,
      f.record.now,
      () => f.record.now,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_FORBIDDEN' });
  f.deps.capabilities.upload = async (input) => {
    const result = await sign(input);
    f.record.state = 'uploaded';
    return result;
  };
  await expect(
    issueUploadCapability(
      f.deps,
      async () => {},
      f.record,
      f.record.now,
      () => f.record.now,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_CONFLICT' });
  f.record.state = 'pending';
  let time = f.record.now;
  f.deps.capabilities.upload = async (input) => {
    const result = await sign(input);
    time = result.expiresAt;
    return result;
  };
  await expect(
    issueUploadCapability(
      f.deps,
      async () => {},
      f.record,
      f.record.now,
      () => time,
    ),
  ).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' });
});
