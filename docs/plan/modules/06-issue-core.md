# 06 — Projects, issues, discussion, and triage backend

Phase: MVP backend  
Prerequisites: 05 complete.  
Progress: [Session log and current status](../progress/06-issue-core.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Deliver the complete MVP issue-tracking API on both profiles. Public APIs, database contracts, and auditable mutations come before frontend screens.

## Ordered checklist

### Step 06.1 — Implement project and taxonomy services

- [ ] **06.1a** Implement project create/read/configure/archive or delete behavior according to the data-retention decision, with no Git repository dependency.
- [ ] **06.1b** Implement labels, configurable Issue Types, assignee eligibility, and milestones with state/due date and bounded progress counts.
- [ ] **06.1c** Enforce per-project name/slug uniqueness, reference ownership, disabled/removed taxonomy behavior, permissions, and staff configuration audits.

### Step 06.2 — Implement the Issue lifecycle

- [ ] **06.2a** Implement create/list/detail/edit Issue with project-local number allocation, raw Markdown, author, type, labels, assignees, milestone, timestamps, and revision checks.
- [ ] **06.2b** Implement Open/Closed, close reasons, reopen, ownership rules, and triage actions without adding arbitrary workflow states.
- [ ] **06.2c** Keep mutations, required timeline/audit records, and outbox events atomically consistent. Validate idempotency and return stable conflict errors.
- [ ] **06.2d** Implement batched relation loading and explicit projections so list/detail endpoints avoid N+1 and unnecessary private data.
- [ ] **06.2e** Specify cache eligibility and invalidation/version changes for public representations; keep personalized and permission-sensitive responses out of shared caches.

### Step 06.3 — Implement discussion and timeline

- [ ] **06.3a** Implement comments with stable permalinks, create/edit history, owner/staff permissions, moderation/redaction, and the agreed deletion/retention behavior.
- [ ] **06.3b** Implement Issue and Comment reactions with allowed values, uniqueness, idempotent add/remove, bounded counters, and anti-abuse limits.
- [ ] **06.3c** Implement one cursor-paginated timeline merging comments and state/taxonomy/assignment/edit events with stable ordering and safe actor DTOs.
- [ ] **06.3d** Keep mentions, comment size, label/assignee cardinality, and event generation bounded. Emit normalized subscription/notification events for later use without synchronous fan-out.
- [ ] **06.3e** Expose shared schemas and OpenAPI for every operation, including failures and permission requirements.

## Verification and acceptance

- [ ] **06.V1** Run the HTTP workflow: project → create → list → comment → react → label/assign/type/milestone → close → reopen → timeline, on both deployments.
- [ ] **06.V2** Test all principal classes, own-versus-others editing, cross-project IDs, removed assignees/taxonomy, hidden/moderated content, and direct API access.
- [ ] **06.V3** Test concurrent creates/edits/reactions, duplicate requests, rollback after event failure, and timeline pagination under equal timestamps.
- [ ] **06.V4** Compare query counts and indexed plans for representative list/detail fixtures, including large discussions; verify bounds and safe cache isolation.

## Source coverage

PRODUCT §§6–17, 29; SECURITY §§35–39, 62–66, 114–116, 133–134, 139–141; PERFORMANCE §§5–15, 20–24, 55–57.

