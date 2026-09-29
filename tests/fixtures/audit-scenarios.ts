import {
  auditEvent,
  auditRetentionProposal,
  createAuditService,
  type AuditEvent,
  type AuditRepository,
  type AuthorizationFacts,
  type PermissionRequest,
  type AuditReadRequest,
} from '../../packages/security/src/index.ts';

export const auditNow = 1800000000000;
export const auditProject = '00000000-0000-4000-8000-0000000000a1';
export const auditActor = '00000000-0000-4000-8000-0000000000a2';
export const otherAuditProject = '00000000-0000-4000-8000-0000000000a3';
export function auditFacts(
  request: PermissionRequest,
  revoked = false,
): AuthorizationFacts {
  return {
    binding: request,
    principal:
      request.actorId === null
        ? null
        : {
            id: request.actorId,
            kind: 'staff',
            status: 'active',
            credentialActive: !revoked,
            expiresAtMs: auditNow + 60000,
            authenticatedAtMs: auditNow - 1000,
            assurance: 2,
          },
    project: {
      id: request.target.projectId,
      visibility: 'private',
      state: 'active',
    },
    membership:
      request.actorId === null
        ? null
        : {
            principalId: request.actorId,
            projectId: request.target.projectId,
            active: !revoked,
            role: 'administrator',
          },
    resource: {
      ref: request.target,
      deleted: false,
      publicReadable: false,
      permissionGranted: true,
    },
  };
}
export function auditFixture(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return auditEvent({
    id: crypto.randomUUID(),
    projectId: auditProject,
    actorId: auditActor,
    systemActor: null,
    action: 'issue.created',
    targetId: crypto.randomUUID(),
    result: 'success',
    requestId: crypto.randomUUID(),
    createdAt: auditNow,
    metadata: {},
    ...overrides,
  });
}
export const auditPolicy = { recentAuthMaxAgeMs: 300000, timeoutMs: 20 };

