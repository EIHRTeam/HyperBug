# Module 02 data foundation validation

Date: 2026-09-18. Required independent-work exception: [ADR 0001](../../decisions/0001-runtime-foundation.md). Normative decisions: [DATA-MODEL](../../DATA-MODEL.md), [API-CONVENTIONS](../../API-CONVENTIONS.md), [operation permissions](../../API-OPERATIONS.md), [ADR 0002](../../decisions/0002-persistence-semantics.md).

## Scope and implementation review

The two Drizzle schemas map 25 MVP tables with independent histories 0000–0004. No post-MVP relation, subscription or job table is introduced. Repository interfaces contain domain values and complete create/edit intents; SQL, D1 bindings, PostgreSQL pool/client types and Drizzle remain in adapters. No business endpoint or authorization substitute was added.

Review checked parameter binding, explicit project predicates, composite foreign keys, Staff-kind membership, project-local numbering, SQL null behavior, integer/time/UUID bounds, unique target associations, append-only history, and safe idempotency snapshots. D1 stale conditional writes fail a required timeline witness inside the batch; PostgreSQL explicitly checks affected rows. Both couple the aggregate, timeline, required audit, outbox and receipt. Receipt validation rejects malformed, cross-project or overbroad stored results. Create/edit method identity and audit-action matching are checked before SQL, so an edit-shaped object cannot turn createIssue into an update. Raw bodies are absent from list SQL and mutation side-record snapshots. Moderation/tombstone metadata is available to future authorization services; this repository is not yet a public read API.

Feature state machines, permission checks, calendar/input normalization, Markdown projection/rendering, object verification and plugin execution remain with their owning modules. The phase establishes their records and integrity boundaries, not a claim that those features shipped. D1 replication remains disabled.

## Runtime and migration evidence

`pnpm test:database` runs the same behavioral cases against D1 through a Worker fixture and PostgreSQL 18.6. The D1 adapter code executes inside workerd, with SQL also executed by its real D1 binding; it is not an in-memory JavaScript fake. SQL-only schema/migration inspections use Miniflare's actual binding. PostgreSQL uses a new private Unix-socket cluster and independent empty databases for fresh-install/failure cases.

Latest results: **25 D1 tests and 24 PostgreSQL tests pass**. The profile-specific difference is SQLite INSERT OR REPLACE protection. Shared cases include:

- concurrent consecutive numbering; distinct project counters; one successful same-key request under simultaneous retries; payload mismatch, scope and expiry; original replay results after later edits;
- one winner among concurrent expected-revision edits; complete rollback on stale writes, missing/archived/cross-project targets and forced outbox collision, including counter and required side records;
- read-after-write, backward clock handling, bounded pagination, equal timestamps, project/filter cursor binding and body-free list rows;
- Staff-only grants/assignments, external identity uniqueness, taxonomy/comment/reaction/form/attachment/plugin scope constraints, immutable history/form versions, one-target reaction/attachment rules and upload metadata bounds;
- fresh 25-table databases; populated frozen-0000 upgrade through 0004; rejected 0001 upgrade preserves old schema/content, then succeeds after explicit fixture repair;
- PostgreSQL migration-runner no-op reapplication and checksum mismatch rejection; Wrangler local D1 application of all five migrations and no-op reapplication.

`pnpm db:check` passed for both histories. Reviewed SQLite corrections and restore/forward-fix procedures are in [MIGRATIONS](../../development/MIGRATIONS.md). No production data or live database was changed. The repository suite and builds also passed from an isolated source copy installed from the frozen lockfile and local package cache.

## Query evidence

The repeatable fixture inserts 4,000 Issues in two projects (2,000 each), 25% open, with groups of 20 equal timestamps, then collects database statistics. Measurements capture actual adapter SQL and count calls: first page, detail and cursor page each issue exactly one query; pages fetch at most 41 rows and expose 40 metadata items. Both dialects choose the project/state/created index for the filtered list/cursor and a unique index for detail. No sequential scan or per-row relation loading appears in the recorded fixture.

- [D1 query plans](02-d1-query-plans.json): SQLite EXPLAIN QUERY PLAN, including indexed row-tuple cursor comparison.
- [PostgreSQL query plans](02-postgres-query-plans.json): EXPLAIN ANALYZE/BUFFERS JSON, including actual rows and execution time.

Tests regenerate `.local/evidence/*-query-plans.json`; the linked files are this session's recorded observations. These are repository query-shape measurements on warm local databases, without product authorization/rendering layers or network service load. They are not production latency budgets or SLA claims. Later modules must measure bounded relation hydration and full authorized endpoints before G1.
