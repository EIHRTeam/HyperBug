import {
  authorize,
  evaluatePermission,
  type AuthorizationFacts,
  type AuthorizationDecision,
  type PermissionRequest,
} from '../../packages/security/src/index.ts';

/** Run identical authorization cases in the Node host and the workerd isolate. */
export async function securityScenarios(): Promise<
  Record<string, AuthorizationDecision>
> {
  const now = 1800000000000;
  const actorId = '00000000-0000-4000-8000-000000000001';
  const projectId = '00000000-0000-4000-8000-000000000002';
  const otherId = '00000000-0000-4000-8000-000000000003';
  const request: PermissionRequest = {
    actorId,
    permission: 'project:configure',
    target: { projectId, type: 'project', id: projectId },
  };
  const principal = {
    id: actorId,
    kind: 'staff',
    status: 'active',
    credentialActive: true,
    expiresAtMs: now + 60000,
    authenticatedAtMs: now - 1000,
    assurance: 2,
  } as const;
  const membership = {
    principalId: actorId,
    projectId,
    active: true,
    role: 'administrator',
  } as const;
  const facts: AuthorizationFacts = {
    binding: request,
    principal,
    membership,
    project: { id: projectId, visibility: 'private', state: 'active' },
    resource: {
      ref: request.target,
      deleted: false,
      publicReadable: false,
      permissionGranted: true,
    },
  };
  const policy = { recentAuthMaxAgeMs: 300000, timeoutMs: 20 };
  const decide = (value: AuthorizationFacts, input = request) =>
    evaluatePermission(input, value, policy, now);
  const result: Record<string, AuthorizationDecision> = {
    administrator: decide(facts),
    differentActor: decide({
      ...facts,
      binding: { ...request, actorId: otherId },
    }),
    differentAction: decide({
      ...facts,
      binding: { ...request, permission: 'role:manage' },
    }),
    differentObject: decide({
      ...facts,
      resource: { ...facts.resource, ref: { ...request.target, id: otherId } },
    }),
    differentProject: decide({
      ...facts,
      project: { ...facts.project, id: otherId },
    }),
    objectPermissionDenied: decide({
      ...facts,
      resource: { ...facts.resource, permissionGranted: false },
    }),
    deletedObject: decide({
      ...facts,
      resource: { ...facts.resource, deleted: true },
    }),
    archivedWrite: decide({
      ...facts,
      project: { ...facts.project, state: 'archived' },
    }),
    revokedMembership: decide({
      ...facts,
      membership: { ...membership, active: false },
    }),
    crossProjectMembership: decide({
      ...facts,
      membership: { ...membership, projectId: otherId },
    }),
    lowerRole: decide({
      ...facts,
      membership: { ...membership, role: 'maintainer' },
    }),
    userCannotBecomeStaff: decide({
      ...facts,
      principal: { ...principal, kind: 'user' },
    }),
    suspended: decide({
      ...facts,
      principal: { ...principal, status: 'suspended' },
    }),
    revokedCredential: decide({
      ...facts,
      principal: { ...principal, credentialActive: false },
    }),
    expiredCredential: decide({
      ...facts,
      principal: { ...principal, expiresAtMs: now },
    }),
    invalidExpiry: decide({
      ...facts,
      principal: { ...principal, expiresAtMs: NaN },
    }),
    futureAuthentication: decide({
      ...facts,
      principal: { ...principal, authenticatedAtMs: now + 1 },
    }),
    staleAuthentication: decide({
      ...facts,
      principal: { ...principal, authenticatedAtMs: now - 300001 },
    }),
    insufficientAssurance: decide({
      ...facts,
      principal: { ...principal, assurance: 1 },
    }),
    recentBoundary: decide({
      ...facts,
      principal: { ...principal, authenticatedAtMs: now - 300000 },
    }),
    malformedFacts: decide(null as unknown as AuthorizationFacts),
    unknownPermission: decide(facts, {
      ...request,
      permission: '__proto__' as PermissionRequest['permission'],
    }),
    invalidPolicy: evaluatePermission(
      request,
      facts,
      { ...policy, recentAuthMaxAgeMs: Infinity },
      now,
    ),
  };
  const publicRequest: PermissionRequest = {
    actorId: null,
    permission: 'project:read',
    target: request.target,
  };
  const publicFacts: AuthorizationFacts = {
    ...facts,
    binding: publicRequest,
    principal: null,
    membership: null,
    project: { ...facts.project, visibility: 'public' },
    resource: {
      ...facts.resource,
      publicReadable: true,
      permissionGranted: false,
    },
  };
  result.publicRead = decide(publicFacts, publicRequest);
  result.privateAnonymous = decide(
    { ...publicFacts, project: facts.project },
    publicRequest,
  );
  result.hiddenPublicObject = decide(
    {
      ...publicFacts,
      resource: { ...publicFacts.resource, publicReadable: false },
    },
    publicRequest,
  );
  const userRequest: PermissionRequest = {
    ...request,
    permission: 'issue:create',
  };
  const userFacts: AuthorizationFacts = {
    ...facts,
    binding: userRequest,
    principal: { ...principal, kind: 'user', assurance: 1 },
    membership: null,
    project: publicFacts.project,
  };
  result.authorizedPublicUser = decide(userFacts, userRequest);
  result.privateUser = decide(
    { ...userFacts, project: facts.project },
    userRequest,
  );
  const resolved = (value: AuthorizationFacts) =>
    authorize(request, { resolve: async () => value }, policy, {
      now: () => now,
    });
  result.resolved = await resolved(facts);
  result.recheckedRevocation = await resolved({
    ...facts,
    principal: { ...principal, credentialActive: false },
  });
  result.providerFailure = await authorize(
    request,
    {
      resolve: async () => {
        throw new Error('SEEDED_SECRET');
      },
    },
    policy,
  );
  result.providerMalformed = await resolved(
    null as unknown as AuthorizationFacts,
  );
  result.timeout = await authorize(
    request,
    { resolve: async () => new Promise(() => {}) },
    policy,
  );
  const cancelled = new AbortController();
  cancelled.abort();
  result.cancelled = await authorize(
    request,
    { resolve: async () => facts },
    policy,
    { signal: cancelled.signal },
  );
  const mutableRequest = { ...request, target: { ...request.target } };
  const snapshotCheck = authorize(
    mutableRequest,
    { resolve: async (snapshot) => ({ ...facts, binding: snapshot }) },
    policy,
    { now: () => now },
  );
  mutableRequest.target.id = otherId;
  result.requestSnapshot = await snapshotCheck;
  const mutablePolicy = { recentAuthMaxAgeMs: 1000, timeoutMs: 20 };
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const policyCheck = authorize(
    request,
    {
      resolve: async () => {
        await wait;
        return {
          ...facts,
          principal: { ...principal, authenticatedAtMs: now - 1001 },
        };
      },
    },
    mutablePolicy,
    { now: () => now },
  );
  mutablePolicy.recentAuthMaxAgeMs = 300000;
  release();
  result.policySnapshot = await policyCheck;
  result.malformedSignal = await authorize(
    request,
    { resolve: async () => facts },
    policy,
    {
      signal: { aborted: false } as AbortSignal,
      now: () => now,
    },
  );
  return result;
}

