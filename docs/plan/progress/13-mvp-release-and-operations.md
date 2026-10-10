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

### 2026-10-10 — Module 09 B4 durable workflows and scheduling

- Scope and checklist IDs: 09.3b/c/d/f and local 09.V3/V4; scheduler/database/runtime integration only.
- Progress: B4 implemented and locally verified; B5 and suspended 09.3e remain open.
- Change summary: Native Workflows and PostgreSQL/Graphile checkpoint adapters, persistent bounded upload cleanup cursors, configured retention on existing schedulers, fixed exhausted Graphile key reconciliation, internal operator runbook.
- Files/artifacts: Runtime workflow/scheduler roots, application workflow/maintenance ports, config policy, additive maintenance migrations, shared cleanup/native workflow tests; [B4 evidence](../evidence/09-async-validation.md#b4--workflows-and-scheduled-maintenance).
- Verification: Actual persistent local Workflow restart/resume/cancel 1; actual PostgreSQL Graphile/cleanup 2; D1 cleanup 1; typecheck/lint/db:check/build/types/secrets/scoped format/diff pass. Initial fixture/type failures corrected; exact commands and boundaries in evidence.
- Decisions and deviations: No new dependency or normative change; tiny conformance has no artificial artifact reference. Graphile replace keys permit reconciliation of exhausted provider jobs. Existing upload/authorization semantics retained.
- Blockers/open questions: Hosted Free CPU/quota headroom and Minimum budget/recovery pending B5; no paid Standard acceptance claim.
- Next actions: Implement B5, verify authorized temporary hosted behavior and cleanup, then close only evidence-backed checklist items.
- Next-session cautions: No hosted resources yet; preserve protected untracked drafts, source outbox/envelopes, audit suspension and G1/G2/13.G6 state.

### 2026-10-10 — Module 09 B5 blocked, hosted cleanup complete

- Scope and checklist IDs: 09 authorized test deployment/cleanup;13.G6 remains open.
- Progress: Owned Worker/Queue/Workflow/custom-domain mappings verify zero; exact DNS inventory denied 403. Every 85 pre-existing D1 row verified with original columns, foreign keys valid; owned mutable work/singleton state removed. Two timeline/two audit records retain inactive fixture tombstones. Additive schema/history remain; R2 untouched.
- Change summary: Preserve B1–B4 acceptance; record uncommitted B5, actual Free CPU failure and scoped cleanup.
- Files/artifacts: 09 hosted receipt; private ignored backup/config/tail/cleanup receipts; bilingual Cloudflare deployment guide; [detailed B5 evidence](../evidence/09-async-validation.md#b5--minimum-prototype-and-hosted-cpu-blocker) and [safe receipt](../evidence/09-hosted-minimum-receipt.json).
- Verification: Focused local Minimum/replay-retention workerd 2, PostgreSQL retention/capability 2, Minimum capability 1, maximum multipart budget unit 1 and optimized recovery 1 pass; prior typecheck/lint/db:check/build/docs/secrets pass. Actual dispatch 15/20 ms fails required 10 ms. Final cleanup API/row/foreign-key guards pass; raw DNS inventory 403, independent absence unverified. Hosted quota exhaustion not run. Affected replay commands and limitations are in linked evidence. Final corepack pnpm docs:build, scan:secrets, scoped oxfmt --check and git diff --check pass; checklist/status/receipt/local-link/bilingual-path/empty-staging guards pass. No broad green-lane rerun.
- Decisions and deviations: Follow HANDOFF-09 “If a bound cannot be met, stop and report.” No bound/normative change, dependency addition, B5 commit, push or PR update; audit stays suspended.
- Blockers/open questions: Module09 B5 Free CPU fit. Further changes in Module08 require explicit bounded scope authorization; batching is a proposal, not a proven fix.
- Next actions: Obtain that scope decision, then resume only authorized affected implementation/verification. Final scoped formatting/document checks passed; no staged files.
- Next-session cautions: Keep B5 uncommitted and 09.1f/09.2e/09.3g/09.V6 unchecked; preserve protected drafts, baseline/append-only history and additive migrations. G1/G2 closed and 13.G6 open. Hosted owned mappings/resources are gone; ignored receipts contain private configuration and must not be staged.

### 2026-10-10 — Authorized search batching verified locally, CPU still blocked

- Scope and checklist IDs: Authorized test deployment/backup/cleanup; 13.G6 remains open.
- Progress: Fresh Worker/domain removed; no Queue/Workflow created or R2 used. Remote export rejects FTS5; logical accessible canonical backup imported with FKs/counts, triggers after records, derived FTS rebuilt. All 102 captured rows/singletons preserved; one new timeline/audit record retains inactive fixtures. TLS provisioning delayed; permission-denied certificate/DNS limitations recorded.
- Change summary: Complete the scoped investigation, retain uncommitted changes and stop hosted acceptance after the fresh CPU failure.
- Files/artifacts: D1 search-budget/search-index, shared search-contract, bilingual deployment/internal docs, [follow-up evidence](../evidence/09-async-validation.md#authorized-module08-d1-batching-follow-up--2026-10-10) and [fresh receipt](../evidence/09-hosted-minimum-batching-receipt.json).
- Verification: Focused workerd 4 / PostgreSQL 3, typecheck/lint/scoped format/diff pass; hosted profile/dispatcher results above, quota/max-body/recovery probes not run after stop. Owned API inventory zero, 102 baseline canonical rows exact, foreign keys valid, mutable fixture work absent and tail processes stopped. Final docs:build, secret scan, scoped formatting/diff, receipt/cleanup/checklist/local-link/empty-staging checks pass.
- Decisions and deviations: Preserve every contract, guard and numeric ceiling; follow repeated HANDOFF-09 stop rule. No migrations/new dependencies, paid feature, audit resume, B5/search commit, push or PR update. Raw DNS absence remains independently unverified.
- Blockers/open questions: Dispatcher22ms versus 10 ms. Candidate next direction: consolidate Minimum admission/claim/source and completion/telemetry call boundaries; needs a new user-directed decision after the stop, not a threshold waiver.
- Next actions: Final documentation/format/receipt checks are complete; report the investigation and await the next direction after the required stop.
- Next-session cautions: B1–B4 commits preserved; B5/search remain uncommitted, 09.1f/09.2e/09.3g/09.V6 unchecked, 09.3e suspended. G1/G2 closed and 13.G6 open; preserve protected drafts, accessible canonical rows/history and captured singleton state.

### 2026-10-10 — User-authorized B5 and search checkpoint publication

- Scope and checklist IDs: Commit and push the existing B5 prototype and scoped Module08 search optimization; 09.1f/09.2e/09.3g/09.V6 remain unchecked.
- Progress: User explicitly authorizes publication of the prepared implementation and evidence. Module09 remains Blocked; this checkpoint does not establish acceptance.
- Change summary: Preserve the bounded Minimum scheduler, quota/call budgets, retention migrations, search admission/source optimization, fixtures and CPU failure receipts. No new implementation or hosted activity.
- Files/artifacts: Existing B5/search changes and [Module09 evidence](../evidence/09-async-validation.md); this progress record.
- Verification: Reuse the recorded focused local/runtime checks and completed hosted cleanup; no green application lane rerun for commit preparation. Publication checks are scoped formatting, secret scan, diff hygiene and remote-ref verification.
- Decisions and deviations: The new user instruction supersedes the prior instruction to leave B5/search uncommitted. Git CLI documentation resolved and queried through Context7 (/git/htmldocs) on 2026-10-10; normal branch push only.
- Blockers/open questions: Latest actual dispatcher CPU is 22 ms against the required 10 ms; remaining hosted quota/acceptance evidence is incomplete.
- Next actions: Preserve this checkpoint; further implementation or hosted acceptance requires a new user direction after the recorded stop.
- Next-session cautions: No acceptance/checklist/gate closure, audit resume, PR edit or production deployment. G1/G2 stay closed and 13.G6 open. Exclude protected root drafts and ignored private configuration/backup artifacts.

### 2026-10-10 — Dispatcher batching verified; native Cron evidence remains open

- Scope and checklist IDs: Cross-module support for Module09 B5; authorized performance tests/refactoring, with audit suspension preserved.
- Progress: 09.2e/09.3g verified; 09.1f/09.V6 remain open because native Cron execution was not observed.
- Change summary: Owned temporary infrastructure is verified absent; original data is preserved. This evidence does not close 13.G6.
- Files/artifacts: D1/runtime batching, migration 0035, focused tests and paired reader guides; [Module09 session](09-async-and-workflows.md) and [receipt](../evidence/09-hosted-minimum-dispatcher-receipt.json).
- Verification: Focused workerd/migration/search checks, typecheck, lint, db:check, build, docs:build, scoped formatting, secrets and diff hygiene pass. Twelve explicit hosted ticks measured 1–10 ms CPU; native Cron proof remains missing.
- Decisions and deviations: No contract, permission, numeric bound, dependency or gate change; detailed probe mistakes and restorations are recorded in Module09 evidence.
- Blockers/open questions: Native Cron delivery/CPU remains unverified; registration is not execution.
- Next actions: Obtain native Cron evidence before closing the remaining checks.
- Next-session cautions: Owned resources zero; all 107 original records verified, singleton state restored, history preserved. Protected drafts/private backups excluded; no push or PR edit for this batch.

### 2026-10-10 — Native Cron dispatch verified but CPU bound failed

- Scope and checklist IDs: Module09 09.1f/09.V6 native scheduler verification under existing test authorization; audit remains suspended.
- Progress: Real native delivery, canonical indexing and acknowledgement observed. Productive native tick measured 20 ms against the required 10 ms CPU bound; 09.1f/09.V6 remain open.
- Change summary: Isolated provider delivery with a scheduled-only Worker, then tested the unchanged Minimum function on the same Worker. No application code, contract, dependency or migration change.
- Files/artifacts: [Native evidence](../evidence/09-async-validation.md#native-scheduler-diagnostic-and-dispatch-cpu-failure--2026-10-10), [safe receipt](../evidence/09-hosted-native-scheduler-receipt.json), internal/paired reader guidance and status records; private helpers remain ignored.
- Verification: Native witness 0 ms, empty dispatch 7 ms, canonical dispatch 20 ms; final index revision 1, source acknowledged, delivery attempts 1. Owned resources zero and tail stopped; all 115 original records/columns and captured singleton state verified, foreign keys valid, original two Workers/domains preserved. Final docs:build, secrets, receipt/cleanup/checklist/link guards, JSON serialization and diff hygiene pass. Scoped oxfmt had no eligible files because repository ignore rules exclude docs; no application lane rerun for this documentation-only session.
- Decisions and deviations: Stop after CPU failure under HANDOFF-09. Fixed probe dispatch phase protects original expired identity rows; seed request CPU is outside async acceptance. No paid feature, threshold waiver, audit resume or gate closure.
- Blockers/open questions: Native dispatch CPU exceeds the bound; earlier missing native delivery cause remains unknown.
- Next actions: Report the measured failure; a new user direction after the HANDOFF-09 stop is required before further performance implementation or hosted acceptance. Native CPU profiling is the next proposed investigation. Preserve 09.2e/09.3g and Module08's existing dispatch/retry closure.
- Next-session cautions: No further hosted probe/refactor after the failure. Keep original data/history and committed batches; retained inactive fixture has one timeline/one audit record. Raw DNS absence unverified, custom-domain mapping absent. No push or PR edit; G1/G2 closed and 13.G6 open.

### 2026-10-11 — Metering and initialization profiling checkpoint

- Scope and checklist IDs: Authorized Module09 B5 09.1f/09.V6 performance continuation and affected integration seams; no audit resume.
- Progress: Direct metering facades, phase-specific factory construction, internal async exports and deferred upload configuration locally verified. Native r4 produced no event within its bounded window; CPU acceptance remains open.
- Change summary: Preserve SQL, existing handlers, permissions, quotas and numeric limits. Keep default package entries and adapter imports; no lint exemption, dependency or migration.
- Files/artifacts: Minimum composition/meter, internal application/D1 async entries, unit coverage; [profiling evidence](../evidence/09-async-validation.md#authorized-cpu-profiling-continuation--2026-10-11), [r4 receipt](../evidence/09-hosted-native-meter-retry-receipt.json).
- Verification: Unit meter 3, search availability 28, workerd queue/workflow/Minimum 5 pass; typecheck, lint/boundaries, build and final Minimum target build, scoped format, secrets, docs build and diff pass. Local CPU/startup sampling is diagnostic only. R4 cleanup verifies 120 original records, foreign keys, singleton state, original two Workers/mappings and zero owned resources/work; live processes terminal.
- Decisions and deviations: Human approval permits continued bounded attempts after failures. Reverted lint-rejected internal adapter/contract paths rather than adding exclusions. Fixed copied fixture missing IDs only after proving no writes; TLS readiness and OAuth refresh handled. No native execution/CPU inferred from handlers, registration or local timing.
- Blockers/open questions: Latest productive native evidence remains 20 ms against 10 ms. Missing native delivery on r4 is unexplained.
- Next actions: Preserve the verified refactor; test the compiled module graph and final-binding Cron registration using a fresh owned attempt with cleanup.
- Next-session cautions: 09.1f/09.V6 open; 09.2e/09.3g and Module08 closure preserved; 09.3e suspended; G1/G2 closed and 13.G6 open. No push/PR edit. Exclude protected root/private helper files.


### 2026-10-11 — Native admission result and cursor consolidation

- Scope and checklist IDs: Authorized Module09 09.1f/09.V6 performance continuation and Module08 indexing seam.
- Progress: Native r6 canonical dispatch took 14 ms CPU and still fails 10 ms; source indexed/acknowledged once. Cleanup verified before continuing. Consolidated cursor initialization and advancement reduces canonical work from eleven to ten SQL statements, preserving three provider round trips.
- Change summary: Missing cursors use the existing zero prefix; one gated UPSERT initializes/advances or resets both bounded source cursors. Admission refusal retains all state. No lease, retry, quota, authorization or index contract changes.
- Files/artifacts: D1 Minimum adapter and admission suite; [r6 receipt](../evidence/09-hosted-native-admission-retry-receipt.json), [detailed evidence](../evidence/09-async-validation.md#native-admission-result-and-cursor-consolidation--2026-10-11).
- Verification: Focused Minimum workerd seven tests, typecheck, lint/boundaries and build pass. r6 preserved 130 baseline rows, singleton values, foreign keys and original two Workers/mappings; all owned resources/mutable work removed and processes terminal. No unchanged PostgreSQL lane rerun.
- Decisions and deviations: Human now permits raising the project target and reducing Minimum capacity after repeated measured optimization failures. No target/capacity change applied yet. Context7 Workers resolve/query (2026-10-11) explicitly lists Free Cron CPU 10 ms; higher internal targets cannot establish provider acceptance. Native r6 arrived after the monitor deadline; tail/state prove execution. During continuation gap it emitted harmless empty ticks before cleanup.
- Blockers/open questions: 09.1f/09.V6 remain open; 09.3e suspended, G1/G2 closed, 13.G6 open.
- Next actions: Bounded fresh r7 native retry against the ten-statement path with independent backup and cleanup; measure representative size/recovery only after canonical fit.
- Next-session cautions: No push/PR edit; preserve history and baseline data. Do not rerun inventory after seeding. Higher project CPU target must not rewrite provider limits or imply full Free acceptance.


### 2026-10-11 — Ten-statement native retry running

- Scope and checklist IDs: Authorized Module09 09.1f/09.V6 performance continuation; no target/capacity change yet.
- Progress/change summary: f0c9a1d committed locally. Fresh r7 backup, native-only Worker, canonical producer fixture and one Cron are ready; tail confirmed live. Source pending; observation/cleanup are in progress.
- Files/artifacts: [Detailed retry/profile record](../evidence/09-async-validation.md#native-r7-in-progress-and-coldwarm-diagnostic); ignored r7 and cold-profile helpers.
- Verification: Reuse seven workerd checks and passed typecheck/lint/build/docs/secrets/scoped format/diff. Twenty cold/warm local isolate profiles provide diagnostic initialization evidence; not hosted acceptance. REST producer fixture used after custom-domain TLS readiness failure; no explicit tick or public API acceptance.
- Decisions/deviations: Native observation 65 minutes, automatic owned cleanup on CPU failure or absolute 70-minute bound. Credentials refreshed before watchdog cleanup; no numeric runtime limit changed. Standing user permission allows lower Minimum capacity and higher project target if repeated optimization still fails; provider 10 ms remains independently disclosed.
- Blockers/open questions: Native r7 result and cleanup pending; 09.1f/09.V6 open.
- Next actions: Collect live native result; if fit, representative body/recovery proof; if failed, verify cleanup before measured capacity reduction. Every attempt must finish cleanup.
- Next-session cautions: Owned Worker hyperbug-09-native-219f58b807f6, tail session1863, monitor87992; watchdog restarted after adding credential refresh. Deadline 19:39:09 UTC, cleanup bound19:44:09 UTC. Preserve 135 baseline records; no inventory rerun, push/PR edit or gate/audit changes.


### 2026-10-11 — Refined cold-binding investigation during native wait

- Scope/checklist IDs: Authorized 09.1f/09.V6 and affected Module08 seam; no application or normative change.
- Progress/change summary: Confirm r7 monitor/tail/watchdog live, one Cron, pending canonical state. Private staged-import prototype showed no clear local gain and is unapplied. Refined local measurement includes first D1 binding use by seeding outside the Worker.
- Files/artifacts: [Detailed investigation](../evidence/09-async-validation.md#native-r7-waiting-and-refined-cold-cost-investigation--2026-10-11), safe profile aggregates; private prototypes ignored.
- Verification: Twenty fresh local isolates per diagnostic, actual canonical producer and D1 emulation; source/index acknowledgements observed locally. Not hosted CPU acceptance. Current Context7 trace enablement lookup records no default tracing and no substantiated benefit from disabling it. No green application lane repeated.
- Decisions/deviations: Preserve current ten-statement deployment and all limits while native outcome is pending. User permits measured target/capacity revision after repeated failure; any higher project target must disclose unchanged provider 10 ms and retain recovery/backlog/security. No target or logging waiver applied.
- Blockers/open questions: Native execution/CPU/cleanup pending. Module09 open, 09.3e suspended; G1/G2 closed, 13.G6 open.
- Next actions: Revalidate native handles and canonical state; collect r7 CPU or absolute timeout cleanup. After failure verify cleanup before capacity/target work; after fit run prepared representative/recovery checks.
- Next-session cautions: Tail 1863, monitor 87992, watchdog 20221; r7 deadline 19:39:09 UTC, automatic cleanup 19:44:09 UTC or earlier failure. Read ignored live-handles.json. Watchdog captures canonical state before restoring data. Do not restart because observation expired or rerun inventory; no push/PR edit.


### 2026-10-11 — Maximum-content title-only capacity prototype

- Scope/checklist IDs: Authorized 09.1f/09.V6 performance continuation and conditional Module08 capacity alternative.
- Progress/change summary: Private maximum-content prototype verifies smaller index/source payload and lower cold local samples for title-only work. No production source, target or capacity change. r7 remains a verified live wait.
- Files/artifacts: [Detailed measurements and limitations](../evidence/09-async-validation.md#maximum-content-title-only-prototype--2026-10-11), safe profile aggregates; private prototype ignored.
- Verification: Twenty fresh actual local workerd/D1 isolates per full-text/title-only variant; canonical maximum 200-title/32768-body producer, current index revision 1 and 5,562-byte versus 2-byte body inspected. No native acceptance; sequential sparse profiles are not a controlled speedup. No broad green lane repeated.
- Decisions/deviations: If native r7 fails, title-only is a measured fallback candidate; implement query/readiness/version/cursor/rebuild/disclosure consistently before deployment. User permits higher project target with reduced Minimum capacity after repeated failure; provider 10 ms stays separate and release gates remain open.
- Blockers/open questions: Native r7 CPU/cleanup pending; no fallback activated.
- Next actions: Inspect native monitor 87992/watchdog 20221 and canonical state; verify cleanup before a failed-trial fallback, or complete representative/recovery tests after fit.
- Next-session cautions: Preserve source f0c9a1d trial, unchanged standard contracts and all security/lease/quota checks. Do not ship private title-source suppression without production mode safeguards; no inventory rerun, push/PR edit or audit/gate closure.

### 2026-10-11 — Coherent Minimum title-only capacity implementation

- Scope and checklist IDs: Authorized 09.1f/09.V6 performance continuation, Module08 capacity reduction and affected contract/acceptance checks.
- Progress/change summary: Minimum source/index/query now use titles only with distinct readiness identity and cursor policy 2; Standard retains full text. Bounded bidirectional reconciliation preserves canonical data. Instance capability and paired reader disclosure updated. Native r7 remains on full-text f0c9a1d; no target change or hosted fallback yet.
- Files/artifacts: Search adapters/application/capability contracts and tests, [ADR 0014](../../decisions/0014-minimum-title-search.md), [detailed evidence](../evidence/09-async-validation.md#coherent-minimum-title-only-implementation--2026-10-11), safe profiles and bilingual guides.
- Verification: Workerd 19, unit 34, corrected focused PostgreSQL 14 and shared async workerd three pass; typecheck/lint/boundaries/build/docs/secrets/scoped format/diff and foundation contract pass. Accidental broad PostgreSQL run had 208 pass/four failures/two existing skips; relevant capability, sidecar table-count and claim fixture expectations fixed and focused regressions pass. Broad matrix not repeated/claimed green. Twenty current-production local cold/warm profiles verify empty indexed body; median cold 6,938.5 microseconds is diagnostic only.
- Decisions/deviations: Human authorizes this reduced capacity after repeated native failures. ADR records review and upgrade/downgrade behavior. No canonical truncation, quota/security relaxation, schema or dependency change. Internal/project CPU target remains 10 ms; provider limit independently unchanged.
- Blockers/open questions: r7 native outcome/cleanup pending; 09.1f/09.V6 open.
- Next actions: Collect native r7; verify cleanup, then fresh bounded title-only native measurement and representative recovery.
- Next-session cautions: r7 tail 1863/monitor 87992/watchdog 20221; deadlines 19:39/19:44 UTC. Preserve 135 baseline rows; no inventory rerun, push/PR edit, protected/private staging or audit/gate closure.

### 2026-10-11 — Native propagation investigation and title-trial preparation

- Scope/checklist IDs: Authorized 09.1f/09.V6 native performance continuation; 13.G6 evidence dependency.
- Progress/change summary: f6a1e9e commits coherent title-only capacity reduction locally. r7 remains pending beyond the documented propagation period; no new native CPU result or target change. Next title-only maximum-content/quota trial is prepared privately, not deployed.
- Files/artifacts: [Propagation/preparation record](../evidence/09-async-validation.md#native-propagation-investigation-and-prepared-next-trial); ignored r7 comparison/receipt and r8 producer helpers.
- Verification: Context7 Workers resolve/query (2026-10-11) documents up to 15-minute schedule propagation, 30-minute new-Worker history display lag and empty-versus-omitted Cron deployment semantics. Provider registration/tail read at 19:26:56; source pending at 19:21:05, no native tail event by 19:35:28. Reuse f6a1e9e application checks; no unchanged lane repeated.
- Decisions/deviations: Retain the original bounded wait and independent automatic cleanup. No CPU inference, unbounded retry or new resource creation.
- Blockers/open questions: Native scheduling delay unexplained; r7 outcome/cleanup pending; 09.1f/09.V6 open.
- Next actions: Collect monitor/watchdog; verify cleanup and original resources using prepared helpers; publish safe receipt. Only then fresh r8 backup/inventory, committed-source build and maximum-content native trial.
- Next-session cautions: r7 tail 1863/monitor 87992/watchdog 20221; absolute deadlines 19:39:09/19:44:09 UTC. Preserve 135 baseline records and singleton values. Do not rerun r7 inventory, deploy r8 before cleanup, stage private/protected files, push/PR edit or resume audits/close gates.


### 2026-10-11 — R7 cleanup and active maximum-content title trial

- Scope/checklist IDs: Authorized 09.1f/09.V6 continuation; 13.G6 evidence dependency.
- Progress/change summary: R7 unobserved timeout fully cleaned and preserved; R8 title-only maximum-content native trial active. No new CPU result or target change.
- Files/artifacts: [Detailed trial record](../evidence/09-async-validation.md#r7-timeout-cleanup-and-active-title-only-r8-trial--2026-10-11), [R7 receipt](../evidence/09-hosted-native-cursor-retry-receipt.json); ignored R8 helpers and local phase-4 profiler.
- Verification: R7 135 baseline records/original two Workers/mappings/FKs/singletons preserved, owned resources/work zero and all processes terminal. R8 fresh 140-record backup, max200-title/32768-body producer, registered handlers/deployment/one Cron and live processes verified. Source still pending at20:11 UTC; no scheduled history at20:13 UTC. Docs build, secrets, scoped formatting and diff hygiene pass; no repeated green application lane.
- Decisions/deviations: Current Context7 lookup and focused provider schema introspection document separate live/history evidence; no execution inferred from registration. Standing human retry/capacity authorization persists.
- Blockers/open questions: Native scheduling delay unresolved; CPU fit/recovery remain open. Latest productive native result14 ms; project/provider target10 ms.
- Next actions: Collect R8 native outcome or bounded cleanup; after fit preserve maximum result and exercise quota/job restart; after failure verify cleanup before further measured optimisation.
- Next-session cautions: Tail10791/monitor11882/watchdog4672; observation20:55:15, cleanup21:00:15 UTC2026-10-10. Check watchdog before any mutation; no inventory rerun, protected/private staging, push/PR edit or audit/gate closure.
