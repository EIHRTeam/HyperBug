---
name: hyperbug-maintenance
description: "Maintain HyperBug dependencies, database migrations, deployment and release procedures, secrets, backups, and incident recovery. Use for repository upkeep and operational changes; use hyperbug-development for new product behavior or feature implementation."
---

# HyperBug Maintenance

Make the requested maintenance change incrementally, preserving the documented product behavior and both supported deployment profiles. Do not treat this skill as permission to publish, delete production data, rotate live credentials, or contact external parties.

## Establish the change boundary

Read [root guidance](../../../AGENTS.md), [master progress](../../../docs/plan/PROGRESS.md), the owning module's plan/progress, and [session handoffs](../hyperbug-development/references/session-handoffs.md). Inspect the actual versions, scripts, deployment state, and uncommitted work before choosing commands.

Define the affected artifact, behavior/data that must survive, verification environment, and recovery path. Keep a dependency update or operational repair separate from unrelated feature expansion. If the task crosses into product behavior, also use [development guidance](../hyperbug-development/SKILL.md).

## Select the maintenance procedure

| Work | Read |
| --- | --- |
| Package/toolchain upgrades or compatibility drift | [Dependency updates](references/dependencies.md) |
| Schema changes, migration tooling, backfills, or data repair | [Database changes](references/database-migrations.md) |
| Deployments, releases, rollback, backup/restore, key rotation, or incident recovery | [Deployment and recovery](references/deployment.md) |
| Sensitive changes or deciding whether review/ADR is required | [Shared security and review boundaries](../hyperbug-development/references/security.md) |
| Verification and support claims | [Shared testing and evidence](../hyperbug-development/references/testing.md) |

The shared references are intentionally owned by the adjacent development skill; keep the two repository skills together. Authoritative policy remains in [SOURCES](../../../docs/plan/SOURCES.md) and its linked baselines.

## Execute incrementally

1. Record the selected checklist IDs and reproduce the problem or establish the current compatibility/recovery baseline.
2. Prepare the smallest coherent update, including affected migrations/configuration/docs. Verify exact dependency resolutions and current provider/CLI behavior through root documentation rules.
3. Exercise the relevant runtime, migration, security, performance, and recovery checks before any authorized rollout. Distinguish local fixtures from live compatibility evidence.
4. For retrying mutations, inspect current external state after an ambiguous result before retrying. Stop repeating a failing rollout at its documented failure threshold; recover or leave a concrete blocker instead of broadening privileges or deleting data to force success.
5. Refresh actual commands, supported-version records, and operator guidance. Log the outcome and next-session cautions in each affected progress record, and change master/gate status only when supported by evidence.

Prepare a concrete reviewable artifact before asking for any genuinely missing authorization. Routine reversible work already within scope does not require an extra approval ritual. Never report a prepared release as published or a proposed recovery procedure as exercised.
