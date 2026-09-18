# ADR 0004: Oxc toolchain for bundling, linting and formatting

Status: Accepted; local quality gates and all four test lanes passed. Hosted CI re-verification is pending.
Date: 2026-09-18.

## Decision

Replace three separate tool families with the Oxc project's toolchain, the direction ARCHITECTURE §45 already records (`Oxc / Vite native transforms`, `oxlint`, `oxfmt`):

- Bundling: `esbuild` 0.28.2 → `tsdown` 0.23.0 on `rolldown` 1.2.9.
- Linting: `@biomejs/biome` 2.5.14 → `oxlint` 1.83.0.
- Formatting: `prettier` 3.9.7 → `oxfmt` 0.68.0.
- Type checking: unchanged. `tsc --noEmit` over both TypeScript projects remains the authoritative check.

ADR 0001 required compiler/lint tooling to support TypeScript 7 and chose Biome because typescript-eslint's peer range excluded it. `oxlint` has no TypeScript peer dependency at all, so the constraint is now satisfied more directly. The superseded Biomespecific sentence in ADR 0001 is historical context; this ADR owns the current tooling choice.

## Bundling

`tooling/build.mjs` becomes `tooling/build.ts`, which owns `dist/`, builds the two runtime entry points through tsdown's programmatic API, and also builds the workerd test fixtures. Fixture bundling moved out of the test files so a fixture and the deployed Worker cannot drift: the workerd resolution conditions, externals and target live in `tooling/bundler-options.ts` and are shared by `tsdown.config.ts` and the fixture builds.

Code splitting is deliberately allowed. The Cloudflare target emits an entry plus content-hashed chunks, so a bundled Worker is no longer one file. Consequences:

- `tests/fixtures/worker-modules.ts` discovers every emitted module instead of naming one, because declaring only the entry fails at startup with `No such module "dist/<chunk>.mjs"`. Chunk filenames are content-addressed and are not asserted.
- `tests/workerd/entry.test.ts` now runs the deployed `dist/cloudflare` artifact rather than a separate fixture bundle, so the chunked output itself is what the production acceptance test starts.
- Real deployment is unaffected: `apps/api-cloudflare/wrangler.jsonc` sets `main: "src/index.ts"`, so Wrangler bundles from source, and `dist/cloudflare` is a CI-checked artifact rather than an upload input.
- The Node entry stays a single file (it has no dynamic import), and `tests/node/entry.test.ts` asserts that, so a future dynamic import cannot silently break the `node dist/node/index.mjs` start command.
- Test fixtures are pinned to `codeSplitting: false`. A chunked fixture answered `/health/ready` with 500 in Miniflare while the chunked production Worker answered 200 from the identical three-module layout, identical chunk imports and the same fixture emitted as one file. That bundler/runtime interaction is unexplained and is not something the harness should depend on, so fixtures stay single-file and the deployed Worker keeps splitting.

## Linting and boundaries

`oxlint` enforces syntax-level rules through `.oxlintrc.json`: `eslint/no-restricted-imports` per package with negated-group allow-lists, `import/extensions` for the `.ts` specifier convention, and the correctness/suspicious/perf categories. `pnpm lint` runs it with `--deny-warnings`, so a new warning fails the gate.

`tooling/check-boundaries.mjs` is retained rather than replaced. It resolves each specifier to its owning package by path and validates package manifests, which a text-matching lint rule cannot do; `oxlint` and the script therefore cover different halves of the policy, and both must stay.

Because oxlint does not validate rule options at runtime (a misspelled key reports zero findings and exits 0), `tests/unit/oxlint-config.test.ts` keeps negative fixtures that must fail, alongside the existing negative fixtures for the boundary script.

`import/extensions` only checks that a relative import has some extension: `./bounds.js` is accepted even though it resolves to nothing here. The repository convention (`allowImportingTsExtensions`) is therefore enforced in the common case but not proven by the linter, and `tsc` remains what rejects a genuinely wrong specifier.

## Formatting

`.oxfmtrc.json` reproduces the previous Prettier style (`printWidth: 80`, single quotes, `trailingComma: all`, two-space indentation) and deliberately disables `sortPackageJson` and `sortImports`. `docs/**` and `.agents/**` are excluded, preserving the existing rule that historical architecture and planning documents are not automatically reformatted and keeping the guidance skills under hand maintenance. `AGENTS.md`, the READMEs and `.github/**` are now covered, which closes the previously recorded gap where those files were outside `format:check`.

`oxfmt` differs from Prettier in two observable ways: it breaks leading-operator union types onto separate lines, and it inserts a blank line after an HTML comment in Markdown. Both appear in this change's formatting diff.

## Consequences

- `esbuild` remains in the dependency graph transitively through `drizzle-kit`, `wrangler`, `tsx` and `vite`, so its `allowBuilds` entry stays; it is no longer a direct dependency and no longer bundles the runtime entry points.
- `tsdown` 0.23.0 and `oxfmt` 0.68.0 are pre-1.0 and are admitted through explicit `minimumReleaseAgeExclude` entries. This is a deliberate, reviewed acceptance, not an accident of resolution.
- The audit result is unchanged: one reviewed moderate `drizzle-kit` esbuild-loader advisory remains, and replacing the direct bundler does not affect it.
- `oxlint --type-aware`/`--type-check` exists but needs a separate `oxlint-tsgolint` binary pinned to a `tsgo`-preview line. It is not adopted; type checking stays with `tsc`.
- The Cloudflare artifact contains no `pg` and no statically linked `node:*` import. The single `node:` string is inside a lazy runtime-import helper emitted from `file-type`'s optional filesystem path, which the Worker never executes.

## Verification required

`pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check`, `db:check`, `build`, `test:unit`, `test:contract`, `test:node`, `test:workerd`, `test:postgres`, `scan:secrets`, `scan:licenses` and `audit --audit-level high`. Hosted CI must re-run the same matrix, because the previous hosted acceptance evidence was produced with the replaced toolchain.
