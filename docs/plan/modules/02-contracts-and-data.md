# 02 — Public contracts, domain model, and database foundations

Phase: MVP backend  
Prerequisites: 01 complete by default; independent persistence work proceeded under [ADR 0001](../../decisions/0001-runtime-foundation.md) while its acceptance was still open.
Progress: [Session log and current status](../progress/02-contracts-and-data.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Define stable public semantics and implement both persistence foundations before feature endpoints. Design plugin/event and future relation seams now without implementing deferred features.

## Ordered checklist

### Step 02.1 — Specify the domain and protocol

- [x] **02.1a** Write English `docs/DATA-MODEL.md`: internal ID strategy, project-local Issue numbers, UTC timestamp representation/precision, enums, nullability, actor identity, revisions, and deletion/retention semantics.
- [x] **02.1b** Model principals, identities, projects, roles, issues, comments/history, reactions, labels, assignees, types, milestones, forms/templates, timeline events, audit, upload intents, plugin metadata, and outbox/idempotency records.
- [x] **02.1c** Reserve documented extension points for relations, subscriptions, saved views, jobs, and plugin-owned metadata; defer unused physical tables until their owning module needs them.
- [x] **02.1d** Write `docs/API-CONVENTIONS.md` for `/api/v1`, framework-independent schemas, OpenAPI ownership, DTO compatibility, dates/IDs, safe errors, request IDs, concurrency conflicts, idempotency, and deprecation.
- [x] **02.1e** Specify opaque versioned cursors, stable sort tie-breakers, filter binding, invalid/stale cursor behavior, default page sizes of 30–50 and a maximum of 100 unless a stricter endpoint limit is justified.
- [x] **02.1f** Publish a resource/operation inventory and permission matrix; allocate each endpoint family to a later module. Decide read visibility, moderation redaction, and cross-project reference rules before exposing data.

### Step 02.2 — Implement persistence contracts and migrations

- [x] **02.2a** Create repository contracts and explicit transaction intents; keep SQL, Drizzle schemas, D1 bindings, and PostgreSQL pools outside the domain/application interfaces.
- [x] **02.2b** Implement independent D1/SQLite and PostgreSQL schemas and migration histories using Drizzle/Drizzle Kit with reviewed generated SQL.
- [x] **02.2c** Specify and enforce unique project/Issue-number allocation, foreign keys, principal references, relation uniqueness, and all domain invariants in each dialect where possible.
- [x] **02.2d** Prove atomic mutation + timeline/security audit where required + outbox recording, including rollback. Use D1-supported batches/conditional statements rather than assuming callback transactions exist.
- [x] **02.2e** Define optimistic concurrency and retry semantics, idempotency key scope/expiry/payload matching, and replay-safe result storage.
- [x] **02.2f** Pair common list/filter/sort patterns with indexes; design dialect-specific FTS mappings and bounded relation-loading queries.
- [x] **02.2g** Specify read-after-write behavior; keep D1 read replication disabled until session consistency and authorization/revocation freshness are proven.

### Step 02.3 — Establish reusable compatibility tests

- [x] **02.3a** Build a shared repository contract suite with real D1/workerd and PostgreSQL adapters, deterministic clocks/IDs where appropriate, and representative multi-project fixtures.
- [x] **02.3b** Add empty-database and previous-schema upgrade tests; review schema semantics rather than matching SQL text.
- [x] **02.3c** Test concurrent number allocation, rollback, duplicate mutation retries, stale writes, cursor boundaries, and same-timestamp ordering.
- [x] **02.3d** Define repeatable larger fixtures and capture query counts/plans for list and detail access. Document restore/forward-fix options for non-reversible migrations.

## Acceptance evidence

[Both-profile validation report and query plans](../evidence/02-data-foundation-validation.md). Feature endpoints and later backend/SPA gates are unchanged.

Both adapters pass the same domain-level contract suite. DATA-MODEL and API-CONVENTIONS explain consistency and failure semantics well enough for subsequent modules to implement independently of database syntax.

## Source coverage

PRODUCT §§3–23; TECH-STACK §§9–13, 24, 38–40, 48, 54; PERFORMANCE §§6–19, 54–57; SECURITY §§62–80, 114–116.

