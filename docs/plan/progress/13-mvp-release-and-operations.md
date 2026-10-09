# 13 progress — MVP release, deployment, and maintenance readiness

Plan: [Detailed checklist](../modules/13-mvp-release-and-operations.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: MVP release gate
- Prerequisites: 12 complete and backend gate 10 remains passing.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 13.1, after prerequisites are satisfied.
- Last updated: 2026-09-19.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Bilingual reader outlines and a locally built VitePress documentation site; product release implementation and hosted Pages publication remain unverified.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 13.1 | Package supported deployments | Not started | None yet |
| 13.2 | Rehearse maintenance and recovery | Not started | None yet |
| 13.3 | Validate and prepare release artifacts | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 13.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

Separate staging checks from production release actions. Only claim a provider/profile is tested when evidence exists for that exact combination.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 13; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for mvp release, deployment, and maintenance readiness.
- Files/artifacts: `docs/plan/modules/13-mvp-release-and-operations.md`; `docs/plan/progress/13-mvp-release-and-operations.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 13.1.
- Next-session cautions: Separate staging checks from production release actions. Only claim a provider/profile is tested when evidence exists for that exact combination.


### 2026-09-19 — Reader documentation skeleton

- Scope and checklist IDs: Preparatory documentation for 13.3d, with outlines for 13.1a–13.1e and 13.2a–13.2e. All implementation and release checklist items remain unchanged and unchecked.
- Progress: Completed the authorized skeleton: one reader index and 13 task-oriented guide outlines. Inspected current plans, source precedence, reader workflows, development guides, and package scripts. The working tree was clean at session start.
- Change summary: Added a reader-first documentation entry point and outlines for users, maintainers, operators, API consumers, and extension authors. Linked it from the root README and module 13 plan. Every outline identifies its audience, goal, sources, and completion requirements.
- Files/artifacts: `docs/README.md`, `docs/guide/`, root `README.md`, module 13 plan navigation, and this record.
- Verification: A one-off Python validator passed for 17 changed/new Markdown files, 81 relative links/anchors, 13 guide metadata/navigation entries, English content, final newlines, whitespace, and unchanged module 13 checklist/status. `git diff --check` passed. Manually checked roadmap/current-availability distinctions and both profile outlines against the plans. Application tests, deployments, and external publication were not run because no application behavior changed.
- Decisions and deviations: Treat this as advance documentation preparation under 13.3d; module 13 remains Not started for release implementation, and G1/G2 remain closed. Use existing specifications as sources without inventing commands, UI labels, API endpoints, or supported providers. No library/API syntax question or web implementation is introduced, so Context7 and modern-web lookups are not applicable.
- Blockers/open questions: Runnable product walkthroughs, screenshots, production runbooks, support contacts, and release evidence depend on later implementation and verification.
- Next actions: Populate the user and API walkthroughs after modules 04–12 acceptance; complete profile-specific installation and recovery instructions under 13.1/13.2, then verify support/security destinations and publish the completed documentation under 13.3d. All release prerequisites still apply.
- Next-session cautions: An outline is not an exercised runbook or shipped feature. Preserve English documentation, both backend profiles, and backend-before-SPA gates.

### 2026-09-19 — Bilingual VitePress site and Pages workflow

- Scope and checklist IDs: Reader-documentation preparation under 13.3d, with module 00 guidance and module 01 dependency/CI maintenance. Product release prerequisites and every unchecked module 13 item remain unchanged.
- Progress: Moved the 13 English guide outlines into `docs/site/guide/`, added matching Chinese guides and two locale index pages, and built the default-theme VitePress site. Added language-preserving navigation, localized local search, `.html` routes, and the `/HyperBug/` project base.
- Change summary: Added a PR build and main-branch GitHub Pages deployment workflow, three documentation commands, pinned dependencies, bilingual repository entry points, and the explicit language-policy exception requested by the user. Only reader Markdown is compiled; engineering references link to GitHub.
- Files/artifacts: `docs/site/`; `docs/.vitepress/config.ts`; `docs/README.md`; `docs/development/DOCUMENTATION.md`; `.github/workflows/docs.yml`; `package.json`; `pnpm-lock.yaml`; `pnpm-workspace.yaml`; root READMEs and AGENTS; plan README/EXECUTION/PROGRESS/COVERAGE; module 00/13 plans and module 00/01/13 records. Earlier `docs/guide/` files were moved, not duplicated.
- Verification: Node 24.21.0/pnpm 11.26.0: frozen installation, `pnpm docs:build`, config `tsc --ignoreConfig --noEmit --skipLibCheck --module esnext --moduleResolution bundler --target es2023 docs/.vitepress/config.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm scan:licenses` (9 approved expressions), and `pnpm audit --audit-level high` passed. One-off Python checks passed for 29 generated HTML pages, 1,018 internal links/assets/fragments, locale metadata, and 13 paired guide structures. Ruby parsed workflow YAML. HTTP checks confirmed the VitePress development server and translated Markdown module compile. No product tests, hosted CI, or deployment were run. Initial config type check required TypeScript 7's `--ignoreConfig`; an initial dev-HTML language assertion failed because VitePress serves a client bootstrap in dev, so language metadata was checked in generated HTML instead. Browser navigation/language switching had been observed before the user requested no browser validation; no further browser checks followed that request.
- Decisions and deviations: English and Simplified Chinese are required for reader documentation; engineering documents remain English. Use the default theme without custom UI/accessibility work, as requested. Stable VitePress 1.6.4 initially introduced a high Vite 5 advisory; a scoped Vite 6.4.3 override removes it without changing the API build. The remaining moderate advisory is the pre-existing drizzle-kit/esbuild path. Context7, registry, provider-action versions, modern-web guidance and the unsupported-upstream-override caveat are recorded in DOCUMENTATION.md. The documentation site is separate from the gated product SPA.
- Blockers/open questions: GitHub Pages API returned 404; repository Pages enablement and live publication are unverified. Maintainers must select GitHub Actions in Pages settings and merge/run the workflow on main. Product walkthroughs remain outlines awaiting their owning modules' acceptance.
- Next actions: Review/merge the site changes and configure Pages, observe the first hosted workflow, then record its actual URL and outcome. Populate both languages together as product features pass acceptance.
- Next-session cautions: Preserve the separately occurring module 03 work. No commit/push, remote settings mutation, or deployment occurred. Keep the Vite override until a supported upstream version resolves the advisory; do not report the expected Pages URL as live evidence. Do not reintroduce duplicate `docs/guide/` sources or translate internal historical records by implication.

### 2026-09-19 — Initial security settings reader documentation

- Scope and checklist IDs: Reader guidance supporting 13.3d and the implemented 03.1/03.3b batch; no release checklist item completed.
- Progress: Added synchronized English/Simplified Chinese security settings pages and links from operations. Pages explicitly distinguish implemented configuration/HTTP controls from pending authentication, crypto, audit, rate and outbound protection.
- Change summary: Describe origins/debug/input bounds, seven independent retention values and sensitive-admin verification settings without implying automatic cleanup or production readiness.
- Files/artifacts: `docs/site/{guide,zh-CN/guide}/security.md`, corresponding operations links, and `docs/SECURITY-FOUNDATION.md` as the engineering source. The concurrent documentation commit now includes these reader files.
- Verification: `corepack pnpm docs:build` passed, including rendering; values and variable names checked against configuration and both language versions. No publication/deployment or release rehearsal occurred.
- Decisions and deviations: Reader content remains bilingual and engineering evidence English. Module 13 and G2 status are unchanged.
- Blockers/open questions: None for this documentation batch; remaining Phase 03 mechanisms and later deployment/recovery work still need their own evidence.
- Next actions: Update both language pages when remaining Phase 03 controls are accepted.
- Next-session cautions: Do not advertise planned security mechanisms as shipped or confuse retention settings with implemented deletion jobs. Preserve the independently maintained VitePress config and documentation history.

### 2026-09-19 — Credential protection availability notes

- Scope and checklist IDs: Reader documentation support for 13.3d and implemented 03.2a–03.2c; release checklist unchanged.
- Progress: Synchronized English/Chinese security pages to describe tested digest/envelope mechanisms and Worker-secret/private-file sources while clearly retaining the persistent lifecycle, password and production-composition gaps.
- Change summary: Added source permissions, fail-closed key use and retained-backup cautions with the engineering cryptography specification.
- Files/artifacts: Both `guide/security.md` reader paths and `docs/CRYPTOGRAPHY.md`; Phase 03 evidence.
- Verification: Corresponding names/values/availability statements checked across both language pages; docs build and local links checked at the checkpoint. No release, deployment or live recovery claim.
- Decisions and deviations: Keep operator guidance separate from internal lifecycle test fixtures.
- Blockers/open questions: Operational key rotation/removal instructions still require 03.2d's real registry and later release rehearsals.
- Next actions: Extend both reader pages only as those outcomes are accepted.
- Next-session cautions: Do not describe a policy fixture as production key lifecycle or imply a configured binding alone authorizes key use.


### 2026-09-19 — Security lifecycle persistence and operations handoff

- Scope and checklist IDs: Reader/operator handoff for module 03.2d; release/operations checklists remain incomplete.
- Progress: Synchronized English and Simplified Chinese security guidance with implemented local lifecycle protection and remaining production integration limits.
- Change summary: Documented rotation, retained data/backup pins, explicit post-retention destruction confirmation and mandatory restore/revocation reconciliation; no provider backup action was performed.
- Files/artifacts: Both `docs/site/*/guide/security.md` paths, CRYPTOGRAPHY, ADR 0006 and [03 evidence](../evidence/03-security-foundation-validation.md).
- Verification: `docs:build` passes; full backend suite 133 passes. Local migrations applied/no-op verified; no remote migration, deployment, hosted CI, live backup destruction or restore test.
- Decisions and deviations: Database backup pinning is an internal coordination capability. Module 13 must verify provider capture/destruction and reconcile current revocations/manifests before restored service starts. A project administrator is not implicitly a deployment key operator.
- Blockers/open questions: Production backup/restore and authenticated deployment administration remain future owners; this documentation does not claim release readiness.
- Next actions: Continue authorized Phase 03 work, then consume lifecycle requirements in module 13 operations procedures when eligible.
- Next-session cautions: Keep reader languages synchronized and retain unrelated ongoing documentation work. Never delete raw material based only on backup expiry or a restored stale registry.

### 2026-09-20 — Minimum-tier packaging, rehearsal and disclosure planned

- Scope and checklist IDs: Planning only. Added 13.1f–13.1g, 13.2g, 13.3f and the independent gate 13.G6. No release checklist item was completed or checked.
- Progress: Recorded the tier's packaging and runbook, the capability/degradation matrix, a rehearsal under free limits with measured recovery objectives, and the mandatory bilingual reader disclosure. The new gate is explicitly independent of 13.G1–13.G5.
- Change summary: Extended the module plan and its source-coverage pointer; the module remains Not started for release implementation and no existing gate line changed state.
- Files/artifacts: `docs/plan/modules/13-mvp-release-and-operations.md`; [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md); [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No deployment, Pages publication or recovery rehearsal ran.
- Decisions and deviations: Reader disclosure is required in English and Simplified Chinese through `docs/site/`, consistent with the documentation policy; the engineering disclosure lives in the specification and must not be weaker.
- Blockers/open questions: 13.G6 needs a real Cloudflare Free account and all upstream tier evidence; missing access keeps it open.
- Next actions: Keep the tier as documentation until 03.V7 exists; package it only when the tier items are implemented.
- Next-session cautions: Never mark 13.G6 from emulation, never cite it as MVP acceptance, and keep the tier's runbook separate from the standard-profile release checklist.

### 2026-09-20 — Minimum-tier configuration status reader update

- Scope and checklist IDs: Reader handoff for 03.1e/03.3g; preparation only for 13.3f, with 13.G6 unchanged and open.
- Progress: Synchronized English/Chinese security guides with implemented exact tier/acknowledgement parsing, Node refusal and the current minimum-tier startup barrier.
- Change summary: Documented upgrade acknowledgement removal, no automatic fallback, planned degradation categories and mandatory invariants, with a link to the engineering compensation catalog. The tier remains unavailable; no support or release claim.
- Files/artifacts: `docs/site/guide/security.md`, `docs/site/zh-CN/guide/security.md`, FREE-TIER-PROFILE and ADR 0007 status; [tier evidence](../evidence/03-deployment-tier-validation.md).
- Verification: Reader pair manually compared; application affected lanes pass 104 tests. Documentation build passes; scoped validator passes 12 documents / 133 local links and anchors, reader settings and checklist states; scoped diff whitespace passes. No actual Free-plan test, deployment, release or recovery rehearsal.
- Decisions and deviations: Preserve independent tier acceptance; standard gates and first-class profiles are unchanged. Full released-tier disclosure/capability evidence remains required by 13.3f/13.G6.
- Blockers/open questions: Minimum credentials, compensations, quotas and recovery objectives remain unaccepted; startup stays closed until the required mechanisms/evidence exist.
- Next actions: Continue owning Phase 03 enforcement; expand operator/reader disclosure as mechanisms and real-provider evidence become available.
- Next-session cautions: Keep reader paths/content synchronized, keep engineering prose English, and never present parser acceptance as a runnable or supported tier. Preserve other sessions' documentation-site changes.

### 2026-09-25 — Security reader transport handoff

- Scope and checklist IDs: Reader documentation supporting 03.2f and future 13.3d; no module 13 release checklist or gate completed.
- Progress: Synchronized the English and Simplified Chinese security guides with audit suspension and the local transport capability boundary.
- Change summary: Both guides distinguish local Node TLS negotiation, Cloudflare documented capabilities and actual deployment checks; they keep the optional minimum tier unavailable.
- Files/artifacts: `docs/site/guide/security.md`, `docs/site/zh-CN/guide/security.md`, [transport specification](../../TRANSPORT-SECURITY.md) and [local result](../evidence/03-node-transport-capability.json).
- Verification: `corepack pnpm docs:build` passed at the transport checkpoint. A one-off documentation check on 2026-09-25 passed paired plan/progress files, relative links and the seven-case evidence structure; the English/Chinese sections were compared. No deployment, live TLS probe, Pages publication or release rehearsal ran.
- Decisions and deviations: Local capability and provider documentation are not release or production transport evidence; G2 and the minimum-tier gate stay open.
- Blockers/open questions: Actual frontend/API origin TLS, HSTS, proxy trust and managed segments await an authorized deployment environment and module 13 acceptance.
- Next actions: Add deployed transport observations during module 13 acceptance, while Phase 03 proceeds with non-audit enforcement.
- Next-session cautions: Update both reader languages together; do not advertise PQ authentication or the optional minimum tier as shipped. Audit work and Argon2id performance exploration remain stopped.

### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: 13.G2/13.G6 planning and migration-state handoff; no release item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior operational and Free-tier planning while recording test-only D1 and absent persistent PostgreSQL state; no rollout occurred.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Staging/production migrations, recovery, Free-tier acceptance, and G2 remain open.
- Next actions: Keep Free tier disabled and do not deploy or migrate without a separate scoped task.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-05 — Review remediation B8 formal Minimum profile

- Scope/checklist IDs: Approved B8 to 03 tier/crypto/admission, 04 account journeys, 10/13 profile gates, with 01 composition and 02 contracts dependencies.
- Progress/change summary: ADR 0012 supersedes old floor/gate exclusions; canonical tier/new acknowledgement, public peppered PBKDF2 passwords with bounded strength policy, durable login lockout/CAPTCHA, standard Argon2id upgrades and sensitive-route-only activation. Separate Minimum entry omits Wasm. Bilingual disclosures and active plans synchronized.
- Files/artifacts: [B8 evidence](../evidence/2026-10-05-review-remediation.md#b8-formal-cloudflare-minimum-profile-2026-10-05), ADR 0012, roots/config/security/server/contracts/builds and focused fixtures; no database migration.
- Verification: Selected config/audit/provider/activation 36, Minimum journey 7, real PostgreSQL 18.6 account/upgrade journey 1 and final admission 19 passed; typecheck/lint/boundaries/docs pass. Bundle and denylist sizes recorded, initial fixture failures corrected. Local evidence only, no Argon2id performance or independent review claim.
- Decisions/blockers: Authorized Minimum-only offline-strength deviation disclosed; historical v1 audit rows preserved. G1/G2 now require all three profiles and stay closed; additional real-Free 13.G6 open. Actual CPU/startup remains B15.
- Next actions/cautions: Commit B8 then B9 risk-tiered limits. Preserve scoped key/concurrency bounds, one-use permits, stronger-hash refusal, expected credential revision, append-only histories, protected files and remaining holds.

### 2026-10-05 — Review remediation B15 measurements and cleanup

- Scope and checklist IDs: Approved B15/13.1f/13.2a–b/13.3b/f/13.G6 evidence dependency; no new module/gate completion.
- Progress: B1–B15 implementation/evidence/owned cleanup recorded; Free acceptance remains incomplete.
- Change summary: Backup restored locally, migrations verified remotely, live functional slices measured, exact owned Workers/domain removed, provider settings and baseline rows/history preserved.
- Files/artifacts: B15 report/JSON, bilingual security guides and ignored recovery receipts; [B15 measurements and cleanup](../evidence/2026-10-05-b15-live-measurements.md), [receipt](../evidence/2026-10-05-b15-live-metrics.json), [remediation record](../evidence/2026-10-05-review-remediation.md).
- Verification: Reused B14 matrix 937 passed / 18 optional-provider skips. B15 Minimum 7 passed; Node timeout/stall 2 passed / 31 intentionally unselected (earlier incorrect filter selected zero); actual R2 2 passed / 6 intentionally unselected. Live 10/10 logins, scoped path/cleanup checks pass; final compile/lint/build/docs/format/secret results in linked record. No broad rerun or new automated tests.
- Decisions and deviations: 1,000 ms defaults cover observed D1 trips (537 samples, max 284 ms); production sampling 0.1, test/staging 1; ten native PBKDF2 slots at the Minimum root. Cleanup retains FK-required tombstones and permanent keys rather than disabling history protections. Primary focused review only; Sonnet unavailable.
- Blockers/open questions: Billing attribution unavailable; instrumented login CPU 20–47 ms exceeds nominal Free 10 ms. Successful live CAPTCHA passkey login, Standard measurements and complete quota/recovery evidence unverified. G1/G2 remain closed, 13.G6 open.
- Next actions: Billing attribution, uninstrumented Free budget, live human CAPTCHA, Standard and complete recovery acceptance remain open; no production release.
- Next-session cautions: Test Workers/domain removed and tails stopped; mutable owned rows absent. One deleted User, archived private project, deleted issue/three comments plus immutable history remain; two owned keys are removed identities. Never stage protected drafts/reviews/HANDOFF; preserve baseline rows, migrations, audit/history, no SPA or Argon2id performance work.

### 2026-10-10 — Module 09 B3 search/plugin dispatch and crash recovery

- Scope and checklist IDs: 09.1c/09.1d, 09.2d, 09.V1/V2/V5; close 08.2e/08.V5 integration handoffs.
- Progress: Connected consumers and both-store injected failure/HTTP outage acceptance pass; Module 08 checklist is now complete at its documented local scope.
- Change summary: Existing search handler is dispatched unchanged; trusted host plugin bindings reload lifecycle/settings and reauthorize delayed actions. Standard roots use the current Cron/Node interval; provider startup failure preserves canonical API availability and source events.
- Files/artifacts: Application async-consumers, both app async roots/composition/task wiring, Wrangler queue bounds, shared crash/HTTP tests; [evidence](../evidence/09-async-validation.md).
- Verification: Connected consumers 3 each D1/PG, explicit added processing-failure case 1 each, complete issue-route/HTTP journeys 2 each pass; types/lint/boundaries/build/secret/scoped-format/diff pass. Queue failures/downstream idempotency are deliberately injected; stores and HTTP runtimes are actual local services/emulation.
- Decisions and deviations: No envelope/producer/search contract change. Missing host bindings retry boundedly; disabled/uninstalled plugins cancel. Core permission callbacks are required per binding. Primary focused review only; no audit resumed.
- Blockers/open questions: None for B3; B4 workflow/scheduling and B5 Minimum/hosted quota proofs remain. Standard paid-profile performance stays unverified.
- Next actions: B4 durable adapters/conformance and consolidated cleanup/operator documentation.
- Next-session cautions: Preserve idempotency and current permissions/configuration; no official provider/features or public API expansion. G1/G2 closed, 13.G6 open; protect untracked drafts/handoffs.
