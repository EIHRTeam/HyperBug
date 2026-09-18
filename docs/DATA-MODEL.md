# HyperBug data model

Status: Phase 02 foundation specification. Feature endpoints, authentication, authorization enforcement and production deployment remain owned by later modules. See [API conventions](API-CONVENTIONS.md), [operation inventory](API-OPERATIONS.md), and [persistence decision](decisions/0002-persistence-semantics.md).

## Identity, time and versions

Internal IDs are lowercase UUID v4 strings generated with runtime cryptographic randomness. They carry no ordering, tenant or authorization information. PostgreSQL uses `uuid`; D1 uses constrained text. Human-facing Issue numbers are positive project-local integers, unique with `project_id`, allocated atomically from the project's next-number counter. Numbers are immutable and never reused after deletion. A rolled-back creation does not consume a number.

Persist instants as integer UTC milliseconds since the Unix epoch: D1 `integer`, PostgreSQL `bigint` mapped to JavaScript `number`. Values must be nonnegative safe integers and representable by `Date`; no sub-millisecond precision exists. API instants are canonical `YYYY-MM-DDTHH:mm:ss.sssZ` strings. Calendar-only milestone due dates are `YYYY-MM-DD` strings, not midnight instants. Clocks and ID factories are injectable for fixtures; production clocks/IDs belong in composition roots.

Mutable resources have a positive integer `revision`, initially 1. Mutations compare the expected revision and increment it once. `updated_at` never decreases even if a wall clock moves backward. A timestamp alone is not a concurrency token. Public numbers and revisions are bounded to signed 32-bit positive values; allocation/revision exhaustion fails rather than wrapping.

## Principals and actor references

`principals` has `id`, `kind` (`user` or `staff`), `display_name`, `status` (`active`, `suspended`, `deleted`), `created_at`, and `revision`. A User and Staff principal remain distinct even when their email addresses match. Deleted principals retain a tombstone ID to preserve authorship/audit references; display/personal data is removed by the controlled retention workflow.

`identities` binds a principal to an authentication identity by `(provider, issuer, subject)` with a unique constraint. Provider/issuer/subject values are not public DTO fields. Secrets and recoverable credentials do not belong in these metadata columns: module 03/04 adds reviewed hashing/encryption-specific records. Staff external identity uses exact issuer+subject, never an email join. Identity linking is explicit and auditable.

An event actor is either a principal ID or a named system actor; exactly one is present. Principal references use foreign keys and do not cascade away history. System actor names are fixed application service identifiers, not user-supplied display names. A stored actor reference is attribution, not permission to execute an operation.

## MVP records

| Record | Main fields and invariants | Owner |
| --- | --- | --- |
| Project | ID, unique normalized slug, name, visibility (`public`/`private`), status (`active`/`archived`), next Issue number, revision, creation/update instants | 04/06 |
| Project role | Project + Staff principal, role (`triage`/`maintainer`/`administrator`), granted-at; one current grant per principal/project; User principals cannot hold Staff grants | 04 |
| Issue | ID, project, number, title, canonical Markdown body, state, close reason, author, type/milestone, revision, timestamps, moderation/deletion markers, last mutation ID | 06 |
| Comment | ID, project, Issue, author, Markdown body, revision, timestamps, moderation/deletion markers | 06 |
| Comment history | Immutable comment + revision, editor, prior Markdown content and change time; access restricted alongside moderation policy | 06 |
| Issue type | ID, project, unique name, description, icon, color, position, enabled, revision | 06 |
| Label | ID, project, unique normalized name, description, color, revision | 06 |
| Issue label | Unique project + Issue + label; composite foreign keys prevent cross-project assignments | 06 |
| Issue assignee | Unique project + Issue + Staff principal; assignee must have current project membership when the application writes it | 06 |
| Milestone | ID, project, title, description, state (`open`/`closed`), nullable due date, revision; counts derived by bounded queries | 06 |
| Reaction | Actor + Issue or comment + allowlisted reaction; one target only; unique per actor/target/reaction, project-consistent | 06 |
| Issue form | ID, project, name, schema version, bounded JSON field definition, enabled, revision | 07 |
| Issue template | ID, project, name, Markdown body, enabled, revision | 07 |
| Form submission | Issue + form version and bounded structured values; generated Markdown remains canonical Issue content | 07 |
| Timeline event | Immutable event ID, project/Issue, aggregate revision, action, actor, timestamp, bounded safe metadata | 06/09 |
| Security audit | Immutable ID, project (nullable for deployment-wide actions), actor, action, target reference, result, request ID, timestamp, bounded safe metadata | 03 |
| Upload intent | ID, principal, project, unique opaque object key, declared media type/size bound, expiry, state, verified object version/checksum, revision | 07 |
| Attachment | ID, upload intent, Issue/comment target, canonical immutable object identity, media type/size, policy state; no persistent signed URL | 07 |
| Plugin installation | ID, project/deployment scope, plugin ID/version, enabled, manifest version, revision; no plaintext secret settings | 05 |
| Plugin metadata | Installation + namespace + owner reference + key, bounded versioned JSON value; Core permissions remain authoritative | 05 |
| Outbox | Unique event ID, aggregate/project identity, versioned event kind/payload, creation/available time, attempts, lease/delivery metadata | 02/09 |
| Mutation receipt | Unique principal/project/operation/key hash, payload hash, mutation ID, safe result snapshot, creation/expiry; atomic with mutation/events | 02 |