export const expectedSecurityScenarios: Record<string, AuthorizationDecision> =
  Object.fromEntries([
    ...[
      'administrator',
      'recentBoundary',
      'publicRead',
      'authorizedPublicUser',
      'resolved',
      'requestSnapshot',
    ].map((key) => [key, { allowed: true }]),
    ...[
      'differentActor',
      'differentAction',
      'differentObject',
      'differentProject',
      'objectPermissionDenied',
      'deletedObject',
      'archivedWrite',
      'revokedMembership',
      'crossProjectMembership',
      'lowerRole',
      'userCannotBecomeStaff',
      'suspended',
      'revokedCredential',
      'expiredCredential',
      'invalidExpiry',
      'futureAuthentication',
      'unknownPermission',
      'privateAnonymous',
      'hiddenPublicObject',
      'privateUser',
      'recheckedRevocation',
    ].map((key) => [key, { allowed: false, reason: 'forbidden' }]),
    ...['staleAuthentication', 'insufficientAssurance', 'policySnapshot'].map(
      (key) => [key, { allowed: false, reason: 'reauthentication_required' }],
    ),
    ...[
      'malformedFacts',
      'invalidPolicy',
      'providerFailure',
      'providerMalformed',
      'timeout',
      'cancelled',
      'malformedSignal',
    ].map((key) => [key, { allowed: false, reason: 'unavailable' }]),
  ]);
