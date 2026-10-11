# Async processing operations

Module 09 owns reference-only event delivery, durable conformance jobs and scheduled maintenance. This internal runbook describes implemented mechanisms; notifications, bulk operations and import/export remain later-module features. [Validation evidence](plan/evidence/09-async-validation.md) distinguishes local, emulated and hosted checks.

## Delivery and identity

Canonical mutations and their existing outbox rows commit in one database transaction. Publication to a queue is a separate operation. A committed source remains pending until processing completes; publication failure, expired leases and lost queue messages are reconciled from that source. There is no cross-service atomicity or exactly-once execution guarantee.

Queue messages contain only version 1 references: source, event ID, delivery ID and job ID. Core identities are `search-update:<event UUID>`; plugin identities are `plugin-event:<event UUID>`. Credentials, canonical bodies, arbitrary destinations and large intermediate state never enter queue messages. Consumers validate every reference and envelope, load current canonical records, check current plugin registration/settings and require fresh host authorization before a sensitive effect. Disabled/uninstalled plugins cancel their deferred effect; a missing host binding retries within the budget.

The independent publication and execution leases fence stale workers. Committed step witnesses and delivery sidecars are application idempotency records. Search updates use immutable mutation revisions; stale and duplicate events cannot revert newer indexed state. External bindings must pass the stable delivery identity downstream. If a provider lacks an idempotent API, a crash after an effect and before acknowledgement can duplicate it: the host must explicitly accept that risk or withhold the binding. Automatic replay does not make such a provider exactly once.

## Bounds and visibility

Dispatch batch is 10, concurrency 2 and per-event fan-out 1. Execution attempts stop at 5; invalid, unsupported and permanent errors fail immediately. Transient backoff is 1/2/4/8/16 seconds, with a 30-second lease and five-minute publication reconciliation. Adapter scheduling is bounded to one hour. Effect/send timeout is one second; underlying operations retain their concurrency slot until they actually settle. Noncritical publication has a circuit breaker. Source writes and canonical authorization do not depend on queue availability.

Telemetry emits safe counts, source/identities, failure codes, duration and oldest pending age. Pending/failed counts saturate at 1001 per category and then represent lower bounds. Oldest age comes from indexed database sources, independently of provider retention. Inspect sidecars with bounded indexed operator queries; never dump payloads or provider error strings into logs. A queue's shorter retention is not the recovery source.

## Recovery and replay

1. Identify the delivery and safe failure code. Confirm current source existence, permissions, registry/settings and provider readiness.
2. Restore the provider or missing authorized host binding. Allow ordinary reconciliation to recover pending deliveries; do not mark a source delivered manually.
3. For a failed delivery use `replayFailedTask` with a trusted operator authorization callback and the validated reference. Denied authorization performs no reset. No new public replay endpoint exists.
4. Monitor oldest age, failed count, retry growth and canonical search consistency after replay. A replay resets the application attempt budget; it does not undo external effects or bypass current configuration.

Raw adapter mutation methods are internal infrastructure. Operators must use the authorization seam rather than directly changing attempts or state. Replay decisions and deletion auditing remain subject to the existing audit policy; the separately suspended 09.3e audit has not been performed.

## Workflow adapters

The portable job model stores status, checkpoint, progress, attempt count, cancellation and an optional result reference in D1/PostgreSQL. The conformance workflow commits one tiny step witness and checkpoint atomically. It generates no large artifact, so its result reference is null; future large artifacts must be written to object storage and only their validated reference committed. Maximum job length is 16 steps and serialized checkpoints are at most 1024 bytes.

Cloudflare Standard uses named Workflows steps with four retries after the initial attempt and a one-second step timeout. A named step whose database commit succeeded before its platform result was persisted returns the committed checkpoint on retry. Resume queries the instance: paused instances resume; errored/terminated instances restart; active instances continue. If lookup fails, creation with the same stable ID is safe to retry and any creation error propagates. Status/restart errors never trigger creation. Database cancellation fences further commits even if platform termination is delayed.

Node uses PostgreSQL state and the exact pinned Graphile Worker dependency. A task advances one checkpoint then enqueues the next checkpoint identity. If the process stops between these operations, the existing interval finds a recoverable job. Graphile keys use `replace`, so an exhausted retained provider key cannot permanently prevent reconciliation. Application state remains the authority for duplicates, lease ownership, cancellation and retry exhaustion.

## Scheduled maintenance

The existing five-minute Cloudflare Cron and Node cleanup interval also own async maintenance. No second scheduler is added. Existing expired-session/token cleanup remains bounded. Terminal delivery cleanup processes at most 10 records; upload maintenance claims one project, one temporary candidate and one orphan candidate. A persisted 90-second maintenance lease and bounded keyset cursors recover after a crash and rotate through projects after both pages finish.

Existing upload services decide eligibility, reconcile abandoned multipart sessions, confirm physical object absence and release reserved/used quota exactly once. Active referenced attachments remain ineligible. A failed provider operation retains quota/tombstones for a later sweep. The scheduler never replaces these permission and accounting guards. Recovery selects at most one pending/running job per tick.

Scheduler-owned configuration is separate from historical account/audit policies:

