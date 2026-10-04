# 10 progress — Backend acceptance and public API client

Plan: [Detailed checklist](../modules/10-backend-acceptance.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Not started
- Delivery scope: MVP backend gate
- Prerequisites: 00–09 complete. This is the mandatory gate before SPA development.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 10.1, after prerequisites are satisfied.
- Last updated: 2026-09-17.
- Blocking issues discovered: None during planning; prerequisite completion is still required.
- Evidence: Planning documents only; no implementation or runtime validation yet.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 10.1 | Complete public contracts and client | Not started | None yet |
| 10.2 | Execute the backend MVP acceptance matrix | Not started | None yet |
| 10.3 | Establish measurable performance and operational readiness | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Start the first unfinished item in 10.1.
3. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

A passing mocked API test is not evidence of Workers/D1/R2 or Node/PostgreSQL/S3 compatibility. Keep unavailable deployment checks explicitly blocked.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 10; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for backend acceptance and public api client.
- Files/artifacts: `docs/plan/modules/10-backend-acceptance.md`; `docs/plan/progress/10-backend-acceptance.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 10.1.
- Next-session cautions: A passing mocked API test is not evidence of Workers/D1/R2 or Node/PostgreSQL/S3 compatibility. Keep unavailable deployment checks explicitly blocked.

### 2026-09-20 — Minimum-tier acceptance separation planned

- Scope and checklist IDs: Planning only. Added 10.2f and 10.3g, and extended 10.1a to cover the instance capability document. G1's scope is unchanged and no checklist item was checked.
- Progress: Recorded that every acceptance environment states its deployment tier and quota headroom, that minimum-tier runs are labelled and excluded from the G1 evidence set, and that quota-aware measurements form their own evidence set.
- Change summary: Extended the module plan with the tier items, the OpenAPI amendment and a source-coverage pointer.
- Files/artifacts: `docs/plan/modules/10-backend-acceptance.md`; [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); this record.
- Verification: Documentation-only session; the package-wide validator result is in the master session entry. No acceptance run occurred and G1 remains closed.
- Decisions and deviations: The minimum tier is accepted by 13.G6 only and never substitutes for a gate item in this module.
- Blockers/open questions: Free-plan measurement access is required for 10.3g; without it the evidence stays explicitly missing.
- Next actions: Keep G1 scoped to the two first-class profiles; add the instance capability document during the OpenAPI consolidation in 10.1a.
- Next-session cautions: Never merge minimum-tier measurements into standard-profile baselines or cite them as G1 evidence.


### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: G1 planning only; no acceptance item.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Retained prior backend acceptance planning and verified that G1 was not marked passed by local tests.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: The defined deployed two-profile acceptance matrix remains incomplete.
- Next actions: Do not start the SPA; resume Module 10 only after its backend prerequisites and user direction.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-10-05 — Review remediation B3 verified

- Scope and checklist IDs: 10.2b/10.2e (B3 supporting evidence only).
- Progress: B3 complete locally; overall mission continues at B4. Existing module status/checklists and G1/G2/13.G6 are unchanged.
- Change summary: Expanded both-store negative/concurrency/migration cases; no full acceptance checkbox or G1 gate closes. Real-Free and Standard deployment evidence stay pending.
- Files/artifacts: Owning stores/routes/schema/tests and specifications listed in the [cross-module remediation record](../evidence/2026-10-05-review-remediation.md#b3-instance-roles-and-token-bound-assurance-2026-10-05). D1 0024/0025; PostgreSQL 0023/0024.
- Verification: Final local matrix **916 passed / 18 optional-provider skips** (349 unit, 1 contract, 121 Node, 262 workerd/D1 emulation, 183 real isolated PostgreSQL 18.6). Typecheck, lint, Drizzle check (old timestamp warnings), docs build, tracked/new-source formatting and diff checks pass. Root formatting flags only supplied untracked review files; reports untouched. No actual deployment/provider claim. Initial wiring/schema/fixture failures and focused primary-agent security review are recorded in the linked evidence.
- Decisions and deviations: Independent instance role and immutable presented-credential facts; configured default 300 s replaces hardcoded 900 s. No policy weakening, new protocol or new ADR required for B3; formal Minimum ADR remains B8.
- Blockers/open questions: None for B3. Independent Sonnet review unavailable (model not callable); no independent review claimed. Atomic account/role/plugin audit remains B4.
- Next actions: B4 audit transaction/failure cases, recovery-code step-up and passkey CAPTCHA forwarding, then B5–B15 in the approved order.
- Next-session cautions: Never stage SECURITY.md or supplied reviews; preserve historical migration/audit rows, apply schema before adapters, inspect upgrade role recipient, and require new passkey login for old tokens. No SPA or later-module audit resume.
