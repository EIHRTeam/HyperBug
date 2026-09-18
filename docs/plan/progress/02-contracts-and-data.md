# 02 progress — Public contracts, domain model, and database foundations

Plan: [Detailed checklist](../modules/02-contracts-and-data.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete
- Delivery scope: MVP backend
- Prerequisites: G0 passed; independent persistence work accepted in ADR 0001 while module 01 runtime/hosted-CI gaps remain open.
- Implementation started: Yes.
- Completed implementation checklist IDs: 02.1a–02.1f, 02.2a–02.2g, 02.3a–02.3d.
- Active/next checklist group: Phase complete; module 01 acceptance and G1 remain separate.
- Last updated: 2026-09-18.
- Blocking issues discovered: No unresolved module 02 local acceptance blocker; module 01 has separate recorded gaps.
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
2. Keep module 01 acceptance and G1 closed until their own evidence passes.
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
