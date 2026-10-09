# 08 progress — Structured search, filters, and query performance

Plan: [Detailed checklist](../modules/08-search-and-query.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete (implementation/local acceptance; hosted tier evidence remains Module 13)
- Delivery scope: MVP backend
- Prerequisites: 07 complete; event contracts from 02, async dispatch completed in 09.
- Implementation: B1–B4 implemented and locally verified: specification/parser, both-store compilers, routes/authorization, lifecycle, version-aware handlers and tier budgets.
- Completed checklist IDs: 08.1a–e, 08.2a–d/f–h, 08.V1–V4 and local/emulated 08.V6. 08.2e handler and 08.V5 replay/rebuild are verified; their dispatch/queue portions are verified by Module09 B3.
- Active/next checklist group: Authorized Module08 implementation ends here; Module09 B3 closes 08.2e dispatch and 08.V5 queue/retry.
- Last updated: 2026-10-10.
- Blocking issues discovered: No local implementation blocker. Module09 dispatch/queue acceptance and account-wide/actual Free CPU evidence remain separate integration/release work.
- Evidence: [B1–B4 search validation and completion audit](../evidence/08-search-validation.md), with committed dual-store plans and Minimum reindex measurements.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 08.1 | Define public query semantics | Complete, B1/B2 locally verified | [SEARCH-SPEC](../../SEARCH-SPEC.md) |
| 08.2 | Implement database compilers and index lifecycle | Both-store compilers/lifecycle/handler/budgets verified locally; dispatch verified by Module09 B3 | [Search evidence](../evidence/08-search-validation.md) |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Preserve Module09 B3 dispatch/retry acceptance; continue its workflow/Minimum batches without changing search contracts.
2. Module10 accepts the integrated backend before G1. Module13 owns provider-global quota allocation, actual Free CPU/exhaustion and 13.G6 evidence.
3. No SPA, Module07 remainder, later audit or unrelated implementation is authorized by this handoff.

## Next-session cautions

Search must apply current authorization even while its index is stale. Do not expose raw FTS5 MATCH or PostgreSQL tsquery syntax as the public contract.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 08; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for structured search, filters, and query performance.
- Files/artifacts: `docs/plan/modules/08-search-and-query.md`; `docs/plan/progress/08-search-and-query.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 08.1.
- Next-session cautions: Search must apply current authorization even while its index is stale. Do not expose raw FTS5 MATCH or PostgreSQL tsquery syntax as the public contract.

### 2026-09-20 — Minimum-tier search budgets planned

- Scope and checklist IDs: Planning only. Added 08.2h and 08.V6. No implementation item was completed or checked.
- Progress: Recorded tier-scoped search budgets, quota-aware degradation with bounded safe errors, and a bounded administrator reindex that respects the free row-read and row-write budgets.
- Change summary: Extended the module plan and its source-coverage pointer; standard search semantics, the versioned AST and authorization requirements are unchanged.
- Files/artifacts: `docs/plan/modules/08-search-and-query.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No search implementation, query plan or dataset measurement ran.
- Decisions and deviations: Quota exhaustion produces documented bounded errors and never expands authorization through a stale or partial index.
- Blockers/open questions: The tier's measurable search ceiling depends on the 10.3g fixtures.
- Next actions: Continue 08.1/08.2 in order; add the tier budget when the search implementation exists.
- Next-session cautions: Do not treat the tier's reduced result window as a change to the public search contract.


### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: Plan-only dependency alignment; no implementation item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior search checklist wording; no query feature was implemented.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Module prerequisites and acceptance remain open.
- Next actions: Keep Module 08 untouched during the feature hold.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-09 — Module 08 B1 public query contract

- Scope and checklist IDs: B1 08.1a–08.1e, with 08.V1/V2 corpus preparation only; dependency impact on contracts, Issue reads, projection, dispatch and backend acceptance.
- Progress: B1 verified; 08.1a/c/d/e specification outcomes complete. 08.1b semantics, AST v1, explicit complexity/result-window bounds and shared accepted/rejected/fuzz fixtures prepared; 08.1b runtime support remains open. Parser, routes, stores, migrations and runtime acceptance are not implemented in this batch.
- Change summary: Proposed dedicated project search/suggestion routes, seven UUID-based filters with principal-bound `me`, bounded OR-of-AND syntax, stable immutable ordering and safe errors. Native tokenizer differences are explicit.
- Files/artifacts: `docs/SEARCH-SPEC.md`; `packages/contracts/src/search.ts` and export; `tests/fixtures/search-query-contract.ts`; proposed ADR 0013; [B1 evidence](../evidence/08-search-validation.md); module/master records.
- Verification: One B1 pass succeeded: `corepack pnpm typecheck`, `corepack pnpm lint`/boundaries, `corepack pnpm test:unit` (354), `corepack pnpm test:contract` (1), scoped `oxfmt --check` (three TypeScript files), `git diff --check`, and nine new-document local links. Exact scope/results in linked evidence; the new parser corpus remains unexecuted.
- Decisions and deviations: Per README, 07/08 handlers precede 09 dispatch; prerequisites are integration handoffs rather than circular gates. Consume existing 07 projection; do not close its remainders. No normative baseline deviation, normative-document edit, hosted claim or gate change.
- Blockers/open questions: HANDOFF-08 requires user approval of the specification/bounds/AST/endpoint shape before B2. 08.1b runtime support and 08.V1/V2 await parser/both-store execution. 08.2e dispatch and 08.V5 queue/retry remain module 09 work.
- Next actions: Finish B1 verification/commit, present the concrete spec for approval, then B2 only after approval.
- Next-session cautions: Module 08 remains In progress. Preserve feat/v1, protected untracked root documents, existing cursor/projection semantics, G1/G2 closed and 13.G6 open. Local/emulated checks cannot establish actual Free-plan quotas.

### 2026-10-09 — B2 approval and compiler implementation

- Scope and checklist IDs: B2 08.1b/08.2a/b/d and 08.V1/V2 parser/store evidence. User explicitly approved the presented B1 spec/bounds/AST/endpoint decision.
- Progress: Parser/direct-AST validation, dual-store parameterized compilers, fixed-window keyset pagination and batch relations verified; 08.1b/08.2a/b/d and 08.V1/V2 complete at the recorded local scopes.
- Change summary: Keep search-derived data separate from canonical Issues; project-scoped FTS5/GIN membership and canonical current-revision/moderation predicates precede results. Traversal has a SQL result cap independent of untrusted cursor counters.
- Files/artifacts: Application search module, database compilers/store exports/schemas, D1 0028/PG 0027 migration families, approved SEARCH-SPEC/ADR 0013; shared fixtures to be executed after the batch is written.
- Verification: Types/lint/boundaries pass; unit 6/contract 1 pass; D1/workerd and real isolated PG18.6 selected search/migration suites 14 each pass, with final narrowed three-store-check refinements replacing prior results. db:check and local D1/isolated PG migration application pass. Initial install/static/locale/count failures and exact commands are in [B2 evidence](../evidence/08-search-validation.md#b2--parser-and-dual-store-compilers-2026-10-09).
- Decisions and deviations: Approved dedicated search/suggestions endpoint shapes; no normative document changes. Drizzle-generated additive D1 migration includes manually reviewed external-content FTS5 table/triggers unsupported by schema generation; no canonical table rewrite/backfill or remote application.
- Blockers/open questions: None for approval. B3 lifecycle/readiness/query measurement and B4 update handlers/tier budgets remain future batches; dispatch/queue acceptance stays Module 09.
- Next actions: Commit B2, then B3 canonical service/route authorization/readiness, bounded initial lifecycle and larger-dataset measurements.
- Next-session cautions: Preserve older migration history and protected untracked drafts; no remote migration/deployment or gate closure. Search index writes do not enter canonical Issue mutation routes.

### 2026-10-09 — B3 lifecycle implementation checkpoint

- Scope and checklist IDs: 08.2c/f/g and 08.V3/V4; Module 08 owns this batch.
- Progress: B1/B2 committed; B3 in progress, unverified. Inspecting inherited index-store changes before integration.
- Change summary: Bounded resumable initial indexing consumes canonical Module 07 projections; conditional revision/visibility fences prevent stale writes. PostgreSQL native position limits require token-sequence phrase rechecks.
- Files/artifacts: Application search-index port and both adapter search-index implementations; shared SEARCH-SPEC/evidence will record final behavior.
- Verification: Not run for B3; prior B2 results remain recorded in ../evidence/08-search-validation.md.
- Decisions and deviations: User approval of B2 persists. No normative edits or scope expansion; dispatch and queue/retry remain Module 09 handoffs.
- Blockers/open questions: B3 routes/readiness and larger-data evidence remain unfinished.
- Next actions: Complete B3 implementation, run one relevant verification pass, record results and commit.
- Next-session cautions: Preserve protected root drafts, canonical projection policy and closed G1/G2/open 13.G6; no hosted claims.

### 2026-10-09 — B3 local acceptance

- Scope and checklist IDs: 08.2c/f/g, 08.V3/V4; Module 08 owns implementation.
- Progress: Both stores and composed HTTP routes verified; lifecycle/readiness and representative measurements complete locally.
- Change summary: Approved search/suggestions use shared project authorization; stale visibility/membership/text cannot grant results. Bounded explicit backfill, incomplete-index errors, one-second store deadline and token-sequence phrase rechecks preserve canonical access.
- Files/artifacts: Application/index ports, dual-store adapters, server/runtime bindings, existing shared suites; SEARCH-SPEC/ADR0013; ../evidence/08-search-validation.md B3 and dual-store query JSON.
- Verification: Combined selected scope 10 checks per profile pass; types/lint/boundaries pass. Exact first failures/narrow repairs/metadata are in linked evidence; no hosted acceptance.
- Decisions and deviations: Candidate ceilings 4096/256 total project Issues, 60-second operational delay target awaiting scheduling, no partial successful index. PostgreSQL bulk-load GIN pending scan investigated and VACUUM result recorded; no query-side vacuum.
- Blockers/open questions: B4 events/quota/reindex remain; Module 09 dispatch and queue/retry open. No Module 07 remainder or integration/release gate closed.
- Next actions: Commit B3, implement/verify B4 within Module08 scope.
- Next-session cautions: Preserve protected untracked drafts, prior migrations, canonical content bounds, G1/G2 closed and 13.G6 open; local evidence cannot claim real Free CPU or quotas.

### 2026-10-09 — B4 implementation checkpoint

- Scope and checklist IDs: 08.2e/h, local 08.V5/V6; Module08 owns implementation, dispatch stays Module09.
- Progress: B3 committed faa04f8; B4 written, verification pending.
- Change summary: Canonical revision-reference/outbox handler, replay suppression, administrator-guarded one-page reindex, singleton atomic Minimum daily reservation and D1 row/statement metering. No public reindex endpoint or scheduler.
- Files/artifacts: Search budget/index/application ports, dual adapters and new D1 0029/PG0028 budget migration families; server/composition and shared native fixtures.
- Verification: Migration generation completed/SQL inspected; B4 static/runtime/migration checks not yet run.
- Decisions and deviations: Conservative search allocation leaves provider quota for other modules; provider-global accounting/hosted CPU remains independent acceptance. Existing outbox mutation IDs resolve immutable timeline revisions, without changing payloads.
- Blockers/open questions: Local checks/measurements pending; production dispatch/queue/retry and real Free-plan evidence remain open.
- Next actions: Run one B4 relevant pass, fix failures narrowly, record evidence and commit; then requirement-by-requirement handoff audit.
- Next-session cautions: Preserve earlier migrations and protected drafts; no normative edits, remote rollout or gate closure.

### 2026-10-09 — B4 local acceptance and authorized handoff completion

- Scope and checklist IDs: 08.2e/h, local 08.V5/V6 and final HANDOFF-08 audit.
- Progress: All four authorized batches implemented and locally verified; 08.1a–e, 08.2a–d/f–h, 08.V1–V4 and local 08.V6 complete. 08.2e handler/08.V5 replay-rebuild pass; combined dispatch/queue checkboxes stay open. Module08 remains In progress.
- Change summary: Exact-revision/outbox handlers, bounded administrator reindex, atomic Minimum quotas, candidate overflow fence and cursor policy; PostgreSQL recursive index probes and one-time canonical/text materialization.
- Files/artifacts: Application/server/runtime search ports; dual-store compilers/index/budget adapters and 0029/0028 migrations; existing shared native/unit fixtures; SEARCH-SPEC/ADR0013; [B4 evidence and requirement audit](../evidence/08-search-validation.md#b4--version-aware-indexing-and-tier-budgets-2026-10-09), query/reindex JSON and module/master records.
- Verification: Composed selected scope D1/workerd22 and real isolated PG18.6 20 pass; unit7/contract1 pass; migration fresh/upgrade/application and db:check pass; final typecheck/lint/boundaries pass. Final narrowed PostgreSQL semantics/plan pass, including no canonical Seq Scan, <=4097 probes/node and zero denied-project Issues/document scan loops. Exact commands, failed assertions/imports/plan attempts, local metadata and limitations are in linked evidence.
- Decisions and deviations: PostgreSQL logical LIMIT alone failed physical scan bounds; recursive keyset probes plus independent canonical/text materialization fix it without widened ceilings or planner-wide settings. Conservative Minimum ledger is not provider-global billing/CPU evidence. No normative edit or baseline deviation; user approval persists.
- Blockers/open questions: No blocker within authorized handoff scope. Module09 dispatch/queue/retry/reconciliation and provider-global headroom, Module10 composed acceptance and actual Free CPU/quota 13.G6 remain open.
- Next actions: Commit verified B4 as the fourth batch; stop Module08 implementation. Later authorized Module09 connects 08.2e dispatch and completes 08.V5; Module10/13 supply remaining gate evidence.
- Next-session cautions: Preserve feat/v1 batch history, protected untracked drafts, earlier migrations, current canonical authorization and numeric ceilings. No remote rollout/push, SPA or Module07/14 expansion. G1/G2 stay closed and 13.G6 open; local evidence must not be promoted to hosted acceptance.

### 2026-10-09 — User-authorized commit and push

- Scope and checklist IDs: Publish the four completed Module08 batch commits; no implementation checklist change.
- Progress: User explicitly requested commit and push. All implementation was already committed; `git push origin feat/v1` succeeded, advancing the remote from `1841761` to `48d0cf0`.
- Change summary: Published B1 `c0d0527`, B2 `3869c76`, B3 `faa04f8` and B4 `48d0cf0`; append this operational record as a separate documentation commit.
- Files/artifacts: This progress entry and origin/feat/v1 history.
- Verification: `git status --short`, branch/upstream and four-commit history inspection confirmed feat/v1 with a clean tracked tree; push exited successfully. `git diff --check` validates this documentation entry. Application tests are not rerun because no behavior changed; remote CI is not claimed.
- Decisions and deviations: Current explicit user authorization supersedes the prior no-push boundary for these commits. Protected root drafts remain untracked and excluded.
- Blockers/open questions: None for pushing. Existing Module09 dispatch/queue and Module10/13 acceptance remain open.
- Next actions: Commit and push this progress record; confirm local/remote branch agreement.
- Next-session cautions: Module08 remains In progress; G1/G2 closed and 13.G6 open. A Git push does not apply migrations or deploy the application.

### 2026-10-10 — PR 2 search check and CodeQL repair

- Scope and checklist IDs: User-authorized CI/CodeQL #6 repair, regression verification of 08.2c/g/h and 08.V3/V6; no feature expansion.
- Progress: Reproduced both reported failures. The PostgreSQL fixture's policy-upgrade restart changed its origin and retained bundled classes, causing CORS 403 and then misclassification of source-backed SearchError as SEARCH_UNAVAILABLE. Restore original composition after upgrade validation and register each listener's actual origin; no production permission change.
- Change summary: Replace unbounded provider-error regex with a fixed number of literal searches per line (linear time). Preserve case-insensitive substrings, keyword ordering/overlaps, LF/CR/U+2028/U+2029 boundaries, late quota markers, typed SearchError identity and private fixed error codes. All D1/PostgreSQL search/reservation/backfill and outbox paths inherit the shared fix.
- Files/artifacts: `packages/application/src/search-budget.ts`, `tests/unit/search-availability.test.ts` (28 cases), `tests/postgres/issue-route.test.ts`; dependency audit repair recorded in Module01.
- Verification: Original Actions run37819894239/alert6 inspected. Native Node24.21.0 baseline `readlimit` x500/x1000 took ~165/1306ms; patched x1000/x10000/x100000 took ~0.13/0.17/1.58ms. Focused unit35 pass, including >1M-character alternate malicious input, late quota markers and ordinary provider errors; unit386/contract1, workerd283 (2 optional skips), Node124 (14 optional skips), PostgreSQL issue-route2 and full201 (2 optional skips) pass. Syntax/types/lint/clean-checkout format/build/docs/frozen/audit/license/secret checks pass as recorded in Module01. Parent20,000 and independent reviewer100,000 differential short inputs match old classification exactly.
- Review and decisions: One fresh read-only boundary investigator independently traced all callers and reproduced cubic growth; reconciled ordering/overlap/Unicode/line constraints before patching. One fresh read-only candidate reviewer found no source-backed bypass/regression and independently ran focused35/differential100,000. Provider-message remote controllability remains provider-dependent; no live quota exhaustion claimed. No permissions, timeout/budget ceilings, CodeQL queries or checks weakened. Intermediate fixture variable-scope errors were caught and corrected by types/focused tests; subsequent bundled-class error established the restoration requirement.
- Hosted checkpoint: [Repair c4daf20](https://github.com/EIHRTeam/HyperBug/commit/c4daf206b178164d7a50b76f1a289f3c7b16e076) published using the selected u202F connector account. [PR backend run37963378260](https://github.com/EIHRTeam/HyperBug/actions/runs/37963378260) passes quality/PostgreSQL/Node/Workers. [CodeQL run37963378215](https://github.com/EIHRTeam/HyperBug/actions/runs/37963378215) passes, and Security API marks alert6's PR instance `fixed`, without dismissal or exclusions. This documentation follow-up preserves the verified implementation; observe its own current-head CI separately.
- Blockers/open questions: None for requested search CI/CodeQL repair. Exhaustive hosted provider spellings remain a pre-existing documented uncertainty; original/alternate resource triggers and legitimate classifications are verified locally.
- Next actions: Publish this checkpoint, confirm PR checks finish successfully, then retain the existing Module09/10/13 handoff boundaries; no further search implementation planned.
- Next-session cautions: Preserve protected drafts, migrations, G1/G2 closed and 13.G6 open; no Module09 dispatch or SPA work.

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
