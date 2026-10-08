# 08 progress — Structured search, filters, and query performance

Plan: [Detailed checklist](../modules/08-search-and-query.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress
- Delivery scope: MVP backend
- Prerequisites: 07 complete; event contracts from 02, async dispatch completed in 09.
- Implementation started: B1 specification, runtime-independent AST/bounds and shared fixture preparation; no parser/store/route implementation yet.
- Completed checklist IDs: 08.1a, 08.1c, 08.1d, 08.1e (specification outcomes only). 08.1b semantics are specified; runtime support remains unchecked until B2.
- Active/next checklist group: Verify B1 (08.1a–e); obtain the handoff-required specification/endpoint approval before B2.
- Last updated: 2026-10-09.
- Blocking issues discovered: B2 requires explicit approval of SEARCH-SPEC, numeric bounds, AST version and endpoint shape. Module 09 dispatch/queue acceptance remains a separate integration handoff.
- Evidence: [B1 specification validation](../evidence/08-search-validation.md); runtime search acceptance remains unperformed.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 08.1 | Define public query semantics | B1 verified; 08.1b runtime support pending | [SEARCH-SPEC](../../SEARCH-SPEC.md) |
| 08.2 | Implement database compilers and index lifecycle | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. B1 static/unit/contract verification passed; commit it on `feat/v1` and leave parser/store acceptance unchecked.
2. Obtain user approval of [SEARCH-SPEC](../../SEARCH-SPEC.md), bounds, AST v1 and proposed dedicated project search/suggestion routes before B2 code or migrations.
3. B2 implements parser/validation and dual-store compilers/cursors; B3 lifecycle/current authorization/measurements; B4 handlers/tier budgets. Module 09 dispatch and queue/retry verification remain open.

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
