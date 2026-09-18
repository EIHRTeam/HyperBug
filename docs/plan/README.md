# HyperBug implementation plan

This directory turns the [initial architecture](../initial-architecture/) into an executable, module-based plan. All plans, progress records, project guidance skills, and new project documentation are written in English.

**The first implementation step is module 00: create project maintenance and development guidance skills. Backend work follows. SPA development starts only after the backend acceptance gate in module 10 passes.**

Module 00 has now created and validated the [development](../../.agents/skills/hyperbug-development/SKILL.md) and [maintenance](../../.agents/skills/hyperbug-maintenance/SKILL.md) skills. Consult master progress for current implementation status; the remaining checklists describe future work.

## Start here

1. Read [Master progress](PROGRESS.md), [Execution protocol](EXECUTION.md), and the latest progress entry for the next eligible module.
2. Read [Source decisions and research](SOURCES.md) and the applicable module's source sections.
3. Execute the earliest unfinished eligible checklist item. Read the applicable registered repository guidance skill.
4. Record progress, changed files, verification, and next-session cautions in every affected module's progress document during and at the end of every session.

## Specification index

Module 07 policies and their implementation items live in these English specifications rather than in this plan:

| Specification | Scope | Owner |
| --- | --- | --- |
| [MARKDOWN-POLICY](../MARKDOWN-POLICY.md) | Canonical Markdown storage, representation/transport kinds, determinism, derivation and pagination contract | 07.1 |
| [ADR 0003](../decisions/0003-markdown-representation-and-pagination.md) | Accepted direction for Markdown representation, transport and pagination | 07 |
| [DATA-MODEL](../DATA-MODEL.md), [API-CONVENTIONS](../API-CONVENTIONS.md), [API-OPERATIONS](../API-OPERATIONS.md) | Records, public contract, cursor rules and permission matrix | 02, 06–10 |

## Module index

| ID | Detailed plan | Delivery scope | Session record |
| --- | --- | --- | --- |
| 00 | [Project maintenance and development guidance skills](modules/00-project-guidance-skills.md) | MVP prerequisite | [Progress](progress/00-project-guidance-skills.md) |
| 01 | [Backend workspace and runtime foundation](modules/01-backend-foundation.md) | MVP backend | [Progress](progress/01-backend-foundation.md) |
| 02 | [Public contracts, domain model, and database foundations](modules/02-contracts-and-data.md) | MVP backend | [Progress](progress/02-contracts-and-data.md) |
| 03 | [Core security, cryptography, audit, and abuse controls](modules/03-security-foundation.md) | MVP backend | [Progress](progress/03-security-foundation.md) |
| 04 | [Authentication, identity, and project authorization](modules/04-identity-and-access.md) | MVP backend | [Progress](progress/04-identity-and-access.md) |
| 05 | [Plugin protocol, SDK, registry, and trusted runtime](modules/05-plugin-foundation.md) | MVP backend | [Progress](progress/05-plugin-foundation.md) |
| 06 | [Projects, issues, discussion, and triage backend](modules/06-issue-core.md) | MVP backend | [Progress](progress/06-issue-core.md) |
| 07 | [Markdown policy, issue forms, templates, and attachments](modules/07-content-and-attachments.md) | MVP backend | [Progress](progress/07-content-and-attachments.md) |
| 08 | [Structured search, filters, and query performance](modules/08-search-and-query.md) | MVP backend | [Progress](progress/08-search-and-query.md) |
| 09 | [Outbox delivery, queues, durable workflows, and cleanup](modules/09-async-and-workflows.md) | MVP backend | [Progress](progress/09-async-and-workflows.md) |
| 10 | [Backend acceptance and public API client](modules/10-backend-acceptance.md) | MVP backend gate | [Progress](progress/10-backend-acceptance.md) |
| 11 | [Static web application, authentication client, and UI foundation](modules/11-static-web-foundation.md) | MVP frontend | [Progress](progress/11-static-web-foundation.md) |
| 12 | [Public feedback, discussion, and staff web workflows](modules/12-web-product-workflows.md) | MVP frontend | [Progress](progress/12-web-product-workflows.md) |
| 13 | [MVP release, deployment, and maintenance readiness](modules/13-mvp-release-and-operations.md) | MVP release gate | [Progress](progress/13-mvp-release-and-operations.md) |
| 14 | [Post-MVP issue relations, hierarchy, and saved views](modules/14-relations-and-saved-views.md) | Post-MVP core | [Progress](progress/14-relations-and-saved-views.md) |
| 15 | [Post-MVP subscriptions, notifications, bulk actions, and data jobs](modules/15-notifications-and-bulk-jobs.md) | Post-MVP core | [Progress](progress/15-notifications-and-bulk-jobs.md) |
| 16 | [Post-MVP official plugins and isolated integration APIs](modules/16-official-integrations.md) | Post-MVP optional integrations | [Progress](progress/16-official-integrations.md) |

