import { expect, it } from 'vitest';
import {
  auditEvent,
  auditRetentionProposal,
  createAuditService,
  deploymentEnablementAuditEvent,
} from '../../packages/security/src/index.ts';
import {
  auditScenarios,
  auditFixture,
  auditPolicy,
  auditNow,
} from '../fixtures/audit-scenarios.ts';

it('fails closed across authorization, storage, cancellation, overload and retention boundaries', async () => {
  const results = await auditScenarios();
  expect(Object.keys(results).length).toBeGreaterThan(20);
  for (const [name, passed] of Object.entries(results))
    expect(passed, name).toBe(true);
});
it('rejects secrets, arbitrary metadata, forged actor/scope, malformed values and unknown event actions', () => {
  const event = auditFixture();
  for (const changes of [
    { password: 'SEEDED_SECRET' },
    { metadata: { secret: 'SEEDED_SECRET' } },
    { targetId: 'SEEDED_SECRET' },
    { action: 'plugin.arbitrary' },
    { createdAt: NaN },
    { result: 'unknown' },
    { projectId: null },
    { actorId: null },
    { systemActor: 'core.key-registry' },
    { id: '__proto__' },
  ])
    expect(() => auditEvent({ ...event, ...changes })).toThrow('AUDIT_INVALID');
  for (const changes of [
    { maxBatch: 101 },
    { retentionSeconds: 0 },
    { legalHold: undefined },
    { now: Infinity },
  ])
    expect(() =>
      auditRetentionProposal({
        now: auditNow,
        retentionSeconds: 86400,
        legalHold: false,
        maxBatch: 100,
        ...changes,
      } as never),
    ).toThrow();
  expect(Object.isFrozen(event)).toBe(true);
  expect(Object.isFrozen(event.metadata)).toBe(true);
});
it('validates provider-outage audit events with a closed catalog', () => {
  const event = auditFixture();
  const outage = {
    ...event,
    projectId: null,
    actorId: null,
    systemActor: 'core.admission',
    action: 'provider.outage',
    targetId: JSON.stringify(['turnstile', 'register']),
    result: 'failure',
    metadata: { v: 1, outcome: 'unavailable' },
  };
  expect(auditEvent(outage)).toEqual(outage);
  for (const changes of [
    { targetId: JSON.stringify(['SEEDED_SECRET', 'register']) },
    { targetId: JSON.stringify(['turnstile', 'register', 'extra']) },
    { targetId: 'SEEDED_SECRET' },
    { metadata: { v: 1, outcome: 'allowed' } },
    { metadata: { v: 1, outcome: 'SEEDED_SECRET' } },
    { systemActor: 'core.authorization' },
    { result: 'success' },
    { actorId: crypto.randomUUID() },
  ])
    expect(() => auditEvent({ ...outage, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
});

it('validates deployment-enablement audit events with a closed catalog', () => {
  const event = auditFixture();
  const enablement = {
    ...event,
    projectId: null,
    actorId: null,
    systemActor: 'core.deployment',
    action: 'deployment.enablement',
    targetId: 'cloudflare-free-minimum',
    result: 'failure',
    metadata: { v: 1, acknowledgement: 'free-minimum-v1', outcome: 'refused' },
  };
  expect(auditEvent(enablement)).toEqual(enablement);
  const enabled = deploymentEnablementAuditEvent('enabled', 1800000000000);
  expect(auditEvent(enabled)).toEqual(enabled);
  expect(deploymentEnablementAuditEvent('refused', 1800000000001).result).toBe(
    'failure',
  );
  for (const changes of [
    { targetId: 'SEEDED_SECRET' },
    { targetId: 'standard' },
    {
      metadata: {
        v: 1,
        acknowledgement: 'free-minimum-v0',
        outcome: 'refused',
      },
    },
    {
      metadata: {
        v: 1,
        acknowledgement: 'free-minimum-v1',
        outcome: 'SEEDED_SECRET',
      },
    },
    { result: 'success' },
    { systemActor: 'core.admission' },
    { actorId: crypto.randomUUID() },
  ])
    expect(() => auditEvent({ ...enablement, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
});

it('validates existing key-registry audit identities without exposing key material', () => {
  const event = auditFixture();
  const keyEvent = {
    ...event,
    projectId: null,
    actorId: null,
    systemActor: 'core.key-registry',
    action: 'key-registry.revoke',
    targetId: JSON.stringify(['envelope-kek', 'test-key', 1]),
    metadata: { v: 1, generation: 4 },
  };
  expect(auditEvent(keyEvent)).toEqual(keyEvent);
  for (const targetId of [
    JSON.stringify(['envelope-kek', 'test-key', 1, 'SEEDED_SECRET']),
    JSON.stringify(['unapproved', 'test-key', 1]),
    'SEEDED_SECRET',
  ])
    expect(() => auditEvent({ ...keyEvent, targetId })).toThrow(
      'AUDIT_INVALID',
    );
});
it('rejects invalid admission configuration before any work', () => {
  const repository = { append: async () => {}, list: async () => [] };
  const authorization = {
    resolve: async () => {
      throw new Error('unexpected');
    },
  };
  for (const settings of [
    { timeoutMs: 0 },
    { timeoutMs: 5001 },
    { maxConcurrent: 0 },
    { maxConcurrent: 17 },
  ])
    expect(() =>
      createAuditService({
        repository,
        authorization,
        policy: auditPolicy,
        ...settings,
      }),
    ).toThrow();
});
