# HyperBug master progress

Last updated: 2026-09-18 (Markdown representation/transport/pagination direction recorded).

**Current state: module 00 is complete and G0 has passed; modules 01 and 02 are Complete with committed clean-checkout and hosted-CI evidence. Module 07 has an accepted content representation policy but no implementation.**

**Phase 01/02 implementation is complete; subsequent work follows the next eligible backend module when authorized.** Use the registered development skill; SPA work still waits for G1.

## Module status

| ID | Module | Status | Evidence and handoff |
| --- | --- | --- | --- |
| 00 | [Project maintenance and development guidance skills](modules/00-project-guidance-skills.md) | Complete | [Session record](progress/00-project-guidance-skills.md) |
| 01 | [Backend workspace and runtime foundation](modules/01-backend-foundation.md) | Complete | [Session record](progress/01-backend-foundation.md) |
| 02 | [Public contracts, domain model, and database foundations](modules/02-contracts-and-data.md) | Complete | [Session record](progress/02-contracts-and-data.md) |
| 03 | [Core security, cryptography, audit, and abuse controls](modules/03-security-foundation.md) | Not started | [Session record](progress/03-security-foundation.md) |
| 04 | [Authentication, identity, and project authorization](modules/04-identity-and-access.md) | Not started | [Session record](progress/04-identity-and-access.md) |
| 05 | [Plugin protocol, SDK, registry, and trusted runtime](modules/05-plugin-foundation.md) | Not started | [Session record](progress/05-plugin-foundation.md) |
| 06 | [Projects, issues, discussion, and triage backend](modules/06-issue-core.md) | Not started | [Session record](progress/06-issue-core.md) |
| 07 | [Markdown policy, issue forms, templates, and attachments](modules/07-content-and-attachments.md) | Not started | [Session record](progress/07-content-and-attachments.md) |
| 08 | [Structured search, filters, and query performance](modules/08-search-and-query.md) | Not started | [Session record](progress/08-search-and-query.md) |
| 09 | [Outbox delivery, queues, durable workflows, and cleanup](modules/09-async-and-workflows.md) | Not started | [Session record](progress/09-async-and-workflows.md) |
| 10 | [Backend acceptance and public API client](modules/10-backend-acceptance.md) | Not started | [Session record](progress/10-backend-acceptance.md) |
| 11 | [Static web application, authentication client, and UI foundation](modules/11-static-web-foundation.md) | Not started | [Session record](progress/11-static-web-foundation.md) |
| 12 | [Public feedback, discussion, and staff web workflows](modules/12-web-product-workflows.md) | Not started | [Session record](progress/12-web-product-workflows.md) |
| 13 | [MVP release, deployment, and maintenance readiness](modules/13-mvp-release-and-operations.md) | Not started | [Session record](progress/13-mvp-release-and-operations.md) |
| 14 | [Post-MVP issue relations, hierarchy, and saved views](modules/14-relations-and-saved-views.md) | Not started | [Session record](progress/14-relations-and-saved-views.md) |
| 15 | [Post-MVP subscriptions, notifications, bulk actions, and data jobs](modules/15-notifications-and-bulk-jobs.md) | Not started | [Session record](progress/15-notifications-and-bulk-jobs.md) |
| 16 | [Post-MVP official plugins and isolated integration APIs](modules/16-official-integrations.md) | Not started | [Session record](progress/16-official-integrations.md) |

All 16 module 00 guidance checklist items are complete. Module 01 has reproducible builds and runtime/local-service tests; module 02 has 25-table dual schemas, atomic repositories, upgrade tests and measured query plans. Evidence-backed checkboxes are tracked in each detailed plan. Foundation acceptance does not open G1; modules 03–16 have no completed implementation gate.

## Gate status

| Gate | Required evidence | Current state |
| --- | --- | --- |
| G0 — Guidance ready | Module 00 skills, registration, and validation | Passed; [evidence](evidence/00-guidance-validation.md) |
| G1 — Backend accepted | Module 10.G1–10.G5 on both profiles | Not passed; SPA development must wait |
| G2 — MVP accepted | Module 13.G1–13.G5 including deployment/recovery evidence | Not passed |
| Post-MVP backend gates | Backend acceptance before UI in 14, 15, and each provider in 16 | Not started |
| Markdown representation policy | Module 07 policy specification and ADR; implementation, determinism and derivation-cost evidence not yet produced | Direction accepted ([ADR 0003](../decisions/0003-markdown-representation-and-pagination.md), [MARKDOWN-POLICY](../MARKDOWN-POLICY.md)); unproven |

## Current decisions and open implementation questions

