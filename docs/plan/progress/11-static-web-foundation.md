# 11 progress — Static web application, authentication client, and UI foundation

Plan: [Detailed checklist](../modules/11-static-web-foundation.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: MVP frontend
- Prerequisites: 10.G1–10.G5 all complete.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 11.1, after prerequisites are satisfied.
- Last updated: 2026-09-17.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 11.1 | Establish the static application | Not started | None yet |
| 11.2 | Implement the browser auth boundary | Not started | None yet |
| 11.3 | Build accessible reusable UI primitives | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 11.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

The frontend is a static SPA. Apply modern-web guidance with project-specific exceptions: no same-origin cookie API, SSR fallback, or persistent browser credentials.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 11; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for static web application, authentication client, and ui foundation.
- Files/artifacts: `docs/plan/modules/11-static-web-foundation.md`; `docs/plan/progress/11-static-web-foundation.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 11.1.
- Next-session cautions: The frontend is a static SPA. Apply modern-web guidance with project-specific exceptions: no same-origin cookie API, SSR fallback, or persistent browser credentials.

### 2026-09-20 — Capability-driven application states planned

- Scope and checklist IDs: Planning only. Added 11.1g and 11.V5. No implementation item was completed or checked.
- Progress: Recorded that the static application consumes the instance capability document, enables only available surfaces, and explains unavailable capabilities instead of failing.
- Change summary: Extended the module plan; the static SPA boundary, memory-only tokens and CSP requirements are unchanged, and no runtime code injection is introduced.
- Files/artifacts: `docs/plan/modules/11-static-web-foundation.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No frontend code or browser check ran.
- Decisions and deviations: Capability advertisement is presentation only and is never an authorization control.
- Blockers/open questions: 11.V5 depends on 04.2g and on the SPA existing after G1.
- Next actions: Continue 11.1 in order; consume the capability document when the API client is built.
- Next-session cautions: Never let the client infer capabilities from its own configuration or present a degraded instance as the standard profile.


### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: SPA prerequisite planning only; no implementation item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior static-web planning text; no SPA source was created.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: G1 remains closed.
- Next actions: Do not start Module 11 during the feature hold.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.
