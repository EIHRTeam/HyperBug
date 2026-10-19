import { describe, expect, it } from 'vitest';
import {
  apiVersionSatisfies,
  decideEnable,
  decideRegistration,
  validatePluginManifest,
} from '@hyperbug/plugin-api';
import { definePlugin } from '@hyperbug/plugin-sdk';
import { exampleNotifierPlugin } from '../fixtures/plugins/example-notifier.ts';

// 05.3a: the negative-fixture matrix — every incompatibility dimension
// rejects at its owning layer. Route-level equivalents run in the workerd and
// PostgreSQL plugin suites; this is the contract-level aggregation.
const conforming = { ...exampleNotifierPlugin } as const;

describe('incompatible versions', () => {
  it('rejects a manifest whose api range the host cannot satisfy', () => {
    expect(
      decideRegistration({
        kind: 'register',
        manifest: { ...conforming, apiVersion: '^2.0.0' },
        hostApiVersion: '1.6.0',
      }).ok,
    ).toBe(false);
    expect(apiVersionSatisfies('^2.0.0', '1.6.0')).toBe(false);
  });

  it('rejects an upgrade that does not strictly increase the version', () => {
    for (const version of ['1.0.0', '0.9.0']) {
      const decision = decideRegistration({
        kind: 'upgrade',
        manifest: { ...conforming, version },
        hostApiVersion: '1.6.0',
        currentState: 'disabled',
        currentId: conforming.id,
        currentVersion: '1.0.0',
      });
      expect(decision.ok).toBe(false);
    }
  });
});

describe('malformed manifests', () => {
  it('rejects each structural violation with errors', () => {
    for (const manifest of [
      { ...conforming, id: 'unscoped' },
      { ...conforming, version: '1.0' },
      { ...conforming, trustTier: 'magical' },
      { ...conforming, extra: true },
    ]) {
      const result = validatePluginManifest(manifest);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe('unknown capabilities', () => {
  it('rejects a capability outside the vocabulary', () => {
    expect(
      validatePluginManifest({ ...conforming, capabilities: ['telepathy'] }).ok,
    ).toBe(false);
  });
});

describe('missing secrets and invalid configuration', () => {
  const configured = definePlugin({
    ...conforming,
    id: '@hyperbug/configured',
    settings: [
      { key: 'api-key', kind: 'secret' },
      { key: 'threshold', kind: 'public', valueType: 'number' },
    ],
  });

  it('denies enable while a declared secret is absent', () => {
    const decision = decideEnable({
      state: 'registered',
      manifest: configured,
      configuration: { publicValues: { threshold: 1 }, secretPresent: [] },
    });
    expect(decision.ok).toBe(false);
  });

  it('denies enable on wrong-typed or unknown configuration values', () => {
    for (const configuration of [
      { publicValues: { threshold: 'many' }, secretPresent: ['api-key'] },
      { publicValues: { rogue: 1 }, secretPresent: ['api-key'] },
      { publicValues: { threshold: 1 }, secretPresent: ['rogue'] },
    ]) {
      expect(
        decideEnable({
          state: 'registered',
          manifest: configured,
          configuration,
        }).ok,
      ).toBe(false);
    }
  });

  it('accepts enable on complete configuration', () => {
    expect(
      decideEnable({
        state: 'registered',
        manifest: configured,
        configuration: {
          publicValues: { threshold: 1 },
          secretPresent: ['api-key'],
        },
      }),
    ).toMatchObject({ ok: true });
  });
});

describe('disabled-plugin behavior', () => {
  it('keeps a disabled plugin inert: no enable, no publish participation', async () => {
    expect(
      decideEnable({
        state: 'enabled',
        manifest: conforming,
        configuration: { publicValues: {}, secretPresent: [] },
      }).ok,
    ).toBe(false);
    const { invokePluginHook } = await import('@hyperbug/plugin-runtime');
    const invocation = await invokePluginHook({
      module: {
        manifest: exampleNotifierPlugin,
        hooks: { 'notifications:deliver': () => ({}) },
      },
      point: 'notifications:deliver',
      state: 'disabled',
      payload: {},
      nowMs: Date.now(),
      deadlineMs: 100,
    });
    expect(invocation).toEqual({ action: 'disabled', error: 'disabled' });
  });
});
