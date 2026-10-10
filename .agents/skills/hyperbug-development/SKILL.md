---
name: hyperbug-development
description: "Implement or fix HyperBug product features, backend contracts and adapters, or frontend workflows according to the repository plan. Use for feature development and application behavior changes; use hyperbug-maintenance for dependency upgrades, migrations, releases, and operational recovery."
---

# HyperBug Development

Develop the requested HyperBug capability within its accepted architecture and delivery gates. This is repository-specific guidance; it does not authorize unrelated features or deployment.

## Begin with the current state

Read [root guidance](../../../AGENTS.md), [master progress](../../../docs/plan/PROGRESS.md), and [session handoffs](references/session-handoffs.md). Identify the owning module and read its plan and latest progress entry before editing. Source policies and their refinements are indexed in [SOURCES](../../../docs/plan/SOURCES.md).

G0 must pass before application work. Complete the backend acceptance gate in module 10 before starting the product SPA; each post-MVP feature also accepts its backend before its UI. Backend-owned authorization pages and minimal protocol test fixtures are distinct from product SPA work.

Use the selected checklist IDs to bound the change. Inspect existing package scripts and implementation rather than treating planned paths, command names, or source version snapshots as installed facts.

## Read only the relevant references

| Work | Reference |
| --- | --- |
| Endpoints, domain/application services, persistence adapters, queues, or plugins | [Backend development](references/backend.md) |
| Static SPA, browser auth, forms, components, or backend-owned HTML | [Frontend development](references/frontend.md) |
| Authentication, permissions, credentials, content, uploads, trust boundaries, or review/ADR decisions | [Security and review boundaries](references/security.md) |
| Selecting verification or deciding acceptance | [Testing and evidence](references/testing.md) |
| Any session start, checkpoint, or finish | [Session handoffs](references/session-handoffs.md) |
| A feature needs a schema/data migration | [Database changes](../hyperbug-maintenance/references/database-migrations.md) |

## Implement and close the batch

Keep domain/public contracts independent of runtime infrastructure. Share product, authorization, and consistency semantics across both production profiles; allow optimized adapter implementations. Backend writes need server validation, object permissions, required audit/timeline events, and bounded work from their first implementation.

Fetch current library documentation and relevant web guidance using the rules in root guidance. Record unresolved assumptions instead of silently weakening a baseline or changing the chosen stack.

Verify the changed behavior and affected contracts using the testing reference. Update relevant specifications and guidance in English. Complete only evidence-backed checklist items, then record progress, changed files, verification, next actions, and next-session cautions in every affected progress record. Follow the session reference even when the batch only investigated a failure.
