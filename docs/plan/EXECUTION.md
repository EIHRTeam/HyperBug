# Execution and session handoff protocol

This protocol applies to every planning, implementation, testing, review, debugging, and maintenance session for HyperBug. Every session must briefly record what happened, summarize changes, and state what subsequent sessions need to know.

## Language and source rules

Write all new project documentation in English, including skills, plans, progress records, ADRs, specifications, runbooks, and release notes. Existing initial-architecture inputs remain historical sources until explicitly migrated. This default does not require changing user-facing product localization.

Follow the user's current instructions, applicable repository guidance, and the source-baseline responsibilities in [SOURCES](SOURCES.md). Refresh library documentation with Context7 resolve-then-query when the question concerns a library/framework/SDK/API/CLI/cloud service. Search and retrieve modern-web-guidance for relevant web work and record applicable guides/fallbacks.

## Session start checklist

- [ ] Read [Master progress](PROGRESS.md), the relevant module plan, its current status and latest session entries, and affected dependency progress records.
- [ ] Read applicable root/local guidance and the project guidance skills after module 00 creates them.
- [ ] Inspect the actual working tree, relevant implementation, and existing test evidence. Do not assume the previous session committed its changes or that chat history is available.
- [ ] Verify prerequisite gates. Select a small, reviewable batch of checklist IDs; record the intended batch in the progress document.
- [ ] Identify unresolved decisions and documentation/version assumptions that must be verified before dependent changes.

## During the session

Update the progress document at meaningful checkpoints: a completed batch, a new blocker, a changed design decision, a failed validation, or before a context handoff. Do not rely only on the final chat message.

Keep changes coherent with their owning plan. If work spans several modules, update each affected progress document and cross-link the relevant entries. A shared finding may have one detailed entry, but every affected record must summarize its impact.

For work with no obvious owner, use the responsible maintenance/module record or create a new plan/progress pair before starting an unplanned feature. Planning-only/no-code sessions still need a concise entry.

## Checklist and status rules

- The detailed module plan owns the canonical implementation checklist. Keep IDs stable, such as `06.2c` or `10.G3`.
- Use `[ ]` for unfinished work and `[x]` only after the described result is implemented and verified. A progress-document creation entry is not implementation evidence.
- If partly complete, leave the item unchecked and explain the completed portion and remaining action in progress.
- Record a dropped/replaced item and its reason explicitly; do not check it as if implemented. Link the replacement or ADR.
- Use module states `Not started`, `Ready`, `In progress`, `Blocked`, `Complete`, or `Deferred`. A waiting prerequisite is normally `Not started`; an encountered impediment with a concrete unblock action is `Blocked`.
- The module is `Complete` only when its checklist, acceptance checks, required reviews, documentation, and handoff are complete.
- Update master status and gates only from corresponding evidence. Never mark a release as published when it is only prepared.

## Session end checklist

- [ ] Update canonical checklist items with evidence-backed completion and leave partial items unchecked.
- [ ] Update the current status, active/next checklist IDs, blockers, decisions, and next-session cautions in every affected progress file.
- [ ] Append a session entry using the required fields below, even if work was limited to investigation, review, documentation, or a failed attempt.
- [ ] Record exact verification commands/checks and outcomes; distinguish passed, failed, not run, mocked, emulated, and actual deployment results.
- [ ] Record modified/created paths and a concise explanation of behavior or documentation changes. Include a commit/PR link only if one actually exists.
- [ ] Record the next executable action and any prerequisites, unfinished migrations, version assumptions, environment requirements, or hazards the next session must know.
- [ ] Update [Master progress](PROGRESS.md) when module status, scope, blockers, or gates change.
- [ ] Check links and document consistency for changed documentation; update guidance when actual workflows/commands change.

## Required session-entry template

Copy this section into each affected module's progress document. Append entries chronologically; do not overwrite earlier history. Use real dates and an unambiguous session label.

```markdown
### YYYY-MM-DD — Session label

- Scope and checklist IDs: ...
- Progress: ...
- Change summary: ...
- Files/artifacts: ...
- Verification: command/check, environment/profile, result, evidence path; or "Not run" with reason.
- Decisions and deviations: rationale and ADR/review links, or "None".
- Blockers/open questions: impact and concrete unblock action, or "None".
- Next actions: ordered checklist IDs and the next executable step.
- Next-session cautions: invariants, pending work, uncommitted changes, credentials/environment needs, or "None".
```

Keep the entry concise; link substantial logs/reports instead of embedding them. Never include secrets, live credentials, private request bodies, signed upload/download URLs, or sensitive identity data.

## Evidence and testing

Choose meaningful tests for the changed behavior and its risks. Do not add low-value tests merely to mirror implementation. The plans identify required security, database, contract, runtime, storage, and browser checks.

A local emulator proves only its recorded scope. Mock provider tests do not prove live provider compatibility. A prerequisite gate that requires real deployment evidence remains incomplete when that environment is unavailable.

Record fixture size, software versions, runtime, measurement method, and results for performance work. Set regression thresholds from observations. Do not lower cryptographic parameters, disable authorization, or remove accessibility to improve a benchmark.

For documentation-only work, validate structure, relative links, required plan/progress pairing, stable IDs, and checklist/status consistency. Application tests are not required when no application behavior changed.

## Decisions and scope changes

Record a decision before an irreversible schema/public-contract direction is embedded. The source baselines require ADR/review for changes such as authentication flow, persistent browser credentials, encryption, weaker CSP, trust boundaries, plugin runtime, database/core framework, and relevant consistency/performance architecture.

A routine choice within the approved design does not create an extra user-approval checkpoint. When authorization is actually needed, prepare a concrete reviewable result first and explain the exact requirement. Production actions and external messaging remain subject to the current session's authorization.

## Completion handoff

The next session should be able to answer from repository files alone:

1. What is complete, and what evidence supports it?
2. What changed, and which files contain the change?
3. What remains blocked or uncertain?
4. Which exact checklist item comes next?
5. What must not be forgotten or accidentally undone?

