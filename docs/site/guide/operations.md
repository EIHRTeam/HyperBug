# Upgrade, back up, and recover

[Documentation home](../index.md) · [Installation](deployment.md) · [Security](security.md)

These procedures are prepared and exercised on disposable local services at their recorded scope. They are not production recovery objectives. The release remains unpublished, G1/G2 Not passed, and actual-Free acceptance open.

## Prepare a maintenance window

Record source/artifact hashes, runtime/provider versions, public config, applied migration prefix and required key references. Drain incoming writes, all dispatchers and native-plugin effects to choose a cross-resource consistency point. Preserve a separate current revocation record and the prior compatible app/config/header artifacts. Do not allow a preview frontend to fall through to production.

Validate public policy with `node tooling/check-deployment.ts node deploy/node/public-policy.example.json` (use `cloudflare` for that runtime). Startup and live readiness still validate bindings, private material and primary availability separately. Health alone is not an authenticated smoke test.

## Upgrade and roll back safely

PostgreSQL operators use explicit private `HYPERBUG_MIGRATION_DATABASE_URL` with `node tooling/migrate-postgres.ts --status`, inspect pending immutable history, then use `--apply` only in an authorized window. D1 operators select the exact private config/database and use installed Wrangler migration list/apply; local rehearsal uses `--local`. Never run the local placeholder remotely.

For compatible additive changes, migrate before replacing backend/worker artifacts, check prior writers/readers, then release the independently configured frontend with its generated CSP/cache policy. For incompatible changes, stop old writers and use a reviewed maintenance sequence. On failure, inspect state/history before retry. A failed uncommitted migration can roll back; a committed irreversible change needs a forward fix or coordinated restore. Application rollback restores a compatible artifact/config pair and never reverses data migrations. Search-mode changes also require stopping the old dispatcher and rebuilding the selected index.

## Capture and restore together

Pin retained key versions through the existing audited registry `begin-backup` operation before capture, and `finish-backup` after it. Retain database records, referenced immutable/staging blob bytes and identities, public config and separately recoverable secret versions. Backup expiry alone does not release keys; require retention plus confirmed destruction of all copies. A database snapshot does not include object storage or secret-manager material.

PostgreSQL 18 custom archives use `pg_dump --format=custom --file=<private-archive> <database>` and restore into an isolated empty DB with `pg_restore --exit-on-error --no-owner --no-privileges --dbname=<isolated-database> <private-archive>`. Supply private connection settings through the environment. Database dumps omit cluster roles/tablespaces: preserve their reviewed provisioning manifest separately. D1 managed recovery uses export or Time Travel, whose Free history is seven days and does not clone databases or recover blobs/config/keys.

The local rehearsal stops the emulator before a physical SQLite backup/restore. It uses Miniflare 5 `resourcePersistencePath`; the old `d1Persist` input is stripped. Retire stale WAL/SHM companions only for the stopped, owned disposable database before replacing its snapshot, otherwise newer pages may remain active. This local filesystem procedure is not a managed-D1 restore command.

In an isolated restore, verify complete captured row equality, schema/history/FKs, Issue/timeline/outbox/receipt links, attachment size/SHA-256 and content, public config hashes, retained backup pins and encrypted reads. Reconcile all post-capture revocations before exposing restored services. Disable external delivery during validation. Account explicitly for writes since capture instead of claiming zero loss.

## Operator recovery and monitoring

Key provisioning, planned rotation and emergency revocation use the trusted audited KeyRegistry integration, not a public HTTP maintenance endpoint. Provision files privately; activate references before accounts. Rotate with current/previous/required versions intact; rewrap or migrate under expected revisions before removing an unreferenced version. Compromise requires immediate revocation and next-request denial, including after restoring an older DB. Retain quarantined backup keys according to policy without making a revoked key readable.

Use current permissions and a recent verified passkey for sensitive administration. Revoke a project role or suspend a principal through the existing audited management API; next-use primary validation denies old credentials. Recovery codes redeem once; no forced password setter or instance-role management API exists. Do not delete Staff/history to force bootstrap re-arm when its preconditions fail.

For failed deliveries, invoke trusted `replayFailedTask` with fresh operator authorization and exact source/delivery identity. Verify provider recovery, current project/principal/plugin state and idempotency before resetting; pending work reconciles automatically. Search rebuild uses sensitive `reindexSearch`, following its cursor (Standard 25 / Minimum 10 documents). Reads do not rebuild or scan around an incomplete index. Scheduled retention preserves active attachments, retries, history and required accounting; physical absence must precede quota release.

Use safe HTTP request IDs/status/error codes, `component: async` summaries, oldest backlog age, failure/retry counts and the bounded primary queries in `deploy/operator-queries.sql`. Query results saturating at 1001 are lower bounds. Investigate authorization/key/audit failures immediately, growing backlog across two applicable phase intervals, terminal failures and usage approaching allocated quotas. These are operational alert triggers, not measured SLOs. Production diagnostic head sampling is 0.1; required durable audit remains complete. Minimum phases recur every 25 minutes, logs retain three days and no Logpush/OTLP export is enabled.

Queue/provider outage preserves canonical outbox state for bounded retry/reconciliation; key/auth/primary/CAPTCHA failure denies dependent operations. Storage/scanner failure retains quarantine and quota. Never disable TLS verification, rate limits, permissions or required audit to recover availability.

## Reproduce the local exercise

Use a verified SeaweedFS 4.48 executable; this command creates its own PostgreSQL 18 cluster and S3 service, never attaches to an existing database:

```sh
HYPERBUG_TEST_SEAWEED=/absolute/path/to/verified/weed \
  node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs \
  run --project postgres tests/postgres/operations.test.ts
corepack pnpm exec vitest run --project workerd tests/workerd/operations-rollback.test.ts
```

The fixture exercises a populated `0000_foundation` upgrade with an intentional constraint failure/repair, frozen old writer compatibility, real audited key activation, coordinated DB/blob/config/key capture and recovery, a deliberately lost post-capture update and reconciled revocation. The attachment's clean result is synthetic; this recovery test does not certify scanning. Separate suites verify replay, retention, role revocation and search/provider failure. Actual production Node SIGTERM/drain and native local Worker artifact restoration are measured separately from schema recovery.

[Rehearsal evidence](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/plan/evidence/13-maintenance-rehearsal.md) gives fixture sizes, exact versions, observed restore/shutdown durations and failure lessons. These tiny local fixtures are repeatable baselines, not production RPO/RTO, capacity promises or paid Standard evidence. Minimum's actual Free recovery limits require their own evidence.
