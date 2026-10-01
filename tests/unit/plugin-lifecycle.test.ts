import { describe, expect, it } from 'vitest';
import {
  PLUGIN_LIFECYCLE_STATES,
  PLUGIN_LIFECYCLE_TRANSITIONS,
  checkConfiguration,
  compareSemver,
  decideEnable,
  decideRegistration,
  type PluginManifest,
} from '@hyperbug/plugin-api';
import type { PluginConfigurationInput } from '@hyperbug/plugin-api';

// PLUGIN-SPEC §10: the pure lifecycle model the registry (05.2a) will enforce.
const manifest = {
  id: '@hyperbug/example',
  version: '1.2.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['captcha'],
  extensionPoints: [],
  permissions: [],
  settings: [
    { key: 'site-key', kind: 'public', valueType: 'string', defaultValue: 'x' },
    { key: 'threshold', kind: 'public', valueType: 'number' },
    { key: 'secret-key', kind: 'secret' },
  ],
} as unknown as PluginManifest;

const complete: PluginConfigurationInput = {
  publicValues: { threshold: 3 },
  secretPresent: ['secret-key'],
};

describe('registration and upgrade decisions (§§10.2, 10.5)', () => {
  it('accepts a compatible registration of a new id', () => {
    expect(
      decideRegistration({
        kind: 'register',
        manifest,
        hostApiVersion: '1.2.0',
      }),
    ).toMatchObject({ ok: true });
  });

  it('rejects registration when the host api version does not satisfy the range', () => {
    const decision = decideRegistration({
      kind: 'register',
      manifest,
      hostApiVersion: '2.0.0',
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.errors[0]).toMatch(/apiVersion/);
  });

  it('rejects registering an id that already exists', () => {
    const decision = decideRegistration({
      kind: 'register',
      manifest,
      hostApiVersion: '1.2.0',
      currentId: '@hyperbug/example',
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.errors[0]).toMatch(/already registered/);
  });

  it('accepts a higher-version upgrade from a non-enabled state', () => {
    expect(
      decideRegistration({
        kind: 'upgrade',
        manifest: { ...manifest, version: '1.3.0' },
        hostApiVersion: '1.2.0',
        currentState: 'disabled',
        currentId: '@hyperbug/example',
        currentVersion: '1.2.0',
      }),
    ).toMatchObject({ ok: true });
  });

  it('rejects upgrading an enabled plugin, a downgrade and an id change', () => {
    const enabled = decideRegistration({
      kind: 'upgrade',
      manifest: { ...manifest, version: '2.0.0' },
      hostApiVersion: '1.2.0',
      currentState: 'enabled',
      currentId: '@hyperbug/example',
      currentVersion: '1.2.0',
    });
    const downgrade = decideRegistration({
      kind: 'upgrade',
      manifest: { ...manifest, version: '1.1.0' },
      hostApiVersion: '1.2.0',
      currentState: 'disabled',
      currentId: '@hyperbug/example',
      currentVersion: '1.2.0',
    });
    const otherId = decideRegistration({
      kind: 'upgrade',
      manifest: { ...manifest, version: '2.0.0', id: '@hyperbug/other' },
      hostApiVersion: '1.2.0',
      currentState: 'disabled',
      currentId: '@hyperbug/example',
      currentVersion: '1.2.0',
    });
    for (const decision of [enabled, downgrade, otherId]) {
      expect(decision.ok).toBe(false);
    }
  });
});

describe('configuration and enable decisions (§10.3)', () => {
  it('accepts a complete configuration from registered and disabled', () => {
    for (const state of ['registered', 'disabled'] as const)
      expect(
        decideEnable({ state, manifest, configuration: complete }),
      ).toMatchObject({ ok: true });
  });

  it('rejects enable from enabled and checks state legality', () => {
    const decision = decideEnable({
      state: 'enabled',
      manifest,
      configuration: complete,
    });
    expect(decision.ok).toBe(false);
  });

  it('reports missing public values, missing secrets and unknown keys', () => {
    const decision = decideEnable({
      state: 'registered',
      manifest,
      configuration: { publicValues: { bogus: 1 }, secretPresent: [] },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.errors.join('\n')).toMatch(/threshold has no value/);
      expect(decision.errors.join('\n')).toMatch(/secret-key is not present/);
      expect(decision.errors.join('\n')).toMatch(
        /bogus is not a public setting/,
      );
    }
  });

  it('rejects public values with the wrong type', () => {
    const decision = checkConfiguration(manifest, {
      publicValues: { threshold: 'many' },
      secretPresent: ['secret-key'],
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.errors[0]).toMatch(/expects number/);
  });

  it('uses declared defaults for public settings', () => {
    const decision = checkConfiguration(manifest, {
      publicValues: { threshold: 1 },
      secretPresent: ['secret-key'],
    });
    expect(decision).toMatchObject({ ok: true });
  });
});

describe('transition table (§10.1)', () => {
  it('keeps enable illegal while enabled and disable illegal unless enabled', () => {
    expect(PLUGIN_LIFECYCLE_TRANSITIONS.enabled).toEqual([
      'disable',
      'uninstall',
    ]);
    expect(PLUGIN_LIFECYCLE_TRANSITIONS.registered).toContain('enable');
    expect(PLUGIN_LIFECYCLE_TRANSITIONS.disabled).toContain('enable');
    expect(PLUGIN_LIFECYCLE_TRANSITIONS.registered).not.toContain('disable');
    expect(PLUGIN_LIFECYCLE_STATES).toEqual([
      'registered',
      'enabled',
      'disabled',
    ]);
  });
});

describe('compareSemver (§9.1)', () => {
  it('orders versions with prereleases below their release', () => {
    expect(compareSemver('1.2.0', '1.2.1')).toBeLessThan(0);
    expect(compareSemver('1.3.0', '1.2.9')).toBeGreaterThan(0);
    expect(compareSemver('1.2.0', '1.2.0')).toBe(0);
    expect(compareSemver('1.2.0-beta', '1.2.0')).toBeLessThan(0);
    expect(() => compareSemver('banana', '1.0.0')).toThrow(TypeError);
  });
});
