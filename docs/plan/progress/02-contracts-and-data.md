# 02 progress — Public contracts, domain model, and database foundations

Plan: [Detailed checklist](../modules/02-contracts-and-data.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete
- Delivery scope: MVP backend
- Prerequisites: G0 passed and module 01 complete. Initial independent work followed ADR 0001 before module 01 acceptance finished.
- Implementation started: Yes.
- Completed implementation checklist IDs: 02.1a–02.1f, 02.2a–02.2g, 02.3a–02.3d.
- Active/next checklist group: Phase complete; G1 remains separate.
- Last updated: 2026-09-25 (03.3c additive rate-counter persistence follow-up).
- Blocking issues discovered: None for module 02 acceptance.
- Evidence: [Both-profile acceptance and query evidence](../evidence/02-data-foundation-validation.md).

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 02.1 | Specify the domain and protocol | Complete | [Validation](../evidence/02-data-foundation-validation.md) |
| 02.2 | Implement persistence contracts and migrations | Complete | [Validation](../evidence/02-data-foundation-validation.md) |
| 02.3 | Establish reusable compatibility tests | Complete | [Validation](../evidence/02-data-foundation-validation.md) |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Consume the completed contracts and migration workflow in later authorized modules; do not start them solely because this phase is complete.
2. Keep G1 closed until module 10 completes its own evidence.
3. Extend the same repository/schema suites when subsequent modules add validators, permissions or persistence behavior.

## Next-session cautions

D1 batches and PostgreSQL transactions are independently implemented and tested. Keep migration history immutable after shared application, protect audit/history from ordinary DML, and retain current authorization before every repository call/replay. List rows contain metadata; module 07 owns actual plain-text projections and safe rendering. Foundation implementation is included in the scoped commit; unrelated root/content-policy edits remain outside it.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 02; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for public contracts, domain model, and database foundations.
- Files/artifacts: `docs/plan/modules/02-contracts-and-data.md`; `docs/plan/progress/02-contracts-and-data.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 02.1.
- Next-session cautions: D1 batches and PostgreSQL interactive transactions have different capabilities. Prove atomic business outcomes rather than pretending their APIs are interchangeable.


### 2026-09-17 — Dependency and scope inspection

- Scope and checklist IDs: Prepare 02.1 and inspect prerequisites for 02.2–02.3.
- Progress: Read source data/security/performance requirements and migration guidance. Implementation awaits the shared runtime proof in module 01.
- Change summary: Recorded the intended second batch: stable domain/API semantics and separate D1/PostgreSQL persistence foundations.
- Files/artifacts: This record.
- Verification: PostgreSQL 18.6 binary exists locally; no database or schema has been changed.
- Decisions and deviations: Preserve explicit transaction intents, project-local numbering, bounded pagination, and replication disabled. No framework/provider substitutions.
- Blockers/open questions: Module 01 runtime prerequisite remains open.
- Next actions: Verify runtime foundation, record any independent-work dependency analysis, then define data/API contracts before generating migrations.
- Next-session cautions: Do not conflate local workerd/D1 evidence with a cloud deployment or start modules 03–10 feature implementations.

### 2026-09-18 — Domain and protocol specification batch

- Scope and checklist IDs: 02.1a–02.1f; preparation for 02.2–02.3.
- Progress: Wrote English data model, API conventions, operation inventory and persistence ADR.
- Change summary: Defined IDs/times/revisions, all logical MVP records, deferred extension seams, project-local numbering, actor/deletion policy, atomic intent/idempotency semantics, permission ownership, bounded cursor behavior and index/FTS direction.
- Files/artifacts: `docs/DATA-MODEL.md`, `docs/API-CONVENTIONS.md`, `docs/API-OPERATIONS.md`, `docs/decisions/0002-persistence-semantics.md`; independent-work analysis in ADR 0001.
- Verification: Reconciled source PRODUCT identity/state/content requirements, SECURITY project/audit/input requirements and PERFORMANCE bounds/cursor/replication requirements. Implementation and schema tests remain pending; do not mark outcomes complete yet. PostgreSQL 18.6 isolated cluster start/query/stop passed.
- Decisions and deviations: Proceed with domain/persistence work under the plan's documented dependency exception while local workerd disconnect notification remains an explicit module 01 gap. No G1/SPA or later feature endpoints. Physical migration scope is foundation aggregate + side records; logical feature models are owned by later reviewed migrations.
- Blockers/open questions: Review schema invariants against generated SQL and prove D1 zero-row rollback before accepting the transaction design.
- Next actions: Implement framework-independent domain/cursor/intent types; separate Drizzle schemas and migrations; run shared repository suites on actual local D1/workerd and PostgreSQL.
- Next-session cautions: Authorization belongs to modules 03–04 and must precede feature endpoints; repository integrity alone is not permissions. Do not enable replicas or create speculative post-MVP tables.

### 2026-09-18 — Dual repository and migration verification checkpoint

- Scope and checklist IDs: 02.2a–02.2g, 02.3a–02.3d; reconcile remaining 02.1b/02.2b schema scope next.
- Progress: Implemented D1 and PostgreSQL create/edit/read/list repositories and the shared behavioral suite. Verified concurrent numbering, duplicate idempotent retries, revision conflicts, read-after-write, rollback, project isolation, cursor binding/tie-breakers, and safe replay snapshots on real local D1/workerd and PostgreSQL 18.6.
- Change summary: Added separate 0000 foundation, 0001 integrity and 0002 append-only migrations. Tightened UUID, timestamp and close-reason checks. D1 generated rebuild SQL required deferred foreign keys, an explicit foreign-key graph guard and clearing deferred DROP bookkeeping before commit. Added triggers preventing ordinary audit/timeline rewrites, including SQLite INSERT OR REPLACE and PostgreSQL TRUNCATE. Runtime receipt validation rejects corrupted or overbroad snapshots.
- Files/artifacts: `packages/{domain,application,security,database}`, `tests/fixtures/{repository-contract,migration-contract,migrations}.ts`, database profile tests, local query evidence at `.local/evidence/{d1,postgres}-query-plans.json`.
- Verification: D1 suite passed 16 tests and PostgreSQL passed 15, covering empty and populated 0000→0002 upgrades. Initial D1 generated upgrade failed with existing foreign keys; reviewed correction passes. Repeatable fixture contains 4,000 Issues in two projects, 25% open, groups of 20 equal timestamps. Both profiles use the state/created index for list/cursor and a unique index for detail; each repository read issues one statement. Current typecheck passes; final suite after receipt-parser refinement is pending.
- Decisions and deviations: Context7 resolve/query on 2026-09-18 confirmed D1 implicit transactions and `defer_foreign_keys` semantics at https://developers.cloudflare.com/d1/sql-api/foreign-keys/. SQL generation is reviewed, not blindly applied. D1 tuple comparison enables an indexed cursor boundary. Query evidence measures repositories without a product authorization layer; it is not an endpoint performance claim.
- Blockers/open questions: Only seven foundation tables are physical so far. The earlier decision to leave remaining MVP physical schemas to feature modules must not reduce the full module 02 checklist; reconcile and implement the remaining required mappings before declaring the phase complete. Workerd transport issues do not prevent this independent database batch under ADR 0001.
- Next actions: Complete full MVP schema mappings and invariant tests, refresh migration/recovery documentation, run all checks, capture evidence and update canonical checklist/progress.
- Next-session cautions: G1 stays closed; no product mutation endpoints or SPA. Repository integrity is not authorization. Audit/history triggers require deliberately reviewed migration/retention procedures. Do not rewrite deployed migrations or treat the representative aggregate suite as proof of later feature behavior.

### 2026-09-18 — Full MVP mapping and acceptance review

- Scope and checklist IDs: 02.1a–02.1f, 02.2a–02.2g, 02.3a–02.3d.
- Progress: Completed the 25-table MVP physical mappings and domain/protocol specifications, independent migration histories, atomic repositories and both-profile acceptance suite. The seven-table first batch is explicitly superseded as the completion boundary.
- Change summary: Added identities/Staff grants, taxonomy, comments/history/reactions, forms/templates/versioned submissions, upload/attachment metadata, plugin scope/metadata, moderation/tombstone fields and system actors. Kept list queries free of full Markdown bodies under the separately accepted module 07 policy. Added a frozen previous-writer fixture, rejected-upgrade rollback/repair/retry cases, local migration commands and checksum-checked PostgreSQL history. D1 repository methods now execute inside workerd. Final review fixed operation confusion and mismatched audit actions before any SQL.
- Files/artifacts: Both `packages/database/*/src/schema.ts` files and histories 0000–0004; domain/application/adapters; shared repository/schema/migration fixtures; `tooling/{migrations,migrate-postgres}.ts`; DATA-MODEL/API documents and ADR 0002; [acceptance evidence](../evidence/02-data-foundation-validation.md) and recorded dialect query plans.
- Verification: Latest typecheck/lint pass. Both dialects passed the new operation/audit regression; full acceptance and clean-copy verification details are recorded in the linked report. Wrangler applied all five migrations locally and then reported no pending migrations. PostgreSQL runner validates fresh/no-op/checksum mismatch paths. Drizzle history checks pass. The 4,000-Issue fixture proves one indexed SQL statement per first page, detail and cursor page. No live database, deployment, production restore or feature permission layer is claimed.
- Decisions and deviations: Corrected generated D1 SQL rather than weakening constraints: explicit new-column backfills, deferred foreign keys with a checked graph, and restored triggers after rebuild. PostgreSQL fresh installation now uses an actual separate database, since generated foreign keys qualify public. Later modules own feature validators/state machines, authorization, Markdown projections, upload verification and plugin execution; deferred post-MVP tables remain absent.
- Blockers/open questions: Module 01's disconnect/hosted-CI acceptance remains open under ADR 0001's independent-work analysis; it does not invalidate local data acceptance or open G1.
- Next actions: Finish canonical checklist/link consistency review and retain the full acceptance evidence. Subsequent modules must consume these contracts without bypassing required security and backend-before-SPA gates.
- Next-session cautions: All changes remain uncommitted alongside unrelated root/content-policy/install-script work. Do not stage or overwrite those unrelated files. Migrations have run only in disposable/local development stores; future shared applications must retain their immutable history. Lists return metadata; no preview is fabricated before module 07's projection implementation.

### 2026-09-18 — Final suite evidence and scoped commit preparation

- Scope and checklist IDs: Retain 02.1–02.3 acceptance and prepare the implementation commit.
- Progress: Reconfirmed all database acceptance tests within the complete current-tree suite; module 02 remains Complete.
- Change summary: Refreshed committed-intended query-plan observations from the latest 4,000-Issue fixtures. Public specification links now point to the owning module 07 plan so this scoped foundation commit is independent of that task's uncommitted policy files.
- Files/artifacts: DATA-MODEL, API-CONVENTIONS, both query-plan JSON artifacts, paired module 01 runtime evidence and this record.
- Verification: Full suite passed 80 ordinary tests with no expected failures, including 25 D1 repository cases and 24 PostgreSQL cases. The two final operation/audit regression cases are included. The earlier isolated-source run had 77 ordinary passes plus one then-expected runtime failure; it is not mislabeled as this later run.
- Decisions and deviations: Module 01's disconnect diagnosis is resolved locally; required hosted CI still awaits the implementation commit. No persistence semantics, feature scope or gate was relaxed.
- Blockers/open questions: No new module 02 blocker; hosted CI is tracked by module 01.
- Next actions: Commit the bounded foundation changes and verify hosted checks against that revision.
- Next-session cautions: Preserve unrelated policy work and immutable migration histories. Repository integrity does not replace authorization; no later feature endpoints or SPA are authorized by this completion.

### 2026-09-18 — Committed clean-checkout and hosted acceptance

- Scope and checklist IDs: Final completion audit of modules 01 and 02, including 01.1c and required CI acceptance.
- Progress: Both phases are Complete. Implementation commit `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d` is published on `codex/phase-01-02`; no merge or deployment was performed.
- Change summary: Retained a scoped commit, independently validated its clean checkout, ran hosted quality/runtime/database jobs, and mapped every checklist ID to inspected evidence. Updated current status and handoff documentation; historical failed observations remain visible.
- Files/artifacts: Module 01/02 plans, progress and evidence reports; development guides, ADR 0001 and public specifications. [Hosted run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101). Unrelated root and content-policy work is excluded from the commits.
- Verification: Committed clean checkout passed offline frozen installation, both typechecks/builds and 80 tests; 15 foundation documents passed 98 local links/anchors. Hosted quality, Node, workerd and PostgreSQL jobs all passed with the same 80 tests and no expected failures. Hosted PostgreSQL 18.6 image/version was confirmed in the log. Quality passed migration histories, lint/format, scans and audit high gate; one reviewed moderate dev-tool advisory remains.
- Decisions and deviations: No baseline/gate relaxation. Workerd disconnect proof includes heartbeats and explicitly observes Request.signal. The required matrix passes on macOS locally and Linux in CI. Optional Elysia next remains deferred. G1 stays closed.
- Blockers/open questions: None remaining for these phases. Production/provider acceptance, feature authorization and SPA gates belong to later modules. Earlier Node reset has not recurred in the verified runs; no root-cause fix is claimed.
- Next actions: Hand off the completed foundation; use the plan's next eligible backend module only when authorized. Preserve and extend the required checks.
- Next-session cautions: Keep migrations immutable after shared application, use Node/Corepack pins and separate runtime processes, preserve unrelated uncommitted work, and never deploy fixture routes or treat repository integrity as authorization.


### 2026-09-19 — Security lifecycle persistence and operations handoff

- Scope and checklist IDs: Module 03.2d persistence follow-up; module 02 remains Complete.
- Progress: Added five security lifecycle tables and immutable 0005–0006 histories to both dialects (30 tables total).
- Change summary: Protected payload/reference ownership, permanent key identities/transition guards, backup pins and generation transactions; covering/partial indexes correct an observed retained-row scan.
- Files/artifacts: Both database schemas, adapters, migrations/snapshots/journals; shared registry/migration tests; DATA-MODEL, ADR 0006 and [03 evidence](../evidence/03-security-foundation-validation.md).
- Verification: Full suite 133 passed; D1 repository 38 and PostgreSQL 37 tests include fresh/previous-schema migrations, rollback, concurrent lifecycle state and runtime envelope proofs. `db:check` passes; Wrangler local migrations applied and no-op verified. One-statement indexed snapshot measured with 4,000 records, 500 backups and 4,000 extra tombstones.
- Decisions and deviations: Additive schema supports retaining tables during application rollback; dropping lifecycle metadata is unsafe. Primary reads and reference/audit atomicity remain mandatory. No external deployment or production restore.
- Blockers/open questions: Actual backup/restore orchestration and current revocation reconciliation remain module 13 work.
- Next actions: Consume these internal storage contracts in identity/plugin owners; continue module 03 password and enforcement work.
- Next-session cautions: Preserve 0000–0006 history, including the newly locally applied migrations; do not bypass protected-record accounting for recoverable secrets or delete referenced key material.

### 2026-09-21 — Audit implementation parked; transport work continues

- Scope and checklist IDs: Suspend the unfinished 03.3a adapter/test additions; module 02 remains Complete.
- Progress: Parked new audit adapters, shared fixtures and selective database-test integrations. Existing tables, append-only protections and atomic Issue/key-registry audit writes remain intact.
- Change summary: No schema or migration change. Local snapshots retain incomplete work and a manifest for an explicitly authorized future resumption.
- Files/artifacts: `.local/phase03-suspended-audit/2026-09-21/`; database indexes and test fixtures; [suspension register](../AUDIT-SUSPENSION.md).
- Verification: Before suspension, workerd had 44 passes and one new audit fixture failure (450 SQL parameters exceeded D1's limit); PostgreSQL additions did not run. After parking, both typechecks/builds and lint passed. No audit-specific rerun was performed.
- Decisions and deviations: Suspension is not acceptance or deletion of existing audit behavior. The failed seed and unfinished adapter-query-plan check remain parked.
- Blockers/open questions: Suspended audit evidence is deferred and does not block unrelated development.
- Next actions: Support non-audit security adapters only when selected under their owning checklist.
- Next-session cautions: Preserve locally applied immutable 0000–0006 migration history; do not fix or rerun parked audit work or overwrite integrated files from the snapshot without explicit resumption.

### 2026-09-25 — Additive rate-counter persistence handoff

- Scope and checklist IDs: Module 03.3c/03.3d storage follow-up; module 02 remains Complete and 03.V3 is open.
- Progress: Added `rate_limit_counters` through separate additive `0007_rate_limits` histories and atomic increment/bounded-purge adapters in D1 and PostgreSQL. No existing table or audit behavior changed.
- Change summary: Composite category/dimension/key-version/digest/window primary keys and expiry indexes support privacy-minimized primary-write enforcement; each upsert returns a saturated count. Purge is capped at 1,000 rows per call.
- Files/artifacts: Both database schemas, rate-limit adapters, 0007 SQL/snapshots/journals, shared counter fixture, [rate specification](../../RATE-LIMITING.md) and [03 evidence](../evidence/03-rate-limits-validation.md).
- Verification: Workerd/D1 repository suite 42 passed; isolated PostgreSQL 18.6 suite 40 passed, including fresh eight-migration install and populated upgrade. Twenty concurrent increments per dialect passed; Drizzle history and local D1 apply/no-op passed. Local D1 expiry lookup used the covering index. No remote migration or production restore.
- Decisions and deviations: [ADR 0008](../../decisions/0008-rate-limit-consistency.md) selects authoritative writes for sensitive counters. No change to accepted module 02 invariants or the suspended audit plan.
- Blockers/open questions: Physical retention requires a scheduled bounded cleanup in module 09; route/key/proxy and multi-instance acceptance remain module 03 work.
- Next actions: Keep both histories immutable and consume the storage port from authorized route owners; schedule purge under module 09 when that module starts.
- Next-session cautions: 0007 has run only against the local D1 store and isolated PostgreSQL test clusters. Preserve 0000–0006 and existing audit tables/triggers/atomic writes; do not deploy or roll back schema by dropping counters without a separate migration plan.

### 2026-09-25 — Password-pepper key-purpose migration started

- Scope and checklist IDs: Module 03.2g storage follow-up; module 02 foundation remains Complete. Extend key-purpose storage only, without starting module 04 account persistence or suspended audit work.
- Progress: The minimum-tier password mechanism needs an independent `password-pepper` key purpose. Existing 0005–0007 histories restrict `key_versions.purpose` to the original three values, so a new migration is required before real adapters can manage it.
- Change summary: Generate and inspect separate 0008 histories that widen only the key-purpose constraint while preserving existing identities, references, triggers and indexes. Verification and final artifacts follow in the checkpoint.
- Files/artifacts: This record; both schemas, 0008 migrations/snapshots and shared lifecycle tests to follow.
- Verification: Inspected current schema and migration journals. No SQL generated or applied at this checkpoint.
- Decisions and deviations: Preserve 0000–0007 immutably; the new purpose must retain the same permanent identity, backup pin and protected-record reference behavior. No audit-specific implementation or Argon2id performance work.
- Blockers/open questions: D1 requires a reviewed table rebuild for its CHECK constraint; fresh and populated upgrade behavior must pass before acceptance.
- Next actions: Generate 0008 in both dialects, inspect SQL, then run migration and repository suites.
- Next-session cautions: Never drop key/backup references or relax transition triggers to make the D1 rebuild pass.

### 2026-09-25 — Password-pepper key-purpose migration checkpoint

- Scope and checklist IDs: Module 03.2g persistence follow-up; module 02 remains Complete with its existing 02.2/02.3 outcomes unchanged.
- Progress: Added `password-pepper` to the durable key-purpose constraint in separate D1 and PostgreSQL `0008_password_pepper` histories, preserving protected-record and retained-backup references.
- Change summary: D1 rebuilds `key_versions` under deferred foreign keys, restores all three lifecycle triggers and checks the foreign-key graph; PostgreSQL replaces only the purpose CHECK. A populated 0007→0008 fixture verifies existing rows, legal new purpose, rejection of unknown purpose, protected removal and permanent identity.
- Files/artifacts: Both database `src/schema.ts` files, `0008` SQL/snapshots/journals, `tests/fixtures/key-purpose-migration.ts`, shared registry proof and both repository suites, [data model](../../DATA-MODEL.md), [migration guide](../../development/MIGRATIONS.md) and [tier evidence](../evidence/03-deployment-tier-validation.md).
- Verification: After correcting a test-clock release before backup expiry, D1/workerd repository 45/45 and isolated PostgreSQL 18.6 repository 43/43 passed; full `corepack pnpm test` passed 193. `db:check`, both typechecks, lint/boundaries, profile/fixture builds, docs build, secret scan, scoped formatting, nine-document/207-link check and scoped diff whitespace check passed. Local D1 applied 0008 and a second apply found no migrations; no remote migration or restore ran. Full-tree diff whitespace still reports unrelated existing README/VitePress edits.
- Decisions and deviations: Keep 0000–0007 immutable and use the existing key lifecycle/backup rules for pepper material. The fixture clock advanced past retention; no production guard was relaxed. No audit-specific work or Argon2id performance testing.
- Blockers/open questions: Production minimum-tier iteration policy, startup pepper provisioning and account integration belong to module 03/04; real Free-plan and independent tier acceptance are absent.
- Next actions: Consume the storage purpose only after the tier policy and owning account service are ready; continue the remaining non-audit module 03 work.
- Next-session cautions: 0008 is locally applied; preserve all 0000–0008 SQL/snapshots/journals and backup pins. Do not infer deployed migration, password-login readiness or an audit-plan resumption from repository tests.

### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: 02.2b/02.3b security migration handoff.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Committed the ordered D1/PostgreSQL security histories and adapters without rewriting applied SQL.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Remote test D1 is at 0011; local D1 has 0009–0011 pending; no persistent PostgreSQL migration URL was available.
- Next actions: Leave databases unchanged during the hold; inspect exact target state before any future migration.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.
