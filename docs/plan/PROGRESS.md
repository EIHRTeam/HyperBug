# HyperBug master progress

Last updated: 2026-09-17.

**Current state: module 00 is complete and G0 has passed; backend application implementation has not started.**

**Next implementation action: module 01, Step 01.1 — verify the toolchain and establish backend workspace boundaries.** Use the registered development skill; SPA work still waits for G1.

## Module status

| ID | Module | Status | Evidence and handoff |
| --- | --- | --- | --- |
| 00 | [Project maintenance and development guidance skills](modules/00-project-guidance-skills.md) | Complete | [Session record](progress/00-project-guidance-skills.md) |
| 01 | [Backend workspace and runtime foundation](modules/01-backend-foundation.md) | Ready | [Session record](progress/01-backend-foundation.md) |
| 02 | [Public contracts, domain model, and database foundations](modules/02-contracts-and-data.md) | Not started | [Session record](progress/02-contracts-and-data.md) |
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

All 16 module 00 guidance checklist items are complete. Modules 01–16 retain unchecked implementation items; no application capability is claimed complete.

## Gate status

| Gate | Required evidence | Current state |
| --- | --- | --- |
| G0 — Guidance ready | Module 00 skills, registration, and validation | Passed; [evidence](evidence/00-guidance-validation.md) |
| G1 — Backend accepted | Module 10.G1–10.G5 on both profiles | Not passed; SPA development must wait |
| G2 — MVP accepted | Module 13.G1–13.G5 including deployment/recovery evidence | Not passed |
| Post-MVP backend gates | Backend acceptance before UI in 14, 15, and each provider in 16 | Not started |

## Current decisions and open implementation questions

- Required order: guidance skills first, backend second, SPA only after the backend acceptance gate.
- Both Cloudflare-native and Node/PostgreSQL/S3 self-host profiles are required, following TECH-STACK.
- English is the default for all new project documentation; historical initial-architecture inputs remain unchanged.
- Exact dependency versions/adapter names, data model concurrency details, auth-library suitability, no-email account recovery, upload immutability, and measured performance budgets remain implementation tasks. See [SOURCES](SOURCES.md#decisions-to-close-during-execution).
- No deployed service, tested cloud account, live provider compatibility, or performance result is claimed by this planning package.

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

## Update rule

Update this file whenever module/gate status, scope, or major blockers change. Every affected session must also append its detailed handoff to the relevant per-module progress record, even if master status remains unchanged.
