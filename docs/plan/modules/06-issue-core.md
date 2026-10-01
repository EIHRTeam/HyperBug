# 06 — Projects, issues, discussion, and triage backend

Phase: MVP backend  
Prerequisites: 05 complete.  
Progress: [Session log and current status](../progress/06-issue-core.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Deliver the complete MVP issue-tracking API on both profiles. Public APIs, database contracts, and auditable mutations come before frontend screens.

**Deferred Phase 03 scope owned here (2026-09-30 re-scope):** the project-dimension rate-limit categories deferred from 03.3c/03.3d are wired to this module's project routes with the frozen category-dimension policy from module 03; production budget numbers are measured under the staging real-load budget milestone.

**Execution override (2026-09-21): [All audit work is suspended — no audit for now](../AUDIT-SUSPENSION.md). Continue the non-audit portions of this module; suspended work remains unchecked.**

## Ordered checklist

### Step 06.1 — Implement project and taxonomy services

- [x] **06.1a** Implement project create/read/configure/archive or delete behavior according to the data-retention decision, with no Git repository dependency. Accepted 2026-10-01: Staff-only creation with the first administrator grant written atomically with the project row, slug uniqueness, visibility-aware reads (private projects invisible: 404), revision-conditional sensitive configuration, and archive as the destructive surface per the DATA-MODEL archive-before-delete direction (physical deletion belongs to the controlled retention workflow). Verified on workerd/D1 and Node/PostgreSQL route journeys plus unit validators.
- [x] **06.1b** Implement labels, configurable Issue Types, assignee eligibility, and milestones with state/due date and bounded progress counts. Accepted 2026-10-01: per-project labels/issue types/milestones under `taxonomy:manage` (maintainer-or-higher), name-key uniqueness with preserved display spelling, disabled issue types, revision-conditional updates, reference-checked removals, real calendar due dates and milestone progress derived from one bounded grouped query; assignee eligibility is enforced by the schema's membership foreign key and verified at assignment time by the 06.2 routes. Verified on both profiles.
- [ ] **06.1c** **Audit portion suspended — no audit for now.** Enforce per-project name/slug uniqueness, reference ownership, disabled/removed taxonomy behavior, permissions, and staff configuration audits. Non-audit scope delivered with 06.1a/06.1b (slug/name-key uniqueness, composite-key reference ownership, referenced-entry removal refusal, disabled-type behavior, permission ladder); the staff configuration audits stay suspended and the item stays unchecked.

### Step 06.2 — Implement the Issue lifecycle

- [x] **06.2a** Implement create/list/detail/edit Issue with project-local number allocation, raw Markdown, author, type, labels, assignees, milestone, timestamps, and revision checks. Accepted 2026-10-01: the module-02 repository contract extended with taxonomy-bearing creation, eight mutation operations with idempotency receipts, batched relation hydration and moderation-aware reads, exposed through the shared routes on both profiles.
- [x] **06.2b** Implement Open/Closed, close reasons, reopen, ownership rules, and triage actions without adding arbitrary workflow states. Accepted 2026-10-01: close-with-reason/reopen under `issue:close`, labels/type/milestone under `issue:triage`, assignees under `issue:assign` (current project membership required), own-content editing with the moderation lock, two states only.
- [ ] **06.2c** **Audit portion suspended — no audit for now.** Keep mutations, required timeline/audit records, and outbox events atomically consistent. Validate idempotency and return stable conflict errors. Non-audit scope accepted 2026-10-01: every mutation writes its aggregate row, timeline event and outbox row in one atomic transaction with a 24-hour idempotency receipt; same-value set operations are no-ops without events; `REVISION_CONFLICT`/`IDEMPOTENCY_CONFLICT`/`IDEMPOTENCY_EXPIRED` are stable closed errors. The audit-record portion stays suspended and the item stays unchecked.
- [x] **06.2d** Implement batched relation loading and explicit projections so list/detail endpoints avoid N+1 and unnecessary private data. Accepted 2026-10-01: list projections exclude the Markdown body; labels/assignees hydrate in two bounded queries per page through `relations()`; detail keeps canonical Markdown only.
- [x] **06.2e** Specify cache eligibility and invalidation/version changes for public representations; keep personalized and permission-sensitive responses out of shared caches. Accepted 2026-10-01: the cache-eligibility specification in API-CONVENTIONS fixes today's all-no-store baseline, the future anonymous-public eligibility class, the revision-derived invalidation/version contract and the permanently ineligible classes; no shared cache is enabled.

### Step 06.3 — Implement discussion and timeline

- [x] **06.3a** Implement comments with stable permalinks, create/edit history, owner/staff permissions, moderation/redaction, and the agreed deletion/retention behavior. Accepted 2026-10-01: body-only comments with 24-hour idempotency receipts, ascending `(created_at, id)` cursor pagination, immutable per-revision history (staff-only), own-content editing with the moderation lock, visible/hidden/redacted moderation, and tombstone deletion that keeps the body staff-restricted. Verified on both profiles.
- [x] **06.3b** Implement Issue and Comment reactions with allowed values, uniqueness, idempotent add/remove, bounded counters, and anti-abuse limits. Accepted 2026-10-01: the eight-value allowlist, the schema's unique actor/target/value constraint driving idempotent add/remove (`added`/`present`/`removed`/`absent`), bounded grouped count queries, and `reaction`-category rate admission on principal+project. Verified on both profiles.
- [x] **06.3c** Implement one cursor-paginated timeline merging comments and state/taxonomy/assignment/edit events with stable ordering and safe actor DTOs. Accepted 2026-10-01: the UNION read merges timeline_events and comments in ascending `(created_at, id)` order with cursor pagination, audience-filtered hidden/deleted rows, comment bodies only for visible rows, and actor DTOs limited to principal ids and fixed system-actor names. Verified on both profiles.
- [x] **06.3d** Keep mentions, comment size, label/assignee cardinality, and event generation bounded. Emit normalized subscription/notification events for later use without synchronous fan-out. Accepted 2026-10-01: comment bodies bounded to 1–32768 code points, label/assignee cardinality bounded at 20/10, every mutation emits exactly one bounded normalized outbox event (`issue.*`/`comment.*` payloads carry ids only) with no synchronous fan-out; mention extraction is deferred to module 07's representation pipeline and inherits its bounds — nothing unbounded ships.
- [x] **06.3e** Expose shared schemas and OpenAPI for every operation, including failures and permission requirements. Accepted 2026-10-01: TypeBox contract schemas cover every project/taxonomy/issue/discussion operation and failure shape, and the permission requirements are documented per endpoint family in API-CONVENTIONS; the consolidated OpenAPI artifact remains 10.1a scope.

## Verification and acceptance

- [ ] **06.V1** Run the HTTP workflow: project → create → list → comment → react → label/assign/type/milestone → close → reopen → timeline, on both deployments.
- [ ] **06.V2** Test all principal classes, own-versus-others editing, cross-project IDs, removed assignees/taxonomy, hidden/moderated content, and direct API access.
- [ ] **06.V3** Test concurrent creates/edits/reactions, duplicate requests, rollback after event failure, and timeline pagination under equal timestamps.
- [ ] **06.V4** Compare query counts and indexed plans for representative list/detail fixtures, including large discussions; verify bounds and safe cache isolation.

## Source coverage

PRODUCT §§6–17, 29; SECURITY §§35–39, 62–66, 114–116, 133–134, 139–141; PERFORMANCE §§5–15, 20–24, 55–57.