All MVP records above now have independent D1 and PostgreSQL mappings: 25 physical tables, including immutable `issue_form_versions`. The migration histories are described in [the migration workflow](development/MIGRATIONS.md). These foundations do not implement feature endpoints, authorization, upload verification or plugin execution; their owning modules must supply those services. Post-MVP relation/subscription/job tables remain deferred.

Staff grants carry a constrained `principal_kind = staff` composite reference. Issue assignees reference a project grant, so revocation must remove assignments in the same authorized transaction before deleting the grant. Labels/types use a stored application-normalized `name_key` for project uniqueness; module 06 owns the normalization algorithm and display validation. Integer flags store 0/1 in both dialects. Reactions permit exactly one Issue/comment target and have one row per principal/target/allowlisted reaction. Forms keep immutable numbered definitions; a submission references the exact definition in the same project.

Upload intents bind principal/project/object key, declared type, safe-integer size bound, expiry and revision. Reserved states are `pending`, `uploaded`, `finalized`, `expired`, and `rejected`; finalized metadata must include verified version, checksum and actual size. Attachments reference one intent and exactly one same-project Issue/comment. These constraints do not substitute for module 07's object verification, immutable finalization and current authorization. Its policy states are `pending`, `ready`, `quarantined`, and `deleted`.

Plugin installations have one explicit project or deployment scope, unique plugin identity within that scope, versioned manifest metadata and an enable flag. Namespaced plugin metadata references the same installation scope and has bounded versioned JSON. Owner references are not authorization capabilities. Secrets and rendered Markdown artifacts have no columns here. Calendar due-date shape is stored independently of instants; module 06 validates actual calendar dates at its input boundary.

## Issue invariants

The only states are `open` and `closed`. An open Issue has null `closed_at` and null close reason. A closed Issue has a close instant and one reason: `completed`, `not_planned`, `duplicate`, `invalid`, `cannot_reproduce`. A duplicate reason does not grant access to the referenced Issue; structured duplicate relations arrive in module 14.

Titles have 1–200 Unicode code points after trimming. Canonical Markdown bodies have at most 32,768 Unicode code points and must fit endpoint byte limits. Original Markdown, not rendered HTML, is canonical. No raw Markdown is written to operational logs or outbox payloads by default. Renderer/sanitizer policy belongs to module 07.

Every Issue, comment, label, type, milestone, attachment and relation belongs to one project. Physical foreign keys use `(project_id, id)` when both sides are project-owned. Application authorization is still required; foreign keys only protect integrity. Cross-project Issue relations are deferred until an explicit module 14 policy; initial metadata references and attachments cannot cross projects.

## Transactions, retries and visibility

Repository interfaces express complete mutation intents, not database transaction callbacks. `createIssue` allocates the number and writes the Issue, timeline event, optional required audit entry, outbox event and safe mutation receipt in one atomic outcome. `editIssue` conditionally changes a revision with the same side records. Success means all required rows are durable; any failed constraint or stale write leaves none of that attempted mutation's rows.

