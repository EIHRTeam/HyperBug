import { cryptoFixture } from './crypto-scenarios.ts';
import { issueSessionCookieFor } from '../../packages/server/src/account-session.ts';
import { generateAccountRecoveryCodes } from '../../packages/server/src/account-recovery.ts';
import { expect } from 'vitest';
import type {
  AccountAdministrationStore,
  AccountSessionStore,
  AccountRecoveryStore,
  StaffEnrollmentStore,
  ProjectRoleStore,
  PluginRegistryStore,
  PluginSettingsStore,
  PreparedAuditEvent,
} from '@hyperbug/application';
import { preparedAudit } from './prepared-audit-fixture.ts';
import { exampleNotifierPlugin } from './plugins/example-notifier.ts';

export async function atomicAuditContract(
  query: (
    sql: string,
    values?: (string | number)[],
  ) => Promise<Record<string, unknown>[]>,
  stores: {
    administration: AccountAdministrationStore;
    recovery: AccountRecoveryStore;
    enrollment: StaffEnrollmentStore;
    roles: ProjectRoleStore;
    registry: PluginRegistryStore;
    settings: PluginSettingsStore;
    sessions: AccountSessionStore;
    append: (event: PreparedAuditEvent) => Promise<void>;
  },
) {
  const principalId = crypto.randomUUID(),
    identityId = crypto.randomUUID(),
    projectId = crypto.randomUUID(),
    nowMs = Date.now();
  const passwordRecord = {
    v: 1 as const,
    alg: 'Argon2id' as const,
    memoryKiB: 19456,
    passes: 2,
    parallelism: 1,
    salt: 'AQEBAQEBAQEBAQEBAQEBAQ',
    verifier: 'AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI',
  };
  const enrollment = {
    principalId,
    identityId,
    handle: 'atomic_admin',
    passwordRecord,
    nowMs,
  };
  const duplicate = preparedAudit('account.enrolled', principalId);
  await stores.append(duplicate);
  const failing = (event: PreparedAuditEvent) => ({
    ...event,
    id: duplicate.id,
  });
  await expect(
    stores.enrollment.enrollStaff(enrollment, duplicate),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await query('SELECT id FROM principals')).toHaveLength(0);
  expect(
    (
      await stores.enrollment.enrollStaff(
        enrollment,
        preparedAudit('account.enrolled', principalId),
      )
    ).status,
  ).toBe('enrolled');
  expect(
    (
      await stores.enrollment.enrollStaff(
        {
          ...enrollment,
          handle: 'atomic_second',
          principalId: crypto.randomUUID(),
          identityId: crypto.randomUUID(),
        },
        duplicate,
      )
    ).status,
  ).toBe('staff-active');
  const target = crypto.randomUUID();
  await query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Target', ?)",
    [target, nowMs],
  );
  await query(
    "INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, 'atomic-audit', 'Atomic Audit', ?, ?)",
    [projectId, nowMs, nowMs],
  );
  const event = (
    action: string,
    id: string = target,
    project: string | null = null,
    metadata: PreparedAuditEvent['metadata'] = { v: 1 },
  ) => preparedAudit(action, id, principalId, project, metadata);
  await expect(
    stores.administration.suspendPrincipal(
      target,
      failing(event('principal.suspended')),
    ),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect((await stores.administration.loadPrincipal(target))?.status).toBe(
    'active',
  );
  await stores.administration.suspendPrincipal(
    target,
    event('principal.suspended'),
  );
  await expect(
    stores.administration.activatePrincipal(
      target,
      failing(event('principal.activated')),
    ),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect((await stores.administration.loadPrincipal(target))?.status).toBe(
    'suspended',
  );
  expect(
    await stores.administration.suspendPrincipal(
      target,
      failing(event('principal.suspended')),
    ),
  ).toBe(false);
  await stores.administration.activatePrincipal(
    target,
    event('principal.activated'),
  );
  const grant = {
    projectId,
    principalId: target,
    role: 'triage' as const,
    nowMs,
  };
  const grantEvent = () =>
    event('role.granted', target, projectId, { v: 1, role: 'triage' });
  await expect(
    stores.roles.grant(grant, failing(grantEvent())),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await stores.roles.loadRole(projectId, target)).toBeNull();
  await stores.roles.grant(grant, grantEvent());
  await expect(
    stores.roles.revoke(
      projectId,
      target,
      failing(event('role.revoked', target, projectId)),
    ),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await stores.roles.loadRole(projectId, target)).toEqual({
    role: 'triage',
  });
  expect(
    await stores.roles.revoke(
      projectId,
      crypto.randomUUID(),
      failing(event('role.revoked', target, projectId)),
    ),
  ).toBe(false);
  const replacement = { identityId, digests: ['{"old":true}'], nowMs };
  await stores.recovery.replaceCodes(
    replacement,
    event('recovery.generated', principalId),
  );
  const oldCodes = await stores.recovery.listActive(identityId);
  await expect(
    stores.recovery.replaceCodes(
      { ...replacement, digests: ['{"new":true}'] },
      failing(event('recovery.generated', principalId)),
    ),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await stores.recovery.listActive(identityId)).toEqual(oldCodes);
  const keyProvider = cryptoFixture().provider;
  const cookie = await issueSessionCookieFor({
    account: { principalId, identityId, credentialRevision: 1 },
    ceremony: { method: 'password', assurance: 1 },
    provider: keyProvider,
    store: stores.sessions,
    signal: new AbortController().signal,
    nowMs: nowMs - 300_001,
  });
  await expect(
    generateAccountRecoveryCodes({
      request: new Request('https://auth.fixture/auth/recovery-codes', {
        method: 'POST',
        headers: {
          origin: 'https://auth.fixture',
          cookie: cookie.split(';')[0]!,
        },
      }),
      keyProvider,
      recoveryStore: stores.recovery,
      sessionStore: stores.sessions,
      auditAppend: null,
      nowMs,
      recentAuthMaxAgeMs: 300_000,
    }),
  ).rejects.toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });
  expect(await stores.recovery.listActive(identityId)).toEqual(oldCodes);
  const manifest = exampleNotifierPlugin,
    id = manifest.id;
  const record = {
    id,
    version: manifest.version,
    state: 'registered' as const,
    manifest,
    registeredAtMs: nowMs,
    updatedAtMs: nowMs,
  };
  const registered = () =>
    event('plugin.registered', id, null, { v: 1, version: manifest.version });
  await expect(
    stores.registry.insert(record, failing(registered())),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await stores.registry.load(id)).toBeNull();
  await stores.registry.insert(record, registered());
  expect(await stores.registry.insert(record, failing(registered()))).toBe(
    'conflict',
  );
  const transition = {
    ...record,
    state: 'enabled' as const,
    expectedState: 'registered' as const,
    nowMs,
  };
  await expect(
    stores.registry.transition(
      transition,
      failing(event('plugin.enabled', id)),
    ),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect((await stores.registry.load(id))?.state).toBe('registered');
  expect(
    await stores.registry.transition(
      { ...transition, expectedState: 'disabled' },
      failing(event('plugin.enabled', id)),
    ),
  ).toBeNull();
  const setting = {
    id: crypto.randomUUID(),
    pluginId: id,
    key: 'public-value',
    kind: 'public' as const,
    publicValue: 'old',
    updatedAtMs: nowMs,
  };
  const configured = () =>
    event('plugin.configured', id, null, {
      v: 1,
      publicCount: 2,
      secretCount: 0,
    });
  await stores.settings.configure(
    [setting],
    event('plugin.configured', id, null, {
      v: 1,
      publicCount: 1,
      secretCount: 0,
    }),
  );
  await expect(
    stores.settings.configure(
      [
        { ...setting, publicValue: 'changed' },
        { ...setting, id: crypto.randomUUID(), key: 'second' },
      ],
      failing(configured()),
    ),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await stores.settings.list(id)).toEqual([setting]);
  const uninstalled = () =>
    event('plugin.uninstalled', id, null, {
      v: 1,
      version: manifest.version,
      policy: 'delete',
    });
  await expect(
    stores.registry.remove(id, failing(uninstalled()), true),
  ).rejects.toMatchObject({ code: 'AUDIT_UNAVAILABLE' });
  expect(await stores.registry.load(id)).not.toBeNull();
  expect(await stores.settings.list(id)).toEqual([setting]);
  expect(
    await stores.registry.remove(
      '@hyperbug/absent',
      failing(
        event('plugin.uninstalled', '@hyperbug/absent', null, {
          v: 1,
          version: '1.0.0',
          policy: 'delete',
        }),
      ),
      true,
    ),
  ).toBe(false);
  expect(await stores.registry.remove(id, uninstalled(), true)).toBe(true);
  expect(await stores.settings.list(id)).toEqual([]);
  expect((await query('SELECT id FROM audit_events')).length).toBe(9);
}
