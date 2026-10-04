# 05 progress — Plugin protocol, SDK, registry, and trusted runtime

Plan: [Detailed checklist](../modules/05-plugin-foundation.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete (2026-10-01; the 05.2a audited-endpoint portion and the 05.3d configuration-audit portion were resumed and closed by explicit user instruction on 2026-10-01 — no suspended remainders remain in this module)
- Delivery scope: MVP backend
- Prerequisites: 04 complete; event/outbox contracts from 02.
- Implementation started: Yes (2026-10-01, batches 05.1a–05.1e).
- Completed implementation checklist IDs: 05.1a–05.1e, 05.2a–05.2f, 05.3a–05.3e (all items).
- Active/next checklist group: None — module complete with no deferred remainders.
- Last updated: 2026-10-01 (audit portions resumed and closed; acceptance evidence updated).
- Blocking issues discovered: None for this module; a pre-existing wrangler/workers-types peer conflict (see the 2026-10-01 entry) will surface on future dependency re-resolution and belongs to module 01 maintenance.
- Evidence: See the session entries below.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 05.1 | Define the plugin specification | Complete (2026-10-01) | Session entries below; PLUGIN-SPEC 1.4.0 |
| 05.2 | Implement Core integration | Complete (2026-10-01; 05.2a audit portion resumed and closed the same day) | Session entries below |
| 05.3 | Verify lifecycle and compatibility | Complete (2026-10-01; 05.3d configuration-audit portion resumed and closed the same day) | Session entries below |

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

### 2026-10-01 — Batch 05.1e accepted (external service protocol); step 05.1 complete

- Scope and checklist IDs: 05.1e accepted (intended batch recorded before implementation) — separate trusted native code from isolated external services; scoped/revocable capability APIs and signed/versioned events for external services; arbitrary code hosting explicitly deferred. **Step 05.1 is complete.**
- Progress: PLUGIN-SPEC is at 1.4.0 with §12: three channels (`capability-api`, `signed-webhook`, `service-binding`), capability grants bound to plugin id/channel/declared permissions/narrow expiry that are revoked on disable, uninstall, rotation or compromise and never act as Core sessions (Core still checks object-level authorization on every call), bounded delivery with deadlines/retry budgets/circuit breaking, and signed versioned events — signature version 1, HMAC-SHA256 over canonical envelope bytes, `eventId` dedup plus a 5-minute freshness window, failing closed on signature failure. `@hyperbug/plugin-api` 1.4.0 carries the channels, constants, `CapabilityGrantSchema` and `SignedPluginEventSchema` with checkers; `@hyperbug/plugin-sdk` 1.3.0 re-exports them.
- Change summary: New `packages/plugin-api/src/external.ts`, index/SDK re-exports, version bumps, PLUGIN-SPEC §12, and 6 external-protocol test cases.
- Files/artifacts: `docs/PLUGIN-SPEC.md`; `packages/plugin-api/{package.json,src/external.ts,src/identity.ts,src/index.ts}`; `packages/plugin-sdk/{package.json,src/index.ts}`; `tests/unit/plugin-external.test.ts`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `pnpm-lock.yaml`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 160/160, contract 1/1, node 50/50, workerd 128/128, isolated PostgreSQL 18.6 68/68, build, db:check both dialects, docs build, secret and license scans all passed. Two test-authoring mistakes were corrected before acceptance: a misspelled constant name (FRESHINESS→FRESHNESS) that surfaced as an unresolved export, and a tampering case that expected structural validation to detect a re-signed pluginId (it cannot — that is the signature's job); the case now uses a structurally invalid envelope.
- Decisions and deviations: Grant/signing mechanisms reuse the platform HMAC/key-lifecycle patterns from [CRYPTOGRAPHY](../../CRYPTOGRAPHY.md) at implementation time (05.2); only the protocol vocabulary is fixed here. Deferred code hosting remains deferred; no native-code sandboxing claim exists anywhere in the specification.
- Blockers/open questions: None new.
- Next actions: 05.2 begins — 05.2a non-audit scope: registry/lifecycle validation and authorized (non-audited) plugin-management endpoints.
- Next-session cautions: Do not emit module-05 audit events (05.2a/05.3d audit portions stay suspended); do not expand module 09 (05.2d only connects envelopes to the existing outbox).

### 2026-10-01 — Intended batch 05.2a non-audit scope (recorded before implementation)

- Scope and checklist IDs: 05.2a, **audit portion suspended**: implement registry/lifecycle validation and authorized plugin-management endpoints without module-05 audit events. Planned slice: application plugin-registry service/port, D1+PostgreSQL registry adapters with dual-dialect migration, Administrator-authorized Elysia management routes (register/validate/list/enable/disable/upgrade/uninstall with explicit data policy) following module 04's bearer/roles/recent-auth patterns, root wiring on both profiles, route/repository tests on workerd/D1 and PostgreSQL lanes. plugin-runtime stays 1.0.0 (its loading/hook machinery arrives with 05.2c/05.2f).
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: None yet.
- Blockers/open questions: None.
- Next actions: Survey the module-04 vertical-slice pattern, then implement.
- Next-session cautions: None yet.

### 2026-10-01 — Batch 05.2a non-audit scope complete (registry and management endpoints)

- Scope and checklist IDs: 05.2a, **audit portion suspended — item stays unchecked**. Completed non-audit scope: registry/lifecycle validation and authorized plugin-management endpoints, with zero module-05 audit events (asserted in both new route suites).
- Progress: The deployment-level plugin registry exists end to end. Application port `PluginRegistryStore` (+ record/view validation); D1 and PostgreSQL adapters with dual-dialect migration `0015_plugin_registry`/`0014_plugin_registry`; server routes `POST|GET /api/v1/admin/plugins`, `POST .../load|enable|disable|upgrade|uninstall` running the shared authorization guard anchored on an administrated project under `plugin:install` (sensitive ⇒ recent authentication enforced; password tokens answered 403 `REAUTHENTICATION_REQUIRED` in both suites); registry wiring in both production roots and the account-worker fixture; lifecycle decisions from plugin-api drive every operation (compat validation, id conflicts, strictly-increasing upgrades from non-enabled states, complete-configuration enable, explicit retain/delete uninstall policy). Plugin ids contain a slash, so item operations carry the id in the body.
- Change summary: One vertical slice across application/database×2/server/contracts(+3 error codes, plugin DTOs)/observability(+`admin.plugins` label)/both roots/fixture; plugin-api granted to application, server and both database adapters in both boundary layers; snapshot reconstruction for the previously uncommitted drizzle meta files 0012–0014 (D1) / 0011–0013 (PG) so the new migrations contain only `plugin_registry` — this repaired a latent generation hazard where any new migration would have duplicated applied tables; migration-position assertions updated in five test files; two new route suites (workerd/D1 full matrix incl. step-up, invalid/incompatible manifests, duplicate, enable/disable/upgrade/uninstall, audit silence; PostgreSQL end-to-end incl. step-up and audit silence).
- Files/artifacts: `packages/application/src/plugin-registry.ts`; `packages/database/{d1,postgres}/src/plugin-registry.ts` (+ schema table + migration 0015/0014 + reconstructed meta snapshots); `packages/server/src/plugin-management.ts` + `index.ts` + `errors.ts`; `packages/contracts/src/index.ts`; `packages/observability/src/index.ts`; `tooling/check-boundaries.mjs` + `.oxlintrc.json`; `packages/{server,database/d1,database-postgres}/package.json` + `pnpm-lock.yaml`; `apps/api-cloudflare/src/index.ts`; `apps/api-node/src/{index,abuse-admission}.ts`; `tests/fixtures/account-worker.ts`; `tests/workerd/plugin-route.test.ts`; `tests/postgres/plugin-registry-route.test.ts`; migration-position edits in `tests/{workerd/entry,postgres/account-route,postgres/oauth-route,postgres/passkey-route,postgres/recovery-route,postgres/repository}.test.ts`; `docs/API-CONVENTIONS.md`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 160/160, contract 1/1, node 50/50, workerd 129/129 (new plugin-route suite included), isolated PostgreSQL 18.6 69/69 (new plugin-registry-route suite included), build, db:check both dialects, docs build, secret and license scans all passed. Local/emulated evidence only; no deployed claim.
- Decisions and deviations: (1) All 05.2a operations anchor to `plugin:install` with a project-type target because the shared resolver has no plugin-scoped facts loader yet; `plugin:configure` (resource type `plugin`) waits for that loader with the configuration interfaces in 05.2b. Role and recent-authentication requirements are identical. (2) The drizzle meta snapshot gap (uncommitted 0012–0014/0011–0013 snapshots from prior sessions) was repaired by reconstructing snapshots from the table-creation history; new migrations now diff correctly. (3) Lifecycle state is ordinary registry state; the suspended audit scope means no `plugin.*` events — asserted by both suites.
- Blockers/open questions: None new. The wrangler/workers-types peer conflict remains latent (module 01).
- Next actions: 05.2b — scoped configuration and storage interfaces, secret-provider access, write-only secret updates, redacted reads, namespace ownership (uses the maintenance migrations reference for namespaced schema).
- Next-session cautions: 05.2a stays unchecked until its audit portion is resumed by user instruction; enable currently succeeds only for settings-free plugins by design until 05.2b lands; local D1 still has pending migrations beyond 0008 and the isolated `hyperbug-test-1` D1 is at 0011 — do not apply 0015 anywhere without an authorized target.

### 2026-10-01 — Intended batch 05.2b (recorded before implementation)

- Scope and checklist IDs: 05.2b — scoped configuration and storage interfaces, secret-provider access, write-only secret updates, redacted reads, and namespace ownership. Planned: namespaced plugin settings persistence (public values stored, secret values encrypted through the module-03 key-provider envelope with only digests/presence readable back), configuration endpoints on the management surface (write-only secret updates; redacted configuration reads), registry enable consuming stored configuration, both dialects+migrations, both roots, route/repository tests.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: None yet.
- Blockers/open questions: None.
- Next actions: Survey the security package's envelope/key-provider surface, then implement.
- Next-session cautions: None yet.

### 2026-10-01 — Batch 05.2b accepted (scoped configuration and storage)

- Scope and checklist IDs: 05.2b accepted — scoped configuration and storage interfaces, secret-provider access, write-only secret updates, redacted reads, and namespace ownership.
- Progress: `plugin_settings` exists in both dialects (migrations `0016_plugin_settings`/`0015_plugin_settings`) with a uuid row identity per setting, namespace-key uniqueness and shape checks. The `PluginSettingsStore` port stores public values as text and secret values only as opaque A256GCM/A256KW envelopes produced by the module-03 key provider (`encryptSecret`), each envelope context-bound to its row uuid (`resourceType: 'plugin-setting'`) so a stored envelope cannot be replayed onto another row. `POST /api/v1/admin/plugins/configure` validates values against the manifest before storing anything; `POST /api/v1/admin/plugins/configuration` returns the redacted view (public values typed, secrets only as presence); enable consumes the stored configuration; uninstall `policy: delete` removes the namespaced settings while `retain` keeps them.
- Change summary: Schema/port/adapters/server/contracts additions, both roots and fixture wiring, two route suites extended with the configure flow (write-only secret, redacted read, ciphertext-not-plaintext assertion, enable-after-configure, uninstall cleanup), migration-position updates for the two new migrations.
- Files/artifacts: `packages/application/src/plugin-settings.ts`; `packages/database/{d1,postgres}/src/plugin-settings.ts` + schema + migrations 0016/0015; `packages/server/src/{plugin-management,index}.ts`; `apps/api-{cloudflare,node}` roots; `tests/fixtures/account-worker.ts`; `tests/workerd/plugin-route.test.ts`; `tests/postgres/plugin-registry-route.test.ts`; migration-position edits in five suites; `docs/API-CONVENTIONS.md`; `docs/plan/modules/05-plugin-foundation.md`; this record.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 160/160, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build, db:check both dialects, docs build, secret and license scans all passed. Both suites assert the stored secret record contains the A256GCM envelope and not the plaintext.
- Decisions and deviations: Secret envelopes bind to a per-setting uuid because `contextBytes` requires a uuid resource id — plugin ids cannot serve as the binding. Encryption calls the key provider sequentially per secret (deliberate; inline lint disable) while independent row writes parallelize. `plugin:configure` remains reserved for a plugin-scoped facts loader; configuration endpoints anchor on `plugin:install` like the rest of the surface (same role and recent-authentication requirements). A generic namespaced plugin-data store is deferred until its first runtime consumer (05.2f) — the settings store already demonstrates namespace ownership.
- Blockers/open questions: None new.
- Next actions: 05.2c — extension contracts per capability with Core policy boundaries, including the fail-closed plugin-permission failure handling re-scoped from 03.3f.
- Next-session cautions: Migrations are at D1 0016 / PostgreSQL 0015; local D1 has pending 0009+ and the isolated test D1 sits at 0011 — apply only against authorized targets. Keep the root `SECURITY.md` draft uncommitted.

### 2026-10-01 — Intended batch 05.2c (recorded before implementation)

- Scope and checklist IDs: 05.2c — define authentication/SSO, CAPTCHA, notifications, issue actions/metadata, search, import/export, and settings extension contracts with their Core policy boundaries, including the fail-closed plugin-permission failure handling re-scoped from 03.3f (2026-09-30): a plugin-permission check that fails, times out or is unavailable denies without silently disabling verification. Planned: PLUGIN-SPEC §13 (extension-point catalog per capability: point ids, sync/async mode, payload version, security-critical classification with forced fail-closed, policy boundaries per capability) plus the catalog types/helpers in plugin-api and the point-policy table the runtime enforces. Module 09 boundary: async points only define envelopes; no dispatch, no consumers.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: None yet.
- Blockers/open questions: None.
- Next actions: Implement, verify, update this entry.
- Next-session cautions: None yet.

### 2026-10-01 — Batch 05.2c accepted (extension-point catalog)

- Scope and checklist IDs: 05.2c accepted — extension contracts for authentication/SSO, CAPTCHA, notifications, issue actions/metadata, search, import/export and settings with Core policy boundaries, including the fail-closed plugin-permission handling re-scoped from 03.3f.
- Progress: PLUGIN-SPEC is at 1.5.0 with §13: the closed Core-owned extension-point catalog (`PLUGIN_HOOK_POINTS` in plugin-api 1.5.0, re-exported by sdk 1.4.0) — twelve points across the eight capability surfaces, modes fixed to the PERFORMANCE §48 minimum (the three security-critical verification points plus `issue-metadata:validate` are sync; everything else is async-envelope-only until module 09), payload versions owned by Core, per-capability policy boundaries (plugins supply mechanisms, never whether Core policy runs), and participation rules (`pluginMayOccupyPoint`): declared-capability requirement, unknown-point rejection, and in-process sync points reserved for trusted-native plugins. `pointFailurePolicy` forces fail-closed on every security-critical point regardless of declaration — the 03.3f re-scope's contract form: a failing, timing-out or unavailable check denies, never silently disabling verification.
- Change summary: New `packages/plugin-api/src/extension-points.ts`, index/SDK re-exports, version bumps, PLUGIN-SPEC §13 + chapter-status row, 5 new catalog tests.
- Files/artifacts: `packages/plugin-api/{package.json,src/extension-points.ts,src/identity.ts,src/index.ts}`; `packages/plugin-sdk/{package.json,src/index.ts}`; `tests/unit/plugin-extension-points.test.ts`; `docs/PLUGIN-SPEC.md`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `pnpm-lock.yaml`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 165/165, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: `issue-metadata:validate` is sync but not security-critical (an invalid metadata check fails the request rather than denying a security decision); external plugins cannot occupy any in-process sync point — module 16's external sync needs arrive through §12 channels. Async points define envelopes only; module 09 is not expanded.
- Blockers/open questions: None new.
- Next actions: 05.2d — connect hook/event envelopes to module 02's existing outbox model (envelope writes only; no dispatch, no side-effect consumers).
- Next-session cautions: The catalog is Core-owned; adding a point is a spec version bump. Keep the root `SECURITY.md` draft uncommitted.

### 2026-10-01 — Intended batch 05.2d (recorded before implementation)

- Scope and checklist IDs: 05.2d — connect hook/event envelopes to the outbox model; actual async dispatch and side-effect consumers stay with module 09. Planned decision (recorded before implementation): module 02's shared `outbox` table is project-scoped (`project_id NOT NULL` FK) and owned by modules 02/06/09, while plugin events are deployment-level — so 05.2d materializes the outbox **model** (at-least-once rows with `available_at`/`attempts`/`delivered_at` semantics) as module 05's own `plugin_event_outbox` table carrying §11.5 envelopes, without altering the shared table or adding any dispatch/consumer. Module 09 unifies dispatch later. Deliverables: dual-dialect table+migrations 0017/0016, application port, adapters, a server publish service that validates the envelope, requires an enabled plugin occupying an async catalog point, and writes the row; a fixture-only proof route exercises the chain (no production endpoint — publication is triggered by business actions that arrive with module 06); route/repository tests on both profiles including the disabled-plugin denial.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: The outbox-model-not-shared-table decision above.
- Blockers/open questions: None.
- Next actions: Implement, verify, update this entry.
- Next-session cautions: None yet.

### 2026-10-01 — Batch 05.2d accepted (outbox-model event connection)

- Scope and checklist IDs: 05.2d accepted — hook/event envelopes connected to the outbox model; actual async dispatch and side-effect consumers remain module 09's (not expanded).
- Progress: `plugin_event_outbox` exists in both dialects (migrations `0017_plugin_event_outbox`/`0016_plugin_event_outbox`) materializing the outbox **model** (at-least-once rows, `available_at`, `attempts`, `delivered_at`) for deployment-level plugin events carrying §11.5 envelopes. The `publishPluginEvent` service validates the envelope, requires an enabled plugin that occupies an async catalog point per §13.2, and writes the row — publication is an internal trigger surface (decorated `pluginEventPublisher` for future business routes), exercised through a fixture-only proof route on workerd and directly on PostgreSQL; both suites prove the enabled-plugin publish lands an undelivered envelope row, and a disabled plugin, a sync point and an unknown plugin all refuse.
- Change summary: Dual-dialect table+adapters, application `PluginEventOutboxStore` port, server publish service + decoration, both roots and fixture wiring, proof route, extended route suites, migration-position updates for 0017/0016.
- Files/artifacts: `packages/application/src/plugin-events.ts`; `packages/database/{d1,postgres}/src/plugin-events.ts` + schema + migrations 0017/0016; `packages/server/src/{plugin-events,index}.ts`; `apps/api-{cloudflare,node}` roots; `tests/fixtures/account-worker.ts`; `tests/workerd/plugin-route.test.ts`; `tests/postgres/plugin-registry-route.test.ts`; migration-position edits in six suites; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 165/165, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: As recorded before implementation, module 02's shared `outbox` table is project-scoped (`project_id NOT NULL` FK to projects) and owned by modules 02/06/09, while plugin events are deployment-level — 05.2d therefore materializes the outbox model as module 05's own table instead of altering the shared schema; module 09 unifies dispatch later. No dispatch, retry loop, consumer or scheduler exists here.
- Blockers/open questions: None new.
- Next actions: 05.2e — build-time frontend extension descriptors and reviewed CSP merging (no remote JavaScript URL loading; no SPA work).
- Next-session cautions: Migrations at D1 0017 / PostgreSQL 0016. The proof publish route is fixture-only; production publication arrives with module 06's business actions.

### 2026-10-01 — Intended batch 05.2e (recorded before implementation)

- Scope and checklist IDs: 05.2e — build-time frontend extension descriptors and reviewed CSP merging; no remote JavaScript URL loading, no SPA work. Planned: PLUGIN-SPEC §14 defining the `ui:build-time-descriptor` payload and the merge rules (only manifest-declared https exact origins, no wildcards, Core baseline never weakened, unsafe-* structurally impossible), a pure `mergeCspOrigins` helper + descriptor schema in plugin-api (1.6.0), and unit tests covering dedupe/bounds/baseline preservation/zero-plugin equality.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: None yet.
- Blockers/open questions: None.
- Next actions: Implement, verify, update this entry.
- Next-session cautions: None yet.

### 2026-10-01 — Batch 05.2e accepted (build-time descriptors and CSP merging)

- Scope and checklist IDs: 05.2e accepted — build-time frontend extension descriptors and reviewed CSP merging; no remote JavaScript URL loading; no SPA work.
- Progress: PLUGIN-SPEC is at 1.6.0 with §14: the `ui:build-time-descriptor` payload (`PluginUiDescriptorSchema` — plugin id, manifest-declared CSP origins, declared surfaces) and the reviewed merge rules implemented as the pure `mergeCspOrigins` in plugin-api 1.6.0 (sdk 1.5.0 re-exports): only https exact origins enter (wildcards, paths, plain http and `unsafe-*` are structurally impossible), the Core baseline is preserved verbatim and always leads, duplicates collapse, at most eight merged entries per directive beyond the baseline, and a zero-plugin merge is the identity. The merge is review input — the build reports what each enabled frontend plugin contributed.
- Change summary: New `packages/plugin-api/src/frontend.ts`, index/SDK re-exports, version bumps, PLUGIN-SPEC §14 + chapter row, 5 new merge tests.
- Files/artifacts: `packages/plugin-api/{package.json,src/frontend.ts,src/identity.ts,src/index.ts}`; `packages/plugin-sdk/{package.json,src/index.ts}`; `tests/unit/plugin-frontend.test.ts`; `docs/PLUGIN-SPEC.md`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `pnpm-lock.yaml`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 170/170, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: None beyond the specification; the frontend build consumption itself is module 11's (no SPA work here).
- Blockers/open questions: None new.
- Next actions: 05.2f — one minimal official example plugin and a failing/slow plugin fixture using only the public SDK/API (this activates `@hyperbug/plugin-runtime`'s first real host machinery).
- Next-session cautions: Keep the root `SECURITY.md` draft uncommitted; the merge is data-only — never a runtime CSP mechanism.

### 2026-10-01 — Intended batch 05.2f (recorded before implementation)

- Scope and checklist IDs: 05.2f — one minimal official example plugin and a failing/slow plugin fixture using only the public SDK/API. Planned: `@hyperbug/plugin-runtime` 1.1.0 gains its first real host machinery — a bounded sync-hook executor that validates a module's manifest and point participation (§13.2), refuses non-enabled plugins (§10.4), races the handler against the §11.3 deadline, and maps error/timeout outcomes through the effective failure policy (fail-closed on security-critical points). Example plugins live as SDK-authored fixtures (`tests/fixtures/plugins/`) — plugins are trusted code compiled into the application, so a dedicated package directory is unnecessary until official plugins ship (module 16); the 05.3e quickstart will publish the same code. Runtime stays plugin-api-only: registry state is supplied by the caller, keeping infrastructure out.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: The fixture-location decision above.
- Blockers/open questions: None.
- Next actions: Implement, verify, update this entry.
- Next-session cautions: None yet.

### 2026-10-01 — Batch 05.2f accepted (example plugin and failing/slow fixture)

- Scope and checklist IDs: 05.2f accepted — one minimal official example plugin and a failing/slow plugin fixture using only the public SDK/API.
- Progress: `@hyperbug/plugin-runtime` 1.1.0 gains its first real host machinery: module validation (manifest-valid, trusted-native only, every hook at a §13.2-legal declared point) and the bounded sync-hook executor — enabled-only invocation (§10.4), envelope delivery with catalog payload versions, deadline race (§11.3, with an injectable timer), and error/timeout mapping through the effective failure policy so security-critical points deny (fail-closed, the 03.3f re-scope) while non-critical points fail-request. The example plugin (`@hyperbug/example-notifier`, SDK `definePlugin` + one notification hook) and the failing/slow fixture (`@acme/failing-captcha`: throwing and stalling CAPTCHA handlers) are SDK-authored fixtures; installing native code still means trusting it.
- Change summary: Runtime executor + module validation, two SDK-only plugin fixtures, 7 new runtime tests (success delivery, disabled no-invoke, throwing deny, stalling deny with injected timer, async-point/invalid-deadline refusal, external/undeclared module rejection).
- Files/artifacts: `packages/plugin-runtime/{package.json,src/index.ts}`; `tests/fixtures/plugins/{example-notifier,failing-slow}.ts`; `tests/unit/plugin-runtime.test.ts`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `pnpm-lock.yaml`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 177/177, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: As recorded before implementation, example plugins live as SDK-authored fixtures (plugins compile into the application; a dedicated package directory waits for module 16's official plugins) and the runtime stays plugin-api-only — registry state is caller-supplied, keeping persistence infrastructure out of the contract package. Step 05.2 is now complete except 05.2a's suspended audit portion.
- Blockers/open questions: None new.
- Next actions: 05.3a — negative fixtures: incompatible versions, malformed manifests, unknown capabilities, missing secrets, invalid configuration, disabled-plugin behavior.
- Next-session cautions: The runtime executor covers sync points; async participation goes through the 05.2d outbox path. Keep the root `SECURITY.md` draft uncommitted.

### 2026-10-01 — Intended batches 05.3a+05.3b+05.3c (recorded before implementation)

- Scope and checklist IDs: 05.3a (incompatible versions, malformed manifests, unknown capabilities, missing secrets, invalid configuration, disabled-plugin behavior), 05.3b (permissions and object authorization at every plugin-facing API boundary, cross-project access, unauthorized secret reads) and 05.3c (timeout/error behavior and bounded hook invocation, documenting the non-preemptibility of in-process CPU-bound native code). Most dimensions already have route-level and unit evidence from 05.2 batches; this batch adds the aggregated negative-fixture suite (contract-level rejections per dimension), the missing authorization negatives (non-administrator management denial on both profiles), the retain-policy retention assertion, and the CPU-bound non-preemption proof.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: None yet.
- Blockers/open questions: None.
- Next actions: Implement, verify, update this entry.
- Next-session cautions: None yet.

### 2026-10-01 — Batches 05.3a, 05.3b, 05.3c accepted (negative, authorization and timeout fixtures)

- Scope and checklist IDs: 05.3a, 05.3b and 05.3c accepted (intended batches recorded before implementation). 05.3d's non-audit scope (upgrade/data-retention handling, namespaced migrations, contract compatibility across both runtimes) is complete through these suites; its **configuration-audit portion stays suspended — the item remains unchecked**.
- Progress: The aggregated negative-fixture suite (`tests/unit/plugin-negative-fixtures.test.ts`) rejects every 05.3a dimension at its owning layer: incompatible apiVersion ranges and non-increasing upgrades, malformed manifests (id/version/trust tier/unknown fields), unknown capabilities, missing declared secrets, wrong-typed/unknown configuration values, and disabled-plugin inertness. Route-level negatives on both profiles add the non-administrator FORBIDDEN denial at the plugin-facing boundary (05.3b; unauthorized configuration reads were already impossible — the read surface returns redacted views only, asserted since 05.2b) and the retain-policy retention assertion (namespaced configuration survives uninstall for reinstall; delete removes it — 05.3d non-audit scope). 05.3c is verified end to end: throwing and stalling handlers deny on the security-critical CAPTCHA point, invalid deadlines and async points refuse before any handler runs, and the CPU-spin test proves in-process native code between awaits cannot be preempted — the wall clock shows the spin ran to completion, and the hardened executor then refuses to adopt its past-deadline result, documenting exactly the §11.3 limitation.
- Change summary: New negative-fixture suite; executor hardening (deadline starts before the handler; past-deadline results are not adopted; error vs wall-clock-timeout classification); route negatives and retention assertions on both profiles; one new runtime test.
- Files/artifacts: `tests/unit/plugin-negative-fixtures.test.ts`; `packages/plugin-runtime/src/index.ts`; `tests/unit/plugin-runtime.test.ts`; `tests/workerd/plugin-route.test.ts`; `tests/postgres/plugin-registry-route.test.ts`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 186/186, contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build, db:check both dialects, docs build, secret and license scans all passed.
- Decisions and deviations: The executor was hardened during this batch: the original race let a synchronously-completed CPU-bound handler win even past its deadline because the timer could not fire during the spin — the deadline now starts before the handler and a post-race wall-clock check refuses to adopt late results (non-preemption remains documented and unavoidable; adoption of late results is not). This is a strengthening within §11.3's specified bounds, not a baseline change.
- Blockers/open questions: None new.
- Next actions: 05.3e — the English extension-author quickstart.
- Next-session cautions: 05.3d stays unchecked until its configuration-audit portion is resumed; keep the root `SECURITY.md` draft uncommitted.

### 2026-10-01 — Batch 05.3e accepted; Module 05 complete

- Scope and checklist IDs: 05.3e accepted. **Module 05 is Complete**: every non-suspended checklist item (05.1a–05.1e, 05.2b–05.2f, 05.3a–05.3c, 05.3e) is implemented and verified on both local profiles; 05.2a's audited-endpoint portion and 05.3d's configuration-audit portion stay suspended and unchecked as explicit deferred remainders; 05.2a/05.3d non-audit scopes are complete.
- Progress: The English extension-author quickstart (`docs/EXTENDING-PLUGINS.md`) opens with the required trust statement verbatim — "Installing a Native Plugin means trusting its code." — then walks the public SDK path: minimal plugin, lifecycle from the operator side, write-only secrets, bounded hooks and the external-service channels. The acceptance evidence is recorded in [05 validation evidence](../evidence/05-plugin-foundation-validation.md): the example plugin loads and participates in a bounded extension point and disables safely on both profiles, compatibility and negative-permission fixtures pass, and Core security stays active with zero plugins (asserted explicitly). The workerd plugin suite gained that zero-plugin readiness assertion before anything registers.
- Change summary: Quickstart document, documentation indexes, zero-plugin acceptance assertion, acceptance-evidence file, checklist/status finalization.
- Files/artifacts: `docs/EXTENDING-PLUGINS.md`; `docs/README.md`; `docs/plan/README.md`; `tests/workerd/plugin-route.test.ts`; `docs/plan/evidence/05-plugin-foundation-validation.md`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`.
- Verification: Node 24.21.0 local — unit 186/186, contract 1/1, node 50/50, workerd 129/129 (zero-plugin assertion included), isolated PostgreSQL 18.6 69/69; lint/boundaries, typecheck matrix, format:check, docs build (secret/license scans unchanged in this batch, latest run 05.3a-c). Local/emulated evidence only.
- Decisions and deviations: None new; the suspended audit portions follow the module 03/04 precedent of explicit deferred remainders.
- Blockers/open questions: The G1 audit-governance decision (resume vs deferral+ADR) remains with the user and now covers this module's two suspended portions plus modules 06–09's.
- Next actions: None for module 05. Awaiting user direction; module 06 is the next executable module but is not started here.
- Next-session cautions: Do not resume the suspended audit portions implicitly; keep the root `SECURITY.md` draft uncommitted; migrations are at D1 0017 / PostgreSQL 0016 with no remote applications.

### 2026-10-01 — Intended batch: Module 05 audit portions (recorded before implementation)

- Scope and checklist IDs: 05.2a audited-endpoint portion and 05.3d configuration-audit portion, resumed by the user's explicit instruction to continue the Module 05 audit and close the remaining checks (suspension-register resume entry recorded with this batch). Audit portions of modules 06–16 remain suspended. Planned slice: `plugin.*` events in the closed audit catalog (`plugin.registered`/`plugin.enabled`/`plugin.disabled`/`plugin.upgraded`/`plugin.uninstalled`/`plugin.configured` — deployment-level, authenticated actor, success-only, plugin-id `targetId`, per-action metadata: version on register/upgrade/uninstall, retain/delete policy on uninstall, public/secret counts on configure, never any setting value), append-after-write through `appendRequiredAuditEvent` on every plugin-management mutation (denials append nothing; a missing sink or failed bounded append answers `AUDIT_UNAVAILABLE` without compensating the write), a closed-catalog unit block, both route suites asserting the emitted events in place of the audit-silence assertions, a PLUGIN-SPEC §10 registry-audit subsection (spec and plugin-api 1.6.1) and an API-CONVENTIONS update.
- Progress: Starting now; entry recorded before implementation per protocol.
- Change summary / Files / Verification: Pending.
- Decisions and deviations: None yet.
- Blockers/open questions: None.
- Next actions: Implement, verify, update this entry.
- Next-session cautions: None yet.

### 2026-10-01 — Batch accepted: Module 05 audit portions closed (05.2a and 05.3d complete)

- Scope and checklist IDs: **05.2a and 05.3d accepted** — the audited-endpoint and configuration-audit portions were resumed by the user's explicit instruction to continue the Module 05 audit and close the remaining checks, and are now implemented and verified on both local profiles. **Module 05 has no suspended remainders; every checklist item is complete.** Audit portions of modules 06–16 remain suspended under the [suspension register](../AUDIT-SUSPENSION.md).
- Progress: The closed audit catalog gained the module 05 plugin-administration events (`plugin.registered`, `plugin.enabled`, `plugin.disabled`, `plugin.upgraded`, `plugin.uninstalled`, `plugin.configured`) — deployment-level, attributed to the acting administrator, success-only (denials stay in the authorization trail), with per-action metadata: version on register/upgrade/uninstall, the explicit retain/delete policy on uninstall, and public/secret write counts on configure; no setting key or value ever enters the metadata. Every plugin-management mutation appends its event after the authoritative registry write through `appendRequiredAuditEvent` (a missing sink or failed bounded append fails with `AUDIT_UNAVAILABLE` 503 without compensating the write), wired through the shared `PluginManagementContext` so both production roots and both route fixtures emit the trail. Both route suites now assert the full emitted event set (workerd 16 events, PostgreSQL 12) including actor attribution, uninstall policy/version, configure counts, zero events after a forbidden non-administrator attempt, and the absence of both written secret values from the trail; the audit unit suite gained a closed-catalog block for the six actions and their rejection matrix.
- Change summary: `pluginActions` catalog + validation branch in `packages/security/src/audit.ts`; `auditAppend` on `PluginManagementContext` and append-after-write in all six mutation handlers in `packages/server/src/plugin-management.ts`; requestId threading from the routes in `packages/server/src/index.ts`; catalog unit block in `tests/unit/audit.test.ts`; both route suites' audit-silence assertions replaced by the full event-set assertions; PLUGIN-SPEC 1.6.1 §10.7 (registry audit, host-side) with plugin-api 1.6.1; API-CONVENTIONS audited-registry paragraph; suspension-register resume entry; checklist/status/evidence finalization.
- Files/artifacts: `packages/security/src/audit.ts`; `packages/server/src/{plugin-management,index}.ts`; `packages/plugin-api/{package.json,src/identity.ts}`; `tests/unit/audit.test.ts`; `tests/workerd/plugin-route.test.ts`; `tests/postgres/plugin-registry-route.test.ts`; `docs/PLUGIN-SPEC.md`; `docs/API-CONVENTIONS.md`; `docs/plan/AUDIT-SUSPENSION.md`; `docs/plan/modules/05-plugin-foundation.md`; this record; `docs/plan/PROGRESS.md`; `docs/plan/evidence/05-plugin-foundation-validation.md`; `docs/plan/EXECUTION.md`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, unit 188/188 (new plugin catalog block included), contract 1/1, node 50/50, workerd 129/129, isolated PostgreSQL 18.6 69/69, build (all targets), db:check both dialects (pre-existing non-fatal journal-timestamp warnings from the reconstructed 05.2a snapshots remain), docs build, secret and license scans all passed. Two pre-acceptance corrections: the PostgreSQL event comparison needed a key-order-independent canonical form (jsonb normalizes object keys), and a lint no-shadow rename. Local/emulated evidence only; no deployed claim.
- Decisions and deviations: (1) The catalog mirrors PLUGIN-SPEC §9's plugin-id and semver patterns inline in `audit.ts` rather than importing plugin-api, keeping the security package dependency-free of plugin contracts. (2) `plugin.uninstalled` is appended after the registry removal but before the namespaced settings deletion, so the audited decision is recorded even if the ancillary cleanup fails — the registry entry is uninstall's authoritative write. (3) `plugin.configured` records counts only (public/secret), never keys or values, extending the SECURITY §§110–116 redaction baseline to the plugin trail. (4) PLUGIN-SPEC/plugin-api moved to 1.6.1 (patch): host-side audit documentation with no contract change; sdk/runtime stay 1.5.0/1.1.0.
- Blockers/open questions: None new. The G1 audit-governance decision remains with the user, now covering modules 06–09's suspended audit portions only.
- Next actions: None for module 05 — module complete with no remainders. Module 06 is the next executable module per the plan's order, awaiting user direction.
- Next-session cautions: Later modules' audit portions must not resume implicitly; keep the root `SECURITY.md` draft uncommitted; migrations are at D1 0017 / PostgreSQL 0016 with no remote applications; the postgres evidence file `03-postgres-audit-query.json` regenerates its measurements whenever the postgres lane runs — do not commit unrelated measurement drift with plugin batches.

### 2026-10-05 — Review remediation B3 verified

- Scope and checklist IDs: 05.2a, 05.3b (post-completion B3).
- Progress: B3 complete locally; overall mission continues at B4. Existing module status/checklists and G1/G2/13.G6 are unchanged.
- Change summary: Plugin administration requires an instance administrator; project creation grants no instance privilege. Atomic plugin audit remains B4.
- Files/artifacts: Owning stores/routes/schema/tests and specifications listed in the [cross-module remediation record](../evidence/2026-10-05-review-remediation.md#b3-instance-roles-and-token-bound-assurance-2026-10-05). D1 0024/0025; PostgreSQL 0023/0024.
- Verification: Final local matrix **916 passed / 18 optional-provider skips** (349 unit, 1 contract, 121 Node, 262 workerd/D1 emulation, 183 real isolated PostgreSQL 18.6). Typecheck, lint, Drizzle check (old timestamp warnings), docs build, tracked/new-source formatting and diff checks pass. Root formatting flags only supplied untracked review files; reports untouched. No actual deployment/provider claim. Initial wiring/schema/fixture failures and focused primary-agent security review are recorded in the linked evidence.
- Decisions and deviations: Independent instance role and immutable presented-credential facts; configured default 300 s replaces hardcoded 900 s. No policy weakening, new protocol or new ADR required for B3; formal Minimum ADR remains B8.
- Blockers/open questions: None for B3. Independent Sonnet review unavailable (model not callable); no independent review claimed. Atomic account/role/plugin audit remains B4.
- Next actions: B4 audit transaction/failure cases, recovery-code step-up and passkey CAPTCHA forwarding, then B5–B15 in the approved order.
- Next-session cautions: Never stage SECURITY.md or supplied reviews; preserve historical migration/audit rows, apply schema before adapters, inspect upgrade role recipient, and require new passkey login for old tokens. No SPA or later-module audit resume.
