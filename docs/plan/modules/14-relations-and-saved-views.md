# 14 — Post-MVP issue relations, hierarchy, and saved views

Phase: Post-MVP core  
Prerequisites: 13 MVP gate complete. Implement this module's backend and acceptance before its UI.  
Progress: [Session log and current status](../progress/14-relations-and-saved-views.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Add the first post-MVP core capabilities without introducing project boards or a workflow designer.

## Ordered checklist

### Step 14.1 — Specify invariants and migrations

- [ ] **14.1a** Extend DATA-MODEL/API contracts for parent/child, blocks/blocked-by, duplicate, and related relations with canonical stored direction and derived inverse views.
- [ ] **14.1b** Decide cross-project rules, one-parent semantics, depth/fan-out limits, cycle handling for each relation type, duplicate target behavior, and deletion/moderation effects.
- [ ] **14.1c** Define saved-view ownership/sharing and validated query/filter/sort/columns/grouping/density representation, without arbitrary SQL or executable expressions.
- [ ] **14.1d** Add reviewed D1 and PostgreSQL migrations, indexes, repository contracts, timeline events, and outbox changes.

### Step 14.2 — Implement and accept the backend

- [ ] **14.2a** Implement child creation/link/unlink/reparent and bounded progress aggregation.
- [ ] **14.2b** Implement dependency/duplicate/related add/remove/read APIs with authorization on both endpoints of each relation.
- [ ] **14.2c** Enforce cycle/invariant checks under concurrent mutations using a proven per-adapter strategy; do not rely only on a pre-write check.
- [ ] **14.2d** Implement saved-view CRUD and execution via the existing AST/permission engine; reject stale or unsupported query versions safely.
- [ ] **14.2e** Test deep/wide graphs, concurrent reciprocal links, hidden targets, deleted issues, cursor pagination, and saved-view ownership on both profiles.
- [ ] **14.2f** Benchmark expansion/aggregation, verify limits/indexes, update OpenAPI/client, and record backend acceptance before starting Step 14.3.

### Step 14.3 — Implement and accept the frontend

- [ ] **14.3a** Refresh relevant modern-web and library guidance, then build accessible relation pickers, hierarchy navigation, dependency/duplicate indicators, and progress views.
- [ ] **14.3b** Build save/update/share/apply view interactions with URL synchronization and permission-aware errors.
- [ ] **14.3c** Run both-profile E2E, keyboard/focus checks, large-graph rendering checks, and core workflow regression.
- [ ] **14.3d** Reuse the module 13 release/recovery procedure for this increment and record migration/rollback impact.

## Acceptance evidence

Backend tests prove graph invariants and permission isolation under concurrency. Users can navigate relations and share permitted saved views without unbounded reads or regressions to the MVP path.

## Source coverage

PRODUCT §§12–13, 21, 30; SECURITY §§35–39, 64–66, 141; PERFORMANCE §§6–19, 55–57, 66.

