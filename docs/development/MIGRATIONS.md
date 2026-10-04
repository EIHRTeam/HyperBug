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
| 0005 key_lifecycle | Durable key registry, protected-record references and retained-backup pins |
| 0006 key_lookup_bounds | Covering/partial indexes for bounded lifecycle queries |
| 0007 rate_limits | Additive privacy-minimized fixed-window counters and expiry index; no existing table rebuild |
| 0008 password_pepper | Widen key purpose to `password-pepper`; D1 rebuilds `key_versions` with deferred foreign keys and restored lifecycle triggers, while PostgreSQL replaces its CHECK constraint |
| 0009 account_lockouts | D1-only additive Free-tier account lockout state and expiry index; PostgreSQL history is unchanged |
| D1 0010 / PostgreSQL 0009 password_credentials | Additive standard-profile versioned Argon2id User credential table |
| D1 0011 / PostgreSQL 0010 authorization_sessions | Additive first-party session table with principal and expiry indexes; no existing table rebuild |
| D1 0024 / PostgreSQL 0023 instance_roles | Staff-only immutable instance roles; deterministic oldest active Staff backfill and instance-role audit event |
| D1 0025 / PostgreSQL 0024 token_assurance | Immutable ceremony method/time/level on sessions, codes and tokens; existing rows backfill password/1 at creation time |

Reviewed Drizzle Kit 0.31.10 SQLite output needed corrections before execution: `foreign_keys=OFF` cannot disable enforcement inside D1's implicit transaction; table rebuilds must use `defer_foreign_keys`. Generated copies also selected newly introduced columns from old tables, so 0003 explicitly backfills null/visible values. Rebuilds drop triggers; 0003 restores the timeline triggers. Both rebuild migrations verify `pragma_foreign_key_check` through a checked temporary guard before clearing deferred DROP bookkeeping and committing. No foreign-key cascade is used to erase history.

Tests apply every history from empty databases and upgrade a populated 0000 fixture containing aggregate, counter, timeline, audit, outbox and receipt rows. The frozen old-writer fixture does not depend on current repository columns. Invalid prior close-state data deliberately rejects 0001; tests prove rollback preserves the old rows, then explicitly repair the fixture and successfully retry. PostgreSQL fresh-install tests create a separate database, because generated foreign keys explicitly target `public`; changing only `search_path` would give false confidence.

Migration 0007 was generated and inspected on 2026-09-25. It creates only `rate_limit_counters` and its expiry index in each dialect. Local D1 applied it after the previously applied 0000–0006 history and the second apply was a no-op. Fresh and populated-upgrade D1/workerd and isolated PostgreSQL 18.6 tests pass; no shared or remote database was migrated. See [rate-limiting evidence](../plan/evidence/03-rate-limits-validation.md).

Migration 0008 was generated and reviewed on 2026-09-25 without changing 0000–0007. The D1 table rebuild uses `defer_foreign_keys`, restores all three `key_versions` lifecycle triggers and checks the resulting foreign-key graph. The populated 0007→0008 fixture retains a protected record and backup reference, then verifies key-transition and deletion guards. Fresh and populated-upgrade repository suites passed on D1/workerd (45/45) and isolated PostgreSQL 18.6 (43/43). Local D1 applied 0008 and a second invocation found no migrations. No remote/shared migration or production restore was performed; keep this locally applied history immutable.

Migration 0009 was generated on 2026-09-26 and inspected as an additive D1-only table and expiry index. The local workerd repository suite applies it from empty and populated prior history and exercises the lockout store. On 2026-09-27, the complete 0000–0009 D1 history was also applied to the empty, temporary `hyperbug-test-1` remote database through an ignored test-only Wrangler config; a subsequent remote migration listing showed no pending files. This is test-database migration evidence only. Staging and production bindings remain unset, and no PostgreSQL analogue is needed for the Cloudflare-only minimum tier. Keep 0000–0008 unchanged.

The standard-profile credential and authorization-session migrations are additive and dialect-specific. The new session SQL contains only `authorization_sessions`, two indexes, and its foreign-key/check constraints; Drizzle history checks pass. Focused account-route fixtures apply these after the prior schema in isolated PostgreSQL 18.6 and local workerd/D1. The test-only remote D1 has both migrations through `0011`; staging and production have not been migrated. Keep already applied migration files immutable; a needed correction must be a forward migration.

## Recovery and forward fixes

Do not edit a migration already applied to any shared environment. Prepare a new reviewed forward migration. Before a production rebuild or tightened constraint, take a consistent backup/snapshot, inspect existing violations, estimate copy/lock time from representative data, and schedule bounded backfill or maintenance where required. A constraint failure is a stop signal; do not silently delete violating data or disable constraints to proceed.

An application rollback does not reverse schema/data changes. If failure occurs before the migration commits, inspect its rolled-back state and history before repairing/retrying. After a committed incompatible change, choose a reviewed forward fix or restore the complete coordinated backup (database, blobs and required key versions), accepting and reconciling writes since the recovery point. Never restore only selected side records independently of their aggregate. History/form/audit retention needs a deliberate migration-owner procedure because ordinary DML is append-only.

No staging/production migration, production backup/restore, or live provider recovery is claimed; the remote session migration below was test-only. Module 13 owns that evidence. Query and repository evidence is recorded in the module 02 progress file.

