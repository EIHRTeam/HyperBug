# HyperBug repository guidance

HyperBug is a public-first issue tracker with a static frontend and two first-class backend profiles. Start from the current repository state and the requested task scope.

## Project skills

- [hyperbug-development](.agents/skills/hyperbug-development/SKILL.md): use for product features, backend/API/adapter changes, and frontend workflows.
- [hyperbug-maintenance](.agents/skills/hyperbug-maintenance/SKILL.md): use for dependency updates, database migrations, releases, deployment, and operational recovery.

Read the applicable skill and only the references relevant to the work. For feature changes that also require migrations, combine the development workflow with the maintenance migration reference.

## Planning and session continuity

Read [the plan](docs/plan/README.md), [master progress](docs/plan/PROGRESS.md), the owning module's checklist, and its latest progress record before implementation. Follow [EXECUTION](docs/plan/EXECUTION.md) at session start, meaningful checkpoints, and session end.

Every session must append a concise entry to each affected module's progress document: progress, change summary, files/artifacts, verification results, decisions/blockers, next actions, and next-session cautions. This includes investigation, failed attempts, reviews, and documentation-only sessions. Mark checklist items complete only when their actual outcomes are verified.

Create and validate guidance skills before application implementation (G0). Backend acceptance in module 10 (G1) precedes product SPA development. Each post-MVP increment also completes backend acceptance before its UI. Follow the current plan gates; a request for one module does not authorize implementing the rest of the roadmap.

Write all new project documentation and substantive documentation updates in English, including skills, plans, progress logs, specifications, ADRs, and runbooks. Existing initial-architecture documents remain historical inputs unless translation is separately requested. Product localization is a separate concern.

## Architecture and policy sources

[SOURCES](docs/plan/SOURCES.md) links the initial specifications and records their refinements. PRODUCT owns scope; SECURITY owns minimum security policy; PERFORMANCE prioritizes correctness/security over optimization; TECH-STACK refines the older runtime/profile/version choices.

Both Workers/D1/R2/Queues/Workflows and Node 24/PostgreSQL 18.x/S3-compatible storage/Graphile Worker are required. Share domain semantics, public contracts, application services, and Elysia routes; keep infrastructure types in adapters/composition roots. The frontend remains independently hosted and uses the public API. Plugins provide mechanisms without weakening Core policy.

Use the skills' review and testing references for changes to security, persistent data, public contracts, or resource-intensive paths. Do not silently relax a normative baseline to accommodate a dependency or provider. Routine implementation choices do not imply a new user-approval step.

## Current documentation lookup

<!-- context7 -->
Use Context7 MCP whenever the task asks about a library, framework, SDK, API, CLI tool, or cloud service, including syntax, configuration, migration, library-specific debugging, setup, and CLI usage. Do this even for familiar tools. Prefer it over general web search for library documentation.

Do not trigger this solely for refactoring, scripts from scratch, business-logic debugging, code review, or general programming concepts. If those tasks introduce an actual library/API question, look up that question. Record lookup dates, references, and remaining gaps. If the tool or coverage is unavailable, document the limitation and consult official sources or a focused runtime experiment; do not invent documentation or claim an unperformed lookup.
<!-- context7 -->

For HTML/CSS/client-side JavaScript work, use the available modern-web-guidance skill: search by the intended action, retrieve relevant guides, then check implementation against them. Record guide IDs, current compatibility status, and chosen fallbacks. Preserve Baseline Widely Available, WCAG 2.2 AA, the static SPA boundary, and memory-only browser access tokens. Treat newer capabilities as progressive enhancements under the project's policy.

## Commands and evidence

Use commands actually defined by the repository and installed tooling. A command proposed in a plan is not proof that it exists. Exact source version examples are snapshots; verify availability before installation. Record unavailable checks and keep dependent gates incomplete rather than replacing required evidence with mock-only results.
