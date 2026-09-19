# 15 — Post-MVP subscriptions, notifications, bulk actions, and data jobs

Phase: Post-MVP core  
Prerequisites: 14 complete; queue/workflow foundation from 09. Backend acceptance precedes this module's UI.  
Progress: [Session log and current status](../progress/15-notifications-and-bulk-jobs.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Add user-visible asynchronous features using the existing reliable processing foundations.

## Ordered checklist

### Step 15.1 — Define notification and job contracts

- [ ] **15.1a** Specify subscriptions/unsubscribe, mentions, notification preferences/read state, recipient rules, deduplication, and per-event/project/user fan-out bounds.
- [ ] **15.1b** Specify bulk operation selection snapshots, per-item authorization, progress, cancellation, retry, partial failure, and idempotency.
- [ ] **15.1c** Specify portable import/export job contracts and a bounded canonical format/conformance fixture; external service-specific formats belong to plugins.
- [ ] **15.1d** Define retained data, export encryption/TTL, temporary download authorization, job ownership, and sensitive export assurance/audit requirements.
- [ ] **15.1e** Add paired migrations, repository contracts, versioned event payloads, OpenAPI, and client methods.

### Step 15.2 — Implement and accept backend behavior

- [ ] **15.2a** Implement subscription/preference APIs and in-app notification storage/reads, with server-side recipient authorization and safe rendering.
- [ ] **15.2b** Implement bounded queued fan-out, dedupe, backpressure, retry/DLQ, and channel-provider hooks; Core must remain usable with no email channel.
- [ ] **15.2c** Implement selected bulk triage operations as checkpointed workflows on both adapters; define whether permission changes cancel, skip, or fail remaining work.
- [ ] **15.2d** Implement authorized export using cursor-based reads and streaming object output; exclude credentials and protect sensitive output with encryption and expiry.
- [ ] **15.2e** Implement bounded import validation/staging/checkpointing, mapping/conflict decisions, and retry-safe writes; reject path traversal, compression bombs, excessive nesting/records, and malformed input.
- [ ] **15.2f** Verify both profiles under duplicate delivery, permission revocation mid-job, provider outage, crash/resume, cancellation, partial errors, and expired result cleanup.
- [ ] **15.2g** Record backend acceptance and measured fan-out/job budgets before starting Step 15.3.

### Step 15.3 — Implement and accept the frontend

- [ ] **15.3a** Refresh modern-web/library guidance; build subscribe/unsubscribe, notification inbox/preferences, bounded bulk selection, job progress/cancel, and import/export interactions.
- [ ] **15.3b** Announce progress and completion accessibly without excessive live-region chatter; provide recoverable partial-failure details.
- [ ] **15.3c** Test end-to-end against both profiles, including no-email mode, revoked permission, duplicate retry, large selections, and export expiry.
- [ ] **15.3d** Update operations/security/performance docs and execute the increment release/recovery checks from module 13.

## Acceptance evidence

Notifications are permission-safe and bounded; durable jobs resume without corrupting or duplicating business data. Import/export does not expose raw database dumps as a public product contract.

## Source coverage

PRODUCT §§23–24, 28, 30; SECURITY §§139–149; PERFORMANCE §§39–46, 61–72.

