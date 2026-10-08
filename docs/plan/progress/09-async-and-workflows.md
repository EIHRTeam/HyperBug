# 09 progress — Outbox delivery, queues, durable workflows, and cleanup

Plan: [Detailed checklist](../modules/09-async-and-workflows.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress (narrow Phase 03 dependency only)
- Delivery scope: MVP backend
- Prerequisites: 08 complete; handlers from 05, 07, and 08.
- Implementation started: Bounded abuse-counter cleanup scheduling only; the main 09.1–09.3 prerequisites remain open.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 09.1 after prerequisites; partial 09.3d scheduler support for Phase 03 does not complete that item.
- Last updated: 2026-09-28.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: [Phase 03 rate evidence](../evidence/03-rate-limits-validation.md) records local bounded counter cleanup; no other Module 09 behavior or deployed scheduler acceptance is claimed.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 09.1 | Implement reliable event dispatch | Not started | None yet |
| 09.2 | Bound failure and fan-out | Not started | None yet |
| 09.3 | Implement durable workflow and retention foundations | In progress (narrow dependency) | Bounded abuse-counter schedule only; 09.3d remains open |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Hold Module 09 implementation under the 2026-09-28 user instruction; preserve only the already implemented bounded counter cleanup.
2. After a later user instruction, read the latest master and dependency progress records and verify prerequisites before 09.1.

## Next-session cautions

Assume at-least-once delivery and crash-after-side-effect replay. Queue deduplication alone does not guarantee business idempotency.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 09; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for outbox delivery, queues, durable workflows, and cleanup.
- Files/artifacts: `docs/plan/modules/09-async-and-workflows.md`; `docs/plan/progress/09-async-and-workflows.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 09.1.
- Next-session cautions: Assume at-least-once delivery and crash-after-side-effect replay. Queue deduplication alone does not guarantee business idempotency.

### 2026-09-20 — Minimum-tier dispatch and job-runner requirements planned

- Scope and checklist IDs: Planning only. Added 09.1f, 09.2e, 09.3g and 09.V6. No implementation item was completed or checked.
- Progress: Recorded the tier's reduced-durability path: a D1 outbox claimed by a bounded Cron-driven dispatcher, a D1 failed-job store as the authoritative replay source, and a checkpointed job runner replacing multi-step workflow durability with capability gating.
- Change summary: Extended the module plan and its source-coverage pointer. The required Queues, Workflows and Graphile Worker adapters of the standard profiles remain mandatory and unchanged.
- Files/artifacts: `docs/plan/modules/09-async-and-workflows.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No queue, workflow or crash-recovery test ran.
- Decisions and deviations: The tier never relies on the provider dead-letter queue's 24-hour free retention as its only replay source.
- Blockers/open questions: 09.V6 needs the tier gate and the dispatcher implementation; Cron budget consolidation must be confirmed against the free trigger count.
- Next actions: Continue 09.1–09.3 for the standard adapters; implement the tier path only after 03.3g.
- Next-session cautions: Assume at-least-once delivery and crash-after-side-effect replay on the tier as well; a visible backlog is mandatory when quotas are exhausted.


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

### 2026-09-28 — Narrow Phase 03 abuse-counter cleanup scheduler

- Scope and checklist IDs: Partial 09.3d support for Phase 03 03.3c/03.3d; 09.3d and all Module 09 acceptance remain open.
- Progress: Node/PostgreSQL and Workers/D1 production roots now schedule one indexed, bounded 1,000-row expired-rate-counter purge every five minutes; Node prevents overlap and drains an active call before pool shutdown.
- Change summary: Added the Node scheduler and Worker scheduled handler/Cron declarations around the pre-existing adapter operation. This is a narrow dependency analysis under the plan: physical retention of Phase 03 abuse metadata needs a runtime trigger, while upload/session/token and broader retention jobs stay in Module 09's future scope.
- Files/artifacts: `apps/api-node/src/{rate-cleanup,abuse-admission}.ts`, `apps/api-cloudflare/src/index.ts`, `apps/api-cloudflare/wrangler.jsonc`, `tests/node/rate-cleanup.test.ts`, `tests/workerd/entry.test.ts`, [rate policy](../../RATE-LIMITING.md), [rate evidence](../evidence/03-rate-limits-validation.md), this record, Phase 03/04 and master progress.
- Verification: Node scheduler 2/2, isolated PostgreSQL root cleanup/account route 1/1, workerd production entry 2/2 and signed ingress 7/7 passed; staging Wrangler 4.141.0 dry run passed with a missing D1 environment-binding warning. TypeScript, scoped lint/boundaries, formatting, docs build and diff whitespace passed. No deployed Cron invocation or physical-retention measurement occurred.
- Decisions and deviations: The five-minute schedule is a provisional bounded cleanup cadence, not a measured retention SLA or completion of 09.3d.
- Blockers/open questions: Named staging/production D1 bindings and deployed Cron evidence remain open, as do full 09 prerequisites; independent Phase 03 development continues.
- Next actions: Continue the next local 03.3c–03.3f consumer, then resume 09.1–09.3 in plan order when prerequisites open.
- Next-session cautions: Preserve uncommitted work and migration history, test D1 isolation, audit suspension and disabled Free tier.

### 2026-09-28 — Test-only deployed Cron event

- Scope and checklist IDs: Partial 09.3d and Phase 03 03.3d/03.V3; all checklist and acceptance items remain open.
- Progress: The production scheduled handler ran in one temporary private Worker bound only to `hyperbug-test-1`; an expired row disappeared while a fresh row remained.
- Change summary: Used a one-minute test trigger, then deleted the Worker and exact test rows. The tracked five-minute configurations and other retention jobs did not change.
- Files/artifacts: Ignored `.local/phase03-cleanup-remote/wrangler.jsonc`, [rate evidence](../evidence/03-rate-limits-validation.md), this record, Phase 03/04 and master progress.
- Verification: Wrangler 4.141.0 deployment and tail `ok` event; primary D1 before/after/final reads; Worker-not-found 10007 after deletion. Context7 on 2026-09-28 confirmed Cron changes can propagate for up to 15 minutes. Staging/production and sustained-retention tests were not run.
- Decisions and deviations: The temporary trigger proves deployed handler execution only; it cannot satisfy the broader 09.3d retention set or establish a backlog bound.
- Blockers/open questions: Named-environment bindings, tracked cadence, backlog measurement and full Module 09 prerequisites remain open.
- Next actions: Continue Phase 03's independent route/runtime work; resume 09.1–09.3 in plan order after prerequisites.
- Next-session cautions: Test-only Worker/rows were removed; preserve migrations, audit suspension, test D1 isolation and disabled Free tier.

### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: 09.3d narrow expired-counter cleanup dependency; no module completion.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Committed the already implemented bounded five-minute rate-counter cleanup wiring and retained prior evidence; no queue or workflow scope was added.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Sustained retention, staging/production Cron, and full Module 09 acceptance remain unverified.
- Next actions: Do not expand Module 09 during the hold; revisit only its existing checklist after user direction.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-05 — Review remediation B11 bounded expired cleanup

- Scope/checklist IDs: Approved B11, partial 09.3d and dependent data/security/account/acceptance retention.
- Progress/change summary: Fixed indexed cleanup of expired credentials/receipts/counters and D1 lockouts on existing schedulers; 25 rows/target, eight D1/seven PG statements. Audit and history preserved.
- Files/artifacts: [B11 record](../evidence/2026-10-05-review-remediation.md#b11-bounded-expired-cleanup-2026-10-05), application/adapters/roots, D1 0026/PG 0025 indexes/snapshots and DATA-MODEL/MIGRATIONS.
- Verification: Focused D1 1, PostgreSQL 18.6 1 and Node scheduler 2 pass; typecheck/lint/boundaries/db history checks pass. Initial fixture/generation issues corrected in linked record.
- Decisions/blockers: Credential/challenge post-expiry retention uses configured default one day; other records stored expiry. 09.3d remains partial; sustained/deployed retention and broader module scope open. Gates unchanged.
- Next actions/cautions: Commit B11 then B12 unkeyed receipts; preserve old SQL/snapshots/audit and protected drafts. No queue/workflow or blob cleanup expansion.

### 2026-10-05 — Review remediation B15 measurements and cleanup

- Scope and checklist IDs: Approved Partial 09.3d/B11 forward migration dependency; no new module/gate completion.
- Progress: B1–B15 implementation/evidence/owned cleanup recorded; Free acceptance remains incomplete.
- Change summary: Expired-cleanup indexes are deployed on isolated D1; B15 fixture cleanup is an operator cleanup receipt, not sustained Cron/retention acceptance.
- Files/artifacts: D1 0026 migration receipt and preserved-history cleanup summary; [B15 measurements and cleanup](../evidence/2026-10-05-b15-live-measurements.md), [receipt](../evidence/2026-10-05-b15-live-metrics.json), [remediation record](../evidence/2026-10-05-review-remediation.md).
- Verification: Reused B14 matrix 937 passed / 18 optional-provider skips. B15 Minimum 7 passed; Node timeout/stall 2 passed / 31 intentionally unselected (earlier incorrect filter selected zero); actual R2 2 passed / 6 intentionally unselected. Live 10/10 logins, scoped path/cleanup checks pass; final compile/lint/build/docs/format/secret results in linked record. No broad rerun or new automated tests.
- Decisions and deviations: 1,000 ms defaults cover observed D1 trips (537 samples, max 284 ms); production sampling 0.1, test/staging 1; ten native PBKDF2 slots at the Minimum root. Cleanup retains FK-required tombstones and permanent keys rather than disabling history protections. Primary focused review only; Sonnet unavailable.
- Blockers/open questions: Billing attribution unavailable; instrumented login CPU 20–47 ms exceeds nominal Free 10 ms. Successful live CAPTCHA passkey login, Standard measurements and complete quota/recovery evidence unverified. G1/G2 remain closed, 13.G6 open.
- Next actions: Leave 09.3d partial; no queue/workflow expansion, drain loops or audit/history deletion.
- Next-session cautions: Test Workers/domain removed and tails stopped; mutable owned rows absent. One deleted User, archived private project, deleted issue/three comments plus immutable history remain; two owned keys are removed identities. Never stage protected drafts/reviews/HANDOFF; preserve baseline rows, migrations, audit/history, no SPA or Argon2id performance work.

### 2026-10-09 — Module 08 B1 dependency handoff

- Scope and checklist IDs: Module 08 08.1a–e public-semantics batch; no owning-module checklist closure.
- Progress: 08.2e dispatch connection and 08.V5 queue/retry verification are recorded future integration handoffs. No queue/workflow/scheduler code is added.
- Change summary: Documented dependency boundary and prepared shared search contract/fixtures; details in [Module 08 progress](08-search-and-query.md).
- Files/artifacts: This record; `docs/SEARCH-SPEC.md`, contracts search types and shared search corpus; [B1 evidence](../evidence/08-search-validation.md).
- Verification: One B1 pass: types/lint/boundaries/scoped TypeScript formatting/diff and nine new-document local links pass; unit 354/contract 1 pass. Exact commands in linked evidence; new parser fixtures, runtime search and hosted behavior remain unverified.
- Decisions and deviations: Follow the approved Module 08 handoff scope and README's handler-before-dispatch interpretation. No normative baseline deviation.
- Blockers/open questions: User approval of specification/bounds/AST/endpoint shape precedes B2; runtime and dispatch evidence remain open.
- Next actions: Approve the concrete B1 contract, then execute Module 08 B2–B4 within the named checklist boundaries.
- Next-session cautions: Preserve existing owning-module status/remainders, protected drafts and all gate states; do not infer deployment/Free-plan acceptance from local checks.

### 2026-10-09 — Module 08 B2 compiler dependency

- Scope and checklist IDs: 08.1b/08.2a/b/d and 08.V1/V2; no independent owning-module checklist closure.
- Progress: Search stores/schema are verified, but no canonical-write indexing/dispatch/scheduling is wired; 08.2e dispatch and 08.V5 queue/retry remain future integration handoffs.
- Change summary: User approved B1; implemented bounded parser and parameterized native search with current canonical predicates, fixed-window keysets and batch hydration.
- Files/artifacts: Application/database search modules, D1 0028/PG 0027 SQL/schema metadata, shared native fixtures, SEARCH-SPEC/ADR; [B2 evidence](../evidence/08-search-validation.md#b2--parser-and-dual-store-compilers-2026-10-09).
- Verification: Unit 6/contract 1; selected D1/workerd14 and real isolated PG18.6 14 pass (final narrow refinements replace three results each). Types/lint/boundaries/db histories/local migrations pass; exact commands/first failures in evidence.
- Decisions and deviations: Shared Unicode lowercase/NFC preprocessing resolves observed C-locale case mismatch without changing canonical projection. Additive derived-only migrations; no remote application or normative-document edit.
- Blockers/open questions: No B2 blocker; B3/B4 and Module 09 dispatch/queue acceptance remain open.
- Next actions: B3 authorization/readiness/lifecycle/representative measurements, then B4 handlers/tier budgets.
- Next-session cautions: Preserve prior histories, protected drafts, owning-module remainders and gate states; emulated/local evidence is not hosted/actual Free-plan evidence.
