# 06 progress — Projects, issues, discussion, and triage backend

Plan: [Detailed checklist](../modules/06-issue-core.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress
- Delivery scope: MVP backend
- Prerequisites: 05 complete (2026-10-01; audit remainders closed by the parallel session in commit db90248).
- Implementation started: Yes (2026-10-01).
- Completed implementation checklist IDs: 06.1a, 06.1b, 06.2a, 06.2b, 06.2d, 06.2e, 06.3a, 06.3b, 06.3c, 06.3d, 06.3e.
- Active/next checklist group: acceptance (06.V1 next).
- Last updated: 2026-10-01 (06.3 discussion accepted; steps 06.1–06.3 delivered except the suspended 06.1c/06.2c audit portions).
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 06.1 | Implement project and taxonomy services | 06.1a/06.1b accepted 2026-10-01; 06.1c non-audit scope delivered, audit portion suspended | [06 batch entry](#2026-10-01--batch-061a--061b-accepted-project-and-taxonomy-services) |
| 06.2 | Implement the Issue lifecycle | 06.2a/b/d/e accepted 2026-10-01; 06.2c non-audit scope delivered, audit portion suspended | [06.2 batch entry](#2026-10-01--batch-062-accepted-issue-lifecycle-triage-projections-cache-spec) |
| 06.3 | Implement discussion and timeline | 06.3a–06.3e accepted 2026-10-01 | [06.3 batch entry](#2026-10-01--batch-063-accepted-comments-reactions-merged-timeline) |

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

### 2026-10-01 — Batch 06.3 accepted (comments, reactions, merged timeline)

- Scope and checklist IDs: 06.3a–06.3e accepted. Intended batch recorded above before implementation.
- Progress: The discussion surface is live on both profiles. Comments are body-only raw Markdown with 24-hour idempotency receipts (comment row, first history row, outbox row and receipt in one atomic operation), ascending cursor pagination, immutable per-revision history restricted to `issue:moderate` holders, own-content editing under the moderation lock, visible/hidden/redacted moderation, and tombstone deletion that keeps bodies staff-restricted (public reads see only visible non-deleted rows; moderator permalink reads show withheld bodies). Reactions carry the eight-value allowlist with idempotent add/remove through the schema's unique actor/target/value constraint (`added`/`present`/`removed`/`absent`), bounded grouped count endpoints, and `reaction`-category admission on principal+project. The merged timeline is one UNION read ordering events and comments by `(created_at, id)` with the same cursor contract, audience-filtered rows and safe actor DTOs (principal ids or fixed system-actor names). `comment-create`/`reaction` categories consume the frozen module-03 dimension policy with provisional local budgets. No comment/timeline audit events exist (no suspended 06.3 item covers them, but the module-wide audit suspension is respected).
- Change summary: Application ports and validators for comments, reactions and the timeline (with per-resource cursor codecs); both-dialect adapters (atomic comment mutations, idempotent reaction writes, grouped counts, merged timeline reads); a shared server mutation-identity module; the discussion server module; contract schemas including the flattened timeline item (a discriminated union cannot cross the response validation boundary); seventeen routes and the `issue.discussion` route label; `requireRate` (rate-only admission) already landed with 06.2; both roots and fixture wired; both-profile journeys; API-CONVENTIONS documentation.
- Files/artifacts: `packages/application/src/{comments,reactions,timeline}.ts`; `packages/database/{d1,postgres}/src/comments.ts`; `packages/server/src/{discussion,mutation-identity,index}.ts`; `packages/contracts/src/index.ts`; `packages/observability/src/index.ts`; `apps/api-node/src/{abuse-admission,index}.ts`; `apps/api-cloudflare/src/index.ts`; `tests/fixtures/account-worker.ts`; `tests/workerd/discussion-route.test.ts`; `tests/postgres/discussion-route.test.ts` (authored by a parallel subagent, verified here); `docs/API-CONVENTIONS.md`; `docs/plan/modules/06-issue-core.md`; this record.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check (305 files), unit 197/197, contract 1/1, node 50/50, workerd 132/132 (including the discussion journey), isolated PostgreSQL 18.6 72/72 (including the subagent-authored discussion journey after two corrections below), build, db:check both dialects (D1 0017 / PostgreSQL 0016 unchanged), docs build, secret and license scans all passed. Local/emulated only. Corrections during the batch: (1) a template bug produced `ON CONFLICT ((cols))` — double parentheses that match no constraint; the reaction uniques existed in migration 0003 all along, and a speculative duplicate-index migration was generated and reverted before commit. (2) The timeline UNION aligned `revision` with `moderation` by position — both dialects' event arms now order columns identically. (3) The PostgreSQL timeline cursor bound one unreferenced parameter — rewritten to bind each value once. (4) Re-deleting a tombstoned comment answers the closed 404.
- Decisions and deviations: (1) Comments never bump the issue aggregate revision; they merge into the timeline at read time. (2) The timeline item schema is flattened (optional action/systemActor/moderation/deleted/body fields) because a discriminated union fails Elysia's response validation on both profiles. (3) Reaction writes return outcome states rather than resource counts; count endpoints are separate bounded reads. (4) 06.3d's mention extraction is deferred to module 07's representation pipeline; the bounds that exist today are fixed (comment size, taxonomy cardinality, one bounded event per mutation).
- Blockers/open questions: None new. The G1 audit-governance decision remains with the user.
- Next actions: 06.V1–06.V4 — the acceptance matrix: the HTTP workflow journey on both profiles, the principal-class/visibility/moderation matrix, concurrency/idempotency/rollback checks, and query-count/indexed-plan comparisons.
- Next-session cautions: 06.1c/06.2c audit portions must not resume implicitly; migrations remain at D1 0017 / PostgreSQL 0016; the timeline UNION's column order is position-matched — any new column must be added to both arms.

### 2026-10-01 — Batch 06.2 accepted (issue lifecycle, triage, projections, cache spec)

- Scope and checklist IDs: 06.2a, 06.2b, 06.2d and 06.2e accepted; 06.2c's non-audit scope accepted (atomic mutation/timeline/outbox writes, idempotency receipts, stable conflicts) while its audit portion stays suspended — the item stays unchecked. Intended batch recorded above before implementation.
- Progress: The full issue lifecycle is live on both profiles. The module-02 repository contract grew taxonomy-bearing creation, six triage mutation operations (close/reopen/labels/assignees/type/milestone), batched relation hydration and moderation-aware reads; every mutation writes its aggregate row, timeline event and outbox row in one atomic operation with a 24-hour idempotency receipt, bumps the aggregate revision (the one-timeline-event-per-revision uniqueness makes the revision the event sequence), and treats a same-value set operation as a no-op without an event. Routes: create/list/detail/edit, close/reopen, and the four triage set operations, with `issue-create`-category rate admission on principal+project dimensions (provisional local budgets: principal 60/hour, project 1200/hour; production numbers stay a staging-milestone measurement), the Idempotency-Key header contract, own-content editing with the moderation lock, hidden/redacted rows visible only through `issue:moderate`, and list projections that exclude the Markdown body and hydrate relations in two bounded queries. The 06.2e cache-eligibility specification is recorded in API-CONVENTIONS: today everything stays no-store; only anonymous-public representations could ever become eligible, keyed and invalidated by the aggregate revision, with personalized/private/moderated classes permanently ineligible. No `issue.*` audit event exists (suspension respected, asserted in both route suites).
- Change summary: Application contract extension (eight intents, cardinality bounds, per-operation validation); both repository adapters rewritten around the extended mutate core (D1 batch / PostgreSQL transaction) with in-transaction reference checks; `requireRate` on the bound admission (rate-only path for authenticated route classes); the issues server module; contract schemas; `IDEMPOTENCY_*`/`INVALID_CURSOR`/`ISSUE_*` error codes; eleven routes and three route labels; both roots and the fixture wired with the repository; route journeys on both profiles; API-CONVENTIONS documentation.
- Files/artifacts: `packages/application/src/index.ts`; `packages/database/d1/src/index.ts`; `packages/database/postgres/src/index.ts`; `packages/server/src/{issues,sensitive-admission,errors,index}.ts`; `packages/contracts/src/index.ts`; `packages/observability/src/index.ts`; `apps/api-node/src/{abuse-admission,index}.ts`; `apps/api-cloudflare/src/index.ts`; `tests/fixtures/{account-worker,database-worker,repository-contract,migration-contract}.ts`; `tests/workerd/{repository,issue-route}.test.ts`; `tests/postgres/issue-route.test.ts`; `tests/unit/pagination.test.ts`; `docs/API-CONVENTIONS.md`; `docs/plan/modules/06-issue-core.md`; this record.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check (296 files), unit 197/197, contract 1/1, node 50/50, workerd 131/131 (including the 13-event lifecycle journey with timeline/outbox/receipt assertions), isolated PostgreSQL 18.6 71/71, build, db:check both dialects, docs build, secret and license scans all passed. Local/emulated only. Corrections during the batch: the create guard target must be the project (not an issue-typed id), a replayed idempotent create answers with the original aggregate id, and same-value set operations were verified as no-ops rather than revision bumps.
- Decisions and deviations: (1) Every mutation bumps the aggregate revision — required by the schema's one-timeline-event-per-revision uniqueness and it makes the revision a total event order. (2) Same-value set operations are no-ops without events (no receipt is written; the speculative insert rolls back). (3) Idempotency-Key is optional: without the header a one-shot receipt still participates in the atomic write but no retry can match it. (4) `issue:read` list collections target the project (`project:read`) while detail reads target the issue; hidden rows additionally require `issue:moderate`. (5) Close only from open and reopen only from closed answer `REVISION_CONFLICT` — stable conflicts, no arbitrary state machine. (6) The rate-only `requireRate` admission path carries authenticated route classes without a CAPTCHA leg; CAPTCHA remains tied to the account surfaces.
- Blockers/open questions: None new. The G1 audit-governance decision remains with the user.
- Next actions: 06.3a/06.3b — comments with permalinks/history/moderation and Issue/Comment reactions, then the merged timeline (06.3c) and bounds/events (06.3d), contracts (06.3e).
- Next-session cautions: 06.2c's audit portion must not resume implicitly; the repository's mutate core is shared by all eight operations — extend it, do not fork it; the provisional rate budgets are local-only numbers.

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
