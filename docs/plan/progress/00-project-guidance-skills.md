# 00 progress — Project maintenance and development guidance skills

Plan: [Detailed checklist](../modules/00-project-guidance-skills.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: Complete
- Delivery scope: MVP prerequisite
- Prerequisites: None. This is the first implementation step.
- Implementation started: Yes; guidance artifacts only.
- Completed implementation checklist IDs: 00.1a–00.1c, 00.2a–00.2f, 00.3a–00.3d, 00.4a–00.4c (all 16 items).
- Active/next checklist group: None in module 00; module 01.1 is next.
- Last updated: 2026-09-17.
- Blocking issues discovered: None.
- Evidence: [Validation and requirement audit](../evidence/00-guidance-validation.md).

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 00.1 | Create the guidance skills first | Complete | Two valid SKILL.md entrypoints and eight linked references |
| 00.2 | Encode the development rules | Complete | AGENTS, development skill, backend/frontend/security references |
| 00.3 | Encode maintenance and session continuity | Complete | Maintenance references, shared session protocol, registration |
| 00.4 | Validate discoverability | Complete | Bundled validators, links/metadata, three manual task walkthroughs |

The linked module plan owns the detailed checkboxes. The validation report maps requirements to inspected artifacts.

## Next actions

1. Begin module 01.1 with the development skill, after reading its plan and progress record.
2. Verify actual installable versions and runtime adapter names before scaffolding the backend workspace.
3. Keep G1 closed until module 10's backend acceptance evidence exists.

## Next-session cautions

Both project skills now exist under `.agents/skills/` and are registered in root AGENTS. They share references, so retain their adjacent repository layout. Do not recreate them or treat the completed guidance gate as proof of an implemented backend.

No package manifest, lockfile, application, or deployment was created. Use the current workspace and verified documentation when module 01 begins. Unrelated initial architecture, root README/LICENSE, and existing gitignore were preserved.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 00; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for project maintenance and development guidance skills.
- Files/artifacts: `docs/plan/modules/00-project-guidance-skills.md`; `docs/plan/progress/00-project-guidance-skills.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Create the English project development and maintenance guidance skills as the first implementation action.
- Next-session cautions: Create and register the guidance skills before scaffolding or implementing application code. This planning session did not create those skills.

### 2026-09-17 — Create and validate project guidance skills

- Scope and checklist IDs: Executed all module 00 items, 00.1a through 00.4c; module 01 status handoff only.
- Progress: Created and validated both English repository skills; completed G0 and made module 01 Ready.
- Change summary: Added concise development/maintenance entrypoints, UI metadata, eight topic references, and root AGENTS with Context7, English documentation, source/gate, and mandatory session rules. Updated plan status and preserved prior session history.
- Files/artifacts: `.agents/skills/hyperbug-development/` (SKILL.md, agents/openai.yaml, references/backend.md, frontend.md, security.md, testing.md, session-handoffs.md); `.agents/skills/hyperbug-maintenance/` (SKILL.md, agents/openai.yaml, references/dependencies.md, database-migrations.md, deployment.md); `AGENTS.md`; module 00 plan/progress, module 01 progress, master progress, plan README/COVERAGE, and the [validation report](../evidence/00-guidance-validation.md).
- Verification: Both bundled `quick_validate.py` invocations passed. Local documentation validation checked links/anchors, reference reachability, English prose, UI/discovery metadata, whitespace, source hashes, and absence of product scaffolding. Manual endpoint/dependency/Issue Form walkthroughs passed; `git diff --check` passed. Commands and evidence scope are recorded in the validation report. Application/runtime tests were not run because no application code changed.
- Decisions and deviations: Followed skill-creator and the module 00 layout. Shared references avoid duplicated policy; automatic invocation remains enabled by default. No source-policy deviation or global skill installation.
- Blockers/open questions: None for module 00. Version availability, adapter naming, and runtime compatibility remain module 01 work.
- Next actions: Start 01.1a, verify required versions with current documentation/registry evidence, then scaffold the backend only within that task's scope.
- Next-session cautions: Skills and root AGENTS are complete. Module 01 is eligible but unimplemented; G1 and all later gates remain incomplete. Preserve existing unrelated work and do not run planned commands as though package scripts already exist.
