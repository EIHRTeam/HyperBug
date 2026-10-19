# 12 progress — Public feedback, discussion, and staff web workflows

Plan: [Detailed checklist](../modules/12-web-product-workflows.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete
- Delivery scope: MVP frontend
- Prerequisites: 11 complete; only consume capabilities accepted in 10.
- Implementation started: Yes, under the user's 2026-10-18 Module 12 instruction.
- Completed checklist IDs: All 24 — 12.1a–d, 12.2a–g, 12.3a–f and 12.V1–V7.
- Active/next checklist group: None; Module 12 complete. See the [final evidence map and handoff](../evidence/12-completion.md).
- Last updated: 2026-10-19.
- Blocking issues discovered: G1 remains Not passed; Module 10 hosted acceptance remains incomplete. The current request permits Module 12 implementation/local verification, not new hosted load or a G1 acceptance claim. Module 12 audit browsing was explicitly resumed and is exercised locally.
- Evidence: [Local browser checkpoint](../evidence/12-browser-acceptance.md), profile JSON reports, bundle inventory and the entries below.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 12.1 | Implement discovery and navigation | Complete | URL/cache tests and three-profile browser discovery/search/back/share/reload |
| 12.2 | Implement Issue submission and discussion | Complete | Final 37/37/38 workflow checks, actual uploads and measured 1,000-comment discussion |
| 12.3 | Implement triage and administration | Complete | Real permission/conflict/step-up/settings/form/audit/plugin/session journeys and focused review |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

No Module 12 work remains. Use the [completion handoff](../evidence/12-completion.md) for subsequent authorized work; G1, Module 10 and 13.G6 remain unchanged.

## Next-session cautions

The manual fixture is stopped and its URL is obsolete. Scanner signatures expire under normal policy. Preserve memory-only credentials/drafts, server authorization and transported safe-tree rendering. Protected root drafts remain uncommitted. Local acceptance does not establish hosted/backend/provider/release gates or authorize later modules.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 12; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for public feedback, discussion, and staff web workflows.
- Files/artifacts: `docs/plan/modules/12-web-product-workflows.md`; `docs/plan/progress/12-web-product-workflows.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 12.1.
- Next-session cautions: Do not make UI visibility an authorization control. Preserve drafts during recoverable failures without persisting credentials or leaking one user's data to another.

### 2026-09-20 — Degradation notice required in the product UI

- Scope and checklist IDs: Planning only. Added 12.3f and 12.V7. No implementation item was completed or checked.
- Progress: Recorded the mandatory minimum-tier degradation notice (accessible, persistent status or footer entry with per-session dismissal linking to operator documentation) and explained non-actionable states for unavailable capabilities.
- Change summary: Extended the module plan and its source-coverage pointer; existing accessibility, CSP and permission requirements are unchanged.
- Files/artifacts: `docs/plan/modules/12-web-product-workflows.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No browser journey ran.
- Decisions and deviations: The notice must not imply Argon2id protection or any capability the instance lacks.
- Blockers/open questions: 12.V7 depends on 11.1g, 04.2g and a running minimum-tier instance.
- Next actions: Continue 12.1–12.3 in order; add the notice with the administration surfaces.
- Next-session cautions: UI visibility is never an authorization control, and dismissal must not remove the permanent status entry the specification requires.


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

- Scope and checklist IDs: Product-web planning only; no implementation item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior workflow planning text; no product UI was created.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: G1 and frontend prerequisites remain open.
- Next actions: Do not start Module 12 during the feature hold.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-18 — Product workflow start and contract inventory

- Scope and checklist IDs: User-directed Module 12 continuation; initial batch 12.1a–d and shared capability disclosure for 12.3f. No later module or hosted traffic.
- Progress: Read module/dependency progress, execution protocol, development/frontend/security/testing references and actual SPA/client/contracts. Module 11 is complete at its recorded scope; G1 and Module 10 remain unmet. Protected untracked user drafts/handoffs are preserved.
- Change summary: Opened this module under the current request. Existing contracts support bounded search, taxonomy, issues, forms/templates, upload/multipart, comments/history, reactions, mixed timeline, roles, sessions and plugin management. No project-directory, issue-number resolution, unsaved-content preview or audit-browsing operation exists in the public client.
- Files/artifacts: This record; master status; upcoming frontend source and focused evidence.
- Verification: Read-only inventory completed; implementation checks pending. Context7 resolve/query retrieved TanStack Query, Router and Form current docs (2026-10-18). Modern-web-guidance search and retrieve covered forms, IME safety and coordinated validation; installed skill-version warning retained, current content fetched successfully.
- Decisions and deviations: Current user request extends the frontend sequencing exception to Module 12 without passing G1 or authorizing hosted load. Use existing accepted contracts first; explicit project selection and ID/number links avoid inventing directory/lookup operations. No new dependency or normative policy change.
- Blockers/open questions: Explicit audit resume decision requested asynchronously; held work stays suspended. Server-derived unsaved preview and audit browser contracts need a bounded prerequisite decision before dependent UI. Three-profile hosted acceptance and manual accessibility evidence cannot be inferred from local automation.
- Next actions: Implement and verify discovery; then submission/discussion and non-audit administration. Keep every incomplete or partially verified item unchecked.
- Next-session cautions: Never persist tokens or private drafts; use identity-bound Query cancellation; no client Markdown parser/sanitizer/HTML sink, new hosted request, paid resource, push, merge or draft commit.

### 2026-10-18 — Initial implementation and backend prerequisite checkpoint

- Scope and checklist IDs: 12.1a–d, partial 12.2a–f/12.3a–f. User explicitly resumed Module 12 audit browsing in this chat. Acceptance remains pending.
- Progress: Added lazy project/list/create/detail/manage/plugin routes, identity-partitioned cancellable Query requests, URL-bound bounded search, taxonomy summaries, memory-only Form drafts and receipt reuse, transported-tree rendering, cursor-window timeline/permalinks, direct/multipart upload protocol and exact-origin transfer guards, triage/settings/roles/content/plugin/session controls, and persistent Minimum status with per-session detail dismissal.
- Change summary: Added the necessary bounded server-derived preview and redacted project-Administrator audit HTTP contracts, shared routes and production-root composition. [Contract record](../evidence/12-workflow-contracts.md) states permissions, quotas, fields, CSP and limits before dependent UI. No migration/dependency/provider change.
- Files/artifacts: `apps/web/src/{product-state,product-api,uploads,issue-form-values}.ts`, product components/routes and CSS; public runtime/upload-origin CSP; contracts/server/Node/Workers composition and generated client/OpenAPI; shared HTTP and focused unit fixtures.
- Verification: Web typecheck/lint/build passed before final controls; workerd/D1 issue route suite now passes 2 tests including preview/audit/permission/pagination cases. PostgreSQL rerun pending; existing auth/foundation 11 unit checks pass. New unit suite initially failed root resolution of frontend-only Query; fix pending. First HTTP runs exposed an unavailable new rate category and strict query numeric transport; corrected to the existing shared comment/preview budget and bounded numeric-string contract. Test ordering/policy-replacement fixture errors were corrected; no acceptance was claimed from failed runs.
- Decisions and deviations: Explicit public `uploadOrigins` adds only exact configured storage destinations to CSP, alongside isolated media connection origins; credentials never reach upload storage. Preview is explicit and consumes the existing comment content-work budget (120/2,400 per hour); no new category/migration. Audit HTTP DTO excludes metadata and request IDs and uses existing canonical read service/cursors with current credential facts and fresh before/after authorization.
- Blockers/open questions: Browser journeys, all profile composition, actual upload recovery/release/download, form preview, stale editing, accessibility/manual evidence and performance remain unverified or incomplete. Hosted backend/Free acceptance and G1 remain unchanged.
- Next actions: Finish backend prerequisite verification, then expose preview/audit controls; strengthen failure/concurrency/draft recovery; run actual browser journeys, focused security/performance review, bilingual guides and acceptance evidence.
- Next-session cautions: Untracked user drafts remain protected. Do not infer completion from the broad first implementation or mocks. No hosted traffic, push/merge or later-module work; keep partial checkboxes unchecked.

### 2026-10-18 — Browser QA and first-party administration recovery

- Scope and checklist IDs: Ongoing Module 12; explicit audit resume recorded in the canonical plan and suspension register. Necessary Module 04/07/10/11 prerequisites remain within this increment.
- Progress: Anonymous real Node/PostgreSQL browser discovery/search/pagination/back, safe-tree rendering and a 1,000-comment bounded timeline/permalink/focus/mobile slice run. Public User actual form preview/create/comment/reaction and ambiguous post-commit receipt retry advanced through the browser flow. Full matrix remains incomplete. Native passkey controls are being added to the authorization origin under [ADR 0016](../../decisions/0016-first-party-passkey-step-up-controls.md), preserving assurance 2 for sensitive administration.
- Change summary: Corrected single-select answer strings versus multi-select arrays, input bounds, duplicate accessible search naming, content heading hierarchy, identity/path-keyed drafts, immutable edit baselines and explicit discard/reload recovery. Added explicit isolated raster preview/download transport, current media checks, and no token transfer to storage. English/Chinese issue guides were synchronized with implementation and verification limits.
- Files/artifacts: New frontend components/routes, `web-product-local.ts`/`web-product-browser.mjs`, ADR 0016, fixed first-party passkey asset/optional page controls, preview/audit schemas/routes, media headers, bilingual issue guide, scope/handoff records.
- Verification: Current local HTTP issue-route suites pass workerd/D1 2/2 and PostgreSQL 2/2 including safe previews, stale form versions, redacted Administrator audit, cursor bounds/isolation and dangerous HTML media. Focused frontend 16/16 and public-contract 2/2 pass; root lint/boundaries and secret scan pass before the newest passkey patch. Production builds pass with separate create/detail/manage/triage/audit/plugin chunks. Browser failures were retained and fixed; no full-persona or manual acceptance claim yet. Browser plugin skill unavailable; existing Playwright/Chrome used. Current Cloudflare/Miniflare and SimpleWebAuthn docs were resolved and queried.
- Decisions and deviations: Password-only administration is correctly denied; repeating password login is not advertised as step-up. Passkeys stay on the authorization origin and use existing verified APIs, exact self CSP and validated PKCE consent. Local seed credentials now use a distinct registered fixture client; actual product personas stay within the unchanged five-per-hour client token budget. No limit reset/raise or hosted request. Fixture indexing applies existing bounded per-issue tasks only to stale rows rather than repeatedly reserving a full Minimum backfill budget.
- Blockers/open questions: Complete first-party passkey browser verification, all three local profile/persona journeys, real upload/media browser recovery, remaining failure states, measured performance and manual WCAG checks. G1/hosted backend/Free billing acceptance remain unchanged.
- Next actions: Finish actual browser QA and targeted regressions, review security/performance paths, synchronize remaining reader and engineering docs, then evidence-backed checklist closure.
- Next-session cautions: Protected drafts/handoffs remain untouched. Temporary browser screenshots and safe failure text are outside the repository; private fixtures clean up listeners, clusters and key files on normal completion/failure. Do not mark a failed/partial browser run as acceptance.

### 2026-10-18 — Draft recovery and expanded acceptance checkpoint

- Scope and checklist IDs: 12.2a–f, 12.3a–d, 12.V2–V5; ongoing authorized local Module 12 work.
- Progress: Prior complete local core browser reports are present for Node, Standard and Minimum. Extended acceptance is running; no new checklist closure yet.
- Change summary: Unique React IDs now coordinate all editor/command/form labels, hints and summaries, including multiple comment controls. Content/form answers lock during pending and ambiguous submissions. Issue/comment editors refetch before opening and offer explicit discard/reload recovery. Upload groups retain a focusable, named validation target even when unavailable. Taxonomy management now includes label color, type description/icon/color/order and milestone due dates.
- Files/artifacts: Frontend editor/command/form/upload/comment components and issue/manage routes; extended `web-product-local.ts` and `web-product-browser.mjs` fixtures.
- Verification: Production SPA build and root typecheck pass after the draft changes; latest lint passes. Expanded browser runs are ongoing: corpus fixtures use the actual API, all 20 representations render, and all 9 rejected bodies are rejected; first harness assertion incorrectly counted anchors whose unsafe href had correctly been removed and was fixed. Initial form failure injection ran before valid fields and was moved after preview. Neither failed run replaces the previous passing reports.
- Decisions and deviations: Context7 React resolve/query (2026-10-18, `/reactjs/react.dev`, useId). Modern-web search/retrieve: `forms`, `required-field-feedback`, `accessible-error-announcement`, `ime-safe-enter-submit`; current content fetched despite older installed skill-version warning. Native controls, fieldsets/legends, ARIA-describedby and coordinated interaction state preserve Baseline Widely Available. No custom textarea Enter submission; normal newline/native IME behavior is retained. Generic SSR/cookie/client-sanitizer recommendations remain inapplicable under the static/token/server-tree policy.
- Blockers/open questions: Actual upload/media browser release/recovery, full positive administration, revocation/permission failures, manual accessibility, final performance/security review and bilingual documentation remain open.
- Next actions: Complete the extended browser fixture on Node, Standard and Minimum, then add actual upload/media acceptance and remaining failure paths.
- Next-session cautions: Keep G1 Not passed, Module 10 Blocked and 13.G6 open. Preserve protected user drafts. No hosted traffic, paid resources, push, merge or later-module work.


### 2026-10-18 — Three-profile recovery and administration acceptance

- Scope and checklist IDs: 12.1a–d, 12.2a–g, 12.3a–f and 12.V1–V7 at their recorded partial/complete scopes. Goal remains active.
- Progress: Latest production-build browser runs pass Node 31 checks, Standard 31 and Minimum 32. Verified actual concurrent comment/form changes, offline/post-commit loss receipts, revoked bearer during a draft, removed triage role, all four assignments, moderation/history, full taxonomy fields, template replacement, settings/roles, audit, secret configuration, plugin enable/disable, and separate authorization-session/app sign-out. Full corpus: 20 transported trees rendered, 9 invalid inputs rejected.
- Change summary: Added accessible generated IDs, pending/ambiguous value locks, issue/comment/form discard/refetch controls, title-error associations/focus, unavailable-upload group semantics and complete taxonomy fields. Fixed absent controls for declared-but-unset plugin settings by merging validated declarations with redacted stored rows. Clarified separate first-party session and app token revocation. Synchronized account/project/frontend-hosting guides in English/Chinese and updated engineering frontend/research guidance.
- Files/artifacts: Frontend components/routes, extended local/browser fixtures, bundle collector; [acceptance record](../evidence/12-browser-acceptance.md), three profile reports and [bundles](../evidence/12-bundles.json). Screenshots/failure diagnostics remain outside the repo. Owned fixture processes/private files were removed after every completed/failed run.
- Verification: Latest browser commands use Node 24.21.0/PostgreSQL 18.6 or native local workerd/Miniflare/D1 and Chrome 155.0.8059.80. Focused unit 18/18, contracts 2/2, workerd HTTP 2/2, PostgreSQL HTTP 2/2 pass. Production build, api:check (77 paths), typecheck, lint/boundaries, secret scan, docs build and diff whitespace checks pass at checkpoints; final scoped source formatting was applied without touching protected root drafts. See acceptance record for failures and limits.
- Decisions and deviations: No policy weakening/dependency/migration. The fixture initially omitted Worker envelope-KEK registry state and correctly failed secret configuration closed; the registry is now seeded. A test incorrectly assumed session revocation cascades to independently issued app tokens; it now tests the two accepted revocation paths separately and the UI/docs explain them. Prior failures do not count as acceptance. Browser skill is unavailable; frontend-testing-debugging's ordinary Playwright fallback is recorded.
- Blockers/open questions: Actual upload/media browser release/recovery/scanner states, explicit expiry and remaining moderation/form/issue failure paths, automated/manual WCAG evidence and final focused security/performance review remain open. Observer layout-shift sums/event timings are diagnostic and cannot close 12.V6; isolate CLS and investigate observed nonzero shifts. G1/Module 10/13.G6 unchanged.
- Next actions: Start with the actual upload/media lane; inspect existing ignored ClamAV snapshot/freshness and storage/scanner constructors before composing disposable fixtures. Then finish remaining browser/accessibility/performance/review evidence. No manual product accessibility confirmation has been requested or received.
- Next-session cautions: Protected SECURITY.md/design/performance/handoff drafts remain untouched/uncommitted. No live browser fixtures remain at this checkpoint. Runtime ports are disposable; never reuse old URLs. No hosted traffic, paid resources, push, merge or later-module work. Keep partial checklist items open and do not relabel old Module 07 provider evidence as product-browser acceptance.

### 2026-10-18 — Actual local upload acceptance start

- Scope and checklist IDs: 12.2c, upload portions of 12.2a/12.V2/12.V5, and necessary existing Module 07 fixtures. Goal remains active.
- Progress: Inspected current upload/media code and actual local fixtures. Existing ClamAV daily 28142 (October 3) is stale under the unchanged 48-hour bound. A private one-shot official update succeeded; the unchanged scanner constructor independently verified the new immutable daily 28157/main 63/bytecode 339 snapshot with ClamAV 1.5.4.
- Change summary: Added a disposable actual-scanner upload browser lane, fresh-capability renewal for direct and multipart transfers, actionable quota/expiry copy and scan-state disclosure. Initial local S3-emulator setup failed because PutBucketCors is unimplemented. The lane now selects the existing genuine SeaweedFS 4.48 launcher, installs and reads back exact CORS, and retains explicit provider distinctions. Browser acceptance is running, not yet passed.
- Files/artifacts: `web-upload-services.ts`, `web-upload-browser.mjs`, upload-enabled `web-product-local.ts`, frontend transfer/status/error code. Ignored `.local/12-scanner-refresh/` contains a new updater directory and independently fenced snapshot; original Module 07 snapshot is preserved. SeaweedFS release archive SHA-256 matches the official digest `faa194e72a346755dc4404288b0561eb3c260351702901d8363024d5099bdd7d`; only its executable is extracted into `/tmp`, with no system install.
- Verification: Root typecheck/lint and production SPA build pass. New browser lane is pending. Freshclam exit 0, database load test and scanner constructor evidence pass. No stale database, custom signature set, freshness relaxation or synthetic clean verdict is used for this lane.
- Decisions and deviations: Context7 resolve/query (2026-10-18): ClamAV `/websites/clamav_net`, Workers `/cloudflare/workers-sdk` after direct Miniflare resolution returned no result, AWS SDK `/aws/aws-sdk-js-v3`. Exact pinned options/directives come from installed types/manuals and runtime checks. Modern-web search/retrieve `progress-ring,forms`; retain native progress/status/fieldset controls, omit Limited Availability ring styling/new custom-property dependencies. Generic wildcard CORS examples are replaced by existing canonical exact-origin rules. Official tooling/signature downloads are distinct from prohibited hosted backend load; no backend deployment/provider test request occurred.
- Blockers/open questions: Complete actual Node browser upload/retry/cancel/quarantine/release/download first, then compose Standard/Minimum browser coverage without substituting emulator policy or claiming production R2/scanner acceptance. Remaining accessibility/performance/review requirements stay open.
- Next actions: Resolve any actual browser failures and record the final provider/scanner scopes; retain all Module 07 production remainders and G1/13.G6.
- Next-session cautions: Scanner snapshot expires under its normal 48-hour policy and is intentionally not auto-updated. New private control endpoints exist only in disposable test runners. Do not copy fixture controls into production or persist capability URLs/bearers in reports.

### 2026-10-19 — Upload acceptance and explicit reload recovery

- Scope and checklist IDs: 12.2c, 12.V2, 12.V5; accessibility/failure portions of 12.2/12.3/12.V3–V4. Goal remains active.
- Progress: Actual upload/media checks pass Node 11, Standard 10, Minimum 10. Core workflows pass Node 31, Standard 31, Minimum 32 after a false-conflict reload race was fixed. The three named checklist items close at local product scope. Manual WCAG, remaining workflows/failure checks and final performance/security review stay open.
- Change summary: Expiry renewal, useful scan/quota/expiry states, canonical ordinary attachment links and safe-tree task-checkbox names. Explicit triage/manage/issue/comment reload uses fetched snapshots rather than observer render timing. Drafts survive background changes. Cleanup attempts every owned resource and preserves primary errors; manual stop endpoint verified.
- Files/artifacts: [Upload evidence](../evidence/12-upload-acceptance.md), three upload reports, three axe reports, [core acceptance checkpoint](../evidence/12-browser-acceptance.md), frontend components/routes, disposable fixtures, FRONTEND guidance and synchronized hosting reader pages.
- Verification: All three browser/axe profiles pass; nine axe surfaces per profile have zero violations, with native control/dialog contrast incompletes still requiring review. Root typecheck/lint/boundaries pass; focused state/passkey tests 7/7; final-build bundle graph collected. Docs/secret/final checks still pending. A first snapshot fix froze close/reopen and failed; corrected before the passing matrix. One manual replacement failed before readiness; later replacement reached both windows and the user confirmed visibility, testing in progress. No human accessibility pass received.
- Decisions and deviations: Context7 `/tanstack/query` resolve/query and modern-web action search/retrieve `validate-input-after-interaction,accessible-error-announcement` (2026-10-19); native Widely Available controls and coordinated Form/ARIA states retained. Provider limits and fresh ClamAV signatures are explicit in upload evidence; no production R2 policy/signing claim.
- Blockers/open questions: Await actual manual observations; continue independent performance, failure and focused security review. G1 Not passed, Module 10 Blocked, 13.G6 open.
- Next actions: Record human observations, finish remaining failure/management paths and measured performance/security review, then reconcile final checklist/docs.
- Next-session cautions: A live headful manual fixture owns disposable Chrome windows and local Node/PostgreSQL/Seaweed services; stop only after human testing via its printed local `/manual/stop` endpoint. Its current options are private under the fixture directory. Do not rebuild/remove shared dist while it is live. No hosted traffic/paid resources/push/merge/later module work; protect untracked root drafts.

### 2026-10-19 — Human accessibility acceptance

- Scope and checklist IDs: 12.V4.
- Progress: User confirmed both disposable Chrome windows visible, tested them and explicitly reported all requested 12.V4 checks pass. Canonical checkbox marked complete.
- Change summary: Recorded human acceptance separately from automated nine-surface/zero-violation axe reports per profile and retained the lack of separately supplied assistive-technology version details. Native contrast incompletes receive the user's requested visual/contrast pass, not a fabricated axe result.
- Files/artifacts: [Human accessibility acceptance](../evidence/12-browser-acceptance.md#human-accessibility-acceptance--2026-10-19), canonical Module 12 checklist and this log.
- Verification: User-reported manual matrix on fixture Chrome 155.0.8059.80/macOS; exact AT version not supplied. Local stop endpoint closes owned browser/services/private files normally.
- Decisions and deviations: No policy or acceptance relaxation; distinguish user observations from automated instrumentation.
- Blockers/open questions: Remaining workflow/failure/performance/focused security acceptance only.
- Next actions: Continue remaining Module 12 checks and final reconciliation.
- Next-session cautions: Manual URL is now obsolete; no human result should be reused for later material UI changes without appropriate rechecking. G1/Module 10/13.G6 unchanged.


### 2026-10-19 — Final Module 12 acceptance and completion

- Scope and checklist IDs: All 24 Module 12 items; remaining 12.2a–b/12.2d–g/12.3a–c/12.V3/12.V6 closed after final requirement-by-requirement audit. 12.V4 retains the user's explicit manual all-pass.
- Progress: Module 12 Complete at its authorized local/manual scopes. Core matrix passes Node 37, Standard 37, Minimum 38; upload matrix 11/10/10; nine axe surfaces/profile have zero violations. All 24 isolated performance samples complete.
- Change summary: Finished actual expiry/issue conflicts/deletion/redaction/YAML-form/native-cancellation checks, reviewed existing security/performance boundaries, investigated startup shifts and recorded correct lab metrics. Reconciled canonical checklist, master/entry statuses and English/Chinese account/issue/management/hosting guidance.
- Files/artifacts: [Completion audit](../evidence/12-completion.md), [performance acceptance](../evidence/12-performance-acceptance.md), final browser/upload/axe/performance/bundle JSON, [focused review](../evidence/12-focused-review.md), ADR 0016, frontend/test/backend prerequisites and linked reader/engineering docs.
- Verification: Node 24.21.0; production build, typecheck, lint/boundaries, api:check (77 paths), focused unit 18/18, contracts 2/2, workerd issue/OAuth/passkey 6/6 and PostgreSQL 18.6 issue/OAuth/passkey 6/6 pass. Current bundle hashes match disk/performance asset requests. Secret scan/scoped format/whitespace pass; final documentation/link/checklist checks recorded below. No application code changed during final documentation reconciliation.
- Decisions and deviations: Manual results are human-reported; exact AT version not supplied. Browser-only timer acceleration preserves immutable backend time/assurance. Local genuine S3/ClamAV versus emulated R2 signing/CORS and optional soft-navigation metrics remain explicit. Focused review is by the implementing agent, not independent sign-off. No weakened baseline, new migration/dependency or later-module screen.
- Blockers/open questions: None for Module 12. G1 remains Not passed, Module 10 Blocked, 13.G6 open, and existing Module 07 production provider/scanner remainders remain separate.
- Next actions: No Module 12 implementation remains; subsequent work follows its own authorized scope/gates.
- Next-session cautions: All owned workflow/manual services are stopped; disposable URL obsolete. Scanner snapshot expires normally; refresh before reuse. Preserve uncommitted source and protected root drafts/handoffs. No hosted load, deployment, paid resource, push, merge or PR edit occurred or is authorized by this closure.

- Final closure checks: `corepack pnpm docs:build` passes after reconciliation (1.32 s); 24/24 canonical checkboxes have corresponding evidence-map rows; 1,183 relative references across 27 changed documents resolve, and all four English/Chinese page-path/heading pairs match. Current bundle SHA-256 values and all core/upload/axe/performance report assertions pass. Scoped formatting passes (60 matched implementation/fixture files); `git diff --check` passes. Zero `hyperbug-web12-*` private fixture directories and no owned workflow/workerd/PostgreSQL runner remain after completion. All process handles used for final checks exited 0.

### 2026-10-19 — Commit and push Module 12

- Scope and checklist IDs: Completed Module 12, all 24 items; publish the user-authorized branch commit.
- Progress: `9b78e06` (`feat(web): complete product workflows`) committed 100 Module 12 and bounded prerequisite files. Pushed successfully to the configured `origin/feat/v1` upstream.
- Change summary: Published the implementation, acceptance evidence, plan/status reconciliation, and bilingual reader guidance already documented in the completion map.
- Files/artifacts: Commit `9b78e06`; branch `feat/v1`; remote `origin/feat/v1`; [completion evidence](../evidence/12-completion.md).
- Verification: `git diff --cached --check` passed before commit; `git push origin feat/v1` exited 0 (`22a0dde..9b78e06`). Existing current-source typecheck/lint/build/unit/contract/workerd/PostgreSQL/browser/upload/accessibility/performance/docs evidence is recorded in the completion map. No tests rerun for this publication-only action.
- Decisions and deviations: User explicitly authorized this push on 2026-10-19. No pull request was created or modified.
- Blockers/open questions: None for Module 12 publication. G1 remains Not passed, Module 10 Blocked and 13.G6 open.
- Next actions: None for Module 12; future work follows its own authorization and gates.
- Next-session cautions: Root `SECURITY.md`, handoff notes, and design/performance review drafts remain untracked and excluded from the commit. Keep them intact.