The module checklist is the source of truth for implementation completion. Its paired progress file records evidence, decisions, current blockers, and session handoffs. The master progress file records module/gate status only.

## Required order and gates

```text
00 Guidance skills
  -> G0: guidance is discoverable and validated
01 Backend workspace and runtime proof
02 Contracts and dual database foundations
03 Core security
04 Authentication, identity, authorization
05 Plugin protocol and trusted runtime
06 Issue and discussion backend
07 Content, forms, templates, attachment backend
08 Structured search backend
09 Durable queues, workflow foundation, cleanup
10 Backend integration, client, security/performance acceptance
  -> G1: both backend profiles pass before any SPA development
11 Static SPA foundation
12 Public and staff web workflows
13 Deployment, recovery, and release
  -> G2: complete MVP acceptance and release readiness
14 Relations and saved views: backend -> acceptance -> UI
15 Notifications and bulk/data jobs: backend -> acceptance -> UI
16 Official integrations: each backend -> acceptance -> UI
```

Follow the default sequence unless a documented dependency analysis permits independent work after G0. This is not an instruction to delegate or spawn agents. Never bypass G1 or build a later feature's UI before its backend acceptance.

Modules 07 and 08 implement handlers against the event contracts defined in 02/05; module 09 supplies production dispatch and scheduling. These are explicit integration handoffs, not circular prerequisites. They are fully tested together before G1.

Backend-owned authorization interaction pages and minimal browser test fixtures in 04/10 are part of proving the backend protocol. They do not authorize starting the product SPA early.

## Scope and architecture commitments

- **MVP:** the full PRODUCT §29 path, including Issue Forms, discussion/reactions, triage, timeline, auth/permissions, safe Markdown, attachments, search, audit, abuse controls, public API, and plugin runtime foundation.
- **Post-MVP:** structured relations/sub-issues, saved views, subscriptions/notifications, bulk operations, import/export, and named official provider plugins. The async/event/security seams required for these exist in the MVP.
- **Deferred:** AI, vector search, realtime collaborative editing, full boards/roadmaps, SLA/knowledge-base products, SCIM, arbitrary workflow designers, and hosting untrusted runtime plugin code. They must not block MVP.
- **Two first-class backend profiles:** Workers + D1 + R2 + Queues + Workflows, and Node 24 + PostgreSQL 18.x + S3-compatible storage + Graphile Worker with durable PostgreSQL workflow state.
- **Shared semantics:** domain/application services, Elysia routes, public contracts, plugin protocol, security and performance policy. Database SQL, migrations, FTS, blob/queue/workflow adapters, and runtime startup may differ.
- **Static frontend:** independent hosting and registrable domains; public runtime configuration, versioned REST/OpenAPI, memory-only opaque bearer tokens, and top-level PKCE authentication recovery.
- **Modern web:** Baseline Widely Available, WCAG 2.2 AA, native capabilities where suitable, measured performance, and explicit progressive enhancement.

TECH-STACK refines the older ARCHITECTURE profile and version policies. Exact source version examples are historical snapshots, not verified installation instructions. See [Source precedence](SOURCES.md#source-precedence-and-reconciliations).

## Cross-cutting definition of done

Every module must satisfy the [Execution protocol](EXECUTION.md), complete its checklist, provide its acceptance evidence, update relevant English specifications/guidance, and leave a usable progress handoff.

Changes to security, persistent formats, migrations, permissions, uploads, public contracts, or plugin execution require the review defined by the source baselines. Hot queries and resource-amplifying operations require bounds and measured verification. Source deviations need explicit decisions; a provider limitation must not silently weaken policy.

No calendar estimates or fabricated service-level commitments are assigned. Sequence and evidence control readiness. If external access prevents a required check, record what is missing and keep the affected gate open.

## Navigation and traceability

- [Master progress and current next action](PROGRESS.md)
- [Session and checklist protocol](EXECUTION.md)
- [Architecture sources and current research](SOURCES.md)
- [Requirement coverage and cross-module handoffs](COVERAGE.md)

