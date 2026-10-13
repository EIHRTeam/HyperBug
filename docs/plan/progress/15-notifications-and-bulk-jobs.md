# 15 progress — Post-MVP subscriptions, notifications, bulk actions, and data jobs

Plan: [Detailed checklist](../modules/15-notifications-and-bulk-jobs.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: Post-MVP core
- Prerequisites: 14 complete; queue/workflow foundation from 09. Backend acceptance precedes this module's UI.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 15.1, after prerequisites are satisfied.
- Last updated: 2026-09-17.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 15.1 | Define notification and job contracts | Not started | None yet |
| 15.2 | Implement and accept backend behavior | Not started | None yet |
| 15.3 | Implement and accept the frontend | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 15.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

Core owns subscriptions, event semantics, authorization, and durable jobs. Delivery channels and external import/export formats remain optional plugins.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 15; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for post-mvp subscriptions, notifications, bulk actions, and data jobs.
- Files/artifacts: `docs/plan/modules/15-notifications-and-bulk-jobs.md`; `docs/plan/progress/15-notifications-and-bulk-jobs.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 15.1.
- Next-session cautions: Core owns subscriptions, event semantics, authorization, and durable jobs. Delivery channels and external import/export formats remain optional plugins.


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

- Scope and checklist IDs: Post-MVP plan-only alignment; no implementation item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior notification/bulk planning text; no post-MVP implementation was added.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Post-MVP prerequisites remain open.
- Next actions: Keep Module 15 untouched during the feature hold.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.
