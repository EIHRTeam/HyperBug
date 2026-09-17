# 00 — Project maintenance and development guidance skills

Phase: MVP prerequisite  
Prerequisites: None. This is the first implementation step.  
Progress: [Session log and current status](../progress/00-project-guidance-skills.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Establish repository-owned, English guidance that every later development or maintenance session can discover and follow. This phase produces instructions and their supporting references; it does not implement the backend or frontend.

## Ordered checklist

### Step 00.1 — Create the guidance skills first

- [x] **00.1a** Read the applicable skill-authoring instructions, then create `.agents/skills/hyperbug-development/SKILL.md` in English with valid name/description metadata and explicit triggers.
- [x] **00.1b** Create `.agents/skills/hyperbug-maintenance/SKILL.md` in English with valid metadata, maintenance triggers, and an incremental update workflow.
- [x] **00.1c** Add small, linked reference files for backend development, frontend development, security, database migrations, testing, deployment, and session handoffs. Keep rules centralized instead of copying the architecture into every skill.

### Step 00.2 — Encode the development rules

- [x] **00.2a** Define the dependency direction: public contracts/domain → application services and ports → adapters/composition roots. Require shared product behavior across both production profiles.
- [x] **00.2b** Require backend implementation and backend acceptance before SPA feature implementation. Require authorization, validation, audit, bounds, and both database implementations for each backend capability.
- [x] **00.2c** Require Context7 resolve-then-query for library/framework/SDK/API/CLI/cloud-service questions. Record lookup dates and references; if documentation is incomplete, identify the gap and verify against official sources or a focused runtime experiment.
- [x] **00.2d** Require modern-web-guidance search then retrieval before relevant web work; record guide IDs, compatibility status, and chosen fallbacks. Preserve Baseline Widely Available, WCAG 2.2 AA, static hosting, and memory-only access tokens.
- [x] **00.2e** Define security/performance review and ADR triggers from the source baselines. State that plugins supply mechanisms and cannot relax Core policy.
- [x] **00.2f** Require English for all new project documentation, plans, progress logs, skills, ADRs, and substantive documentation updates. Treat existing initial-architecture documents as historical inputs; translate them only in a separately scoped documentation change.

### Step 00.3 — Encode maintenance and session continuity

- [x] **00.3a** Document dependency update review, exact resolutions, migration inspection, both-runtime checks, secret rotation, incident response, backup/restore, compatibility claims, and release rollback.
- [x] **00.3b** Embed the mandatory start/checkpoint/end protocol from [Execution protocol](../EXECUTION.md). Every session must append a concise entry to every affected subplan progress document, including changed files, verification, next actions, and next-session cautions.
- [x] **00.3c** Require honest checklist/status updates: no completed item without evidence, no fabricated tests, no treating a planning entry as implementation progress.
- [x] **00.3d** Create or update root `AGENTS.md` to register the skills, point to this plan and its progress records, preserve existing applicable instructions, and state the English documentation default.

### Step 00.4 — Validate discoverability

- [x] **00.4a** Validate skill metadata and relative links using available skill-authoring validation; do not invent a command that has not been installed.
- [x] **00.4b** Walk through three sample tasks: adding a backend endpoint, updating a database dependency, and implementing an Issue Form. Confirm the correct skill, source policy, checks, and progress file are discoverable.
- [x] **00.4c** Record the created paths and validation results in this module's progress document; then unlock module 01.

## Acceptance evidence

Both skills and their references exist in the repository, are entirely English, and are linked from root guidance. A new session can determine what to read, which checks apply, and where to leave a handoff without relying on chat history.

## Source coverage

All five architecture inputs; user-required first step and English/session-continuity rules. See [Source register](../SOURCES.md).

