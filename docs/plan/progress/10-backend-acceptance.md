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
