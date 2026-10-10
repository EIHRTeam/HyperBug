# 06 progress — Projects, issues, discussion, and triage backend

Plan: [Detailed checklist](../modules/06-issue-core.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete (2026-10-01; 06.1c/06.2c audit portions suspended as explicit deferred remainders)
- Delivery scope: MVP backend
- Prerequisites: 05 complete.
- Implementation started: Yes (2026-10-01).
- Completed implementation checklist IDs: 06.1a, 06.1b, 06.2a, 06.2b, 06.2d, 06.2e, 06.3a, 06.3b, 06.3c, 06.3d, 06.3e, 06.V1, 06.V2, 06.V3, 06.V4.
- Active/next checklist group: None — module complete except the suspended audit portions.
- Last updated: 2026-10-03 (Module 07 scanner-hook integration follow-up).
- Blocking issues discovered: None for Module 06 completion; suspended audit remainders remain deferred.
- Evidence: [Issue Core validation](../evidence/06-issue-core-validation.md); later Module 07 integration evidence is appended below.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 06.1 | Implement project and taxonomy services | 06.1a/06.1b accepted 2026-10-01; 06.1c non-audit scope delivered, audit portion suspended | [06 batch entry](#2026-10-01--batch-061a--061b-accepted-project-and-taxonomy-services) |
| 06.2 | Implement the Issue lifecycle | 06.2a/b/d/e accepted 2026-10-01; 06.2c non-audit scope delivered, audit portion suspended | [06.2 batch entry](#2026-10-01--batch-062-accepted-issue-lifecycle-triage-projections-cache-spec) |
| 06.3 | Implement discussion and timeline | 06.3a–06.3e accepted 2026-10-01 | [06.3 batch entry](#2026-10-01--batch-063-accepted-comments-reactions-merged-timeline) |
| Acceptance | 06.V1–06.V4 | Accepted 2026-10-01 on both profiles | [Acceptance entry](#2026-10-01--acceptance-batch-06v106v4-accepted-module-06-complete) and [validation evidence](../evidence/06-issue-core-validation.md) |

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

### 2026-10-01 — 06.V1 acceptance journeys authored and verified (subagent session)

- Scope and checklist IDs: 06.V1 — the ordered HTTP workflow (project → create → list → comment → react → label/assign/type/milestone → close → reopen → merged timeline) exercised end-to-end through the real HTTP API on both deployments. Checklist marking stays with the coordinating session pending its review.
- Progress: Both journeys pass — workerd/D1 1/1 and Node/PostgreSQL 1/1 (isolated cluster, dedicated database `hyperbug_acceptance_v1_test`). The asserted merged-timeline order: `issue.create` → the two comment items interleaved at their timestamps → `issue.labels` → `issue.type` → `issue.milestone` → `issue.assignees` → `issue.close` → `issue.reopen`, with event revisions strictly increasing 1–7, comment ids in creation order, `nextCursor` null on the exhausted page, and `Cache-Control: no-store` asserted on list/timeline responses. Every mutation asserted and reused the returned revision.
- Change summary: Two new acceptance journey files; no production code touched. One production-behavior observation for the coordinating session: the merged timeline carries comment bodies only for `issue:moderate` holders — anonymous and non-moderator timeline reads return comment items as metadata only (the adapter selects `NULL AS body` unless `includeHidden`), even on public projects where the comment list endpoint returns bodies to the same audience. The API-CONVENTIONS sentence "a comment item carries its body only when visible and not deleted" does not make the moderator-only body scope explicit. The journeys assert the implemented behavior for both audiences rather than assuming the documented phrasing.
- Files/artifacts: `tests/workerd/acceptance-journey.test.ts`; `tests/postgres/acceptance-journey.test.ts`; this record.
- Verification: `corepack pnpm test:workerd tests/workerd/acceptance-journey.test.ts` 1/1; `corepack pnpm test:postgres tests/postgres/acceptance-journey.test.ts` 1/1 (both re-run after formatting); `npx oxfmt --check` clean on both files; `npx oxlint --deny-warnings` clean on both files; `corepack pnpm typecheck` green. The module-03 audit-query evidence snapshots showed no drift after the PostgreSQL run (`git checkout --` executed as a precaution; nothing needed restoring).
- Decisions and deviations: The journey issue is created plain (no taxonomy at creation) so each staff triage set operation produces its timeline event; taxonomy-bearing creation stays covered by the issue-route suites. Dedicated OAuth client id `acceptance-cli` and suite-unique slugs (`journey-v1` workerd, `pg-journey-v1` PostgreSQL). No DELETE occurs in the V1 workflow, so the JSON-only DELETE-with-`body: {}` boundary rule is noted but not exercised here.
- Blockers/open questions: None blocking. The moderator-only timeline body scope may deserve an explicit product/documentation confirmation.
- Next actions: Coordinating session reviews and marks 06.V1; 06.V2–06.V4 continue with their owning subagents.
- Next-session cautions: Comments never bump the issue revision, so timeline interleaving rides on `(created_at, id)`; revisions 1–7 in this journey are issue events only.

### 2026-10-01 — 06.V3 concurrency acceptance authored and verified (subagent session)

- Scope and checklist IDs: 06.V3 — concurrent creates/edits/reactions, racing duplicate Idempotency-Key requests, rollback after a timeline-event failure, and timeline pagination under equal timestamps, on both profiles. Checklist marking stays with the coordinating session pending its review.
- Progress: Both suites pass — workerd/D1 1/1 and Node/PostgreSQL 1/1 (isolated cluster, database `hyperbug_acceptance_v3_test`). Observed per-dialect behavior: five parallel creates always yield numbers exactly 1–5 (D1 serializes the atomic batches; PG serializes on the `projects` row lock); parallel same-revision edits answered [200, 409] in 15/15 observed runs on both profiles (PG deterministic via `SELECT … FOR UPDATE`, loser body `error.code = REVISION_CONFLICT`; on D1 the loser failed the pre-read each time — the adapter also has a batch-race path that would surface 503, so the D1 assertion accepts 409 or 503 while still requiring exactly one revision bump and exactly one `issue.edit` event); racing duplicate-key creates both answer 201 with the same id and one consumed number; concurrent same-actor reaction adds collapse to `added` + `present` with count exactly 1 (two distinct actors racing land count 2 — the per-value count counts reacting principals); the seeded-revision edit fails 503 on both profiles with the issue row, `issue.edit` event, `issue.edit` outbox row and receipt all absent (full rollback), then succeeds after the seed is removed; six equal-millisecond comments paginate [2,2,2,1] with the walk matching the direct-read `(created_at, id)` order exactly and re-read cursors returning identical pages.
- Change summary: Two new acceptance files; no production code touched. Two production observations for the coordinating session: (1) when the D1 edit mutation loses the atomic-batch race (its pre-read precedes the winner's commit), the raw batch error maps to 503 `ISSUE_UNAVAILABLE` instead of 409 `REVISION_CONFLICT` — never observed in local runs, but reachable per the adapter code path (`packages/database/d1/src/index.ts` rethrows after the receipt lookup misses); (2) removing the seeded blocker required dropping and recreating the append-only DELETE trigger/guard as a migration owner would, because `timeline_events` blocks DELETE on both dialects (D1 trigger, PG `reject_history_mutation`) — the spec's "DELETE the seeded row" is impossible through plain DML.
- Files/artifacts: `tests/workerd/acceptance-concurrency.test.ts`; `tests/postgres/acceptance-concurrency.test.ts`; this record.
- Verification: `corepack pnpm test:workerd tests/workerd/acceptance-concurrency.test.ts` 1/1 (10 stability runs plus final); `corepack pnpm test:postgres tests/postgres/acceptance-concurrency.test.ts` 1/1 (5 stability runs plus final); `npx oxfmt --check` clean; `npx oxlint --deny-warnings` clean on both files; `npx tsc --noEmit` reports no errors in either file (the repo-wide typecheck was red only in sibling acceptance files owned by other subagents at the time). The module-03 audit-query evidence snapshots showed no drift after the PostgreSQL runs (`git checkout --` executed as instructed; nothing needed restoring).
- Decisions and deviations: Dedicated OAuth client id `concurrency-cli` and suite-unique slugs (`concurrency` workerd, `pg-concurrency` PostgreSQL); PG pool max raised to 12 so parallel mutations genuinely overlap instead of serializing on pool checkout; the D1 concurrent-edit assertion accepts the 409/503 pair rather than only 409 because both are real adapter outcomes that prove serialization, with the 503 path reported above; the equal-timestamp walk asserts the full 7-item order against a direct database read rather than assuming the create event sorts first (it shares the millisecond only if the issue and first comment land in the same one).
- Blockers/open questions: None blocking. The D1 503-on-batch-race mapping is flagged for a product decision (map to `REVISION_CONFLICT` or accept as fail-closed).
- Next actions: Coordinating session reviews, decides the 503 mapping question and marks 06.V3.
- Next-session cautions: Do not relax the append-only guard handling in the rollback section without a migration-owner justification; the D1 loser-status assertion intentionally spans {409, 503}.

### 2026-10-01 — 06.V2 negatives matrix authored and verified (subagent session)

- Scope and checklist IDs: 06.V2 — principal classes (anonymous, authenticated User, project Staff, and a membership revoked after setup), own-versus-others editing under the moderation lock, cross-project ids, removed assignees plus deleted/disabled taxonomy, hidden/redacted content, and direct API access. Full matrix on workerd/D1; the Node/PostgreSQL spot-check covers cross-project ids plus removed assignees/taxonomy. Checklist marking stays with the coordinating session pending its review.
- Progress: Both suites pass — workerd/D1 1/1 and Node/PostgreSQL 1/1 (isolated cluster, dedicated database `hyperbug_acceptance_v2_test`). The workerd matrix asserts 104 expectations across the six areas; the PostgreSQL spot-check asserts 39. Notable verified rows: password-token member grant answers 403 `REAUTHENTICATION_REQUIRED` before any ceremony and 200 after; a triage member exercises triage, then the same call answers 403 `FORBIDDEN` after member deletion while public reads stay 200; cross-project labelIds/typeId/milestoneId creations answer 400 `ISSUE_INVALID` and a foreign issue id answers 404 both on read and triage; assignment targeting the de-membered principal answers 400; deleted label/milestone/type ids answer 400 on triage and creation; a disabled type refuses new assignment while an issue already carrying it keeps the typeId; a hidden issue answers 404 for anonymous/User/own-author and stays staff-visible/editable; hidden and redacted comments vanish publicly while the moderator keeps permalink/list/timeline rows (redacted body withheld in the staff timeline); a no-Origin no-token client reads all public representations and receives 401 on every mutation family (19 mutation rows).
- Change summary: Two new acceptance files; no production code touched. Production observations for the coordinating session: (1) suspected defect — the merged timeline and the comment list of a hidden issue stay readable for every audience (`issueTimeline`/`listComments` never check the issue's own moderation) while the issue detail answers 404; the timeline row is pinned to current behavior and marked in the file — flip it to 404 if the visibility check is added; (2) recent authentication is principal-scoped (`ceremonyAssurance` reads the principal's last passkey ceremony), so after one passkey login even a password-issued token passes sensitive checks — a `REAUTHENTICATION_REQUIRED` row must be observed before any ceremony for that principal (asserted so, and relevant to how the assurance model is documented).
- Files/artifacts: `tests/workerd/acceptance-negatives.test.ts`; `tests/postgres/acceptance-negatives.test.ts`; this record.
- Verification: `corepack pnpm test:workerd tests/workerd/acceptance-negatives.test.ts` 1/1; `corepack pnpm test:postgres tests/postgres/acceptance-negatives.test.ts` 1/1 (both re-run after formatting); `npx oxfmt --check` clean on both files; `npx oxlint --deny-warnings` clean on both files; `corepack pnpm typecheck` green. The module-03 audit-query evidence snapshots were restored with `git checkout --` after the PostgreSQL runs as instructed.
- Decisions and deviations: Bootstrap is single-shot, so the second staff principal is seeded out of band with a real Argon2id credential (Node provider under the identical initial policy, so the worker verifies it normally) and logs in through the public flow; its membership grant and revocation still run through the member routes with a stepped-up administrator. Dedicated OAuth client id `negatives-cli` and suite-unique slugs (`negatives-a`/`negatives-b` workerd, `pg-negatives-a`/`pg-negatives-b` PostgreSQL). In the PostgreSQL spot-check the assignee's project role is granted and removed through SQL because the membership-route journey is owned by the workerd matrix; the assignee-membership foreign key requires detaching the assignment before the role row is deleted (exercised so).
- Blockers/open questions: None blocking. The hidden-issue timeline/comment-list visibility gap needs a product decision.
- Next actions: Coordinating session reviews, decides the hidden-issue visibility question and marks 06.V2.
- Next-session cautions: The pinned hidden-issue timeline assertion flips to 404 if `issueTimeline` gains a moderation check; the same gap exists for the comment list of a hidden issue. Do not reorder the password-token member-grant row after the passkey ceremony — principal-scoped assurance would turn its 403 into 200.

### 2026-10-01 — Acceptance batch 06.V1–06.V4 accepted; Module 06 complete

- Scope and checklist IDs: 06.V1, 06.V2, 06.V3 and 06.V4 accepted (intended batch recorded above). Every non-suspended Module 06 checklist item is now implemented and verified on both local profiles; 06.1c's and 06.2c's audit portions remain suspended and unchecked as explicit deferred remainders, following the module 03/04/05 precedent.
- Progress: The four acceptance suites were authored by four parallel subagents and verified by this session. V1 runs the ordered HTTP workflow on both profiles with the full merged-timeline sequence and strictly increasing revisions; V2 covers the principal-class/ownership/cross-project/removed-reference/moderation/direct-access matrix (104 workerd assertions plus a PostgreSQL spot-check); V3 proves concurrency and atomicity on both profiles with stability reruns (parallel number allocation, single-winner revision races, idempotent duplicates, full rollback on a forced event failure, deterministic equal-timestamp pagination); V4 pins fixed limit-independent statement counts, page bounds and PostgreSQL index plans under representative filler volumes. Verification exposed and fixed two production defects: the hidden-issue sub-resource leak (timeline/comments/reactions of a hidden issue now inherit the issue's moderation — 404 for every audience that cannot see the issue) and the D1 batch-race error mapping (lost conditional races answer the stable `REVISION_CONFLICT`, never a raw 503). A V1 observation also corrected over-restrictive timeline bodies: visible comments now carry bodies to every audience, matching the comments list.
- Change summary (this batch): eight acceptance suites, the sub-resource visibility gate in `packages/server/src/discussion.ts` (with the issue repository wired into the discussion context), the D1 race classification in `packages/database/d1/src/index.ts`, the timeline body projection in both comment adapters, the V4 RPC additions in `tests/fixtures/database-worker.ts`, the API-CONVENTIONS clarification, the acceptance evidence file, checklist/status finalization.
- Files/artifacts: `tests/{workerd,postgres}/acceptance-{journey,negatives,concurrency,queries}.test.ts`; `packages/server/src/{discussion,index}.ts`; `packages/database/d1/src/index.ts`; `packages/database/{d1,postgres}/src/comments.ts`; `tests/fixtures/database-worker.ts`; `docs/API-CONVENTIONS.md`; `docs/plan/evidence/06-issue-core-validation.md`; `docs/plan/modules/06-issue-core.md`; this record; `docs/plan/PROGRESS.md`.
- Verification: Node 24.21.0 local — lint/boundaries, typecheck matrix, format:check, full matrix unit 197/197, contract 1/1, node 50/50, workerd 140/140 (including all four acceptance suites), isolated PostgreSQL 18.6 81/81 (including all four), build, db:check both dialects, docs build, secret and license scans all passed. Local/emulated evidence only; no deployed claim. The acceptance suites drop and recreate the append-only timeline guard as a documented migration-owner step when removing a seeded row (V3).
- Decisions and deviations: (1) Issue sub-resources inherit the issue's moderation uniformly — hidden issues answer 404 everywhere their detail does, deleted issues to everyone. (2) Timeline bodies follow the row audience: visible comments carry bodies to all readers, hidden/deleted rows are moderator-only metadata. (3) Cache isolation is evidenced by the V1 journeys' no-store assertions rather than a dedicated suite (the database-worker harness does not cross the HTTP boundary). (4) The V4 labels-plan assertion accepts either project-prefixed unique index; both are bounded and Seq-Scan-free.
- Blockers/open questions: None for this module's local acceptance. The G1 audit-governance decision (resume vs deferral+ADR for modules 06–09's suspended audit portions) remains with the user; deployed-evidence items belong to their owning gates.
- Next actions: None started — Module 07 (content, forms, templates, attachments) is the next executable module per the plan's order, awaiting user direction.
- Next-session cautions: 06.1c/06.2c audit portions must not resume implicitly; migrations remain at D1 0017 / PostgreSQL 0016; the timeline UNION's columns are position-matched; provisional rate budgets (issue-create/comment-create/reaction) are local-only numbers pending the staging real-load milestone; keep the root `SECURITY.md` draft uncommitted.

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


### 2026-10-03 — Module 07 dependency follow-up

- Scope and checklist IDs: Module 07 representation integration and prerequisite regression verification; no additional owning-module checklist item claimed.
- Progress: Issue/comment detail and visible timeline rows now carry safe trees; issue/comment lists carry stored previews, with comment lists omitting bodies. Fixed D1 absent tombstoned timeline bodies to explicit null. Existing authorization/moderation/idempotency/timeline semantics remain verified.
- Change summary: Supports the authorized Module 07 batch; [full handoff](07-content-and-attachments.md) and [verification evidence](../evidence/07-content-validation.md).
- Files/artifacts: Affected package/fixture paths are inventoried in the linked Module 07 record; no older migration or protected SECURITY.md change.
- Verification: Local unit 199, contract 1, Node 50, workerd/D1 143, PostgreSQL 18.6 82 tests passed; typecheck/lint/format/build/database/docs/license/secret checks passed. Local/emulated storage only; no deployment or remote migration.
- Decisions and deviations: Owning-module status/gates and audit holds remain unchanged; no SPA or Module 09 expansion.
- Blockers/open questions: Module 07's V7 policy-upgrade fixture and forms/storage acceptance remain with Module 07.
- Next actions: Continue the authorized Module 07 goal; no unrelated feature work starts from this follow-up.
- Next-session cautions: All changes remain uncommitted; preserve the protected draft and prior edits, suspended audits, existing migration history and initially clean module-03 measurement snapshots.


### 2026-10-03 — Module 07 actual replacement-policy journey

- Scope and checklist IDs: Dependency verification for 07.V7; no Module 06 checklist/gate change.
- Progress: Both issue-route journeys now reload a test-only replacement API bundle against the same project/issues/database and traverse a saved cursor. Raw body/revision and pagination boundary stay unchanged while safe tree, policy version and ETag change; If-None-Match answers a fresh 200/no-store response.
- Change summary: Shared content-policy-upgrade contract plus local Node/PostgreSQL listener replacement and Miniflare/workerd bundle reload; [Module 07 handoff](07-content-and-attachments.md), [evidence](../evidence/07-content-validation.md).
- Files/artifacts: `tests/{postgres,workerd}/issue-route.test.ts`; shared replacement fixtures and build targets inventoried in Module 07.
- Verification: Unit/contract 203, Node 50, workerd 144, PostgreSQL 82 passed (479 total); type/lint/format/build/docs/frozen install/license/secret checks passed. Local runtime/service evidence only; no deployment or remote migration.
- Decisions and deviations: Test-only policy narrows del and changes its identifier; production content policy remains immutable. Existing Module 06 business/authorization/moderation/receipt behavior unchanged.
- Blockers/open questions: Remaining form/store/API/attachment work belongs to Module 07.
- Next actions: Continue the authorized Module 07 goal with versioned persistence/management/submissions.
- Next-session cautions: Preserve all uncommitted work and protected SECURITY.md; Module 06's suspended audit portions remain suspended. Reacquire Miniflare binding handles after setOptions.

### 2026-10-03 — Module 07 form/template integration dependency checkpoint

- Scope and checklist IDs: Dependency impact of 07.2a and non-audit form management/submission; no owning-module gate/checklist change.
- Progress/change summary: Shared contracts and both production roots compose immutable content stores, bounded management/history routes and atomic structured issue creation. Added `content:manage` and read-only `content:history` permission rules; existing issue/auth/admission behavior passes the complete regression matrix. New migrations preserve history; no older migration or audit behavior changed.
- Files/artifacts: Owning changes and detailed decisions are inventoried in [Module 07 progress](07-content-and-attachments.md), [specification](../../ISSUE-FORMS.md) and [validation evidence](../evidence/07-content-validation.md).
- Verification: 499 tests passed (unit/contract 204, Node 50, workerd 155, PostgreSQL 18.6 90); typecheck/lint/build/db/docs/license/secret checks passed. This is local runtime/database evidence; no remote migration or deployment.
- Decisions/blockers: Attachment integration remains with Module 07; audit suspension and Module 09/SPA holds remain. G1 stays closed. See the linked record for the detected and corrected PostgreSQL project/receipt lock-order deadlock.
- Next actions/cautions: Continue only the authorized Module 07 goal. Preserve all uncommitted changes and protected SECURITY.md; never resume suspended audit via this dependency record.

### 2026-10-03 — Module 07 upload lifecycle dependency checkpoint

- Scope and checklist IDs: Module 07 target authorization dependency; Module 06 accepted scope unchanged.
- Progress: Independent dependency work verified; [Module 07 checkpoint](07-content-and-attachments.md) owns lifecycle acceptance.
- Change summary: Added owner/project-scoped comment lookup by ID on both adapters for existing-comment upload associations; parent Issue visibility/moderation/deletion is enforced by the shared feature handler and transaction guards. Issue/comment/draft association checks and inherited content journeys pass; atomic attachment linking remains future Module 07 work.
- Files/artifacts: Relevant roots/build/manifests, application/contracts/server/database/comment adapters and fixtures; [lifecycle specification](../../ATTACHMENT-LIFECYCLE.md) and [evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final current-tree matrix **541 passed** (unit/contract 209; Node 57 with 9 explicit provider skips; workerd/D1 172; isolated real local PostgreSQL 18.6 103). Typecheck/lint/db history/docs/secrets/licenses/frozen install/format passed; final build details in linked evidence. Existing actual-provider compatibility reused; no deployed lifecycle or scan result claimed.
- Decisions and deviations: ADR 0011; scope remains Module 07 with no suspended audit or Module 09/SPA expansion.
- Blockers/open questions: Multipart/scan/release/content linking/delivery/full cleanup and held dispatch remain with Module 07; no new prerequisite gate opened.
- Next actions: Continue 07.3c multipart intent/capability orchestration, then 07.3d/f–h and attachment-aware 07.2; preserve existing module status/gates.
- Next-session cautions: No commits; protected SECURITY.md and private credentials remain untouched. New migrations append to history. Legacy intents retain quota pending explicit reconciliation; unrelated regenerated Module 03 measurements were restored.

### 2026-10-03 — Module 07 multipart lifecycle integration

- Scope and checklist IDs: Module 07 attachment API integration on the existing Issue/comment authorization boundary; Module 06 completion and suspended audit remainders unchanged.
- Progress: Both authenticated Issue journeys now include full local multipart orchestration and manual immutable processing.
- Change summary: Owner/project-scoped create/resume/parts/complete/abort, current visibility/permission checks, quota semantics and no-store DTOs preserve existing Issue/comment behavior. Verified content remains unlinked and unscanned/quarantined.
- Files/artifacts: Shared upload routes/services/DTOs, both issue-route fixtures and upload HTTP proof; synchronized English/Chinese Issue guides; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final full matrix 569 passed: 209 unit/contract, 60 Node, 185 workerd/D1, 115 real local PostgreSQL 18.6; 9 optional provider skips. Multipart HTTP storage is local emulation. Typecheck/lint/docs/build passed; prior actual-R2/SeaweedFS evidence retained separately.
- Decisions and deviations: No content attachment link, scan or release is inferred from upload verification. 202 continues to mean awaiting processing with no held dispatcher composed.
- Blockers/open questions: Atomic attachment/form consumption depends on accepted scan/release policy; scanner/result integration, isolated delivery and complete cleanup remain Module 07 work.
- Next actions: 07.3f scanner/result policy, then 07.2b–d/V2 atomic accepted attachment consumption; 07.3g/07.3h delivery and cleanup.
- Next-session cautions: Preserve Module 06 semantics and audit suspension. No SPA/Module 09 scheduling, commits or credential exposure.

### 2026-10-03 — Module 07 scanner hook integration

- Scope and checklist IDs: Module 07 scan-policy/DTO integration; Module 06 completion and suspended audit remainders unchanged.
- Progress: Core hooks/persistence/guard behavior locally verified; 07.3f actual scanner acceptance remains incomplete.
- Change summary: Current ownership/visibility/membership guard remains authoritative for scan claim/result/release. Upload DTOs expose truthful policy statuses and omit scanner evidence. Attachment/form consumption remains unimplemented; no actual file is claimed scanned.
- Files/artifacts: Shared upload services/views, both issue-route/synthetic proofs and synchronized Issue guides; lifecycle evidence. [Detailed validation](../evidence/07-upload-lifecycle-validation.md).
- Verification: Composed regression **598 passed**: 209 unit/contract, 70 Node (9 optional-provider skips), final 195 workerd/D1/R2 emulation and 124 real isolated local PostgreSQL 18.6 with S3 emulation. Scanner verdicts are synthetic. Typecheck/lint/db:check/build/docs/format/secrets/links passed. Initial D1 count failure and corrected-lane commands are recorded in the linked evidence.
- Decisions and deviations: ADR 0011 scanner/result refinement; no provider adapter or dependency change, no audit/Module 09/SPA expansion. Fresh/upgrade preservation verified; only new uncommitted migrations refined before shared deployment.
- Blockers/open questions: Actual scanner/plugin/service/result integration is absent. Module 07 cleanup/discovery, isolated delivery, consumption, production CORS and deployment acceptance remain open.
- Next actions: 07.3f actual scanner evidence; independent 07.3h cleanup/reconciliation and 07.3g delivery; 07.2b–d accepted-state consumption.
- Next-session cautions: No commit/cloud mutation or actual malware-detection claim. Preserve all prior work, protected SECURITY.md/private credentials and old histories. Used quota and held policy are retained until verified physical cleanup.

### 2026-10-04 — Form attachment aggregate atomicity

- Scope and checklist IDs: Module 07 07.2b–d/V2 integration into accepted issue creation; Module 06 status and audit suspension unchanged.
- Progress/change summary: Form submission consumes up to 32 authorized current-clean-ready draft uploads in the existing issue/provenance/number/event/outbox/receipt transaction. Reuse or changed eligibility rolls everything back. Same-key concurrent receipt replay survives consumption and later form disable; original structured provenance remains intact. Linked uploads thereafter inherit persisted issue authorization, including hidden-parent denial.
- Files/artifacts: Both issue repositories/new consumption helpers, shared form repository/API fixtures, form/lifecycle docs and [owning evidence](../evidence/07-content-validation.md).
- Verification: Final default **646 passed / 11 optional-provider skips**, including workerd/D1 218 and real isolated local PostgreSQL 18.6 143. Expanded form/API focus D1 27/PostgreSQL 20, corrected stale-token focus 1 each. Synthetic scan results only; existing actual storage-provider evidence reused. Initial aggregate failure and correction recorded in Module 07.
- Decisions/blockers: No schema/dependency/issue audit change. Actual scanner, isolated delivery and remaining cleanup/CORS stay Module 07 boundaries.
- Next actions: 07.3g; remaining 07.3h/07.3c/07.3f. No SPA/Module 09 scheduling.
- Next-session cautions: No commit/deployment; protected SECURITY.md and earlier work preserved. Do not treat linking as download permission or synthetic clean results as actual scanning.

### 2026-10-04 — Authorized media and HTTPS checkpoint

- Scope/checklist IDs: Module 07 07.3g/V5 accepted at backend/local transport scope; this module's existing gates/status remain unchanged.
- Progress/change summary: Media delivery inherits visible non-deleted issue/comment authorization and project visibility, rechecked after storage acquisition. Both-profile HTTP fixtures exercise public/private/archived access, suspension/revocation/membership loss and hidden/redacted/deleted comment/issue parents. General comment attachment association is an internal fixture only.
- Files/artifacts: shared media parent guards and issue-route/attachment fixtures; [owning evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final complete default matrix **673 passed / 11 optional-provider skips**: 236 unit/contract, 76 Node, 218 workerd/D1/R2 emulation, 143 real isolated PostgreSQL 18.6/S3 emulation. Focused media unit 22, TLS Node 5 and HTTP 1 per profile. Node media uses certificate-verified local native HTTPS with virtual Host; Workers uses canonical edge URL through workerd emulation. Types/lint/boundaries/build/docs/secrets passed. Provider/migration/dependency evidence reused unchanged; full final handoff checks are in Module 07.
- Decisions/blockers: Current attachment/scan/association and bearer/principal/membership/parent state are rechecked after acquiring storage; held streams are canceled on denial. Actual scanner, installed production CORS/browser evidence and full cleanup/native discovery remain incomplete. No new audit, dispatcher or SPA.
- Next actions: 07.3h/V4 native discovery and explicit used-file/legacy/retention cleanup; 07.3c production selection and 07.3f trusted actual scanner when available.
- Cautions: All work uncommitted; no deployment. Preserve earlier work, historical migrations and protected SECURITY.md. Synthetic clean results never prove malware detection. Generated Module 03 measurements restored after runtime processes ended.

### 2026-10-05 — Review remediation B1: D1 bind bounds and set-based relation writes

- Scope and checklist IDs: Post-completion remediation of accepted 06.2a/06.2d/06.V4 behavior (PERF review 3.1/3.2). No checkbox changes; accepted items stay checked.
- Progress: A full 100-issue page previously bound 101 parameters in `relations()`, above D1's 100-parameter limit; the 06.V4 fixture only seeded 60 issues. All bounded D1 ID sets now bind one JSON array through `json_each`. Relation writes on create and replacement are set-based on both adapters.
- Change summary: D1 relation/reference/form-guard/reaction-count statements use `json_each`. Worst-case create drops from 37 to 9 batch statements. PostgreSQL relation inserts use `unnest($3::uuid[])`. A test-only D1 bind guard enforces the production limit in all D1 fixtures.
- Files/artifacts: `packages/database/d1/src/{index,comments,content-definitions}.ts`, `packages/database/postgres/src/index.ts`, `tests/fixtures/{d1-bind-guard,database-worker,account-worker,repository-contract}.ts`, `tests/{workerd,postgres}/acceptance-queries.test.ts`, [remediation record](../evidence/2026-10-05-review-remediation.md#b1--d1-bindstatement-bounds-and-batched-relation-writes-2026-10-05).
- Verification:
  - Workerd acceptance-queries and repository: 172 passed, 2 skipped (D1 emulation).
  - PostgreSQL 18.6 acceptance-queries and repository: 158 passed, 2 skipped.
  - The previous adapter fails the new full-page case at the guard.
  - Full lanes: workerd 257 passed, 2 skipped; PostgreSQL 178 passed, 2 skipped.
  - Typecheck, lint and boundaries pass.
- Decisions and deviations: None against the baseline. Maximum relations are proven at the shared repository contract instead of the HTTP journey; D1 route fixtures run behind the guard.
- Blockers/open questions: Real-Free accounting of batch members against the 50-query limit is measured in B15.
- Next actions: B2 hidden-parent visibility for every discussion sub-resource.
- Next-session cautions: Keep `json_each` bound sets for any new D1 `IN` list. Do not reintroduce `placeholders()`. Generated Module 03 audit-query measurements were restored after the test runs.

### 2026-10-05 — Review remediation B2: parent visibility for every sub-resource

- Scope and checklist IDs: Post-completion remediation of accepted 06.3a/06.3b/06.3c/06.V2 behavior (PERF review 3.3). No checkbox changes.
- Progress: Only the timeline enforced the parent issue's visibility. Comment list/read/create/edit/delete/moderate/history and issue/comment reactions and counts checked only the project. Comments on a hidden issue were publicly listable, and comment-addressed routes did not require the comment to belong to the URL's issue.
- Change summary:
  - **Shared parent check.** `requireIssueAccess` resolves the moderator status once and probes the parent through the new `IssueRepository.issueVisible`. Every discussion sub-resource route uses it.
  - **Comment ownership.** Comment moderation, history and reactions verify the comment belongs to the addressed issue. Comment reactions also require the comment to be visible to the caller.
- Files/artifacts: `packages/server/src/discussion.ts`, `packages/application/src/index.ts`, `packages/database/{d1,postgres}/src/index.ts`, `tests/fixtures/discussion-visibility-contract.ts`, `tests/{workerd,postgres}/acceptance-negatives.test.ts`, harness updates. [Remediation record](../evidence/2026-10-05-review-remediation.md#b2--parent-issue-visibility-for-every-issue-sub-resource-2026-10-05).
- Verification:
  - The shared visibility matrix passes on workerd/D1 and real PostgreSQL 18.6.
  - The previous handlers fail it: cross-issue history answered 200.
  - Related discussion, journey, query and concurrency suites pass on both profiles, and unit tests pass (345).
  - Typecheck, lint and format pass.
- Decisions and deviations: None. 404 semantics follow the existing timeline rule.
- Blockers/open questions: None.
- Next actions: B3 instance roles and token-bound assurance (Module 04 owner); B6 removes the duplicate authorization reads this check adds for authenticated writers.
- Next-session cautions: New issue sub-resources must call `requireIssueAccess`. The resolver's resource facts remain a stub, so routes own object visibility.

- 2026-10-05 review follow-up (commit `aff2790` reviewed by a Sonnet subagent): no critical or high findings. The comment edit/delete existence oracle is closed through the shared `requireCommentKnown` rule (a moderated or deleted comment is 404 for everyone but moderators and its author), moderation and history order the parent and comment checks before the moderator permission check, and the shared matrix now covers a non-moderator outsider, anonymous, hidden and redacted comments on a visible issue, comment-reaction removal, cross-issue addressing on every comment route, moderator writes to a hidden parent, and deleted-parent writes. Re-verified on workerd and PostgreSQL.

### 2026-10-05 — Review remediation B3 verified

- Scope and checklist IDs: 06.1a/06.2a/06.3a (B3 dependency remediation).
- Progress: B3 complete locally; overall mission continues at B4. Existing module status/checklists and G1/G2/13.G6 are unchanged.
- Change summary: All project/issue/discussion/taxonomy guards pass presented-token ceremony facts. Object visibility remains enforced and later audit stays suspended.
- Files/artifacts: Owning stores/routes/schema/tests and specifications listed in the [cross-module remediation record](../evidence/2026-10-05-review-remediation.md#b3-instance-roles-and-token-bound-assurance-2026-10-05). D1 0024/0025; PostgreSQL 0023/0024.
- Verification: Final local matrix **916 passed / 18 optional-provider skips** (349 unit, 1 contract, 121 Node, 262 workerd/D1 emulation, 183 real isolated PostgreSQL 18.6). Typecheck, lint, Drizzle check (old timestamp warnings), docs build, tracked/new-source formatting and diff checks pass. Root formatting flags only supplied untracked review files; reports untouched. No actual deployment/provider claim. Initial wiring/schema/fixture failures and focused primary-agent security review are recorded in the linked evidence.
- Decisions and deviations: Independent instance role and immutable presented-credential facts; configured default 300 s replaces hardcoded 900 s. No policy weakening, new protocol or new ADR required for B3; formal Minimum ADR remains B8.
- Blockers/open questions: None for B3. Independent Sonnet review unavailable (model not callable); no independent review claimed. Atomic account/role/plugin audit remains B4.
- Next actions: B4 audit transaction/failure cases, recovery-code step-up and passkey CAPTCHA forwarding, then B5–B15 in the approved order.
- Next-session cautions: Never stage SECURITY.md or supplied reviews; preserve historical migration/audit rows, apply schema before adapters, inspect upgrade role recipient, and require new passkey login for old tokens. No SPA or later-module audit resume.

### 2026-10-05 — Review remediation B6 request-scoped authorization reuse

- Scope/checklist IDs: Approved B6 correction to 04.2e and 06.2d/V4, with guarded plugin/content and 10 acceptance dependencies. Later audit remains suspended.
- Progress/change summary: Built-in DB resolvers share exact-ID fact promises within one original HTTP Request; authoritative visibility seeds project facts and private membership admission shares its loader. Every permission evaluation retains its own resource/credential binding; decisions/token verification remain uncached.
- Files/artifacts: [B6 record](../evidence/2026-10-05-review-remediation.md#b6-request-scoped-authorization-facts-2026-10-05), server resolver/guards/handler wiring, shared actual-adapter query/revocation contract and AUTH-FLOWS.
- Verification: Both focused D1/workerd and real PostgreSQL 18.6 suites **9 passed each**, plus token-assurance unit **3 passed**, no skips. Measured anonymous list **5→4**, Staff list **11→7** database statements with the in-memory test key source; no unmeasured production count claim. Role removal/suspension/private visibility changes take effect on new requests; B2 negatives and existing query/index plans pass. Typecheck/lint/boundaries/scoped format/diff and documentation build pass.
- Decisions/blockers: Actual authenticated count supersedes the plan's rough ~5 estimate. No schema/deployment/ADR/permission change or blocker. Gates unchanged; production key overhead and real-Free limits remain B7/B15.
- Next actions/cautions: Commit B6, then B7 imported key reuse/per-purpose registry/request snapshots with immediate revocation. Keep cache lifetime at one Request, separate decisions/credentials, and retain authoritative project seed provenance. Preserve protected files and historical evidence.

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

### 2026-10-05 — Review remediation B12 one-shot receipts

- Scope/checklist IDs: Approved B12, 06.2c non-audit/V3 and dependent data/acceptance contracts.
- Progress/change summary: Explicit unkeyed issue/comment intents skip receipts; keyed replay remains 24 hours. D1 captures committed result within batch; comment last-mutation witness fences edit history.
- Files/artifacts: [B12 record](../evidence/2026-10-05-review-remediation.md#b12-one-shot-mutation-receipts-2026-10-05), identity/intents/adapters, D1 0027/PG 0026 and specs.
- Verification: Focused D1/workerd 4 and PostgreSQL 18.6 4 pass, including three-statement reductions and concurrent losers/keyed replay; types/lint/boundaries/docs pass. Broad matrix B15.
- Decisions/blockers: No gate or suspended-audit closure; nullable column leaves history unchanged.
- Next actions/cautions: Commit B12 then B13; migrate before adapters, preserve atomic side records, protected drafts and old SQL.

### 2026-10-05 — Review remediation B15 measurements and cleanup

- Scope and checklist IDs: Approved B1/B6/B12 query budget and B13 store deadline completion; no new module/gate completion.
- Progress: B1–B15 implementation/evidence/owned cleanup recorded; Free acceptance remains incomplete.
- Change summary: Maximum create used 19 statements; full 100-item/maximum-relation pages used four and 3,700 rows read, zero writes. Three comment writes used 12 statements each.
- Files/artifacts: issues/discussion/projects/taxonomy server modules, measured D1 receipts; [B15 measurements and cleanup](../evidence/2026-10-05-b15-live-measurements.md), [receipt](../evidence/2026-10-05-b15-live-metrics.json), [remediation record](../evidence/2026-10-05-review-remediation.md).
- Verification: Reused B14 matrix 937 passed / 18 optional-provider skips. B15 Minimum 7 passed; Node timeout/stall 2 passed / 31 intentionally unselected (earlier incorrect filter selected zero); actual R2 2 passed / 6 intentionally unselected. Live 10/10 logins, scoped path/cleanup checks pass; final compile/lint/build/docs/format/secret results in linked record. No broad rerun or new automated tests.
- Decisions and deviations: 1,000 ms defaults cover observed D1 trips (537 samples, max 284 ms); production sampling 0.1, test/staging 1; ten native PBKDF2 slots at the Minimum root. Cleanup retains FK-required tombstones and permanent keys rather than disabling history protections. Primary focused review only; Sonnet unavailable.
- Blockers/open questions: Billing attribution unavailable; instrumented login CPU 20–47 ms exceeds nominal Free 10 ms. Successful live CAPTCHA passkey login, Standard measurements and complete quota/recovery evidence unverified. G1/G2 remain closed, 13.G6 open.
- Next actions: No later-module audit resume; preserve parent visibility, atomic side records and one-shot/keyed distinctions.
- Next-session cautions: Test Workers/domain removed and tails stopped; mutable owned rows absent. One deleted User, archived private project, deleted issue/three comments plus immutable history remain; two owned keys are removed identities. Never stage protected drafts/reviews/HANDOFF; preserve baseline rows, migrations, audit/history, no SPA or Argon2id performance work.

### 2026-10-09 — Module 08 B1 dependency handoff

- Scope and checklist IDs: Module 08 08.1a–e public-semantics batch; no owning-module checklist closure.
- Progress: Proposed dedicated search/suggestion operations reuse project authorization and Issue summaries; the ordinary list route is unchanged in B1.
- Change summary: Documented dependency boundary and prepared shared search contract/fixtures; details in [Module 08 progress](08-search-and-query.md).
- Files/artifacts: This record; `docs/SEARCH-SPEC.md`, contracts search types and shared search corpus; [B1 evidence](../evidence/08-search-validation.md).
- Verification: One B1 pass: types/lint/boundaries/scoped TypeScript formatting/diff and nine new-document local links pass; unit 354/contract 1 pass. Exact commands in linked evidence; new parser fixtures, runtime search and hosted behavior remain unverified.
- Decisions and deviations: Follow the approved Module 08 handoff scope and README's handler-before-dispatch interpretation. No normative baseline deviation.
- Blockers/open questions: User approval of specification/bounds/AST/endpoint shape precedes B2; runtime and dispatch evidence remain open.
- Next actions: Approve the concrete B1 contract, then execute Module 08 B2–B4 within the named checklist boundaries.
- Next-session cautions: Preserve existing owning-module status/remainders, protected drafts and all gate states; do not infer deployment/Free-plan acceptance from local checks.

### 2026-10-09 — Module 08 B2 compiler dependency

- Scope and checklist IDs: 08.1b/08.2a/b/d and 08.V1/V2; no independent owning-module checklist closure.
- Progress: Dedicated search store returns existing Issue metadata with two page-wide relation queries; list route is untouched, server route composition remains B3.
- Change summary: User approved B1; implemented bounded parser and parameterized native search with current canonical predicates, fixed-window keysets and batch hydration.
- Files/artifacts: Application/database search modules, D1 0028/PG 0027 SQL/schema metadata, shared native fixtures, SEARCH-SPEC/ADR; [B2 evidence](../evidence/08-search-validation.md#b2--parser-and-dual-store-compilers-2026-10-09).
- Verification: Unit 6/contract 1; selected D1/workerd14 and real isolated PG18.6 14 pass (final narrow refinements replace three results each). Types/lint/boundaries/db histories/local migrations pass; exact commands/first failures in evidence.
- Decisions and deviations: Shared Unicode lowercase/NFC preprocessing resolves observed C-locale case mismatch without changing canonical projection. Additive derived-only migrations; no remote application or normative-document edit.
- Blockers/open questions: No B2 blocker; B3/B4 and Module 09 dispatch/queue acceptance remain open.
- Next actions: B3 authorization/readiness/lifecycle/representative measurements, then B4 handlers/tier budgets.
- Next-session cautions: Preserve prior histories, protected drafts, owning-module remainders and gate states; emulated/local evidence is not hosted/actual Free-plan evidence.

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

- Scope and checklist IDs: 08.2c–h search/Issue-read dependency; no new canonical mutation or endpoint.
- Progress: All four authorized batches implemented and locally verified; 08.1a–e, 08.2a–d/f–h, 08.V1–V4 and local 08.V6 complete. 08.2e handler/08.V5 replay-rebuild pass; combined dispatch/queue checkboxes stay open. Module08 remains In progress.
- Change summary: Search/suggestions use current project authorization and authoritative rate admission; operator reindex uses existing administrator/fresh-token guards; direct Issue access remains independent.
- Files/artifacts: Application/server/runtime search ports; dual-store compilers/index/budget adapters and 0029/0028 migrations; existing shared native/unit fixtures; SEARCH-SPEC/ADR0013; [B4 evidence and requirement audit](../evidence/08-search-validation.md#b4--version-aware-indexing-and-tier-budgets-2026-10-09), query/reindex JSON and module/master records.
- Verification: Composed selected scope D1/workerd22 and real isolated PG18.6 20 pass; unit7/contract1 pass; migration fresh/upgrade/application and db:check pass; final typecheck/lint/boundaries pass. Final narrowed PostgreSQL semantics/plan pass, including no canonical Seq Scan, <=4097 probes/node and zero denied-project Issues/document scan loops. Exact commands, failed assertions/imports/plan attempts, local metadata and limitations are in linked evidence.
- Decisions and deviations: PostgreSQL logical LIMIT alone failed physical scan bounds; recursive keyset probes plus independent canonical/text materialization fix it without widened ceilings or planner-wide settings. Conservative Minimum ledger is not provider-global billing/CPU evidence. No normative edit or baseline deviation; user approval persists.
- Blockers/open questions: No blocker within authorized handoff scope. Module09 dispatch/queue/retry/reconciliation and provider-global headroom, Module10 composed acceptance and actual Free CPU/quota 13.G6 remain open.
- Next actions: Commit verified B4 as the fourth batch; stop Module08 implementation. Later authorized Module09 connects 08.2e dispatch and completes 08.V5; Module10/13 supply remaining gate evidence.
- Next-session cautions: Preserve feat/v1 batch history, protected untracked drafts, earlier migrations, current canonical authorization and numeric ceilings. No remote rollout/push, SPA or Module07/14 expansion. G1/G2 stay closed and 13.G6 open; local evidence must not be promoted to hosted acceptance.

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
