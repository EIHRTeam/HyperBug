# 06 progress — Projects, issues, discussion, and triage backend

Plan: [Detailed checklist](../modules/06-issue-core.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: MVP backend
- Prerequisites: 05 complete.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 06.1, after prerequisites are satisfied.
- Last updated: 2026-09-30 (plan amendment recording re-scoped Phase 03 ownership; no implementation).
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 06.1 | Implement project and taxonomy services | Not started | None yet |
| 06.2 | Implement the Issue lifecycle | Not started | None yet |
| 06.3 | Implement discussion and timeline | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 06.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

Keep Open/Closed as the core state model and project-local numbers distinct from internal IDs. Do not expand MVP into a workflow designer.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 06; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for projects, issues, discussion, and triage backend.
- Files/artifacts: `docs/plan/modules/06-issue-core.md`; `docs/plan/progress/06-issue-core.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 06.1.
- Next-session cautions: Keep Open/Closed as the core state model and project-local numbers distinct from internal IDs. Do not expand MVP into a workflow designer.


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
- Change summary: Retained prior issue-core checklist wording; no issue route or product behavior was added.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Module prerequisites and acceptance remain open.
- Next actions: Keep Module 06 untouched during the feature hold.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-09-30 — Phase 03 re-scope ownership recorded

- Scope and checklist IDs: Planning amendment only; no implementation checklist item was executed or checked. Affects this module's future project routes.
- Progress: A user-directed plan re-scope formally assigned module 06 ownership of the project-dimension rate-limit categories deferred from module 03's 03.3c/03.3d: they are wired to this module's project routes using module 03's frozen category-dimension policy, with production budget numbers measured under the staging real-load budget milestone rather than inferred from local fixtures. This allowed module 03 to be recorded as compliantly complete with its deferred remainder explicit.
- Change summary: The module plan's outcome section gained a "Deferred Phase 03 scope owned here (2026-09-30 re-scope)" note.
- Files/artifacts: `docs/plan/modules/06-issue-core.md`; this record; see the [closure matrix](../evidence/03-closure-matrix.md) and master progress for the re-scope record.
- Verification: Documentation-only amendment; no application tests were run because no application behavior changed. Shared batch checks (docs build and changed-file review) are recorded in the master session entry.
- Decisions and deviations: None beyond the recorded re-scope; this module remains Not started and its audit portions remain suspended per the [suspension register](../AUDIT-SUSPENSION.md).
- Blockers/open questions: None introduced; prerequisites (modules 04–05) are not yet complete.
- Next actions: Unchanged — begin 06.1 after module 05 completes; wire the re-scoped project categories with the project routes and measure budgets at the staging milestone.
- Next-session cautions: The re-scope adds scope to this module's project routes; it does not authorize starting module 06 early or resuming suspended audit work.
