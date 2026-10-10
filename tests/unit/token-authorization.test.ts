import { expect, it } from 'vitest';
import {
  authorize,
  instanceId,
  type PermissionRequest,
} from '../../packages/security/src/index.ts';
import { createDbAuthorizationResolver } from '../../packages/server/src/authorization-facts.ts';

const actorId = '00000000-0000-4000-8000-000000000001';
const now = 1800000000000;
const request: PermissionRequest = {
  actorId,
  permission: 'instance:principals.manage',
  target: { id: instanceId, projectId: instanceId, type: 'instance' },
};
const policy = { recentAuthMaxAgeMs: 300000, timeoutMs: 1000 };
const credential = { assurance: 2 as const, authenticatedAtMs: now - 1000 };
function resolver(admin: boolean) {
  return createDbAuthorizationResolver({
    loadPrincipal: async () => ({
      kind: 'staff',
      status: 'active',
      credentialActive: true,
    }),
    loadInstanceRole: async () =>
      admin ? { principalId: actorId, role: 'instance-administrator' } : null,
    // Instance actions must never borrow project membership or visibility.
    loadProject: async () => {
      throw new Error('Project consulted');
    },
    loadMembership: async () => {
      throw new Error('Project role consulted');
    },
  });
}

it('requires an instance role independently of project administration', async () => {
  const options = { credential, now: () => now };
  expect(await authorize(request, resolver(true), policy, options)).toEqual({
    allowed: true,
  });
  expect(await authorize(request, resolver(false), policy, options)).toEqual({
    allowed: false,
    reason: 'forbidden',
  });
  expect(
    await authorize(
      { ...request, target: { ...request.target, id: actorId } },
      resolver(true),
      policy,
      options,
    ),
  ).toEqual({ allowed: false, reason: 'forbidden' });
});

it('binds step-up to the presented credential and honors the configured age', async () => {
  const facts = resolver(true);
  expect(
    await authorize(request, facts, policy, { credential, now: () => now }),
  ).toEqual({ allowed: true });
  expect(
    await authorize(request, facts, policy, {
      credential: { ...credential, assurance: 1 },
      now: () => now,
    }),
  ).toEqual({ allowed: false, reason: 'reauthentication_required' });
  expect(
    await authorize(request, facts, policy, {
      credential: { ...credential, authenticatedAtMs: now - 300001 },
      now: () => now,
    }),
  ).toEqual({ allowed: false, reason: 'reauthentication_required' });
  expect(
    await authorize(
      request,
      facts,
      { ...policy, recentAuthMaxAgeMs: 1000 },
      { credential, now: () => now + 1 },
    ),
  ).toEqual({ allowed: false, reason: 'reauthentication_required' });
  expect(await authorize(request, facts, policy, { now: () => now })).toEqual({
    allowed: false,
    reason: 'unavailable',
  });
});

it('snapshots ceremony facts before asynchronous resolution', async () => {
  const mutable = { assurance: 1 as 1 | 2, authenticatedAtMs: now - 1000 };
  const decision = authorize(request, resolver(true), policy, {
    credential: mutable,
    now: () => now,
  });
  mutable.assurance = 2;
  expect(await decision).toEqual({
    allowed: false,
    reason: 'reauthentication_required',
  });
});
