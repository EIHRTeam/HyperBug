# Backend toolchain and dependency research

Research date: 2026-09-17–18. Source versions are verified resolutions, not floating install instructions.

| Component | Selected version | Evidence / decision |
| --- | --- | --- |
| Node | 24.21.0 LTS | Official `https://nodejs.org/dist/index.json`; installed `fnm exec --using=24.21.0 node --version` |
| pnpm | 11.26.0 | npm `latest-11`; preserve required major even though latest is 12 |
| TypeScript | 7.0.2 | npm latest stable and Context7 `/microsoft/typescript/v7.0.2` |
| Elysia | 1.4.30 | npm latest stable |
| Node adapter | `@elysia/node` 1.4.6 | Current official Node integration documentation and published named `node` export; older `@elysiajs/node` 1.4.5 remains published but is not selected |
| Vitest | 5.0.1 | npm latest stable; supports Node 24 |
| Drizzle ORM / Kit | 0.45.2 / 0.31.10 | Current stable; RC is permitted by policy but not required |
| PostgreSQL | 18.6 | Installed Homebrew binary; exact 18.x major required |
| Miniflare | 5.20260916.0-alpha | Matches Wrangler; removes high-severity advisories from the initially tried stable 4 harness |
| Wrangler | 4.133.0 | Current stable; local dev and binding type generation |
| Biome | 2.5.14 | Syntax linter without a TypeScript compiler peer requirement; current typescript-eslint peer range excludes TS 7 |

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

One root lockfile covers explicit `apps/*`, `packages/*`, and `packages/database/*` globs. Native build scripts are denied unless listed in `allowBuilds`; esbuild and workerd need their reviewed binary setup. Sharp install scripts are disabled (image processing is not used). CI must use `pnpm install --frozen-lockfile` and Node 24. Direct dependencies are exact-pinned. Dependency changes require the same runtime and migration suites.

No SPA, browser library, production resource, or cloud deployment is created by this foundation.

## Dependency review outcomes

The frozen graph uses native binaries from TypeScript, Biome, esbuild, workerd and test tooling. No browser product bundle exists. Miniflare 5 is justified development tooling, not a prerelease application framework. The full audit now has one moderate advisory in Drizzle Kit's legacy esbuild loader (GHSA-67mh-4wv8-2f99); its vulnerable development-server API is not used. Keep migration generation local and do not expose a Drizzle/esbuild development server. The high-severity audit gate remains active, with no suppressions. Reassess this moderate item during the next matching ORM/Kit upgrade.

License review allows exact development-only libvips packages (LGPL-3.0-or-later, 1.3.1/1.3.3) under Miniflare, and Lightning CSS packages (MPL-2.0, 1.33.0) under Vitest/Vite. No modified library code is distributed by this task; redistribution must retain their notices and obligations. The scanner restricts these exceptions by package/version, while unknown licenses fail. `pnpm why --recursive sharp lightningcss` verified these dependency paths.

A system-installed standalone pnpm embeds an older Node/pnpm pair on this workstation. Use `fnm exec --using=24.21.0 corepack pnpm` to honor the project pin. `verifyDepsBeforeRun: error` prevents scripts from silently installing or rewriting dependency state.


Additional 2026-09-18 lookups: Context7 `/llmstxt/developers_cloudflare_d1_llms-full_txt` supplied implicit-transaction, foreign-key-deferral and Wrangler migration configuration guidance. `/cloudflare/workers-sdk` did not cover the new local S3 credential option; installed Miniflare declarations/source and signed local HTTP experiments verified it. PostgreSQL migration/query behavior is exercised on 18.6; hosted CI and the proposed container image remain unverified.


Context7 `/websites/github_en_actions` (2026-09-18) verified the PostgreSQL service-container shape, explicit port mapping, health check and PG environment pattern against the [official service tutorial](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers). CI uses a disposable database containing fixtures only; the local private-socket workflow is independent.
