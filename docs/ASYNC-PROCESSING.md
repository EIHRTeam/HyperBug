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

`RETENTION_TEMPORARY_UPLOAD_SECONDS` remains reserved by its existing contract. Pending events are never expired by a terminal retention sweep. Failed deliveries currently retain replay state until the bounded failure-retention policy in B5 is implemented and verified.

## Acceptance boundaries

Local Workflows/Queues emulation and real local PostgreSQL prove only their recorded adapter behaviors. The authorized hosted account runs Workers Free; its Queue/Workflow observations never establish paid Cloudflare Standard performance acceptance. Minimum dispatch, quota reservation, checkpoint gating and Free CPU evidence are separate B5 requirements. G1/G2 and 13.G6 remain open until their owning acceptance work is verified.
