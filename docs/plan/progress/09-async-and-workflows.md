# 09 progress — Outbox delivery, queues, durable workflows, and cleanup

Plan: [Detailed checklist](../modules/09-async-and-workflows.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Blocked (B5 hosted dispatch exceeds the required Free 10 ms CPU bound)
- Delivery scope: MVP backend
- Prerequisites: 08 complete; handlers from 05, 07, and 08.
- Implementation started: B1–B4 implemented and verified at documented local scope.
- Completed implementation checklist IDs: 09.1a–e, 09.2a–d, 09.3a–d/f, 09.V1–V5.
- Active/next checklist group: B5 — 09.1f, 09.2e, 09.3g, 09.V6.
- Last updated: 2026-10-10.
- Blocking issues discovered: Original/optimized dispatch CPU 15 ms, real Cron with work 20 ms; authorized Module08 batching follow-up still fails at 22 ms on dispatcher replay. B5 remains uncommitted; both hosted receipts verify scoped cleanup.
- Evidence: [Async validation](../evidence/09-async-validation.md); audit 09.3e remains suspended.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 09.1 | Implement reliable event dispatch | Blocked (B5 CPU) | [B1–B4 evidence](../evidence/09-async-validation.md) |
| 09.2 | Bound failure and fan-out | Blocked (B5 CPU) | [B1–B4 evidence](../evidence/09-async-validation.md) |
| 09.3 | Implement durable workflow and retention foundations | Blocked (B5 CPU; audit suspended) | [B4 evidence](../evidence/09-async-validation.md#b4--workflows-and-scheduled-maintenance) |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. The authorized Module08 D1 batching investigation did not unblock B5. Obtain a new bounded direction for batching Minimum dispatcher call boundaries under HANDOFF-09’s repeated CPU stop rule.
2. Preserve the uncommitted B5 prototype; only resume affected local/hosted checks after that decision. Keep G1/G2 closed and 13.G6 open.

## Next-session cautions

Assume at-least-once delivery and crash-after-side-effect replay. Queue deduplication alone does not guarantee business idempotency.

B1–B4 are committed; B5 is an unaccepted, uncommitted prototype. Owned Worker/Queue/Workflow/custom-domain mappings are removed; raw DNS inventory remains unverified (403). D1 baseline rows/history and appended migrations are preserved. Inspect the final receipts before any new hosted use.

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

- Scope and checklist IDs: 08.2e/08.V5 dispatch handoff only; production async hold remains.
- Progress: All four authorized batches implemented and locally verified; 08.1a–e, 08.2a–d/f–h, 08.V1–V4 and local 08.V6 complete. 08.2e handler/08.V5 replay-rebuild pass; combined dispatch/queue checkboxes stay open. Module08 remains In progress.
- Change summary: Module08 handlers resolve existing mutation/timeline revisions without producer changes; stale/replay/delete/redaction/rebuild pass locally; dispatch/retry/reconciliation scheduling remains Module09.
- Files/artifacts: Application/server/runtime search ports; dual-store compilers/index/budget adapters and 0029/0028 migrations; existing shared native/unit fixtures; SEARCH-SPEC/ADR0013; [B4 evidence and requirement audit](../evidence/08-search-validation.md#b4--version-aware-indexing-and-tier-budgets-2026-10-09), query/reindex JSON and module/master records.
- Verification: Composed selected scope D1/workerd22 and real isolated PG18.6 20 pass; unit7/contract1 pass; migration fresh/upgrade/application and db:check pass; final typecheck/lint/boundaries pass. Final narrowed PostgreSQL semantics/plan pass, including no canonical Seq Scan, <=4097 probes/node and zero denied-project Issues/document scan loops. Exact commands, failed assertions/imports/plan attempts, local metadata and limitations are in linked evidence.
- Decisions and deviations: PostgreSQL logical LIMIT alone failed physical scan bounds; recursive keyset probes plus independent canonical/text materialization fix it without widened ceilings or planner-wide settings. Conservative Minimum ledger is not provider-global billing/CPU evidence. No normative edit or baseline deviation; user approval persists.
- Blockers/open questions: No blocker within authorized handoff scope. Module09 dispatch/queue/retry/reconciliation and provider-global headroom, Module10 composed acceptance and actual Free CPU/quota 13.G6 remain open.
- Next actions: Commit verified B4 as the fourth batch; stop Module08 implementation. Later authorized Module09 connects 08.2e dispatch and completes 08.V5; Module10/13 supply remaining gate evidence.
- Next-session cautions: Preserve feat/v1 batch history, protected untracked drafts, earlier migrations, current canonical authorization and numeric ceilings. No remote rollout/push, SPA or Module07/14 expansion. G1/G2 stay closed and 13.G6 open; local evidence must not be promoted to hosted acceptance.

### 2026-10-10 — Module 09 mission start and B1 selection

- Scope and checklist IDs: HANDOFF-09 B1: 09.1b/09.1e, 09.2a, 09.3a; later B2–B5 remain ordered follow-ups.
- Progress: Inspected clean tracked working tree on feat/v1 and the existing source outboxes, search bridge and cleanup roots. No implementation outcome accepted yet.
- Change summary: Recorded the user-authorized lifting of the Module 09 hold and the explicit Module 08 integration handoff; 08.2e/08.V5 are not circular prerequisites.
- Files/artifacts: This record; HANDOFF-09.md remains protected and untracked.
- Verification: Read current scripts/policies; Context7 resolve/query for Cloudflare Queues/Workflows, Graphile Worker and Drizzle. Runtime verification follows each complete batch.
- Decisions and deviations: Add separate dispatcher/idempotency/job state; preserve Module 02 outbox rows and Module 05 envelopes. At-least-once delivery and database/queue publication are separate commits. No normative specifications change.
- Blockers/open questions: None identified; hosted quotas/local platform support require actual evidence. Audit 09.3e stays suspended.
- Next actions: Implement and verify B1, commit it, then B2 adapters/bounds.
- Next-session cautions: G1/G2 closed and 13.G6 open; protect all six untracked handoff/review/draft files; never deploy Standard-only limits on the authorized Free account.

### 2026-10-10 — Module 09 B1 portable async model

- Scope and checklist IDs: 09.1b/09.1e, 09.2a, 09.3a; Module 02 producer compatibility.
- Progress: Portable model and both database stores verified; platform adapters and consumers remain B2–B5.
- Change summary: Added sidecar publication/execution leases, retry/failure/replay state and stable identities; bounded checkpointed jobs atomically record step witnesses. Producer outbox/envelope shapes unchanged.
- Files/artifacts: Application/database async-processing modules, additive D1 0030/PostgreSQL 0029 migrations; [evidence](../evidence/09-async-validation.md).
- Verification: Focused unit 1, contract 1, workerd/D1 3 and real isolated PostgreSQL 18.6 3 passed; typecheck/lint/boundaries/db:check/diff passed. Initial syntax/lint and PG bigint inference failures corrected; unrelated tests deliberately filtered. No hosted resources.
- Decisions and deviations: Explicit at-least-once; source acknowledgement follows consumer completion, never queue publication. Replay requires fresh operator authorization. Primary focused review only; audit remains suspended.
- Blockers/open questions: None for B1; platform support and hosted quotas remain unverified.
- Next actions: B2 TaskQueue adapters, bounded dispatch/consumption and telemetry.
- Next-session cautions: Keep failed records replayable and fences conditional; preserve existing migrations/protected files and G1/G2/13.G6 states.

### 2026-10-10 — Module 09 B2 queues, bounds and telemetry

- Scope and checklist IDs: 09.1a, 09.2b/09.2c; additive telemetry indexes and Graphile dependency.
- Progress: Both queue adapters, bounded runner and safe telemetry verified; consumer wiring remains B3.
- Change summary: Cloudflare send/schedule/ack/retry and actual PostgreSQL Graphile delayed tasks; two underlying-operation slots survive deadlines; bounded dispatch/fan-out/backlog telemetry and non-critical circuit breaking.
- Files/artifacts: App task-queue adapters, application async-runner, shared fixture/tests/build target, Node manifest/lock; D1 0031/PG 0030 indexes; [evidence](../evidence/09-async-validation.md).
- Verification: Unit 3, local Queue retry 1, actual Graphile/PostgreSQL 1, changed-backlog D1/PG 1 each passed; type/lint/boundaries/db/license/secrets/diff passed. Unrelated cases filtered; no hosted resource created.
- Decisions and deviations: Added only graphile-worker@0.18.0 directly; lifecycle/license policy passes. Miniflare initial lookup miss resolved via workers-sdk and actual local proof. Backlog counts saturate as documented lower bounds; oldest age uses covering indexes.
- Blockers/open questions: No B2 blocker; Standard deployment performance and Minimum/Workflows evidence remain unverified.
- Next actions: B3 wire current plugin configuration/permissions and search handler; inject commit/send/processing/ack failures and close Module 08 handoffs.
- Next-session cautions: Preserve source events until consumer completion; provider dedupe does not replace idempotency; stalled work cannot release capacity early; all gates/protected files unchanged.

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

### 2026-10-10 — B4 implementation checkpoint

- Scope and checklist IDs: 09.3b/c/d/f and 09.V3/V4.
- Progress: Workflow adapters and resumable maintenance cursor implemented; verification remains pending, no B4 checkbox closed.
- Change summary: Named Cloudflare steps and PostgreSQL/Graphile checkpoints; scheduler-owned bounded upload retention and resumable one-project cleanup; consolidate existing entry points.
- Files/artifacts: Application workflow/maintenance modules, app workflow adapters, async config and additive D1 0032/PG 0031 maintenance migrations; operator documentation/tests in preparation.
- Verification: B3 committed ef7f66d; B4 runtime checks not yet run. Wrangler skill/current installed v4.144.0 and type schemas inspected.
- Decisions and deviations: Graphile reconciliation must use replace rather than unsafe_dedupe because failed provider jobs retain keys; application idempotency remains authoritative and retry bounds unchanged. Expected-checkpoint fencing prevents a retried named Cloudflare step from advancing a different database step.
- Blockers/open questions: Local Workflow persistence/lifecycle support requires actual installed-runtime proof. No source-policy deviation or scope expansion identified.
- Next actions: Finish B4 conformance/scheduler/docs and verify once per affected lane before commit.
- Next-session cautions: B4 is uncommitted; do not confuse implementation with acceptance. All protected files/gates/suspended audit remain unchanged.

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

### 2026-10-10 — B5 hosted CPU stop checkpoint

- Scope and checklist IDs: B5 09.1f/09.2e/09.3g/09.V6, no audit or later features.
- Progress: Minimum prototype and focused local recovery/quota/retention checks pass. Actual Free-account dispatch measured 15 ms CPU, above the required 10 ms; B5 remains uncommitted and its checkboxes open.
- Change summary: Added bounded D1 cursor import/reservations, a direct checkpoint runner, phase scheduling, failed replay-window retirement and capability fields. One optimization combined execution claim/source snapshot and removed four statements; the hosted dispatch still measured 15 ms (15 statements/43 rows read/21 rows written).
- Files/artifacts: Uncommitted Minimum runtime/application/D1 model, additive D1 0033/0034 and PostgreSQL 0032 migrations, dual retention/capability tests and bilingual docs; ignored `.local/module09-hosted` receipts. Detailed stop evidence will follow cleanup.
- Verification: Local workerd Minimum/replay-retention 2, PostgreSQL retention/capability 2, public Minimum document 1, maximum multipart-subrequest unit 1, optimized local recovery 1 pass; typecheck/lint/db:check/build/docs/secrets pass at recorded checkpoints. Actual Queue retry/ack, Workflow commit-before-step-result retry/cancel, D1 checkpoint/event restart recovery pass. Worker seed/edit CPU is outside async acceptance. Actual dispatch CPU is a failed required bound, not waived by successful HTTP results.
- Decisions and deviations: Stop under HANDOFF-09's bound rule; no threshold relaxation, normative edit, additional dependency, paid capability, push or B5 commit. Free plan is user-attested; subscription endpoint denied API confirmation. Before-test analytics: D1 758 reads/0 writes; Workers 24 requests; Queue/Workflow datasets empty (snapshot, not real-time billing).
- Blockers/open questions: 09.1f/09.V6 actual 10 ms CPU fit. Further architecture changes need a new bounded decision; preserve current prototype for review.
- Next actions: Remove all owned hosted resources, clear mutable fixtures while preserving append-only history and every pre-existing row, write final evidence/status and report the blocker.
- Next-session cautions: B1–B4 committed, latest 462fd3c. B5 is uncommitted. Temporary worker/Queue/Workflow/domain still require confirmed cleanup at this checkpoint; G1/G2/13.G6 and suspended 09.3e unchanged.

### 2026-10-10 — Module 09 B5 blocked, hosted cleanup complete

- Scope and checklist IDs: 09.1f/09.2e/09.3g/09.V6; suspended 09.3e unchanged.
- Progress: B1–B4 committed, last 462fd3c. B5 local prototype passes focused recovery/quota/retention/capability checks; actual dispatch CPU exceeds 10 ms, so B5 stays uncommitted and four checks open. No further implementation after the stop.
- Change summary: Preserve B1–B4 acceptance; record uncommitted B5, actual Free CPU failure and scoped cleanup.
- Files/artifacts: Minimum application/D1/runtime modules, migrations, focused tests, internal/bilingual docs and final evidence; [detailed B5 evidence](../evidence/09-async-validation.md#b5--minimum-prototype-and-hosted-cpu-blocker) and [safe receipt](../evidence/09-hosted-minimum-receipt.json).
- Verification: Focused local Minimum/replay-retention workerd 2, PostgreSQL retention/capability 2, Minimum capability 1, maximum multipart budget unit 1 and optimized recovery 1 pass; prior typecheck/lint/db:check/build/docs/secrets pass. Actual dispatch 15/20 ms fails required 10 ms. Final cleanup API/row/foreign-key guards pass; raw DNS inventory 403, independent absence unverified. Hosted quota exhaustion not run. Affected replay commands and limitations are in linked evidence. Final corepack pnpm docs:build, scan:secrets, scoped oxfmt --check and git diff --check pass; checklist/status/receipt/local-link/bilingual-path/empty-staging guards pass. No broad green-lane rerun.
- Decisions and deviations: Follow HANDOFF-09 “If a bound cannot be met, stop and report.” No bound/normative change, dependency addition, B5 commit, push or PR update; audit stays suspended.
- Blockers/open questions: Module09 B5 Free CPU fit. Further changes in Module08 require explicit bounded scope authorization; batching is a proposal, not a proven fix.
- Next actions: Obtain that scope decision, then resume only authorized affected implementation/verification. Final scoped formatting/document checks passed; no staged files.
- Next-session cautions: Keep B5 uncommitted and 09.1f/09.2e/09.3g/09.V6 unchecked; preserve protected drafts, baseline/append-only history and additive migrations. G1/G2 closed and 13.G6 open. Hosted owned mappings/resources are gone; ignored receipts contain private configuration and must not be staged.

### 2026-10-10 — B5 resumed through authorized Module08 investigation

- Scope and checklist IDs: 09.1f/09.2e/09.3g/09.V6; user authorizes only scoped Module08 D1 search profiling/batching and B5 retry.
- Progress: Scope decision received; 15 ms versus 10 ms blocker remains until new actual evidence passes.
- Change summary: Investigate four-call search path; combine Minimum quota admission/source retrieval without changing validation or index guards.
- Files/artifacts: Module08 search adapters/fixtures; uncommitted B5 and existing evidence remain.
- Verification: Current worktree/commits/receipt inspected; no acceptance check closed or hosted resource created yet.
- Decisions and deviations: No threshold/contract relaxation; no subagents. Hosted retries use fresh owned resources and a fresh baseline backup.
- Blockers/open questions: Actual Free CPU fit remains unproven.
- Next actions: Finish scoped search patch/checks; then hosted CPU comparison and quota/recovery checks if CPU passes; clean resources and record final outcome.
- Next-session cautions: Preserve B1–B4 commits, protected drafts, baseline append-only records and closed G1/G2/open13.G6; stop again if the required bound fails.

### 2026-10-10 — Authorized search batching verified locally, CPU still blocked

- Scope and checklist IDs: 09.1f/09.2e/09.3g/09.V6 resumed investigation;09.3e remains suspended.
- Progress: Authorized Module08 batching removes one statement/call; fresh uninstrumented dispatcher replay still fails at 22 ms versus 10 ms. Stop again; no B5 check closed or commit.
- Change summary: Complete the scoped investigation, retain uncommitted changes and stop hosted acceptance after the fresh CPU failure.
- Files/artifacts: D1 search-budget/search-index, shared search-contract, bilingual deployment/internal docs, [follow-up evidence](../evidence/09-async-validation.md#authorized-module08-d1-batching-follow-up--2026-10-10) and [fresh receipt](../evidence/09-hosted-minimum-batching-receipt.json).
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