- Required order: guidance skills first, backend second, SPA only after the backend acceptance gate.
- Both Cloudflare-native and Node/PostgreSQL/S3 self-host profiles are required, following TECH-STACK.
- English is the default for all new project documentation; historical initial-architecture inputs remain unchanged.
- Exact dependency versions/adapter names, data model concurrency details, auth-library suitability, no-email account recovery, upload immutability, and measured performance budgets remain implementation tasks. See [SOURCES](SOURCES.md#decisions-to-close-during-execution).
- No deployed service, tested cloud account, live provider compatibility, or performance result is claimed by this planning package.
- Content representation is fixed as direction, not as proven implementation: raw Markdown is the only stored body form, the safe representation is derived per request, and the plain-text projection is the only persisted derivative. See [ADR 0003](../decisions/0003-markdown-representation-and-pagination.md) and [MARKDOWN-POLICY](../MARKDOWN-POLICY.md).

## Planning deliverables

- [x] Read the five initial-architecture inputs and identify source refinements and MVP boundaries.
- [x] Read and execute the requested modern-web-guidance skill using search followed by retrieval.
- [x] Consult Context7 for critical Elysia, Drizzle, and Cloudflare implementation assumptions.
- [x] Create the master plan, execution protocol, source/research register, and coverage/handoff map.
- [x] Create 17 ordered module plans and 17 matching progress documents.
- [x] Specify a mandatory progress/change-summary/next-session-caution entry for every affected session.
- [x] Validate relative links, module/progress pairing, checklist IDs, scope/order, and English documentation content.

These checkboxes track this documentation task only, not product implementation.

## Session log

### 2026-09-17 — Detailed plan creation

- Progress: Converted the initial architecture into modules 00–16 with step-level checklists, prerequisites, acceptance cases, and explicit backend/frontend gates.
- Change summary: Added a planning package under `docs/plan/`; separated MVP from post-MVP relations, async user features, and optional integrations.
- Research: Retrieved four modern-web guides and queried Context7 for Elysia, Drizzle, and Cloudflare. Recorded findings, stale/ambiguous source details, and unverified runtime assumptions in SOURCES.
- Files/artifacts: Master documents plus `modules/` and `progress/` pairs; individual records contain module-specific next-session cautions.
- Verification: A one-off Python 3 documentation validator passed for all 39 Markdown files, 17 plan/progress pairs, 212 relative links/anchors, and 316 unique implementation checklist IDs. It also checked required session fields, absence of CJK prose, final newlines, whitespace, and that implementation checkboxes remain unchecked. Manual dependency/scope review and `git diff --check` passed. Untracked plan files were covered by the Python checks. No application tests run; no application code changed.
- Decisions/deviations: Applied the user's guidance-first/backend-first/English/session-log requirements and TECH-STACK's explicit refinements. Did not create the future guidance skills or change the initial architecture.
- Blockers: None for planning. Implementation checks may require installable dependencies, local services, staging access, or provider test accounts.
- Next action: Begin module 00.1 in a subsequent implementation session.
- Next-session cautions: Read EXECUTION and the module 00 record first. Preserve unrelated existing workspace changes; the repository already contained modified/untracked files before this documentation work.

### 2026-09-17 — Module 00 completed

- Progress: Created and validated the two English project guidance skills; G0 passed and module 01 became Ready.
- Change summary: Added root AGENTS, two SKILL.md entrypoints with UI metadata, eight focused references, and a requirement/verification report. Updated module 00 checklist/progress, module 01 readiness, and plan navigation/coverage.
- Verification: Both bundled skill validators, local link/reachability/metadata/English/whitespace/source-preservation checks, and three manual task walkthroughs passed. See [validation evidence](evidence/00-guidance-validation.md) and [module 00 session details](progress/00-project-guidance-skills.md). No application tests or deployment were performed.
- Decisions/deviations: Repository-owned skills share references and retain automatic invocation. No source-baseline deviation; English, session logging, and backend-before-SPA gates are enforced in guidance.
- Blockers: None for module 00; module 01 still needs actual dependency/runtime verification.
- Next action: Begin 01.1a in the next backend implementation task.
- Next-session cautions: G0 proves guidance readiness, not backend readiness. Preserve existing unrelated workspace changes; no package scripts or production resources exist from this task.

### 2026-09-18 — Markdown representation, transport and pagination direction

- Scope and checklist IDs: Cross-module design/policy session owned by module 07 (`07.1a`, `07.1f`–`07.1i`, `07.V6`–`07.V7`), with a downstream contract adjustment in module 12.2a/12.V5. No implementation checklist item was completed. Module 07 moved from `Not started` to `In progress (specification and policy only)`.
- Progress: Resolved the requested content-design question. The server stores raw Markdown only and derives every rendered representation per request; sanitized HTML exists solely for non-browser consumers and is never transported to the SPA; the plain-text projection is the single persisted derivative because search, notifications, list previews and moderation views consume it; derivation stays bounded through the existing cursor pagination contract. Persisting derived HTML/tree and transporting HTML as the client's only body were evaluated and rejected with recorded reasons.
- Change summary: Added the content policy specification (`docs/MARKDOWN-POLICY.md`) and the ADR that the security reference requires for pagination/derived-data architecture. Extended module 07 with four implementation items and two acceptance items, aligned module 12 to render the server-derived representation without client parsing or an HTML sink, added coverage rows, and recorded the direction in this file without changing any initial-architecture source.
- Files/artifacts: `docs/MARKDOWN-POLICY.md` (new); `docs/decisions/0003-markdown-representation-and-pagination.md` (new); `docs/plan/modules/07-content-and-attachments.md`; `docs/plan/modules/12-web-product-workflows.md`; `docs/plan/COVERAGE.md`; `docs/plan/README.md` (specification index); `docs/plan/progress/07-content-and-attachments.md`; this file.
- Verification: Documentation-only session. `python3 /tmp/hyperbug-validate-docs.py` (one-off, not committed) scanned 71 Markdown files and checked 390 relative links and anchors, 17/17 plan-progress pairs, 322 unique checklist IDs, checklist/status consistency for every module, presence of the policy and ADR artifacts, required session-entry fields, markdown-hard-break-aware whitespace, final newlines and dash usage in the new documents. Result: `RESULT: PASS`. No application test, build, runtime check or deployment ran because no application behavior changed.
- Decisions and deviations: Adopted [ADR 0003](../decisions/0003-markdown-representation-and-pagination.md). It refines PRODUCT §17, SECURITY §§53–66 and PERFORMANCE §§20–21/76 without relaxing them; a measured failure of the derivation budget must return as an ADR amendment rather than an undocumented derived cache. No normative baseline text was modified.
- Blockers/open questions: The derivation budget is unmeasured, so 07.1i and 07.V7 stay open until both profiles are benchmarked on real fixtures; per-request derivation is accepted direction but unproven. The Issue Form YAML scope question from the earlier 2026-09-18 review remains open and unaffected.
- Next actions: Add the concrete allowlist and initial `content-policy` version identifier to `docs/MARKDOWN-POLICY.md`; implement 07.1b–07.1c; then implement and measure 07.1f–07.1i on both profiles. Module 01/02 work in progress is unchanged.
- Next-session cautions: Do not introduce a persisted rendered body, a rendered-body cache or a client-side sanitizer while implementing 07.1. Representation validators must include the kind and policy version, stored cursors must survive a policy change, and the read path must not re-derive the plain-text projection.

## Update rule

Update this file whenever module/gate status, scope, or major blockers change. Every affected session must also append its detailed handoff to the relevant per-module progress record, even if master status remains unchanged.


### 2026-09-18 — Phase 01/02 implementation and local acceptance evidence

- Progress: Implemented the dual-runtime workspace and full MVP persistence mappings; no SPA or later feature endpoints. Independent module 02 work follows ADR 0001 while runtime acceptance remains open.
- Verification: Frozen installs, both type configurations/builds, lint/format/boundaries, scans, migration histories and 77 ordinary tests passed in an earlier isolated source copy. The latest current-tree suite passes 80 tests without expected failures after the write-driven workerd disconnect diagnosis and two database regressions; one earlier intermittent Node connection reset remains recorded. See [01 evidence](evidence/01-foundation-validation.md) and [02 evidence](evidence/02-data-foundation-validation.md).
- Decisions/blockers: No security baseline or delivery gate was relaxed. Hosted CI and live deployments are unverified. Preserve the independently authored module 07 content-policy direction; list queries now exclude full Markdown bodies.
- Next action: Complete phase-specific checklist/documentation audit and resolve remaining module 01 acceptance gaps. Per-module records contain exact artifacts, commands and cautions.

### 2026-09-18 — Phase 01/02 completion

- Progress: Modules 01 and 02 are Complete. Workspace/lockfile and dual-runtime/data foundations are committed as `bcd417c` and published on `codex/phase-01-02`.
- Verification: A separate clean committed checkout and [hosted run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101) passed the required quality, Node, workerd and PostgreSQL checks; 80 tests pass with no expected failures. Per-phase evidence maps every checklist ID to its implementation and verification.
- Decisions/blockers: The idle-stream disconnect observation is explained by write-driven workerd detection; bounded heartbeats prove incoming abort/cleanup. No phase acceptance blockers remain. G1 stays closed; no later feature endpoints, SPA, merge or deployment occurred.
- Next action: Hand off the completed phases. Subsequent authorized work follows the next eligible backend module and existing gates. Preserve unrelated root/content-policy/install-script work.
