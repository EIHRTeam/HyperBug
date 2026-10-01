# Execution and session handoff protocol

This protocol applies to every planning, implementation, testing, review, debugging, and maintenance session for HyperBug. Every session must briefly record what happened, summarize changes, and state what subsequent sessions need to know. Exception: when the user only asks a question and no repository state changes (a read-only check, comparison, measurement, or explanation), do not create or update progress records unless the user asks for them.

## Language and source rules

Write engineering documentation in English, including skills, plans, progress records, ADRs, specifications, and internal runbooks. Per the explicit reader-documentation requirement, maintain `docs/site/` guides (including reader-facing runbooks and release notes) in English and Simplified Chinese, with matching paths and synchronized content. Reader-facing repository entry points may be bilingual. Existing initial-architecture inputs remain historical sources until explicitly migrated. This default does not require changing user-facing product localization.

Follow the user's current instructions, applicable repository guidance, and the source-baseline responsibilities in [SOURCES](SOURCES.md). Refresh library documentation with Context7 resolve-then-query when the question concerns a library/framework/SDK/API/CLI/cloud service. Search and retrieve modern-web-guidance for relevant web work and record applicable guides/fallbacks.

## Current user-directed suspension

As of 2026-09-21, [all audit work is Suspended — no audit for now](AUDIT-SUSPENSION.md). Mixed checklist items keep their other scope; suspended parts remain unchecked and require an explicit user instruction to resume. As of 2026-09-28, the user also paused new features and scope expansion for worktree consolidation; on 2026-09-30 the user released Module 04 from that hold to advance its full checklist while keeping the hold's other parts in force (no SPA, stopped Argon2id performance work, no Module 09 expansion, later-module audit suspension). On 2026-10-01 the user directed completing the Free-tier journey (the 04.V6 tier account journey on its activation path) and resuming the remaining Module 04 audit portions (`04.3a` linking, `04.3c`, `04.V5`), and later the same day continuing the Module 05 audit (`05.2a` audited endpoints, `05.3d` configuration audits) to close its remaining checks — Module 05 is complete with no suspended remainders; the Free-tier work remains evidence collection under [FREE-TIER-PROFILE](../FREE-TIER-PROFILE.md) and never claims the independent 13.G6 acceptance. The untracked root `SECURITY.md` is a protected user draft that must never be committed. These overrides apply to earlier next-action logs that otherwise schedule development or audit work.

## Session start checklist

- [ ] Read [Master progress](PROGRESS.md), the relevant module plan, its current status and latest session entries, and affected dependency progress records.
- [ ] Read applicable root/local guidance and the project guidance skills after module 00 creates them.
- [ ] Inspect the actual working tree, relevant implementation, and existing test evidence. Do not assume the previous session committed its changes or that chat history is available.
- [ ] Verify prerequisite gates. Select a small, reviewable batch of checklist IDs; record the intended batch in the progress document.
- [ ] Identify unresolved decisions and documentation/version assumptions that must be verified before dependent changes.

## During the session

Update the progress document at meaningful checkpoints: a completed batch, a new blocker, a changed design decision, a failed validation, or before a context handoff. Do not rely only on the final chat message.

Keep changes coherent with their owning plan. If work spans several modules, update each affected progress document and cross-link the relevant entries. A shared finding may have one detailed entry, but every affected record must summarize its impact.

For work with no obvious owner, use the responsible maintenance/module record or create a new plan/progress pair before starting an unplanned feature. Planning-only/no-code sessions still need a concise entry, except for the question-answering case in the scope statement above.

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
- [ ] Append a session entry using the required fields below, even if work was limited to investigation, review, documentation, or a failed attempt. A session that only answers a user question and changes no repository state is exempt unless the user asks for a record.
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
