# ADR 0002: Atomic persistence and cursor semantics

Status: Accepted implementation direction; acceptance requires both adapter suites.
Date: 2026-09-18.

Use UUID v4 identities, independent project-local Issue numbers, UTC millisecond instants, integer revisions, and bounded keyset pagination. Share repository intents and domain outcomes; keep separate Drizzle schemas/migrations and SQL implementations for D1 and PostgreSQL 18.

Create/edit Issue is the representative aggregate used to prove persistence primitives before feature endpoints. The application supplies an authorized actor/project context, validated input, deterministic mutation/event identities and idempotency digests. A repository is not an authorization service. Phase 02 exposes no product write endpoint.

D1 performs an atomic prepared-statement batch. A stale conditional update is followed by a required timeline value selected by the unique current mutation ID; missing matches cause a NOT NULL constraint failure and roll back the batch. PostgreSQL explicitly checks affected rows in a transaction. Both include timeline, required audit, outbox and the replay-safe mutation receipt in the same commit. Retrying a unique idempotency scope consults its stored payload/result only after rollback. Constraint failures must never be broadly swallowed as success.

Number allocation is serialized by a project counter update in the transaction/batch; unique project/number remains a second integrity boundary. Immutable created-at plus ID ordering makes cursor boundaries stable even at equal timestamps. Cursors are bounded, versioned and filter/project-bound; they do not confer authorization or promise snapshot isolation. D1 replication remains off and reads target the writer.

Logical schemas cover all required MVP records in DATA-MODEL. Physical migration 0000 starts the representative aggregate proof; migrations 0001–0004 complete the 25-table MVP mappings, reviewed integrity and immutable-history rules. Owning feature modules add services, application validators and permission enforcement against these schemas. The initial seven-table batch was not the phase completion boundary. Deferred relations, jobs and subscriptions receive no speculative physical tables.

Review criteria: no unbounded loops/queries; no per-row hydration; parameterized values; no partial commit on zero-row writes; strict project ownership; no credential/body leakage in outbox/audit/result snapshots; tested empty/upgrade schemas, concurrent numbering, duplicate retries, revision conflicts, rollback, and equal-timestamp pages on both databases. Large fixtures must show matching indexes and fixed query counts. Non-reversible production migrations require forward fixes or coordinated restore, never an assumed application rollback.
