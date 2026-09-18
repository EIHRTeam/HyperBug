# Database migration workflow

Use the pinned Node/pnpm toolchain from [development setup](README.md). SQL histories under `packages/database/d1/migrations` and `packages/database/postgres/migrations` are independent. Drizzle schemas are the source for table/constraint/index generation; custom migrations own append-only triggers. Never replace the history with schema push against persistent data.

## Commands and local environments

```sh
pnpm db:generate:d1 --name descriptive_change
pnpm db:generate:postgres --name descriptive_change
pnpm db:check
pnpm test:database
pnpm db:migrate:d1:local
```

The D1 apply command always passes `--local`. Its placeholder binding ID is local development configuration, not a deployed database. Wrangler records applied filenames in its migrations table and stores local data under `apps/api-cloudflare/.wrangler/state/v3/d1`. Applying the same history again is a no-op. Both fresh local application and no-op reapplication have been exercised. Staging/production D1 IDs must be explicitly provisioned in their own environments by module 13; they are not inferred from this placeholder.

For a disposable PostgreSQL 18 cluster on this workstation:

```sh
node tooling/postgres-test-cluster.mjs node tooling/migrate-postgres.ts --apply
pnpm test:postgres
```

`PG_BIN` selects the PostgreSQL 18 binary directory when it is not on PATH. On this workstation it defaults to `/opt/homebrew/opt/postgresql@18/bin`. The runner creates a new mode-0700 temporary directory, listens only on its Unix socket, exports isolated PG settings to its child, and stops/removes that cluster afterward. It never attaches to an existing service.

For a separately managed development database, supply `HYPERBUG_MIGRATION_DATABASE_URL` through the environment; do not store it in Git or put credentials in shell arguments:

```sh
pnpm db:migrate:postgres --status
pnpm db:migrate:postgres --apply
```

Status is the read-only default. Apply requires PostgreSQL 18, serializes migration runners with a session advisory lock, verifies an immutable applied-history prefix using SHA-256 checksums, and commits each migration with its history row. A failed migration rolls back its statements/history row; completed earlier migrations remain applied. The connection needs migration-owner DDL privileges. Normal application connections should use separate reduced privileges; deployment role provisioning belongs to module 13. This command has been tested on isolated local databases only.

## Current history and review

| Migration | Purpose and review |
| --- | --- |
| 0000 foundation | Seven aggregate, principal/project and side-record tables; independent SQL dialects |
| 0001 integrity | Strong UUID/time/state constraints; explicit null handling for closed Issues |
| 0002 append_only | Immutable audit/timeline DML; SQLite replacement and PostgreSQL truncation protection |
| 0003 mvp_records | Remaining MVP mappings (25 total tables), Staff membership constraints, project-scoped references, moderation/tombstone metadata, integer parity and named system actors |
| 0004 immutable_definitions | Immutable comment history and form versions |

Reviewed Drizzle Kit 0.31.10 SQLite output needed corrections before execution: `foreign_keys=OFF` cannot disable enforcement inside D1's implicit transaction; table rebuilds must use `defer_foreign_keys`. Generated copies also selected newly introduced columns from old tables, so 0003 explicitly backfills null/visible values. Rebuilds drop triggers; 0003 restores the timeline triggers. Both rebuild migrations verify `pragma_foreign_key_check` through a checked temporary guard before clearing deferred DROP bookkeeping and committing. No foreign-key cascade is used to erase history.

Tests apply every history from empty databases and upgrade a populated 0000 fixture containing aggregate, counter, timeline, audit, outbox and receipt rows. The frozen old-writer fixture does not depend on current repository columns. Invalid prior close-state data deliberately rejects 0001; tests prove rollback preserves the old rows, then explicitly repair the fixture and successfully retry. PostgreSQL fresh-install tests create a separate database, because generated foreign keys explicitly target `public`; changing only `search_path` would give false confidence.

## Recovery and forward fixes

Do not edit a migration already applied to any shared environment. Prepare a new reviewed forward migration. Before a production rebuild or tightened constraint, take a consistent backup/snapshot, inspect existing violations, estimate copy/lock time from representative data, and schedule bounded backfill or maintenance where required. A constraint failure is a stop signal; do not silently delete violating data or disable constraints to proceed.

An application rollback does not reverse schema/data changes. If failure occurs before the migration commits, inspect its rolled-back state and history before repairing/retrying. After a committed incompatible change, choose a reviewed forward fix or restore the complete coordinated backup (database, blobs and required key versions), accepting and reconciling writes since the recovery point. Never restore only selected side records independently of their aggregate. History/form/audit retention needs a deliberate migration-owner procedure because ordinary DML is append-only.

No deployed migration, production backup/restore, or live provider recovery is claimed. Module 13 owns that evidence. Query and repository evidence is recorded in the module 02 progress file.

Documentation lookup: Context7 on 2026-09-18 confirmed [D1 foreign-key deferral](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) and [Wrangler migration configuration](https://developers.cloudflare.com/d1/reference/migrations/). Installed generator output and actual local runtime experiments resolve gaps in generic ORM examples.
