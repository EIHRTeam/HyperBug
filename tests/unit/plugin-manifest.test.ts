import { expect, describe, it } from 'vitest';
import {
  apiVersionSatisfies,
  pluginDataNamespace,
  validatePluginManifest,
  type PluginManifest,
} from '@hyperbug/plugin-api';
import { definePlugin } from '@hyperbug/plugin-sdk';

// PLUGIN-SPEC §9: the manifest schema is the shared author/host contract.
// These cases pin the acceptance-relevant rejections (05.3a exercises the
// runtime side); here the schema and its semantic rule are under test.
const validManifest = {
  id: '@hyperbug/example',
  version: '1.2.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.1.0',
  capabilities: ['captcha', 'settings.admin'],
  extensionPoints: ['settings.admin:panel'],
  permissions: ['secrets:read', 'network:fetch'],
  settings: [
    {
      key: 'site-key',
      kind: 'public',
      valueType: 'string',
      defaultValue: '',
    },
    { key: 'secret-key', kind: 'secret' },
  ],
  csp: {
    scriptOrigins: ['https://challenges.example.net'],
    frameOrigins: [],
    connectOrigins: ['https://api.example.net'],
    imageOrigins: [],
  },
  displayName: 'Example',
  description: 'Example plugin',
} as const;

const invalid = (manifest: Record<string, unknown>) =>
  expect(validatePluginManifest(manifest).ok).toBe(false);

it('accepts a conforming manifest and definePlugin returns it typed', () => {
  const result = validatePluginManifest(validManifest);
  expect(result).toMatchObject({ ok: true });
  expect(result.ok && result.manifest.id).toBe('@hyperbug/example');
  expect(definePlugin(validManifest as unknown as PluginManifest)).toEqual(
    validManifest,
  );
});

it('definePlugin throws with the validation errors on an invalid manifest', () => {
  expect(() =>
    definePlugin({
      ...validManifest,
      id: 'example',
    } as unknown as PluginManifest),
  ).toThrow(/invalid plugin manifest: .*id/s);
});

describe('manifest rejections', () => {
  it('rejects an unscoped or malformed id', () => {
    invalid({ ...validManifest, id: 'example' });
    invalid({ ...validManifest, id: '@Hyperbug/example' });
    invalid({ ...validManifest, id: '@hyperbug/' });
  });

  it('rejects a non-semver plugin version', () => {
    invalid({ ...validManifest, version: '1.2' });
    invalid({ ...validManifest, version: 'v1.2.0' });
  });

  it('rejects an unsupported api version range grammar', () => {
    invalid({ ...validManifest, apiVersion: '>=1.0.0 <2.0.0' });
    invalid({ ...validManifest, apiVersion: '*' });
    invalid({ ...validManifest, apiVersion: '^1' });
  });

  it('rejects unknown capabilities and unknown top-level fields', () => {
    invalid({ ...validManifest, capabilities: ['captcha', 'teleport'] });
    invalid({ ...validManifest, sandbox: true });
  });

  it('rejects an extension point whose capability is not declared', () => {
    invalid({
      ...validManifest,
      extensionPoints: ['notifications:menu', 'settings.admin:panel'],
    });
  });

  it('rejects secret settings that carry defaults or value types', () => {
    invalid({
      ...validManifest,
      settings: [
        ...validManifest.settings,
        { key: 's', kind: 'secret', defaultValue: 'x' },
      ],
    });
    invalid({
      ...validManifest,
      settings: [
        ...validManifest.settings,
        { key: 's', kind: 'secret', valueType: 'string' },
      ],
    });
  });

  it('rejects public settings without a value type and duplicate keys', () => {
    invalid({
      ...validManifest,
      settings: [{ key: 'k', kind: 'public' }],
    });
    invalid({
      ...validManifest,
      settings: [
        { key: 'k', kind: 'public', valueType: 'string' },
        { key: 'k', kind: 'public', valueType: 'number' },
      ],
    });
  });

  it('rejects wildcard, path-bearing and plain-http CSP origins', () => {
    const csp = (origins: string[]) => ({
      scriptOrigins: origins,
      frameOrigins: [],
      connectOrigins: [],
      imageOrigins: [],
    });
    invalid({ ...validManifest, csp: csp(['https://*.example.net']) });
    invalid({ ...validManifest, csp: csp(['https://example.net/path']) });
    invalid({ ...validManifest, csp: csp(['http://example.net']) });
  });

  it('rejects unknown permissions', () => {
    invalid({ ...validManifest, permissions: ['admin:*'] });
  });
});

describe('apiVersionSatisfies (PLUGIN-SPEC §9.2)', () => {
  it('exact ranges require equality', () => {
    expect(apiVersionSatisfies('1.1.0', '1.1.0')).toBe(true);
    expect(apiVersionSatisfies('1.1.0', '1.2.0')).toBe(false);
  });

  it('caret stays inside the leftmost non-zero segment', () => {
    expect(apiVersionSatisfies('^1.0.0', '1.1.0')).toBe(true);
    expect(apiVersionSatisfies('^1.0.0', '2.0.0')).toBe(false);
    expect(apiVersionSatisfies('^0.2.3', '0.2.9')).toBe(true);
    expect(apiVersionSatisfies('^0.2.3', '0.3.0')).toBe(false);
    expect(apiVersionSatisfies('^0.0.3', '0.0.3')).toBe(true);
    expect(apiVersionSatisfies('^0.0.3', '0.0.4')).toBe(false);
  });

  it('tilde stays inside the minor version', () => {
    expect(apiVersionSatisfies('~1.1.0', '1.1.9')).toBe(true);
    expect(apiVersionSatisfies('~1.1.0', '1.2.0')).toBe(false);
  });

  it('treats prereleases as same-core and same-tag only', () => {
    expect(apiVersionSatisfies('1.1.0', '1.1.1-beta')).toBe(false);
    expect(apiVersionSatisfies('^1.0.0', '1.1.0-beta')).toBe(false);
    expect(apiVersionSatisfies('^1.1.0-beta', '1.1.0-beta')).toBe(true);
    expect(apiVersionSatisfies('^1.1.0-beta', '1.2.0-beta')).toBe(false);
    expect(apiVersionSatisfies('^1.1.0-beta', '1.1.0')).toBe(true);
  });

  it('rejects malformed input instead of guessing', () => {
    expect(apiVersionSatisfies('banana', '1.1.0')).toBe(false);
    expect(apiVersionSatisfies('^1.1.0', 'banana')).toBe(false);
  });
});

describe('pluginDataNamespace (PLUGIN-SPEC §9.7)', () => {
  it('derives the namespace from a validated id', () => {
    expect(pluginDataNamespace('@hyperbug/example')).toBe(
      'plugin_hyperbug_example',
    );
    expect(pluginDataNamespace('@acme/import-export')).toBe(
      'plugin_acme_import_export',
    );
  });

  it('throws on ids that are not plugin ids', () => {
    expect(() => pluginDataNamespace('example')).toThrow(TypeError);
    expect(() => pluginDataNamespace('@Hyperbug/x')).toThrow(TypeError);
  });
});
