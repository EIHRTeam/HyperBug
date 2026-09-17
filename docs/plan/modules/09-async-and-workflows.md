# 09 — Outbox delivery, queues, durable workflows, and cleanup

Phase: MVP backend  
Prerequisites: 08 complete; handlers from 05, 07, and 08.  
Progress: [Session log and current status](../progress/09-async-and-workflows.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Finish the durable processing infrastructure required by MVP indexing, plugin effects, and attachment cleanup, and prove a workflow foundation for later bulk/import/export features.

## Ordered checklist

### Step 09.1 — Implement reliable event dispatch

- [ ] **09.1a** Implement TaskQueue adapters for Cloudflare Queues and Graphile Worker: enqueue, bounded scheduling, stable event/job/delivery IDs, retry metadata, and explicit payload versions.
- [ ] **09.1b** Implement an outbox dispatcher with bounded leasing/claiming, retry, acknowledgement, lease expiry, and reconciliation after crashes.
- [ ] **09.1c** Demonstrate that committed business data cannot permanently lose its event when queue publication fails. Do not claim cross-service atomicity between a database and queue.
- [ ] **09.1d** Validate every message at consumption; store references instead of plaintext credentials or large bodies, and recheck relevant current permissions/configuration before delayed sensitive actions.
- [ ] **09.1e** Implement application-level idempotency records and downstream idempotency identities; define the unavoidable duplicate-risk policy for external providers without idempotent APIs.

### Step 09.2 — Bound failure and fan-out

- [ ] **09.2a** Define retry counts/backoff, transient/permanent failure classification, poison-message handling, DLQ or equivalent failed-job storage, and authorized replay.
- [ ] **09.2b** Bound consumer concurrency, dispatch batch size, downstream calls, and per-event fan-out; implement backpressure and non-critical circuit breaking.
- [ ] **09.2c** Add queue lag, retry/failure/DLQ growth, processing duration, and outbox age telemetry with safe metadata.
- [ ] **09.2d** Connect plugin events and search-index updates; verify duplicate/out-of-order delivery cannot revert newer state.

### Step 09.3 — Implement durable workflow and retention foundations

- [ ] **09.3a** Define a portable workflow/job model with status, cursor/checkpoint, progress, retries, result references, cancellation, and idempotent bounded steps.
- [ ] **09.3b** Implement Cloudflare Workflows and self-host PostgreSQL state + Graphile Worker adapters. Keep platform workflow objects out of domain contracts.
- [ ] **09.3c** Add a conformance workflow that resumes after a process crash without duplicating committed work; use small serializable checkpoints and object storage for large artifacts.
- [ ] **09.3d** Schedule upload intent/orphan/multipart cleanup, expired session/token cleanup, and configured retention jobs on both profiles.
- [ ] **09.3e** Audit controlled retention/deletion and administrative replay; ensure cleanup is bounded, repeatable, permission-aware, and does not delete referenced active attachments.
- [ ] **09.3f** Write `docs/ASYNC-PROCESSING.md` covering delivery semantics, operational recovery, safe replay, and adapter differences.

## Verification and acceptance

- [ ] **09.V1** Inject failures before/after commit, before/after queue send, during processing, and after a side effect before acknowledgement.
- [ ] **09.V2** Test duplicate, stale, malformed, unsupported-version, permanently failing, and slow-provider messages; verify retry budgets and failed-job visibility.
- [ ] **09.V3** Run both workflow adapters through restart/resume/cancel and bounded-output checks.
- [ ] **09.V4** Verify final search consistency, plugin dispatch, quota recovery, and abandoned upload cleanup on both profiles.
- [ ] **09.V5** Demonstrate that ordinary Issue creation succeeds while a non-critical provider is unavailable, without losing eventual work or bypassing security.

## Source coverage

TECH-STACK §§25–30; SECURITY §§139–149; PERFORMANCE §§5, 19, 37–51, 61, 69–72, 77.

