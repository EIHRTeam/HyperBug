# 10 progress — Backend acceptance and public API client

Plan: [Detailed checklist](../modules/10-backend-acceptance.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: MVP backend gate
- Prerequisites: 00–09 complete. This is the mandatory gate before SPA development.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 10.1, after prerequisites are satisfied.
- Last updated: 2026-09-17.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 10.1 | Complete public contracts and client | Not started | None yet |
| 10.2 | Execute the backend MVP acceptance matrix | Not started | None yet |
| 10.3 | Establish measurable performance and operational readiness | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 10.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

A passing mocked API test is not evidence of Workers/D1/R2 or Node/PostgreSQL/S3 compatibility. Keep unavailable deployment checks explicitly blocked.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 10; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for backend acceptance and public api client.
- Files/artifacts: `docs/plan/modules/10-backend-acceptance.md`; `docs/plan/progress/10-backend-acceptance.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 10.1.
- Next-session cautions: A passing mocked API test is not evidence of Workers/D1/R2 or Node/PostgreSQL/S3 compatibility. Keep unavailable deployment checks explicitly blocked.

### 2026-09-20 — Minimum-tier acceptance separation planned

- Scope and checklist IDs: Planning only. Added 10.2f and 10.3g, and extended 10.1a to cover the instance capability document. G1's scope is unchanged and no checklist item was checked.
- Progress: Recorded that every acceptance environment states its deployment tier and quota headroom, that minimum-tier runs are labelled and excluded from the G1 evidence set, and that quota-aware measurements form their own evidence set.
- Change summary: Extended the module plan with the tier items, the OpenAPI amendment and a source-coverage pointer.
- Files/artifacts: `docs/plan/modules/10-backend-acceptance.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No acceptance run occurred and G1 remains closed.
- Decisions and deviations: The minimum tier is accepted by 13.G6 only and never substitutes for a gate item in this module.
- Blockers/open questions: Free-plan measurement access is required for 10.3g; without it the evidence stays explicitly missing.
- Next actions: Keep G1 scoped to the two first-class profiles; add the instance capability document during the OpenAPI consolidation in 10.1a.
- Next-session cautions: Never merge minimum-tier measurements into standard-profile baselines or cite them as G1 evidence.


### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: G1 planning only; no acceptance item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior backend acceptance planning and verified that G1 was not marked passed by local tests.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: The defined deployed two-profile acceptance matrix remains incomplete.
- Next actions: Do not start the SPA; resume Module 10 only after its backend prerequisites and user direction.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-05 — Review remediation B3 verified

- Scope and checklist IDs: 10.2b/10.2e (B3 supporting evidence only).
- Progress: B3 complete locally; overall mission continues at B4. Existing module status/checklists and G1/G2/13.G6 are unchanged.
- Change summary: Expanded both-store negative/concurrency/migration cases; no full acceptance checkbox or G1 gate closes. Real-Free and Standard deployment evidence stay pending.
- Files/artifacts: Owning stores/routes/schema/tests and specifications listed in the [cross-module remediation record](../evidence/2026-10-05-review-remediation.md#b3-instance-roles-and-token-bound-assurance-2026-10-05). D1 0024/0025; PostgreSQL 0023/0024.
- Verification: Final local matrix **916 passed / 18 optional-provider skips** (349 unit, 1 contract, 121 Node, 262 workerd/D1 emulation, 183 real isolated PostgreSQL 18.6). Typecheck, lint, Drizzle check (old timestamp warnings), docs build, tracked/new-source formatting and diff checks pass. Root formatting flags only supplied untracked review files; reports untouched. No actual deployment/provider claim. Initial wiring/schema/fixture failures and focused primary-agent security review are recorded in the linked evidence.
- Decisions and deviations: Independent instance role and immutable presented-credential facts; configured default 300 s replaces hardcoded 900 s. No policy weakening, new protocol or new ADR required for B3; formal Minimum ADR remains B8.
- Blockers/open questions: None for B3. Independent Sonnet review unavailable (model not callable); no independent review claimed. Atomic account/role/plugin audit remains B4.
- Next actions: B4 audit transaction/failure cases, recovery-code step-up and passkey CAPTCHA forwarding, then B5–B15 in the approved order.
- Next-session cautions: Never stage SECURITY.md or supplied reviews; preserve historical migration/audit rows, apply schema before adapters, inspect upgrade role recipient, and require new passkey login for old tokens. No SPA or later-module audit resume.

### 2026-10-05 — Review remediation B4 accepted locally

- Scope/checklist IDs: Approved B4 post-completion correction to 04.1c/d, 04.2f, 04.3c/V5 and 05.2a/05.3d, with data/security/acceptance dependencies. No later-module audit or gate expansion.
- Progress/change summary: Prepared neutral audit port; atomic both-store account/role/plugin/recovery/enrollment writes, conditional denial guards, one bounded settings transaction and atomic uninstall cleanup. Recovery generation checks immutable ceremony freshness; passkey CAPTCHA admission precedes challenge consumption. B3 last-administrator serialization retained.
- Files/artifacts: [Detailed B4 record](../evidence/2026-10-05-review-remediation.md#b4-atomic-administration-audit-recovery-freshness-and-passkey-captcha-2026-10-05), application ports, both adapters/server, shared rollback/stale and configured-CAPTCHA fixtures, contracts/specifications and paired reader guides.
- Verification: Focused affected D1/workerd **10 passed** and real isolated PostgreSQL **18.6 13 passed**, no skips. Typecheck/lint/boundaries/scoped format/diff, documentation/all runtime builds and credential-signature scan pass; local Minimum journey adds 7 passes; broad unchanged lanes intentionally not repeated under the user's “Test less, write more” preference. Actual duplicate-audit failures roll back every listed mutation; stale generation preserves codes. Initial fixture errors corrected. Primary focused review recorded; no Sonnet or independent-review claim.
- Decisions/blockers: No schema/deployment/provider change or B4 blocker. Standalone session/link/redeem events retain their prior path; later audit remains suspended. G1/G2 closed, 13.G6 open.
- Next actions/cautions: Commit B4, then B5 conditional session renewal and B6–B15. Keep primary validation/revocation, atomic audit, last-admin locks and required UV/CAPTCHA. Preserve protected files, old SQL/audit history and test measurement artifacts.

### 2026-10-05 — Review remediation B5 conditional session renewal

- Scope/checklist IDs: Approved B5 correction to 04.2c with 02 session-port and 10 acceptance dependencies.
- Progress/change summary: Primary session load now includes kind/idle expiry; requests validate current state and digest every time, renew only when due (User five minutes, Staff three minutes), and avoid writes when absolute expiry prevents growth. Conditional SQL and original ceremony facts remain unchanged.
- Files/artifacts: [B5 record](../evidence/2026-10-05-review-remediation.md#b5-conditional-session-renewal-2026-10-05), application/D1/PostgreSQL/server session files, shared actual-adapter renewal contract, AUTH-FLOWS and paired reader guides.
- Verification: Focused D1/workerd **4 passed**, real isolated PostgreSQL 18.6 **5 passed**, no skips; final changed renewal contract rerun on both stores. Covers intervals, near-idle/absolute expiry, concurrent tabs and immediate logout/owned revocation/credential revision rejection. Typecheck/lint/boundaries/scoped formatting/diff and documentation build pass. Broad unchanged tests omitted per user direction.
- Decisions/blockers: No schema/deployment/crypto change or blocker. Concurrent due observations may each perform a safe conditional renewal; no global cache. Existing 30-minute/seven-day issuance retained, and the misleading shorter-Staff-lifetime documentation claim corrected. Gates unchanged.
- Next actions/cautions: Commit B5, then B6 request-scoped authorization facts reuse and measured read-query counts. Preserve primary validation, recent-authentication timestamp, monotonic expiry and revocation semantics; never stage protected files.

### 2026-10-05 — Review remediation B6 request-scoped authorization reuse

- Scope/checklist IDs: Approved B6 correction to 04.2e and 06.2d/V4, with guarded plugin/content and 10 acceptance dependencies. Later audit remains suspended.
- Progress/change summary: Built-in DB resolvers share exact-ID fact promises within one original HTTP Request; authoritative visibility seeds project facts and private membership admission shares its loader. Every permission evaluation retains its own resource/credential binding; decisions/token verification remain uncached.
- Files/artifacts: [B6 record](../evidence/2026-10-05-review-remediation.md#b6-request-scoped-authorization-facts-2026-10-05), server resolver/guards/handler wiring, shared actual-adapter query/revocation contract and AUTH-FLOWS.
- Verification: Both focused D1/workerd and real PostgreSQL 18.6 suites **9 passed each**, plus token-assurance unit **3 passed**, no skips. Measured anonymous list **5→4**, Staff list **11→7** database statements with the in-memory test key source; no unmeasured production count claim. Role removal/suspension/private visibility changes take effect on new requests; B2 negatives and existing query/index plans pass. Typecheck/lint/boundaries/scoped format/diff and documentation build pass.
- Decisions/blockers: Actual authenticated count supersedes the plan's rough ~5 estimate. No schema/deployment/ADR/permission change or blocker. Gates unchanged; production key overhead and real-Free limits remain B7/B15.
- Next actions/cautions: Commit B6, then B7 imported key reuse/per-purpose registry/request snapshots with immediate revocation. Keep cache lifetime at one Request, separate decisions/credentials, and retain authoritative project seed provenance. Preserve protected files and historical evidence.

### 2026-10-05 — Review remediation B7 key-material reuse

- Scope/checklist IDs: Approved B7 post-completion correction to 03 key lifecycle/admission, with 04/05 route and 10 acceptance dependencies.
- Progress/change summary: Bounded imported key reuse by exact secret digest; fresh purpose-filtered primary registry loads and request-only snapshots, including abuse preparse handoff and standalone account/OAuth helpers. Password admission bounds retained.
- Files/artifacts: ADR 0006, providers/registries/server wiring and shared key-material contract; [B7 evidence](../evidence/2026-10-05-review-remediation.md#b7-imported-key-reuse-and-request-lifecycle-snapshots-2026-10-05).
- Verification: Focused new provider/abuse/D1 checks 13, real PostgreSQL 18.6 contract 1 and admission handoff 10 passed; typecheck/lint/boundaries pass. Preliminary affected route checks recorded separately in evidence. No real-Free CPU or independent-review claim.
- Decisions/blockers: Request-local lifecycle only; sources and authoritative state reread on new requests. No schema/deployment or blocker. G1/G2 closed, 13.G6 open.
- Next actions/cautions: Commit B7 then B8 formal Minimum ADR/profile/password accounts. Preserve complete administrative/backup registry inspection, shared password concurrency, audit history and protected files.

### 2026-10-05 — Review remediation B8 formal Minimum profile

- Scope/checklist IDs: Approved B8 to 03 tier/crypto/admission, 04 account journeys, 10/13 profile gates, with 01 composition and 02 contracts dependencies.
- Progress/change summary: ADR 0012 supersedes old floor/gate exclusions; canonical tier/new acknowledgement, public peppered PBKDF2 passwords with bounded strength policy, durable login lockout/CAPTCHA, standard Argon2id upgrades and sensitive-route-only activation. Separate Minimum entry omits Wasm. Bilingual disclosures and active plans synchronized.
- Files/artifacts: [B8 evidence](../evidence/2026-10-05-review-remediation.md#b8-formal-cloudflare-minimum-profile-2026-10-05), ADR 0012, roots/config/security/server/contracts/builds and focused fixtures; no database migration.
- Verification: Selected config/audit/provider/activation 36, Minimum journey 7, real PostgreSQL 18.6 account/upgrade journey 1 and final admission 19 passed; typecheck/lint/boundaries/docs pass. Bundle and denylist sizes recorded, initial fixture failures corrected. Local evidence only, no Argon2id performance or independent review claim.
- Decisions/blockers: Authorized Minimum-only offline-strength deviation disclosed; historical v1 audit rows preserved. G1/G2 now require all three profiles and stay closed; additional real-Free 13.G6 open. Actual CPU/startup remains B15.
- Next actions/cautions: Commit B8 then B9 risk-tiered limits. Preserve scoped key/concurrency bounds, one-use permits, stronger-hash refusal, expected credential revision, append-only histories, protected files and remaining holds.

### 2026-10-05 — Review remediation B9 risk-tiered limits

- Scope/checklist IDs: Approved B9 correction to 03.3c/d and 06 content admission, with 10 acceptance dependencies; later audit suspended.
- Progress/change summary: Closed category policy preserves identity all-version counters; content requires approximate principal/project shedding and one primary current-version principal counter. Rotation's content reset is disclosed in ADR 0008.
- Files/artifacts: Security policy/providers, RATE-LIMITING, ADR 0008 and shared actual-store HTTP fixture; [B9 evidence](../evidence/2026-10-05-review-remediation.md#b9-risk-tiered-content-admission-2026-10-05).
- Verification: Unit 17, D1 content/issue 2 and PostgreSQL 18.6 content/issue 2 passed; typecheck/lint/boundaries/scoped format/diff pass. One counter, rotation, identity continuity, 429 and approximate-outage no-write verified. Initial fixture corrections recorded.
- Decisions/blockers: No schema/deployment or blocker; approximate project shedding is not a durable quota. Production budgets remain B15. No independent review claim; gates unchanged.
- Next actions/cautions: Commit B9, then B10 explicit cache policy. Preserve identity all-version limits, mandatory content shedding, trusted IDs, primary fail-closed behavior and protected drafts.

### 2026-10-05 — Review remediation B10 response cache policy

- Scope/checklist IDs: Approved B10 amendment to 06.2e with 03 HTTP trust and 10 acceptance dependencies.
- Progress/change summary: Anonymous instance metadata alone is public for 60 seconds with weak ETag/304 and Origin/Authorization/Cookie variation. Credentialed/error/other routes stay no-store; handler overrides cannot opt in. No Workers Cache or shared content cache enabled.
- Files/artifacts: Server policy/hook/instance handler, shared HTTP fixture, API/security specs and bilingual guides; [B10 evidence](../evidence/2026-10-05-review-remediation.md#b10-server-owned-response-cache-table-2026-10-05).
- Verification: Selected Node/workerd HTTP 6 passed / 62 intentionally deselected; typecheck/lint/boundaries/scoped format/diff/docs pass. Native/set override defenses and Origin errors remain closed. Initial response-inference issue corrected.
- Decisions/blockers: No schema/deployment or blocker. Context7 cache/pricing gaps recorded; real Free request accounting B15. Gates unchanged.
- Next actions/cautions: Commit B10, then B11 bounded expired cleanup only. Keep global Origin checks, credential/cache separation, metadata Vary, no shared content cache and audit history/protected drafts.

### 2026-10-05 — Review remediation B11 bounded expired cleanup

- Scope/checklist IDs: Approved B11, partial 09.3d and dependent data/security/account/acceptance retention.
- Progress/change summary: Fixed indexed cleanup of expired credentials/receipts/counters and D1 lockouts on existing schedulers; 25 rows/target, eight D1/seven PG statements. Audit and history preserved.
- Files/artifacts: [B11 record](../evidence/2026-10-05-review-remediation.md#b11-bounded-expired-cleanup-2026-10-05), application/adapters/roots, D1 0026/PG 0025 indexes/snapshots and DATA-MODEL/MIGRATIONS.
- Verification: Focused D1 1, PostgreSQL 18.6 1 and Node scheduler 2 pass; typecheck/lint/boundaries/db history checks pass. Initial fixture/generation issues corrected in linked record.
- Decisions/blockers: Credential/challenge post-expiry retention uses configured default one day; other records stored expiry. 09.3d remains partial; sustained/deployed retention and broader module scope open. Gates unchanged.
- Next actions/cautions: Commit B11 then B12 unkeyed receipts; preserve old SQL/snapshots/audit and protected drafts. No queue/workflow or blob cleanup expansion.

### 2026-10-05 — Review remediation B12 one-shot receipts

- Scope/checklist IDs: Approved B12, 06.2c non-audit/V3 and dependent data/acceptance contracts.
- Progress/change summary: Explicit unkeyed issue/comment intents skip receipts; keyed replay remains 24 hours. D1 captures committed result within batch; comment last-mutation witness fences edit history.
- Files/artifacts: [B12 record](../evidence/2026-10-05-review-remediation.md#b12-one-shot-mutation-receipts-2026-10-05), identity/intents/adapters, D1 0027/PG 0026 and specs.
- Verification: Focused D1/workerd 4 and PostgreSQL 18.6 4 pass, including three-statement reductions and concurrent losers/keyed replay; types/lint/boundaries/docs pass. Broad matrix B15.
- Decisions/blockers: No gate or suspended-audit closure; nullable column leaves history unchanged.
- Next actions/cautions: Commit B12 then B13; migrate before adapters, preserve atomic side records, protected drafts and old SQL.

### 2026-10-05 — Review remediation B13 deadline/config consolidation

- Scope/checklist IDs: Approved B13, 01/03 runtime bounds with 04/10 dependencies.
- Progress/change summary: Named security/read/write deadlines, parsed store settings bound to request/nested signals; local safe debug diagnostics. Six unimplemented retention settings now reject explicit values; expired-session retention active.
- Files/artifacts: [B13 record](../evidence/2026-10-05-review-remediation.md#b13-named-request-scoped-deadlines-and-active-configuration-2026-10-05), config/bounds/helper/root changes and bilingual security guide.
- Verification: Unit security/config 9 and Node HTTP deadline 3 pass; types/lint/boundaries/docs pass. Call-site corrections recorded.
- Decisions/blockers: Store defaults provisional 1000 ms pending B15 actual cold/p99 sizing; no gate closure or retention expansion.
- Next actions/cautions: Commit B13 then B14; preserve per-request signal scoping, fail-closed decisions, safe diagnostics, history/protected drafts.

### 2026-10-05 — Review remediation B14 composition/plugin bounds

- Scope/checklist IDs: Approved B14, 01 route composition/05.1d/05.3c; 03/04/07/10 contract dependencies.
- Progress/change summary: Six explicit-dependency route modules preserve schemas/hooks; payload JSON bytes and eight plugin/point slots enforced, including timed-out native work. Sampling explicit per environment. B6 media fact scope refreshed after object acquisition.
- Files/artifacts: [B14 record](../evidence/2026-10-05-review-remediation.md#b14-route-composition-plugin-bounds-and-explicit-sampling-2026-10-05), server route/helper extraction, plugin runtime/spec, Wrangler/types and fixtures.
- Verification: Focus10 plugin, Node33, Workers9 and media22 pass; composed final local matrix937 passed/18 optional-provider skips, with fresh-migration count corrected and focused2 pass. Types/lint/boundaries/build/db/docs/secret scan pass; query timing drift restored.
- Decisions/blockers: Primary focused review only; actual Free metrics and final production sampling B15. G1/G2/13.G6 unchanged. Native CPU cannot be preempted and timeout never releases still-running capacity.
- Next actions/cautions: Commit B14 then authorized B15 inventory/backup/migrations/metrics/cleanup; preserve exact dependency/schema/hooks, permission refresh before bytes, protected drafts and histories.
