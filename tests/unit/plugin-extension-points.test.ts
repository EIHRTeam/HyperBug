import { describe, expect, it } from 'vitest';
import {
  PLUGIN_HOOK_POINTS,
  pluginHookPoint,
  pluginMayOccupyPoint,
  pointFailurePolicy,
} from '@hyperbug/plugin-api';

// PLUGIN-SPEC §13: the closed extension-point catalog — security-critical
// points force fail-closed, sync points stay the PERFORMANCE §48 minimum,
// and external plugins cannot occupy in-process sync points.
describe('catalog shape (§13)', () => {
  it('fixes the sync set to the three security-critical verifications', () => {
    const sync = PLUGIN_HOOK_POINTS.filter((p) => p.mode === 'sync').map(
      (p) => p.point,
    );
    expect(sync).toEqual([
      'captcha:verify-required',
      'authentication:assert-identity',
      'sso:resolve-principal',
      'issue-metadata:validate',
    ]);
    expect(sync).toHaveLength(4);
    expect(
      PLUGIN_HOOK_POINTS.filter((p) => p.securityCritical).map((p) => p.point),
    ).toEqual([
      'captcha:verify-required',
      'authentication:assert-identity',
      'sso:resolve-principal',
    ]);
  });

  it('keeps every payload version positive and lookup closed', () => {
    for (const p of PLUGIN_HOOK_POINTS) expect(p.payloadVersion).toBe(1);
    expect(pluginHookPoint('captcha:verify-required')?.capability).toBe(
      'captcha',
    );
    expect(pluginHookPoint('teleport:nowhere')).toBeUndefined();
  });
});

describe('participation rules (§13.2)', () => {
  it('requires the capability and rejects unknown points', () => {
    expect(
      pluginMayOccupyPoint({
        point: 'notifications:deliver',
        declaredCapabilities: ['notifications'],
        trustTier: 'trusted-native',
      }),
    ).toEqual({ ok: true });
    expect(
      pluginMayOccupyPoint({
        point: 'notifications:deliver',
        declaredCapabilities: ['search'],
        trustTier: 'trusted-native',
      }).ok,
    ).toBe(false);
    expect(
      pluginMayOccupyPoint({
        point: 'captcha:magic',
        declaredCapabilities: ['captcha'],
        trustTier: 'trusted-native',
      }).ok,
    ).toBe(false);
  });

  it('reserves in-process sync points for trusted-native plugins', () => {
    const external = pluginMayOccupyPoint({
      point: 'captcha:verify-required',
      declaredCapabilities: ['captcha'],
      trustTier: 'isolated-external',
    });
    expect(external.ok).toBe(false);
    if (!external.ok)
      expect(external.errors.join('\n')).toMatch(/reserved for trusted-native/);
    expect(
      pluginMayOccupyPoint({
        point: 'notifications:deliver',
        declaredCapabilities: ['notifications'],
        trustTier: 'isolated-external',
      }),
    ).toEqual({ ok: true });
  });
});

describe('fail-closed enforcement (§13.2, the 03.3f re-scope)', () => {
  it('forces fail-closed on every security-critical point declaration', () => {
    const captcha = pluginHookPoint('captcha:verify-required')!;
    for (const declared of [
      'fail-closed',
      'fail-request',
      'enqueue-retry',
      'continue-without-effect',
    ] as const)
      expect(pointFailurePolicy(captcha, declared)).toBe('fail-closed');
    const notifications = pluginHookPoint('notifications:deliver')!;
    expect(pointFailurePolicy(notifications, 'enqueue-retry')).toBe(
      'enqueue-retry',
    );
  });
});
