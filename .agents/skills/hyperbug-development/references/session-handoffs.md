# Session handoffs

This is the shared session reference for both project skills. The canonical checklist, status definitions, and entry template are in [EXECUTION](../../../../docs/plan/EXECUTION.md); read it instead of creating a competing log format.

## Start

Read [master progress](../../../../docs/plan/PROGRESS.md), the owning [module plan](../../../../docs/plan/README.md#module-index), its same-named file under `docs/plan/progress/`, and affected prerequisite records. Inspect actual files/versions/uncommitted changes. Record the intended stable checklist IDs and verify gates before dependent work.

For maintenance, use the module that owns the changed artifact: foundation/dependencies 01, persistence 02, security 03–04, content 07, async 09, deployment/recovery 13, or the relevant feature/integration module. A multi-module change updates every affected record. Use [COVERAGE](../../../../docs/plan/COVERAGE.md) for ownership; do not execute unrelated future modules just to obtain a log owner.

## Checkpoint

Update the current status and append or update the current session entry after a meaningful batch, a decision/failure/blocker, or before handing off context. Record partial completion honestly and leave unfinished checkboxes unchecked. Preserve earlier session history.

## Finish every session

Append a concise English entry with the [required template](../../../../docs/plan/EXECUTION.md#required-session-entry-template):

- Scope/checklist IDs, actual progress, and a summary of what changed.
- Changed paths/artifacts and commands/checks with environments, results, and evidence; state explicitly when a check was not run.
- Decisions/deviations and blockers with concrete resolution steps.
- Ordered next actions and next-session cautions: unfinished migrations, version uncertainty, uncommitted work, missing environment access, or invariants that must not be lost.

This applies even to planning, investigation, review, failed attempts, and no-code work. Mark plan items complete only when their stated outcome and verification are complete. Update master/gate status when it changes; an initialized log or proposed procedure is not implementation evidence.

Never put secrets, private payloads, live credentials, or signed capabilities into handoffs. Link long reports instead of copying them. Keep records usable without chat history; do not claim commits, tests, deployments, or compatibility that did not happen.

