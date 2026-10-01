import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  PLUGIN_API_PACKAGE,
  PLUGIN_API_VERSION,
  PLUGIN_TRUST_TIERS,
} from '@hyperbug/plugin-api';
import {
  PLUGIN_API_VERSION as apiVersionThroughSdk,
  PLUGIN_SDK_VERSION,
} from '@hyperbug/plugin-sdk';
import {
  PLUGIN_API_VERSION as apiVersionThroughRuntime,
  PLUGIN_RUNTIME_VERSION,
} from '@hyperbug/plugin-runtime';

// PLUGIN-SPEC §4: the three public-contract packages are separately versioned,
// and their exported version constants are the compatibility surface manifests
// and the host reference. These checks keep the constants from drifting away
// from the manifests they claim to carry.
type ContractManifest = {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
};

const manifest = (pkg: 'plugin-api' | 'plugin-sdk' | 'plugin-runtime') =>
  JSON.parse(
    readFileSync(
      new URL(`../../packages/${pkg}/package.json`, import.meta.url),
      'utf8',
    ),
  ) as ContractManifest;

it('exports the version each contract package manifest declares', () => {
  const api = manifest('plugin-api');
  const sdk = manifest('plugin-sdk');
  const runtime = manifest('plugin-runtime');

  expect(PLUGIN_API_PACKAGE).toBe(api.name);
  expect(PLUGIN_API_VERSION).toBe(api.version);
  expect(PLUGIN_SDK_VERSION).toBe(sdk.version);
  expect(PLUGIN_RUNTIME_VERSION).toBe(runtime.version);
});

it('exposes one Plugin API contract version through sdk and runtime re-exports', () => {
  expect(apiVersionThroughSdk).toBe(PLUGIN_API_VERSION);
  expect(apiVersionThroughRuntime).toBe(PLUGIN_API_VERSION);
});

it('keeps the contract dependency direction: api depends only on typebox, sdk and runtime only on api', () => {
  expect(Object.keys(manifest('plugin-api').dependencies ?? {})).toEqual([
    '@sinclair/typebox',
  ]);
  expect(Object.keys(manifest('plugin-sdk').dependencies ?? {})).toEqual([
    '@hyperbug/plugin-api',
  ]);
  expect(Object.keys(manifest('plugin-runtime').dependencies ?? {})).toEqual([
    '@hyperbug/plugin-api',
  ]);
});

it('defines exactly the two source trust tiers', () => {
  expect([...PLUGIN_TRUST_TIERS]).toEqual([
    'trusted-native',
    'isolated-external',
  ]);
});
