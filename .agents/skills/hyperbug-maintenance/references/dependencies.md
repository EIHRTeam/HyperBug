# Dependency updates

Read for toolchain, framework, ORM, driver, build/test, or provider SDK updates. Source policy: TECH-STACK §§2, 8, 12, 31–40, 52–53 and SECURITY §§124–128 through [SOURCES](../../../../docs/plan/SOURCES.md).

## Establish the actual update

Inspect manifests, the lockfile, package scripts, runtime configuration, and dependency callers. If the workspace has not been scaffolded, module 01 version verification is the next action; do not fabricate an upgrade from a version that was never installed.

Fetch current documentation through root Context7 rules, including migration notes and exact package/export names. Verify package availability in official sources/registries. Record old/new exact resolutions, dependency purpose, compatibility constraints, and the update rationale.

Preserve declared major policies: Node 24, PostgreSQL 18.x, TypeScript 7, pnpm 11, and React 19; Vite/Vitest follow reviewed latest stable updates. These are project choices, not assertions that dated source patch versions remain current. Unavailable or incompatible required versions need an explicit blocker/decision rather than a silent downgrade.

## Review risk and apply a coherent change

Consider maintenance/security history, transitive dependencies, license, install scripts, ESM/type quality, runtime compatibility, native/WASM code, and browser bundle impact.

Prereleases are allowed when justified: tooling/framework/ORM risk differs from drivers, auth, sanitizers, crypto, and persistent storage. Follow the source policy; do not interpret allowed as preferred. Keep crypto mature/audited and sanitizer stable by default. Review ORM/migration-tool upgrades together and inspect generated migration changes.

Use the repository's package manager and a single lockfile. Record exact resolutions; CI/release installation is frozen, not a floating latest/rc lookup. Retain the approved lifecycle-script controls. Do not bundle unrelated major upgrades into an incident fix.

## Validate and record

Use the actual targeted commands from the workspace: type/build/test/contract/runtime checks plus the affected [test matrix](../../hyperbug-development/references/testing.md). Elysia changes need routing/validation/OpenAPI/encapsulation and Workers/Node verification; database changes also use [migration guidance](database-migrations.md).

Inspect API/schema drift, bundle/query/performance changes, and review-triggered decisions. Keep an experimental next-version lane distinct from required production checks. Document the accepted resolution and recovery path, update commands/runbooks when needed, and leave a [session handoff](../../hyperbug-development/references/session-handoffs.md).

