// Build configuration shared by `tsdown.config.ts` (runtime entry points) and
// `tooling/build.ts` (workerd test fixtures). Keeping the workerd resolver
// options and externals in one place prevents the fixture builds from drifting
// away from the deployed Worker profile.
import type { UserConfig } from 'tsdown';

/** Target-agnostic workerd resolution: the same conditions the Worker sees. */
export const workerdResolve = {
  mainFields: ['browser', 'module', 'main'],
  conditionNames: ['workerd', 'worker', 'browser'],
};

/** Modules workerd supplies itself. Bundling either namespace is an error. */
export const workerdNeverBundle = [/^node:/, /^cloudflare:/];

/**
 * Emit `.mjs` for every file in a target, chunks included. The repository
 * treats `dist/**` as explicit ESM artifacts and both runtime tests name
 * `.mjs` files, so a target must not switch extension based on package type.
 */
export const mjsExtension = (): { js: string } => ({ js: '.mjs' });

/**
 * Bundling options for a workerd test fixture. Fixtures are bundled exactly
 * like `apps/api-cloudflare` — same resolution, same externals, same target —
 * so a fixture cannot pass where the production Worker would fail.
 *
 * Unlike the production Worker, fixtures are deliberately emitted as a single
 * file. Chunked fixtures answered `/health/ready` with 500 in Miniflare while
 * the chunked production Worker answered 200 with the identical three-module
 * layout and the identical chunk imports, and the same fixture answers 200 when
 * emitted as one file. Rather than depend on an unexplained bundler/runtime
 * interaction in the test harness, fixtures stay single-file; the deployed
 * Worker keeps rolldown's default splitting, and
 * `tests/workerd/entry.test.ts` runs that chunked artifact.
 */
export const workerdFixtureOptions = {
  platform: 'neutral',
  format: ['esm'],
  target: 'es2023',
  dts: false,
  clean: false,
  deps: { neverBundle: workerdNeverBundle },
  inputOptions: { resolve: workerdResolve },
  outExtensions: mjsExtension,
  outputOptions: { codeSplitting: false },
} satisfies UserConfig;
