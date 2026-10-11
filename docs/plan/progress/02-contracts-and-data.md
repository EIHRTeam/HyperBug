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
- Last updated: 2026-10-03 (Module 07 scanner-hook integration follow-up).
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


### 2026-10-03 — Module 07 dependency follow-up

- Scope and checklist IDs: Module 07 additive projection persistence and public DTOs; no additional owning-module checklist item claimed.
- Progress: D1 0018/PostgreSQL 0017 add nullable text/version columns; issue/comment writes atomically project text and explicit project-local CAS backfill handles old rows. Fresh/upgrade/rejected-upgrade and concurrent body-write preservation pass. Rendered artifacts are never persisted.
- Change summary: Supports the authorized Module 07 batch; [full handoff](07-content-and-attachments.md) and [verification evidence](../evidence/07-content-validation.md).
- Files/artifacts: Affected package/fixture paths are inventoried in the linked Module 07 record; no older migration or protected SECURITY.md change.
- Verification: Local unit 199, contract 1, Node 50, workerd/D1 143, PostgreSQL 18.6 82 tests passed; typecheck/lint/format/build/database/docs/license/secret checks passed. Local/emulated storage only; no deployment or remote migration.
- Decisions and deviations: Owning-module status/gates and audit holds remain unchanged; no SPA or Module 09 expansion.
- Blockers/open questions: Module 07's V7 policy-upgrade fixture and forms/storage acceptance remain with Module 07.
- Next actions: Continue the authorized Module 07 goal; no unrelated feature work starts from this follow-up.
- Next-session cautions: All changes remain uncommitted; preserve the protected draft and prior edits, suspended audits, existing migration history and initially clean module-03 measurement snapshots.

### 2026-10-03 — Module 07 form/template integration dependency checkpoint

- Scope and checklist IDs: Dependency impact of 07.2a and non-audit form management/submission; no owning-module gate/checklist change.
- Progress/change summary: Shared contracts and both production roots compose immutable content stores, bounded management/history routes and atomic structured issue creation. Added `content:manage` and read-only `content:history` permission rules; existing issue/auth/admission behavior passes the complete regression matrix. New migrations preserve history; no older migration or audit behavior changed.
- Files/artifacts: Owning changes and detailed decisions are inventoried in [Module 07 progress](07-content-and-attachments.md), [specification](../../ISSUE-FORMS.md) and [validation evidence](../evidence/07-content-validation.md).
- Verification: 499 tests passed (unit/contract 204, Node 50, workerd 155, PostgreSQL 18.6 90); typecheck/lint/build/db/docs/license/secret checks passed. This is local runtime/database evidence; no remote migration or deployment.
- Decisions/blockers: Attachment integration remains with Module 07; audit suspension and Module 09/SPA holds remain. G1 stays closed. See the linked record for the detected and corrected PostgreSQL project/receipt lock-order deadlock.
- Next actions/cautions: Continue only the authorized Module 07 goal. Preserve all uncommitted changes and protected SECURITY.md; never resume suspended audit via this dependency record.

### 2026-10-03 — Module 07 storage port and migration-fixture checkpoint

- Scope and checklist IDs: Dependency impact of 07.3a; no new migration or Module 02 gate change.
- Progress/change summary: Added runtime-neutral BlobStore/authorization ports with SDK-free application types. Template upgrade seeding now selects D1 `0019_template_versions` / PostgreSQL `0018_template_versions` by explicit migration name instead of position; appending a future attachment migration cannot silently reseed the wrong schema.
- Files/artifacts: Application port and the two repository fixture loops; owning [Module 07 handoff](07-content-and-attachments.md) and [storage evidence](../evidence/07-storage-validation.md).
- Verification: Both populated/fresh upgrade and repository suites passed in the 509-test full matrix (D1/workerd 156 and PostgreSQL 18.6 90), plus db:check/type/lint/build/docs/format checks. No database schema/old migration changed or remote migration applied.
- Decisions/blockers: Existing upload-intent/attachment scaffold still needs lifecycle/quota/draft-association expansion before integration. R2 signing/CORS evidence belongs to Module 07; audit and Module 09 holds remain.
- Next actions/cautions: Read the explicit target constraints and define migration invariants before the next 07.3 batch. Keep historical migrations intact, named template upgrade tests and protected SECURITY.md. Generated Module 03 measurements were restored after tests finished.

### 2026-10-03 — Module 07 actual storage and promotion checkpoint

- Scope and checklist IDs: Dependency verification of 07.3i/V3; no owning-module gate/checklist change.
- Progress/change summary: Actual R2 S3/signing/CORS, native local workerd/remote R2 promotion/signing and real local SeaweedFS promotion pass; the shared adapter normalizes quoted S3 part ETags for native R2 completion. Details and private configuration boundaries are in [Module 07 progress](07-content-and-attachments.md) and [storage evidence](../evidence/07-storage-validation.md).
- Files/artifacts: Owning blob adapter/promotion/fixture/command/specification inventory in Module 07; no migration or product deployment in this batch.
- Verification: Current full matrix 517 passed (unit/contract 209, Node 61, workerd/D1 157, real local PostgreSQL 18.6 90); typecheck/lint/db/docs/license/secret/read-only format passed. Provider checks remain distinct from emulator and product deployment evidence.
- Decisions/blockers: R2 signing-credential blocker resolved privately; public attachment lifecycle remains Module 07 work. Audit/SPA/Module 09 holds and G1 remain unchanged.
- Next actions/cautions: Continue only authorized Module 07 persistence/integration; preserve uncommitted work, historical migrations and protected SECURITY.md. No capability or credential in tracked evidence.

### 2026-10-03 — Module 07 upload lifecycle dependency checkpoint

