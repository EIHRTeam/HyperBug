# 07 progress — Markdown policy, issue forms, templates, and attachments

Plan: [Detailed checklist](../modules/07-content-and-attachments.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress (specification and policy only; no application code)
- Delivery scope: MVP backend
- Prerequisites: 06 complete; cleanup job contracts from 02/05, execution completed in 09.
- Implementation started: No.
- Completed implementation checklist IDs: None.
- Active/next checklist group: 07.1 (specification in place; implementation not started).
- Last updated: 2026-09-18.
- Blocking issues discovered: None during planning; prerequisite completion is still required. One open scope question is recorded from the baseline review: whether GitHub-compatible YAML Issue Form authoring/import is required (see the 2026-09-18 baseline-review entry).
- Evidence: Planning and policy documents only; no implementation or runtime validation yet. `docs/MARKDOWN-POLICY.md` and [ADR 0003](../../decisions/0003-markdown-representation-and-pagination.md) record the accepted representation/transport/pagination direction. A read-only baseline review of Issue Form/Template coverage was recorded on 2026-09-18.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 07.1 | Implement the canonical Markdown pipeline | In progress (policy specified, implementation not started) | [MARKDOWN-POLICY](../../MARKDOWN-POLICY.md); [ADR 0003](../../decisions/0003-markdown-representation-and-pagination.md) |
| 07.2 | Implement forms and templates | Not started | None yet |
| 07.3 | Implement portable attachment storage | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Read the latest master and dependency progress records and verify prerequisites.
2. Resolve the open Issue Form format-compatibility question from the 2026-09-18 baseline review before 07.2a fixes the stored schema format, or record an explicit decision that GitHub YAML compatibility is out of scope.
3. Extend `docs/MARKDOWN-POLICY.md` with the concrete allowlist and initial `content-policy` version identifier, then implement 07.1a-07.1c in `packages/security/markdown`.
4. Implement 07.1f-07.1i (representation/transport, write-time plain-text projection, determinism, pagination and derivation-cost contract) before any content endpoint is exposed.
5. Record the actual files changed, checks run, decisions, and next-session cautions here.

## Next-session cautions

Presigned URLs are reusable bearer capabilities until expiry. Finalization must prevent post-validation overwrite from changing a published attachment.

Derived rendering is deliberately not persisted ([ADR 0003](../../decisions/0003-markdown-representation-and-pagination.md)). Do not add a stored rendered body, a rendered-body cache table or a client-only sanitizer while implementing 07.1; a measured failure to meet the derivation budget returns to the ADR as an amendment rather than an undocumented cache.

The plain-text projection is the only persisted derivative and must be produced at write time, not on the read path. Every derivation stays bounded by the page limit and the per-body bound; list endpoints must not return full body representations.

Do not infer completed implementation from this record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 07; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for markdown policy, issue forms, templates, and attachments.
- Files/artifacts: `docs/plan/modules/07-content-and-attachments.md`; `docs/plan/progress/07-content-and-attachments.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 07.1.
- Next-session cautions: Presigned URLs are reusable bearer capabilities until expiry. Finalization must prevent post-validation overwrite from changing a published attachment.

### 2026-09-18 — Baseline review: GitHub-style YAML Issue Form coverage

- Scope and checklist IDs: Read-only review of baseline coverage for 07.2a–07.2e and the downstream consumer 12.2a. No checklist item was executed, completed, or reworded.
- Progress: Compared the plan and boundary sources against the current public GitHub issue-template and form-schema documentation to answer whether the baseline contains complete support for GitHub-style YAML (`*.yml`) issue templates.
- Change summary: Documentation-only finding. No plan checklist, normative source, DATA-MODEL, COVERAGE, or module-12 text was changed, because widening or narrowing a normative baseline is a scope decision that needs an explicit recorded outcome.
- Finding: The baseline requires GitHub Issues-*class* parity for Issue Forms and Markdown Issue Templates, but does not specify *format-level* support for GitHub's YAML template or form schema.
  - Covered: `docs/initial-architecture/PRODUCT.md — …边界.md` §2.2 lists Issue Form/Issue Template among GitHub-Issues-class capabilities; §18 requires plain Markdown Issue Templates; §19 requires structured Issue Forms and a field list, allows generating a Markdown body, and requires retaining structured values. Module 07 step 07.2 (07.2a–07.2e) owns templates/schemas, field support, server validation, deterministic Markdown, and staff APIs plus compatibility rules. `docs/DATA-MODEL.md` already models an Issue form as a "bounded JSON field definition" with a schema version and an Issue template as a "Markdown body". `docs/plan/COVERAGE.md` assigns "Issue Templates and all structured Issue Form field types" to 07.
  - Not covered — authoring format: no source states that templates or forms are authored in GitHub-compatible YAML, nor that the `.github/ISSUE_TEMPLATE/*.yml` layout, file naming/ordering, or Markdown-template YAML front matter (`name`, `about`, `title`, `labels`, `assignees`, `type`) is supported. The word YAML does not currently appear anywhere in `docs/` in relation to templates or forms; the persisted definition is explicitly JSON.
  - Not covered — element taxonomy: module 07.2b lists Text, Textarea, Select, Multi-select, Checkbox, Boolean, Attachment, Markdown Notice, which only partially maps to GitHub's six element types (`markdown`, `input`, `textarea`, `dropdown`, `checkboxes`, `upload`). "Boolean" has no GitHub element counterpart, and the GitHub names/`id` key are not used.
  - Not covered — element-level detail: no requirement covers the element `id` (GitHub's canonical identifier used for URL query-parameter prefills), `textarea.render` (code-block language), `dropdown.default` and `multiple` semantics, `checkboxes` per-option `required` (at least one must be checked), or `upload.accept` plus GitHub's documented type/size limits.
  - Not covered — top-level and chooser behavior: no requirement covers `title`, `labels`, `assignees`, `type`, or `projects` prefill from a template, nor the chooser configuration file (`blank_issues_enabled`, `contact_links`).
  - Explicitly elsewhere by source: PRODUCT §28 places "GitHub integration" and "Importers/Exporters" outside Core (plugin-extensible), and COVERAGE assigns portable import/export to post-MVP module 15. Any GitHub template *import/conversion* requirement therefore conflicts with that boundary unless recorded as a new decision; authoring-format compatibility alone is not the same requirement.
- Files/artifacts: `docs/plan/progress/07-content-and-attachments.md` (this entry and the status/next-action lines above). No other file changed.
- Verification: Read `docs/initial-architecture/PRODUCT.md — 产品定位、规划与边界.md` §§2.2, 18, 19, 28, 29; `docs/plan/modules/07-content-and-attachments.md`; `docs/plan/modules/12-web-product-workflows.md`; `docs/plan/README.md`; `docs/plan/COVERAGE.md`; `docs/plan/SOURCES.md`; `docs/DATA-MODEL.md`; `docs/API-OPERATIONS.md`; `docs/plan/EXECUTION.md`; `SECURITY.md — …基线规范.md` §§63, 153. Repository greps for `yaml`, `yml`, `config.yml`, `blank_issues_enabled`, `contact_links`, and template/form terms in `docs/`, `.agents/skills/`, and `packages/ apps/ tests/ tooling/` confirmed the absences above and that no implementation exists yet. External reference check on 2026-09-18: [Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms), [Configuring issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository), [GitHub form schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema). No application test was run because no application behavior changed.
- Decisions and deviations: None. This entry deliberately records a gap instead of silently widening the normative baseline; PRODUCT remains the scope owner.
- Blockers/open questions: Open question, not a blocker: is GitHub-compatible YAML authoring (and possibly import) in scope, or is the JSON field definition sufficient? Impact is that 07.2a/07.2e would otherwise fix a stored schema format that cannot round-trip GitHub templates, and 07.2b's "Boolean" type has no GitHub equivalent. Concrete unblock action: obtain an explicit scope decision, then either add checklist items (07.2a/07.2b/07.2e) and a reconciliation row in SOURCES, or record the deliberate non-goal and state it in the module plan.
- Next actions: Resolve the open question above, then execute the existing 07.2a after prerequisites; begin 07.1 independently since it is unaffected.
- Next-session cautions: The absence of GitHub YAML support in the baseline is a recorded finding, not an approved omission and not an approval to add it. Do not change PRODUCT/DATA-MODEL/COVERAGE wording without the scope decision. Re-verify the GitHub schema against current docs at implementation time; the cited pages are marked public preview and subject to change.

### 2026-09-18 — Representation, transport and pagination policy

- Scope and checklist IDs: Design/policy session for 07.1. Created `docs/MARKDOWN-POLICY.md` (the 07.1a artifact), added 07.1f-07.1i and 07.V6-07.V7, and recorded [ADR 0003](../../decisions/0003-markdown-representation-and-pagination.md). No checklist item is marked complete: 07.1a still lacks the concrete allowlist and version identifier, and 07.1f-07.1i are specification only with no implementation.
- Progress: Fixed the content direction requested for this design discussion: the server stores raw Markdown only, derives the safe representation per request instead of persisting it, persists exactly one derivative (the plain-text projection) because it has independent consumers, and keeps derivation bounded through the existing cursor pagination contract. Rejected alternatives (persisting derived HTML/tree; transporting sanitized HTML as the only body) are recorded with reasons in the ADR.
- Change summary: Added the Markdown policy specification with the representation table (`tree`/`html`/`text`), derived-content bounds, determinism requirements, publish/cache/invalidation rules and pagination/derivation-cost rules. Recorded the ADR required by the security reference for pagination architecture. Extended module 07 with four implementation items and two acceptance items, aligned module 12 to consume the server-derived representation without client parsing or an HTML sink, and updated coverage rows.
- Files/artifacts: `docs/MARKDOWN-POLICY.md` (new); `docs/decisions/0003-markdown-representation-and-pagination.md` (new); `docs/plan/modules/07-content-and-attachments.md`; `docs/plan/modules/12-web-product-workflows.md`; `docs/plan/COVERAGE.md`; `docs/plan/README.md` (specification index); `docs/plan/PROGRESS.md`; this progress record.
- Verification: Documentation-only session, so structural checks stand in for application tests. `python3 /tmp/hyperbug-validate-docs.py` (one-off, not committed) scanned 71 Markdown files and checked 390 relative links and anchors, 17/17 plan-progress pairs, 322 unique checklist IDs, checklist/status consistency per module, presence of the policy and ADR artifacts, required session-entry fields, hard-break-aware whitespace, final newlines and dash usage in the new documents. Result: `RESULT: PASS`. No application test, build, runtime check or deployment was run because no application behavior changed.
- Decisions and deviations: Accepted [ADR 0003](../../decisions/0003-markdown-representation-and-pagination.md). It refines, without relaxing, PRODUCT §17, SECURITY §§53-66 and PERFORMANCE §§20-21/76; the ADR records that a measured failure of the derivation budget must return as an amendment instead of an undocumented derived cache. No source baseline text was edited.
- Blockers/open questions: The derivation budget itself is unmeasured, so 07.1i/07.V7 remain open until both profiles are benchmarked; impact is that per-request derivation is accepted direction but unproven. Concrete unblock action: implement 07.1b-07.1c first, then measure maximum-body and full-page derivation on Node and workerd and record thresholds. The Issue Form YAML question from the baseline review is still open and unaffected by this session.
- Next actions: Add the concrete allowlist and initial `content-policy` version identifier to `docs/MARKDOWN-POLICY.md`; implement 07.1b-07.1c in `packages/security/markdown` once module 06 prerequisites land; keep 07.1f-07.1i and 07.V6-07.V7 in the review scope of every content endpoint.
- Next-session cautions: Do not add a persisted rendered body, a rendered-body cache table or a client-side sanitizer while implementing 07.1. An ETag or any validator must include the representation kind and policy version, and a policy change must not invalidate stored cursors. `text` is derived at write time; the read path must not re-derive it.

