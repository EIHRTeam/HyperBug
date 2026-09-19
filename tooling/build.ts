import { rm } from 'node:fs/promises';
import { build } from 'tsdown';
import { appTargets, fixtureTargets } from './build-targets.ts';
import { workerdFixtureOptions } from './bundler-options.ts';

// Single build entry point for the workspace. `pnpm build` runs it, and the
// Node/workerd test lanes re-run it for the artifacts they need, so no test
// bundles its own fixture with a hand-copied configuration.
//
// Usage: node tooling/build.ts [--target=all|node|cloudflare|fixtures]
const targets = new Set(['all', 'node', 'cloudflare', 'fixtures']);
const requested = process.argv
  .filter((argument) => argument.startsWith('--target='))
  .map((argument) => argument.slice('--target='.length));
for (const name of requested)
  if (!targets.has(name)) throw new Error(`Unknown build target: ${name}`);
const selected = requested.length ? requested : ['all'];
const wants = (name: string) =>
  selected.includes('all') || selected.includes(name);

const dist = 'dist';
// `clean` is off in every target, so ownership of `dist/` stays here: one
// removal, then whichever artifacts this invocation was asked for.
if (selected.includes('all')) await rm(dist, { recursive: true, force: true });

// tsdown's programmatic `build()` takes one inline config, so each target is
// built by its own call. `config: false` keeps it from also loading
// `tsdown.config.ts`, which re-exports these same targets.
for (const target of appTargets)
  if (wants(target.name)) await build({ ...target.options, config: false });

for (const fixture of fixtureTargets)
  if (wants('fixtures'))
    await build({
      ...workerdFixtureOptions,
      config: false,
      entry: [fixture.entry],
      outDir: fixture.outDir,
    });

console.log(`Built targets: ${selected.join(', ')}`);
