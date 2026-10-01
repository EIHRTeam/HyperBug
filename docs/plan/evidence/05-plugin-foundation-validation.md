# Module 05 validation evidence

Collected 2026-10-01 on Node 24.21.0 local (workerd/Miniflare D1 and isolated PostgreSQL 18.6 lanes). No deployed claim is made; `hyperbug-test-1` and staging/production were untouched.

## Acceptance evidence mapping

| Acceptance statement | Evidence |
| --- | --- |
| A conforming example plugin loads | `@hyperbug/example-notifier` authored with the public SDK (`definePlugin`); module validation and bounded invocation verified in `tests/unit/plugin-runtime.test.ts`; registration/enable on both profiles in the plugin route suites |
| participates in a bounded extension point | Outbox publication at `notifications:deliver` with envelope verification on both profiles (workerd proof route + PostgreSQL direct service, `plugin-route.test.ts` / `plugin-registry-route.test.ts`); sync execution bounded by deadline/payload/concurrency in the runtime suite |
| can be safely disabled on both profiles | Disabled-plugin publication denied 409 on both profiles; runtime returns `disabled` without invoking the handler; disable/enable transitions asserted on both profiles |
| Compatibility fixtures pass | `tests/unit/plugin-manifest.test.ts` (api range semantics), incompatible-range and non-increasing-upgrade route denials on both profiles |
| Negative-permission fixtures pass | `tests/unit/plugin-negative-fixtures.test.ts`; password-assurance `REAUTHENTICATION_REQUIRED` and non-administrator `FORBIDDEN` denials on both profiles; redacted secret reads (envelope stored, plaintext never returned) |
| Core security remains active with zero plugins installed | The workerd plugin suite asserts `/health/ready` 200 before any plugin exists; all other account/role/session suites run on compositions with zero registered plugins throughout |

## Verification matrix (final batch state)

- `corepack pnpm lint` (oxlint + boundary checker) — pass
- `corepack pnpm typecheck` (root + both Cloudflare projects) — pass
- `corepack pnpm format:check` — pass
- unit 186/186, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69
- `corepack pnpm build` (all targets) — pass
- `corepack pnpm db:check` (D1 + PostgreSQL) — pass
- `corepack pnpm docs:build` — pass
- `corepack pnpm scan:secrets`, `corepack pnpm scan:licenses` — pass

## Deliverable inventory

- `docs/PLUGIN-SPEC.md` 1.6.0 (§1–§14) with ADR 0010; `docs/EXTENDING-PLUGINS.md` quickstart
- `@hyperbug/plugin-api` 1.6.0, `@hyperbug/plugin-sdk` 1.5.0, `@hyperbug/plugin-runtime` 1.1.0 (independently versioned)
- Registry, settings and event tables in both dialects (D1 migrations 0015–0017; PostgreSQL 0014–0016)
- Management/configuration endpoints on both production roots; bounded sync executor; two SDK-authored plugin fixtures

## Suspended remainders (explicit)

- 05.2a audited plugin-management endpoints and 05.3d configuration audits stay suspended and unchecked under the standing audit suspension; no `plugin.*` audit events exist (asserted in both route suites).
- Reconstructed drizzle meta snapshots for D1 0012–0014 / PostgreSQL 0011–0013 repaired a latent generation hazard from prior sessions.
- The latent wrangler 4.144.0 ↔ pinned `@cloudflare/workers-types` peer conflict (module 01 maintenance) resurfaces on dependency re-resolution.
