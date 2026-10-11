# 09 progress — Outbox delivery, queues, durable workflows, and cleanup

Plan: [Detailed checklist](../modules/09-async-and-workflows.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress (composed hosted job recovery verified; composed maximum dispatch14ms fails10ms; native Cron proof pending)
- Delivery scope: MVP backend
- Prerequisites: 08 complete; handlers from 05, 07, and 08.
- Implementation started: B1–B4 implemented and verified at documented local scope.
- Completed implementation checklist IDs: 09.1a–e, 09.2a–e, 09.3a–d/f/g, 09.V1–V5.
- Active/next checklist group: B5 — 09.1f and 09.V6 (r9 maximum-content native10 ms and quota refusal2 ms observed; quota recovery4 ms/cleanup verified; R11 unobserved and cleaned; composed native job recovery pending).
- Last updated: 2026-10-11.
- Blocking issues discovered: R9 maximum title/body selective native Cron fits10ms without margin; quota refusal2ms/recovery4ms are verified. R12 full composed HTTP fault9ms/clean redeployment resume7ms verifies exact checkpoints and pending-event survival, but max dispatch14ms fails10ms. Native Cron proof remains open; R10/R11 are unobserved and cleaned. Prior native14 ms remains historical evidence. Standing authorization permits bounded performance refactoring/retries and conditional capacity/target revisions; the target stays10 ms.
- Evidence: [Async validation](../evidence/09-async-validation.md); audit 09.3e remains suspended.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 09.1 | Implement reliable event dispatch | In progress (native CPU fit) | [B1–B5 partial evidence](../evidence/09-async-validation.md) |
| 09.2 | Bound failure and fan-out | Complete | [B1–B5 partial evidence](../evidence/09-async-validation.md) |
| 09.3 | Implement durable workflow and retention foundations | Complete (09.3e suspended) | [B4 evidence](../evidence/09-async-validation.md#b4--workflows-and-scheduled-maintenance) |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. R9 maximum native dispatch10 ms, quota refusal2 ms/recovery4 ms and cleanup are verified. R10/R11 native trials ended unobserved and are independently cleaned. R12 composed HTTP recovery is verified, but maximum dispatch14ms fails10ms; use a fresh baseline after the next measured refactor; require exact witnesses and cleanup. Registration/local timing do not close 09.1f/09.V6.
2. Preserve source/capability/rebuild guards and all quota/security limits. User authorization permits capacity reduction and a project-target revision after repeated failures, while the provider ceiling and release acceptance remain separate. Keep G1/G2 closed and 13.G6 open.

## Next-session cautions

Assume at-least-once delivery and crash-after-side-effect replay. Queue deduplication alone does not guarantee business idempotency.

B1–B4, the B5 prototype, metering/cursor optimizations and title-only capacity reduction f6a1e9e are committed locally. The latest completed r6 cleanup is verified; r7 full-text f0c9a1d ended without native execution and is fully cleaned; its 135-row baseline and original resources are verified, and all three processes are terminal. R8 title-only source f6a1e9e also ended unobserved and is fully cleaned; its140-row baseline, exact singleton content and original resources are verified, and all processes are terminal. Fresh R9 preparation must use a new backup/inventory and exclusively declarative Cron. Follow the newest live handle/outcome records before any hosted mutation; do not rerun inventory after seeding. Raw DNS inventory remains unverified (403). Preserve original rows/history and additive migrations. No push/PR edit or audit resume.

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

### 2026-10-10 — Authorized dispatcher performance retry started

- Scope and checklist IDs: 09.1f/09.2e/09.3g/09.V6; user authorizes testing/refactoring across profiles if needed.
- Progress: New bounded retry authorized after the recorded 22 ms CPU stop; acceptance remains open.
- Change summary: Prepare token-fenced admission/claim batching, immutable revision hydration and completion/backlog batching.
- Files/artifacts: D1 async adapters/schema, Minimum composition and focused tests; no hosted resources yet.
- Verification: Not run; prepare the full batch before focused checks. Context7 D1 resolve/query confirms ordered transactional batches (2026-10-10).
- Decisions and deviations: Preserve contracts, source validation, current-state index guards, all quotas and retry/lease limits. No paid capability or audit resume.
- Blockers/open questions: Actual Free CPU fit remains unproven.
- Next actions: Verify local concurrency/refusal/recovery and migration; then one fresh hosted CPU retry with backup and cleanup.
- Next-session cautions: d9ee49d is the committed prototype; new edits are uncommitted. Protect private backups/root drafts; G1/G2 and 13.G6 unchanged.

### 2026-10-10 — Dispatcher batching verified; native Cron evidence remains open

- Scope and checklist IDs: Module09 B5 09.1f/09.2e/09.3g/09.V6, authorized tests/refactoring across profiles if needed; no audit resume.
- Progress: Close 09.2e/09.3g from existing dual-store retention/replay/capability proofs plus fresh D1 quota/recovery/checkpoint evidence. Keep 09.1f/09.V6 open because native Cron execution was not observed; full Module09 completion is not claimed.
- Change summary: Atomic token-fenced admission/claim, combined bounded source imports/cursors, immutable exact-source revision hydration, completion/backlog batching; retain all contracts, permissions, quotas and lease/retry ceilings.
- Files/artifacts: Performance batch committed as `b5c5206` (`perf(async): batch minimum admission and completion`); D1/runtime adapters, additive D1 0035_async_admission_token, focused tests, internal/bilingual docs; [detailed evidence](../evidence/09-async-validation.md#authorized-minimum-dispatcher-batching-retry--2026-10-10) and [safe receipt](../evidence/09-hosted-minimum-dispatcher-receipt.json).
- Verification: Three distinct Minimum workerd checks and four focused D1 migration/search cases pass; typecheck/lint/db:check/build/scoped formatting/secrets/diff/docs:build pass. Twelve explicit hosted tick samples at 1–10 ms CPU: canonical/max-body search, quota refusal/recovery, event/job redeployment recovery, expiry/terminal/no-storage phase probes. Native scheduled handler and one trigger verified, but tail and scheduler analytics showed no native run and the prepared source remained pending through 13:00 UTC. No unchanged PostgreSQL or broad green test lane rerun.
- Decisions and deviations: No dependency, public/normative change, paid capability or gate closure. Duplicate quota helper import side effect removed. Expiry probe touched two pre-existing expired rows; restored exact values immediately. Initial and final OAuth expiry/transient user-info failures resolved sufficiently for actual API verification; final cleanup comparison resumed read-only rather than repeating successful mutations.
- Blockers/open questions: Native Cron delivery/CPU remains unproven; a final read-only scheduler query at 2026-10-10T13:29:15.819Z still returned zero events without query errors. Cause is unknown; do not replace native execution with registration or explicit ticks.
- Next actions: Preserve this coherent performance batch and obtain native Cron proof under existing test authorization. Keep 09.3e suspended, G1/G2 closed and 13.G6 open.
- Next-session cautions: Owned Worker/domain/Queue/Workflow inventory zero, tail stopped; 107 baseline rows exact, foreign keys valid, owned mutable work zero, two new timeline/two audit records retained with inactive fixtures. Restore singleton state exactly and preserve additive history; raw DNS absence independently unverified. Protected drafts/private backups stay excluded. No push or PR edit for this batch.

### 2026-10-10 — Native Cron dispatch verified but CPU bound failed

- Scope and checklist IDs: Module09 09.1f/09.V6 native scheduler verification under existing test authorization; audit remains suspended.
- Progress: Real native delivery, canonical indexing and acknowledgement observed. Productive native tick measured 20 ms against the required 10 ms CPU bound; 09.1f/09.V6 remain open.
- Change summary: Isolated provider delivery with a scheduled-only Worker, then tested the unchanged Minimum function on the same Worker. No application code, contract, dependency or migration change.
- Files/artifacts: [Native evidence](../evidence/09-async-validation.md#native-scheduler-diagnostic-and-dispatch-cpu-failure--2026-10-10), [safe receipt](../evidence/09-hosted-native-scheduler-receipt.json), internal/paired reader guidance and status records; private helpers remain ignored.
- Verification: Native witness 0 ms, empty dispatch 7 ms, canonical dispatch 20 ms; final index revision 1, source acknowledged, delivery attempts 1. Owned resources zero and tail stopped; all 115 original records/columns and captured singleton state verified, foreign keys valid, original two Workers/domains preserved. Final docs:build, secrets, receipt/cleanup/checklist/link guards, JSON serialization and diff hygiene pass. Scoped oxfmt had no eligible files because repository ignore rules exclude docs; no application lane rerun for this documentation-only session.
- Decisions and deviations: Stop after CPU failure under HANDOFF-09. Fixed probe dispatch phase protects original expired identity rows; seed request CPU is outside async acceptance. No paid feature, threshold waiver, audit resume or gate closure.
- Blockers/open questions: Native dispatch CPU exceeds the bound; earlier missing native delivery cause remains unknown.
- Next actions: Report the measured failure; a new user direction after the HANDOFF-09 stop is required before further performance implementation or hosted acceptance. Native CPU profiling is the next proposed investigation. Preserve 09.2e/09.3g and Module08's existing dispatch/retry closure.
- Next-session cautions: No further hosted probe/refactor after the failure. Keep original data/history and committed batches; retained inactive fixture has one timeline/one audit record. Raw DNS absence unverified, custom-domain mapping absent. No push or PR edit; G1/G2 closed and 13.G6 open.

### 2026-10-10 — Post-stop native profiling proposal prepared

- Scope and checklist IDs: Read-only review/proposal for Module09 09.1f/09.V6 and the Module08 search-meter seam.
- Progress: Revalidated the committed native 20 ms failure; no live test/owned resource remains. Approval for continuing after failures is pending.
- Change summary: Identify initialization/factory creation, layered metering and four D1 call boundaries as profiling targets; no CPU causality is claimed.
- Files/artifacts: [Prepared proposal](../evidence/09-async-validation.md#proposed-native-cpu-investigation-after-the-stop--2026-10-10), affected progress records; no application changes.
- Verification: Current Git status, native receipt and relevant source inspected; docs:build, relative-file links and diff hygiene pass. No hosted probe, implementation, dependency or migration.
- Decisions and deviations: Preserve all contracts/security/numeric ceilings. The explicit HANDOFF-09 stop requires a new human decision; automatic continuation does not override it.
- Blockers/open questions: Native CPU exceeds 10 ms; pending authorization to profile/refactor and run bounded native retries after failures.
- Next actions: Await the pending question's answer; if authorized, begin measured profiling and the relevant focused checks.
- Next-session cautions: Keep 09.1f/09.V6 open, 09.3e suspended and G1/G2/13.G6 unchanged. Do not restart completed test handles or stage protected/private files.

### 2026-10-11 — Continued performance investigation authorized

- Scope and checklist IDs: 09.1f/09.V6 and authorized Module08 metering seam.
- Progress: Human authorizes profiling/refactoring across profiles if needed and bounded native retries with cleanup after each attempt. Latest 20 ms native result remains unaccepted.
- Change summary: Resume investigation; preserve every contract, security check and numeric limit.
- Files/artifacts: Module09/master status, affected progress records; ignored local profiling helpers.
- Verification: Context7 Workers resolve/query on 2026-10-11 documents local CPU profiling and distinction from hosted CPU; implementation checks pending.
- Decisions and deviations: Human authorization supersedes HANDOFF-09 stop-after-bound-failure and historical pending-approval entries. No audit resume or gate closure.
- Blockers/open questions: Native canonical dispatch must fit 10 ms; local profiles cannot establish acceptance.
- Next actions: Profile measured costs, optimize demonstrated hotspots, focused checks and bounded native retries with cleanup.
- Next-session cautions: 09.1f/09.V6 open, 09.3e suspended, G1/G2 closed and 13.G6 open. No push/PR edit; protect root drafts, original data and backups.

### 2026-10-11 — Metering and initialization profiling checkpoint

- Scope and checklist IDs: Authorized Module09 B5 09.1f/09.V6 performance continuation and affected integration seams; no audit resume.
- Progress: Direct metering facades, phase-specific factory construction, internal async exports and deferred upload configuration locally verified. Native r4 produced no event within its bounded window; CPU acceptance remains open.
- Change summary: Preserve SQL, existing handlers, permissions, quotas and numeric limits. Keep default package entries and adapter imports; no lint exemption, dependency or migration.
- Files/artifacts: Minimum composition/meter, internal application/D1 async entries, unit coverage; [profiling evidence](../evidence/09-async-validation.md#authorized-cpu-profiling-continuation--2026-10-11), [r4 receipt](../evidence/09-hosted-native-meter-retry-receipt.json).
- Verification: Unit meter 3, search availability 28, workerd queue/workflow/Minimum 5 pass; typecheck, lint/boundaries, build and final Minimum target build, scoped format, secrets, docs build and diff pass. Local CPU/startup sampling is diagnostic only. R4 cleanup verifies 120 original records, foreign keys, singleton state, original two Workers/mappings and zero owned resources/work; live processes terminal.
- Decisions and deviations: Human approval permits continued bounded attempts after failures. Reverted lint-rejected internal adapter/contract paths rather than adding exclusions. Fixed copied fixture missing IDs only after proving no writes; TLS readiness and OAuth refresh handled. No native execution/CPU inferred from handlers, registration or local timing.
- Blockers/open questions: Latest productive native evidence remains 20 ms against 10 ms. Missing native delivery on r4 is unexplained.
- Next actions: Preserve the verified refactor; test the compiled module graph and final-binding Cron registration using a fresh owned attempt with cleanup.
- Next-session cautions: 09.1f/09.V6 open; 09.2e/09.3g and Module08 closure preserved; 09.3e suspended; G1/G2 closed and 13.G6 open. No push/PR edit. Exclude protected root/private helper files.


### 2026-10-11 — Combined Minimum claim/search admission checkpoint

- Scope/checklist IDs: Authorized continuing 09.1f/09.V6 performance work and Module08 D1 search integration.
- Progress/change summary: Native module-graph r5 still fails at 12 ms against 10 ms; cleanup verified. Canonical claim/search admission now shares one atomic batch; all existing handler checks and numeric limits remain. Alternate JSON retains ordinary validation.
- Files/artifacts: D1 async/search budget/index/meter, workerd admission test, [evidence](../evidence/09-async-validation.md#native-module-graph-result-and-atomic-search-admission--2026-10-11), [r5 receipt](../evidence/09-hosted-native-module-retry-receipt.json).
- Verification: workerd6 plus D1 search13, availability unit28 and meter unit3 pass; typecheck/lint/boundaries/build/scoped format pass. Initial overly complex GLOB fixed without changing acceptance policy. No unchanged PostgreSQL rerun.
- Decisions/deviations: Human retry authorization persists. r5 source acknowledged but CPU fails; local provider-call reduction is not hosted acceptance. Original two Workers/domain mappings independently compared and preserved; r5 local inventory helper overwrote only private inventory/state, so comparison used preserved r4 baseline. No hosted mutation resulted.
- Blockers/open questions: 09.1f/09.V6 CPU and representative native recovery remain open. 09.3e suspended; G1/G2 closed, 13.G6 open.
- Next actions: Fresh bounded native r6 with new suffix/backup; maximum body and affected recovery only after canonical CPU fit; cleanup after each attempt.
- Next-session cautions: Preserve fresh reservation fencing, source quotas, post-I/O accounting and current projection checks; do not stage protected files or private logs; no push/PR edit.


### 2026-10-11 — Native admission result and cursor consolidation

- Scope and checklist IDs: Authorized Module09 09.1f/09.V6 performance continuation and Module08 indexing seam.
- Progress: Native r6 canonical dispatch took 14 ms CPU and still fails 10 ms; source indexed/acknowledged once. Cleanup verified before continuing. Consolidated cursor initialization and advancement reduces canonical work from eleven to ten SQL statements, preserving three provider round trips.
- Change summary: Missing cursors use the existing zero prefix; one gated UPSERT initializes/advances or resets both bounded source cursors. Admission refusal retains all state. No lease, retry, quota, authorization or index contract changes.
- Files/artifacts: D1 Minimum adapter and admission suite; [r6 receipt](../evidence/09-hosted-native-admission-retry-receipt.json), [detailed evidence](../evidence/09-async-validation.md#native-admission-result-and-cursor-consolidation--2026-10-11).
- Verification: Focused Minimum workerd seven tests, typecheck, lint/boundaries and build pass. r6 preserved 130 baseline rows, singleton values, foreign keys and original two Workers/mappings; all owned resources/mutable work removed and processes terminal. No unchanged PostgreSQL lane rerun.
- Decisions and deviations: Human now permits raising the project target and reducing Minimum capacity after repeated measured optimization failures. No target/capacity change applied yet. Context7 Workers resolve/query (2026-10-11) explicitly lists Free Cron CPU 10 ms; higher internal targets cannot establish provider acceptance. Native r6 arrived after the monitor deadline; tail/state prove execution. During continuation gap it emitted harmless empty ticks before cleanup.
- Blockers/open questions: 09.1f/09.V6 remain open; 09.3e suspended, G1/G2 closed, 13.G6 open.
- Next actions: Bounded fresh r7 native retry against the ten-statement path with independent backup and cleanup; measure representative size/recovery only after canonical fit.
- Next-session cautions: No push/PR edit; preserve history and baseline data. Do not rerun inventory after seeding. Higher project CPU target must not rewrite provider limits or imply full Free acceptance.


### 2026-10-11 — Ten-statement native retry running

- Scope and checklist IDs: Authorized Module09 09.1f/09.V6 performance continuation; no target/capacity change yet.
- Progress/change summary: f0c9a1d committed locally. Fresh r7 backup, native-only Worker, canonical producer fixture and one Cron are ready; tail confirmed live. Source pending; observation/cleanup are in progress.
- Files/artifacts: [Detailed retry/profile record](../evidence/09-async-validation.md#native-r7-in-progress-and-coldwarm-diagnostic); ignored r7 and cold-profile helpers.
- Verification: Reuse seven workerd checks and passed typecheck/lint/build/docs/secrets/scoped format/diff. Twenty cold/warm local isolate profiles provide diagnostic initialization evidence; not hosted acceptance. REST producer fixture used after custom-domain TLS readiness failure; no explicit tick or public API acceptance.
- Decisions/deviations: Native observation 65 minutes, automatic owned cleanup on CPU failure or absolute 70-minute bound. Credentials refreshed before watchdog cleanup; no numeric runtime limit changed. Standing user permission allows lower Minimum capacity and higher project target if repeated optimization still fails; provider 10 ms remains independently disclosed.
- Blockers/open questions: Native r7 result and cleanup pending; 09.1f/09.V6 open.
- Next actions: Collect live native result; if fit, representative body/recovery proof; if failed, verify cleanup before measured capacity reduction. Every attempt must finish cleanup.
- Next-session cautions: Owned Worker hyperbug-09-native-219f58b807f6, tail session1863, monitor87992; watchdog restarted after adding credential refresh. Deadline 19:39:09 UTC, cleanup bound19:44:09 UTC. Preserve 135 baseline records; no inventory rerun, push/PR edit or gate/audit changes.


### 2026-10-11 — Refined cold-binding investigation during native wait

- Scope/checklist IDs: Authorized 09.1f/09.V6 and affected Module08 seam; no application or normative change.
- Progress/change summary: Confirm r7 monitor/tail/watchdog live, one Cron, pending canonical state. Private staged-import prototype showed no clear local gain and is unapplied. Refined local measurement includes first D1 binding use by seeding outside the Worker.
- Files/artifacts: [Detailed investigation](../evidence/09-async-validation.md#native-r7-waiting-and-refined-cold-cost-investigation--2026-10-11), safe profile aggregates; private prototypes ignored.
- Verification: Twenty fresh local isolates per diagnostic, actual canonical producer and D1 emulation; source/index acknowledgements observed locally. Not hosted CPU acceptance. Current Context7 trace enablement lookup records no default tracing and no substantiated benefit from disabling it. No green application lane repeated.
- Decisions/deviations: Preserve current ten-statement deployment and all limits while native outcome is pending. User permits measured target/capacity revision after repeated failure; any higher project target must disclose unchanged provider 10 ms and retain recovery/backlog/security. No target or logging waiver applied.
- Blockers/open questions: Native execution/CPU/cleanup pending. Module09 open, 09.3e suspended; G1/G2 closed, 13.G6 open.
- Next actions: Revalidate native handles and canonical state; collect r7 CPU or absolute timeout cleanup. After failure verify cleanup before capacity/target work; after fit run prepared representative/recovery checks.
- Next-session cautions: Tail 1863, monitor 87992, watchdog 20221; r7 deadline 19:39:09 UTC, automatic cleanup 19:44:09 UTC or earlier failure. Read ignored live-handles.json. Watchdog captures canonical state before restoring data. Do not restart because observation expired or rerun inventory; no push/PR edit.


### 2026-10-11 — Maximum-content title-only capacity prototype

- Scope/checklist IDs: Authorized 09.1f/09.V6 performance continuation and conditional Module08 capacity alternative.
- Progress/change summary: Private maximum-content prototype verifies smaller index/source payload and lower cold local samples for title-only work. No production source, target or capacity change. r7 remains a verified live wait.
- Files/artifacts: [Detailed measurements and limitations](../evidence/09-async-validation.md#maximum-content-title-only-prototype--2026-10-11), safe profile aggregates; private prototype ignored.
- Verification: Twenty fresh actual local workerd/D1 isolates per full-text/title-only variant; canonical maximum 200-title/32768-body producer, current index revision 1 and 5,562-byte versus 2-byte body inspected. No native acceptance; sequential sparse profiles are not a controlled speedup. No broad green lane repeated.
- Decisions/deviations: If native r7 fails, title-only is a measured fallback candidate; implement query/readiness/version/cursor/rebuild/disclosure consistently before deployment. User permits higher project target with reduced Minimum capacity after repeated failure; provider 10 ms stays separate and release gates remain open.
- Blockers/open questions: Native r7 CPU/cleanup pending; no fallback activated.
- Next actions: Inspect native monitor 87992/watchdog 20221 and canonical state; verify cleanup before a failed-trial fallback, or complete representative/recovery tests after fit.
- Next-session cautions: Preserve source f0c9a1d trial, unchanged standard contracts and all security/lease/quota checks. Do not ship private title-source suppression without production mode safeguards; no inventory rerun, push/PR edit or audit/gate closure.

### 2026-10-11 — Coherent Minimum title-only capacity implementation

- Scope and checklist IDs: Authorized 09.1f/09.V6 performance continuation, Module08 capacity reduction and affected contract/acceptance checks.
- Progress/change summary: Minimum source/index/query now use titles only with distinct readiness identity and cursor policy 2; Standard retains full text. Bounded bidirectional reconciliation preserves canonical data. Instance capability and paired reader disclosure updated. Native r7 remains on full-text f0c9a1d; no target change or hosted fallback yet.
- Files/artifacts: Search adapters/application/capability contracts and tests, [ADR 0014](../../decisions/0014-minimum-title-search.md), [detailed evidence](../evidence/09-async-validation.md#coherent-minimum-title-only-implementation--2026-10-11), safe profiles and bilingual guides.
- Verification: Workerd 19, unit 34, corrected focused PostgreSQL 14 and shared async workerd three pass; typecheck/lint/boundaries/build/docs/secrets/scoped format/diff and foundation contract pass. Accidental broad PostgreSQL run had 208 pass/four failures/two existing skips; relevant capability, sidecar table-count and claim fixture expectations fixed and focused regressions pass. Broad matrix not repeated/claimed green. Twenty current-production local cold/warm profiles verify empty indexed body; median cold 6,938.5 microseconds is diagnostic only.
- Decisions/deviations: Human authorizes this reduced capacity after repeated native failures. ADR records review and upgrade/downgrade behavior. No canonical truncation, quota/security relaxation, schema or dependency change. Internal/project CPU target remains 10 ms; provider limit independently unchanged.
- Blockers/open questions: r7 native outcome/cleanup pending; 09.1f/09.V6 open.
- Next actions: Collect native r7; verify cleanup, then fresh bounded title-only native measurement and representative recovery.
- Next-session cautions: r7 tail 1863/monitor 87992/watchdog 20221; deadlines 19:39/19:44 UTC. Preserve 135 baseline rows; no inventory rerun, push/PR edit, protected/private staging or audit/gate closure.

### 2026-10-11 — Native propagation investigation and title-trial preparation

- Scope/checklist IDs: Authorized 09.1f/09.V6 native performance continuation; 13.G6 evidence dependency.
- Progress/change summary: f6a1e9e commits coherent title-only capacity reduction locally. r7 remains pending beyond the documented propagation period; no new native CPU result or target change. Next title-only maximum-content/quota trial is prepared privately, not deployed.
- Files/artifacts: [Propagation/preparation record](../evidence/09-async-validation.md#native-propagation-investigation-and-prepared-next-trial); ignored r7 comparison/receipt and r8 producer helpers.
- Verification: Context7 Workers resolve/query (2026-10-11) documents up to 15-minute schedule propagation, 30-minute new-Worker history display lag and empty-versus-omitted Cron deployment semantics. Provider registration/tail read at 19:26:56; source pending at 19:21:05, no native tail event by 19:35:28. Reuse f6a1e9e application checks; no unchanged lane repeated.
- Decisions/deviations: Retain the original bounded wait and independent automatic cleanup. No CPU inference, unbounded retry or new resource creation.
- Blockers/open questions: Native scheduling delay unexplained; r7 outcome/cleanup pending; 09.1f/09.V6 open.
- Next actions: Collect monitor/watchdog; verify cleanup and original resources using prepared helpers; publish safe receipt. Only then fresh r8 backup/inventory, committed-source build and maximum-content native trial.
- Next-session cautions: r7 tail 1863/monitor 87992/watchdog 20221; absolute deadlines 19:39:09/19:44:09 UTC. Preserve 135 baseline records and singleton values. Do not rerun r7 inventory, deploy r8 before cleanup, stage private/protected files, push/PR edit or resume audits/close gates.


### 2026-10-11 — R7 cleanup and active maximum-content title trial

- Scope/checklist IDs: Authorized 09.1f/09.V6 continuation; 13.G6 evidence dependency.
- Progress/change summary: R7 unobserved timeout fully cleaned and preserved; R8 title-only maximum-content native trial active. No new CPU result or target change.
- Files/artifacts: [Detailed trial record](../evidence/09-async-validation.md#r7-timeout-cleanup-and-active-title-only-r8-trial--2026-10-11), [R7 receipt](../evidence/09-hosted-native-cursor-retry-receipt.json); ignored R8 helpers and local phase-4 profiler.
- Verification: R7 135 baseline records/original two Workers/mappings/FKs/singletons preserved, owned resources/work zero and all processes terminal. R8 fresh 140-record backup, max200-title/32768-body producer, registered handlers/deployment/one Cron and live processes verified. Source still pending at20:11 UTC; no scheduled history at20:13 UTC. Docs build, secrets, scoped formatting and diff hygiene pass; no repeated green application lane.
- Decisions/deviations: Current Context7 lookup and focused provider schema introspection document separate live/history evidence; no execution inferred from registration. Standing human retry/capacity authorization persists.
- Blockers/open questions: Native scheduling delay unresolved; CPU fit/recovery remain open. Latest productive native result14 ms; project/provider target10 ms.
- Next actions: Collect R8 native outcome or bounded cleanup; after fit preserve maximum result and exercise quota/job restart; after failure verify cleanup before further measured optimisation.
- Next-session cautions: Tail10791/monitor11882/watchdog4672; observation20:55:15, cleanup21:00:15 UTC2026-10-10. Check watchdog before any mutation; no inventory rerun, protected/private staging, push/PR edit or audit/gate closure.


### 2026-10-11 — D1 checkpoint-job boundary reduction

- Scope/checklist IDs: Authorized 09.1f/09.V6 performance continuation and D1 persistence seam.
- Progress/change summary: Claim classification/acquisition and commit confirmation batched; job path retains eleven SQL statements while reducing provider calls ten to eight. R8 deployment/source unchanged.
- Files/artifacts: D1 async adapter, [job evidence](../evidence/09-async-validation.md#d1-checkpoint-job-batching-investigation--2026-10-11), [safe local profiles](../evidence/09-local-dispatch-cpu-profile.json).
- Verification: Actual local Workflow/Minimum four and shared D1 sidecars three pass; typecheck after explicit batch-row typing, lint/boundaries/build pass. Twenty fresh cold/warm isolates before/after preserve two witnesses; median CPU shows no demonstrated improvement. Docs build, secrets, scoped formatting and diff hygiene pass. No unchanged PostgreSQL rerun.
- Decisions/deviations: Current D1 Context7 lookup verifies batch ordering/transaction semantics. Preserve all lease, retry, cancellation, idempotency, reference and numeric guards; no new contract/schema/dependency.
- Blockers/open questions: Native title/job CPU and recovery remain unaccepted; project/provider10 ms unchanged.
- Next actions: Finish documentation checks/commit; collect existing R8 native outcome/cleanup, then only after CPU fit run representative recovery.
- Next-session cautions: R8 f6a1e9e remains active with original20:55/21:00 UTC bounds; no speculative redeploy, inventory rerun, push/PR edit, protected/private staging, audit resume or gate closure.


### 2026-10-11 — Native wait and recovery preparation checkpoint

- Scope/checklist IDs: Authorized 09.1f/09.V6 continuation; 13.G6 dependency.
- Progress/change summary: Local9bd76ce commits D1 job batching and prior cleanup evidence. R8 source remains f6a1e9e. Private maximum/quota/job guards and phase-4 build prepared, not executed/deployed.
- Files/artifacts: [Checkpoint evidence](../evidence/09-async-validation.md#native-wait-and-recovery-preparation-checkpoint--2026-10-11); ignored R8 live handles/helpers.
- Verification: Pending canonical source at20:21:50 UTC, empty delayed Cron history at20:24:18 UTC. OAuth refreshed privately after expiry. Analytics budget error cleared after five-minute backoff; no Worker/D1 quota failure inferred. Previous7 focused checks/typecheck/lint/build/docs/secrets/scoped format pass; new docs build, relative-file links, secrets and diff hygiene pass.
- Decisions/deviations: Recovery requires maximum revision/projection/body proof and sufficient cleanup headroom. No target change, speculative redeploy or refreshed inventory; no native evidence inferred.
- Blockers/open questions: Await native outcome and required recovery; latest productive native14 ms, project/provider10 ms unchanged.
- Next actions: Revalidate R8 processes/cleanup first; after native fit preserve maximum evidence then quota refusal/recovery and bounded job restart. If failed/unobserved, finish and independently compare cleanup before another action.
- Next-session cautions: Tail10791/monitor11882/watchdog4672; observation20:55:15.161 and cleanup21:00:15.161 UTC2026-10-10. New private helpers are unexecuted and retain fixed deadline guards; any justified extension must coordinate all watchers/guards. Protect140 baseline records; no protected/private staging, push/PR edit, audit/gate closure.


### 2026-10-11 — Verified native wait and recovery evidence guards

- Scope/checklist IDs: Authorized09.1f/09.V6 continuation and Module08 post-I/O search boundary review; no audit resume.
- Progress/change summary: Same three R8 processes confirmed live; protected401 appears in live tail, separating a working observer from missing native execution. Reject early index/source acknowledgement coupling; tighten private native-fit/quota-refusal and deadline guards.
- Files/artifacts: [Verified wait record](../evidence/09-async-validation.md#verified-native-wait-and-stricter-recovery-harness--2026-10-11); ignored native guards/helpers.
- Verification: Live tool handles at20:27:48, active provider tail and401 witness at20:30, pending max source at20:31:30 UTC. Guard dry checks reject unobserved CPU/quota evidence; no hosted fixture mutation. Docs build, relative-file links, secrets and diff hygiene pass; no unchanged application lane repeated.
- Decisions/deviations: Preserve post-I/O metering and processor timeout/abort before source acknowledgement. Future watcher starts use explicit bounded handle deadlines; current watchers were not restarted and keep original bounds.
- Blockers/open questions: Native scheduling delay, maximum CPU and recovery remain unproven; project/provider10 ms unchanged.
- Next actions: Collect existing native outcome or deadline cleanup; only after fit perform guarded quota/job recovery. Compare140 baseline rows and original resources after cleanup.
- Next-session cautions: R8 deployedf6a1e9e; tail10791/monitor11882/watchdog4672, deadlines20:55:15.161/21:00:15.161 UTC2026-10-10. Source/job preparation differs from actual native proof. No inventory rerun, protected/private staging, push/PR edit, audit/gate closure.


### 2026-10-11 — Title-only native timeout and verified cleanup

- Scope/checklist IDs: Authorized09.1f/09.V6 continuation;13.G6 evidence dependency.
- Progress/change summary: R8 has no native execution through bounded/late windows; cleanup independently verified. Strengthen exact singleton restoration checks and prepare one declarative-Cron control-plane diagnostic. No CPU target revision.
- Files/artifacts: [R8 receipt](../evidence/09-hosted-native-title-retry-receipt.json), [outcome/next diagnostic](../evidence/09-async-validation.md#r8-title-only-timeout-cleanup-and-declarative-cron-diagnostic); ignored helpers.
- Verification:140 baseline rows, exact singleton state,FKs, original two Workers/mappings preserved; owned resources/work zero; tail/monitor/watchdog terminal. Public status is inconclusive. Context7 Cron configuration guidance refreshed; initial Wrangler Action mismatch discarded. Docs build, relative-file links, secrets and diff hygiene pass; no unchanged application lane repeated.
- Decisions/deviations: This is unobserved execution, not another CPU failure. Native title-only fit remains unknown; do not raise a target on this result. Exclusively declarative first deployment is a distinct bounded procedure, not a restart of timed-out live handles.
- Blockers/open questions: Latest productive native14 ms; title-only CPU and required recovery remain unproven; scheduling delay unexplained.
- Next actions: Finish/commit safe records, then fresh R9 backup and seeded-before-deploy declarative Cron diagnostic under standing authorization.
- Next-session cautions: R8 all terminal/cleaned; do not repoll or restart its handles or overwrite its inventory. No quota/job case was run. Keep protected/private files out of commits; no push/PR edit, paid feature, audit/gate closure.


### 2026-10-11 — Declarative Cron maximum-fixture deployment

- Scope/checklist IDs: Authorized 09.1f/09.V6 continuation; 13.G6 evidence dependency.
- Progress/change summary: Fresh R9 baseline145 records verified; maximum fixture committed before initial declarative-Cron deployment. Production behavior/target unchanged; native result pending.
- Files/artifacts: [Deployment checkpoint](../evidence/09-async-validation.md#r9-declarative-cron-deployment-checkpoint--2026-10-11); ignored R9 backup, actual config, control-plane evidence and live handles.
- Verification: Actual Wrangler4.144.0 types/dry-run/deploy pass; startup5 ms, one schedule and active tail confirmed. Delayed pre-run headroom: D1 reads4,984,041/writes99,294, Worker requests99,001; not billing. Immediate denied-fetch TLS witness failed, then returned401 at21:26:20 UTC and appeared in live tail; no scheduled execution inferred. Docs build, secrets and diff hygiene pass; scoped Markdown formatting unavailable because configured ignore rules exclude those files.
- Decisions/deviations: Exclusively declarative initial Cron tests a distinct documented procedure. No secret deployment, REST schedule mutation or explicit tick. User authorizes continued performance/capacity work; project/provider10 ms unchanged pending native outcome.
- Blockers/open questions: Native title-only CPU and recovery remain unproven; prior productive native14 ms.
- Next actions: Observe native result to bound; after fit preserve maximum revision/projection/body evidence before guarded quota/job recovery; otherwise cleanup and independently compare145 baseline records/resources.
- Next-session cautions: R9 tail85877/monitor76068/watchdog73306 live; observation22:28:10.027/cleanup22:33:10.027 UTC2026-10-10. Never rerun inventory, mutate during cleanup, or extend a running watcher via metadata. Protect untracked/private files; no push/PR edit, paid capability, audit or gate closure.


### 2026-10-11 — Minimum job admission and claim witness batching

- Scope/checklist IDs: Authorized 09.1f/09.V6 performance continuation and D1 job persistence seam; 13.G6 dependency.
- Progress/change summary: Productive Minimum job ticks reduce provider calls8→4 and SQL11→9. Keep shared validation, quota numbers, lease/checkpoint commits, cancellation and retry fences. R9 deployed source remains371aeb9 and native execution is pending.
- Files/artifacts: New D1 minimum job/budget modules, shared internal claim/row builders, composition, meaningful workerd cases and shared test call counter; [batch evidence](../evidence/09-async-validation.md#minimum-job-batching), safe local profile aggregates and internal async runbook. Private recovery harness now requires real native checkpoint commit before clean redeployment; no precommitted fixture witnesses.
- Verification: Final8 focused Minimum workerd checks,6 async unit checks,1 actual local Workflow restart/retry/cancel/output check pass; typecheck, lint/boundaries, build and scoped source format pass. Initial workflow check raced a concurrent build deleting shared output; sequential retry passes. PostgreSQL not rerun: unchanged adapter/application algorithm. Applied20 cold/warm local isolates prove exact witnesses[0,1], terminal checkpoint2, SQL9; sampled medians4,436.5/1,961.5us versus prior5,558/2,859; diagnostic only, no causal native speedup claim.
- Decisions/deviations: Use invocation-local selection/current-row witnesses; a cancellation or replacement lease after either cannot commit stale work. Extract common SQL/decoding unchanged. No target/capacity revision or schema/public contract change. Prepared fault means post-commit response loss plus redeployment, not an actual process kill.
- Blockers/open questions: Native history empty at21:39:13 UTC and live tail has no scheduled frame at21:40:05 UTC; latest productive native14 ms versus unchanged10 ms. Native title-only fit and recovery remain unproven.
- Next actions: Commit verified batch; observe existing R9 handles. Only after native fit preserve maximum evidence, run guarded quota refusal/recovery, then native checkpoint fault/clean redeployment. Otherwise finish cleanup and independently compare145 baseline rows/resources.
- Next-session cautions: R9 tail85877/monitor76068/watchdog73306 live; observation22:28:10.027/cleanup22:33:10.027 UTC2026-10-10. Source divergence is deliberate; record any future phase-4 build/deployment commit. Never rerun inventory, restart on observation timeout, or infer hosted recovery from private preparation. Keep protected/private files untracked; no push/PR edit, paid feature, audit or gate closure.


### 2026-10-11 — Native maximum dispatch and quota recovery verified

- Scope and checklist IDs: Authorized 09.1f/09.V6 performance continuation; search/data/operational dependencies, no audit resume.
- Progress: Maximum title-only native dispatch10 ms, quota refusal2 ms and restored-quota recovery4 ms observed. Native checkpoint interruption/redeployment remains pending.
- Change summary: Publish actual R9 outcomes and independently verified cleanup; prepare a fresh bounded R10 invocation-abort/redeployment case with current16d6500 production job batching. No target revision.
- Files/artifacts: [Native results and procedure](../evidence/09-async-validation.md#declarative-native-dispatch-and-quota-recovery), [final R9 receipt](../evidence/09-hosted-native-declarative-retry-receipt.json), internal async runbook, ADR0014 and paired reader guides; ignored R10 helpers.
- Verification:145 original records/exact singleton sets/FKs preserved, owned resources/work zero, both original Workers/domain mappings preserved, all R9 handles terminal/absent. R10 fresh logical backup restores152 rows/59 tables; private classifier and post-commit fault checks pass, build/types/Wrangler dry-run pass. R10 deployed version8f47a018 has one Cron, CPU/outcome pending. Docs build,497 relative-file links,JSON,secret scan and diff hygiene pass. Formatter excludes docs by existing configuration, so no documentation formatter pass is claimed. No unchanged green application lane repeated.
- Decisions and deviations: Target/provider ceiling10 ms unchanged; maximum sample has no margin. Intentional uncaught native scheduled error after actual checkpoint commit proves invocation interruption if observed, not an OS kill. Full composition/billing/release acceptance remains separate.
- Blockers/open questions:09.1f/09.V6 await native job interruption/clean redeployment and preserved pending-event recovery.
- Next actions: Observe the existing R10 handles; after actual checkpoint1/exception verify exact witness, clean redeploy/resume and dispatch; finish independent cleanup and requirement audit.
- Next-session cautions: Respect R10 original deadlines in private live-handles; never rerun seeded inventory. No push/PR edit, protected/private staging, paid feature, audit/gate closure; G1/G2 closed,13.G6 open.


### 2026-10-11 — Composed scheduled-handler acceptance preparation

- Scope and checklist IDs:09.1f/09.V6 completion audit and authorized R10 verification;13.G6 dependency.
- Progress: Close a proof-scope gap in the prepared native clean variants: use the actual Minimum entry's scheduled handler, including ordinary config checks. Initial deployed fault remains unchanged and native execution is pending.
- Change summary: Add requirement-by-requirement audit; prepare actual composed resume/dispatch and stronger original-resource/schedule comparison.
- Files/artifacts: [Requirement audit](../evidence/09-completion-audit.md), [prepared composition evidence](../evidence/09-async-validation.md#composed-handler-evidence-preparation); ignored helpers/logs.
- Verification: Composed local workerd starts, denies fetch401, commits exactly[0,1] and checkpoint2. Final D1 leases/consumers/maintenance batch7 passes/184 deselected. Context7 exception serialization coverage unavailable; native classifier stays strict. Existing observer handle25215 is still live at02:52 UTC.
- Decisions and deviations: Selective-function timing alone cannot prove complete scheduled CPU; keep09.1f/09.V6 incomplete. No OS-kill claim, security/config/budget weakening or unchanged PostgreSQL rerun.
- Blockers/open questions: Native intentional fault, composed restart/dispatch and cleanup await actual outcomes.
- Next actions: Same bounded R10 observer; after exact checkpoint1/exception, actual clean redeployment and remaining witnesses/CPU.
- Next-session cautions: Tail63124/observer25215/watchdog58691, deadlines03:44:40.222/03:49:40.222 UTC. No inventory rerun, alternate trial while live, protected/private staging, push/PR edit, audit or gate closure.


### 2026-10-11 — Composed maximum fixture and verified native wait

- Scope and checklist IDs:09.1f/09.V6;13.G6 evidence dependency.
- Progress: Actual local composed maximum dispatch passes; native R10 still unobserved.
- Change summary: Finish prepared composed-handler evidence and self-validating private receipt checks; preserve live trial and original bounds.
- Files/artifacts: [Maximum/wait evidence](../evidence/09-async-validation.md#r10-composed-maximum-fixture-and-verified-native-wait), ignored native helpers/logs; no application edit.
- Verification: Local composed workerd max200/32768 canonical fixture acknowledged/indexed with empty derived body,10 statements/combined calls and52/24 rows. Composed two-step witnesses[0,1]/checkpoint2 also pass. Live401 at03:05; registered handlers/one Cron and matching fault job ID verified; provider history empty03:16, D1 still checkpoint0/no witnesses/pending source. Observer25215/watchdog58691 confirmed live.
- Decisions and deviations: Unobserved scheduling is not performance failure; no target/capacity change, inferred native execution or restarted live process.
- Blockers/open questions: Native job interruption/composed redeployment/CPU and cleanup remain pending; requirement audit remains incomplete.
- Next actions: Same bounded observer; after native witnessed checkpoint1 perform actual clean redeployment; otherwise collect original watchdog cleanup and compare152 baseline records/original resources.
- Next-session cautions: Tail63124/observer25215/watchdog58691; original03:44:40.222/03:49:40.222 UTC deadlines. Never rerun inventory after seeding or deploy another trial while these resources remain. No protected/private staging, push/PR edit, paid feature, audit/gate closure.


### 2026-10-11 — R10 stopped and cleaned; user resumes performance work

- Scope and checklist IDs: Authorized09.1f/09.V6 continuation; affected data/search/operational evidence dependencies.
- Progress: R10 ended when the goal service reported paused; latest human instruction explicitly continues optimization. No native scheduled frame or CPU result exists for R10.
- Change summary: Publish unaccepted trial and finish process housekeeping; replace active-wait status with verified cleanup. Target remains10 ms and title-only capacity reduction remains in force.
- Files/artifacts: [Stopped trial receipt](../evidence/09-hosted-native-job-trial-receipt.json), requirement audit and current evidence/progress; private terminal receipts.
- Verification:152 original records/exact singleton sets/FKs and original two Workers/domains/schedules/Queues/Workflows preserved; owned resources/work zero. Tail exit0; exact observer/guardian commands revalidated then SIGTERM, both handles exit143, PIDs absent. No native success inferred.
- Decisions and deviations: Explicit human continuation supersedes earlier pause for task work; goal service still shows paused and cannot be resumed through update_goal. Do not recreate the goal or mark it complete. No target increase or further reduction justified by unobserved execution.
- Blockers/open questions:09.1f/09.V6 still require native interruption/redeployment and full composed scheduled CPU evidence.
- Next actions: Use a fresh backup/inventory and new owned trial; profile a measured hotspot before another refactor.
- Next-session cautions: R10 is closed; never restart its observers/guardian or reuse its captured baseline for new mutations. Keep09.3e suspended,G1/G2 closed,13.G6 open; no protected/private staging,push/PR edit,paid feature or production action.


### 2026-10-11 — Composed CPU profile and fresh R11 native trial

- Scope and checklist IDs:09.1f/09.V6 performance continuation; data/search/operational evidence dependencies.
- Progress: Full local Minimum scheduled entry passes sixteen maximum200/32768 dispatches; cold sampled non-idle median6150.5us,warm2305.5us. These are diagnostics, not hosted acceptance. Fresh R11 is deployed with one declarative Cron.
- Change summary: Profile actual scheduled composition and replace selective fault instrumentation with the actual Minimum entry for all native stages. Guarded supervisor requires witnessed checkpoint1/exact[0] and pending source before clean redeployment; checkpoint2/exact[0,1] before max dispatch. No application edit or further capacity/target revision.
- Files/artifacts: [Local composed profile](../evidence/09-composed-local-profile.json), [R11 procedure](../evidence/09-async-validation.md#r11-composed-native-trial); ignored private backup/harness/artifacts.
- Verification: Fresh logical backup locally restores157 records/59 tables/FKs. Preflight Free user-attested adaptive headroom4997481 reads,99941 writes,99906 requests at03:38:56 UTC; not billing. Local composed fault commits only step0, raises intentional invocation exception and pauses for redeployment. Build/Wrangler dry-run pass; actual fault deploymenta814c618 at03:40 with one Cron. Native execution/CPU pending.
- Decisions and deviations: D1 call/result handling and title tokenization remain sampled costs; no evidence supports shortening canonical bodies further. Full startup is outside local invocation sampling. Refreshed expired OAuth with Wrangler; read-only backup retry after transient socket error succeeded before mutation. Context7 confirms Cron propagation/omitted-trigger preservation; returned CPU docs distinguish startup/paid limits but lack full tail accounting detail.
- Blockers/open questions: Native interruption/full composition CPU and clean resume remain unobserved;09.1f/09.V6 open.
- Next actions: Observe existing guarded stages; on any failed bound or original deadline remove owned resources/work and independently verify157 baseline records/singletons/original resources.
- Next-session cautions: R11 tail51403(PID71010),supervisor14232(PID71014),guardian9520(PID70920); native04:14:25.423 UTC,cleanup04:19:25.423 UTC. No inventory rerun,new simultaneous trial,protected/private staging,push/PR edit,paid override,audit/gate closure.


### 2026-10-11 — Composed job profiling and rejected tokenizer preparation

- Scope and checklist IDs:09.1f/09.V6 authorized performance investigation; search/data/operational evidence dependencies.
- Progress: Eight full composed local job isolates finish exact[0,1]/checkpoint2;9 statements/combined calls per tick,16 reads/9 writes. Sampled cold non-idle median3506.5us,warm2035us, diagnostic only.
- Change summary: Evaluate private startup tokenizer preparation; reject for production because a small cold median change is within broad overlap, max worsens and warm median rises. No application source,capacity,target or native trial version changes.
- Files/artifacts: [Composed local job profile](../evidence/09-composed-local-job-profile.json), [rejected tokenizer prototype](../evidence/09-tokenizer-startup-prototype.json), ongoing R11 evidence; private profiles.
- Verification: Sixteen composed scheduled job calls and sixteen prototype max200/32768 dispatches pass their witness/index/source checks. Prototype cold median5830.5us(range3475–9565),warm2652.5us versus baseline6150.5/2305.5; no causal/native speedup claim. R11 private fetch401 and live-tail request witnesses confirm working observation; no native scheduled frame yet at03:46.
- Decisions and deviations: Keep measured production16d6500 source stable while autonomous native supervisor builds its prepared clean variants. Module startup119ms is separately reported by actual deployment; local invocation sampling excludes it.
- Blockers/open questions: Native composed CPU/interruption/redeployment remains pending;09.1f/09.V6 incomplete.
- Next actions: Collect existing guarded native stages/deadline cleanup; validate final documentation and receipt against actual outcomes.
- Next-session cautions: R11 original handles/deadlines remain; do not deploy a rejected prototype, edit application source during supervisor-controlled builds,repeat green lanes or infer acceptance from local samples. No push/PR edit,audit or gate closure.


### 2026-10-11 — R11 native observation deadline and recovered cleanup

- Scope and checklist IDs:09.1f/09.V6 performance continuation and data/search/operational evidence dependencies.
- Progress: No native scheduled frame; provider history empty at04:47:45 UTC. Current main job pending/checkpoint0/no witnesses, cancelled sibling unchanged and maximum canonical source pending/unindexed. No CPU failure inferred.
- Change summary: Guardian reached04:19 deadline but failed authentication before cleanup. Refreshed credentials, inspected actual current resources/data before mutations, then independently completed cleanup; all handles terminal/PIDs absent.
- Files/artifacts: [Unaccepted composed Cron receipt](../evidence/09-hosted-composed-cron-trial-receipt.json), current evidence/audit/progress; private cleanup and terminal receipts.
- Verification:157 original records/exact singleton sets/FKs restored; original two Workers/domain mappings/schedules/Queues/Workflows preserved. Owned resources/outbox/deliveries/jobs/steps/search zero; one timeline/one audit entry and inactive fixtures retained. Tail exit1,supervisor0,guardian1 are actual terminal outcomes; failed guardian history preserved.
- Decisions and deviations: R11 closed; goal service nowactive. Preserve10ms and title-only capacity. New short hosted authenticated HTTP fixture may measure actual scheduled function and D1 interruption/redeployment with honest invocation labeling; it cannot replace native Cron evidence.
- Blockers/open questions: Native Cron missing across bounded trials;09.1f/09.V6 remain incomplete. Native scheduling requires external execution; no accepted full-profile/billing/paid performance claim.
- Next actions: Fresh backup/inventory before new mutation; collect whole composed hosted function CPU and actual D1 job recovery, then revisit measured hotspots/native scheduling proof.
- Next-session cautions: Never restart R11 processes or reuse its157-record baseline for new mutation. Do not publish success-only receipt or deploy rejected tokenizer candidate. Keep09.3e suspended,G1/G2 closed,13.G6 open; no protected/private staging,push/PR edit,paid feature or production action.


### 2026-10-11 — R12 short authenticated hosted function diagnostic

- Scope and checklist IDs:09.1f/09.V6 authorized performance/recovery investigation; data/search/operational dependencies.
- Progress: Prepare new authenticated HTTP fixture calling the actual Minimum scheduled method; no Cron and no native-Cron claim.
- Change summary: Fresh backup/inventory, bounded fault/resume/dispatch artifacts, private token binding over Wrangler standard input and independent15-minute guard. Request guard denies unauthorized/non-POST/non-proof-path calls before D1 work; no request body controls SQL,phase or references. Fixed phases4/0 and zero original jobs/outbox protect baseline work.
- Files/artifacts: Ignored module09-hosted-r12 helpers/backup/deploy logs, [current evidence](../evidence/09-async-validation.md#r12-authenticated-hosted-function-diagnostic).
- Verification:162 original records/59 tables locally restored with valid FKs; actual fault version5729f20d after secret installation,zero Cron. Preflight adaptive headroom4995864 reads,99882 writes,99867 requests at04:52:46 UTC; Free user-attested,not billing. First read-only HTTPS ping has transient certificate-handshake failure; no authenticated invocation or CPU result yet.
- Decisions and deviations: HTTP native Worker CPU/redeployment proof can guide optimization, but cannot substitute for missing native Cron.10ms unchanged; no product source,capacity or policy edit. Context7 confirms secret put stdin/new deployed version; secret value never printed/committed.
- Blockers/open questions: Hosted protected-fetch readiness/function CPU/recovery and cleanup pending; original native obligations remain open.
- Next actions: Bounded read-only readiness checks,then unauthorized denial and authenticated fault/current-state proof,clean redeploy/resume and max dispatch; independently clean162 baseline records/resources.
- Next-session cautions: R12 tail2630(PID77062),guardian97277(PID77006); cleanup05:08:37.445 UTC2026-10-11. Respect original deadline,no inventory rerun,new simultaneous trial,secret/private/protected staging,push/PR edit,paid override,audit or gate closure.


### 2026-10-11 — Hosted composed recovery passes; maximum dispatch14ms

- Scope and checklist IDs:09.1f/09.V6 performance continuation; affected data/search/operational dependencies.
- Progress: Actual hosted composed fault9ms, clean redeployment/resume7ms, exact[0,1]/checkpoint2 and pending-event survival verified. Maximum dispatch acknowledges/indexes unchanged200/32768 canonical content at14ms, failing10ms. These are authenticated HTTP invocations, not native Cron.
- Change summary: Record all three real deployments and authoritative outcomes; guardian stops on14ms and independently cleans. No target/capacity or product source change.
- Files/artifacts: [Hosted composed HTTP receipt](../evidence/09-hosted-composed-http-recovery-receipt.json), evidence/audit/progress; ignored private source/deploy/cleanup logs.
- Verification: Fault version5729f20d, resume4768d153, dispatchaa440963; unauthorized proofPOST401. Actual checkpoint1/[0] and checkpoint2/[0,1] both preserve source; cancelled sibling/oversized refusal hold. Canonical/indexrevision1,derived body0,title371bytes,done/attempt1.162 original records/exact singletons/FKs and original two Workers/domains/schedules/Queues/Workflows preserved; owned work/resources zero; tail2630/guardian97277 exit0,PIDs absent,private token removed. Docs/JSON/links/secrets/diff checks pending final update; no unchanged application lane repeated.
- Decisions and deviations: Keep10ms and title-only. Full composed dispatch14ms warrants another measured refactor; internal target revision cannot establish physical Free/release acceptance. Fault metadata omits post-commit lost-result counters; CPU includes whole test invocation and extra preflight. No native-Cron or OS-process-kill claim.
- Blockers/open questions:09.1f/09.V6 remain incomplete: full composed dispatch CPU and native Cron observation.
- Next actions: Reduce provider-result overhead around the single index upsert while preserving SQL,current-state/abort/meter checks; focused D1 verification and fresh bounded hosted comparison.
- Next-session cautions: R12 closed; no live resources/processes. New mutations need fresh backup/inventory. Do not reuse deleted proof token,alter post-I/O source acknowledgement,stage private/protected files,push/PR edit,resume audit or close gates.


### 2026-10-11 — Single index write performance experiment

- Scope and checklist IDs: Authorized09.1f/09.V6 optimization and Module08 D1 index seam; data/operational evidence dependencies.
- Progress: One fenced index upsert uses metered all/RETURNING; multi-document pages retain batch transactions. This is an uncommitted candidate,not a demonstrated improvement.
- Change summary: Keep identical SQL,fences,quota numbers,three provider calls/ten statements and post-I/O processor acknowledgement. Avoid only the one-statement batch/result wrapper.
- Files/artifacts: packages/database/d1/src/search-index.ts, [local diagnostic](../evidence/09-single-index-write-local-profile.json), private comparison helpers.
- Verification: Typecheck,lint/boundaries,scoped source format pass. Focused D1 search/consumer selection16 passes/179 intentionally deselected; separately previously unselected current projection/visibility/day-admission fence1 pass/3 deselected.8 local composed max isolates/16 dispatches pass, but cold/warm sampled medians7248/2680us versus6150.5/2305.5 worsen with overlapping ranges. No native improvement inferred. PostgreSQL unchanged,not rerun.
- Decisions and deviations: D1 all returns RETURNING rows/valid metadata in actual local runtime; Context7 confirms ordinary result/transaction shapes but not CPU savings. Local result cautions against accepting this candidate without a hosted comparison; revert if it does not help.
- Blockers/open questions: Whether native result handling changes whole composed CPU;10ms/native Cron obligations remain open.
- Next actions: Fresh bounded authenticated hosted dispatch comparison after new167-record backup/inventory;collect actual CPU and cleanup,then retain/reject candidate based on evidence.
- Next-session cautions: Do not claim performance improvement or commit candidate as accepted yet. Keep all application source stable once comparison is deployed,no early acknowledgement/limit weakening,private/protected staging,push/PR edit,audit/gate closure.
