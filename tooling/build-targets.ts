// The single source of truth for bundle targets. `tsdown.config.ts` re-exports
// these for the CLI, and `tooling/build.ts` passes them to tsdown's programmatic
// `build()`, so `pnpm build` and the tests' fixture builds cannot drift apart.
import type { UserConfig } from 'tsdown';
import {
  mjsExtension,
  workerdExternal,
  workerdNeverBundle,
  workerdResolve,
} from './bundler-options.ts';

/**
 * Production artifact contract for both runtime profiles: `dist/node/index.mjs`
 * is what the Node start command runs and `dist/cloudflare/` is the Worker graph
 * CI loads in workerd, so both are minified and carry external source maps.
 * Declared once here rather than in `tsdown.config.ts`, because `tooling/build.ts`
 * builds these targets through tsdown's programmatic API and the CLI re-export
 * must not drift from it. Fixture bundles stay unminified so test failures and
 * workerd stack traces stay readable.
 */
const productionArtifacts = {
  minify: true,
  sourcemap: true,
} satisfies UserConfig;

export const appTargets = [
  {
    name: 'node',
    options: {
      ...productionArtifacts,
      entry: ['apps/api-node/src/index.ts'],
      platform: 'node',
      format: ['esm'],
      target: 'node24',
      outDir: 'dist/node',
      dts: false,
      clean: false,
      deps: {
        neverBundle: ['@elysia/node', 'elysia'],
      },
      outExtensions: mjsExtension,
    },
  },
  {
    name: 'cloudflare',
    options: {
      ...productionArtifacts,
      entry: ['apps/api-cloudflare/src/index.ts'],
      platform: 'neutral',
      format: ['esm'],
      target: 'es2023',
      outDir: 'dist/cloudflare',
      dts: false,
      clean: false,
      deps: { neverBundle: workerdNeverBundle },
      inputOptions: { resolve: workerdResolve, external: workerdExternal },
      outExtensions: mjsExtension,
    },
  },
  {
    name: 'cloudflare-ingress',
    options: {
      ...productionArtifacts,
      entry: ['apps/api-cloudflare/src/ingress.ts'],
      platform: 'neutral',
      format: ['esm'],
      target: 'es2023',
      outDir: 'dist/cloudflare-ingress',
      dts: false,
      clean: false,
      deps: { neverBundle: workerdNeverBundle },
      inputOptions: { resolve: workerdResolve, external: workerdExternal },
      outExtensions: mjsExtension,
    },
  },
] satisfies { name: string; options: UserConfig }[];

/** External Wasm modules required by the emitted production Worker graph. */
export const cloudflareWasmAssets = [
  {
    source: 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm',
    output: 'dist/cloudflare/vendor/libsodium-sumo-0.8.4.wasm',
  },
] as const;

/**
 * workerd test fixtures. They share the Worker profile's resolution and
 * externals through `bundler-options.ts`, and each emits into its own
 * directory so chunk discovery stays unambiguous.
 */
export const fixtureTargets = [
  {
    name: 'worker-entry-test',
    entry: 'tests/fixtures/worker.ts',
    outDir: 'dist/worker-entry-test',
  },
  {
    name: 'database-worker',
    entry: 'tests/fixtures/database-worker.ts',
    outDir: 'dist/database-worker',
  },
  {
    name: 'standard-password-worker',
    entry: 'tests/fixtures/standard-password-worker.ts',
    outDir: 'dist/standard-password-worker',
  },
  {
    name: 'account-worker',
    entry: 'tests/fixtures/account-worker.ts',
    outDir: 'dist/account-worker',
  },
] as const;

/** Fixture output directories, for the Miniflare module discovery helper. */
export const fixtureOutDirs = fixtureTargets.map((target) => target.outDir);