/** Pure service failure corpus, executed inside Node and inside workerd. */
export async function auditScenarios(): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  const request: PermissionRequest = {
    actorId: auditActor,
    permission: 'project:configure',
    target: { projectId: auditProject, type: 'project', id: auditProject },
  };
  const query: AuditReadRequest = {
    actorId: auditActor,
    projectId: auditProject,
    limit: 1,
  };
  let reads = 0;
  let revoked = false;
  let delayRevoke = false;
  let outage = false;
  let writes = 0;
  const events: AuditEvent[] = [];
  const repository: AuditRepository = {
    append: async (event) => {
      writes++;
      if (outage) throw new Error('SEEDED_SECRET');
      events.push(event);
      if (delayRevoke) revoked = true;
    },
    list: async () => {
      reads++;
      if (delayRevoke) revoked = true;
      return [];
    },
  };
  const service = createAuditService({
    repository,
    authorization: { resolve: async (r) => auditFacts(r, revoked) },
    policy: auditPolicy,
    now: () => auditNow,
    timeoutMs: 40,
  });
  const signal = () => new AbortController().signal;
  const rejected = async (work: () => Promise<unknown>, code: string) => {
    try {
      await work();
      return false;
    } catch (error) {
      return (
        error instanceof Error &&
        error.message === code &&
        !String(error).includes('SEEDED_SECRET')
      );
    }
  };
  result.allowedAudited =
    (await service.check(request, crypto.randomUUID(), signal())).allowed &&
    events.length === 1 &&
    events[0]?.action === 'authorization.checked';
  revoked = true;
  result.deniedReadNoStorage =
    (await rejected(() => service.read(query, signal()), 'AUDIT_FORBIDDEN')) &&
    reads === 0;
  const denied = await service.check(request, crypto.randomUUID(), signal());
  result.deniedAudited =
    !denied.allowed &&
    denied.reason === 'forbidden' &&
    events.at(-1)?.result === 'failure';
  revoked = false;
  outage = true;
  const failed = await service.check(request, crypto.randomUUID(), signal());
  result.auditFailureNeverGrants =
    !failed.allowed && failed.reason === 'unavailable';
  outage = false;
  delayRevoke = true;
  result.revokedDuringRead = await rejected(
    () => service.read(query, signal()),
    'AUDIT_FORBIDDEN',
  );
  revoked = false;
  const slowWrite = await service.check(request, crypto.randomUUID(), signal());
  result.revokedDuringAppend =
    !slowWrite.allowed && slowWrite.reason === 'forbidden';
  revoked = false;
  delayRevoke = false;
  const aborted = new AbortController();
  aborted.abort();
  const previousWrites = writes;
  const cancelled = await service.check(
    request,
    crypto.randomUUID(),
    aborted.signal,
  );
  result.cancelledNeverWrites = !cancelled.allowed && writes === previousWrites;
  const snapshot = { ...query };
  const pending = service.read(snapshot, signal());
  snapshot.projectId = otherAuditProject;
  result.requestSnapshot = (await pending).items.length === 0;
  const malicious = createAuditService({
    repository: {
      ...repository,
      list: async () => [auditFixture({ projectId: otherAuditProject })],
    },
    authorization: { resolve: async (r) => auditFacts(r) },
    policy: auditPolicy,
    now: () => auditNow,
  });
  result.crossProjectProviderDenied = await rejected(
    () => malicious.read(query, signal()),
    'AUDIT_UNAVAILABLE',
  );
  const secret = createAuditService({
    repository: {
      ...repository,
      list: async () => [
        { ...auditFixture(), metadata: { password: 'SEEDED_SECRET' } },
      ],
    },
    authorization: { resolve: async (r) => auditFacts(r) },
    policy: auditPolicy,
    now: () => auditNow,
  });
  result.storedSecretNeverReturned = await rejected(
    () => secret.read(query, signal()),
    'AUDIT_UNAVAILABLE',
  );
  const provider = createAuditService({
    repository,
    authorization: {
      resolve: async () => {
        throw new Error('SEEDED_SECRET');
      },
    },
    policy: auditPolicy,
  });
  result.authorizationOutageDenied = await rejected(
    () => provider.read(query, signal()),
    'AUDIT_UNAVAILABLE',
  );
  for (const [label, actor] of [
    ['anonymous', null],
    ['user', auditActor],
    ['maintainer', auditActor],
  ] as const) {
    const deniedReader = createAuditService({
      repository,
      authorization: {
        resolve: async (r) => {
          const facts = auditFacts({ ...r, actorId: actor });
          return {
            ...facts,
            principal: facts.principal
              ? {
                  ...facts.principal,
                  kind: label === 'user' ? 'user' : 'staff',
                }
              : null,
            membership: facts.membership
              ? { ...facts.membership, role: 'maintainer' }
              : null,
          };
        },
      },
      policy: auditPolicy,
      now: () => auditNow,
    });
    result[label + 'Denied'] = await rejected(
      () => deniedReader.read(query, signal()),
      'AUDIT_FORBIDDEN',
    );
  }
  const readBeforeMalformed = reads;
  for (const [label, override] of [
    ['zero', { limit: 0 }],
    ['overLimit', { limit: 101 }],
    ['nullLimit', { limit: null }],
    ['invalidCursor', { after: 'invalid' }],
    ['hugeCursor', { after: 'A'.repeat(1025) }],
    ['unknownQuery', { offset: 20 }],
  ] as const)
    result[label] = await rejected(
      () =>
        service.read({ ...query, ...override } as AuditReadRequest, signal()),
      'AUDIT_INVALID',
    );
  result.malformedNoStorage = reads === readBeforeMalformed;
  let release: (value: readonly AuditEvent[]) => void = () => {};
  const slow = createAuditService({
    repository: {
      ...repository,
      list: async () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    },
    authorization: { resolve: async (r) => auditFacts(r) },
    policy: auditPolicy,
    now: () => auditNow,
    timeoutMs: 10,
    maxConcurrent: 1,
  });
  result.timeoutDenied = await rejected(
    () => slow.read(query, signal()),
    'AUDIT_UNAVAILABLE',
  );
  result.timedOutWorkKeepsPermit = await rejected(
    () => slow.read(query, signal()),
    'AUDIT_UNAVAILABLE',
  );
  release([]);
  // Let the actual cancelled work settle without a timing sleep.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const hold = () =>
    auditRetentionProposal({
      now: auditNow,
      retentionSeconds: 86400,
      maxBatch: 100,
      legalHold: true,
    });
  try {
    hold();
    result.holdRejected = false;
  } catch {
    result.holdRejected = true;
  }
  const proposal = auditRetentionProposal({
    now: auditNow,
    retentionSeconds: 86400,
    maxBatch: 100,
    legalHold: false,
  });
  result.retentionReviewOnly =
    proposal.cutoffExclusive === auditNow - 86400000 &&
    proposal.requiresIndependentReview &&
    Object.isFrozen(proposal);
  return result;
}
