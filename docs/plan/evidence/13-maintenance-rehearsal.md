# Module 13 — Local maintenance and recovery rehearsal

Date: 2026-10-19. B2 owns 13.2a–f plus the real-store proof for 13.1e. All work is disposable/local; managed D1 recovery is separate B3 evidence. No production/staging action, new schema/contract/backend policy or dependency.

## Environment, commands and fixtures

Node 24.21.0, pnpm 11.26.0, Vitest 5.0.1, PostgreSQL/pg_dump/pg_restore 18.6, Miniflare 5.20260926.1-alpha, native local workerd, system SQLite CLI 3.43.2, actual SeaweedFS 4.48 (`530be3e37337488ecc34d58441e0bc476e121c93`, Darwin arm64). The verified official archive digest remains the version matrix's recorded value. Filesystem snapshots/keys/config are private, outside the repository and removed in finally.

Commands actually exercised:

```sh
HYPERBUG_TEST_SEAWEED=/tmp/hyperbug-seaweed-4.48/weed node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres tests/postgres/operations.test.ts
corepack pnpm exec vitest run --project workerd tests/workerd/operations-rollback.test.ts
corepack pnpm exec vitest run --project workerd tests/workerd/repository.test.ts --testNamePattern='current primary state|pins every key|real envelopes|rolls back a failed business commit|poison versions|scheduled maintenance|fails incomplete indexing|switches search scope'
node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres tests/postgres/repository.test.ts --testNamePattern='current primary state|pins every key|real envelopes|rolls back a failed business commit|poison versions|scheduled maintenance|fails incomplete indexing|switches search scope'
corepack pnpm exec vitest run --project workerd tests/workerd/roles-route.test.ts
node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres tests/postgres/roles-route.test.ts --testNamePattern='manages sessions, project roles'
```

The wrapper creates a private Unix-socket-only cluster and removes it after its child exits. The S3 launcher always creates its own service and random scoped credentials; it never reuses an existing server. No external notification recipient is configured. The explicit real-service command uses SeaweedFS; ordinary CI may use separately labelled S3 emulation, never reclassified as real service proof.

## What is exercised

- Both histories upgrade a populated frozen `0000_foundation` writer through all 33 PostgreSQL / 36 D1 migrations. A rejected integrity upgrade preserves rows/schema, explicit fixture repair succeeds, and the old writer/read/replay/counter behavior remains compatible after migration. PostgreSQL's real migration command separately installs empty/current schema and proves no-op reapplication. The existing full migration suites supply additional fresh-history and checksum-tampering coverage in B4.
- Actual operator file generation and audited `activateOperatorKeys` run against each real adapter, rejecting repeat initialization. Four purposes are independent; no secret value is retained in reports. AES envelope ciphertext and its key references survive capture/restore. Backup capture pins required versions before snapshots, finish retains them, emergency revocation and unsafe-removal denial remain effective.
- Database snapshots, a referenced three-byte `abc` object with actual SHA-256, public config and recoverable key material share a quiesced point. A form-consumed attachment, Issue, timeline, audit, outbox and receipts are present. The clean scan result is explicitly synthetic; the test proves recovery integrity, not malware detection.
- PostgreSQL uses an actual custom dump and isolated empty-db restore; local D1 uses stopped-runtime SQLite backup/restore. All captured tables/rows match after restoration; FK/constraint checks pass; blob bytes/size/checksum and config hashes match, required backup pins remain, and encrypted reads verify offline before reopening. One deliberate post-capture title update is lost. A separately recorded post-capture revocation is reapplied before services are exposed and decryption is denied afterward. This is coordinated rollback with explicit data loss, not a zero-RPO claim.
- Actual production Node candidate and archived prior artifact reach primary-backed readiness, receive SIGTERM, drain and exit 0. Native local production Worker Standard/Minimum artifact slots use the same migrated persisted D1. Because Module 13 changes no backend application source, the accepted `9b78e06` backend and candidate have identical app bytes; the exercise verifies slot restoration/compatibility, not a changed application version or reverse migration. Health/metadata smoke does not replace the complete authenticated journey matrix.
- Eight selected existing recovery cases pass on each store: authoritative current revocation, retained backup pins, real envelope/digest/blind-index rotation, business rollback and send-before/send-after failure, poison/DLQ authorized replay, scheduled cleanup/cursor lease recovery, bounded search rebuild and bidirectional title-mode switching. They preserve canonical data and fail closed. The role HTTP exercise separately verifies primary-backed session/role/principal revocation with audit and recent assurance. Providers/effects in these focused fault cases are controlled fixtures, not live outages.

