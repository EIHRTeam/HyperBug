// The single source of truth for bundle targets. `tsdown.config.ts` re-exports
// these for the CLI, and `tooling/build.ts` passes them to tsdown's programmatic
// `build()`, so `pnpm build` and the tests' fixture builds cannot drift apart.
import type { UserConfig } from 'tsdown';
import {
  mjsExtension,
  workerdNeverBundle,
  workerdResolve,
} from './bundler-options.ts';

export const appTargets = [
  {
    name: 'node',
    options: {
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
      entry: ['apps/api-cloudflare/src/index.ts'],
      platform: 'neutral',
      format: ['esm'],
      target: 'es2023',
      outDir: 'dist/cloudflare',
      dts: false,
      clean: false,
      deps: { neverBundle: workerdNeverBundle },
      inputOptions: { resolve: workerdResolve },
      outExtensions: mjsExtension,
    },
  },
] satisfies { name: string; options: UserConfig }[];

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
] as const;

/** Fixture output directories, for the Miniflare module discovery helper. */
export const fixtureOutDirs = fixtureTargets.map((target) => target.outDir);
