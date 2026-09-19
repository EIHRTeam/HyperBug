# Database migrations and repair

Read for schema, index, repository, backfill, migration-tool, or data-repair changes. Locate TECH-STACK §§9–13, 48, 54 and PERFORMANCE §§7–19, 54–57 through [SOURCES](../../../../docs/plan/SOURCES.md). Read the actual DATA-MODEL when it exists; it is a planned artifact until module 02 creates it.

## Define the data invariant first

State the business invariant, old/new representation, compatibility window, data/retention impact, and transaction intent. Public IDs, project Issue numbers, actor identity, timestamps, uniqueness, and event/audit/outbox semantics must remain explicit.

Keep separate D1/SQLite and PostgreSQL schemas/migration histories. Share repository behavior rather than SQL text or a presumed universal Drizzle transaction API. Check current driver/runtime documentation before choosing transaction operations.

D1 batches and PostgreSQL interactive transactions have different capabilities. Prove atomic business outcomes, including conditional zero-row/conflict cases, instead of assuming every failed precondition throws and rolls back. Do not perform read-check-write integrity enforcement without addressing concurrency.

## Prepare and inspect

Generate using installed reviewed tooling, then inspect actual SQL: destructive changes, renames, defaults/nullability, foreign keys, uniqueness, indexes/FTS, conversion/backfill cost, and table locking/rebuild behavior.

For deployed data, choose an explicit expand/backfill/contract or justified alternative, with bounded resumable batches, checkpoints, concurrency control, and old/new application compatibility. Estimate work from representative data. Do not rewrite migrations already applied to shared environments.

Keep migration credentials scoped and separate from normal application capabilities where practical. External plugins do not gain arbitrary Core SQL; trusted plugin migrations need namespaces and review.

## Verify before an authorized rollout

Run empty-database and prior-schema upgrade cases on both adapters, shared repository contracts, concurrency/idempotency/cursor checks, and relevant query plans/counts/rows. Restore a representative backup when validating an operational migration/recovery claim.

Define failure detection, stop/retry conditions, and recovery before mutation. Application rollback does not undo an irreversible schema change. Document a safe forward fix or coordinated restore when reversal would lose data; retain the key versions required to read restored encrypted records.

For production repair, identify the exact environment and selected records, prepare a dry-run/result preview where possible, and use only current session authorization. Do not repeat ambiguous mutations without inspecting actual state.

Update model/API/operator documentation and the owning module progress records with migration IDs, tested starting/ending versions, evidence, remaining backfill work, and next-session cautions.

