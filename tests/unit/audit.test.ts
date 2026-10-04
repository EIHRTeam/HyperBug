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
  auditActor,
  auditProject,
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
it('validates identity-lifetime audit events with a closed catalog', () => {
  const event = auditFixture();
  const enrolled = {
    ...event,
    projectId: null,
    actorId: null,
    systemActor: 'core.identity',
    action: 'account.enrolled',
    targetId: crypto.randomUUID(),
    result: 'success',
    metadata: { v: 1 },
  };
  expect(auditEvent(enrolled)).toEqual(enrolled);
  const attributed = {
    ...enrolled,
    actorId: auditActor,
    systemActor: null,
    targetId: crypto.randomUUID(),
  };
  for (const changes of [
    { action: 'account.linked', metadata: { v: 1, kind: 'passkey' } },
    { action: 'account.recovered', metadata: { v: 1 } },
    { action: 'recovery.generated', metadata: { v: 1 } },
    { action: 'session.revoked', metadata: { v: 1 } },
  ]) {
    const lifetime = { ...attributed, ...changes };
    expect(auditEvent(lifetime)).toEqual(lifetime);
  }
  for (const changes of [
    { systemActor: 'core.authorization' },
    { actorId: auditActor },
    { projectId: auditProject },
    { result: 'failure' },
    { metadata: { v: 1, kind: 'passkey' } },
  ])
    expect(() => auditEvent({ ...enrolled, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
  const linked = {
    ...attributed,
    action: 'account.linked',
    metadata: { v: 1, kind: 'passkey' },
  };
  for (const changes of [
    { actorId: null, systemActor: 'core.identity' },
    { metadata: { v: 1, kind: 'password' } },
    { metadata: { v: 1, kind: 'passkey', extra: 1 } },
  ])
    expect(() => auditEvent({ ...linked, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
});

it('validates administration audit events with a closed catalog', () => {
  const event = auditFixture();
  const granted = {
    ...event,
    projectId: auditProject,
    actorId: auditActor,
    systemActor: null,
    action: 'role.granted',
    targetId: crypto.randomUUID(),
    result: 'success',
    metadata: { v: 1, role: 'maintainer' },
  };
  expect(auditEvent(granted)).toEqual(granted);
  for (const changes of [
    { action: 'role.revoked', metadata: { v: 1 } },
    { action: 'principal.suspended', projectId: null, metadata: { v: 1 } },
    { action: 'principal.activated', projectId: null, metadata: { v: 1 } },
  ]) {
    const administration = { ...granted, ...changes };
    expect(auditEvent(administration)).toEqual(administration);
  }
  for (const changes of [
    { projectId: null },
    { metadata: { v: 1, role: 'SEEDED_SECRET' } },
    { metadata: { v: 1 } },
    { systemActor: 'core.identity' },
  ])
    expect(() => auditEvent({ ...granted, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
  const suspended = {
    ...granted,
    projectId: null,
    action: 'principal.suspended',
    metadata: { v: 1 },
  };
  for (const changes of [{ result: 'failure' }, { projectId: auditProject }])
    expect(() => auditEvent({ ...suspended, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
});

it('validates plugin administration audit events with a closed catalog', () => {
  const event = auditFixture();
  const registered = {
    ...event,
    projectId: null,
    actorId: auditActor,
    systemActor: null,
    action: 'plugin.registered',
    targetId: '@hyperbug/example',
    result: 'success',
    metadata: { v: 1, version: '1.0.0' },
  };
  expect(auditEvent(registered)).toEqual(registered);
  for (const changes of [
    { action: 'plugin.upgraded', metadata: { v: 1, version: '1.2.0' } },
    { action: 'plugin.enabled', metadata: { v: 1 } },
    { action: 'plugin.disabled', metadata: { v: 1 } },
    {
      action: 'plugin.uninstalled',
      metadata: { v: 1, version: '1.2.0', policy: 'retain' },
    },
    {
      action: 'plugin.uninstalled',
      metadata: { v: 1, version: '1.2.0', policy: 'delete' },
    },
    {
      action: 'plugin.configured',
      metadata: { v: 1, publicCount: 2, secretCount: 1 },
    },
    {
      action: 'plugin.configured',
      metadata: { v: 1, publicCount: 0, secretCount: 0 },
    },
  ]) {
    const pluginEvent = { ...registered, ...changes };
    expect(auditEvent(pluginEvent)).toEqual(pluginEvent);
  }
  for (const changes of [
    { projectId: auditProject },
    { actorId: null },
    { systemActor: 'core.identity' },
    { result: 'failure' },
    { targetId: crypto.randomUUID() },
    { targetId: 'hyperbug/example' },
    { metadata: { v: 1, version: 'not-semver' } },
    { metadata: { v: 1 } },
    { metadata: { v: 1, version: '1.0.0', secret: 'SEEDED_SECRET' } },
    { action: 'plugin.removed' },
  ])
    expect(() => auditEvent({ ...registered, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
  const configured = {
    ...registered,
    action: 'plugin.configured',
    metadata: { v: 1, publicCount: 1, secretCount: 1 },
  };
  for (const changes of [
    { metadata: { v: 1, publicCount: -1, secretCount: 1 } },
    { metadata: { v: 1, publicCount: 1, secretCount: 129 } },
    { metadata: { v: 1, publicCount: 1, secretCount: 1, apiKey: 'SEEDED' } },
  ])
    expect(() => auditEvent({ ...configured, ...changes })).toThrow(
      'AUDIT_INVALID',
    );
  const uninstalled = {
    ...registered,
    action: 'plugin.uninstalled',
    metadata: { v: 1, version: '1.2.0', policy: 'retain' },
  };
  for (const changes of [
    { metadata: { v: 1, version: '1.2.0', policy: 'reset' } },
    { metadata: { v: 1, version: '1.2.0' } },
  ])
    expect(() => auditEvent({ ...uninstalled, ...changes })).toThrow(
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

it('records an instance-role backfill with a closed system event', () => {
  const event = {
    ...auditFixture(),
    projectId: null,
    actorId: null,
    systemActor: 'core.deployment',
    action: 'instance-role.backfilled',
    targetId: auditActor,
    result: 'success',
    metadata: { v: 1, role: 'instance-administrator' },
  };
  expect(auditEvent(event).action).toBe('instance-role.backfilled');
  for (const change of [
    { actorId: auditActor },
    { projectId: auditProject },
    { metadata: { v: 1, role: 'administrator' } },
    { metadata: { v: 1, role: 'instance-administrator', source: 'unbounded' } },
  ])
    expect(() => auditEvent({ ...event, ...change })).toThrow('AUDIT_INVALID');
});
