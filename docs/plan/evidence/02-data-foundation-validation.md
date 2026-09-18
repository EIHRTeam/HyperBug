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

`pnpm db:check` passed for both histories. Reviewed SQLite corrections and restore/forward-fix procedures are in [MIGRATIONS](../../development/MIGRATIONS.md). No production data or live database was changed. The exact committed revision `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d` also passed both builds and all 80 tests (including these 49 database tests) from a separate clean Git worktree installed offline from the frozen lockfile.

Hosted [run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101) then passed the same D1/workerd and PostgreSQL suites on Linux, including the actual PostgreSQL 18.6 service container. All four required foundation jobs passed for commit `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d`.

## Query evidence

The repeatable fixture inserts 4,000 Issues in two projects (2,000 each), 25% open, with groups of 20 equal timestamps, then collects database statistics. Measurements capture actual adapter SQL and count calls: first page, detail and cursor page each issue exactly one query; pages fetch at most 41 rows and expose 40 metadata items. Both dialects choose the project/state/created index for the filtered list/cursor and a unique index for detail. No sequential scan or per-row relation loading appears in the recorded fixture.

- [D1 query plans](02-d1-query-plans.json): SQLite EXPLAIN QUERY PLAN, including indexed row-tuple cursor comparison.
- [PostgreSQL query plans](02-postgres-query-plans.json): EXPLAIN ANALYZE/BUFFERS JSON, including actual rows and execution time.

Tests regenerate `.local/evidence/*-query-plans.json`; the linked files are this session's recorded observations. These are repository query-shape measurements on warm local databases, without product authorization/rendering layers or network service load. They are not production latency budgets or SLA claims. Later modules must measure bounded relation hydration and full authorized endpoints before G1.

## Requirement-to-evidence audit

| Checklist IDs | Inspected evidence and result |
| --- | --- |
| 02.1a | DATA-MODEL and domain types define IDs, local numbers, UTC precision, enums/nullability, actors, revisions and retention. |
| 02.1b | Both schemas/migration histories contain all 25 physical MVP mappings; shared schema cases exercise membership, identity, taxonomy, history, reactions, forms, uploads and plugin scope. |
| 02.1c | DATA-MODEL reserves relations, subscriptions, views and jobs without speculative physical tables. |
| 02.1d | API-CONVENTIONS assigns REST/OpenAPI ownership and records DTO/error/date/ID/concurrency/idempotency/deprecation rules. |
| 02.1e | Application cursor validation and pagination tests prove bounded defaults/maxima, version/resource/filter/project binding and equal-time tie-breakers. |
| 02.1f | API-OPERATIONS assigns every resource family, actor/role permissions, read/moderation and cross-project rules before routes exist. |
| 02.2a | Application interfaces expose explicit complete create/edit intents and domain outcomes; infrastructure dependencies remain in dialect adapters and pass boundary checks. |
| 02.2b | Separate Drizzle schemas, journals and migrations 0000–0004 pass history checks and fresh/populated-upgrade tests. |
| 02.2c | Shared schema and repository tests exercise project/number uniqueness, principal/composite references, target uniqueness and state constraints in both dialects. |
| 02.2d | Atomic outcome tests inspect aggregate, required audit/timeline, outbox and receipt; forced failures prove no partial commit or consumed number. |
| 02.2e | Concurrent stale-write and duplicate-retry cases prove revisions, operation/scope/payload/expiry matching and original safe replay results. |
| 02.2f | Both recorded 4,000-Issue query plans use intended indexes and one query per read; DATA-MODEL specifies bounded hydration and future FTS5/tsvector mappings. |
| 02.2g | Shared write-then-read cases pass against writer bindings; D1 replication remains absent/disabled with future acceptance explicitly required. |
| 02.3a | The same repository/schema fixtures execute adapter code in actual local workerd/D1 and PostgreSQL 18.6. |
| 02.3b | Empty databases and frozen previous-schema fixtures migrate successfully; invalid upgrade rolls back, preserves old state and succeeds after explicit repair. |
| 02.3c | Both suites include concurrent allocation, rollback, retries, stale edits and cursor boundaries with equal timestamps. |
| 02.3d | Recorded dialect plans/query counts come from deterministic larger fixtures; MIGRATIONS documents recovery, forward fixes and non-reversible boundaries. |

Acceptance review preserves feature authorization/state-machine/rendering work for its owning modules. It does not use repository integrity tests to claim those later behaviors are complete.
