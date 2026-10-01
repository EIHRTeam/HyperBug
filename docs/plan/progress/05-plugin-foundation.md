# 05 progress — Plugin protocol, SDK, registry, and trusted runtime

Plan: [Detailed checklist](../modules/05-plugin-foundation.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress
- Delivery scope: MVP backend
- Prerequisites: 04 complete; event/outbox contracts from 02.
- Implementation started: Yes (2026-10-01, batches 05.1a–05.1d).
- Completed implementation checklist IDs: 05.1a, 05.1b, 05.1c, 05.1d.
- Active/next checklist group: 05.1e (external service protocol).
- Last updated: 2026-10-01 (batch 05.1d accepted).
- Blocking issues discovered: None for this module; a pre-existing wrangler/workers-types peer conflict (see the 2026-10-01 entry) will surface on future dependency re-resolution and belongs to module 01 maintenance.
- Evidence: See the session entries below.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 05.1 | Define the plugin specification | In progress (05.1a) | Session entries below |
| 05.2 | Implement Core integration | Not started | None yet |
| 05.3 | Verify lifecycle and compatibility | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 05.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

MVP includes a tested trusted-plugin foundation. Untrusted runtime code hosting is deferred; manifest permissions do not sandbox native code.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 05; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for plugin protocol, sdk, registry, and trusted runtime.
- Files/artifacts: `docs/plan/modules/05-plugin-foundation.md`; `docs/plan/progress/05-plugin-foundation.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 05.1.
- Next-session cautions: MVP includes a tested trusted-plugin foundation. Untrusted runtime code hosting is deferred; manifest permissions do not sandbox native code.


### 2026-09-21 — Audit work suspended by user instruction

- Scope and checklist IDs: Audit-related portions of this module's canonical checklist; see the [suspension register](../AUDIT-SUSPENSION.md).
- Progress: Marked planned audit work Suspended with the explicit instruction “no audit for now”; unrelated development remains eligible.
- Change summary: Added visible suspension labels and an execution override, preserving unchecked states and earlier history.
- Files/artifacts: This module's plan and progress record; the shared suspension register.
- Verification: Documentation consistency is checked with the suspension batch; no audit implementation or audit acceptance run.
- Decisions and deviations: Explicit user-directed scheduling suspension, not completion, automatic resumption, or deletion of existing audit behavior.
- Blockers/open questions: Audit evidence remains deferred; it does not block unrelated development or count as a passed release gate.
- Next actions: Execute the next eligible non-audit work within the authorized scope; Phase 03 proceeds with transport security.
- Next-session cautions: Do not restart audit tasks through mixed feature checklists or earlier next-action entries; resume only when the user explicitly requests it. Preserve existing history and protections.

### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: Plan-only dependency alignment; no implementation item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior policy and prerequisite wording while consolidating the tree; no plugin implementation was started.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Module prerequisites and acceptance remain open.
- Next actions: Keep Module 05 untouched until the user resumes feature work and prerequisites are met.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-09-30 — Phase 03 re-scope ownership recorded

- Scope and checklist IDs: Planning amendment only; no implementation checklist item was executed or checked. Affects the future 05.2c scope.
- Progress: A user-directed plan re-scope formally assigned module 05 ownership of 03.3f's plugin-permission failure handling: a plugin-permission check that fails, times out or is unavailable must deny without silently disabling verification, implemented when this module's runtime resumes. This allowed module 03 to be recorded as compliantly complete with its deferred remainder explicit.
- Change summary: The module plan's outcome section gained a "Deferred Phase 03 scope owned here (2026-09-30 re-scope)" note and item 05.2c gained the explicit inclusion of the fail-closed plugin-permission failure handling re-scoped from 03.3f.
- Files/artifacts: `docs/plan/modules/05-plugin-foundation.md`; this record; see the [closure matrix](../evidence/03-closure-matrix.md) and master progress for the re-scope record.
- Verification: Documentation-only amendment; no application tests were run because no application behavior changed. Shared batch checks (docs build and changed-file review) are recorded in the master session entry.
- Decisions and deviations: None beyond the recorded re-scope; this module remains Not started and its audit portions remain suspended per the [suspension register](../AUDIT-SUSPENSION.md).
- Blockers/open questions: None introduced; prerequisite module 04 is in progress.
- Next actions: Unchanged — begin 05.1 after module 04 completes; implement the re-scoped plugin-permission failure handling with 05.2c.
- Next-session cautions: The re-scope adds scope to 05.2c; it does not resume suspended audit work or the plugin runtime early.

### 2026-10-01 — Module 05 start; batch 05.1a accepted

- Scope and checklist IDs: 05.1a accepted (intended batch recorded before implementation per the session-start protocol). The 2026-10-01 user instruction releases Module 05 from the 2026-09-28 feature hold; every other part of that hold remains in force (audit portions of 05.2a/05.3d suspended, no Module 09 expansion, no SPA, no untrusted code hosting, Free tier untouched).
- Progress: `docs/PLUGIN-SPEC.md` exists as the versioned specification frame (scope, components, trust model, versioning, Core policy boundaries, performance/failure baseline, frontend constraints, conformance, chapter-status table for 05.1b–05.1e). `@hyperbug/plugin-api`, `@hyperbug/plugin-sdk` and `@hyperbug/plugin-runtime` exist as workspace packages, each independently semver'd at 1.0.0, exported through root devDependencies, and wired into `tooling/check-boundaries.mjs` (allowed/pure maps) and `.oxlintrc.json` (`no-restricted-imports` overrides). ADR 0010 records the plugin execution model and contract direction before the public contract was embedded.
- Change summary: New specification + ADR + three contract packages (version/identity/trust-tier seeds only; manifest and hook types arrive with 05.1b+); boundary policy for the new packages; version-coherence and boundary-grid tests; documentation index links (docs README, plan README specification index).
- Files/artifacts: `docs/PLUGIN-SPEC.md`; `docs/decisions/0010-plugin-execution-model-and-contracts.md`; `packages/plugin-api/{package.json,src/index.ts}`; `packages/plugin-sdk/{package.json,src/index.ts}`; `packages/plugin-runtime/{package.json,src/index.ts}`; `tooling/check-boundaries.mjs`; `.oxlintrc.json`; `package.json`; `pnpm-lock.yaml`; `tests/unit/plugin-packages.test.ts`; `tests/unit/boundaries.test.ts`; `docs/README.md`; `docs/plan/README.md`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`.
- Verification: Node 24.21.0 local — `corepack pnpm lint` (oxlint + boundary checker) passed; `corepack pnpm typecheck` (root + both Cloudflare projects) passed; `corepack pnpm format:check` passed (252 files); unit 117/117 and contract 1/1 (includes 4 new contract-version tests and the extended boundary-grid case); node 50/50; workerd 128/128; isolated PostgreSQL 18.6 68/68; `corepack pnpm build` (all targets) passed; `corepack pnpm db:check` both dialects passed; `corepack pnpm docs:build` passed; `corepack pnpm scan:secrets` passed; `corepack pnpm scan:licenses` passed (no new external dependency added).
- Decisions and deviations: [ADR 0010](../../decisions/0010-plugin-execution-model-and-contracts.md) — trusted native plugins are trusted application code (manifest permissions are review/least-privilege metadata, not a sandbox), isolated external plugins use scoped capabilities with no arbitrary Core SQL, untrusted code hosting stays deferred, and the three contract packages are separately versioned with the spec version following `@hyperbug/plugin-api`. No Context7 lookup: the batch added no new library/SDK/API dependency or usage question; all patterns mirror existing repository tooling.
- Blockers/open questions: A pre-existing peer conflict surfaced when the new workspace packages forced lockfile re-resolution: wrangler 4.144.0 (from the 964da20 audit upgrade) wants `@cloudflare/workers-types ^5.20260926.1` while the repo pins 5.20260917.1; `strictPeerDependencies: true` makes any future re-resolution fail this way (repeat installs with an up-to-date lockfile pass). Resolution belongs to module 01 dependency maintenance and needs a deliberate pin decision, not a silent change here.
- Next actions: 05.1b — manifest ID/version/API compatibility, capabilities, configuration schemas, public vs secret settings, CSP origins, extension points, and namespaced data/migrations (extends PLUGIN-SPEC chapter "Manifests and compatibility"; use the hyperbug-maintenance database-migrations reference for the namespaced-migration design).
- Next-session cautions: The root `SECURITY.md` draft stays uncommitted; the plugin packages are contract seeds only — do not import them into server/app code before 05.2 defines the runtime; the wrangler/workers-types peer conflict will reappear on the next dependency re-resolution.

### 2026-10-01 — Batch 05.1b accepted (manifest schemas and compatibility)

- Scope and checklist IDs: 05.1b accepted — manifest ID/version/API compatibility, capabilities, configuration schemas (public vs secret settings), CSP origins, extension points, and namespaced data/migrations, as PLUGIN-SPEC §9 plus TypeBox manifest schemas and pure compatibility/namespace helpers in `@hyperbug/plugin-api` and a `definePlugin` authoring helper in `@hyperbug/plugin-sdk`. Namespaced migrations are design-only here per the maintenance database-migrations reference; the migration model itself is implemented with 05.2b and tested by 05.3d.
- Progress: PLUGIN-SPEC is at 1.1.0 with the full "Manifests and compatibility" chapter (identity/shape, simplified apiVersion range rules, capability and permission vocabularies, extension-point references, public vs secret settings, CSP origin declaration, namespace derivation and migration rules). `@hyperbug/plugin-api` 1.1.0 carries `PluginManifestSchema` (strict, `additionalProperties: false`), `validatePluginManifest` with semantic duplicate checks, `apiVersionSatisfies` and `pluginDataNamespace`; `@hyperbug/plugin-sdk` 1.1.0 adds `definePlugin`. plugin-runtime stays at 1.0.0 — the packages now demonstrate independent versioning in practice.
- Change summary: New manifest module in plugin-api (identity split into `src/identity.ts`); SDK authoring entry; typebox allowance wired into both boundary layers; boundary-checker regex hardened so quoted string literals like the `'import'` capability no longer parse as import statements (with regression case); 18 new manifest/compatibility test cases plus boundary and package-coherence updates.
- Files/artifacts: `docs/PLUGIN-SPEC.md`; `packages/plugin-api/{package.json,src/identity.ts,src/manifest.ts,src/index.ts}`; `packages/plugin-sdk/{package.json,src/index.ts}`; `tooling/check-boundaries.mjs`; `.oxlintrc.json`; `pnpm-lock.yaml`; `tests/unit/{plugin-manifest,plugin-packages,boundaries}.test.ts`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 135/135, contract 1/1, node 50/50, workerd 128/128, isolated PostgreSQL 18.6 68/68, build (all targets), db:check both dialects, docs build, secret scan and license scan all passed. Three initial test failures were fixed before acceptance (duplicate settings keys — TypeBox 0.34 does not enforce `uniqueItems` on these arrays, now checked semantically; malformed version input to `apiVersionSatisfies` now returns false instead of throwing; namespace kebab-to-underscore normalization).
- Decisions and deviations: plugin-api's single external dependency is `@sinclair/typebox` 0.34.52 (mirrors packages/contracts), recorded in both boundary layers. Context7 lookup 2026-10-01 on `/sinclairzx81/typebox` confirmed the 0.34.x `@sinclair/typebox/value` API (`Value.Check`/`Value.Errors` iterator) and strict `Type.Object` options; noted future 1.0 import-path change as a maintenance gap. TypeBox's unenforced `uniqueItems` is a recorded tool-behavior finding, compensated in `validatePluginManifest`.
- Blockers/open questions: None new; the pre-existing wrangler/workers-types peer conflict did not resurface (lockfile resolution was skipped because typebox 0.34.52 was already resolved for contracts), but it remains latent for the next re-resolution.
- Next actions: 05.1c — lifecycle chapter (register, validate compatibility, configure, enable, disable, upgrade, uninstall, retain/delete policy) in PLUGIN-SPEC and the lifecycle state model in plugin-api.
- Next-session cautions: Manifest validation is additive across chapters (lifecycle/hook declarations extend the same object); do not import plugin packages into Core yet (05.2); keep the root `SECURITY.md` draft uncommitted.

### 2026-10-01 — Batch 05.1c accepted (lifecycle model)

- Scope and checklist IDs: 05.1c accepted (intended batch recorded before implementation) — lifecycle definition: register, validate compatibility, configure, enable, disable, upgrade, uninstall, and retain/delete plugin data through an explicit policy.
- Progress: PLUGIN-SPEC is at 1.2.0 with the lifecycle chapter (§10): three registry states (`registered`/`enabled`/`disabled`), register with compatibility validation and id-conflict rejection, configure/enable with complete-configuration rules, safe disable, upgrade restricted to non-enabled states with strictly increasing versions and unchanged ids, and uninstall with an explicit operator `retain`/`delete` choice over namespaced data (no default). `@hyperbug/plugin-api` 1.2.0 carries the pure model (`PLUGIN_LIFECYCLE_STATES`, `PLUGIN_LIFECYCLE_TRANSITIONS`, `decideRegistration`, `decideEnable`, `checkConfiguration`, `compareSemver`); the SDK is unchanged at 1.1.0 because lifecycle is host-facing.
- Change summary: New `packages/plugin-api/src/lifecycle.ts`, re-exports in the package index, exported `compareSemver` in manifest.ts, PLUGIN-SPEC §10, and 12 lifecycle/decision test cases.
- Files/artifacts: `docs/PLUGIN-SPEC.md`; `packages/plugin-api/{package.json,src/lifecycle.ts,src/manifest.ts,src/identity.ts,src/index.ts}`; `tests/unit/plugin-lifecycle.test.ts`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `pnpm-lock.yaml` (workspace manifest sync only).
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 147/147, contract 1/1, node 50/50, workerd 128/128, isolated PostgreSQL 18.6 68/68, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: Lifecycle rules live in the contract package as pure functions so registry (05.2a), conformance fixtures (05.2f) and negative tests (05.3a/05.3d) share one definition. Uninstall data deletion stays design-only here; its bounded procedure is implemented with the storage interfaces (05.2b) and tested by 05.3d. No audit events are defined or emitted — lifecycle state is ordinary registry state, and the suspended 05.2a/05.3d audit portions remain untouched.
- Blockers/open questions: None new.
- Next actions: 05.1d — hook protocol chapter (mode, ordering, payload version/limits, deadlines, concurrency, failure semantics, side-effect idempotency; security-critical hooks fail closed) in PLUGIN-SPEC and hook contract types in plugin-api.
- Next-session cautions: Do not import plugin packages into Core before 05.2; `compareSemver` throws on malformed input by contract — callers validate versions first.

### 2026-10-01 — Batch 05.1d accepted (hook protocol)

- Scope and checklist IDs: 05.1d accepted (intended batch recorded before implementation) — hook mode, ordering, payload version/limits, deadlines, concurrency, failure semantics and side-effect idempotency.
- Progress: PLUGIN-SPEC is at 1.3.0 with §11: `sync` mode restricted to results Core immediately depends on (authentication, authorization-related, required CAPTCHA) with `async` durable outbox dispatch for everything else; deterministic registry-order execution; payload versions owned by Core; ceilings fixed in the contract (65,536-byte sync payload, 3,000 ms deadline, 8 concurrent invocations per point); four explicit failure policies with the security-critical override (`effectiveFailurePolicy` forces `fail-closed`, implementing the 03.3f re-scope — a failing, timing-out or unavailable check denies and never silently disables verification); and `eventId`-based at-least-once idempotency. The documented non-preemption limitation for native CPU-bound code is part of §11.3 ahead of its 05.3c verification. `@hyperbug/plugin-api` 1.3.0 carries the constants, envelope schema (`isPluginHookEnvelope`) and policy helpers; `@hyperbug/plugin-sdk` 1.2.0 re-exports them.
- Change summary: New `packages/plugin-api/src/hooks.ts`, index/SDK re-exports, version bumps, PLUGIN-SPEC §11, and 7 hook protocol test cases.
- Files/artifacts: `docs/PLUGIN-SPEC.md`; `packages/plugin-api/{package.json,src/hooks.ts,src/identity.ts,src/index.ts}`; `packages/plugin-sdk/{package.json,src/index.ts}`; `tests/unit/plugin-hooks.test.ts`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `pnpm-lock.yaml`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 154/154, contract 1/1, node 50/50, workerd 128/128, isolated PostgreSQL 18.6 68/68, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: Tool-behavior finding (gap beyond the 2026-10-01 Context7 lookup): TypeBox 0.34's `Value.Check` rejects unregistered `format` annotations ("Unknown format 'uuid'"), so the envelope schema expresses uuid/date-time as self-contained patterns — the contract validates identically without a format registry. `packages/contracts` still uses `format` annotations at the HTTP layer; that latent difference is noted for module 06/10 awareness, not changed here. Async dispatch itself stays with module 09 per the hold; 05.2d only connects envelopes.
- Blockers/open questions: None new.
- Next actions: 05.1e — external service protocol chapter (trusted native vs isolated external separation, scoped/revocable capability APIs, signed/versioned events) and its contract types.
- Next-session cautions: Do not import plugin packages into Core before 05.2; hook point catalogs and payload shapes arrive with 05.2c.