- Scope and checklist IDs: Module 07.3b/07.3e persistence and contracts; Module 02 remains Complete.
- Progress: Independent dependency work verified; [Module 07 checkpoint](07-content-and-attachments.md) owns lifecycle acceptance.
- Change summary: Additive D1 0020 / PostgreSQL 0019 details/usage tables preserve historical uploads and seed their reserved/used counters. Both stores enforce atomic quota/pending-slot reservations, current object/project permissions, fenced verification accounting and one-time physical-cleanup release. Closed public upload DTOs/routes keep infrastructure and capability internals private.
- Files/artifacts: Relevant roots/build/manifests, application/contracts/server/database/comment adapters and fixtures; [lifecycle specification](../../ATTACHMENT-LIFECYCLE.md) and [evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final current-tree matrix **541 passed** (unit/contract 209; Node 57 with 9 explicit provider skips; workerd/D1 172; isolated real local PostgreSQL 18.6 103). Typecheck/lint/db history/docs/secrets/licenses/frozen install/format passed; final build details in linked evidence. Existing actual-provider compatibility reused; no deployed lifecycle or scan result claimed.
- Decisions and deviations: ADR 0011; scope remains Module 07 with no suspended audit or Module 09/SPA expansion.
- Blockers/open questions: Multipart/scan/release/content linking/delivery/full cleanup and held dispatch remain with Module 07; no new prerequisite gate opened.
- Next actions: Continue 07.3c multipart intent/capability orchestration, then 07.3d/f–h and attachment-aware 07.2; preserve existing module status/gates.
- Next-session cautions: No commits; protected SECURITY.md and private credentials remain untouched. New migrations append to history. Legacy intents retain quota pending explicit reconciliation; unrelated regenerated Module 03 measurements were restored.

### 2026-10-03 — Module 07 multipart lifecycle integration

- Scope and checklist IDs: Module 07 multipart persistence/contracts; Module 02 foundation acceptance unchanged.
- Progress: Additive D1 0021 / PostgreSQL 0020, shared multipart transition/receipt contracts and both-profile persistence acceptance passed.
- Change summary: Same-project session rows are atomic with reservation; catalog/intent/lease writes are atomic with authorization/revision fences. Explicit provider-ID/state, bounded array, revision and foreign-project constraints preserve fail-closed persistence. Direct/legacy rows and counters survive upgrades.
- Files/artifacts: Both database schemas/stores/new migration snapshots/journals, multipart application/contracts, shared multipart/migration fixtures and fresh-runner expectations; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Complete final matrix 569 passed; 185 workerd/D1 and 115 real isolated local PostgreSQL 18.6 include repository, physical constraints, fresh and populated upgrade, concurrency, authorization and rollback. Fresh PostgreSQL runner verifies 21 migrations / 46 tables. `pnpm db:check`, typecheck and lint passed.
- Decisions and deviations: Existing D1 guarded-batch and PostgreSQL project-first transaction mechanisms reused; providers remain outside transactions. Only newly authored uncommitted multipart migration definitions were refined before shared deployment; older migration history untouched.
- Blockers/open questions: Unknown provider creation lacks discovery/reconciliation and must retain reserved quota. No migration was applied to shared/cloud databases.
- Next actions: 07.3f scanner/result policy, 07.2b–d atomic attachment consumption, 07.3h bounded cleanup/reconciliation.
- Next-session cautions: Keep D1/PostgreSQL parity and prior rows/counters. Do not clear ambiguous reservations or create a second unknown provider session. No commit; protected SECURITY.md/private credentials remain untouched.

### 2026-10-03 — Module 07 scanner hook integration

- Scope and checklist IDs: Additive Module 07 scan-result persistence and contracts; foundation acceptance unchanged.
- Progress: Core hooks/persistence/guard behavior locally verified; 07.3f actual scanner acceptance remains incomplete.
- Change summary: D1 0022/PostgreSQL 0021 add latest operational results, ready/result/identity/final-binding guards and legacy unproven-label quarantine, preserving immutable identity and used quota. No audit history or older migration rewrite.
- Files/artifacts: Both schemas/stores/new histories, shared scan/upgrade fixtures and contracts; lifecycle evidence. [Detailed validation](../evidence/07-upload-lifecycle-validation.md).
- Verification: Composed regression **598 passed**: 209 unit/contract, 70 Node (9 optional-provider skips), final 195 workerd/D1/R2 emulation and 124 real isolated local PostgreSQL 18.6 with S3 emulation. Scanner verdicts are synthetic. Typecheck/lint/db:check/build/docs/format/secrets/links passed. Initial D1 count failure and corrected-lane commands are recorded in the linked evidence.
- Decisions and deviations: ADR 0011 scanner/result refinement; no provider adapter or dependency change, no audit/Module 09/SPA expansion. Fresh/upgrade preservation verified; only new uncommitted migrations refined before shared deployment.
- Blockers/open questions: Actual scanner/plugin/service/result integration is absent. Module 07 cleanup/discovery, isolated delivery, consumption, production CORS and deployment acceptance remain open.
- Next actions: 07.3f actual scanner evidence; independent 07.3h cleanup/reconciliation and 07.3g delivery; 07.2b–d accepted-state consumption.
- Next-session cautions: No commit/cloud mutation or actual malware-detection claim. Preserve all prior work, protected SECURITY.md/private credentials and old histories. Used quota and held policy are retained until verified physical cleanup.

### 2026-10-04 — Module 07 bounded upload cleanup repository port

- Scope and checklist IDs: Module 07 partial 07.3c/07.3h; existing module acceptance/holds unchanged.
- Progress/change summary: Added exact-origin CORS preparation/snapshot checking and bounded internal project-local cleanup selection/execution, plus fenced synthetic trusted reconciliation. Both database adapters preserve shared semantics; no migration, provider adapter or dependency changed.
- Files/artifacts: Application upload ports, both upload stores, `tooling/upload-cors.ts`, focused fixtures and [lifecycle evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Full `pnpm test` **609 passed / 9 optional-provider skips** (211 unit/contract, 71 Node, 199 workerd/D1/R2 emulation, 128 real isolated PostgreSQL 18.6 with S3 emulation). Focused dual-store 5 each, unit/Node 11 and six local CLI commands pass; typecheck/lint/db/docs/links pass. Scanner/reconciler callbacks remain synthetic; prior provider acceptance reused.
- Decisions/blockers: No actual scanner, deployed CORS or provider discovery is inferred. Complete cleanup and isolated delivery/consumption remain Module 07 work; scheduling/audit/SPA remain held.
- Next actions: 07.3h actual exact-key discovery adapter evidence, then 07.3g/07.2b–d.
- Next-session cautions: No commit/deployment; preserve older migrations, all prior work, protected SECURITY.md and private credentials.

### 2026-10-04 — Module 07 actual discovery checkpoint handoff

- Scope and checklist IDs: Partial 07.3h; existing owning-module checklist/gates unchanged.
- Progress/change summary: Node upload composition supplies bounded exact-key S3 multipart reconciliation; native Workers remains fail-closed without a discovery adapter. Shared D1/PostgreSQL cleanup/accounting behavior is unchanged from the preceding verified port batch. No migration, dependency or held dispatcher added.
- Files/artifacts: blob-s3 discovery helper/factory, Node upload root, actual-provider/negative fixtures, lifecycle/storage evidence.
- Verification: Final default `pnpm test` **612 passed / 11 optional-provider skips** (214 unit/contract, 71 Node, 199 workerd/D1, 128 real PostgreSQL 18.6). Separate actual R2 S3 and real SeaweedFS discovery **2 passed / 11 filtered skips**; **614 distinct passing checks** composed, with nine other provider checks retaining earlier unchanged acceptance. Final sequential types/lint/build/docs/format/secrets/whitespace pass; initial lint/unit-fixture overlap resolved.
- Decisions/blockers: Complete exact-key pagination/abort/post-abort absence is required; observed SeaweedFS upload-only continuation is preserved without inventing markers. Native Workers composition/full used-file cleanup, actual scanner, delivery/consumption and deployment CORS remain incomplete.
- Next actions: 07.3g/07.2b–d and 07.3h native discovery/full cleanup; actual scanner acceptance remains 07.3f.
- Next-session cautions: No commit/deployment; protected SECURITY.md unchanged, old histories and private credentials preserved. No Module 09/SPA/audit expansion.

### 2026-10-04 — Module 07 atomic form attachment consumption

- Scope and checklist IDs: Module 07 07.2b–d/V2; existing persistence acceptance unchanged.
- Progress/change summary: Existing attachments schema now supports atomic one-use form upload consumption with issue/provenance/number/timeline/outbox/receipt. Up to 32 files, same owner/project/draft, immutable finalized/used/current-clean-ready identity and field extensions are enforced on both dialects. Association promotes to the created issue, revision bumps, used accounting persists; stale processing inputs cannot replace persisted authorization targets.
- Files/artifacts: Both issue/upload repositories and new form attachment helpers, application/public contract, shared/HTTP/forced-D1-race fixtures, DATA-MODEL and [owning evidence](../evidence/07-upload-lifecycle-validation.md). No schema migration or dependency change.
- Verification: Final full default matrix **646 passed / 11 optional-provider skips** (214 unit/contract, 71 Node, 218 workerd/D1, 143 real PostgreSQL 18.6). Focus D1 27/PostgreSQL 20; hidden-parent corrected focus 1 each. Maximum 32 links, concurrent identical/fresh-key reuse, mid-batch rollback, D1 post-pre-read changes and unchanged used quota verified. Initial fixture/authorization failures are recorded; synthetic scan results do not prove malware detection. Earlier migration/provider evidence reused unchanged.
- Decisions/blockers: Project-first PostgreSQL intent/detail/result locks; D1 scalar NOT NULL witnesses prevent silent zero-row inserts. Actual scanner, isolated delivery and complete cleanup/deployment acceptance remain Module 07 work.
- Next actions: 07.3g and remaining 07.3h/07.3c/07.3f; no held dispatcher or audit.
- Next-session cautions: No commit/deploy; preserve old histories, prior work, protected SECURITY.md and private credentials. Initially clean generated Module 03 measurements restored after tests.

### 2026-10-04 — Authorized media and HTTPS checkpoint

- Scope/checklist IDs: Module 07 07.3g/V5 accepted at backend/local transport scope; this module's existing gates/status remain unchanged.
- Progress/change summary: Existing-schema dual attachment reads preserve project/intent scoping and bounded operational scan/details. Shared media/error contracts expose no storage or scanner identity; no migration or persistent-data change.
- Files/artifacts: dual attachment adapters, application/server error/read contracts and DATA-MODEL; [owning evidence](../evidence/07-upload-lifecycle-validation.md).
- Verification: Final complete default matrix **673 passed / 11 optional-provider skips**: 236 unit/contract, 76 Node, 218 workerd/D1/R2 emulation, 143 real isolated PostgreSQL 18.6/S3 emulation. Focused media unit 22, TLS Node 5 and HTTP 1 per profile. Node media uses certificate-verified local native HTTPS with virtual Host; Workers uses canonical edge URL through workerd emulation. Types/lint/boundaries/build/docs/secrets passed. Provider/migration/dependency evidence reused unchanged; full final handoff checks are in Module 07.
- Decisions/blockers: Current attachment/scan/association and bearer/principal/membership/parent state are rechecked after acquiring storage; held streams are canceled on denial. Actual scanner, installed production CORS/browser evidence and full cleanup/native discovery remain incomplete. No new audit, dispatcher or SPA.
- Next actions: 07.3h/V4 native discovery and explicit used-file/legacy/retention cleanup; 07.3c production selection and 07.3f trusted actual scanner when available.
- Cautions: All work uncommitted; no deployment. Preserve earlier work, historical migrations and protected SECURITY.md. Synthetic clean results never prove malware detection. Generated Module 03 measurements restored after runtime processes ended.


### 2026-10-04 — Module 07 shared/native reconciliation checkpoint

- Scope/checklist IDs: Module 07 partial 07.3h/07.V4; shared internal ports and dual-profile consistency only, existing owning-module acceptance/gates unchanged.
- Progress/change summary: Shared application exact-key/page/ID/deadline/abort/absence policy now serves both selected storage roots; Workers uses bounded header-signed R2 S3 discovery beside native CRUD. No schema/migration/dependency/public-contract change.
- Files/artifacts: Application/blob reconciliation, Workers upload root and native/provider fixtures; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md#native-reconciliation-final-regression).
- Verification: Final default matrix **703 passed / 11 optional-provider skips**: 266 unit/contract, 76 Node, 218 workerd/D1/R2 emulation, 143 real isolated PostgreSQL 18.6/S3 emulation. Related actual R2 S3 + real local SeaweedFS **2 passed**; native local workerd/actual remote R2 **1 passed**. Types/lint/boundaries/build/docs pass; final ancillary in Module 07. Unchanged migration/provider CRUD/signing/promotion evidence reused.
- Decisions/blockers: Manual mode/all-3xx refusal works around native Request redirect error/docs mismatch. Full used-unlinked/legacy/retention cleanup, actual scanner and production installed/browser CORS remain Module 07 work; no scheduler/audit/SPA expansion.
- Next actions/cautions: Continue 07.3h/V4 explicit-policy cleanup. No commit/deployment; preserve earlier changes, historical migrations and protected SECURITY.md. Synthetic scans prove guards only. Generated Module 03 measurements restored after the matrix ended.


### 2026-10-04 — Module 07 verified-unlinked cleanup checkpoint

- Scope/checklist IDs: Module 07 partial 07.3h/07.V4; dual-store retirement and used-byte accounting, existing owning-module acceptance/gates unchanged.
- Progress/change summary: Required-retention orphan ports/handlers, atomic attachment absence/lease retirement and physical-absence used-byte release on both stores. Finalized immutable identity/guards and late-write tombstones preserved. No schema/migration/dependency/public-route change.
- Files/artifacts: Application/database upload ports, shared/forced race fixture and two typed Node stubs; [Module 07 evidence](../evidence/07-upload-lifecycle-validation.md#verified-unlinked-cleanup-final-regression).
- Verification: Full default **723 passed / 11 optional-provider skips**: 266 unit/contract, 76 Node, 229 workerd/D1/R2 emulation, 152 real isolated PostgreSQL 18.6/S3 emulation. Focus D1 12/PostgreSQL 10 included. Types/lint/boundaries/build/docs passed; final ancillary in Module 07. Blob/scan callbacks are synthetic; actual provider/migration/dependency evidence reused unchanged.
- Decisions/blockers: Do not weaken finalized identity guards to expire retired records; deleted policy/released counters express retirement. Legacy reconciliation/adoption, tombstone retention/compaction and storage deadlines remain Module 07 work, alongside actual scanner and production CORS evidence.
- Next actions/cautions: Continue 07.3h/V4; no commit/deploy/SPA/Module 09/audit. Preserve earlier work, old histories and protected SECURITY.md. Generated Module 03 measurements restored after tests ended.

### 2026-10-04 — Module 07 cleanup wait and non-destructive legacy inventory checkpoint

- Scope and checklist IDs: Module 07 partial 07.3h/V4; internal read-only inventory and application wait bounds, owning data acceptance/gates unchanged.
- Progress and change summary: Existing unique project/ID index limits 20+1 base records before lifecycle/attachment classification on both stores. Empty current-only pages advance. Legacy keys, every state, links and backfilled counters remain untouched; no adoption, storage I/O, schema/migration or public API change. Shared cleanup wait budgets retain fencing and quota on timeout.
- Files/artifacts: Application and dual-database inventory DTO/query/page/export, shared repository fixture/wiring, lifecycle/model and plan/evidence/progress. [Owning acceptance](../evidence/07-upload-lifecycle-validation.md#bounded-legacy-inventory-2026-10-04).
- Verification: Shared focused inventory **5 D1/workerd / 5 real isolated PostgreSQL 18.6**, including actual query plans and unchanged 16 reserved/3 used bytes. Final default **754 passed / 11 optional-provider skips** (287 unit/contracts, 76 Node, 234 workerd/D1/R2 emulation, 157 real isolated PostgreSQL/S3 emulation). Types/lint/boundaries/build/docs passed; final ancillary in Module 07. Existing fresh/upgrade migrations and actual provider proofs reused unchanged; scanner verdicts in default database fixtures remain synthetic.
- Decisions and deviations: Missing lifecycle metadata is a recovery classification, never proof of backend ownership or permission to release quota. Corrected UUID initial bound and actual moderation column in failed focus before acceptance. PostgreSQL physical scan strategy remains planner-dependent; actual base Limit is 21 rows.
- Blockers and next actions: Explicit per-record legacy ownership/accounting/association adoption or physical recovery and retained-key compaction; actual both-profile scanner adapter/result acceptance; production CORS configuration/evidence. Local actual engine/signatures now verified separately, with no application data release.
- Next-session cautions: No migration history rewrite, implicit destructive default, commit/deploy/SPA/Module 09/audit. All runtime handles terminal; generated Module 03 measurements restored. Preserve all earlier work and protected SECURITY.md.

### 2026-10-04 — Actual scanner durable identity and authorization checkpoint

- Scope/checklist IDs: Module 07 partial 07.3f and investigation of 07.3h/V4 recovery; owning persistence/public-contract gates unchanged.
- Progress/change summary: Actual signed ClamAV pipeline fixtures now verify existing D1/PostgreSQL immutable scan/result/separate-release stores. Principal suspension/project archival before commit or after durable clean commit hold content; both counters retain actual used bytes. No schema, adapter, migration/history or public contract change.
- Files/artifacts: Shared scanner pipeline fixture, native workerd test bundle and explicit actual lane; internal closed service protocol, lifecycle/ADR/plan/evidence. [Exact environment/results](../evidence/07-scanner-environment-validation.md#trusted-transport-and-actual-durable-pipeline).
- Verification: Actual durable focus **18 passed / no skips** (nine real isolated PostgreSQL 18.6/S3-emulated, nine workerd/D1/R2-emulated/private Node callback), included in complete actual **33 passed / no skips** lane. Full default **795 passed / 11 optional-provider skips** (314 unit/contracts, 89 Node, 235 workerd, 157 PostgreSQL). Types/lint/boundaries/build passed; existing fresh/upgrade migration and actual storage-provider evidence reused unchanged. Ancillary in Module 07.
- Decisions/blockers: Result identity/evidence never rewrites finalized bytes; failed/infected/partial/timeout keep used quota. Native callback is local actual-engine transport, not deployment. Legacy inventory permits arbitrary historical keys while ordinary BlobStore enforces Core-generated keys: a separate per-record trusted recovery port needs exact snapshot/provider ownership/accounting provenance and explicit retention; fabricating lifecycle/association fields or relaxing normal keys is unsafe. Retained-key erasure needs quiescence evidence beyond caller timeout.
- Next actions/cautions: Continue 07.3h/V4 recovery/retained-key compaction; production scanner/CORS acceptance remains open. No new migration selected, implicit destructive cleanup, commit/deploy/SPA/Module 09/audit. Keep linked parents, historical accounting, all prior work and protected SECURITY.md intact. All runtime/test processes terminal; generated measurements restored.


### 2026-10-04 — Module 07 explicit legacy recovery ledger checkpoint

- Scope/checklist IDs: Partial 07.3h/07.V4. Additive exact legacy retirement/accounting ledger, reviewed guards and populated migration preservation; owning data/public-contract gates unchanged.
- Progress/change summary: Exact snapshots, explicit retention, trusted ownership/accounting references, atomic absence of every attachment/lifecycle row, immutable retirement keys/decisions and fenced once-only both-counter release. Fixed 20+1 base windows advance over live leases; timeouts retain quota and stop pages. No actual provider recovery/adoption/compaction or public API/scheduler.
- Files/artifacts: Application recovery port/handler, both stores/schema/exports, D1 0023/PostgreSQL 0022 SQL/snapshots/journals and custom guards; shared/forced race/upgrade and unit page fixtures; [owning evidence](../evidence/07-upload-lifecycle-validation.md#explicit-legacy-recovery-ledger-2026-10-04).
- Verification: Focus 19/profile plus 4 unit passed; expanded existing fresh+ledger focus 20/profile passed after schema assertions updated. Composed default **837 passed / 11 optional-provider skips**: 318 unit/contracts, 89 Node/S3 emulation, 254 workerd/D1/R2 emulation, 176 real isolated PostgreSQL 18.6/S3 emulation. Final actual signed ClamAV pipeline **18 passed / no skips**; unchanged actual adapter 15 reused, composed 33 actual. Types/lint/build/history checks passed; 45 prior SQL checksums unchanged. Final ancillary in Module 07.
- Decisions/review: Forced D1 pre-read/CAS link and PostgreSQL project-lock waiting insert prove retirement exclusion. PostgreSQL TRUNCATE now preserves ledger targets. Missing/insufficient accounting rolls back both counters/retirement. Earlier sync-validation/type/fresh-count failures corrected before final acceptance. Recovery manifests/provider callbacks remain synthetic; ordinary key/scan/association policy stays strict.
- Blockers/next actions: Real selected-provider arbitrary-key recovery/manifests/absence and retained-key compaction/quiescence; production scanner/CORS acceptance. Authorized test deployment/browser CORS work remains within the existing 07.3c/V4 plan and named infrastructure; no full checkbox closes.
- Next-session cautions: No commit/SPA/Module 09/suspended audit or shared migration rollout. Preserve prior work/histories, protected SECURITY.md and scanner/updater snapshot separation. Runtime matrix/scanner handles terminal; generated Module 03 measurements byte-restored. Deployment resources/cleanup are tracked in the owning Module 07 record.


### 2026-10-04 — Module 07 authorized test-D1 forward-rollout preparation

- Scope/checklist IDs: Existing Module 07 **07.3c** deployed upload/CORS acceptance, using the user-authorized account/domain/named D1; no new schema design, Module 02 gate or service boundary.
- Progress/change summary: Remote `hyperbug-test-1` at applied **0000–0014**, 42 tables/15 triggers, zero upload/attachment/content rows, one retained project/two principals/nine removed key records. Exact pending **0015–0023** source hashes captured; private full export **83,239 bytes** retained mode 0600. Actual backup restored and upgraded locally in SQLite **3.50.4**, preserving project/principal/key records and foreign-key consistency. Current API/ingress dry-runs pass using private secret files and existing R2/D1 bindings, no cron.
- Files/artifacts: Ignored `.local/07-deployed-cors/` backup/receipts/schema/state/local-upgrade/config/logs; no migration/source history change.
- Verification: Remote read/export and local backup restore/upgrade pass; remote forward apply and deployed journey pending. Existing local D1/PostgreSQL fresh/upgrade/contract evidence reused at recorded scope; no remote restore or operational recovery claim.
- Decisions/blockers/next actions: Apply only nine reviewed pending forward files, verify retained rows/current schema/foreign keys and explicit migration receipts, then planned deployed capability/exact-CORS/browser test. Preserve append-only audit and removed key history. Deployment-only authorization does not weaken API/authorization/scanner policy. No commit/SPA/Module 09/audit/boundary expansion; protected SECURITY.md unchanged.

### 2026-10-04 — Authorized test-D1 forward migration and fixture cleanup verified

- Scope/progress: Existing Module 07 **07.3c/07.V4** deployed upload proof; no schema redesign or Module 02 gate change. Actual named test-D1 **0015–0023** forward apply succeeded after local SQLite 3.50.4 backup restore/upgrade. Final **24 migrations/52 tables/35 triggers**, zero foreign-key violations; prior project/two principals/nine removed-key rows and prior token rows unchanged.
- Files/artifacts: Private mode-0600 83,239-byte pre-migration export, source hashes and migration/preservation/fixture/cleanup receipts under ignored `.local/07-deployed-cors/`; [owning evidence](../evidence/07-upload-lifecycle-validation.md#deployed-workers-upload-and-cors-2026-10-04). Historical migration SQL remains unchanged.
- Verification: Actual deployed D1 reserved four owned intents/28 reserved bytes; no scan/finalization claimed. After token revocation, issuer removal, settled browser requests, all four capabilities' real 403 expiry and exact provider absence, four intents/details, two usage rows, two owned counters and five fixture rows removed. Owned token key transitioned current→revoked→removed; one permanent identity remains. No append-only/audit records deleted. Latest composed default **897/18** retains both-profile regression/upgrade evidence; ancillary in 07.
- Decisions/blockers/next: Remote forward rollout is actual test-service evidence, while backup restore is local and historical operational recovery remains unclaimed. Corresponding Node/S3 browser, operational ownership/accounting/quiescence and production scanner isolation remain **07.3c/07.3h/V4/07.3f** blockers. Preserve backup/tombstone/original rows/draft; no rollback of applied history, seed replay, commit, SPA, Module 09 or suspended audit/boundary expansion.

### 2026-10-05 — Review remediation B3 verified

- Scope and checklist IDs: 02.1a/b, 02.2a/b/c, 02.3a/b/c (post-completion B3).
- Progress: B3 complete locally; overall mission continues at B4. Existing module status/checklists and G1/G2/13.G6 are unchanged.
- Change summary: Added paired instance-role/credential-ceremony mappings, migrations and fresh/upgrade/concurrency contracts.
- Files/artifacts: Owning stores/routes/schema/tests and specifications listed in the [cross-module remediation record](../evidence/2026-10-05-review-remediation.md#b3-instance-roles-and-token-bound-assurance-2026-10-05). D1 0024/0025; PostgreSQL 0023/0024.
- Verification: Final local matrix **916 passed / 18 optional-provider skips** (349 unit, 1 contract, 121 Node, 262 workerd/D1 emulation, 183 real isolated PostgreSQL 18.6). Typecheck, lint, Drizzle check (old timestamp warnings), docs build, tracked/new-source formatting and diff checks pass. Root formatting flags only supplied untracked review files; reports untouched. No actual deployment/provider claim. Initial wiring/schema/fixture failures and focused primary-agent security review are recorded in the linked evidence.
- Decisions and deviations: Independent instance role and immutable presented-credential facts; configured default 300 s replaces hardcoded 900 s. No policy weakening, new protocol or new ADR required for B3; formal Minimum ADR remains B8.
- Blockers/open questions: None for B3. Independent Sonnet review unavailable (model not callable); no independent review claimed. Atomic account/role/plugin audit remains B4.
- Next actions: B4 audit transaction/failure cases, recovery-code step-up and passkey CAPTCHA forwarding, then B5–B15 in the approved order.
- Next-session cautions: Never stage SECURITY.md or supplied reviews; preserve historical migration/audit rows, apply schema before adapters, inspect upgrade role recipient, and require new passkey login for old tokens. No SPA or later-module audit resume.

### 2026-10-05 — Review remediation B4 accepted locally

- Scope/checklist IDs: Approved B4 post-completion correction to 04.1c/d, 04.2f, 04.3c/V5 and 05.2a/05.3d, with data/security/acceptance dependencies. No later-module audit or gate expansion.
- Progress/change summary: Prepared neutral audit port; atomic both-store account/role/plugin/recovery/enrollment writes, conditional denial guards, one bounded settings transaction and atomic uninstall cleanup. Recovery generation checks immutable ceremony freshness; passkey CAPTCHA admission precedes challenge consumption. B3 last-administrator serialization retained.
- Files/artifacts: [Detailed B4 record](../evidence/2026-10-05-review-remediation.md#b4-atomic-administration-audit-recovery-freshness-and-passkey-captcha-2026-10-05), application ports, both adapters/server, shared rollback/stale and configured-CAPTCHA fixtures, contracts/specifications and paired reader guides.
- Verification: Focused affected D1/workerd **10 passed** and real isolated PostgreSQL **18.6 13 passed**, no skips. Typecheck/lint/boundaries/scoped format/diff, documentation/all runtime builds and credential-signature scan pass; local Minimum journey adds 7 passes; broad unchanged lanes intentionally not repeated under the user's “Test less, write more” preference. Actual duplicate-audit failures roll back every listed mutation; stale generation preserves codes. Initial fixture errors corrected. Primary focused review recorded; no Sonnet or independent-review claim.
- Decisions/blockers: No schema/deployment/provider change or B4 blocker. Standalone session/link/redeem events retain their prior path; later audit remains suspended. G1/G2 closed, 13.G6 open.
- Next actions/cautions: Commit B4, then B5 conditional session renewal and B6–B15. Keep primary validation/revocation, atomic audit, last-admin locks and required UV/CAPTCHA. Preserve protected files, old SQL/audit history and test measurement artifacts.

### 2026-10-05 — Review remediation B5 conditional session renewal

- Scope/checklist IDs: Approved B5 correction to 04.2c with 02 session-port and 10 acceptance dependencies.
- Progress/change summary: Primary session load now includes kind/idle expiry; requests validate current state and digest every time, renew only when due (User five minutes, Staff three minutes), and avoid writes when absolute expiry prevents growth. Conditional SQL and original ceremony facts remain unchanged.
- Files/artifacts: [B5 record](../evidence/2026-10-05-review-remediation.md#b5-conditional-session-renewal-2026-10-05), application/D1/PostgreSQL/server session files, shared actual-adapter renewal contract, AUTH-FLOWS and paired reader guides.
- Verification: Focused D1/workerd **4 passed**, real isolated PostgreSQL 18.6 **5 passed**, no skips; final changed renewal contract rerun on both stores. Covers intervals, near-idle/absolute expiry, concurrent tabs and immediate logout/owned revocation/credential revision rejection. Typecheck/lint/boundaries/scoped formatting/diff and documentation build pass. Broad unchanged tests omitted per user direction.
- Decisions/blockers: No schema/deployment/crypto change or blocker. Concurrent due observations may each perform a safe conditional renewal; no global cache. Existing 30-minute/seven-day issuance retained, and the misleading shorter-Staff-lifetime documentation claim corrected. Gates unchanged.
- Next actions/cautions: Commit B5, then B6 request-scoped authorization facts reuse and measured read-query counts. Preserve primary validation, recent-authentication timestamp, monotonic expiry and revocation semantics; never stage protected files.

### 2026-10-05 — Review remediation B8 formal Minimum profile

- Scope/checklist IDs: Approved B8 to 03 tier/crypto/admission, 04 account journeys, 10/13 profile gates, with 01 composition and 02 contracts dependencies.
- Progress/change summary: ADR 0012 supersedes old floor/gate exclusions; canonical tier/new acknowledgement, public peppered PBKDF2 passwords with bounded strength policy, durable login lockout/CAPTCHA, standard Argon2id upgrades and sensitive-route-only activation. Separate Minimum entry omits Wasm. Bilingual disclosures and active plans synchronized.
- Files/artifacts: [B8 evidence](../evidence/2026-10-05-review-remediation.md#b8-formal-cloudflare-minimum-profile-2026-10-05), ADR 0012, roots/config/security/server/contracts/builds and focused fixtures; no database migration.
- Verification: Selected config/audit/provider/activation 36, Minimum journey 7, real PostgreSQL 18.6 account/upgrade journey 1 and final admission 19 passed; typecheck/lint/boundaries/docs pass. Bundle and denylist sizes recorded, initial fixture failures corrected. Local evidence only, no Argon2id performance or independent review claim.
- Decisions/blockers: Authorized Minimum-only offline-strength deviation disclosed; historical v1 audit rows preserved. G1/G2 now require all three profiles and stay closed; additional real-Free 13.G6 open. Actual CPU/startup remains B15.
- Next actions/cautions: Commit B8 then B9 risk-tiered limits. Preserve scoped key/concurrency bounds, one-use permits, stronger-hash refusal, expected credential revision, append-only histories, protected files and remaining holds.

### 2026-10-05 — Review remediation B11 bounded expired cleanup

- Scope/checklist IDs: Approved B11, partial 09.3d and dependent data/security/account/acceptance retention.
- Progress/change summary: Fixed indexed cleanup of expired credentials/receipts/counters and D1 lockouts on existing schedulers; 25 rows/target, eight D1/seven PG statements. Audit and history preserved.
- Files/artifacts: [B11 record](../evidence/2026-10-05-review-remediation.md#b11-bounded-expired-cleanup-2026-10-05), application/adapters/roots, D1 0026/PG 0025 indexes/snapshots and DATA-MODEL/MIGRATIONS.
- Verification: Focused D1 1, PostgreSQL 18.6 1 and Node scheduler 2 pass; typecheck/lint/boundaries/db history checks pass. Initial fixture/generation issues corrected in linked record.
- Decisions/blockers: Credential/challenge post-expiry retention uses configured default one day; other records stored expiry. 09.3d remains partial; sustained/deployed retention and broader module scope open. Gates unchanged.
- Next actions/cautions: Commit B11 then B12 unkeyed receipts; preserve old SQL/snapshots/audit and protected drafts. No queue/workflow or blob cleanup expansion.

### 2026-10-05 — Review remediation B12 one-shot receipts

- Scope/checklist IDs: Approved B12, 06.2c non-audit/V3 and dependent data/acceptance contracts.
- Progress/change summary: Explicit unkeyed issue/comment intents skip receipts; keyed replay remains 24 hours. D1 captures committed result within batch; comment last-mutation witness fences edit history.
- Files/artifacts: [B12 record](../evidence/2026-10-05-review-remediation.md#b12-one-shot-mutation-receipts-2026-10-05), identity/intents/adapters, D1 0027/PG 0026 and specs.
- Verification: Focused D1/workerd 4 and PostgreSQL 18.6 4 pass, including three-statement reductions and concurrent losers/keyed replay; types/lint/boundaries/docs pass. Broad matrix B15.
- Decisions/blockers: No gate or suspended-audit closure; nullable column leaves history unchanged.
- Next actions/cautions: Commit B12 then B13; migrate before adapters, preserve atomic side records, protected drafts and old SQL.

### 2026-10-05 — Review remediation B15 measurements and cleanup

- Scope and checklist IDs: Approved B11/B12 migration and B15 preservation evidence; no new module/gate completion.
- Progress: B1–B15 implementation/evidence/owned cleanup recorded; Free acceptance remains incomplete.
- Change summary: Verified remote 0000–0027 after locally restored backup; removed owned mutable fixtures while preserving history/tombstone/key identity constraints.
- Files/artifacts: D1 forward migration receipts and cleanup summaries; [B15 measurements and cleanup](../evidence/2026-10-05-b15-live-measurements.md), [receipt](../evidence/2026-10-05-b15-live-metrics.json), [remediation record](../evidence/2026-10-05-review-remediation.md).
- Verification: Reused B14 matrix 937 passed / 18 optional-provider skips. B15 Minimum 7 passed; Node timeout/stall 2 passed / 31 intentionally unselected (earlier incorrect filter selected zero); actual R2 2 passed / 6 intentionally unselected. Live 10/10 logins, scoped path/cleanup checks pass; final compile/lint/build/docs/format/secret results in linked record. No broad rerun or new automated tests.
- Decisions and deviations: 1,000 ms defaults cover observed D1 trips (537 samples, max 284 ms); production sampling 0.1, test/staging 1; ten native PBKDF2 slots at the Minimum root. Cleanup retains FK-required tombstones and permanent keys rather than disabling history protections. Primary focused review only; Sonnet unavailable.
- Blockers/open questions: Billing attribution unavailable; instrumented login CPU 20–47 ms exceeds nominal Free 10 ms. Successful live CAPTCHA passkey login, Standard measurements and complete quota/recovery evidence unverified. G1/G2 remain closed, 13.G6 open.
- Next actions: No new schema work; preserve applied migration history and removed key identities.
- Next-session cautions: Test Workers/domain removed and tails stopped; mutable owned rows absent. One deleted User, archived private project, deleted issue/three comments plus immutable history remain; two owned keys are removed identities. Never stage protected drafts/reviews/HANDOFF; preserve baseline rows, migrations, audit/history, no SPA or Argon2id performance work.

### 2026-10-05 — PR 2 singleton registry-plan correction

- Scope and checklist IDs: User-directed failed-CI repair; 03.2d key-registry query evidence and 02.3d performance-fixture ownership. No application/schema or acceptance change.
- Progress: Diagnosed the first repaired-head PR PostgreSQL failure. Committed as f13d7f1; both complete backend runs pass, including 189 PostgreSQL passes/two optional-provider skips in each. CodeQL and docs pass; all five bot findings remain fixed.
- Change summary: Inspect structured EXPLAIN nodes instead of rejecting every Seq Scan. Only CHECK/PK-constrained key_registry_control may scan, with at most one returned row and zero filtered rows; all three large-table indexes, large-table scan prohibitions and one-statement bounds remain. Analyze the singleton fixture to exercise that plan locally.
- Files/artifacts: tests/fixtures/key-registry-contract.ts; [PR 2 repair evidence](../evidence/2026-10-05-pr2-ci-repair.md#first-hosted-repair-and-singleton-plan-correction); ignored local/hosted receipts.
- Verification: Real isolated PostgreSQL 18.6 focused registry measurement one passed/156 intentionally unselected, exercising the one-row Seq Scan and three required indexed relations. Local median 0.114 ms/p95 0.206 ms, one statement/snapshot. Typecheck/lint/scoped formatting/diff passed; PostgreSQL 18 Context7 resolve/query and source/migration review recorded. No new automated case or broad local rerun.
- Decisions and deviations: PostgreSQL's efficient bounded singleton scan is allowed; no enable_seqscan override, index forcing, weakened large-table bound, schema/data change or new security policy. D1 branch unchanged.
- Blockers/open questions: None for this repair. Broader module/release evidence requirements remain unchanged.
- Next actions: CI repair is complete; preserve the relation/row bounds and verify current head before reusing the linked hosted evidence.
- Next-session cautions: Preserve singleton CHECK/primary-key invariants and all large-table index assertions. Do not stage protected drafts/reviews/HANDOFF or alter release gates.

### 2026-10-09 — Module 08 B1 dependency handoff

- Scope and checklist IDs: Module 08 08.1a–e public-semantics batch; no owning-module checklist closure.
- Progress: Runtime-independent AST v1 and bounds export supplement the existing public contract. No schema or normative specification is modified.
- Change summary: Documented dependency boundary and prepared shared search contract/fixtures; details in [Module 08 progress](08-search-and-query.md).
- Files/artifacts: This record; `docs/SEARCH-SPEC.md`, contracts search types and shared search corpus; [B1 evidence](../evidence/08-search-validation.md).
- Verification: One B1 pass: types/lint/boundaries/scoped TypeScript formatting/diff and nine new-document local links pass; unit 354/contract 1 pass. Exact commands in linked evidence; new parser fixtures, runtime search and hosted behavior remain unverified.
- Decisions and deviations: Follow the approved Module 08 handoff scope and README's handler-before-dispatch interpretation. No normative baseline deviation.
- Blockers/open questions: User approval of specification/bounds/AST/endpoint shape precedes B2; runtime and dispatch evidence remain open.
- Next actions: Approve the concrete B1 contract, then execute Module 08 B2–B4 within the named checklist boundaries.
- Next-session cautions: Preserve existing owning-module status/remainders, protected drafts and all gate states; do not infer deployment/Free-plan acceptance from local checks.

### 2026-10-09 — Module 08 B2 compiler dependency

- Scope and checklist IDs: 08.1b/08.2a/b/d and 08.V1/V2; no independent owning-module checklist closure.
- Progress: Shared parser/direct AST validation, additive D1 0028/PG 0027 search-derived mappings and local migrations verified; prior canonical/history semantics retained.
- Change summary: User approved B1; implemented bounded parser and parameterized native search with current canonical predicates, fixed-window keysets and batch hydration.
- Files/artifacts: Application/database search modules, D1 0028/PG 0027 SQL/schema metadata, shared native fixtures, SEARCH-SPEC/ADR; [B2 evidence](../evidence/08-search-validation.md#b2--parser-and-dual-store-compilers-2026-10-09).
- Verification: Unit 6/contract 1; selected D1/workerd14 and real isolated PG18.6 14 pass (final narrow refinements replace three results each). Types/lint/boundaries/db histories/local migrations pass; exact commands/first failures in evidence.
- Decisions and deviations: Shared Unicode lowercase/NFC preprocessing resolves observed C-locale case mismatch without changing canonical projection. Additive derived-only migrations; no remote application or normative-document edit.
- Blockers/open questions: No B2 blocker; B3/B4 and Module 09 dispatch/queue acceptance remain open.
- Next actions: B3 authorization/readiness/lifecycle/representative measurements, then B4 handlers/tier budgets.
- Next-session cautions: Preserve prior histories, protected drafts, owning-module remainders and gate states; emulated/local evidence is not hosted/actual Free-plan evidence.

### 2026-10-09 — B3 lifecycle implementation checkpoint

- Scope and checklist IDs: 08.2c/f/g and 08.V3/V4; Module 08 owns this batch.
- Progress: B1/B2 committed; B3 in progress, unverified. Inspecting inherited index-store changes before integration.
- Change summary: Bounded resumable initial indexing consumes canonical Module 07 projections; conditional revision/visibility fences prevent stale writes. PostgreSQL native position limits require token-sequence phrase rechecks.
- Files/artifacts: Application search-index port and both adapter search-index implementations; shared SEARCH-SPEC/evidence will record final behavior.
- Verification: Not run for B3; prior B2 results remain recorded in ../evidence/08-search-validation.md.
- Decisions and deviations: User approval of B2 persists. No normative edits or scope expansion; dispatch and queue/retry remain Module 09 handoffs.
- Blockers/open questions: B3 routes/readiness and larger-data evidence remain unfinished.
- Next actions: Complete B3 implementation, run one relevant verification pass, record results and commit.
- Next-session cautions: Preserve protected root drafts, canonical projection policy and closed G1/G2/open 13.G6; no hosted claims.

### 2026-10-09 — B3 local acceptance

- Scope and checklist IDs: 08.2c/f/g, 08.V3/V4; Module 08 owns implementation.
- Progress: Both stores and composed HTTP routes verified; lifecycle/readiness and representative measurements complete locally.
- Change summary: Approved search/suggestions use shared project authorization; stale visibility/membership/text cannot grant results. Bounded explicit backfill, incomplete-index errors, one-second store deadline and token-sequence phrase rechecks preserve canonical access.
- Files/artifacts: Application/index ports, dual-store adapters, server/runtime bindings, existing shared suites; SEARCH-SPEC/ADR0013; ../evidence/08-search-validation.md B3 and dual-store query JSON.
- Verification: Combined selected scope 10 checks per profile pass; types/lint/boundaries pass. Exact first failures/narrow repairs/metadata are in linked evidence; no hosted acceptance.
- Decisions and deviations: Candidate ceilings 4096/256 total project Issues, 60-second operational delay target awaiting scheduling, no partial successful index. PostgreSQL bulk-load GIN pending scan investigated and VACUUM result recorded; no query-side vacuum.
- Blockers/open questions: B4 events/quota/reindex remain; Module 09 dispatch and queue/retry open. No Module 07 remainder or integration/release gate closed.
- Next actions: Commit B3, implement/verify B4 within Module08 scope.
- Next-session cautions: Preserve protected untracked drafts, prior migrations, canonical content bounds, G1/G2 closed and 13.G6 open; local evidence cannot claim real Free CPU or quotas.

### 2026-10-09 — B4 implementation checkpoint

- Scope and checklist IDs: 08.2e/h, local 08.V5/V6; Module08 owns implementation, dispatch stays Module09.
- Progress: B3 committed faa04f8; B4 written, verification pending.
- Change summary: Canonical revision-reference/outbox handler, replay suppression, administrator-guarded one-page reindex, singleton atomic Minimum daily reservation and D1 row/statement metering. No public reindex endpoint or scheduler.
- Files/artifacts: Search budget/index/application ports, dual adapters and new D1 0029/PG0028 budget migration families; server/composition and shared native fixtures.
- Verification: Migration generation completed/SQL inspected; B4 static/runtime/migration checks not yet run.
- Decisions and deviations: Conservative search allocation leaves provider quota for other modules; provider-global accounting/hosted CPU remains independent acceptance. Existing outbox mutation IDs resolve immutable timeline revisions, without changing payloads.
- Blockers/open questions: Local checks/measurements pending; production dispatch/queue/retry and real Free-plan evidence remain open.
- Next actions: Run one B4 relevant pass, fix failures narrowly, record evidence and commit; then requirement-by-requirement handoff audit.
- Next-session cautions: Preserve earlier migrations and protected drafts; no normative edits, remote rollout or gate closure.

### 2026-10-09 — B4 local acceptance and authorized handoff completion

- Scope and checklist IDs: 08.2e/h contract/migration dependency; no Module02 remainder reopened.
- Progress: All four authorized batches implemented and locally verified; 08.1a–e, 08.2a–d/f–h, 08.V1–V4 and local 08.V6 complete. 08.2e handler/08.V5 replay-rebuild pass; combined dispatch/queue checkboxes stay open. Module08 remains In progress.
- Change summary: AST/envelope1 retained with cursor policy1; exact-revision event port, quota port and additive D1 0029/PG0028 singleton ledgers.
- Files/artifacts: Application/server/runtime search ports; dual-store compilers/index/budget adapters and 0029/0028 migrations; existing shared native/unit fixtures; SEARCH-SPEC/ADR0013; [B4 evidence and requirement audit](../evidence/08-search-validation.md#b4--version-aware-indexing-and-tier-budgets-2026-10-09), query/reindex JSON and module/master records.
- Verification: Composed selected scope D1/workerd22 and real isolated PG18.6 20 pass; unit7/contract1 pass; migration fresh/upgrade/application and db:check pass; final typecheck/lint/boundaries pass. Final narrowed PostgreSQL semantics/plan pass, including no canonical Seq Scan, <=4097 probes/node and zero denied-project Issues/document scan loops. Exact commands, failed assertions/imports/plan attempts, local metadata and limitations are in linked evidence.
- Decisions and deviations: PostgreSQL logical LIMIT alone failed physical scan bounds; recursive keyset probes plus independent canonical/text materialization fix it without widened ceilings or planner-wide settings. Conservative Minimum ledger is not provider-global billing/CPU evidence. No normative edit or baseline deviation; user approval persists.
- Blockers/open questions: No blocker within authorized handoff scope. Module09 dispatch/queue/retry/reconciliation and provider-global headroom, Module10 composed acceptance and actual Free CPU/quota 13.G6 remain open.
- Next actions: Commit verified B4 as the fourth batch; stop Module08 implementation. Later authorized Module09 connects 08.2e dispatch and completes 08.V5; Module10/13 supply remaining gate evidence.
- Next-session cautions: Preserve feat/v1 batch history, protected untracked drafts, earlier migrations, current canonical authorization and numeric ceilings. No remote rollout/push, SPA or Module07/14 expansion. G1/G2 stay closed and 13.G6 open; local evidence must not be promoted to hosted acceptance.

### 2026-10-10 — Module 09 B1 portable async model

- Scope and checklist IDs: 09.1b/09.1e, 09.2a, 09.3a; Module 02 producer compatibility.
- Progress: Portable model and both database stores verified; platform adapters and consumers remain B2–B5.
- Change summary: Added sidecar publication/execution leases, retry/failure/replay state and stable identities; bounded checkpointed jobs atomically record step witnesses. Producer outbox/envelope shapes unchanged.
- Files/artifacts: Application/database async-processing modules, additive D1 0030/PostgreSQL 0029 migrations; [evidence](../evidence/09-async-validation.md).
- Verification: Focused unit 1, contract 1, workerd/D1 3 and real isolated PostgreSQL 18.6 3 passed; typecheck/lint/boundaries/db:check/diff passed. Initial syntax/lint and PG bigint inference failures corrected; unrelated tests deliberately filtered. No hosted resources.
- Decisions and deviations: Explicit at-least-once; source acknowledgement follows consumer completion, never queue publication. Replay requires fresh operator authorization. Primary focused review only; audit remains suspended.
- Blockers/open questions: None for B1; platform support and hosted quotas remain unverified.
- Next actions: B2 TaskQueue adapters, bounded dispatch/consumption and telemetry.
- Next-session cautions: Keep failed records replayable and fences conditional; preserve existing migrations/protected files and G1/G2/13.G6 states.

### 2026-10-10 — Module 09 B2 queues, bounds and telemetry

- Scope and checklist IDs: 09.1a, 09.2b/09.2c; additive telemetry indexes and Graphile dependency.
- Progress: Both queue adapters, bounded runner and safe telemetry verified; consumer wiring remains B3.
- Change summary: Cloudflare send/schedule/ack/retry and actual PostgreSQL Graphile delayed tasks; two underlying-operation slots survive deadlines; bounded dispatch/fan-out/backlog telemetry and non-critical circuit breaking.
- Files/artifacts: App task-queue adapters, application async-runner, shared fixture/tests/build target, Node manifest/lock; D1 0031/PG 0030 indexes; [evidence](../evidence/09-async-validation.md).
- Verification: Unit 3, local Queue retry 1, actual Graphile/PostgreSQL 1, changed-backlog D1/PG 1 each passed; type/lint/boundaries/db/license/secrets/diff passed. Unrelated cases filtered; no hosted resource created.
- Decisions and deviations: Added only graphile-worker@0.18.0 directly; lifecycle/license policy passes. Miniflare initial lookup miss resolved via workers-sdk and actual local proof. Backlog counts saturate as documented lower bounds; oldest age uses covering indexes.
- Blockers/open questions: No B2 blocker; Standard deployment performance and Minimum/Workflows evidence remain unverified.
- Next actions: B3 wire current plugin configuration/permissions and search handler; inject commit/send/processing/ack failures and close Module 08 handoffs.
- Next-session cautions: Preserve source events until consumer completion; provider dedupe does not replace idempotency; stalled work cannot release capacity early; all gates/protected files unchanged.

### 2026-10-10 — Module 09 B3 search/plugin dispatch and crash recovery

- Scope and checklist IDs: 09.1c/09.1d, 09.2d, 09.V1/V2/V5; close 08.2e/08.V5 integration handoffs.
- Progress: Connected consumers and both-store injected failure/HTTP outage acceptance pass; Module 08 checklist is now complete at its documented local scope.
- Change summary: Existing search handler is dispatched unchanged; trusted host plugin bindings reload lifecycle/settings and reauthorize delayed actions. Standard roots use the current Cron/Node interval; provider startup failure preserves canonical API availability and source events.
- Files/artifacts: Application async-consumers, both app async roots/composition/task wiring, Wrangler queue bounds, shared crash/HTTP tests; [evidence](../evidence/09-async-validation.md).
- Verification: Connected consumers 3 each D1/PG, explicit added processing-failure case 1 each, complete issue-route/HTTP journeys 2 each pass; types/lint/boundaries/build/secret/scoped-format/diff pass. Queue failures/downstream idempotency are deliberately injected; stores and HTTP runtimes are actual local services/emulation.
- Decisions and deviations: No envelope/producer/search contract change. Missing host bindings retry boundedly; disabled/uninstalled plugins cancel. Core permission callbacks are required per binding. Primary focused review only; no audit resumed.
- Blockers/open questions: None for B3; B4 workflow/scheduling and B5 Minimum/hosted quota proofs remain. Standard paid-profile performance stays unverified.
- Next actions: B4 durable adapters/conformance and consolidated cleanup/operator documentation.
- Next-session cautions: Preserve idempotency and current permissions/configuration; no official provider/features or public API expansion. G1/G2 closed, 13.G6 open; protect untracked drafts/handoffs.

### 2026-10-10 — Module 09 B4 durable workflows and scheduling

- Scope and checklist IDs: 09.3b/c/d/f and local 09.V3/V4; scheduler/database/runtime integration only.
- Progress: B4 implemented and locally verified; B5 and suspended 09.3e remain open.
- Change summary: Native Workflows and PostgreSQL/Graphile checkpoint adapters, persistent bounded upload cleanup cursors, configured retention on existing schedulers, fixed exhausted Graphile key reconciliation, internal operator runbook.
- Files/artifacts: Runtime workflow/scheduler roots, application workflow/maintenance ports, config policy, additive maintenance migrations, shared cleanup/native workflow tests; [B4 evidence](../evidence/09-async-validation.md#b4--workflows-and-scheduled-maintenance).
- Verification: Actual persistent local Workflow restart/resume/cancel 1; actual PostgreSQL Graphile/cleanup 2; D1 cleanup 1; typecheck/lint/db:check/build/types/secrets/scoped format/diff pass. Initial fixture/type failures corrected; exact commands and boundaries in evidence.
- Decisions and deviations: No new dependency or normative change; tiny conformance has no artificial artifact reference. Graphile replace keys permit reconciliation of exhausted provider jobs. Existing upload/authorization semantics retained.
- Blockers/open questions: Hosted Free CPU/quota headroom and Minimum budget/recovery pending B5; no paid Standard acceptance claim.
- Next actions: Implement B5, verify authorized temporary hosted behavior and cleanup, then close only evidence-backed checklist items.
- Next-session cautions: No hosted resources yet; preserve protected untracked drafts, source outbox/envelopes, audit suspension and G1/G2/13.G6 state.

### 2026-10-10 — Module 09 B5 blocked, hosted cleanup complete

- Scope and checklist IDs: 09.1f/09.2e/09.3g, additive persistence and capability fields.
- Progress: Uncommitted D1 reservation/cursor/claim and both-store terminal retention preserve producer envelopes. Reviewed additive test-D1 prerequisites 0028/0029 and async 0030–0034 remain; existing data and append-only migration history preserved.
- Change summary: Preserve B1–B4 acceptance; record uncommitted B5, actual Free CPU failure and scoped cleanup.
- Files/artifacts: D1 0033/0034, PostgreSQL 0032 SQL/journal/snapshot families, database stores/schema, contracts/server; [detailed B5 evidence](../evidence/09-async-validation.md#b5--minimum-prototype-and-hosted-cpu-blocker) and [safe receipt](../evidence/09-hosted-minimum-receipt.json).
- Verification: Focused local Minimum/replay-retention workerd 2, PostgreSQL retention/capability 2, Minimum capability 1, maximum multipart budget unit 1 and optimized recovery 1 pass; prior typecheck/lint/db:check/build/docs/secrets pass. Actual dispatch 15/20 ms fails required 10 ms. Final cleanup API/row/foreign-key guards pass; raw DNS inventory 403, independent absence unverified. Hosted quota exhaustion not run. Affected replay commands and limitations are in linked evidence. Final corepack pnpm docs:build, scan:secrets, scoped oxfmt --check and git diff --check pass; checklist/status/receipt/local-link/bilingual-path/empty-staging guards pass. No broad green-lane rerun.
- Decisions and deviations: Follow HANDOFF-09 “If a bound cannot be met, stop and report.” No bound/normative change, dependency addition, B5 commit, push or PR update; audit stays suspended.
- Blockers/open questions: Module09 B5 Free CPU fit. Further changes in Module08 require explicit bounded scope authorization; batching is a proposal, not a proven fix.
- Next actions: Obtain that scope decision, then resume only authorized affected implementation/verification. Final scoped formatting/document checks passed; no staged files.
- Next-session cautions: Keep B5 uncommitted and 09.1f/09.2e/09.3g/09.V6 unchecked; preserve protected drafts, baseline/append-only history and additive migrations. G1/G2 closed and 13.G6 open. Hosted owned mappings/resources are gone; ignored receipts contain private configuration and must not be staged.

### 2026-10-10 — Authorized search batching verified locally, CPU still blocked

- Scope and checklist IDs: 08.2e/h and 09 B5 D1 persistence follow-up.
- Progress: D1 search-budget/search-index reuse a single reservation RETURNING canonical source; no new migration or producer/public/application contract. Fresh logical backup/restore verifies 102 baseline records and captured singleton state.
- Change summary: Complete the scoped investigation, retain uncommitted changes and stop hosted acceptance after the fresh CPU failure.
- Files/artifacts: D1 search-budget/search-index, shared search-contract, bilingual deployment/internal docs, [follow-up evidence](../evidence/09-async-validation.md#authorized-module08-d1-batching-follow-up--2026-10-10) and [fresh receipt](../evidence/09-hosted-minimum-batching-receipt.json).
- Verification: Focused workerd 4 / PostgreSQL 3, typecheck/lint/scoped format/diff pass; hosted profile/dispatcher results above, quota/max-body/recovery probes not run after stop. Owned API inventory zero, 102 baseline canonical rows exact, foreign keys valid, mutable fixture work absent and tail processes stopped. Final docs:build, secret scan, scoped formatting/diff, receipt/cleanup/checklist/local-link/empty-staging checks pass.
- Decisions and deviations: Preserve every contract, guard and numeric ceiling; follow repeated HANDOFF-09 stop rule. No migrations/new dependencies, paid feature, audit resume, B5/search commit, push or PR update. Raw DNS absence remains independently unverified.
- Blockers/open questions: Dispatcher22ms versus 10 ms. Candidate next direction: consolidate Minimum admission/claim/source and completion/telemetry call boundaries; needs a new user-directed decision after the stop, not a threshold waiver.
- Next actions: Final documentation/format/receipt checks are complete; report the investigation and await the next direction after the required stop.
- Next-session cautions: B1–B4 commits preserved; B5/search remain uncommitted, 09.1f/09.2e/09.3g/09.V6 unchecked, 09.3e suspended. G1/G2 closed and 13.G6 open; preserve protected drafts, accessible canonical rows/history and captured singleton state.

### 2026-10-10 — User-authorized B5 and search checkpoint publication

- Scope and checklist IDs: Commit and push the existing B5 prototype and scoped Module08 search optimization; 09.1f/09.2e/09.3g/09.V6 remain unchecked.
- Progress: User explicitly authorizes publication of the prepared implementation and evidence. Module09 remains Blocked; this checkpoint does not establish acceptance.
- Change summary: Preserve the bounded Minimum scheduler, quota/call budgets, retention migrations, search admission/source optimization, fixtures and CPU failure receipts. No new implementation or hosted activity.
- Files/artifacts: Existing B5/search changes and [Module09 evidence](../evidence/09-async-validation.md); this progress record.
- Verification: Reuse the recorded focused local/runtime checks and completed hosted cleanup; no green application lane rerun for commit preparation. Publication checks are scoped formatting, secret scan, diff hygiene and remote-ref verification.
- Decisions and deviations: The new user instruction supersedes the prior instruction to leave B5/search uncommitted. Git CLI documentation resolved and queried through Context7 (/git/htmldocs) on 2026-10-10; normal branch push only.
- Blockers/open questions: Latest actual dispatcher CPU is 22 ms against the required 10 ms; remaining hosted quota/acceptance evidence is incomplete.
- Next actions: Preserve this checkpoint; further implementation or hosted acceptance requires a new user direction after the recorded stop.
- Next-session cautions: No acceptance/checklist/gate closure, audit resume, PR edit or production deployment. G1/G2 stay closed and 13.G6 open. Exclude protected root drafts and ignored private configuration/backup artifacts.

### 2026-10-10 — Authorized dispatcher performance retry started

- Scope and checklist IDs: Module09 D1 batching and additive admission-token migration; user authorizes testing/refactoring across profiles if needed.
- Progress: New bounded retry authorized after the recorded 22 ms CPU stop; acceptance remains open.
- Change summary: Prepare token-fenced admission/claim batching, immutable revision hydration and completion/backlog batching.
- Files/artifacts: D1 async adapters/schema, Minimum composition and focused tests; no hosted resources yet.
- Verification: Not run; prepare the full batch before focused checks. Context7 D1 resolve/query confirms ordered transactional batches (2026-10-10).
- Decisions and deviations: Preserve contracts, source validation, current-state index guards, all quotas and retry/lease limits. No paid capability or audit resume.
- Blockers/open questions: Actual Free CPU fit remains unproven.
- Next actions: Verify local concurrency/refusal/recovery and migration; then one fresh hosted CPU retry with backup and cleanup.
- Next-session cautions: d9ee49d is the committed prototype; new edits are uncommitted. Protect private backups/root drafts; G1/G2 and 13.G6 unchanged.

### 2026-10-10 — Dispatcher batching verified; native Cron evidence remains open

- Scope and checklist IDs: Cross-module support for Module09 B5; authorized performance tests/refactoring, with audit suspension preserved.
- Progress: 09.2e/09.3g verified; 09.1f/09.V6 remain open because native Cron execution was not observed.
- Change summary: Additive D1 migration 0035 adds an internal nullable admission token; admission-dependent mutations remain transactionally fenced.
- Files/artifacts: D1/runtime batching, migration 0035, focused tests and paired reader guides; [Module09 session](09-async-and-workflows.md) and [receipt](../evidence/09-hosted-minimum-dispatcher-receipt.json).
- Verification: Focused workerd/migration/search checks, typecheck, lint, db:check, build, docs:build, scoped formatting, secrets and diff hygiene pass. Twelve explicit hosted ticks measured 1–10 ms CPU; native Cron proof remains missing.
- Decisions and deviations: No contract, permission, numeric bound, dependency or gate change; detailed probe mistakes and restorations are recorded in Module09 evidence.
- Blockers/open questions: Native Cron delivery/CPU remains unverified; registration is not execution.
- Next actions: Obtain native Cron evidence before closing the remaining checks.
- Next-session cautions: Owned resources zero; all 107 original records verified, singleton state restored, history preserved. Protected drafts/private backups excluded; no push or PR edit for this batch.

### 2026-10-10 — Native Cron dispatch verified but CPU bound failed

- Scope and checklist IDs: Module09 09.1f/09.V6 native scheduler verification under existing test authorization; audit remains suspended.
- Progress: Real native delivery, canonical indexing and acknowledgement observed. Productive native tick measured 20 ms against the required 10 ms CPU bound; 09.1f/09.V6 remain open.
- Change summary: Isolated provider delivery with a scheduled-only Worker, then tested the unchanged Minimum function on the same Worker. No application code, contract, dependency or migration change.
- Files/artifacts: [Native evidence](../evidence/09-async-validation.md#native-scheduler-diagnostic-and-dispatch-cpu-failure--2026-10-10), [safe receipt](../evidence/09-hosted-native-scheduler-receipt.json), internal/paired reader guidance and status records; private helpers remain ignored.
- Verification: Native witness 0 ms, empty dispatch 7 ms, canonical dispatch 20 ms; final index revision 1, source acknowledged, delivery attempts 1. Owned resources zero and tail stopped; all 115 original records/columns and captured singleton state verified, foreign keys valid, original two Workers/domains preserved. Final docs:build, secrets, receipt/cleanup/checklist/link guards, JSON serialization and diff hygiene pass. Scoped oxfmt had no eligible files because repository ignore rules exclude docs; no application lane rerun for this documentation-only session.
- Decisions and deviations: Stop after CPU failure under HANDOFF-09. Fixed probe dispatch phase protects original expired identity rows; seed request CPU is outside async acceptance. No paid feature, threshold waiver, audit resume or gate closure.
- Blockers/open questions: Native dispatch CPU exceeds the bound; earlier missing native delivery cause remains unknown.
- Next actions: Report the measured failure; a new user direction after the HANDOFF-09 stop is required before further performance implementation or hosted acceptance. Native CPU profiling is the next proposed investigation. Preserve 09.2e/09.3g and Module08's existing dispatch/retry closure.
- Next-session cautions: No further hosted probe/refactor after the failure. Keep original data/history and committed batches; retained inactive fixture has one timeline/one audit record. Raw DNS absence unverified, custom-domain mapping absent. No push or PR edit; G1/G2 closed and 13.G6 open.

### 2026-10-11 — Metering and initialization profiling checkpoint

- Scope and checklist IDs: Authorized Module09 B5 09.1f/09.V6 performance continuation and affected integration seams; no audit resume.
- Progress: Direct metering facades, phase-specific factory construction, internal async exports and deferred upload configuration locally verified. Native r4 produced no event within its bounded window; CPU acceptance remains open.
- Change summary: Preserve SQL, existing handlers, permissions, quotas and numeric limits. Keep default package entries and adapter imports; no lint exemption, dependency or migration.
- Files/artifacts: Minimum composition/meter, internal application/D1 async entries, unit coverage; [profiling evidence](../evidence/09-async-validation.md#authorized-cpu-profiling-continuation--2026-10-11), [r4 receipt](../evidence/09-hosted-native-meter-retry-receipt.json).
- Verification: Unit meter 3, search availability 28, workerd queue/workflow/Minimum 5 pass; typecheck, lint/boundaries, build and final Minimum target build, scoped format, secrets, docs build and diff pass. Local CPU/startup sampling is diagnostic only. R4 cleanup verifies 120 original records, foreign keys, singleton state, original two Workers/mappings and zero owned resources/work; live processes terminal.
- Decisions and deviations: Human approval permits continued bounded attempts after failures. Reverted lint-rejected internal adapter/contract paths rather than adding exclusions. Fixed copied fixture missing IDs only after proving no writes; TLS readiness and OAuth refresh handled. No native execution/CPU inferred from handlers, registration or local timing.
- Blockers/open questions: Latest productive native evidence remains 20 ms against 10 ms. Missing native delivery on r4 is unexplained.
- Next actions: Preserve the verified refactor; test the compiled module graph and final-binding Cron registration using a fresh owned attempt with cleanup.
- Next-session cautions: 09.1f/09.V6 open; 09.2e/09.3g and Module08 closure preserved; 09.3e suspended; G1/G2 closed and 13.G6 open. No push/PR edit. Exclude protected root/private helper files.

### 2026-10-11 — Module09 fresh-schema acceptance expectation

- Scope/checklist IDs: Module09 09.1f/09.V6 performance verification; Module02 fresh-schema test dependency.
- Progress/change summary: Correct PostgreSQL fresh-table expectation from 51 to 55 for the four already-implemented Module09 async sidecar tables. No migration, schema or persistent contract change.
- Files/artifacts: PostgreSQL repository test; [Module09 evidence](../evidence/09-async-validation.md#coherent-minimum-title-only-implementation--2026-10-11).
- Verification: Initial accidental broad run exposed the stale count; corrected focused PostgreSQL migration/search/async/capability selection passes 14 checks. Broad matrix not repeated.
- Decisions/deviations: Test maintenance for existing Module09 data model; no new capacity or data deletion.
- Blockers/open questions: Module09 native CPU remains unaccepted; no Module02 gate/status change.
- Next actions: Continue Module09 native measurement/owned cleanup.
- Next-session cautions: Protect original hosted rows and immutable migration history; no staging/production action or audit resume.


### 2026-10-11 — D1 checkpoint-job boundary reduction

- Scope/checklist IDs: Authorized 09.1f/09.V6 performance continuation and D1 persistence seam.
- Progress/change summary: Claim classification/acquisition and commit confirmation batched; job path retains eleven SQL statements while reducing provider calls ten to eight. R8 deployment/source unchanged.
- Files/artifacts: D1 async adapter, [job evidence](../evidence/09-async-validation.md#d1-checkpoint-job-batching-investigation--2026-10-11), [safe local profiles](../evidence/09-local-dispatch-cpu-profile.json).
- Verification: Actual local Workflow/Minimum four and shared D1 sidecars three pass; typecheck after explicit batch-row typing, lint/boundaries/build pass. Twenty fresh cold/warm isolates before/after preserve two witnesses; median CPU shows no demonstrated improvement. Docs build, secrets, scoped formatting and diff hygiene pass. No unchanged PostgreSQL rerun.
- Decisions/deviations: Current D1 Context7 lookup verifies batch ordering/transaction semantics. Preserve all lease, retry, cancellation, idempotency, reference and numeric guards; no new contract/schema/dependency.
- Blockers/open questions: Native title/job CPU and recovery remain unaccepted; project/provider10 ms unchanged.
- Next actions: Finish documentation checks/commit; collect existing R8 native outcome/cleanup, then only after CPU fit run representative recovery.
- Next-session cautions: R8 f6a1e9e remains active with original20:55/21:00 UTC bounds; no speculative redeploy, inventory rerun, push/PR edit, protected/private staging, audit resume or gate closure.


### 2026-10-11 — Minimum job admission and claim witness batching

- Scope/checklist IDs: Authorized 09.1f/09.V6 performance continuation and D1 job persistence seam; 13.G6 dependency.
- Progress/change summary: Productive Minimum job ticks reduce provider calls8→4 and SQL11→9. Keep shared validation, quota numbers, lease/checkpoint commits, cancellation and retry fences. R9 deployed source remains371aeb9 and native execution is pending.
- Files/artifacts: New D1 minimum job/budget modules, shared internal claim/row builders, composition, meaningful workerd cases and shared test call counter; [batch evidence](../evidence/09-async-validation.md#minimum-job-batching), safe local profile aggregates and internal async runbook. Private recovery harness now requires real native checkpoint commit before clean redeployment; no precommitted fixture witnesses.
- Verification: Final8 focused Minimum workerd checks,6 async unit checks,1 actual local Workflow restart/retry/cancel/output check pass; typecheck, lint/boundaries, build and scoped source format pass. Initial workflow check raced a concurrent build deleting shared output; sequential retry passes. PostgreSQL not rerun: unchanged adapter/application algorithm. Applied20 cold/warm local isolates prove exact witnesses[0,1], terminal checkpoint2, SQL9; sampled medians4,436.5/1,961.5us versus prior5,558/2,859; diagnostic only, no causal native speedup claim.
- Decisions/deviations: Use invocation-local selection/current-row witnesses; a cancellation or replacement lease after either cannot commit stale work. Extract common SQL/decoding unchanged. No target/capacity revision or schema/public contract change. Prepared fault means post-commit response loss plus redeployment, not an actual process kill.
- Blockers/open questions: Native history empty at21:39:13 UTC and live tail has no scheduled frame at21:40:05 UTC; latest productive native14 ms versus unchanged10 ms. Native title-only fit and recovery remain unproven.
- Next actions: Commit verified batch; observe existing R9 handles. Only after native fit preserve maximum evidence, run guarded quota refusal/recovery, then native checkpoint fault/clean redeployment. Otherwise finish cleanup and independently compare145 baseline rows/resources.
- Next-session cautions: R9 tail85877/monitor76068/watchdog73306 live; observation22:28:10.027/cleanup22:33:10.027 UTC2026-10-10. Source divergence is deliberate; record any future phase-4 build/deployment commit. Never rerun inventory, restart on observation timeout, or infer hosted recovery from private preparation. Keep protected/private files untracked; no push/PR edit, paid feature, audit or gate closure.


### 2026-10-11 — Native maximum dispatch and quota recovery verified

- Scope and checklist IDs: Authorized 09.1f/09.V6 performance continuation; search/data/operational dependencies, no audit resume.
- Progress: Maximum title-only native dispatch10 ms, quota refusal2 ms and restored-quota recovery4 ms observed. Native checkpoint interruption/redeployment remains pending.
- Change summary: Publish actual R9 outcomes and independently verified cleanup; prepare a fresh bounded R10 invocation-abort/redeployment case with current16d6500 production job batching. No target revision.
- Files/artifacts: [Native results and procedure](../evidence/09-async-validation.md#declarative-native-dispatch-and-quota-recovery), [final R9 receipt](../evidence/09-hosted-native-declarative-retry-receipt.json), internal async runbook, ADR0014 and paired reader guides; ignored R10 helpers.
- Verification:145 original records/exact singleton sets/FKs preserved, owned resources/work zero, both original Workers/domain mappings preserved, all R9 handles terminal/absent. R10 fresh logical backup restores152 rows/59 tables; private classifier and post-commit fault checks pass, build/types/Wrangler dry-run pass. R10 deployed version8f47a018 has one Cron, CPU/outcome pending. Docs build,497 relative-file links,JSON,secret scan and diff hygiene pass. Formatter excludes docs by existing configuration, so no documentation formatter pass is claimed. No unchanged green application lane repeated.
- Decisions and deviations: Target/provider ceiling10 ms unchanged; maximum sample has no margin. Intentional uncaught native scheduled error after actual checkpoint commit proves invocation interruption if observed, not an OS kill. Full composition/billing/release acceptance remains separate.
- Blockers/open questions:09.1f/09.V6 await native job interruption/clean redeployment and preserved pending-event recovery.
- Next actions: Observe the existing R10 handles; after actual checkpoint1/exception verify exact witness, clean redeploy/resume and dispatch; finish independent cleanup and requirement audit.
- Next-session cautions: Respect R10 original deadlines in private live-handles; never rerun seeded inventory. No push/PR edit, protected/private staging, paid feature, audit/gate closure; G1/G2 closed,13.G6 open.


### 2026-10-11 — R10 stopped and cleaned; user resumes performance work

- Scope and checklist IDs: Authorized09.1f/09.V6 continuation; affected data/search/operational evidence dependencies.
- Progress: R10 ended when the goal service reported paused; latest human instruction explicitly continues optimization. No native scheduled frame or CPU result exists for R10.
- Change summary: Publish unaccepted trial and finish process housekeeping; replace active-wait status with verified cleanup. Target remains10 ms and title-only capacity reduction remains in force.
- Files/artifacts: [Stopped trial receipt](../evidence/09-hosted-native-job-trial-receipt.json), requirement audit and current evidence/progress; private terminal receipts.
- Verification:152 original records/exact singleton sets/FKs and original two Workers/domains/schedules/Queues/Workflows preserved; owned resources/work zero. Tail exit0; exact observer/guardian commands revalidated then SIGTERM, both handles exit143, PIDs absent. No native success inferred.
- Decisions and deviations: Explicit human continuation supersedes earlier pause for task work; goal service still shows paused and cannot be resumed through update_goal. Do not recreate the goal or mark it complete. No target increase or further reduction justified by unobserved execution.
- Blockers/open questions:09.1f/09.V6 still require native interruption/redeployment and full composed scheduled CPU evidence.
- Next actions: Use a fresh backup/inventory and new owned trial; profile a measured hotspot before another refactor.
- Next-session cautions: R10 is closed; never restart its observers/guardian or reuse its captured baseline for new mutations. Keep09.3e suspended,G1/G2 closed,13.G6 open; no protected/private staging,push/PR edit,paid feature or production action.


### 2026-10-11 — Composed CPU profile and fresh R11 native trial

- Scope and checklist IDs:09.1f/09.V6 performance continuation; data/search/operational evidence dependencies.
- Progress: Full local Minimum scheduled entry passes sixteen maximum200/32768 dispatches; cold sampled non-idle median6150.5us,warm2305.5us. These are diagnostics, not hosted acceptance. Fresh R11 is deployed with one declarative Cron.
- Change summary: Profile actual scheduled composition and replace selective fault instrumentation with the actual Minimum entry for all native stages. Guarded supervisor requires witnessed checkpoint1/exact[0] and pending source before clean redeployment; checkpoint2/exact[0,1] before max dispatch. No application edit or further capacity/target revision.
- Files/artifacts: [Local composed profile](../evidence/09-composed-local-profile.json), [R11 procedure](../evidence/09-async-validation.md#r11-composed-native-trial); ignored private backup/harness/artifacts.
- Verification: Fresh logical backup locally restores157 records/59 tables/FKs. Preflight Free user-attested adaptive headroom4997481 reads,99941 writes,99906 requests at03:38:56 UTC; not billing. Local composed fault commits only step0, raises intentional invocation exception and pauses for redeployment. Build/Wrangler dry-run pass; actual fault deploymenta814c618 at03:40 with one Cron. Native execution/CPU pending.
- Decisions and deviations: D1 call/result handling and title tokenization remain sampled costs; no evidence supports shortening canonical bodies further. Full startup is outside local invocation sampling. Refreshed expired OAuth with Wrangler; read-only backup retry after transient socket error succeeded before mutation. Context7 confirms Cron propagation/omitted-trigger preservation; returned CPU docs distinguish startup/paid limits but lack full tail accounting detail.
- Blockers/open questions: Native interruption/full composition CPU and clean resume remain unobserved;09.1f/09.V6 open.
- Next actions: Observe existing guarded stages; on any failed bound or original deadline remove owned resources/work and independently verify157 baseline records/singletons/original resources.
- Next-session cautions: R11 tail51403(PID71010),supervisor14232(PID71014),guardian9520(PID70920); native04:14:25.423 UTC,cleanup04:19:25.423 UTC. No inventory rerun,new simultaneous trial,protected/private staging,push/PR edit,paid override,audit/gate closure.


### 2026-10-11 — Composed job profiling and rejected tokenizer preparation

- Scope and checklist IDs:09.1f/09.V6 authorized performance investigation; search/data/operational evidence dependencies.
- Progress: Eight full composed local job isolates finish exact[0,1]/checkpoint2;9 statements/combined calls per tick,16 reads/9 writes. Sampled cold non-idle median3506.5us,warm2035us, diagnostic only.
- Change summary: Evaluate private startup tokenizer preparation; reject for production because a small cold median change is within broad overlap, max worsens and warm median rises. No application source,capacity,target or native trial version changes.
- Files/artifacts: [Composed local job profile](../evidence/09-composed-local-job-profile.json), [rejected tokenizer prototype](../evidence/09-tokenizer-startup-prototype.json), ongoing R11 evidence; private profiles.
- Verification: Sixteen composed scheduled job calls and sixteen prototype max200/32768 dispatches pass their witness/index/source checks. Prototype cold median5830.5us(range3475–9565),warm2652.5us versus baseline6150.5/2305.5; no causal/native speedup claim. R11 private fetch401 and live-tail request witnesses confirm working observation; no native scheduled frame yet at03:46.
- Decisions and deviations: Keep measured production16d6500 source stable while autonomous native supervisor builds its prepared clean variants. Module startup119ms is separately reported by actual deployment; local invocation sampling excludes it.
- Blockers/open questions: Native composed CPU/interruption/redeployment remains pending;09.1f/09.V6 incomplete.
- Next actions: Collect existing guarded native stages/deadline cleanup; validate final documentation and receipt against actual outcomes.
- Next-session cautions: R11 original handles/deadlines remain; do not deploy a rejected prototype, edit application source during supervisor-controlled builds,repeat green lanes or infer acceptance from local samples. No push/PR edit,audit or gate closure.


### 2026-10-11 — R11 native observation deadline and recovered cleanup

- Scope and checklist IDs:09.1f/09.V6 performance continuation and data/search/operational evidence dependencies.
- Progress: No native scheduled frame; provider history empty at04:47:45 UTC. Current main job pending/checkpoint0/no witnesses, cancelled sibling unchanged and maximum canonical source pending/unindexed. No CPU failure inferred.
- Change summary: Guardian reached04:19 deadline but failed authentication before cleanup. Refreshed credentials, inspected actual current resources/data before mutations, then independently completed cleanup; all handles terminal/PIDs absent.
- Files/artifacts: [Unaccepted composed Cron receipt](../evidence/09-hosted-composed-cron-trial-receipt.json), current evidence/audit/progress; private cleanup and terminal receipts.
- Verification:157 original records/exact singleton sets/FKs restored; original two Workers/domain mappings/schedules/Queues/Workflows preserved. Owned resources/outbox/deliveries/jobs/steps/search zero; one timeline/one audit entry and inactive fixtures retained. Tail exit1,supervisor0,guardian1 are actual terminal outcomes; failed guardian history preserved.
- Decisions and deviations: R11 closed; goal service nowactive. Preserve10ms and title-only capacity. New short hosted authenticated HTTP fixture may measure actual scheduled function and D1 interruption/redeployment with honest invocation labeling; it cannot replace native Cron evidence.
- Blockers/open questions: Native Cron missing across bounded trials;09.1f/09.V6 remain incomplete. Native scheduling requires external execution; no accepted full-profile/billing/paid performance claim.
- Next actions: Fresh backup/inventory before new mutation; collect whole composed hosted function CPU and actual D1 job recovery, then revisit measured hotspots/native scheduling proof.
- Next-session cautions: Never restart R11 processes or reuse its157-record baseline for new mutation. Do not publish success-only receipt or deploy rejected tokenizer candidate. Keep09.3e suspended,G1/G2 closed,13.G6 open; no protected/private staging,push/PR edit,paid feature or production action.


### 2026-10-11 — R12 short authenticated hosted function diagnostic

- Scope and checklist IDs:09.1f/09.V6 authorized performance/recovery investigation; data/search/operational dependencies.
- Progress: Prepare new authenticated HTTP fixture calling the actual Minimum scheduled method; no Cron and no native-Cron claim.
- Change summary: Fresh backup/inventory, bounded fault/resume/dispatch artifacts, private token binding over Wrangler standard input and independent15-minute guard. Request guard denies unauthorized/non-POST/non-proof-path calls before D1 work; no request body controls SQL,phase or references. Fixed phases4/0 and zero original jobs/outbox protect baseline work.
- Files/artifacts: Ignored module09-hosted-r12 helpers/backup/deploy logs, [current evidence](../evidence/09-async-validation.md#r12-authenticated-hosted-function-diagnostic).
- Verification:162 original records/59 tables locally restored with valid FKs; actual fault version5729f20d after secret installation,zero Cron. Preflight adaptive headroom4995864 reads,99882 writes,99867 requests at04:52:46 UTC; Free user-attested,not billing. First read-only HTTPS ping has transient certificate-handshake failure; no authenticated invocation or CPU result yet.
- Decisions and deviations: HTTP native Worker CPU/redeployment proof can guide optimization, but cannot substitute for missing native Cron.10ms unchanged; no product source,capacity or policy edit. Context7 confirms secret put stdin/new deployed version; secret value never printed/committed.
- Blockers/open questions: Hosted protected-fetch readiness/function CPU/recovery and cleanup pending; original native obligations remain open.
- Next actions: Bounded read-only readiness checks,then unauthorized denial and authenticated fault/current-state proof,clean redeploy/resume and max dispatch; independently clean162 baseline records/resources.
- Next-session cautions: R12 tail2630(PID77062),guardian97277(PID77006); cleanup05:08:37.445 UTC2026-10-11. Respect original deadline,no inventory rerun,new simultaneous trial,secret/private/protected staging,push/PR edit,paid override,audit or gate closure.


### 2026-10-11 — Hosted composed recovery passes; maximum dispatch14ms

- Scope and checklist IDs:09.1f/09.V6 performance continuation; affected data/search/operational dependencies.
- Progress: Actual hosted composed fault9ms, clean redeployment/resume7ms, exact[0,1]/checkpoint2 and pending-event survival verified. Maximum dispatch acknowledges/indexes unchanged200/32768 canonical content at14ms, failing10ms. These are authenticated HTTP invocations, not native Cron.
- Change summary: Record all three real deployments and authoritative outcomes; guardian stops on14ms and independently cleans. No target/capacity or product source change.
- Files/artifacts: [Hosted composed HTTP receipt](../evidence/09-hosted-composed-http-recovery-receipt.json), evidence/audit/progress; ignored private source/deploy/cleanup logs.
- Verification: Fault version5729f20d, resume4768d153, dispatchaa440963; unauthorized proofPOST401. Actual checkpoint1/[0] and checkpoint2/[0,1] both preserve source; cancelled sibling/oversized refusal hold. Canonical/indexrevision1,derived body0,title371bytes,done/attempt1.162 original records/exact singletons/FKs and original two Workers/domains/schedules/Queues/Workflows preserved; owned work/resources zero; tail2630/guardian97277 exit0,PIDs absent,private token removed. Docs/JSON/links/secrets/diff checks pending final update; no unchanged application lane repeated.
- Decisions and deviations: Keep10ms and title-only. Full composed dispatch14ms warrants another measured refactor; internal target revision cannot establish physical Free/release acceptance. Fault metadata omits post-commit lost-result counters; CPU includes whole test invocation and extra preflight. No native-Cron or OS-process-kill claim.
- Blockers/open questions:09.1f/09.V6 remain incomplete: full composed dispatch CPU and native Cron observation.
- Next actions: Reduce provider-result overhead around the single index upsert while preserving SQL,current-state/abort/meter checks; focused D1 verification and fresh bounded hosted comparison.
- Next-session cautions: R12 closed; no live resources/processes. New mutations need fresh backup/inventory. Do not reuse deleted proof token,alter post-I/O source acknowledgement,stage private/protected files,push/PR edit,resume audit or close gates.


### 2026-10-11 — Single index write performance experiment

- Scope and checklist IDs: Authorized09.1f/09.V6 optimization and Module08 D1 index seam; data/operational evidence dependencies.
- Progress: One fenced index upsert uses metered all/RETURNING; multi-document pages retain batch transactions. This is an uncommitted candidate,not a demonstrated improvement.
- Change summary: Keep identical SQL,fences,quota numbers,three provider calls/ten statements and post-I/O processor acknowledgement. Avoid only the one-statement batch/result wrapper.
- Files/artifacts: packages/database/d1/src/search-index.ts, [local diagnostic](../evidence/09-single-index-write-local-profile.json), private comparison helpers.
- Verification: Typecheck,lint/boundaries,scoped source format pass. Focused D1 search/consumer selection16 passes/179 intentionally deselected; separately previously unselected current projection/visibility/day-admission fence1 pass/3 deselected.8 local composed max isolates/16 dispatches pass, but cold/warm sampled medians7248/2680us versus6150.5/2305.5 worsen with overlapping ranges. No native improvement inferred. PostgreSQL unchanged,not rerun.
- Decisions and deviations: D1 all returns RETURNING rows/valid metadata in actual local runtime; Context7 confirms ordinary result/transaction shapes but not CPU savings. Local result cautions against accepting this candidate without a hosted comparison; revert if it does not help.
- Blockers/open questions: Whether native result handling changes whole composed CPU;10ms/native Cron obligations remain open.
- Next actions: Fresh bounded authenticated hosted dispatch comparison after new167-record backup/inventory;collect actual CPU and cleanup,then retain/reject candidate based on evidence.
- Next-session cautions: Do not claim performance improvement or commit candidate as accepted yet. Keep all application source stable once comparison is deployed,no early acknowledgement/limit weakening,private/protected staging,push/PR edit,audit/gate closure.


### 2026-10-11 — R13 bounded single-write hosted comparison deployed

- Scope and checklist IDs:09.1f/09.V6 and Module08 D1 index optimization,with data/operational dependencies.
- Progress: New dispatch-only authenticated HTTP comparison deployed; candidate remains uncommitted. No native-Cron claim or job fixture/precommitted witness.
- Change summary: Fresh167-record/59-table restored backup and inventory; exact same max200/32768 producer/full scheduled entry/private request guard as R12 dispatch,with only candidate single-write method changed.
- Files/artifacts: Ignored module09-hosted-r13 backup/config/source hashes/deploy/guard logs; [comparison evidence](../evidence/09-async-validation.md#r13-single-write-hosted-comparison).
- Verification: Actual post-secret version6edcaf81;zero Cron/Queue/Workflow/R2/schema change. Free user-attested preflight delayed adaptive headroom4993699 reads,99777 writes,99780 requests at05:13:57 UTC. First read-only TLS readiness ping still provisioning;no authenticated CPU result.
- Decisions and deviations: Local timing does not demonstrate gain; one hosted comparison resolves whether to retain/reject candidate. Numeric limits,target10ms,semantics and post-I/O acknowledgement unchanged.
- Blockers/open questions: Native whole-function timing and167-record cleanup pending;09.1f/09.V6 stillopen.
- Next actions: Bounded readiness check,private dispatch,current-state/CPU capture and cleanup;retain only with evidence.
- Next-session cautions: R13 tail38337(PID79131),guardian82945(PID79057),absolute cleanup05:27:26.438 UTC2026-10-11. Never restart an expired guard/reuse baseline/new simultaneous trial;no source drift,private/protected staging,push/PR edit,audit/gate closure.


### 2026-10-11 — Single-write hosted sample9ms and verified cleanup

- Scope and checklist IDs:09.1f/09.V6 authorized optimization;Module08 D1 index seam and data/operational dependencies.
- Progress: Full composed hosted max200/32768 dispatch uses9ms,versus earlier R12 observation14ms;one sample each,not causal/distribution proof. Retain the small single-write refactor after meaningful semantic checks and observed hosted fit.
- Change summary: Use metered all/RETURNING for one atomic fenced upsert;multi-document pages keep batch transactions. All SQL,current-state/abort/metadata gates,numeric bounds,three provider calls/ten statements and post-effect acknowledgement retained.
- Files/artifacts: packages/database/d1/src/search-index.ts,[R13 receipt](../evidence/09-hosted-single-write-dispatch-receipt.json),[local diagnostic](../evidence/09-single-index-write-local-profile.json),internal runbook/ADR/progress.
- Verification: Version6edcaf81,HTTP200,CPU9ms/wall467ms,one safe log,10 statements/conservative subrequests,63 reads/22 writes;revision1 indexed/acknowledged,title371bytes,derived body0,canonical lengths unchanged. Earlier focused D1 tests17 unique passes,typecheck/lint/boundaries/source format pass.167 original records/exact singleton sets/FKs/original two Workers/domains/schedules/Queues/Workflows preserved;owned work/resources zero;tail38337/guardian82945 exit0,PIDs absent,private token removed. PostgreSQL unchanged/not rerun. Final docs/links/JSON/secrets/diff pending commit verification.
- Decisions and deviations:9ms has only1ms measured margin;local medians worsened,so do not claim a stable speedup. Keep10ms and title-only reduction;further capacity/target change unnecessary for this sample. No source acknowledgement coupling or security/limit relaxation.
- Blockers/open questions: Native Cron/full composed scheduled acceptance remains;09.1f/09.V6 incomplete.
- Next actions: Commit coherent verified refactor;fresh bounded native Cron job interruption/redeployment/composed dispatch trial with new baseline and guard,then requirement audit.
- Next-session cautions: R13 closed/no live resources/processes;do not restart/reuse baseline/token. Keep source stable once new trial deploys;no private/protected staging,push/PR edit,paid feature,audit/gate closure.
