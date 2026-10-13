import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { startLocalS3 } from '../../tooling/local-s3.ts';
import { createS3BlobStore, createNodeBlobDigest } from '@hyperbug/blob-s3';
import {
  scanVerifiedUpload,
  transitionUploadScan,
  UploadIntentError,
  type UploadIntentRecord,
  type UploadIntentStore,
  type UploadScanDependencies,
  type AttachmentScanner,
} from '@hyperbug/application';
import { blobKey, blobTestPolicy } from '../fixtures/blob-store-proof.ts';
import { syntheticClean } from '../fixtures/upload-scan-contract.ts';
let service: Awaited<ReturnType<typeof startLocalS3>>,
  adapter: ReturnType<typeof createS3BlobStore>;
beforeAll(async () => {
  service = await startLocalS3();
  adapter = createS3BlobStore({
    ...service,
    multipart: blobTestPolicy,
    allowLocalHttp: true,
  });
});
afterAll(async () => {
  adapter?.close();
  await service?.close();
});
const consume: AttachmentScanner['scan'] = async ({ body }) => {
  const reader = body.getReader();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
    }
  } finally {
    reader.releaseLock();
  }
  return syntheticClean;
};
async function fixture(actual = 'abc') {
  const now = Date.now(),
    id = crypto.randomUUID(),
    finalKey = blobKey('objects');
  const expected = new TextEncoder().encode('abc');
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', expected)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  let record: UploadIntentRecord = {
    id,
    projectId: crypto.randomUUID(),
    principalId: crypto.randomUUID(),
    now,
    expiresAt: now + 900000,
    stagingKey: blobKey(),
    finalKey,
    filename: 'fixture.txt',
    contentType: 'text/plain',
    maxBytes: 4,
    association: { kind: 'issue-draft', draftId: crypto.randomUUID() },
    multipart: null,
    scan: null,
    state: 'finalized',
    revision: 2,
    leaseId: null,
    leaseExpiresAt: null,
    reservationState: 'used',
    scanStatus: 'unscanned',
    policyState: 'quarantined',
    verified: {
      key: finalKey,
      size: 3,
      sha256,
      contentType: 'text/plain',
      providerVersion: null,
      scanStatus: 'unscanned',
    },
  };
  const bytes = new TextEncoder().encode(actual);
  await adapter.store.put({
    key: finalKey,
    size: bytes.length,
    body: new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    createOnly: true,
    contentType: record.contentType,
    metadata: { 'intent-id': id },
  });
  const mutate = vi.fn(
    async (input: Parameters<UploadIntentStore['mutateScan']>[0]) => {
      record = transitionUploadScan(record, input);
      return record;
    },
  );
  const intents: UploadIntentStore = {
    selectCleanup: async () => ({ items: [], next: null }),
    selectOrphanCleanup: async () => ({ items: [], next: null }),
    claimOrphanCleanup: async () => {
      throw new Error('Unused orphan operation');
    },
    releaseUsedAfterCleanup: async () => {
      throw new Error('Unused orphan operation');
    },
    mutateScan: mutate,
    get: async () => record,
    reserve: async () => record,
    mutateMultipart: async () => record,
    requestFinalize: async () => record,
    claim: async () => record,
    commitVerified: async () => record,
    rejectVerification: async () => record,
    claimCleanup: async () => record,
    releaseQuotaAfterCleanup: async () => record,
  };
  const deps: UploadScanDependencies = {
    intents,
    blobs: adapter.store,
    createDigest: createNodeBlobDigest,
    scanner: { scan: consume },
  };
  const token = {
    ...record,
    leaseId: crypto.randomUUID(),
    now,
    leaseExpiresAt: now + 60000,
  };
  return { deps, token, mutate, current: () => record };
}
it('synthetic scan cannot claim a file was scanned when no scanner is configured', async () => {
  const f = await fixture();
  f.deps.scanner = null;
  await expect(
    scanVerifiedUpload(f.deps, async () => {}, f.token),
  ).rejects.toMatchObject({ code: 'UPLOAD_UNAVAILABLE' });
  expect(f.mutate).not.toHaveBeenCalled();
  expect(f.current()).toMatchObject({
    scanStatus: 'unscanned',
    policyState: 'quarantined',
  });
});
it('synthetic full-stream clean result binds actual immutable bytes before separate release', async () => {
  const f = await fixture();
  const result = await scanVerifiedUpload(f.deps, async () => {}, f.token);
  expect(result).toMatchObject({
    scanStatus: 'clean',
    policyState: 'ready',
    scan: { status: 'clean', sha256: f.token.verified!.sha256, sizeBytes: 3 },
  });
  expect(f.mutate.mock.calls.map(([input]) => input.kind)).toEqual([
    'claim',
    'commit',
    'release',
  ]);
});
it.each(['no-read', 'prefix-only'])(
  'synthetic %s clean verdict cannot release incompletely consumed content',
  async (kind) => {
    const f = await fixture();
    f.deps.scanner = {
      async scan({ body }) {
        if (kind === 'prefix-only') {
          const reader = body.getReader();
          await reader.read();
          reader.releaseLock();
        }
        return syntheticClean;
      },
    };
    expect(
      await scanVerifiedUpload(f.deps, async () => {}, f.token),
    ).toMatchObject({
      scanStatus: 'failed',
      policyState: 'quarantined',
      scan: { failure: 'partial' },
    });
    expect(f.mutate.mock.calls.map(([input]) => input.kind)).toEqual([
      'claim',
      'commit',
    ]);
  },
);
it.each(['xyz', 'larger'])(
  'synthetic scan rejects changed final object %s instead of trusting scanner clean',
  async (actual) => {
    const f = await fixture(actual);
    expect(
      await scanVerifiedUpload(f.deps, async () => {}, f.token),
    ).toMatchObject({
      scanStatus: 'failed',
      policyState: 'rejected',
      scan: { failure: 'identity' },
    });
  },
);
it('synthetic infected result rejects without releasing used quota', async () => {
  const f = await fixture();
  f.deps.scanner = {
    async scan(input) {
      await consume(input);
      return { ...syntheticClean, status: 'infected' };
    },
  };
  expect(
    await scanVerifiedUpload(f.deps, async () => {}, f.token),
  ).toMatchObject({
    scanStatus: 'infected',
    policyState: 'rejected',
    reservationState: 'used',
  });
});
it('synthetic invalid result and thrown private provider errors remain quarantined and bounded', async () => {
  for (const kind of ['invalid', 'throw']) {
    const f = await fixture();
    f.deps.scanner = {
      async scan(input) {
        await consume(input);
        if (kind === 'throw') throw new Error('private-scanner-secret');
        return {
          status: 'clean',
          evidence: { engine: 'x', engineVersion: '', signatureVersion: 'x' },
        };
      },
    };
    const result = await scanVerifiedUpload(f.deps, async () => {}, f.token);
    expect(result).toMatchObject({
      scanStatus: 'failed',
      policyState: 'quarantined',
      scan: { failure: kind === 'throw' ? 'unavailable' : 'invalid-result' },
    });
    expect(JSON.stringify(result.scan)).not.toContain('private-scanner-secret');
  }
});
it('synthetic scanner timeout cancels storage and discards a late clean verdict', async () => {
  const f = await fixture();
  f.deps.timeoutMs = 20;
  let finish: (value: typeof syntheticClean) => void = () => {};
  f.deps.scanner = {
    scan: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  expect(
    await scanVerifiedUpload(f.deps, async () => {}, f.token),
  ).toMatchObject({
    scanStatus: 'failed',
    policyState: 'quarantined',
    scan: { failure: 'timeout' },
  });
  finish(syntheticClean);
  await Promise.resolve();
  await Promise.resolve();
  expect(f.mutate).toHaveBeenCalledTimes(2);
});
it('synthetic scan lease expiry and permission loss cannot commit or release a result', async () => {
  for (const phase of ['expiry', 'commit', 'release']) {
    const f = await fixture();
    let now = f.token.now,
      checks = 0;
    f.deps.scanner = {
      async scan(input) {
        const result = await consume(input);
        if (phase === 'expiry') now = f.token.leaseExpiresAt;
        return result;
      },
    };
    await expect(
      scanVerifiedUpload(
        f.deps,
        async () => {
          if (
            ++checks === (phase === 'commit' ? 2 : phase === 'release' ? 3 : -1)
          )
            throw new UploadIntentError('UPLOAD_FORBIDDEN');
        },
        f.token,
        () => now,
      ),
    ).rejects.toMatchObject({
      code: phase === 'expiry' ? 'UPLOAD_LEASE_LOST' : 'UPLOAD_FORBIDDEN',
    });
    expect(f.current()).toMatchObject({
      scanStatus: phase === 'release' ? 'clean' : 'pending',
      policyState: 'quarantined',
    });
  }
});
