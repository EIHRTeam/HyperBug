# 09 — Outbox delivery, queues, durable workflows, and cleanup

Phase: MVP backend  
Prerequisites: 08 complete; handlers from 05, 07, and 08.  
Progress: [Session log and current status](../progress/09-async-and-workflows.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Finish the durable processing infrastructure required by MVP indexing, plugin effects, and attachment cleanup, and prove a workflow foundation for later bulk/import/export features.

The optional Cloudflare Free minimum tier adds a reduced-durability dispatch path (09.1f, 09.2e, 09.3g, 09.V6) defined by [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md). The required Queues, Workflows and Graphile Worker adapters of the standard profiles remain mandatory and unchanged.

**Execution override (2026-09-21): [All audit work is suspended — no audit for now](../AUDIT-SUSPENSION.md). Continue the non-audit portions of this module; suspended work remains unchecked.**

## Ordered checklist

### Step 09.1 — Implement reliable event dispatch

- [ ] **09.1a** Implement TaskQueue adapters for Cloudflare Queues and Graphile Worker: enqueue, bounded scheduling, stable event/job/delivery IDs, retry metadata, and explicit payload versions.
- [x] **09.1b** Implement an outbox dispatcher with bounded leasing/claiming, retry, acknowledgement, lease expiry, and reconciliation after crashes.
- [ ] **09.1c** Demonstrate that committed business data cannot permanently lose its event when queue publication fails. Do not claim cross-service atomicity between a database and queue.
- [ ] **09.1d** Validate every message at consumption; store references instead of plaintext credentials or large bodies, and recheck relevant current permissions/configuration before delayed sensitive actions.
- [x] **09.1e** Implement application-level idempotency records and downstream idempotency identities; define the unavoidable duplicate-risk policy for external providers without idempotent APIs.
- [ ] **09.1f** Implement the minimum tier's dispatch path: a D1 outbox claimed by a bounded Cron-driven dispatcher that stays SQL-heavy and JavaScript-light within the free per-invocation CPU, query-count and subrequest budgets, consolidates schedules into the available Cron Trigger count, and reports backlog age without relying on platform message retention.

### Step 09.2 — Bound failure and fan-out

- [x] **09.2a** Define retry counts/backoff, transient/permanent failure classification, poison-message handling, DLQ or equivalent failed-job storage, and authorized replay.
- [ ] **09.2b** Bound consumer concurrency, dispatch batch size, downstream calls, and per-event fan-out; implement backpressure and non-critical circuit breaking.
- [ ] **09.2c** Add queue lag, retry/failure/DLQ growth, processing duration, and outbox age telemetry with safe metadata.
- [ ] **09.2d** Connect plugin events and search-index updates; verify duplicate/out-of-order delivery cannot revert newer state.
- [ ] **09.2e** Implement the minimum tier's failed-job storage in D1 with authorized replay and bounded retention; the provider dead-letter queue's 24-hour free retention must not be the only replay source, and a quota-exhausted dispatch must surface a visible backlog instead of dropping work.

### Step 09.3 — Implement durable workflow and retention foundations

- [x] **09.3a** Define a portable workflow/job model with status, cursor/checkpoint, progress, retries, result references, cancellation, and idempotent bounded steps.
- [ ] **09.3b** Implement Cloudflare Workflows and self-host PostgreSQL state + Graphile Worker adapters. Keep platform workflow objects out of domain contracts.
- [ ] **09.3c** Add a conformance workflow that resumes after a process crash without duplicating committed work; use small serializable checkpoints and object storage for large artifacts.
- [ ] **09.3d** Schedule upload intent/orphan/multipart cleanup, expired session/token cleanup, and configured retention jobs on both profiles.
- [ ] **09.3e** **Audit portion suspended — no audit for now.** Audit controlled retention/deletion and administrative replay; ensure cleanup is bounded, repeatable, permission-aware, and does not delete referenced active attachments.
- [ ] **09.3f** Write `docs/ASYNC-PROCESSING.md` covering delivery semantics, operational recovery, safe replay, and adapter differences.
- [ ] **09.3g** Implement the minimum tier's checkpointed D1 job runner as the substitute for multi-step workflow durability, with capability gating for bulk, import/export and long-running jobs, and a recorded capability ceiling that the public capability document reports.

## Verification and acceptance

- [ ] **09.V1** Inject failures before/after commit, before/after queue send, during processing, and after a side effect before acknowledgement.
- [ ] **09.V2** Test duplicate, stale, malformed, unsupported-version, permanently failing, and slow-provider messages; verify retry budgets and failed-job visibility.
- [ ] **09.V3** Run both workflow adapters through restart/resume/cancel and bounded-output checks.
- [ ] **09.V4** Verify final search consistency, plugin dispatch, quota recovery, and abandoned upload cleanup on both profiles.
- [ ] **09.V5** Demonstrate that ordinary Issue creation succeeds while a non-critical provider is unavailable, without losing eventual work or bypassing security.
- [ ] **09.V6** Verify the minimum tier's async path: crash and restart resume without duplicating committed work or losing queued events, quota exhaustion produces bounded errors and a visible backlog, the Cron budget consolidation holds, and dispatch and job state remain observable within the free logging limits.

## Source coverage

TECH-STACK §§25–30; SECURITY §§139–149; PERFORMANCE §§5, 19, 37–51, 61, 69–72, 77.
See [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md) for the minimum-tier dispatch, failed-job and job-runner requirements in 09.1f, 09.2e, 09.3g and their verification.

