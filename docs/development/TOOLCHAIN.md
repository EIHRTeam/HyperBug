# Backend toolchain and dependency research

Research date: 2026-09-17–18. Source versions are verified resolutions, not floating install instructions.

| Component         | Selected version     | Evidence / decision                                                                                                                                   |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node              | 24.21.0 LTS          | Official `https://nodejs.org/dist/index.json`; installed `fnm exec --using=24.21.0 node --version`                                                    |
| pnpm              | 11.26.0              | npm `latest-11`; preserve required major even though latest is 12                                                                                     |
| TypeScript        | 7.0.2                | npm latest stable and Context7 `/microsoft/typescript/v7.0.2`                                                                                         |
| Elysia            | 1.4.30               | npm latest stable                                                                                                                                     |
| Node adapter      | `@elysia/node` 1.4.6 | Current official Node integration documentation and published named `node` export; older `@elysiajs/node` 1.4.5 remains published but is not selected |
| Vitest            | 5.0.1                | npm latest stable; supports Node 24                                                                                                                   |
| Drizzle ORM / Kit | 0.45.2 / 0.31.10     | Current stable; RC is permitted by policy but not required                                                                                            |
| PostgreSQL        | 18.6                 | Installed Homebrew binary; exact 18.x major required                                                                                                  |
| Miniflare         | 5.20260916.0-alpha   | Matches Wrangler; removes high-severity advisories from the initially tried stable 4 harness                                                          |
| Wrangler          | 4.133.0              | Current stable; local dev and binding type generation                                                                                                 |
| tsdown / rolldown | 0.23.0 / 1.2.9       | Runtime entry point and workerd fixture bundling; see [ADR 0004](../decisions/0004-oxc-toolchain-migration.md)                                        |
| oxlint            | 1.83.0               | Linting without a TypeScript compiler peer; replaces Biome, which it also replaces as the ARCHITECTURE §45 direction                                   |
| oxfmt             | 0.68.0               | Formatting, including Markdown and YAML; replaces Prettier                                                                                            |