Documentation lookup: Context7 on 2026-09-18 confirmed [D1 foreign-key deferral](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) and [Wrangler migration configuration](https://developers.cloudflare.com/d1/reference/migrations/). Installed generator output and actual local runtime experiments resolve gaps in generic ORM examples.

On 2026-09-28, only D1 `0011_authorization_sessions.sql` was pending on the explicitly selected `hyperbug-test-1` UUID `5081af9c-7740-42b7-bc91-10010a0b8323`. Wrangler 4.141.0 applied it remotely in that test database; a subsequent migration list was empty, and primary D1 reads found the latest history row and an empty `authorization_sessions` table. This is test-schema evidence, not staging/production rollout or deployed HTTP acceptance. Context7 Cloudflare D1 migration commands were resolved/queried the same day, then checked against installed Wrangler output.

## Module 07 upload reservations

D1 `0020_upload_reservations` / PostgreSQL `0019_upload_reservations` add intent details and atomic project/global-principal usage counters without rebuilding historical upload/attachment tables. Reviewed custom accounting SQL backfills finalized actual bytes into used counters and every other legacy intent maximum/slot into reservations; aggregate safety constraints fail the migration rather than dropping accounting. Populated upgrade fixtures preserve legacy objects/states and quotas, and current lifecycle handlers deliberately exclude legacy rows without details. Reconcile/adopt or physically clean those rows before releasing their retained counters. [Attachment lifecycle](../ATTACHMENT-LIFECYCLE.md) defines the authorization, lease, cleanup and transaction rules. These migrations are tested locally and are not claimed applied to any remote/shared database.

## Module 07 multipart sessions

D1 `0021_upload_multipart` / PostgreSQL `0020_upload_multipart` add the same-project session/part catalog table and state index. Fresh and populated prior-schema upgrades run in the repository suites; existing direct/legacy uploads gain no session or altered accounting. Provider-ID/state checks explicitly reject null identities in active/completing/completed states, and catalogs must be bounded arrays. These newly authored migrations were refined before shared deployment; older migrations were untouched. Only disposable local test databases have applied them. Rollback of application code must preserve these rows and quota; never discard unknown provider sessions to force a retry.

## Module 07 scanner/result policy

D1 `0022_upload_scans` / PostgreSQL `0021_upload_scans` add a bounded same-project latest-result table and reviewed custom guards without rebuilding upload tables. The migration re-quarantines unsupported legacy ready/scan claims and removes unproven labels while incrementing revision and retaining verified identity/used quota. Fresh/populated upgrade tests exercise this normalization. Ready requires a completed matching clean result; ready results cannot change until quarantine, and finalized identity fields are immutable. Older histories remain untouched. These are disposable local database checks, with no shared/cloud migration application or actual scanner acceptance. Preserve all result/identity/counter rows on application rollback and obtain an actual trusted scanner result before releasing content.

## Module 07 explicit legacy recovery ledger

D1 `0023_upload_legacy_recovery` / PostgreSQL `0022_upload_legacy_recovery` add a separate bounded decision/lease/accounting ledger and reviewed custom triggers, with no historical table rebuild, backfill, implicit decision or data deletion. Generated snapshots describe the table/index/constraints; custom trigger/functions remain reviewed SQL outside Drizzle's snapshot model. Installed Drizzle Kit 0.31.11 generated named forward migrations. Context7 resolve/query on 2026-10-04 used `/drizzle-team/drizzle-orm-docs` for named/custom migration behavior and `/websites/postgresql_18` for lock/snapshot caveats; the forced native PostgreSQL waiting-insert test supplies actual post-lock visibility evidence.

Fresh and populated prior-schema upgrades pass both profiles, including byte/value-preserving upload/detail/link/counter snapshots. All **45** earlier SQL checksums remain unchanged. Project-first PostgreSQL locks serialize raw reference/adoption writes and recovery claims; D1 conditional batches include a JSON-error SELECT witness even when a mutation affects zero rows. Missing/insufficient accounting rolls back the entire release. These migrations apply only to disposable local test databases at this checkpoint. Preserve base rows, decisions, keys and both counters on application rollback; use a reviewed forward fix rather than disabling retirement/reference guards or dropping retained tombstones. Actual provider recovery, deployment and compaction are separate unfinished outcomes.

## Instance administration and credential assurance upgrade

Before applying D1 0024 / PostgreSQL 0023, inspect the earliest active Staff principal (`ORDER BY created_at, id LIMIT 1`): that principal receives the sole upgrade instance role. No active Staff means no role/backfill audit row; bootstrap enrollment grants the role when the installation is first enrolled. Project administrators retain their project roles and gain no instance privilege. Role administration APIs are deferred.

D1 0025 / PostgreSQL 0024 preserve old credentials but mark them password/assurance 1 at their own creation time. Existing sessions/tokens therefore cannot perform sensitive administration; a fresh verified passkey login is required. Session renewal, code consumption and revocation leave ceremony columns immutable. Deploy migrations before the new adapters, which require these columns. The prepared, uncommitted migrations were corrected before any shared deployment to validate nonnegative time, reject SQLite NULL updates and record a valid instance-role event rather than a false Minimum enablement. Disposable fresh and populated-upgrade tests are the acceptance evidence; no shared database is claimed migrated by this batch.

### Expired cleanup indexes (2026-10-05)

D1 `0026_expired_cleanup_indexes` and PostgreSQL `0025_expired_cleanup_indexes` add only session `(idle_expires_at,id)` and `(revoked_at,id)` indexes. They are additive and need no data backfill or rollback deletion. Installed Drizzle Kit 0.31.11 generated a current snapshot; its initial SQL repeated earlier custom B3 changes lacking generated snapshots. The reviewed forward SQL removes those duplicates while retaining the new current snapshot and all historical artifacts. Inspect SQL before applying; never reapply the repeated role/ceremony DDL. Actual remote application is reserved for B15 after backup/list checks.
