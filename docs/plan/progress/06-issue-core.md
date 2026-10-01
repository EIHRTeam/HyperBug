# 06 progress — Projects, issues, discussion, and triage backend

Plan: [Detailed checklist](../modules/06-issue-core.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress
- Delivery scope: MVP backend
- Prerequisites: 05 complete (2026-10-01; audit remainders closed by the parallel session in commit db90248).
- Implementation started: Yes (2026-10-01).
- Completed implementation checklist IDs: 06.1a, 06.1b.
- Active/next checklist group: 06.2 (06.2a next: the Issue lifecycle on the module-02 repository).
- Last updated: 2026-10-01 (06.1a + 06.1b accepted; step 06.1 delivered except 06.1c's suspended audit portion).
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 06.1 | Implement project and taxonomy services | 06.1a/06.1b accepted 2026-10-01; 06.1c non-audit scope delivered, audit portion suspended | [06 batch entry](#2026-10-01--batch-061a--061b-accepted-project-and-taxonomy-services) |
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

### 2026-10-01 — Batch 06.1a + 06.1b accepted (project and taxonomy services)

- Scope and checklist IDs: 06.1a and 06.1b accepted; 06.1c's non-audit scope (per-project uniqueness, reference ownership, disabled/removed taxonomy behavior, permissions) is delivered through these stores while its audit portion stays suspended — the item stays unchecked. Intended batch recorded above before implementation.
- Progress: The project service is live on both profiles — Staff-only creation with the creator's first `administrator` grant written atomically with the project row (D1 batch / PostgreSQL transaction), slug uniqueness with normalized-lowercase validation (no silent normalization), visibility-aware reads where private projects answer the closed 404 to anonymous callers and non-members, revision-conditional configuration under the sensitive `project:configure` permission, and archive as the destructive surface (read-only afterwards). The taxonomy service is live on both profiles — labels, issue types and milestones under the new `taxonomy:manage` permission (maintainer-or-higher, non-sensitive), name-key uniqueness preserving display spelling, disabled issue types, revision-conditional updates, reference-checked removals (`TAXONOMY_CONFLICT` while any issue references the entry), real-calendar due dates, and milestone open/closed progress derived from one bounded grouped query. Assignee eligibility is schema-enforced (the `issue_assignees` membership foreign key) and will be exercised by the 06.2 assignment routes. No project/taxonomy audit event exists or is emitted (suspension respected, asserted in both route suites).
- Change summary: Application ports and validators (`projects.ts`, `taxonomy.ts`); D1 and PostgreSQL adapters for both stores; the `taxonomy:manage` permission rule; project/taxonomy contract schemas; `REVISION_CONFLICT`/`PROJECT_*`/`TAXONOMY_*` error codes; server handler modules with a shared visibility pre-check; routes and route labels (`project.read`, `project.manage`, `project.taxonomy`); Node root (through abuse-admission), Workers root and fixture wiring; API-CONVENTIONS documentation.
- Files/artifacts: `packages/application/src/{projects,taxonomy}.ts`; `packages/database/d1/src/{projects,taxonomy}.ts`; `packages/database/postgres/src/{projects,taxonomy}.ts`; `packages/application/src/index.ts`; both `packages/database/*/src/index.ts`; `packages/security/src/authorization.ts`; `packages/contracts/src/index.ts`; `packages/observability/src/index.ts`; `packages/server/src/{errors,projects,taxonomy,index}.ts`; `apps/api-node/src/{abuse-admission,index}.ts`; `apps/api-cloudflare/src/index.ts`; `tests/fixtures/account-worker.ts`; `tests/unit/projects.test.ts`; `tests/workerd/project-route.test.ts`; `tests/postgres/project-route.test.ts`; `docs/API-CONVENTIONS.md`; `docs/plan/modules/06-issue-core.md`; this record.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix (root + both Cloudflare projects), format:check (293 files), unit 196/196, contract 1/1, node 50/50, workerd 130/130 (including the new project-route journey), isolated PostgreSQL 70/70 (including the new project-route journey), build (all targets), db:check both dialects (the two pre-existing journal-timestamp warnings from the reconstructed 05.2a snapshots remain), docs build, secret and license scans all passed. Local/emulated only; no deployed claim. Two route-test corrections during the batch: the milestone update schema's `dueDate` became optional, and the archive route passed `body.expectedRevision` rather than the body object.
- Decisions and deviations: (1) Staff-only creation with an atomic first-administrator grant — the permission inventory has no deployment-scope target and no `project:create` rule, so creation is guarded by the staff-kind/active check, matching module 04's membership route. (2) Archive is 06.1a's destructive surface; projects carry no deleted marker and DATA-MODEL requires archive-before-controlled-deletion with retention durations owned by the retention workflow. (3) `taxonomy:manage` added to the security permission catalog (project target, write, maintainer role, non-sensitive) to carry the API-OPERATIONS maintainer-or-higher taxonomy rows — a catalog extension within the designed inventory, not a baseline change. (4) Taxonomy name keys normalize case and spacing only; display names keep the author's spelling.
- Blockers/open questions: None new. The G1 audit-governance decision remains with the user.
- Next actions: 06.2a — the Issue lifecycle on the module-02 repository (create/list/detail/edit with project-local number allocation, raw Markdown, taxonomy/assignment fields, revision checks), extending the repository contract where 06.2c's non-audit atomicity (timeline + outbox rows) requires it.
- Next-session cautions: 06.1c's audit portion must not resume implicitly; archive is the only destructive project surface; taxonomy name keys are the uniqueness domain (display names may visually repeat).

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