D1 executes supported prepared-statement batches. Conditional zero-row updates must trigger a database constraint failure before any receipt/event can commit; do not treat zero affected rows as automatic rollback. PostgreSQL uses a checked transaction and row locking for number allocation. Both adapters return the same conflict/not-found/replay semantics. No external network call, blob write or plugin callback runs inside these transactions.

Idempotency scope is `(principal_id, project_id, operation, key_hash)`. Callers hash a 16–128-character ASCII key and a canonical payload with SHA-256; the payload includes the expected revision for updates. Keys and payload hashes are opaque digests in persistence, never credentials. A same-key/same-payload successful retry returns the original safe result snapshot; a different payload returns `IDEMPOTENCY_CONFLICT`. Current authorization must be checked again before returning a receipt. Default receipt validity is 24 hours. An expired retained receipt returns `IDEMPOTENCY_EXPIRED`; clients must use a new key and may not assume an old retry is safe after retention cleanup. Cleanup is bounded and owned by module 09; no automatic unbounded purge exists here.

After an ambiguous network failure, retry with the same key. A caller must not retry a stale revision with a changed payload under the same key. Automatic retry is limited to transient transaction/busy failures, with bounded attempts/backoff; domain conflicts are returned immediately. The foundational adapters surface transient failures for a later request policy rather than retrying arbitrary SQL endlessly.

Reads use the writer/primary. D1 read replication stays disabled; no replica session is assumed. A committed mutation is visible to the next repository read. Enabling replicas later requires an ADR and tests proving read-after-write plus authorization/revocation freshness.

## Pagination and indexes

The initial Issue list orders by `(created_at DESC, id DESC)` within one project, optionally filtered by state. Equal timestamps are ordered by lowercase UUID text; PostgreSQL UUID byte ordering and canonical lowercase hexadecimal text ordering agree. Page size defaults to 40 and is capped at 100. Fetch at most `limit + 1`, return `limit`, and issue a cursor only when more results exist. No list performs a total count or per-row relation query. Repository list rows exclude the full Markdown body and return metadata; module 07 adds the bounded, versioned plain-text preview specified by the [content plan](plan/modules/07-content-and-attachments.md). Detail reads retain canonical Markdown for the authorized representation pipeline.

Indexes match project/created/id and project/state/created/id. Issue number lookups use the unique project/number index. Timeline uses project/Issue/time/id; pending outbox uses delivery state/available time/id. Future label/assignee/type/milestone filters add their matching indexes with the feature migration. Detail hydration uses a fixed number of bounded queries, never one relation query per list item.

Search mappings are planned, not public SQL: D1 uses an FTS5 table keyed by Issue ID with title and the versioned plain-text projection; PostgreSQL uses that projection in `tsvector` plus GIN. Canonical relational data remains authoritative. Module 08 defines language/tokenizer/ranking parity and module 09 dispatches updates. Search results must recheck current visibility/moderation; an index hit is never authorization.

## Deletion and retention

Archive a project before controlled deletion. User content deletion/moderation replaces public content with a tombstone while preserving immutable identity/number and permitted timeline attribution. Hidden/redacted content and history are staff-restricted; public list/search/detail must not leak old content through projections or event metadata. Actual content retention durations and legal-erasure operations must be configured and implemented by the owning modules; no silent destructive default is introduced here.

Security audit is append-only to ordinary application operations. Controlled privacy/legal cleanup is a separate audited process; no API edits or deletes individual audit entries. Outbox delivery and idempotency expiry do not delete security audit. Principal removal must preserve actor references via tombstones.

## Reserved extension points

Module 14 adds directed typed Issue relations (unique source/target/type), one-parent hierarchy with cycle/depth checks, and saved views containing versioned structured search ASTs. Module 15 adds subscriptions, notifications and bounded jobs with replay-safe checkpoints. Module 05/16 adds namespaced plugin-owned metadata and capabilities. Reserve stable IDs, event versions, project scope and transaction intents now; do not create unused relation/subscription/job tables or expose their endpoints in this phase.
