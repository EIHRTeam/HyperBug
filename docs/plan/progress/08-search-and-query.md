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
- Active/next checklist group: Authorized metering/initialization investigation supports Module09 B5; search SQL and semantics stay unchanged. Latest productive native dispatch is 20 ms versus 10 ms. Existing 08.2e/08.V5 closure is preserved.
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

- Scope and checklist IDs: 09.1f/09.V6 CPU blocker; 08.2e/08.V5 accepted handoffs preserved.
- Progress: Actual D1 search projection converges through the unchanged handler, but original/optimized dispatch is 15 ms and real Cron with work 20 ms versus 10 ms. Module08 local checklist remains Complete. Possible D1 search-index profiling/batching is proposed, not authorized or implemented.
- Change summary: Preserve B1–B4 acceptance; record uncommitted B5, actual Free CPU failure and scoped cleanup.
- Files/artifacts: existing search handler/adapter; hosted CPU/search receipt; [detailed B5 evidence](../evidence/09-async-validation.md#b5--minimum-prototype-and-hosted-cpu-blocker) and [safe receipt](../evidence/09-hosted-minimum-receipt.json).
- Verification: Focused local Minimum/replay-retention workerd 2, PostgreSQL retention/capability 2, Minimum capability 1, maximum multipart budget unit 1 and optimized recovery 1 pass; prior typecheck/lint/db:check/build/docs/secrets pass. Actual dispatch 15/20 ms fails required 10 ms. Final cleanup API/row/foreign-key guards pass; raw DNS inventory 403, independent absence unverified. Hosted quota exhaustion not run. Affected replay commands and limitations are in linked evidence. Final corepack pnpm docs:build, scan:secrets, scoped oxfmt --check and git diff --check pass; checklist/status/receipt/local-link/bilingual-path/empty-staging guards pass. No broad green-lane rerun.
- Decisions and deviations: Follow HANDOFF-09 “If a bound cannot be met, stop and report.” No bound/normative change, dependency addition, B5 commit, push or PR update; audit stays suspended.
- Blockers/open questions: Module09 B5 Free CPU fit. Further changes in Module08 require explicit bounded scope authorization; batching is a proposal, not a proven fix.
- Next actions: Obtain that scope decision, then resume only authorized affected implementation/verification. Final scoped formatting/document checks passed; no staged files.
- Next-session cautions: Keep B5 uncommitted and 09.1f/09.2e/09.3g/09.V6 unchecked; preserve protected drafts, baseline/append-only history and additive migrations. G1/G2 closed and 13.G6 open. Hosted owned mappings/resources are gone; ignored receipts contain private configuration and must not be staged.

### 2026-10-10 — Authorized D1 search batching investigation

- Scope and checklist IDs: User explicitly authorizes scoped Module08 profiling/batching to unblock 09.1f/09.V6; preserve 08.2e/h and 08.V3/V5/V6 contracts, authorization and numeric ceilings.
- Progress: Inspected current D1 search path: separate immutable revision lookup, quota reservation, canonical source read and guarded write (four calls). Existing B5 direct claim remains uncommitted.
- Change summary: Plan a single-row Minimum event optimization combining quota admission and canonical source retrieval in one SQL statement; denied admission returns no content. Standard and bounded rebuild semantics remain unchanged.
- Files/artifacts: D1 search-index/search-budget adapter, focused shared search/Minimum fixtures; subsequent hosted receipt.
- Verification: Context7 resolve/query D1 batch/metadata guarantees on 2026-10-10; sequential transaction/rollback documented, no documented changes() witness guarantee. Runtime proof follows the complete patch; no tests rerun yet.
- Decisions and deviations: Use INSERT RETURNING scalar source projection rather than a changes() dependency or new public/application port. Retain canonical revision/visibility/deletion/projection fencing and existing tokenization.
- Blockers/open questions: Hosted CPU fit remains unproven; profiler evidence must distinguish SQL time from Worker CPU.
- Next actions: Implement the narrow optimization, verify focused quota/race/replay cases, then deploy a fresh owned test Worker and compare CPU while preserving pre-existing D1 state.
- Next-session cautions: Authorized scope only; no bound relaxation or normative edit. B5 remains uncommitted; protect root drafts and preserve all baseline/history/migrations.

### 2026-10-10 — Authorized search batching verified locally, CPU still blocked

- Scope and checklist IDs: Authorized post-completion 08.2e/h, 08.V5/V6 regression and 09.1f CPU investigation.
- Progress: Minimum single-event admission/read uses one statement; Standard/rebuild/tokenization and canonical fences retained. Local shared semantics pass; profiling confirms three D1 calls but does not satisfy dispatcher CPU.
- Change summary: Complete the scoped investigation, retain uncommitted changes and stop hosted acceptance after the fresh CPU failure.
- Files/artifacts: D1 search-budget/search-index, shared search-contract, corrected Module08 integration handoff narrative, bilingual deployment/internal docs, [follow-up evidence](../evidence/09-async-validation.md#authorized-module08-d1-batching-follow-up--2026-10-10) and [fresh receipt](../evidence/09-hosted-minimum-batching-receipt.json).
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

### 2026-10-10 — Authorized dispatcher performance retry started

- Scope and checklist IDs: Module09 exact-source immutable revision snapshot; user authorizes testing/refactoring across profiles if needed.
- Progress: New bounded retry authorized after the recorded 22 ms CPU stop; acceptance remains open.
- Change summary: Prepare token-fenced admission/claim batching, immutable revision hydration and completion/backlog batching.
- Files/artifacts: D1 async adapters/schema, Minimum composition and focused tests; no hosted resources yet.
- Verification: Not run; prepare the full batch before focused checks. Context7 D1 resolve/query confirms ordered transactional batches (2026-10-10).
- Decisions and deviations: Preserve contracts, source validation, current-state index guards, all quotas and retry/lease limits. No paid capability or audit resume.
- Blockers/open questions: Actual Free CPU fit remains unproven.
- Next actions: Verify local concurrency/refusal/recovery and migration; then one fresh hosted CPU retry with backup and cleanup.
- Next-session cautions: d9ee49d is the committed prototype; new edits are uncommitted. Protect private backups/root drafts; G1/G2 and 13.G6 unchanged.

### 2026-10-10 — Dispatcher batching verified; native Cron evidence remains open

- Scope and checklist IDs: Cross-module support for Module09 B5; authorized performance tests/refactoring, with audit suspension preserved.
- Progress: 09.2e/09.3g verified; 09.1f/09.V6 remain open because native Cron execution was not observed.
- Change summary: Exact immutable timeline revisions hydrate the Minimum claim; canonical search admission and current-state guards remain unchanged. Module08 dispatch/retry closure remains valid.
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

### 2026-10-10 — Post-stop native profiling proposal prepared

- Scope and checklist IDs: Read-only review/proposal for Module09 09.1f/09.V6 and the Module08 search-meter seam.
- Progress: Revalidated the committed native 20 ms failure; no live test/owned resource remains. Approval for continuing after failures is pending.
- Change summary: Identify initialization/factory creation, layered metering and four D1 call boundaries as profiling targets; no CPU causality is claimed.
- Files/artifacts: [Prepared proposal](../evidence/09-async-validation.md#proposed-native-cpu-investigation-after-the-stop--2026-10-10), affected progress records; no application changes.
- Verification: Current Git status, native receipt and relevant source inspected; docs:build, relative-file links and diff hygiene pass. No hosted probe, implementation, dependency or migration.
- Decisions and deviations: Preserve all contracts/security/numeric ceilings. The explicit HANDOFF-09 stop requires a new human decision; automatic continuation does not override it.
- Blockers/open questions: Native CPU exceeds 10 ms; pending authorization to profile/refactor and run bounded native retries after failures.
- Next actions: Await the pending question's answer; if authorized, begin measured profiling and the relevant focused checks.
- Next-session cautions: Keep 09.1f/09.V6 open, 09.3e suspended and G1/G2/13.G6 unchanged. Do not restart completed test handles or stage protected/private files.

### 2026-10-11 — Continued performance investigation authorized

- Scope and checklist IDs: 09.1f/09.V6 and authorized Module08 metering seam.
- Progress: Human authorizes profiling/refactoring across profiles if needed and bounded native retries with cleanup after each attempt. Latest 20 ms native result remains unaccepted.
- Change summary: Resume investigation; preserve every contract, security check and numeric limit.
- Files/artifacts: Module09/master status, affected progress records; ignored local profiling helpers.
- Verification: Context7 Workers resolve/query on 2026-10-11 documents local CPU profiling and distinction from hosted CPU; implementation checks pending.
- Decisions and deviations: Human authorization supersedes HANDOFF-09 stop-after-bound-failure and historical pending-approval entries. No audit resume or gate closure.
- Blockers/open questions: Native canonical dispatch must fit 10 ms; local profiles cannot establish acceptance.
- Next actions: Profile measured costs, optimize demonstrated hotspots, focused checks and bounded native retries with cleanup.
- Next-session cautions: 09.1f/09.V6 open, 09.3e suspended, G1/G2 closed and 13.G6 open. No push/PR edit; protect root drafts, original data and backups.

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


### 2026-10-11 — Combined Minimum claim/search admission checkpoint

- Scope/checklist IDs: Authorized continuing 09.1f/09.V6 performance work and Module08 D1 search integration.
- Progress/change summary: Native module-graph r5 still fails at 12 ms against 10 ms; cleanup verified. Canonical claim/search admission now shares one atomic batch; all existing handler checks and numeric limits remain. Alternate JSON retains ordinary validation.
- Files/artifacts: D1 async/search budget/index/meter, workerd admission test, [evidence](../evidence/09-async-validation.md#native-module-graph-result-and-atomic-search-admission--2026-10-11), [r5 receipt](../evidence/09-hosted-native-module-retry-receipt.json).
- Verification: workerd6 plus D1 search13, availability unit28 and meter unit3 pass; typecheck/lint/boundaries/build/scoped format pass. Initial overly complex GLOB fixed without changing acceptance policy. No unchanged PostgreSQL rerun.
- Decisions/deviations: Human retry authorization persists. r5 source acknowledged but CPU fails; local provider-call reduction is not hosted acceptance. Original two Workers/domain mappings independently compared and preserved; r5 local inventory helper overwrote only private inventory/state, so comparison used preserved r4 baseline. No hosted mutation resulted.
- Blockers/open questions: 09.1f/09.V6 CPU and representative native recovery remain open. 09.3e suspended; G1/G2 closed, 13.G6 open.
- Next actions: Fresh bounded native r6 with new suffix/backup; maximum body and affected recovery only after canonical CPU fit; cleanup after each attempt.
- Next-session cautions: Preserve fresh reservation fencing, source quotas, post-I/O accounting and current projection checks; do not stage protected files or private logs; no push/PR edit.


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


### 2026-10-11 — Verified native wait and recovery evidence guards

- Scope/checklist IDs: Authorized09.1f/09.V6 continuation and Module08 post-I/O search boundary review; no audit resume.
- Progress/change summary: Same three R8 processes confirmed live; protected401 appears in live tail, separating a working observer from missing native execution. Reject early index/source acknowledgement coupling; tighten private native-fit/quota-refusal and deadline guards.
- Files/artifacts: [Verified wait record](../evidence/09-async-validation.md#verified-native-wait-and-stricter-recovery-harness--2026-10-11); ignored native guards/helpers.
- Verification: Live tool handles at20:27:48, active provider tail and401 witness at20:30, pending max source at20:31:30 UTC. Guard dry checks reject unobserved CPU/quota evidence; no hosted fixture mutation. Docs build, relative-file links, secrets and diff hygiene pass; no unchanged application lane repeated.
- Decisions/deviations: Preserve post-I/O metering and processor timeout/abort before source acknowledgement. Future watcher starts use explicit bounded handle deadlines; current watchers were not restarted and keep original bounds.
- Blockers/open questions: Native scheduling delay, maximum CPU and recovery remain unproven; project/provider10 ms unchanged.
- Next actions: Collect existing native outcome or deadline cleanup; only after fit perform guarded quota/job recovery. Compare140 baseline rows and original resources after cleanup.
- Next-session cautions: R8 deployedf6a1e9e; tail10791/monitor11882/watchdog4672, deadlines20:55:15.161/21:00:15.161 UTC2026-10-10. Source/job preparation differs from actual native proof. No inventory rerun, protected/private staging, push/PR edit, audit/gate closure.


### 2026-10-11 — Native maximum dispatch and quota recovery verified

- Scope and checklist IDs: Authorized 09.1f/09.V6 performance continuation; search/data/operational dependencies, no audit resume.
- Progress: Maximum title-only native dispatch10 ms, quota refusal2 ms and restored-quota recovery4 ms observed. Native checkpoint interruption/redeployment remains pending.
- Change summary: Publish actual R9 outcomes and independently verified cleanup; prepare a fresh bounded R10 invocation-abort/redeployment case with current16d6500 production job batching. No target revision.
- Files/artifacts: [Native results and procedure](../evidence/09-async-validation.md#declarative-native-dispatch-and-quota-recovery), [final R9 receipt](../evidence/09-hosted-native-declarative-retry-receipt.json), internal async runbook, ADR0014 and paired reader guides; ignored R10 helpers.
- Verification:145 original records/exact singleton sets/FKs preserved, owned resources/work zero, both original Workers/domain mappings preserved, all R9 handles terminal/absent. R10 fresh logical backup restores152 rows/59 tables; private classifier and post-commit fault checks pass, build/types/Wrangler dry-run pass. R10 deployed version8f47a018 has one Cron, CPU/outcome pending. Docs build,497 relative-file links,JSON,secret scan and diff hygiene pass. Formatter excludes docs by existing configuration, so no documentation formatter pass is claimed. No unchanged green application lane repeated.
- Decisions and deviations: Target/provider ceiling10 ms unchanged; maximum sample has no margin. Intentional uncaught native scheduled error after actual checkpoint commit proves invocation interruption if observed, not an OS kill. Full composition/billing/release acceptance remains separate.
- Blockers/open questions:09.1f/09.V6 await native job interruption/clean redeployment and preserved pending-event recovery.
- Next actions: Observe the existing R10 handles; after actual checkpoint1/exception verify exact witness, clean redeploy/resume and dispatch; finish independent cleanup and requirement audit.
- Next-session cautions: Respect R10 original deadlines in private live-handles; never rerun seeded inventory. No push/PR edit, protected/private staging, paid feature, audit/gate closure; G1/G2 closed,13.G6 open.


### 2026-10-11 — R10 stopped and cleaned; user resumes performance work

- Scope and checklist IDs: Authorized09.1f/09.V6 continuation; affected data/search/operational evidence dependencies.
- Progress: R10 ended when the goal service reported paused; latest human instruction explicitly continues optimization. No native scheduled frame or CPU result exists for R10.
- Change summary: Publish unaccepted trial and finish process housekeeping; replace active-wait status with verified cleanup. Target remains10 ms and title-only capacity reduction remains in force.
- Files/artifacts: [Stopped trial receipt](../evidence/09-hosted-native-job-trial-receipt.json), requirement audit and current evidence/progress; private terminal receipts.
- Verification:152 original records/exact singleton sets/FKs and original two Workers/domains/schedules/Queues/Workflows preserved; owned resources/work zero. Tail exit0; exact observer/guardian commands revalidated then SIGTERM, both handles exit143, PIDs absent. No native success inferred.
- Decisions and deviations: Explicit human continuation supersedes earlier pause for task work; goal service still shows paused and cannot be resumed through update_goal. Do not recreate the goal or mark it complete. No target increase or further reduction justified by unobserved execution.
- Blockers/open questions:09.1f/09.V6 still require native interruption/redeployment and full composed scheduled CPU evidence.
- Next actions: Use a fresh backup/inventory and new owned trial; profile a measured hotspot before another refactor.
- Next-session cautions: R10 is closed; never restart its observers/guardian or reuse its captured baseline for new mutations. Keep09.3e suspended,G1/G2 closed,13.G6 open; no protected/private staging,push/PR edit,paid feature or production action.


### 2026-10-11 — Composed CPU profile and fresh R11 native trial

- Scope and checklist IDs:09.1f/09.V6 performance continuation; data/search/operational evidence dependencies.
- Progress: Full local Minimum scheduled entry passes sixteen maximum200/32768 dispatches; cold sampled non-idle median6150.5us,warm2305.5us. These are diagnostics, not hosted acceptance. Fresh R11 is deployed with one declarative Cron.
- Change summary: Profile actual scheduled composition and replace selective fault instrumentation with the actual Minimum entry for all native stages. Guarded supervisor requires witnessed checkpoint1/exact[0] and pending source before clean redeployment; checkpoint2/exact[0,1] before max dispatch. No application edit or further capacity/target revision.
- Files/artifacts: [Local composed profile](../evidence/09-composed-local-profile.json), [R11 procedure](../evidence/09-async-validation.md#r11-composed-native-trial); ignored private backup/harness/artifacts.
- Verification: Fresh logical backup locally restores157 records/59 tables/FKs. Preflight Free user-attested adaptive headroom4997481 reads,99941 writes,99906 requests at03:38:56 UTC; not billing. Local composed fault commits only step0, raises intentional invocation exception and pauses for redeployment. Build/Wrangler dry-run pass; actual fault deploymenta814c618 at03:40 with one Cron. Native execution/CPU pending.
- Decisions and deviations: D1 call/result handling and title tokenization remain sampled costs; no evidence supports shortening canonical bodies further. Full startup is outside local invocation sampling. Refreshed expired OAuth with Wrangler; read-only backup retry after transient socket error succeeded before mutation. Context7 confirms Cron propagation/omitted-trigger preservation; returned CPU docs distinguish startup/paid limits but lack full tail accounting detail.
- Blockers/open questions: Native interruption/full composition CPU and clean resume remain unobserved;09.1f/09.V6 open.
- Next actions: Observe existing guarded stages; on any failed bound or original deadline remove owned resources/work and independently verify157 baseline records/singletons/original resources.
- Next-session cautions: R11 tail51403(PID71010),supervisor14232(PID71014),guardian9520(PID70920); native04:14:25.423 UTC,cleanup04:19:25.423 UTC. No inventory rerun,new simultaneous trial,protected/private staging,push/PR edit,paid override,audit/gate closure.


### 2026-10-11 — Composed job profiling and rejected tokenizer preparation

- Scope and checklist IDs:09.1f/09.V6 authorized performance investigation; search/data/operational evidence dependencies.
- Progress: Eight full composed local job isolates finish exact[0,1]/checkpoint2;9 statements/combined calls per tick,16 reads/9 writes. Sampled cold non-idle median3506.5us,warm2035us, diagnostic only.
- Change summary: Evaluate private startup tokenizer preparation; reject for production because a small cold median change is within broad overlap, max worsens and warm median rises. No application source,capacity,target or native trial version changes.
- Files/artifacts: [Composed local job profile](../evidence/09-composed-local-job-profile.json), [rejected tokenizer prototype](../evidence/09-tokenizer-startup-prototype.json), ongoing R11 evidence; private profiles.
- Verification: Sixteen composed scheduled job calls and sixteen prototype max200/32768 dispatches pass their witness/index/source checks. Prototype cold median5830.5us(range3475–9565),warm2652.5us versus baseline6150.5/2305.5; no causal/native speedup claim. R11 private fetch401 and live-tail request witnesses confirm working observation; no native scheduled frame yet at03:46.
- Decisions and deviations: Keep measured production16d6500 source stable while autonomous native supervisor builds its prepared clean variants. Module startup119ms is separately reported by actual deployment; local invocation sampling excludes it.
- Blockers/open questions: Native composed CPU/interruption/redeployment remains pending;09.1f/09.V6 incomplete.
- Next actions: Collect existing guarded native stages/deadline cleanup; validate final documentation and receipt against actual outcomes.
- Next-session cautions: R11 original handles/deadlines remain; do not deploy a rejected prototype, edit application source during supervisor-controlled builds,repeat green lanes or infer acceptance from local samples. No push/PR edit,audit or gate closure.


### 2026-10-11 — R11 native observation deadline and recovered cleanup

- Scope and checklist IDs:09.1f/09.V6 performance continuation and data/search/operational evidence dependencies.
- Progress: No native scheduled frame; provider history empty at04:47:45 UTC. Current main job pending/checkpoint0/no witnesses, cancelled sibling unchanged and maximum canonical source pending/unindexed. No CPU failure inferred.
- Change summary: Guardian reached04:19 deadline but failed authentication before cleanup. Refreshed credentials, inspected actual current resources/data before mutations, then independently completed cleanup; all handles terminal/PIDs absent.
- Files/artifacts: [Unaccepted composed Cron receipt](../evidence/09-hosted-composed-cron-trial-receipt.json), current evidence/audit/progress; private cleanup and terminal receipts.
- Verification:157 original records/exact singleton sets/FKs restored; original two Workers/domain mappings/schedules/Queues/Workflows preserved. Owned resources/outbox/deliveries/jobs/steps/search zero; one timeline/one audit entry and inactive fixtures retained. Tail exit1,supervisor0,guardian1 are actual terminal outcomes; failed guardian history preserved.
- Decisions and deviations: R11 closed; goal service nowactive. Preserve10ms and title-only capacity. New short hosted authenticated HTTP fixture may measure actual scheduled function and D1 interruption/redeployment with honest invocation labeling; it cannot replace native Cron evidence.
- Blockers/open questions: Native Cron missing across bounded trials;09.1f/09.V6 remain incomplete. Native scheduling requires external execution; no accepted full-profile/billing/paid performance claim.
- Next actions: Fresh backup/inventory before new mutation; collect whole composed hosted function CPU and actual D1 job recovery, then revisit measured hotspots/native scheduling proof.
- Next-session cautions: Never restart R11 processes or reuse its157-record baseline for new mutation. Do not publish success-only receipt or deploy rejected tokenizer candidate. Keep09.3e suspended,G1/G2 closed,13.G6 open; no protected/private staging,push/PR edit,paid feature or production action.