| Setting | Default | Accepted seconds |
| --- | --- | --- |
| `ASYNC_ORPHAN_RETENTION_SECONDS` | 86400 after intent expiry | 3600–31536000 |
| `ASYNC_TERMINAL_RETENTION_SECONDS` | 2592000 | 86400–31536000 |

`RETENTION_TEMPORARY_UPLOAD_SECONDS` remains reserved by its existing contract. Pending events are never expired by a terminal retention sweep. Failed deliveries retain replay metadata for the configured terminal window (30 days by default). Expiry atomically retires the pending source and deletes safe failure metadata; it never marks pending retries delivered. Expired failures cannot be replayed or recreated by reconciliation. Terminal conformance jobs and their step witnesses also have bounded retention. Never reuse job UUIDs after retirement.

## Acceptance boundaries

The Minimum foundation has verified D1 failed-job/replay/retention and checkpoint/capability mechanisms. After repeated native CPU failures, the authorized title-only reduction processed a maximum 200-code-point title / 32,768-code-point canonical body at **10 ms CPU**, with no measured margin. Native quota refusal used 2 ms and preserved a visible pending backlog; restored quota recovered the event at 4 ms. All 145 original records, exact singleton state and original resources survive verified cleanup. Native checkpoint interruption/redeployment remains required for 09.V6; 09.1f/09.V6 remain open. See the [native result](plan/evidence/09-async-validation.md#declarative-native-dispatch-and-quota-recovery) and [safe receipt](plan/evidence/09-hosted-native-declarative-retry-receipt.json).

Local Workflows/Queues emulation and real local PostgreSQL prove only their recorded adapter behaviors. The authorized hosted account runs Workers Free; its Queue/Workflow observations never establish paid Cloudflare Standard performance acceptance. Minimum uses D1/Cron directly. Each five-minute tick selects one phase by scheduled timestamp modulo five: dispatch, session/token expiry, upload cleanup, terminal retention, or a checkpoint. This yields one dispatch/job phase per 25 minutes, a batch of one, four steps per conformance job and no bulk/import/export/long-running feature. `startMinimumJob` rejects unsupported kinds and excessive steps before storage; consumption cancels oversized jobs inserted through a raw internal store. The public instance document reports these ceilings and unavailable feature flags.

Each invocation reserves 5,000 reads and 100 writes in a singleton UTC-day ledger, capped at 1,500,000 reads and 30,000 writes/day for async work (300 ticks, below provider ceilings and separate from search's allocation). Reservations are not refunded after crashes. Account-global billing/headroom also includes other modules and services and must be measured independently. Quota denial leaves sources/checkpoints unchanged and emits safe backlog/age/outcome. Daily rollover restores admission.

The Minimum adapter counts every SQL statement and provider call before I/O, stops work at 40 combined subrequests/queries and retains five slots for diagnostics, with a hard total of 45. D1 batch members count individually. Native R2 CRUD and multipart signed fetch share that counter; incomplete discovery or exhausted capacity retains quota for another sweep. D1 result metadata measures row use; it is not Worker CPU. Minimum combines token-fenced quota admission, source import and execution claiming in one atomic SQL batch. A fresh internal admission identity is independent of caller lease tokens; refusal cannot advance cursors or claim work. The immutable timeline revision hydrates only an exact validated source lookup, and fenced acknowledgement shares a batch with bounded backlog reporting; its local consumer facade still validates the reference, envelope and current permissions/configuration, then fences completion in the database. Source import uses bounded keyset cursors and ready sidecars so a failed prefix cannot force an unbounded source scan. One safe summary per tick fits bounded logging volume, independently of the provider's three-day log retention. Actual Free CPU and hosted adapter behavior are recorded in the linked B5 evidence; the latest title-only maximum native dispatch meets 10 ms without margin, while native job recovery remains unverified. G1/G2 and 13.G6 remain open until their owning acceptance work is verified.

The Minimum job phase similarly batches quota admission with bounded selection, then batches lease claiming with its current-row witness. Invocation-local reads consume those witnesses once; the shared application step and database commit still validate the reference and fence the lease/checkpoint. Cancellation or a replacement lease after a witness prevents commitment. A productive job tick now uses four provider calls and nine SQL statements including backlog reporting, without changing its four-step capacity or numeric budgets. Local sparse profiles are diagnostic; native CPU and recovery acceptance remain required.


The later full-composition hosted HTTP fixture verifies actual D1 invocation interruption at9ms and clean redeployment/resume at7ms,exact[0,1] witnesses and event survival. Its original maximum dispatch14ms failed10ms. A single fenced index write now uses metered prepared-statement all/RETURNING instead of a one-element batch;multi-document pages retain transactional batching. A fresh full-composition hosted max dispatch takes9ms with unchanged canonical content and quotas. These are separate one-sample HTTP observations,not a native Cron or sustained performance proof;local timings were noisy and worsened. [Recovery receipt](plan/evidence/09-hosted-composed-http-recovery-receipt.json) and [single-write receipt](plan/evidence/09-hosted-single-write-dispatch-receipt.json) include independent cleanup. Keep target10ms and09.1f/09.V6 open for native scheduled acceptance;13.G6 remains separate.