`tsdown` 0.23.0 and `oxfmt` 0.68.0 are pre-1.0 and admitted through `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. The retired tools were `esbuild` 0.28.2 (still present transitively), `prettier` 3.9.7 and `@biomejs/biome` 2.5.14.

## Documentation lookups

Context7 resolve preceded query for Elysia, pnpm, TypeScript, Vitest, Cloudflare, Drizzle and Biome. Relevant references:

- [Elysia Node adapter](https://elysiajs.com/integrations/node): choose current scoped package; historical blog examples differ.
- [Elysia Workers](https://elysiajs.com/integrations/cloudflare-worker): `CloudflareAdapter`, AOT and `.compile()`; actual runtime verification is required.
- [pnpm settings](https://pnpm.io/settings): workspace globs, `allowBuilds`, frozen lockfile.
- [TypeScript NodeNext](https://www.typescriptlang.org/tsconfig/module): explicit exports and `.ts` source imports; strict checks plus exact optional properties and indexed access checks.
- [Vitest projects](https://vitest.dev/guide/projects): separate unit, contract, Node and workerd lanes.
- [Miniflare README](https://github.com/cloudflare/workers-sdk/tree/main/packages/miniflare): runtime dispatch, D1 bindings and disposal. Context7 also returns newer alpha shapes; installed pinned alpha declarations and actual tests are authoritative.
- [Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/): explicit compatibility flags, generated bindings, secret-free config and structured logging.
- [Drizzle schemas](https://orm.drizzle.team/docs/sql-schema-declaration) and [D1 batches](https://orm.drizzle.team/docs/batch-api): independent dialects and transaction intents.
- [Biome configuration](https://biomejs.dev/guides/configure-biome/): recommended linting and generated-file exclusions.

TLS validation remains enabled. Python's local certificate store failed one registry lookup; the validating Node/npm clients supplied registry evidence instead.

## Install policy

One root lockfile covers explicit `apps/*`, `packages/*`, and `packages/database/*` globs. Native build scripts are denied unless listed in `allowBuilds`; `esbuild` and `workerd` need their reviewed binary setup. `esbuild` is no longer a direct dependency but stays listed because `drizzle-kit`, `wrangler`, `tsx` and `vite` still build on it. `tsdown`, `rolldown`, `oxlint` and `oxfmt` ship platform binaries as optional dependencies and declare no install scripts, so they need no `allowBuilds` entry. Sharp install scripts are disabled (image processing is not used). CI must use `pnpm install --frozen-lockfile` and Node 24. Direct dependencies are exact-pinned. Dependency changes require the same runtime and migration suites.

No SPA, browser library, production resource, or cloud deployment is created by this foundation.

## Dependency review outcomes

The frozen graph uses native binaries from TypeScript, the Oxc project (`oxlint`, `oxfmt`, `rolldown`), esbuild, workerd and test tooling. No browser product bundle exists. Miniflare 5 is justified development tooling, not a prerelease application framework. The full audit now has one moderate advisory in Drizzle Kit's legacy esbuild loader (GHSA-67mh-4wv8-2f99); its vulnerable development-server API is not used. Keep migration generation local and do not expose a Drizzle/esbuild development server. Replacing the direct bundler does not clear this advisory, which is reachable through `drizzle-kit` rather than through the removed direct dependency. The high-severity audit gate remains active, with no suppressions. Reassess this moderate item during the next matching ORM/Kit upgrade.

License review allows exact development-only libvips packages (LGPL-3.0-or-later, 1.3.1/1.3.3) under Miniflare, and Lightning CSS packages (MPL-2.0, 1.33.0) under Vitest/Vite. No modified library code is distributed by this task; redistribution must retain their notices and obligations. The scanner restricts these exceptions by package/version, while unknown licenses fail. `pnpm why --recursive sharp lightningcss` verified these dependency paths.

A system-installed standalone pnpm embeds an older Node/pnpm pair on this workstation. Use `fnm exec --using=24.21.0 corepack pnpm` to honor the project pin. `verifyDepsBeforeRun: error` prevents scripts from silently installing or rewriting dependency state.

Additional 2026-09-18 lookups: Context7 `/llmstxt/developers_cloudflare_d1_llms-full_txt` supplied implicit-transaction, foreign-key-deferral and Wrangler migration configuration guidance. `/cloudflare/workers-sdk` did not cover the new local S3 credential option; installed Miniflare declarations/source and signed local HTTP experiments verified it. PostgreSQL migration/query behavior is exercised on local 18.6 and the hosted `postgres:18.6` service. [Hosted run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101) passed all four required jobs on commit `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d`.

Context7 `/websites/github_en_actions` (2026-09-18) verified the PostgreSQL service-container shape, explicit port mapping, health check and PG environment pattern against the [official service tutorial](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers). CI uses a disposable database containing fixtures only; the local private-socket workflow is independent.

## 2026-09-18 — Build and lint/format migration assessment (investigation only)

Requested: whether the build can move to tsdown/rolldown, and why Biome is not used for formatting as well as linting. Both were answered by local probes, not by installation; **no dependency, script, configuration or artifact was changed**, so the current esbuild/Prettier/Biome split still stands and every statement below was measured against the committed tree.

### Context7 and registry evidence

- Context7 `/rolldown/tsdown` confirmed the array-config form, the `platform` matrix (`node` defaults `mainFields` to `['main','module']`; `neutral` defaults to an empty array and needs explicit `mainFields`), and the documented `neutral` remedy of setting `mainFields` plus resolve conditions.
- Context7 `/biomejs/website` confirmed `biome migrate prettier`, the documented Prettier divergences, and the `useImportExtensions` / `noRestrictedImports` rule options.
- Registry snapshot on the probe date: `tsdown` 0.23.0 (latest, no 1.x), `rolldown` 1.2.9, `esbuild` 0.28.2, `@biomejs/biome` 2.5.14 (already pinned here), `prettier` 3.9.8 (3.9.7 pinned here). `tsdown` declares `engines.node` `^22.18.0 || ^24.11.0 || >=26.0.0` and an optional `typescript` peer of `^5 || ^6 || ^7`, so the pinned Node 24.21.0 and TypeScript 7.0.2 satisfy it. Both `tsdown` and `rolldown` are MIT, so the license scanner has no new exception to review.

### Build assessment: migration is feasible

`rolldown` 1.2.9 bundled both real entries from a probe directory with the dependency graph linked but no repository install. The Cloudflare pass resolved correctly (elysia's `workerd`/`worker`/`browser` conditions, `cloudflare:workers` left external, no `pg`/Node built-in leakage into the artifact) and the Node pass served `/health/live` and `/health/ready` with the expected JSON telemetry. Both probe artifacts were also loaded by the probe harness as Miniflare ES modules alongside the committed esbuild bundles; both answered `/health/ready` 200 and kept `/_proof/*` at 404.

Measured differences that a migration has to absorb:

1. Rolldown splits shared modules into multiple chunks when dynamic imports exist, so the single-file outputs that `tests/node/entry.test.ts` spawns require `output.codeSplitting: false` (or `output.dir` plus a test change). This was an observed build failure, not a documentation reading.
2. Rolldown emits tabs and no CommonJS interop preamble; esbuild emits spaces plus its `__commonJS`/`__toESM`/`__esModule` helpers. The first-party sources are ESM and none of them branches on `exports`, so this only changes artifact shape and size (probe Node artifact 138,712 bytes against the committed 128,764), but a byte-comparison or size-budget check would need adjusting.
3. Externals must be restated per target exactly as today; Cloudflare still needs `/^node:/` plus `/^cloudflare:/`, and both entries stay ESM-only, so `format` stays `['esm']` and no CommonJS output or `exports` map is needed.
4. Bundling, not `tsc`, produces the artifacts, so declaration generation stays irrelevant and `dts` stays off.
5. The CommonJS interop differs but did not change behavior in the probe. Rolldown wraps CommonJS modules in lazy `__commonJSMin` factories where esbuild eagerly emits `__commonJS`/`__toESM` helpers, and the probe Cloudflare artifact is 729,529 bytes against the committed 829,484. Neither artifact contains a `node:*` specifier, and `pg` is absent from both, so the Cloudflare bundle does not leak Node-only dependencies in either tool. Because workerd links `node:*` from what it can see in the module graph, keep the "no Node built-in in the Cloudflare artifact" check in the migration's verification rather than assuming it.

Cost and benefit: `tsdown` would replace roughly 21 lines of `tooling/build.mjs`, add `tsdown` (0.23.0) plus `rolldown`, and no longer need `esbuild` at build time. `tsdown` also has to be introduced into the pnpm `allowBuilds` review, and the two inline `esbuild` calls inside `tests/workerd/*.test.ts` would need a decision, because plain `rolldown` has no equivalent one-liner API. The only substantive gain is bundler speed. `tsdown` is still 0.x, and `pnpm-workspace.yaml` allows a prerelease only through an explicit `minimumReleaseAgeExclude`, so adopting it is a policy decision rather than a mechanical swap. `rolldown` alone (1.2.9, `~1.2.7` is what `tsdown` itself requires) avoids the 0.x dependency while keeping the same config surface.

The deployment path is unaffected either way: `apps/api-cloudflare/wrangler.jsonc` sets `main: "src/index.ts"`, so Wrangler bundles from source and `dist/cloudflare/index.mjs` is a CI-checked artifact rather than an upload input.

### Lint/format assessment: Biome cannot be the only tool yet

Measured on the probe copy of the current tree (65 source files, migrations excluded):

- The formatter is already compatible. With `indentStyle: space`, `indentWidth: 2`, `lineWidth: 80`, `quoteStyle: single` and `trailingCommas: all`, Biome rewrote only 1 of 64 files: the leading-operator union in `packages/domain/src/index.ts`. Prettier keeps `'completed' | 'not_planned' | …` on one continuation line; Biome puts every member on its own line. The other divergence is the documented JSONC trailing-comma difference in `apps/api-cloudflare/wrangler.jsonc` (`trailingCommas: all` does not reach JSON/JSONC in Biome).
- The gap is file-type and scope, not style. Biome cannot format Markdown or YAML at all, and the current `format:check` glob already excludes them, so 67 Markdown/YAML/`.github` files currently carry Prettier style drift that neither tool fixes. Biome's `files.includes` in `biome.json` also omits `package.json`, `tsconfig.json`, `vitest.config.ts` and `pnpm-workspace.yaml`, which the Prettier script does check. Consolidating on Biome therefore requires either dropping that coverage or moving it into `biome.json` unchanged.
- The `!!**/migrations` ignore silently covers more than intended. It excludes the migration SQL, which is correct, but it also excludes `packages/database/d1/drizzle.config.ts` and `packages/database/postgres/drizzle.config.ts`, which are ordinary checked sources. `!!**/migrations/**` (plus a per-file exception) is the accurate form.
- `files.includes` is a filter, not just a default. When an explicitly named CLI path is not matched by `includes`, Biome 2.5.14 skips it and reports "No files were processed in the specified paths"; `biome format --write apps …` produced zero work until a config carrying the paths was supplied. Any future split into a formatting config and a linting config has to keep the paths listed in both.
- Biome is already at the current release here (`@biomejs/biome` 2.5.14), and `pnpm lint` covers 62 files, so the linter side is not the constraint. It does not need `typescript-eslint` and therefore does not inherit the TypeScript 7 peer-range problem recorded for that option.

Linter capability mapping for `tooling/check-boundaries.mjs`:

- `lint/correctness/useImportExtensions` (available since 1.8.0, default `warn`) is the mechanical replacement for extension checking. It flagged `import './bounds'` in a probe fixture and is safe-fixable, so the repo's `.ts`-extension convention can be enforced without the custom script.
- `lint/style/noRestrictedImports` accepts `paths` and `patterns` with glob groups, so the package-level part of `allowed`/`externalAllowed` can be expressed with per-package `overrides`.
- It cannot replace the boundary checker completely. The rule only inspects specifiers and never resolves them, so a relative cross-package import such as `../../packages/database/d1/src/index.ts` is invisible to it unless a specifier pattern such as `**/packages/**` is written to match it, while `checkImport` catches it by path ownership. `check-boundaries.mjs` also scans only `apps/` and `packages/`, so porting its rules into Biome lint would additionally extend enforcement to `tests/`, where adapters are legitimately imported.

Options if the tooling is consolidated later: (a) Biome for lint plus format and Prettier retained only for Markdown/YAML; (b) Biome only for lint and format, accepting that Markdown, YAML and `.github/**` remain unformatted; (c) keep the current split. Option (a) is the only one that both removes the duplicate source formatter and closes the existing Markdown/YAML drift, but it keeps two tools and the `biome.json`/`.prettierignore` scope must be kept consistent.

### Not verified

- No `tsdown` or `rolldown` install, no lockfile change, and no `pnpm build` through either tool; the probe ran the bundlers read-only and the artifacts live outside the repository.
- Nothing was exercised on a hosted runner; `tests/node`, `tests/workerd` and `db:check` were rerun unchanged and passed as the comparison baseline.
- The lazy CommonJS wrapper difference in point 5 was measured only by artifact comparison; only the two entry artifacts were loaded into workerd, so no CommonJS-heavy path was exercised beyond those. The `drizzle-kit` loader advisory was not re-measured. Replacing `esbuild` as a direct dependency would not by itself clear GHSA-67mh-4wv8-2f99, which is reachable through `drizzle-kit`.

## 2026-09-18 — Follow-up: tsdown in full, the Oxc family, safety policy, Zod

Same session, four follow-up questions. Everything below is again probe evidence from outside the repository; no dependency, script or artifact was changed.

### Can the build move to `tsdown` completely, with multiple chunks allowed?

Yes, `tsdown` 0.23.0 (rolldown 1.2.9) built both entries with its default chunking, and the Node entry served `/health/live` and `/health/ready`:

- `tsdown.config.ts` with an array config and `outDir` per target produced `tsdown-dist/node/index.mjs` (138,712 bytes, single file) and three Cloudflare files: `index.mjs` (598,221), `source-DmXkbf1l.mjs` (125,294) and `rolldown-runtime-DC62tzP2.mjs` (1,445); total 724.96 kB against the committed 829,484-byte single file.
- The Node artifact has no dynamic imports, so chunking never triggers there and `dist/node/index.mjs` keeps its single-file contract even without `codeSplitting: false`.
- The multi-chunk Cloudflare entry does run in workerd, but every chunk must be declared as a module. Declaring only the entry fails with `No such module "dist/rolldown-runtime-DC62tzP2.mjs". imported from "dist/index.mjs"`; declaring all three makes `/health/ready` return 200 with `/_proof/*` at 404. `tests/workerd/entry.test.ts` therefore needs either a glob over the output directory or `codeSplitting: false`; `tests/workerd/repository.test.ts` builds its own fixture and is unaffected.
- Deployment is unaffected: `wrangler.jsonc` sets `main: "src/index.ts"`, so Wrangler bundles from source and no chunk list has to be maintained for a real deployment.
- Two `tsdown`-specific details surfaced: the `external` top-level option is deprecated in favour of `deps.neverBundle`, and `tsdown` adds rolldown plus its own runtime chunk by default. Its `engines.node` (`^22.18 || ^24.11 || >=26`) and TypeScript peer (`^5 || ^6 || ^7`) accept this project's pins, but it remains 0.23.0, so adopting it still needs an explicit `minimumReleaseAgeExclude` decision.

Conclusion: a complete `tsdown` migration is technically unblocked, and allowing multiple chunks costs only a test-harness change. The remaining reasons to hesitate are policy (0.x dependency) and the two inline esbuild calls in `tests/workerd/*.test.ts`, not capability.

### Can the Oxc family replace the current tooling?

Partly, and the initial architecture already prefers it: ARCHITECTURE §45 lists `Oxc / Vite native transforms`, `oxlint` and `oxfmt` as the current direction, subject to correctness, maintainability, performance, standards compliance and ecosystem maturity. Current registry state: `oxlint` 1.83.0, `oxfmt` 0.68.0, `oxc-parser`/`oxc-transform` 0.150.0, `rolldown` 1.2.9 (already Oxc-based).

Measured results:

- `oxlint` 1.83.0 linted the repository copy with 96 rules and reported **0 warnings, 0 errors in 20 ms over 49 files**. It needs no TypeScript compiler peer and has no type-aware requirement by default.
- `oxfmt` 0.68.0 rewrote only **1 of 64 TypeScript/JavaScript files** with `printWidth: 80`, `indentStyle: space`, `indentWidth: 2`, `singleQuote: true`, `trailingComma: all` — the same leading-operator union in `packages/domain/src/index.ts` that Biome also rewrites, so Biome and oxfmt agree with each other and differ from Prettier only there. It also formats Markdown (54 of the copied `docs/` and README files would change) and YAML, which Biome cannot do at all.
- Option names differ from Prettier and from Biome: the working keys are `printWidth`, `singleQuote`, `trailingComma`, `indentStyle`/`indentWidth`, `sortPackageJson` and `sortImports`. `sortPackageJson` is on by default and reorders `package.json` keys, which is a real risk for a workspace with pinned dependency order and must be set to `false` deliberately. `.oxfmtrc.json` also supports `--migrate=prettier`.
- Oxc cannot replace the type checker. `oxc-parser` and `oxc-transform` parse and transform only, and although `oxlint 1.83.0` exposes `--type-aware` and an experimental `--type-check`, both fail without the separate `oxlint-tsgolint` binary package (7.0.2002, six platform packages). With it linked, `oxlint --type-aware --type-check` ran 111 rules in 86 ms and emitted real `typescript(TS2307)` diagnostics from a copy without workspace links, which confirms the integration works, but it is a preview path tied to a `tsgo`-versioned binary rather than the pinned TypeScript 7.0.2, so `tsc --noEmit` (the current `typecheck` script) stays the authoritative check.
- `oxfmt` is still 0.68.0 and quotes YAML scalars differently from Prettier (`HYPERBUG_TEST_POSTGRES: "1"` against `'1'`), so a formatter switch is not diff-free for `.github/**` either.

What a consolidated Oxc toolchain would look like: `rolldown` for bundling, `oxlint` for linting, `oxfmt` for formatting (the only candidate that can format Markdown, YAML and JSON), `oxc-transform`/rolldown for downleveling, and `tsc`/`tsgo` retained for real type checking. That is three tool families replaced by one project plus the compiler, and it is the direction the initial architecture already records — but `oxfmt` is pre-1.0, so the same `minimumReleaseAgeExclude` policy question applies.

Lint rule mapping for the boundary script, verified by turning each rule on against fixture files in a copy of the tree:

- `eslint/no-restricted-imports` (on by default, no plugin prefix, no autofix) covers the package-level half. With a per-directory `override` it flagged a probe `import { createApp } from '@hyperbug/server'` inside `packages/domain` with the custom message, and a specifier-pattern group flagged a probe `import { x } from '@hyperbug/database/d1'` from `packages/server`.
- Negated groups give allow-list semantics, which is what the boundary table actually needs: `["@hyperbug/**", "!@hyperbug/domain", "!@hyperbug/application"]` blocked `@hyperbug/server` while accepting `@hyperbug/domain`, matching the "`database-d1` may import only domain and application" row.
- The rule also flags `import type`, `export type … from` and dynamic `import()`; `allowTypeImports: true` exempts type-only imports. `regex` is supported alongside `group`, and specifier patterns such as `**/packages/**` catch relative cross-package paths textually.
- The strictest row (a leaf package such as `domain`, `contracts`, `security`, `config` or `observability`, which may import nothing but its own files) can be reproduced exactly with one catch-all pattern plus negations: `{"group": ["*", "!./*", "../**"], "message": …}` flagged a probe `zod`, `@hyperbug/server`, `../sibling.ts` and `../../application/src/index.ts` while leaving `./local.ts` allowed. Packages with a non-empty allow-list use the same shape with extra negations, for example `["*", "!./*", "../**", "!@hyperbug/domain", "!@hyperbug/application"]` for `database-d1`.
- Exact parity with `tooling/check-boundaries.mjs` is not free, because that script resolves each specifier to its owning package while the lint rule only matches the written text: both the package specifier form and the directory form of every blocked target have to be enumerated, and any unlisted package directory is missed. Note also that the `database-*` packages are imported as `@hyperbug/database-d1`/`@hyperbug/database-postgres`, not as `@hyperbug/database/d1`. The script's `pure`/`externalAllowed` rows have no direct equivalent and become additional patterns.
- `import/extensions` with `"plugins": ["import"]` and `["error", "ignorePackages", { "ts": "always" }]` flagged `import './bounds'` while leaving bare package imports such as `drizzle-orm` alone. It is weaker than Biome's `useImportExtensions`: it only checks that an extension is present, so `./bounds.js` and `./bounds.mjs` are accepted even though they resolve to nothing here, and it is a silent no-op unless the `import` plugin is enabled.
- `import/no-relative-parent-imports` exists and bans every `../` import — stricter than the current policy, and it would also ban legitimate same-package parent imports. `import/no-relative-packages` does **not** exist in 1.83.0.
- `import/no-cycle` is also available and adds a capability neither the current script nor Biome provides.

Three configuration traps that a migration must handle deliberately:

1. `*` does not cross `/`, so `@hyperbug/*` misses `@hyperbug/database/d1`; nested paths need `@hyperbug/**`.
2. An `override` **replaces** the base options for the same rule key instead of merging them. A base ban on `drizzle-orm` plus a domain override banning `@hyperbug/**` reported only the override message, so shared bans must be repeated in every override (or shared through `extends` / nested configs).
3. Rule options are not validated at runtime: a misspelled key (`{"patternz": …}`) produced 0 diagnostics and exit 0, so a broken boundary config fails open. The migration must keep a negative fixture that is expected to fail, and `--print-config` is the way to confirm what oxlint resolved.

### Does the plan, guidance or a skill require type safety or memory safety?

No document states a "type safety" or "memory safety" rule in those words; the requirement is enforced through configuration and decisions rather than through prose in the plans and skills.

- Type strictness is real and enforced: `tsconfig.json` sets `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` and `noEmit`; `pnpm typecheck` runs it over both projects and CI gates on it. ARCHITECTURE §46 fixes TypeScript 7 and strict checking by default and forbids `any` as a routine escape hatch, singling out public contracts and the Plugin API as boundaries that must stay strict. ADR 0001 adds that compiler/lint tooling must support TypeScript 7, which is why Biome was chosen over typescript-eslint.
- Nothing in the plan, guidance or skills mentions memory safety. ARCHITECTURE §45 selects tools on correctness/maintainability/performance/standards/maturity and explicitly says the principle is **not** "all tools must be Rust"; ARCHITECTURE §47 evaluates new dependencies on maintenance, bundle impact, runtime compatibility, security history, standards overlap, tree shaking, ESM support and type quality. "Memory safety" therefore arrives only indirectly, through the Rust tooling already in the graph (TypeScript 7's Go compiler, Biome, oxc/rolldown, workerd, esbuild).
- The skills route rather than restate: `.agents/skills/hyperbug-development/references/backend.md` requires domain and public schemas to have no infrastructure dependencies, and `references/security.md` routes normative requirements to SECURITY/PERFORMANCE. Neither adds a safety rule of its own.

If explicit safety guidance is wanted, it belongs in the module 01 checklist and the development skill; recording it only in this research note would not make it binding.

### Can Zod be introduced?

Zod 4.6.5 is technically usable here but is not recommended as a replacement, and is unnecessary as an addition.

- Compatibility is real: `elysia` 1.4.30 types `AnySchema = TSchema | StandardSchemaV1Like`, and Zod 4 implements Standard Schema, so Zod schemas can be passed wherever the current TypeBox schemas are. Elysia also declares `@sinclair/typebox` as a peer (`>= 0.34.0 < 1`), so TypeBox is part of the framework's own runtime contract, not an extra library.
- The recorded decision points the other way: ADR 0001 states that "a single framework-independent TypeBox schema package describes public payloads", TECH-STACK §40 asks for a schema layer that is JSON-Schema-oriented so that clients never install Elysia to understand the protocol, and `packages/contracts` is that package. TypeBox values **are** JSON Schema objects, so OpenAPI generation (module 10, items 10.1a and 10.1e) needs no conversion step.
- Measured cost: bundling one small Zod object schema for a neutral target produced 157,022 bytes (28,225 bytes through `zod/mini`, which drops the chainable API); adding `z.toJSONSchema` for OpenAPI raises the same bundle to 170,960 bytes. The equivalent TypeBox definition is a plain object with no runtime library, and TypeBox is already required by the installed Elysia.
- The policy frame is ARCHITECTURE §47 (bundle impact, standards overlap, tree shaking) and PERFORMANCE §30 (duplicate dependencies, runtime overhead). Keeping both schema libraries would create exactly the duplicate-dependency and double-validation risk those sections warn about, and nothing in the current contracts needs a capability TypeBox lacks.
- Prudent path: if a second validation library is ever needed, the argument must come from a concrete requirement — for example client-side validation in `packages/api-client` (10.1b) or a plugin SDK type boundary — not from general preference. Replacing the contract schema language is an ARCHITECTURE §49-scale decision that needs an ADR and the module 10 schema/OpenAPI work as its testbed; module 10 is not implemented, so no contract compatibility evidence exists yet.

### Not verified in this follow-up

- No `tsdown`, `oxlint`, `oxfmt` or `zod` dependency was added to the repository, and `pnpm-lock.yaml` is unchanged; all four were probed from `/tmp` with `pnpm dlx` or a separate probe install.
- The `oxlint --type-aware --type-check` run was against a copy without workspace links, so its `TS2307`/`TS7006` output proves the integration starts, not parity with the project's `tsc --noEmit` gate. Type-aware rule correctness was not audited.
- The Zod size figures are single-entry bundle sizes for a neutral target, not a measurement of the real contract package or the SPA bundle, and no runtime validation benchmark was run.

## 2026-09-18 — Migration executed: tsdown, oxlint, oxfmt

The assessments above are now adopted; this section records what the implementation measured. [ADR 0004](../decisions/0004-oxc-toolchain-migration.md) holds the decision and its consequences.

### Build

`tooling/build.mjs` (21 lines, esbuild, two entry points) is replaced by `tooling/build.ts`, which owns `dist/`, builds both runtime entry points through tsdown's programmatic API, and also builds the two workerd fixtures that `tests/workerd/*.test.ts` previously bundled with inline esbuild calls. `tooling/bundler-options.ts` holds the shared workerd resolution conditions and externals, and `tooling/build-targets.ts` holds the target list that `tsdown.config.ts` and `tooling/build.ts` both consume, so the CLI build and the build script cannot drift. The script accepts `--target=all|node|cloudflare|fixtures`, which is how each test lane builds only what it needs.

Measured results on the current tree:

- `dist/node/index.mjs` 134,346 bytes (previously 128,764 from esbuild).
- `dist/cloudflare/` is an entry plus two chunks: `index.mjs` 592,042, `source-O10GCrkn.mjs` 124,295, `rolldown-runtime-DC62tzP2.mjs` 1,445; total 717,782 against the previous 829,484-byte single file.
- The emitted extension is forced to `.mjs` through `outExtensions`, because rolldown otherwise emits `.js` and the repository's runtime commands and tests name `.mjs` artifacts.
- `tsdown` warns that the top-level `external` option is deprecated in favour of `deps.neverBundle`; the configuration uses `deps.neverBundle` from the start.
- `tsdown`'s programmatic `build()` accepts one inline config and otherwise loads `tsdown.config.ts` as well, so each target is built by its own `build({ ...target, config: false })` call. `buildWithConfigs` is documented as internal and is not used.
- The Cloudflare artifact contains no `pg` and no statically linked `node:*` import. The single `node:` string is `importAtRuntime("node:fs/promises")` inside `file-type`'s optional filesystem path; it is a computed runtime import that workerd cannot link statically and that the Worker does not execute.

### Multi-chunk decision in practice

Code splitting stays enabled for `apps/api-cloudflare`, which is what the approved plan asked for. Two consequences were measured rather than assumed:

- Test fixtures are pinned to `codeSplitting: false`. A chunked `tests/fixtures/worker.ts` answered `/health/ready` with 500 in Miniflare, while the chunked production Worker answered 200 from an identical three-module layout, identical chunk imports and the same fixture emitted as one file. The interaction is unexplained, so the harness does not depend on it.
- `tests/workerd/entry.test.ts` builds `--target=cloudflare` and declares every emitted module through `tests/fixtures/worker-modules.ts`, so the chunked deployed artifact is what the production acceptance test starts. `tests/node/entry.test.ts` asserts that `dist/node` emits exactly one module, which turns a future dynamic import in the Node entry into a test failure instead of a broken start command.

### Lint and format

- `.oxlintrc.json`: 82 rules over 53 files, 0 findings. `--deny-warnings` is part of `pnpm lint`, and `no-await-in-loop` is disabled for `tests/**` and `tooling/**` where sequential execution is intentional. The one production occurrence, reading a `ReadableStreamDefaultReader` chunk by chunk in `packages/server/src/bounds.ts`, carries a scoped inline disable with the reason.
- The per-package `no-restricted-imports` overrides had to allow each adapter's own persistence libraries (`drizzle-orm`, `drizzle-kit`, `pg`, `@cloudflare/workers-types`); the first version banned them and `pnpm lint` caught it.
- `.oxfmtrc.json`: the formatting pass rewrote `packages/domain/src/index.ts` (leading-operator union), `AGENTS.md`, both READMEs, `.github/workflows/codeql.yml` and the new tooling files. `docs/**` and `.agents/**` are excluded: historical planning documents keep their existing layout, and the guidance skills are maintained by hand rather than by the formatter.
- `oxlint` does not check JSON, so `.oxlintrc.json` and `.oxfmtrc.json` are validated by being parsed by their tools and by `tests/unit/oxlint-config.test.ts`, which fails if the configuration stops rejecting four negative fixtures.

### Incidental fix

`tooling/secrets.mjs` crashed with `ENOENT` on a tracked file that is deleted but not yet committed, because `git ls-files -co` still reports it. The scanner now skips paths that do not exist. This was found by running `pnpm scan:secrets` during this migration, unrelated to the tool switch.

### Verification on this machine

`pnpm install --frozen-lockfile`, `typecheck`, `lint`, `format:check` (twice, and second run clean), `db:check`, `build`, `test:unit` (11), `test:contract` (1), `test:node` (10), `test:workerd` (36), `test:postgres` (24) = 81 ordinary tests, `scan:secrets` and `scan:licenses` passed. `pnpm audit --audit-level high` still reports only the reviewed moderate `drizzle-kit` advisory. One workerd run failed with `EADDRNOTAVAIL` while a debug Miniflare process from this session was still listening; it passed on rerun and is a harness artifact, not a product failure.

Not verified: hosted CI has not run against these tools, and the previous hosted acceptance evidence was produced with esbuild/Biome/Prettier, so the quality, Node, workerd and PostgreSQL jobs must be re-confirmed on a push or pull request.