## Measurements and operator diagnostics

[Scalar recovery/cost report](13-maintenance-measurements.json) records fixture row/table counts, archive sizes, capture/restore timestamps, measured restore/shutdown durations, actual D1 rows read/written and PostgreSQL EXPLAIN ANALYZE/BUFFERS plans for the four safe operator queries. These are tiny local baselines, not a capacity measurement, billing attribution, production SLO or inherited Minimum recovery objective. The tables are the report's explicitly selected user/runtime tables, not an assertion that both dialects have identical physical tables.

The captured fixture contains 55 PostgreSQL tables/62 rows and 63 selected local D1 tables/65 rows, one referenced three-byte object and one encrypted payload. Initial observed database/blob/config/key restoration is about 168 ms PostgreSQL and 269 ms local D1; Node shutdown is about 7–8 ms per slot. Read the JSON for exact observations and later final-candidate refreshes rather than treating rounded values as thresholds. The intentional lost write is explicit, and no captured rows disappear.

`deploy/operator-queries.sql` actually executes on both adapters. It provides bounded pending counts, indexed oldest age, current key state and retained backup references; `component: async` structured summaries add failure/retry/lag/outcome visibility, HTTP telemetry adds request correlation and safe status/duration. `docs/OPERATIONS.md` and paired reader operations pages document alerts on security failure, sustained backlog growth and allocated quota exhaustion. These are reviewed operator triggers; no unmeasured SLA or provisioned external dashboard/alert service is claimed. Current large-collection/bundle/browser baselines remain in [Module 12 performance](12-performance-acceptance.md); billing cost is unavailable, so logical operation/archive measurements are cost signals only.

## Failed attempts and operational lessons

Fixture construction initially omitted the existing required multipart policy, used obsolete attachment column names, and split SQL comments containing semicolons before stripping them. Correcting those fixture assumptions changed no backend. Miniflare 5 strips the old `d1Persist`; Context7 resolve-then-query selected `/cloudflare/workers-sdk` and confirmed `resourcePersistencePath` from its current README/converter. The installed definitions/source and runtime establish the actual path. Do not infer persistence from accepting an unknown converter field.

The first stopped local D1 file replacement left a post-capture revocation audit row because its existing WAL could supersede restored pages. The final owned-fixture procedure stops workerd, retires stale WAL/SHM companions, replaces the consistent `.backup`, restarts, compares all captured rows, then reconciles revocations. This is not a managed D1 restore procedure and must never be applied to an active or unowned SQLite file.

The initial native Worker prior-slot copy used module paths outside the default modules root; the copied graph could not start. The corrected fixture supplies the slot's absolute `modulesRoot`, preserving module-relative names and Wasm. No application bundle/compatibility policy is changed. An initial workerd role-name filter matched zero tests; it is not counted as a pass, and the actual file run supplies the evidence.

## Acceptance boundary

Final results/checklist closure and cleanup confirmation are appended after B2 checks. No production role repair, real historical blob recovery, scanner deployment, actual-Free ceiling, staging load or hosted paid Standard acceptance is claimed. No application source, prior SQL migration or protected root draft is modified.

B2 closes with: composed coordinated rehearsal **1/1**, native Worker artifact/role files **4/4** (2 rollback + 2 role/instance cases), PostgreSQL role focus **1/1**, selected recovery **8/8 per adapter**. Name-filter deselections are not failed/disabled tests and the zero-match workerd role attempt is excluded. Types, lint/import boundaries, scoped formatter, docs build, secret scan and whitespace pass. Private cluster/S3/runtime/Node processes and temporary files are removed by successful finally paths; no new hosted resource exists. Logs: ignored `.local/module13/b2-*.log`. The fixtures explicitly build their own production targets for repeatable standalone use; final-candidate B4 runs validate that packaging detail. 13.1e and 13.2a–f close at the exercised local/documented scope; 13.2g and independent Free acceptance remain open.
