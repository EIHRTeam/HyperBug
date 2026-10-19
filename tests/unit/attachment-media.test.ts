import { it, expect, vi } from 'vitest';
import {
  attachmentScanPolicyVersion,
  attachmentRange,
  type AttachmentRecord,
  type BlobRead,
  type ProjectStore,
  type IssueRepository,
  type BlobStore,
} from '@hyperbug/application';
import {
  createAttachmentMediaHandler,
  parseMediaOrigin,
  isAttachmentMediaRequest,
  type AttachmentContext,
} from '../../packages/server/src/attachments.ts';
import {
  createDbAuthorizationResolver,
  authorizationPolicy,
} from '../../packages/server/src/authorization-facts.ts';
import { nextId } from '../fixtures/repository-contract.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import {
  digestCredential,
  generateOpaqueCredential,
} from '../../packages/security/src/index.ts';
import { tokenContext } from '../../packages/server/src/oauth.ts';
/* eslint-disable no-await-in-loop -- Bounded adversarial requests preserve sequential fixture state. */
async function unexpected(): Promise<never> {
  throw new Error('Unexpected fixture port invocation');
}

function fixture() {
  const id = nextId(),
    projectId = nextId(),
    principalId = nextId(),
    issueId = nextId();
  const file: AttachmentRecord = {
    id,
    projectId,
    uploadIntentId: id,
    issueId,
    commentId: null,
    objectKey: `objects/${'a'.repeat(64)}`,
    objectVersion: `sha256:${'b'.repeat(64)}`,
    checksum: 'b'.repeat(64),
    mediaType: 'text/plain',
    sizeBytes: 2,
    policyState: 'ready',
    revision: 1,
    upload: {
      id,
      projectId,
      principalId,
      stagingKey: `staging/${'c'.repeat(64)}`,
      finalKey: `objects/${'a'.repeat(64)}`,
      filename: 'file.txt',
      contentType: 'text/plain',
      maxBytes: 2,
      now: 1,
      expiresAt: 60000,
      association: { kind: 'issue', issueId },
      state: 'finalized',
      reservationState: 'used',
      scanStatus: 'clean',
      policyState: 'ready',
      revision: 5,
      leaseId: null,
      leaseExpiresAt: null,
      multipart: null,
      verified: {
        key: `objects/${'a'.repeat(64)}`,
        size: 2,
        sha256: 'b'.repeat(64),
        contentType: 'text/plain',
        providerVersion: null,
        scanStatus: 'unscanned',
      },
      scan: {
        attemptId: nextId(),
        sha256: 'b'.repeat(64),
        sizeBytes: 2,
        policyVersion: attachmentScanPolicyVersion,
        status: 'clean',
        startedAt: 1,
        completedAt: 2,
        evidence: {
          engine: 'synthetic-test-scanner',
          engineVersion: 'fixture',
          signatureVersion: 'fixture',
        },
        failure: null,
      },
    },
  };
  const state = {
    hidden: false,
    deleted: false,
    visibility: 'public' as 'public' | 'private',
    cancelled: false,
    pulls: 0,
    gets: 0,
  };
  const read = (size = 2, stall = false): BlobRead => ({
    key: file.objectKey,
    size: 2,
    bodySize: 2,
    contentType: file.mediaType,
    version: null,
    etag: 'private-provider-validator',
    metadata: { 'intent-id': id },
    body: new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          state.pulls++;
          if (stall) return new Promise(() => {});
          controller.enqueue(new Uint8Array(size).fill(97));
          controller.close();
        },
        cancel() {
          state.cancelled = true;
        },
      },
      { highWaterMark: 0 },
    ),
  });
  const project = () => ({
    id: projectId,
    slug: 'public',
    name: 'Public',
    visibility: state.visibility,
    status: 'active' as const,
    revision: 1,
    nextIssueNumber: 2,
    createdAtMs: 1,
    updatedAtMs: 1,
  });
  const context: AttachmentContext = {
    attachments: { get: async () => structuredClone(file) },
    blobs: {
      multipart: {
        thresholdBytes: 8388608,
        minPartBytes: 5242880,
        maxPartBytes: 67108864,
        maxParts: 100,
      },
      put: unexpected,
      delete: unexpected,
      createMultipart: unexpected,
      uploadPart: unexpected,
      completeMultipart: unexpected,
      abortMultipart: unexpected,
      get: async () => {
        state.gets++;
        return read();
      },
      head: async () => {
        const result = read();
        void result.body.cancel();
        return result;
      },
    } as BlobStore,
    projects: {
      load: async () => project(),
      loadBySlug: unexpected,
      create: unexpected,
      configure: unexpected,
      archive: unexpected,
    } as ProjectStore,
    issues: {
      createIssue: unexpected,
      editIssue: unexpected,
      closeIssue: unexpected,
      reopenIssue: unexpected,
      setIssueLabels: unexpected,
      setIssueAssignees: unexpected,
      setIssueType: unexpected,
      setIssueMilestone: unexpected,
      listIssues: unexpected,
      relations: unexpected,
      issueVisible: async () => true,
      getIssue: async () => ({
        id: issueId,
        projectId,
        number: 1,
        title: 'File',
        body: '',
        bodyText: '',
        bodyTextVersion: 'fixture',
        state: 'open',
        closeReason: null,
        typeId: null,
        milestoneId: null,
        authorId: principalId,
        revision: 1,
        createdAt: 1,
        updatedAt: 1,
        closedAt: null,
        moderation: state.hidden ? 'hidden' : 'visible',
        deletedAt: state.deleted ? 1 : null,
      }),
    } as IssueRepository,
    comments: null,
    keyProvider: null,
    tokenStore: null,
    roleStore: null,
    administration: null,
    taxonomy: null,
    authorizationPolicy,
    authorizationResolver: createDbAuthorizationResolver({
      loadPrincipal: async () => null,
      loadMembership: async () => null,
      loadInstanceRole: async () => null,
      loadProject: async () => ({
        visibility: state.visibility,
        state: 'active',
      }),
    }),
  };
  const handle = () =>
    createAttachmentMediaHandler(
      context,
      ['https://app.example'],
      'https://media.example',
    );
  const request = (headers?: Record<string, string>, signal?: AbortSignal) =>
    new Request(`https://media.example/attachments/${id}`, {
      headers: headers ?? {},
      ...(signal ? { signal } : {}),
    });
  return { file, state, context, read, handle, request };
}
it('requires a distinct explicit media hostname and narrow origin configuration', () => {
  expect(
    parseMediaOrigin(
      'https://media.other.example',
      ['https://app.example'],
      'production',
    ),
  ).toBe('https://media.other.example');
  for (const value of [
    'https://app.example:444',
    'https://app.example',
    'https://*.example',
    'https://x:y@media.example',
    'https://media.example/path',
    'http://media.example',
    'https://media.example/?x=1',
    'https://media.example.',
  ])
    expect(() =>
      parseMediaOrigin(value, ['https://app.example'], 'production'),
    ).toThrow('Invalid isolated media origin');
  expect(
    parseMediaOrigin(
      'http://127.0.0.2:4000',
      ['http://127.0.0.1:3000'],
      'local',
    ),
  ).toBe('http://127.0.0.2:4000');
});
it('fences media hostname aliases and mismatches before storage or authentication routes', async () => {
  const f = fixture();
  for (const url of [
    'http://media.example/auth/login',
    'https://media.example:444/auth/session',
    'https://media.example./auth/session',
  ]) {
    const request = new Request(url, {
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(isAttachmentMediaRequest(request, 'https://media.example')).toBe(
      true,
    );
    const response = await f.handle()(request);
    expect(response.status).toBe(404);
    expect(response.headers.get('set-cookie')).toBeNull();
  }
  const conflict = new Request('https://api.example/auth/session', {
    headers: { host: 'media.example:444' },
  });
  expect(isAttachmentMediaRequest(conflict, 'https://media.example')).toBe(
    true,
  );
  expect((await f.handle()(conflict)).status).toBe(404);
  expect(
    isAttachmentMediaRequest(
      new Request('https://api.example/auth/session', {
        headers: { 'x-forwarded-host': 'media.example' },
      }),
      'https://media.example',
    ),
  ).toBe(false);
  expect(f.state.gets).toBe(0);
});
it.each([
  'text/html',
  'image/svg+xml',
  'application/xml',
  'application/javascript',
])('delivers %s only as a safe isolated download', async (type) => {
  const f = fixture();
  f.file.mediaType = type;
  f.file.upload.contentType = type;
  f.file.upload.verified!.contentType = type;
  f.file.upload.filename = 'unsafe"\r\n名字.svg';
  const response = await f.handle()(f.request());
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/octet-stream');
  expect(response.headers.get('content-disposition')).toMatch(
    /^attachment; filename="[a-zA-Z0-9._-]+"; filename\*=UTF-8''/,
  );
  expect(response.headers.get('content-disposition')).not.toMatch(/[\r\n]/);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(f.state.pulls).toBe(0);
  expect(await response.text()).toBe('aa');
});
it.each([
  'quarantine',
  'stale-scan',
  'identity',
  'association',
  'hidden',
  'deleted',
] as const)(
  'withholds a stream after %s changes during storage acquisition',
  async (mode) => {
    const f = fixture();
    f.context.blobs.get = async () => {
      const result = f.read();
      if (mode === 'quarantine') f.file.upload.policyState = 'quarantined';
      if (mode === 'stale-scan') f.file.upload.scan!.policyVersion = 'obsolete';
      if (mode === 'identity') f.file.checksum = 'd'.repeat(64);
      if (mode === 'association') f.file.issueId = nextId();
      if (mode === 'hidden') f.state.hidden = true;
      if (mode === 'deleted') f.state.deleted = true;
      return result;
    };
    const response = await f.handle()(f.request());
    expect(response.status).toBe(404);
    expect(f.state.cancelled).toBe(true);
    expect(f.state.pulls).toBe(0);
    expect(await response.text()).not.toContain('objects/');
  },
);
it('reauthorizes public visibility after storage acquisition and rejects a mismatched provider object', async () => {
  const f = fixture();
  f.context.blobs.get = async () => {
    const read = f.read();
    f.state.visibility = 'private';
    return read;
  };
  expect((await f.handle()(f.request())).status).toBe(404);
  expect(f.state.cancelled).toBe(true);
  const other = fixture();
  other.context.blobs.get = async () => ({
    ...other.read(),
    metadata: { 'intent-id': nextId() },
  });
  const denied = await other.handle()(other.request());
  expect(denied.status).toBe(503);
  expect(await denied.text()).not.toContain('private-provider-validator');
  expect(other.state.cancelled).toBe(true);
});
it.each(['revoked', 'suspended', 'membership'] as const)(
  'withholds private bytes when %s changes during storage acquisition',
  async (mode) => {
    const f = fixture(),
      { provider } = cryptoFixture();
    const id = nextId(),
      secret = generateOpaqueCredential();
    const digest = JSON.stringify(
      await digestCredential(provider, secret, tokenContext(id)),
    );
    let revoked = false,
      suspended = false,
      membership = true;
    f.state.visibility = 'private';
    const context: AttachmentContext = {
      ...f.context,
      keyProvider: provider,
      tokenStore: {
        loadActive: async () =>
          revoked
            ? null
            : {
                id,
                digest,
                principalId: f.file.upload.principalId,
                identityId: nextId(),
                clientId: 'media-test',
                scope: 'public-api',
                authMethod: 'passkey',
                authenticatedAtMs: 1,
                assurance: 2,
              },
        insert: unexpected,
        insertAccessToken: unexpected,
        revoke: unexpected,
        consume: unexpected,
        loadPrincipalKind: unexpected,
      },
      roleStore: {
        loadRole: async () => (membership ? { role: 'triage' } : null),
        grant: unexpected,
        revoke: unexpected,
        listAdministratorProjectIds: unexpected,
      },
      authorizationResolver: createDbAuthorizationResolver({
        loadPrincipal: async () => ({
          kind: 'staff',
          status: suspended ? 'suspended' : 'active',
          credentialActive: true,
        }),
        loadMembership: async () => (membership ? { role: 'triage' } : null),
        loadInstanceRole: async () => null,
        loadProject: async () => ({ visibility: 'private', state: 'active' }),
      }),
    };
    f.context.blobs.get = async () => {
      const read = f.read();
      if (mode === 'revoked') revoked = true;
      if (mode === 'suspended') suspended = true;
      if (mode === 'membership') membership = false;
      return read;
    };
    const response = await createAttachmentMediaHandler(
      context,
      ['https://app.example'],
      'https://media.example',
    )(f.request({ authorization: `Bearer at_${id}.${secret}` }));
    expect(response.status).toBe(mode === 'suspended' ? 403 : 404);
    expect(f.state.cancelled).toBe(true);
    expect(f.state.pulls).toBe(0);
  },
);
it.each([1, 3])(
  'fails a malformed %s-byte stream instead of completing a two-byte download',
  async (size) => {
    const f = fixture();
    f.context.blobs.get = async () => f.read(size);
    const response = await f.handle()(f.request());
    await expect(response.text()).rejects.toBeDefined();
  },
);
it('cancels a returned stream on caller abort without buffering the remaining object', async () => {
  const f = fixture(),
    controller = new AbortController();
  f.context.blobs.get = async () => f.read(2, true);
  const response = await f.handle()(f.request({}, controller.signal));
  const read = response.body!.getReader().read();
  const rejected = expect(read).rejects.toBeDefined();
  controller.abort();
  await rejected;
  expect(f.state.cancelled).toBe(true);
});
it('times out storage acquisition and cancels a late object without exposing provider details', async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    let late: (value: BlobRead) => void = () => {};
    f.context.blobs.get = async () =>
      new Promise((resolve) => {
        late = resolve;
      });
    const pending = f.handle()(f.request());
    await vi.advanceTimersByTimeAsync(5001);
    const response = await pending;
    expect(response.status).toBe(408);
    late(f.read());
    await vi.advanceTimersByTimeAsync(1);
    expect(f.state.cancelled).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
it('bounds stalled response reads and abandoned responses by idle and total deadlines', async () => {
  vi.useFakeTimers();
  try {
    const f = fixture();
    f.context.blobs.get = async () => f.read(2, true);
    const response = await f.handle()(f.request());
    const rejected = expect(
      response.body!.getReader().read(),
    ).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(30001);
    await rejected;
    expect(f.state.cancelled).toBe(true);
    const other = fixture();
    const abandoned = await other.handle()(other.request());
    await vi.advanceTimersByTimeAsync(300001);
    await expect(abandoned.body!.getReader().read()).rejects.toBeDefined();
    expect(other.state.cancelled).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});
it('bounds byte range syntax, suffixes and overflow before storage work', () => {
  expect(attachmentRange('bytes=2-4', 10)).toEqual({ offset: 2, length: 3 });
  expect(attachmentRange('bytes=2-', 10)).toEqual({ offset: 2, length: 8 });
  expect(attachmentRange('bytes=-20', 10)).toEqual({ offset: 0, length: 10 });
  for (const range of [
    'bytes=0-1,2-3',
    'bytes=-0',
    'bytes=-',
    'bytes=10-',
    'bytes=4-2',
    'bytes=9007199254740992-',
    'bytes= 0-1',
  ])
    expect(attachmentRange(range, 10)).toBeNull();
});
