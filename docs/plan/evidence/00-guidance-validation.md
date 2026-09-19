# Module 00 guidance validation

Date: 2026-09-17. Scope: the two repository guidance skills, their references, registration, and module handoff. This is authoring validation and a manual workflow walkthrough, not application/runtime testing or an independent agent evaluation.

## Artifacts inspected

- [Root AGENTS](../../../AGENTS.md) registers both skills, preserves the supplied Context7 workflow, and defines English documentation/session rules.
- [Development skill](../../../.agents/skills/hyperbug-development/SKILL.md) and its backend, frontend, security, testing, and session-handoff references.
- [Maintenance skill](../../../.agents/skills/hyperbug-maintenance/SKILL.md) and its dependency, migration, and deployment/recovery references.
- Each skill's `agents/openai.yaml` supplies a matching name, description, and explicit skill invocation prompt; automatic selection retains its default enabled policy.

Both skills are repository-owned under `.agents/skills/`, as required by module 00. Shared references intentionally reside in one of the two adjacent skills. No global skill copy, product scaffolding, package install, or deployment was required.

## Structural verification

Executed successfully in the current workspace:

```sh
python3 /Users/null/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/hyperbug-development
python3 /Users/null/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/hyperbug-maintenance
python3 /tmp/hyperbug-validate-guidance.py
git diff --check
```

Both bundled validators returned `Skill is valid!`. The one-off local Python validator checked frontmatter names/descriptions, UI prompt/description/invocation policy, registration, Markdown link targets/anchors, reference reachability, English prose, whitespace, final newlines, and absence of application scaffolding. It compared hashes of the initial architecture, root README, LICENSE, and existing gitignore against the pre-change snapshot; all remained unchanged.

The `/tmp` validator and snapshot are session-local verification tools, not project runtime commands or a dependency of the skills. Filesystem registration/metadata were checked; no claim is made that the current desktop task hot-reloaded its skill catalog.

## Manual workflow walkthroughs

The following walkthroughs followed actual root/skill/reference links and inspected the linked module/progress records. They validate navigation and decision coverage without implementing future modules or making external API calls.

| Sample request | Navigation and source policy found | Checks and handoff found | Result in the current workspace |
| --- | --- | --- | --- |
| Add an Issue creation endpoint | AGENTS → development → backend/security → SOURCES and module 06.2; contracts/persistence foundations in 02. Current API details route through Context7. | Module 06.V1–V4 plus testing reference: both runtime contracts, permissions, concurrency/idempotency, event atomicity, query bounds. Log in [06 progress](../progress/06-issue-core.md) and any actually affected shared module. | The route is owned by 06 and is not eligible before its prerequisites. G0 completion makes 01 the next step; guidance does not fabricate an existing server or bypass the sequence. |
| Upgrade the database dependency | AGENTS → maintenance → dependencies and database migrations → TECH-STACK/SECURITY through SOURCES. | Inspect actual manifest/lockfile and exact old/new versions; review generated SQL, both-adapter migration/contracts/concurrency/query evidence. Log in [01 progress](../progress/01-backend-foundation.md) and [02 progress](../progress/02-contracts-and-data.md) when persistence changes. | No package manifest/lockfile currently exists. The procedure identifies initial version verification under 01.1 instead of claiming an upgrade/test command is already available. |
| Implement an Issue Form | AGENTS → development → backend/frontend/security; module 07.2 owns schema/validation, module 12.2 owns UI. | Server field/cardinality/version/attachment checks, centralized sanitization, both profiles; Context7 and modern-web search/retrieve before frontend work; accessibility and error-state checks. Log in [07 progress](../progress/07-content-and-attachments.md) and [12 progress](../progress/12-web-product-workflows.md) when those modules are worked on. | G1 is not passed, so SPA work remains gated. The guidance preserves static hosting, memory-only tokens, and backend validation, rather than importing generic SSR/cookie-form advice. |

## Requirement audit

| Module 00 items | Current evidence |
| --- | --- |
| 00.1a–00.1b | Skill-creator instructions read; both initialized entrypoints completed with valid, distinct metadata and explicit task triggers. |
| 00.1c | Eight linked references cover backend, frontend, security, database migrations, testing, deployment, session handoffs, and dependency maintenance without duplicating the source manuals. |
| 00.2a–00.2b | Development entrypoint/backend reference and AGENTS define dependency direction, both profiles, required backend controls, G0/G1, and per-feature backend-before-UI acceptance. |
| 00.2c–00.2d | AGENTS preserves resolve/select/query semantics and lookup scope; frontend reference requires modern-web search/retrieve, provenance, Baseline/fallback review, accessibility, static hosting, and memory-only tokens. |
| 00.2e–00.2f | Security reference maps review/ADR triggers to source sections; root guidance keeps Core policy above plugin mechanisms and requires English for new/substantively updated documentation. |
| 00.3a | Maintenance references cover exact dependency resolutions, migration inspection, both-runtime verification, key rotation/incident containment, tested support claims, backup/restore, and schema-aware rollback. |
| 00.3b–00.3c | Shared session reference embeds start/checkpoint/end behavior, links the canonical EXECUTION template, and requires evidence-backed status plus progress/change summary/verification/next-session cautions for every affected session. |
| 00.3d | Root AGENTS exists and registers both repository skills, plan/progress entry points, English default, and the supplied Context7 instructions. |
| 00.4a–00.4b | Bundled validators, link/reachability checks, and the three manual walkthroughs above passed. |
| 00.4c | Module 00 progress records artifacts and verification; master/COVERAGE mark G0 passed and module 01 Ready. Module 01's handoff explicitly records no application implementation. |

No source-baseline deviation was introduced. Actual library version availability, runtime compatibility, backend tests, and production recovery remain the future modules' work.
