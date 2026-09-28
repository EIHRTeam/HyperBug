# 12 progress — Public feedback, discussion, and staff web workflows

Plan: [Detailed checklist](../modules/12-web-product-workflows.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: MVP frontend
- Prerequisites: 11 complete; only consume capabilities accepted in 10.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 12.1, after prerequisites are satisfied.
- Last updated: 2026-09-17.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 12.1 | Implement discovery and navigation | Not started | None yet |
| 12.2 | Implement Issue submission and discussion | Not started | None yet |
| 12.3 | Implement triage and administration | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 12.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

Do not make UI visibility an authorization control. Preserve drafts during recoverable failures without persisting credentials or leaking one user's data to another.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

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
