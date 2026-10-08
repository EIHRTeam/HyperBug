# 08 progress — Structured search, filters, and query performance

Plan: [Detailed checklist](../modules/08-search-and-query.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress
- Delivery scope: MVP backend
- Prerequisites: 07 complete; event contracts from 02, async dispatch completed in 09.
- Implementation started: B1 specification, runtime-independent AST/bounds and shared fixture preparation; no parser/store/route implementation yet.
- Completed checklist IDs: 08.1a–e, 08.2a/b/d, 08.V1/V2. Dispatch/queue and B3/B4 lifecycle/budget acceptance remain open.
- Active/next checklist group: B3 08.2c/f/g and 08.V3/V4.
- Last updated: 2026-10-09.
- Blocking issues discovered: None for B2; the user approved SEARCH-SPEC/bounds/AST/endpoint shape. Module 09 dispatch/queue acceptance remains a separate integration handoff.
- Evidence: [B1 specification validation](../evidence/08-search-validation.md); runtime search acceptance remains unperformed.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 08.1 | Define public query semantics | Complete, B1/B2 locally verified | [SEARCH-SPEC](../../SEARCH-SPEC.md) |
| 08.2 | Implement database compilers and index lifecycle | B2 compilers/cursors verified; B3/B4 remain | [Search evidence](../evidence/08-search-validation.md) |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Commit verified B2, then implement B3 08.2c/f/g with canonical authorization/readiness, bounded initial indexing/reconciliation and representative query measurements (08.V3/V4).
2. B4 implements version-aware handlers, explicit operator reindex and tier budgets; verify local replay/quota/row bounds.
3. Keep 08.2e dispatch and 08.V5 queue/retry integration open for Module 09; no remote acceptance/gate closure.

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
