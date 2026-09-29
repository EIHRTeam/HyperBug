# HyperBug master progress

Last updated: 2026-09-30 (Module 03 reduced to external evidence only: 03.2e, 03.2g, 03.3a, 03.3g, 03.3h, 03.V1, 03.V4, 03.V6 and 03.V7 accepted across 2026-09-29/30, including real Free-plan measurement, the audited provider-outage policy and the deployed tier-gate refusal).

**Current state: module 00 is complete and G0 has passed; module 02 is Complete with committed clean-checkout and hosted-CI evidence. Module 01 remains In Progress because post-completion SAST items are open. Module 03 remains In Progress; standard-profile Argon2id password records and login-time rehash are accepted (03.2e, 2026-09-29), the permission-aware append-only audit service is accepted (03.3a, 2026-09-29) after the audit resume, 03.V4 is accepted, and the audited provider-outage policy (03.3d's audit portion) is implemented. Registration and login consume root-selected approximate shedding, authoritative account/IP counters, trusted subjects and optional CAPTCHA on both standard profiles. Primary-backed session read and logout are integrated; local routes deny tampered cookies and unavailable token keys. A test-only synthetic-address two-Worker deployment proved shared D1 login/session visibility and revocation, with exact cleanup. Genuine client-IP provenance is now proven and cross-location counter consistency demonstrated: on 2026-09-30 the Cloudflare edge was shown to force-add `x-real-ip` equal to the client address (correcting an earlier MITM misdiagnosis), the production gateway was fixed to reject only divergent values (`f9a02e6`), and a real browser completed registration/login/session/logout through a custom-domain deployment with all primary-counter digests matching genuine edge addresses across three client locations. A valid live configured challenge, deployed outage windows and measured budgets remain open; the Node direct-egress adapter succeeded on the clean host for both catalogued GET candidates (see the module record). Module 04 is In Progress only as a narrow Phase 03 dependency; recovery, Staff enrollment and full authorization remain unimplemented. The optional Cloudflare Free minimum tier remains startup-disabled on its separate path; its credential policy is now measured and fixed (03.2g/03.V7, 2026-09-29), with the reviewed floor unmet so tier password login is disabled by rule until plan limits change. Module 03 is reduced to external evidence only (03.3c–03.3f, 03.V2, 03.V3 need genuine trusted ingress, a live Turnstile challenge, an unfiltered Node egress host and cross-location observation); every audit and tier item, including the audited provider-outage policy and the deployed tier-gate refusal, is closed. Audit portions of later modules and further Argon2id performance testing remain stopped. G1/G2 remain closed. Module 07 has an accepted content representation policy but no implementation.**

**Current user-directed state (2026-09-29): the 2026-09-28 feature hold was narrowed by an explicit closure-first instruction for Module 03, under which 03.2e closed and the [closure matrix](evidence/03-closure-matrix.md) was recorded; Module 03 audit work was then resumed by explicit instruction with a Free-tier Wrangler environment and the test-only `hyperbug-test-1` D1 (03.3a accepted). Audit portions of later modules remain suspended.** The original 2026-09-28 hold text follows for the record: pause new features and scope expansion. Existing work was inventoried and committed by dependency; see the [consolidation record](evidence/2026-09-28-worktree-consolidation.md). Do not extend Modules 04/09, start the SPA, enable the Free tier, or resume audit or Argon2id performance work. The normal module sequence resumes only after a later user instruction. On 2026-09-29 the user authorized one closure-first Module 03 session under the same suspensions; it accepted 03.2e and recorded the [closure matrix](evidence/03-closure-matrix.md) without resuming other modules, the SPA, the Free tier, audit work or Argon2id performance exploration. G1/G2 remain closed.

**Audit instruction: [Module 03 audit work resumed 2026-09-29; later-module audit portions remain suspended](AUDIT-SUSPENSION.md).** Module 03 audit items are active (03.3a accepted); later modules' audit tasks and audit portions of mixed tasks remain unchecked until explicitly resumed. Existing audit behavior is preserved.

**Phase 03 composition checkpoint:** Registration and login are real consumers of the root-bound sensitive admission service. Node uses its native socket peer; the Workers root denies unsigned IP-required requests, while local signed ingress and fixed-address test-only gateways reach private API Workers. Both profiles shed account POSTs before parsing and then require authoritative account/IP counters before optional CAPTCHA and password work. Session read/logout have separate trusted-IP approximate buckets; token verification uses primary session state and fails closed on unavailable keys. Test-only deployed private Workers shared D1 for registration/login/session/logout and a prior counter race, using synthetic IP and auth origin. Genuine ingress provenance, a valid live challenge, direct Node Siteverify TLS, cross-location/outage consistency and measured budgets remain open. Approximate allowance never replaces primary enforcement. Both account adapters use additive credential/session migrations. `hyperbug-test-1` has migrations 0000–0011, remains separate from staging/production and has no test accounts or sessions after exact cleanup; permanent removed test-key identity tombstones remain. No module acceptance gate is complete from these partial integrations.

## Module status

| ID | Module | Status | Evidence and handoff |
| --- | --- | --- | --- |
| 00 | [Project maintenance and development guidance skills](modules/00-project-guidance-skills.md) | Complete | [Session record](progress/00-project-guidance-skills.md) |
| 01 | [Backend workspace and runtime foundation](modules/01-backend-foundation.md) | In progress | [Session record](progress/01-backend-foundation.md) |
| 02 | [Public contracts, domain model, and database foundations](modules/02-contracts-and-data.md) | Complete | [Session record](progress/02-contracts-and-data.md) |
| 03 | [Core security, cryptography, audit, and abuse controls](modules/03-security-foundation.md) | In progress | [Session record](progress/03-security-foundation.md) |
| 04 | [Authentication, identity, and project authorization](modules/04-identity-and-access.md) | In progress (narrow 03 dependency) | [Session record](progress/04-identity-and-access.md) |
| 05 | [Plugin protocol, SDK, registry, and trusted runtime](modules/05-plugin-foundation.md) | Not started | [Session record](progress/05-plugin-foundation.md) |
| 06 | [Projects, issues, discussion, and triage backend](modules/06-issue-core.md) | Not started | [Session record](progress/06-issue-core.md) |
| 07 | [Markdown policy, issue forms, templates, and attachments](modules/07-content-and-attachments.md) | Not started | [Session record](progress/07-content-and-attachments.md) |
| 08 | [Structured search, filters, and query performance](modules/08-search-and-query.md) | Not started | [Session record](progress/08-search-and-query.md) |
| 09 | [Outbox delivery, queues, durable workflows, and cleanup](modules/09-async-and-workflows.md) | In progress (narrow 03 dependency) | [Session record](progress/09-async-and-workflows.md) |
| 10 | [Backend acceptance and public API client](modules/10-backend-acceptance.md) | Not started | [Session record](progress/10-backend-acceptance.md) |
| 11 | [Static web application, authentication client, and UI foundation](modules/11-static-web-foundation.md) | Not started | [Session record](progress/11-static-web-foundation.md) |
| 12 | [Public feedback, discussion, and staff web workflows](modules/12-web-product-workflows.md) | Not started | [Session record](progress/12-web-product-workflows.md) |
| 13 | [MVP release, deployment, and maintenance readiness](modules/13-mvp-release-and-operations.md) | Not started | [Session record](progress/13-mvp-release-and-operations.md) |
| 14 | [Post-MVP issue relations, hierarchy, and saved views](modules/14-relations-and-saved-views.md) | Not started | [Session record](progress/14-relations-and-saved-views.md) |
| 15 | [Post-MVP subscriptions, notifications, bulk actions, and data jobs](modules/15-notifications-and-bulk-jobs.md) | Not started | [Session record](progress/15-notifications-and-bulk-jobs.md) |
| 16 | [Post-MVP official plugins and isolated integration APIs](modules/16-official-integrations.md) | Not started | [Session record](progress/16-official-integrations.md) |

All 16 module 00 guidance checklist items are complete. Module 01 has reproducible builds and runtime/local-service tests; module 02 has 25-table dual schemas, atomic repositories, upgrade tests and measured query plans. Evidence-backed checkboxes are tracked in each detailed plan. Foundation acceptance does not open G1; modules 03–16 have no completed implementation gate.

## Gate status

| Gate | Required evidence | Current state |
| --- | --- | --- |
| G0 — Guidance ready | Module 00 skills, registration, and validation | Passed; [evidence](evidence/00-guidance-validation.md) |
| G1 — Backend accepted | Module 10.G1–10.G5 on both profiles | Not passed; SPA development must wait |
| G2 — MVP accepted | Module 13.G1–13.G5 including deployment/recovery evidence | Not passed |
| Post-MVP backend gates | Backend acceptance before UI in 14, 15, and each provider in 16 | Not started |
| Markdown representation policy | Module 07 policy specification and ADR; implementation, determinism and derivation-cost evidence not yet produced | Direction accepted ([ADR 0003](../decisions/0003-markdown-representation-and-pagination.md), [MARKDOWN-POLICY](../MARKDOWN-POLICY.md)); unproven |
| Minimum tier (Cloudflare Free) | 13.G6 evidence on a real Free account: measured password parameters, quota-aware measurements, bilingual disclosure, recorded recovery objectives | Not started; independent of G1/G2 and never cited as MVP acceptance |

## Current decisions and open implementation questions

- Required order: guidance skills first, backend second, SPA only after the backend acceptance gate.
- Both Cloudflare-native and Node/PostgreSQL/S3 self-host profiles are required, following TECH-STACK.
- An opt-in Cloudflare Free minimum tier is defined by ADR 0007; configuration/posture and its PBKDF2/pepper mechanism are partial implementation, while startup remains refused. `cloudflare-free-minimum` removes capabilities, records each deviation from SECURITY, and is accepted by the independent gate 13.G6 without ever substituting for the two first-class profiles or their adapters. See [ADR 0007](../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../FREE-TIER-PROFILE.md).
- Engineering documentation remains English. Reader guides and their entry points now have English and Simplified Chinese versions, per the explicit documentation requirement; historical initial-architecture inputs remain unchanged.
- Exact dependency versions/adapter names, data model concurrency details, auth-library suitability, no-email account recovery, upload immutability, and measured performance budgets remain implementation tasks. See [SOURCES](SOURCES.md#decisions-to-close-during-execution).
- No deployed service, tested cloud account, live provider compatibility, or performance result is claimed by this planning package.
- Content representation is fixed as direction, not as proven implementation: raw Markdown is the only stored body form, the safe representation is derived per request, and the plain-text projection is the only persisted derivative. See [ADR 0003](../decisions/0003-markdown-representation-and-pagination.md) and [MARKDOWN-POLICY](../MARKDOWN-POLICY.md).

## Planning deliverables

- [x] Read the five initial-architecture inputs and identify source refinements and MVP boundaries.
- [x] Read and execute the requested modern-web-guidance skill using search followed by retrieval.
- [x] Consult Context7 for critical Elysia, Drizzle, and Cloudflare implementation assumptions.
- [x] Create the master plan, execution protocol, source/research register, and coverage/handoff map.
- [x] Create 17 ordered module plans and 17 matching progress documents.
- [x] Specify a mandatory progress/change-summary/next-session-caution entry for every affected session.
- [x] Validate relative links, module/progress pairing, checklist IDs, scope/order, and English documentation content.

These checkboxes track this documentation task only, not product implementation.

## Session log

### 2026-09-17 — Detailed plan creation

- Progress: Converted the initial architecture into modules 00–16 with step-level checklists, prerequisites, acceptance cases, and explicit backend/frontend gates.
- Change summary: Added a planning package under `docs/plan/`; separated MVP from post-MVP relations, async user features, and optional integrations.
- Research: Retrieved four modern-web guides and queried Context7 for Elysia, Drizzle, and Cloudflare. Recorded findings, stale/ambiguous source details, and unverified runtime assumptions in SOURCES.
- Files/artifacts: Master documents plus `modules/` and `progress/` pairs; individual records contain module-specific next-session cautions.
- Verification: A one-off Python 3 documentation validator passed for all 39 Markdown files, 17 plan/progress pairs, 212 relative links/anchors, and 316 unique implementation checklist IDs. It also checked required session fields, absence of CJK prose, final newlines, whitespace, and that implementation checkboxes remain unchecked. Manual dependency/scope review and `git diff --check` passed. Untracked plan files were covered by the Python checks. No application tests run; no application code changed.
- Decisions/deviations: Applied the user's guidance-first/backend-first/English/session-log requirements and TECH-STACK's explicit refinements. Did not create the future guidance skills or change the initial architecture.
- Blockers: None for planning. Implementation checks may require installable dependencies, local services, staging access, or provider test accounts.
- Next action: Begin module 00.1 in a subsequent implementation session.
- Next-session cautions: Read EXECUTION and the module 00 record first. Preserve unrelated existing workspace changes; the repository already contained modified/untracked files before this documentation work.

### 2026-09-17 — Module 00 completed

- Progress: Created and validated the two English project guidance skills; G0 passed and module 01 became Ready.
- Change summary: Added root AGENTS, two SKILL.md entrypoints with UI metadata, eight focused references, and a requirement/verification report. Updated module 00 checklist/progress, module 01 readiness, and plan navigation/coverage.
- Verification: Both bundled skill validators, local link/reachability/metadata/English/whitespace/source-preservation checks, and three manual task walkthroughs passed. See [validation evidence](evidence/00-guidance-validation.md) and [module 00 session details](progress/00-project-guidance-skills.md). No application tests or deployment were performed.
- Decisions/deviations: Repository-owned skills share references and retain automatic invocation. No source-baseline deviation; English, session logging, and backend-before-SPA gates are enforced in guidance.
- Blockers: None for module 00; module 01 still needs actual dependency/runtime verification.
- Next action: Begin 01.1a in the next backend implementation task.
- Next-session cautions: G0 proves guidance readiness, not backend readiness. Preserve existing unrelated workspace changes; no package scripts or production resources exist from this task.

### 2026-09-18 — Markdown representation, transport and pagination direction

- Scope and checklist IDs: Cross-module design/policy session owned by module 07 (`07.1a`, `07.1f`–`07.1i`, `07.V6`–`07.V7`), with a downstream contract adjustment in module 12.2a/12.V5. No implementation checklist item was completed. Module 07 moved from `Not started` to `In progress (specification and policy only)`.
- Progress: Resolved the requested content-design question. The server stores raw Markdown only and derives every rendered representation per request; sanitized HTML exists solely for non-browser consumers and is never transported to the SPA; the plain-text projection is the single persisted derivative because search, notifications, list previews and moderation views consume it; derivation stays bounded through the existing cursor pagination contract. Persisting derived HTML/tree and transporting HTML as the client's only body were evaluated and rejected with recorded reasons.
- Change summary: Added the content policy specification (`docs/MARKDOWN-POLICY.md`) and the ADR that the security reference requires for pagination/derived-data architecture. Extended module 07 with four implementation items and two acceptance items, aligned module 12 to render the server-derived representation without client parsing or an HTML sink, added coverage rows, and recorded the direction in this file without changing any initial-architecture source.
- Files/artifacts: `docs/MARKDOWN-POLICY.md` (new); `docs/decisions/0003-markdown-representation-and-pagination.md` (new); `docs/plan/modules/07-content-and-attachments.md`; `docs/plan/modules/12-web-product-workflows.md`; `docs/plan/COVERAGE.md`; `docs/plan/README.md` (specification index); `docs/plan/progress/07-content-and-attachments.md`; this file.
- Verification: Documentation-only session. `python3 /tmp/hyperbug-validate-docs.py` (one-off, not committed) scanned 71 Markdown files and checked 390 relative links and anchors, 17/17 plan-progress pairs, 322 unique checklist IDs, checklist/status consistency for every module, presence of the policy and ADR artifacts, required session-entry fields, markdown-hard-break-aware whitespace, final newlines and dash usage in the new documents. Result: `RESULT: PASS`. No application test, build, runtime check or deployment ran because no application behavior changed.
- Decisions and deviations: Adopted [ADR 0003](../decisions/0003-markdown-representation-and-pagination.md). It refines PRODUCT §17, SECURITY §§53–66 and PERFORMANCE §§20–21/76 without relaxing them; a measured failure of the derivation budget must return as an ADR amendment rather than an undocumented derived cache. No normative baseline text was modified.
- Blockers/open questions: The derivation budget is unmeasured, so 07.1i and 07.V7 stay open until both profiles are benchmarked on real fixtures; per-request derivation is accepted direction but unproven. The Issue Form YAML scope question from the earlier 2026-09-18 review remains open and unaffected.
- Next actions: Add the concrete allowlist and initial `content-policy` version identifier to `docs/MARKDOWN-POLICY.md`; implement 07.1b–07.1c; then implement and measure 07.1f–07.1i on both profiles. Module 01/02 work in progress is unchanged.
- Next-session cautions: Do not introduce a persisted rendered body, a rendered-body cache or a client-side sanitizer while implementing 07.1. Representation validators must include the kind and policy version, stored cursors must survive a policy change, and the read path must not re-derive the plain-text projection.

## Update rule

Update this file whenever module/gate status, scope, or major blockers change. Every affected session must also append its detailed handoff to the relevant per-module progress record, even if master status remains unchanged. A session that only answers a user question and changes no repository state is exempt unless the user asks for a record.


### 2026-09-18 — Phase 01/02 implementation and local acceptance evidence

- Progress: Implemented the dual-runtime workspace and full MVP persistence mappings; no SPA or later feature endpoints. Independent module 02 work follows ADR 0001 while runtime acceptance remains open.
- Verification: Frozen installs, both type configurations/builds, lint/format/boundaries, scans, migration histories and 77 ordinary tests passed in an earlier isolated source copy. The latest current-tree suite passes 80 tests without expected failures after the write-driven workerd disconnect diagnosis and two database regressions; one earlier intermittent Node connection reset remains recorded. See [01 evidence](evidence/01-foundation-validation.md) and [02 evidence](evidence/02-data-foundation-validation.md).
- Decisions/blockers: No security baseline or delivery gate was relaxed. Hosted CI and live deployments are unverified. Preserve the independently authored module 07 content-policy direction; list queries now exclude full Markdown bodies.
- Next action: Complete phase-specific checklist/documentation audit and resolve remaining module 01 acceptance gaps. Per-module records contain exact artifacts, commands and cautions.

### 2026-09-18 — Phase 01/02 completion

- Progress: Modules 01 and 02 are Complete. Workspace/lockfile and dual-runtime/data foundations are committed as `bcd417c` and published on `codex/phase-01-02`.
- Verification: A separate clean committed checkout and [hosted run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101) passed the required quality, Node, workerd and PostgreSQL checks; 80 tests pass with no expected failures. Per-phase evidence maps every checklist ID to its implementation and verification.
- Decisions/blockers: The idle-stream disconnect observation is explained by write-driven workerd detection; bounded heartbeats prove incoming abort/cleanup. No phase acceptance blockers remain. G1 stays closed; no later feature endpoints, SPA, merge or deployment occurred.
- Next action: Hand off the completed phases. Subsequent authorized work follows the next eligible backend module and existing gates. Preserve unrelated root/content-policy/install-script work.


### 2026-09-19 — Bilingual reader documentation site

- Progress: Added matching English/Chinese reader outlines and a locally verified default-theme VitePress site with a GitHub Pages workflow. This is preparation for 13.3d; module 13 release implementation and G1/G2 status are unchanged.
- Scope decision: Reader documentation is now bilingual by explicit user request. Engineering specifications, plans, skills, and progress records remain English. The docs site is separate from the future product SPA.
- Verification: Local site build, 29-page generated-output checks, 13 guide pairs, dependency/license review, and repository quality/build checks passed. Pages enablement and hosted publication remain unverified; no release is claimed.
- Handoff: See [module 13](progress/13-mvp-release-and-operations.md), with guidance and dependency impacts in modules 00 and 01. Preserve independently ongoing module 03 work.

### 2026-09-19 — Phase 03 security development checkpoint

- Progress: Verified 03.1a–03.1d and 03.3b; module 03 remains In progress and the full phase goal remains active. Added object-bound permission/assurance policy, validated security/retention settings, input limits, safe output and explicit CORS.
- Verification: 99 tests across unit/contracts, Node, workerd/D1 and PostgreSQL pass, alongside typecheck/lint/format/build/secret scan/docs build. Reproduced early rejected-body keep-alive reuse was corrected in the Node composition root with a real HTTP regression. See [03 evidence](evidence/03-security-foundation-validation.md) and [handoff](progress/03-security-foundation.md).
- Decisions/blockers: No baseline/gate relaxation; no new dependency in this security batch. Credential crypto, audit access, distributed abuse controls, SSRF and password/runtime acceptance are pending.
- Next action: 03.2 credential and key lifecycle implementation/measurement, then remaining 03.3 and 03.V acceptance. G1/G2 remain closed.

### 2026-09-19 — Phase 03 cryptographic mechanisms checkpoint

- Progress: Completed 03.2a–03.2c using platform HMAC/AES-GCM/AES-KW, versioned context-bound records and Worker-secret/private-file providers. Full Phase 03 remains active.
- Verification: Full current suite passes 105 tests, including both-runtime NIST/RFC vectors and 37 credential/envelope/provider scenarios; actual local secret file/binding tests and both type configurations/builds pass. [Evidence](evidence/03-security-foundation-validation.md).
- Decisions/blockers: ADR 0006 retains current/previous/revoked key semantics through a required lifecycle port. Its durable D1/PostgreSQL implementation is still missing, so 03.2d and all final acceptance items remain unchecked. No new external dependency or production deployment.
- Next action: Implement persistent key lifecycle/reference accounting, then password/transport and remaining Phase 03 enforcement. G1/G2 remain closed.


### 2026-09-19 — Phase 03 durable key lifecycle checkpoint

- Progress: Completed 03.2d using real D1/PostgreSQL registries, atomic protected payload/reference storage, audited transitions, retained-backup pins and guarded key removal.
- Verification: Full current suite **133 passed**; both builds/typechecks, lint, migrations, secret scan and docs build pass. Scoped formatting passes; unrelated concurrent editor/docs formatting prevents a clean full-tree claim. See [03 evidence](evidence/03-security-foundation-validation.md) and [handoff](progress/03-security-foundation.md).
- Decisions/blockers: 0005–0006 applied only locally; no remote mutation or production readiness claim. Global mutation serialization and actual restore/revocation reconciliation remain explicit downstream requirements. Full Phase 03 remains active.
- Next action: 03.2e audited password implementation/runtime benchmark, then 03.2f and remaining enforcement/acceptance. G1/G2 stay closed.

### 2026-09-20 — Opt-in Cloudflare Free minimum tier planned

- Scope and checklist IDs: Documentation-only planning session. Added 03.1e, 03.2g, 03.3g–03.3h, 03.V6–03.V7; 04.1e, 04.2g, 04.V6; 08.2h, 08.V6; 09.1f, 09.2e, 09.3g, 09.V6; 10.2f, 10.3g; 11.1g, 11.V5; 12.3f, 12.V7; 13.1f–13.1g, 13.2g, 13.3f, 13.G6; 16.1d, 16.2i, 16.3f, and amended the wording of 03.V5, 10.1a, 16.2d and 16.2h. No implementation item was completed or checked.
- Progress: Defined one optional `cloudflare-free-minimum` variant of Profile A that keeps account/password login under a measured PBKDF2 policy, replaces free Queues/Workflow durability with a D1 outbox plus bounded Cron dispatch, plans a self-contained SMTP transport, and requires operator, instance and bilingual reader disclosure of every degradation. The two first-class profiles, their adapters and the standard Argon2id baseline are unchanged; module 03's password work keeps its prohibition on parameter reduction for the standard profiles.
- Change summary: Added the tier ADR and specification; extended the module checklists listed above; added specification-index, scope, gate, coverage, handoff and source-register entries; recorded the 2026-09-20 Context7 lookup, its dated provider findings and its remaining gaps.
- Files/artifacts: `docs/decisions/0007-cloudflare-free-minimum-tier.md` (new); `docs/FREE-TIER-PROFILE.md` (new); `docs/plan/README.md`; `docs/plan/SOURCES.md`; `docs/plan/COVERAGE.md`; `docs/plan/modules/{03,04,08,09,10,11,12,13,16}`; the matching nine module progress records; this file.
- Verification: One-off `/tmp/hyperbug-validate-docs-0007.py` (not committed) checked 17/17 plan-progress pairs, 353 unique checklist IDs, and 230 relative links/anchors across the changed and new files, plus final newlines, trailing whitespace, required session-entry fields and English-only engineering prose: `RESULT: PASS`. The three initial failures were the validator's own missing percent-decoding of pre-existing SOURCES links, not document defects. A language-policy regression check confirmed that `AGENTS.md` and `.agents/**` are untouched, and the scoped `git diff --check` reported no whitespace errors in the changed tracked documents. No application test, build, deployment or provider call ran; the provider figures are dated documentation statements, not measured results.
- Decisions and deviations: [ADR 0007](../decisions/0007-cloudflare-free-minimum-tier.md) records the tier, its FREE-01–FREE-08 degradations, the non-negotiable invariants and the rejected alternatives (Durable-Object-hosted Argon2id, split or chained key derivation, client-only hashing, implying Argon2id on the tier, and weakening the standard profiles instead of adding an opt-in tier). No initial-architecture source, AGENTS.md or documentation-language policy changed.
- Blockers/open questions: The tier is direction only and unproven: Free-plan PBKDF2 cost and the reviewed parameter floor (03.V7), the tier gate (03.V6), the account journey (04.V6), quota behaviour (08.V6, 09.V6, 10.3g), disclosure (12.V7) and the independent acceptance (13.G6) are all open. Real Free-plan access is required and cannot be replaced by emulation.
- Next actions: Treat the tier as documentation until 03.V7 exists; the standard plan's next executable item remains module 03's 03.2e password work. When authorized, implement the tier gate (03.3g) before any tier-specific credential code, then 04.1e/04.2g.
- Next-session cautions: Do not offer, advertise or partially enable the minimum tier before its evidence passes; never let the tier's PBKDF2 path verify an Argon2id record; keep tier evidence labelled and out of G1/G2; nothing in this session was committed because the working tree already carried other sessions' module 03, documentation-site and editor changes.

### 2026-09-20 — Minimum-tier posture and startup foundations

- Progress: Completed 03.1e; implemented strict configuration and startup refusal for the unfinished optional tier as part of 03.3g. Standard roots preserve their current behavior. The user stopped further Argon2id performance exploration; archived results remain exploratory and password implementation acceptance stays open.
- Verification: Current affected lanes **104 passed** (25 unit/contract, 20 Node, 59 workerd/D1), both typechecks/builds, lint, scoped formatting and secret scan pass. No PostgreSQL rerun, hosted CI, real Free-plan measurement or deployment is claimed. See [tier evidence](evidence/03-deployment-tier-validation.md) and [module 03 handoff](progress/03-security-foundation.md).
- Decisions/blockers: ADR 0007 is enforced as explicit selection, exact acknowledgement and Cloudflare-only scope. Config parsing does not expose unfinished capabilities; a shared no-override startup barrier remains. Full 03.3g, all security acceptance checks and independent 13.G6 are open; G1/G2 remain closed.
- Next action: Implement 03.3a permission-aware audit service, then remaining tier activation and Phase 03 enforcement. Do not resume Argon2id performance probing or claim completion of Phase 03 at this checkpoint.

### 2026-09-25 — Audit suspension and transport verification checkpoint

- Progress: The 2026-09-21 user instruction suspends all audit plans while non-audit Phase 03 development continues. The unfinished audit service was parked locally with snapshots, preserving existing audit tables, triggers and atomic writes. Completed 03.2f with a repeatable seven-case Node TLS probe, dated platform/provider documentation, a deployment verification procedure and crypto-agility evidence fields.
- Verification: The local TLS result on Node 24.21.0/OpenSSL 3.5.8 records hybrid and classical negotiations plus expected certificate/group/protocol failures; it does not certify deployed TLS or PQ authentication. Transport checkpoint lint, secret scan, docs build and scoped formatter passed. Documentation consistency passed for 17 plan/progress pairs, 353 unique IDs, 20 visibly suspended unchecked audit lines, 364 relative links and seven TLS observations; scoped whitespace check passed.
- Decisions/blockers: [Suspension register](AUDIT-SUSPENSION.md) overrides older next-action text; no audit or Argon2id performance work was resumed. [Transport specification](../TRANSPORT-SECURITY.md) and [local evidence](evidence/03-node-transport-capability.json) distinguish platform capability from live configuration. The optional minimum tier still refuses startup; 03.V acceptance and G1/G2 remain open.
- Next action: Continue 03.3c–03.3f non-audit abuse, outbound and cache/failure enforcement. Preserve the audit suspension and current minimum-tier barrier.

### 2026-09-25 — Fixed-destination outbound mechanism checkpoint

- Progress: Started 03.3e with a shared HTTPS destination catalog and bounded fetch wrapper. Five focused unit cases, both type configurations/builds, lint, secret scan and scoped documentation checks pass. The item remains unchecked pending real Node/Workers egress and provider integration evidence.
- Decisions/blockers: No arbitrary URL or private-network access is enabled. [Outbound specification](../OUTBOUND-SECURITY.md) records DNS/egress gaps and the exact integration contract; 03.V2 and all release gates remain open.
- Next action: Continue non-audit rate/abuse enforcement, then finish outbound integration and cache/failure handling.

### 2026-09-25 — Rate-limit foundation checkpoint

- Progress: Local D1/PostgreSQL atomic sensitive counters, bounded purge, HMAC subject digests, key-rotation overlap, separate approximate Node/Workers adapters and closed HTTP 429/503 mapping now exist. `03.3c`, non-audit `03.3d` and `03.V3` remain unchecked because route enforcement, trusted address/key composition, live Workers binding and multi-instance evidence are open.
- Verification: Workerd/D1 repository 42 passed and isolated PostgreSQL 18.6 repository 40 passed; after HTTP mapping, focused unit 11, Node HTTP 18 and workerd HTTP 18 passed. Both typechecks passed. [Detailed evidence](evidence/03-rate-limits-validation.md) and [module 03 handoff](progress/03-security-foundation.md) distinguish local checks from deployment acceptance.
- Decisions/blockers: [ADR 0008](../decisions/0008-rate-limit-consistency.md) separates authoritative sensitive writes from approximate load shedding. The optional minimum tier stays disabled, all audit work remains suspended, and Argon2id performance exploration remains stopped. G1/G2 remain closed.
- Next action: Wire trusted subject/key provisioning and category policy into actual routes, configure/test the Workers binding, and measure multi-instance/outage behavior; then continue 03.3e–03.3f. Module 09 must schedule bounded counter expiry cleanup.

### 2026-09-25 — Dedicated abuse-key source and local Workers binding checkpoint

- Progress: A strict current/previous abuse HMAC key ring now loads from a separate Node private file or Worker Secret; Wrangler declares distinct approximate rate-limit namespaces for local/staging/production and generated Env types include both bindings. Shared admission now validates and consumes multiple dimensions/versions with a bounded write count. These mechanisms remain unwired in production roots and routes, so 03.3c/03.3d/03.V3 stay open.
- Verification: Key-source unit 3, Node 1 and workerd HTTP 20 passed; the workerd fixture exercised a Miniflare binding through two allowed calls and one denial. Both typechecks, lint, builds and secret scan passed. [Evidence](evidence/03-rate-limits-validation.md) separates emulator results from deployed claims.
- Decisions/blockers: The 1,000-call/60-second binding ceiling is provisional approximate shedding, never the sensitive gate. Real secret provisioning, account namespace ownership, trusted IPs, route wiring, category budgets and multi-instance/outage evidence remain. Audit stays suspended, Argon2id performance exploration stays stopped and the optional minimum tier stays disabled.
- Next action: Implement category dimension policy and trusted request-subject composition, then use the primary counters on actual route owners; complete the non-audit 03.3e–03.3f work separately.

### 2026-09-25 — Address boundary and private-cache checkpoint

- Progress: Strict IPv4/IPv6 canonicalization and a Node socket-peer resolver now have local tests; forwarding headers are ignored. A dual-runtime regression exposed that a native handler `Response` could override the earlier `Cache-Control: no-store` default, and a late shared guard now enforces no-store for native/immutable responses and handler header changes. Phase 03 remains In progress; 03.3c, non-audit 03.3d, 03.3f and 03.V3 remain open.
- Verification: Address checks passed 2 unit, 19 Node HTTP and 21 workerd HTTP cases. The cache case failed on both profiles before the fix; afterward Node HTTP 20/20, workerd HTTP 22/22, both typechecks and lint passed. See [rate evidence](evidence/03-rate-limits-validation.md) and [security evidence](evidence/03-security-foundation-validation.md). This is local Node/Miniflare evidence, not deployed ingress or CDN evidence.
- Decisions/blockers: Cloudflare subrequest provenance and Node reverse-proxy trust are unresolved; no actual login/product route uses the counters yet. Keep the optional minimum tier disabled, audits suspended and Argon2id performance testing stopped. G1/G2 remain closed.
- Next action: Define route-category dimensions and measured budgets, establish trusted ingress, and wire authoritative rate decisions into the first route owner; then finish the remaining non-audit outbound and provider-failure work.

### 2026-09-25 — Single-snapshot sensitive admission checkpoint

- Progress: A shared route-facing admission call now combines the dedicated abuse-key provider with multi-dimension authoritative counters using one key-ring snapshot. It validates and snapshots route inputs before awaits and fails closed on provider, cancellation or counter failure. Phase 03 remains In progress; the optional minimum tier is still disabled.
- Verification: Focused unit 14/14, local D1/workerd repository 43/43 and isolated PostgreSQL 18.6 repository 41/41 passed, along with both typechecks and lint. See [rate evidence](evidence/03-rate-limits-validation.md). The local adapter contract is stronger than mock-only evidence but does not prove deployed ingress, cross-location behavior or an actual protected route.
- Decisions/blockers: Route owners must still select trusted subjects and measured category budgets, provision real secrets and enforce decisions before side effects. Cloudflare/Node ingress trust and multi-instance/outage acceptance remain open; 03.3c, non-audit 03.3d and 03.V3 stay unchecked. Audits remain suspended and Argon2id performance testing remains stopped; G1/G2 stay closed.
- Next action: Integrate this admission path into the first actual category route once its owner and ingress policy are ready, then complete the deployed consistency/outage matrix and remaining non-audit 03.3e–03.3f work.

### 2026-09-25 — Outbound cancellation checkpoint

- Progress: The fixed-destination outbound wrapper now denies caller cancellation promptly even when an injected transport ignores abort, while retaining its concurrency slot until that transport settles. 03.3e and 03.V2 remain open pending real profile egress and provider integration.
- Verification: Focused outbound unit cases passed 6/6; both typechecks and lint/boundaries passed. [Outbound policy and evidence](../OUTBOUND-SECURITY.md) distinguish this local behavior from deployed DNS/egress safety.
- Decisions/blockers: Node connection-time DNS/address policy and Cloudflare's effective provider restrictions still need real validation. No audit or Argon2id performance work resumed; the optional minimum tier remains disabled and G1/G2 closed.
- Next action: Verify both runtime egress boundaries and integrate the first exact provider destination under 03.3e, while Phase 03 rate-route and provider-failure work continues.

### 2026-09-25 — Node direct-egress mechanism checkpoint

- Progress: A Node-only catalogued HTTPS transport now rejects nonpublic DNS answer sets at connection time, pins one approved address and checks the connected peer while retaining TLS hostname verification. It is not wired into the health-only production root or a provider route; 03.3e and 03.V2 remain open.
- Verification: Focused Node 3/3 and shared outbound unit 6/6 passed, alongside both typechecks and lint. A real read-only probe was safely denied because this host's DNS returned `198.18.0.0/15`; it did not prove public direct TLS. See [outbound evidence](../OUTBOUND-SECURITY.md).
- Decisions/blockers: This direct adapter will not inherit the host proxy or admit special-use addresses. Target egress/firewall and successful TLS behavior, Cloudflare restrictions and an exact provider contract still need evidence. Audit work and Argon2id performance testing remain stopped; the minimum tier is disabled and G1/G2 closed.
- Next action: Verify the Node adapter on an eligible direct-egress deployment or implement a separately reviewed restricted proxy transport; establish Cloudflare provider behavior before closing 03.3e/03.V2.

### 2026-09-25 — Phase 03 crypto acceptance checkpoint

- Progress: 03.V1 is complete: Node and workerd each passed four known-answer vectors and 37 shared crypto scenarios, while the real PostgreSQL and D1 adapters each passed the eight-check durable envelope rotation/revocation proof. Module 03 remains In progress.
- Verification: Focused Node HTTP 20/20, workerd HTTP 22/22, workerd/D1 repository 43/43 and isolated PostgreSQL 18.6 repository 41/41 passed. [Foundation evidence](evidence/03-security-foundation-validation.md) records scope and limitations.
- Decisions/blockers: This closes only the stated local cross-runtime crypto verification. Audit work remains suspended, Argon2id performance testing stopped, the optional minimum tier disabled, and 03.V2–03.V7/G1/G2 open.
- Next action: Continue non-audit 03.3c–03.3f route, egress and provider-failure development without claiming deployed acceptance.

### 2026-09-25 — Workers outbound cache checkpoint

- Progress: Fixed-destination provider subrequests now explicitly use `cache: 'no-store'`; the Cloudflare compatibility flag and local workerd fixture declare support. 03.3e, 03.3f and 03.V2 remain partial/open because provider routes and live egress/cache verification are still absent.
- Verification: Outbound unit 6/6, workerd HTTP 22/22 and Node outbound 2/2 passed; both typechecks, lint/boundaries, profile/fixture builds and secret scan passed. [Outbound specification](../OUTBOUND-SECURITY.md) records the dated Cloudflare documentation and limits.
- Decisions/blockers: Keep manual redirects, exact destinations and the disabled minimum tier. This local mechanism is not deployed Workers DNS/egress evidence. Audit and Argon2id performance work remain stopped; G1/G2 stay closed.
- Next action: Integrate a reviewed exact provider destination and route-owned admission, then obtain live behavior evidence for the remaining non-audit acceptance.

### 2026-09-25 — Explicit outbound transport checkpoint

- Progress: Shared outbound construction no longer defaults to global `fetch`; it now requires an explicit profile transport. Node continues to use its DNS-filtered direct HTTPS adapter, and a Workers composition explicitly selects platform `fetch`. 03.3e and 03.V2 remain open.
- Verification: Shared outbound unit 6/6 and Node address/transport 3/3 passed, along with both typechecks and lint/boundaries. [Outbound specification](../OUTBOUND-SECURITY.md) records the invariant and live-evidence gap.
- Decisions/blockers: No provider route or deployed egress test was added. Audit remains suspended, Argon2id performance testing stopped, the optional minimum tier disabled, and G1/G2 closed.
- Next action: Integrate the first exact provider through the profile compositions and test real egress before considering 03.3e/03.V2 complete.

### 2026-09-25 — Optional minimum-tier password mechanism checkpoint

- Progress: Partial 03.2g adds a separate `password-pepper` key purpose, strict PBKDF2-HMAC-SHA256 records, native Web Crypto derivation, context-bound verification and login-time replacement records. Dual-dialect 0008 preserves key/backup lifecycle integrity. Module 03 remains In progress, module 02 remains Complete, and the optional tier still fails startup.
- Verification: Final local suite 193/193 passed (unit/contract 49, Node 29, workerd/D1 72, PostgreSQL 18.6 43); focused repository suites passed 45/45 and 43/43 after correcting a backup-retention test clock. Typechecks, lint/boundaries, migration check, builds, docs build and secret scan passed. 0008 applied/no-opped on local D1 only. [Tier evidence](evidence/03-deployment-tier-validation.md) and [module handoffs](progress/03-security-foundation.md) give the detailed scope.
- Decisions/blockers: Fixture iterations 1,000/1,200 are not production policy. A real Free-plan cost curve and reviewed floor, startup pepper check, account integration and independent 13.G6 acceptance remain before tier activation. 03.2g and 03.V7 stay open; no audit plan or Argon2id performance work resumed. G1/G2 remain closed.
- Next action: Keep the tier disabled; obtain 03.V7 evidence before parameter selection, while continuing eligible non-audit Phase 03 development. Preserve immutable 0000–0008 migrations and the audit suspension.

### 2026-09-25 — Exact-origin response-boundary checkpoint

- Progress: A shared native-response regression exposed that an unapproved handler `Access-Control-Allow-Origin` could override request-time CORS on both Node and workerd. The late shared guard now restores the trusted origin, request ID, `Vary`, `nosniff` and no-store headers for native, replaced-set, error and immutable responses. This reinforces 03.3b and advances partial 03.3f without changing its open provider-failure scope.
- Verification: The new test failed on both runtimes before the fix; afterward focused Node 22/22 and workerd 24/24 passed. The full local suite passed 195/195, with both typechecks, lint/boundaries, profile/fixture builds, secret scan and scoped source formatting also passing. [Foundation evidence](evidence/03-security-foundation-validation.md) records the exact behavior and Context7 lookup.
- Decisions/blockers: Local runtime behavior does not prove deployed CDN/ingress configuration or complete key/token/CAPTCHA/plugin failure handling. 03.3f and G1/G2 remain open; all audit work is suspended, Argon2id performance testing stopped and the minimum tier disabled.
- Next action: Continue non-audit route and provider enforcement, then verify deployment behavior against the open Phase 03 acceptance matrix.

### 2026-09-25 — Sensitive HTTP admission checkpoint

- Progress: The shared server now runs the authoritative abuse-key/counter admission before a route's protected action and maps limited attempts to bounded 429 or unavailable/malformed/cancelled checks to safe 503. A Node/workerd HTTP fixture verifies that a denied attempt never reaches its action; no production account or product route was added. 03.3c–03.3d, 03.3f and 03.V3 remain open.
- Verification: Focused Node 23/23 and workerd 25/25 passed; full local suite 197/197 passed, alongside both typechecks, lint/boundaries, profile/fixture builds, secret scan and scoped formatting. [Rate evidence](evidence/03-rate-limits-validation.md) separates fixture HTTP mapping from real D1/PostgreSQL repository evidence and deployment gaps.
- Decisions/blockers: Actual trusted subjects, measured budgets, real key provisioning, route ownership and multi-instance/outage behavior remain. No audit or Argon2id performance work resumed; the minimum tier stays disabled and G1/G2 closed.
- Next action: Integrate this guard with the first owned sensitive route and its real primary store, then verify ingress and consistency in both deployments before accepting the remaining rate-limit items.

### 2026-09-25 — Category dimension policy checkpoint

- Progress: A frozen per-category policy now requires independent account/IP, principal/project, IP/route or principal/IP dimensions as appropriate. Both direct and route-facing admission reject missing required dimensions before counter writes; the route-facing path rejects before key reads. The HTTP fixture now uses account+IP. Module 03 stays In progress; 03.3c–03.3d and 03.V3 remain open.
- Verification: Focused unit 15/15, Node HTTP 23/23 and local workerd HTTP 25/25 passed; full local suite 198/198, both typechecks, lint/boundaries, profile/fixture builds, docs build, secret scan, scoped formatting and 154 affected-document links passed. [Rate evidence](evidence/03-rate-limits-validation.md) distinguishes this local policy proof from route and deployment acceptance.
- Decisions/blockers: No numerical budgets, production route, trusted Cloudflare ingress or secret provisioning were inferred. [Password research](evidence/03-password-research.md) records Node 24's experimental asynchronous Argon2id API without resuming performance work or choosing a standard-profile provider. Audits remain suspended and the optional minimum tier disabled.
- Next action: Wire authoritative admission to the first real route after its identity and trusted-ingress contract exists, then verify primary-store and multi-instance behavior. Continue other non-audit 03.3e–03.3f work.

### 2026-09-25 — Authorization route guard checkpoint

- Progress: Shared route authorization now stops protected work on object denial, stale assurance and resolver exception/timeout/cancellation, mapping them to closed no-store 403/503 errors. The resolver snapshots policy bounds before the asynchronous facts lookup. A Node/workerd fixture verifies the action does not execute after denial and that mid-check policy mutation cannot widen recent-authentication admission. This advances only the non-audit authorization part of 03.3f; the item and G1/G2 remain open.
- Verification: Focused security unit 6/6, Node HTTP 24/24 and local workerd HTTP 26/26 passed; full local suite 200/200, both typechecks, lint/boundaries, profile/fixture builds, docs build, secret scan, scoped formatting and 176 affected-document links passed. [Foundation evidence](evidence/03-security-foundation-validation.md) records the fixture scope.
- Decisions/blockers: Current token/session loading, production route ownership and key/CAPTCHA/plugin provider failures remain. No audit or Argon2id performance work resumed; the minimum tier remains disabled.
- Next action: Use the guard when module 04 supplies current identity facts, while continuing the other non-audit 03.3e–03.3f work.

### 2026-09-25 — Standard password record checkpoint

- Progress: Shared v1 Argon2id records and a non-downgrading rehash contract now have an unwired Node 24 asynchronous provider candidate. A functional Node known-answer/match test passes; Workers provider, account integration and accepted standard-profile parameters remain open. 03.2e, 03.V5 and module 03 remain In progress.
- Verification: Focused standard-password unit 3/3 and Node functional 1/1; full local suite 204/204, both typechecks, lint/boundaries, profile/fixture builds, docs build, secret scan, scoped formatting and 166 affected-document links passed. [Password research](evidence/03-password-research.md) separates this mechanism from the unresolved provider/release evidence.
- Decisions/blockers: The Node API is experimental; no production parameter or provider acceptance was inferred. Audits remain suspended, Argon2id performance testing stopped, and the optional minimum tier disabled. G1/G2 remain closed.
- Next action: Continue non-audit Phase 03 work and prepare reviewed Workers provider/account integration under the open password gates.

### 2026-09-25 — Standard Workers password candidate checkpoint

- Progress: Added an unwired static-Wasm `libsodium-sumo` Workers Argon2id provider candidate behind the shared port. Local workerd and Node functional tests match the same public vector. 03.2e/03.V5 and all release gates remain open.
- Verification: Full local suite 205/205, final workerd rerun 76/76, both typechecks, lint/boundaries, profile/fixture builds, docs build, license and secret scans, scoped formatting/whitespace and 171 links in four affected documents passed. No Argon2id performance run, audit work, or deployed paid Workers check occurred. [Password evidence](evidence/03-password-research.md) records provenance, limits and current documentation lookups.
- Decisions/blockers: The optional Free minimum tier remains disabled with separate PBKDF2 policy. Provider suitability, deployment packaging, production parameter policy and account integration remain unresolved; no password release acceptance is inferred.
- Next action: Continue eligible non-audit Phase 03 work, preserving the unwired candidates and the suspended audit/performance work.

### 2026-09-25 — Standard-profile password-login direction

- Progress: Recorded the user's decision that standard-profile password login may open after functional account/provider implementation; independent audit may be deferred or run in parallel and must not block development or login enablement. Further Argon2id performance testing remains stopped. The optional Free tier retains its separate PBKDF2 floor and acceptance gates.
- Files/artifacts: [ADR 0009](../decisions/0009-standard-password-login.md), modules 03 and 04, [audit suspension](AUDIT-SUSPENSION.md), [cryptography guidance](../CRYPTOGRAPHY.md), [password research](evidence/03-password-research.md), and module 03/04 progress records.
- Verification: VitePress documentation build passed; 290 local links across 12 affected documents and scoped `git diff --check` passed. No application tests were run because this batch changed planning policy only.
- Decisions/blockers: No login implementation is claimed and no 03.2e/03.V5 evidence is marked complete. Functional provider wiring and account integration remain.
- Next action: Continue non-audit Phase 03 implementation, then implement the approved standard-profile password flow under module 04.

### 2026-09-26 — Bounded sensitive admission checkpoint

- Progress: The shared authoritative rate-admission guard now requires a bounded route-selected deadline; stalled key/counter operations and invalid deadlines return closed 503 before protected work. 03.3c–03.3d, 03.3f and 03.V3 remain open for real-route and deployment acceptance.
- Verification: Focused Node HTTP 24/24 and local workerd HTTP 26/26; full local suite 205/205, both typechecks, lint/boundaries, docs build, secret scan, scoped formatting/whitespace and 192 links in six affected documents passed. [Rate evidence](evidence/03-rate-limits-validation.md) records the fixture scope and late-write caveat.
- Decisions/blockers: No production deadline or numerical budget was inferred. Audits remain suspended, Argon2id performance testing stopped, the Free tier disabled, and ADR 0009's standard login direction unchanged.
- Next action: Wire the guard to the first real sensitive route with authoritative subjects/store, then verify deployed consistency and outage behavior.

### 2026-09-26 — Standard password interoperability and packaging checkpoint

- Progress: Added repeatable local tests for Node/workerd exchange of versioned Argon2id records and Wrangler dry-run JS/Wasm packaging. The emitted Wasm matches the vendored SHA-256, and the emitted bundle passes the public vector in local workerd. The provider candidates remain unwired; 03.2e, 03.V5 and release gates stay open.
- Verification: Focused workerd password file 3/3 and full local suite 207/207 (unit/contract 53, Node 33, workerd/D1 78, isolated PostgreSQL 18.6 43) passed; both typechecks, lint/boundaries, docs build, scoped formatting and 195 relative links across four changed documents passed. [Password evidence](evidence/03-password-research.md) records the local scope and the concurrent lint-fixture failure that passed on rerun. Repository-wide diff whitespace still has two pre-existing out-of-scope findings; the changed files pass scoped checks. No paid Workers deployment, Argon2id performance run or audit was performed.
- Decisions/blockers: ADR 0009 still permits standard-profile login after functional account/provider integration without making an independent audit or further performance test a gate. The optional Free tier remains disabled and PBKDF2-only. Accepted parameters, account persistence/rehash and paid deployment behavior remain open.
- Next action: Continue non-audit Phase 03 development, then implement the standard-profile account/password flow under module 04 when its dependencies are ready; preserve migrations 0000–0008 and the existing uncommitted worktree.

### 2026-09-26 — Standard readiness posture checkpoint

- Progress: `/health/ready` now reports the selected tier, degradation IDs and required password-hash policy on both success and unavailable responses. Both production roots locally return `standard`, `[]` and `argon2id`; liveness remains status-only. This is policy metadata, not login availability. The optional Free minimum tier still fails startup; 03.3g and 03.V6 remain open.
- Verification: Focused contract 1/1, Node HTTP/entry 25/25 and local workerd HTTP/entry/deployment 29/29 passed. Full local suite passed 207/207 (unit/contract 53, Node 33, workerd/D1 78, isolated PostgreSQL 18.6 43); both typechecks, lint/boundaries, builds, docs build, secret scan, scoped formatting and 218 relative links across ten changed documents passed. [Tier evidence](evidence/03-deployment-tier-validation.md) and the [rate policy](../RATE-LIMITING.md) record the scope and 2026-09-26 Cloudflare header lookup.
- Decisions/blockers: Cloudflare documents that same-zone Worker subrequests can influence `CF-Connecting-IP` through mutable `x-real-ip`; no verified discriminator for this deployment was found. No sensitive Workers route is exposed; future IP admission must fail closed pending deployed ingress proof. Audit work stays suspended, Argon2id performance testing stopped, and the minimum tier unavailable.
- Next action: Continue non-audit route/provider integration under 03.3c–03.3f; keep the minimum barrier and all acceptance gates open until their actual evidence exists.

### 2026-09-26 — Minimum-tier stored password cost bound

- Progress: The optional PBKDF2 verifier now requires a caller-selected current/maximum iteration policy and rejects an over-maximum stored record before pepper lookup or derivation. A stronger stored record within the maximum still verifies without downgrade. The tier remains startup-disabled; 03.2g, 03.V7 and 13.G6 stay open.
- Verification: Focused Node HTTP 24/24 and local workerd HTTP 26/26 passed; full local suite 207/207 (unit/contract 53, Node 33, workerd/D1 78, isolated PostgreSQL 18.6 43), both typechecks, lint/boundaries, builds, docs build, secret scan, scoped formatting, 204 relative links across five changed documents and scoped whitespace passed. [Tier evidence](evidence/03-deployment-tier-validation.md) records the sentinel-provider case and durable-registry fixture scope.
- Decisions/blockers: The 1,000/1,200 fixture counts and one-million parser cap are not production parameters. Real Cloudflare Free measurements and a reviewed floor remain required. No audit or Argon2id performance work resumed.
- Next action: Continue non-audit Phase 03 integration; retain the minimum startup barrier and preserve migrations 0000–0008.

### 2026-09-26 — Standard Node verifier snapshot

- Progress: The asynchronous Node Argon2id candidate now snapshots fixed-length verifier bytes before native derivation and clears its owned copy afterward, matching the Workers candidate's behavior. A caller changing its buffer mid-operation cannot alter the comparison. Standard password login remains unwired and 03.2e/03.V5 stay open.
- Verification: Focused Node functional test 1/1 and full local suite 207/207 (unit/contract 53, Node 33, workerd/D1 78, isolated PostgreSQL 18.6 43) passed; both typechecks, lint/boundaries, builds, docs build, secret scan, scoped formatting, 212 relative links across four changed documents and scoped whitespace passed. [Password evidence](evidence/03-password-research.md) records the input-mutation case and existing rehash bounds.
- Decisions/blockers: Clarified in [cryptography guidance](../CRYPTOGRAPHY.md) that the deployment-selected stored-cost maximum remains necessary but further Argon2id performance characterization is not a standard-login prerequisite under ADR 0009. No parameters or account flow were selected; audit work stays suspended and the optional Free tier disabled.
- Next action: Continue the functional standard-profile provider/account path and remaining non-audit Phase 03 integration; preserve migrations 0000–0008.

### 2026-09-26 — Optional CAPTCHA provider composition checkpoint

- Progress: Both production roots now select a Turnstile CAPTCHA gate only when secret, site key and trusted hostname bindings are complete. No setup preserves startup, partial setup refuses startup, and the shared Elysia context carries the gate for later routes. The Siteverify adapter uses one exact outbound operation. No product route or public site-key capability uses it yet, so 03.3e–03.3f/03.3h and 03.V2 remain open.
- Verification: Focused Turnstile unit 5/5, Node HTTP/entry/deployment 28/28 and local workerd HTTP/entry/deployment 31/31 passed, along with both typechecks, lint/boundaries, builds, docs build and secret scan. [Module 03 handoff](progress/03-security-foundation.md) records the initial corrected lint failure and Cloudflare local `.dev.vars` limitation. No live provider, full suite, audit or Argon2id performance test ran.
- Decisions/blockers: Optional bindings stay out of Wrangler's required-secret list; Cloudflare's documented local secret filtering limits `.dev.vars` use. Actual deployed binding/egress behavior, owned route/action and public widget capability remain. The Free minimum tier stays disabled.
- Next action: Wire the decorated gate and authoritative rate admission to the first owned sensitive route, then verify both profiles and live provider behavior without resuming suspended audit or Argon2id performance work.

### 2026-09-26 — Standard password root packaging handoff

- Progress: Both production roots now construct their standard-profile Argon2id service with the initial 19 MiB/two-pass/one-lane policy; no account route uses it. The production Worker build copies its static Wasm, and a Wrangler dry-run emits the pinned binary. Optional CAPTCHA behavior remains no-setup startup and automatic selection from complete runtime bindings; no product route requires it yet.
- Verification: Focused Node entry/deployment passed 3/3, local workerd entry/deployment passed 4/4, both typechecks and lint/boundaries passed after an initial missing-Wasm failure was fixed. The full build, docs build, secret scan, scoped formatting/whitespace and 232 relative links passed. The emitted production-root Wasm SHA-256 matched the vendored source. No deployment, full suite, audit or Argon2id performance test ran.
- Decisions/blockers: Cloudflare's current `secrets.required` documentation confirms extra local `.dev.vars` keys are filtered, so optional Turnstile remains outside the required list and uses an explicit runtime binding for local proof. Account persistence/rehash, paid Workers execution, public site-key delivery and live Turnstile operation remain open. The Free minimum tier still refuses startup.
- Next action: Continue non-audit Phase 03 integration and preserve all open acceptance gates; integrate constructed password and CAPTCHA services with the first owned account routes when module 04 opens.

### 2026-09-26 — Combined sensitive admission checkpoint

- Progress: The shared app now exposes one route-facing service that runs authoritative rate admission before the optional CAPTCHA gate. The no-provider path still requires rate admission; configured missing/outage challenges deny, and rate denial avoids provider egress. The dual-runtime proof route uses it, but no product route does.
- Verification: Focused unit 3/3, Node HTTP 25/25, local workerd HTTP 27/27, both typechecks, lint/boundaries, full build, docs build, secret scan, scoped formatting/whitespace and 235 relative links passed after correcting the initial write-count and optional-type failures. [Module 03 progress](progress/03-security-foundation.md) records limits; no full suite, deployment, audit or Argon2id performance test ran.
- Decisions/blockers: This is a composable enforcement mechanism, not product-route acceptance. Trusted subjects, route budgets, real secret provisioning, public widget capability and deployed provider behavior remain. The Free minimum tier still refuses startup.
- Next action: Continue non-audit Phase 03 integration and use the combined service in the first owned sensitive route after its identity/ingress contract is ready.

### 2026-09-26 — Optional local Turnstile development path

- Progress: An opt-in `local-turnstile` Wrangler environment now loads complete provider bindings from its ignored local secret file, while the normal local, staging and production configurations keep CAPTCHA optional. The separate local rate-limit namespace and D1 binding are declared explicitly for the named environment.
- Verification: Wrangler types and a dry-run passed; installed Wrangler 4.133.0 loaded all five hidden local bindings and returned ready 200. The normal no-CAPTCHA local command also returned ready 200. Both local servers were stopped and the temporary fixture file removed. Typecheck, lint, docs build, secret scan, scoped formatting/whitespace and 231 relative links passed. [Module 03 progress](progress/03-security-foundation.md) records the exact scope; no live provider call, deployment, audit or Argon2id performance test ran.
- Decisions/blockers: No product route or public site-key capability consumes the gate yet. The named environment solves local secret-file filtering without requiring Turnstile in the ordinary profiles; deployed binding/egress behavior remains open. The Free minimum tier stays startup-disabled.
- Next action: Continue non-audit Phase 03 work and use the configured local path when an owned sensitive route becomes available.

### 2026-09-26 — Root-bound sensitive admission checkpoint

- Progress: The shared app now binds sensitive admission to root-selected abuse-key and primary counter sources, denying when absent. Cloudflare selects D1 plus its Worker Secret when D1 exists; Node selects PostgreSQL plus a private file from a complete explicit configuration pair. No product route or gate was opened. CAPTCHA remains optional and automatically selected from complete bindings.
- Verification: Focused unit 5/5, Node HTTP/entry/configuration 28/28 and local workerd HTTP/entry 28/28 passed. Both typechecks, lint/boundaries, full build, docs build, frozen offline install, scoped formatting and whitespace passed. [Module 03 handoff](progress/03-security-foundation.md) records the test scope and remaining root-query gap. No deployed provider, broad suite, audit or Argon2id performance test ran.
- Decisions/blockers: Missing dependencies deny instead of falling back to approximate counters; partial Node setup refuses startup. Owned sensitive routes, trusted IP provenance, measured budgets, deployed stores/secrets, Node root query behavior and Free-tier quota reconciliation remain open. The Free tier stays startup-disabled.
- Next action: Continue non-audit Phase 03 route/provider integration, first exercising the configured Node root against an isolated PostgreSQL instance and then using the guard in an owned route when its identity/ingress contract exists.

### 2026-09-26 — Node socket and Cloudflare inventory checkpoint

- Progress: The Node sensitive-admission root now accepts a complete Unix-socket configuration with its private abuse-key file. Its configured key source and primary counter passed a local PostgreSQL 18.6 functional attempt/limit check. Read-only Wrangler inventory found no HyperBug D1 database in either connected account; staging and production IDs remain unset.
- Verification: Node configuration 2/2 and PostgreSQL repository 45/45 passed, with both typechecks, lint/boundaries, full build, docs build, formatting and scoped whitespace. No product route, deployed provider, audit or Argon2id performance test ran.
- Decisions/blockers: No cloud resource was created or changed. Owned sensitive routes, trusted Workers IP provenance, route budgets, real secrets and deployed multi-instance behavior remain open; the Free minimum tier remains startup-disabled and its D1-per-login write model unselected pending quota evidence.
- Next action: Continue non-audit 03.3c–03.3f integration and preserve no-setup/automatic configured CAPTCHA behavior.

### 2026-09-26 — Root-owned IP admission checkpoint

- Progress: The bound sensitive-admission guard now replaces route-supplied IP subjects with its root-selected address. Node selects the native socket peer; Workers IP-required categories deny until trusted ingress provenance is established. CAPTCHA remains optional with automatic verification when complete Turnstile bindings are present. No product route or acceptance gate was opened.
- Verification: Focused unit/Turnstile 10/10, Node HTTP/configuration 27/27 and entry/deployment 3/3, local workerd HTTP 27/27 and entry/deployment 4/4 passed; both typechecks, lint/boundaries, full build, docs build, scoped formatting and whitespace passed. The known `cloudflare:workers` warning remained non-fatal. No audit or Argon2id performance test ran.
- Decisions/blockers: Route code cannot choose an IP subject for the bound guard. Reverse-proxy client attribution and Workers ingress remain unresolved; real route owners, budgets, D1 deployment and provider behavior are still needed. The Free minimum tier remains startup-disabled.
- Next action: Continue non-audit Phase 03 route/provider integration after the owning identity and trusted-ingress contracts are ready.

### 2026-09-26 — Root-bound approximate shedding checkpoint

- Progress: Both standard-profile roots now supply an approximate limiter to the shared sensitive-admission guard when an authoritative store is configured. Current-version HMAC digests consume process/location-scoped slots before primary writes; an allowance still consumes all active-version primary counters and then any configured CAPTCHA challenge. No product route or acceptance gate was opened.
- Verification: Focused unit rate/admission 15/15 and Turnstile 5/5, Node HTTP/configuration 27/27 and entry/deployment 3/3, local workerd HTTP 27/27 and entry/deployment 4/4, both typechecks, lint/boundaries, full build, docs build, scoped source formatting and whitespace passed. The existing `cloudflare:workers` warning remained non-fatal. No deployed provider, audit or Argon2id performance test ran.
- Decisions/blockers: Approximate denial is 429 without a fabricated retry hint; failure is 503. The provisional 1,000/60-second per-digest ceiling still needs route and deployment measurement. Trusted Workers ingress, real secrets/D1, route budgets and multi-location behavior remain open. The Free minimum tier remains startup-disabled.
- Next action: Continue non-audit Phase 03 work, then connect the guard to an owned sensitive route when identity and ingress contracts are ready.

### 2026-09-27 — Owned registration admission checkpoint

- Progress: A narrow Module 04 User registration route now consumes Phase 03's root-selected approximate and primary rate admission, canonical account and trusted-IP subjects, optional CAPTCHA and standard-profile Argon2id before atomic User/identity/credential writes on both local profiles. Module 03 and Module 04 remain In progress; no checklist or acceptance gate was closed by this partial integration.
- Verification: Focused Node/PostgreSQL and local workerd/D1 route/repository tests passed with denial and outage paths; both typechecks, lint/boundaries, migration checks, docs build and secret scan passed. [Registration evidence](evidence/03-registration-admission.md) records commands and limits. No deployed provider, audit or Argon2id performance check ran.
- Decisions/blockers: The production Workers root intentionally returns 503 for IP-required registration until trusted ingress provenance is verified. Route budgets, deployed Siteverify/egress, multi-instance behavior and login-time rehash remain open. The Free minimum tier stays disabled on its separate path.

### 2026-09-27 — Test D1 migration and registration readiness checkpoint

- Progress: Applied D1 credential migration 0010 only to the isolated `hyperbug-test-1` database. Both roots now require the rate-counter and credential schemas for read-only readiness. Module 03/04 acceptance and all dependent gates remain open.
- Verification: Wrangler 4.133.0 remote migration list/query found 0010 applied and the credential table present. Focused local PostgreSQL and workerd readiness tests passed for missing/applied credential schema and removed rate schema. A local Worker bound to remote test D1 returned liveness 200 but its D1-backed readiness timed out after ten seconds; direct Wrangler D1 queries succeeded. See [registration evidence](evidence/03-registration-admission.md). No staging/production migration, deployed Worker acceptance, audit or Argon2id performance test ran.
- Decisions/blockers: The remote Worker binding timeout remains unresolved; direct CLI success does not verify Worker D1 access. Continue independent non-audit route/runtime work with the production Workers IP boundary closed.

### 2026-09-27 — Local signed Workers ingress checkpoint

- Progress: A public gateway and private service-bound API Worker now carry a short-lived signed IP assertion into the existing registration admission path. Local workerd/D1 registration and primary counters pass; direct unsigned requests deny. Module 03/04 checklists and acceptance remain open.
- Verification: Focused ingress/admission unit 9/9, local workerd multiworker/D1 1/1, Node HTTP/entry 32/32 and workerd HTTP/entry 35/35 passed, with TypeScript/lint/boundaries/docs/secret/format checks. [Ingress evidence](evidence/03-workers-ingress.md) records the implementation and limits. No deployed zone, provider, audit or Argon2id performance check ran.
- Decisions/blockers: Cloudflare permits same-zone Worker influence over `CF-Connecting-IP`; deployed gateway-only routing and adversarial subrequest verification are required before trusting this source. The remote test D1 Worker binding still times out. Continue independent non-audit work, with the Free minimum tier disabled separately.

### 2026-09-27 — Configured CAPTCHA on signed Workers registration

- Progress: Local multiworker/D1 registration now exercises the actual root-selected optional Turnstile path through the signed gateway: no provider works without a token; complete fixture bindings require verification; missing tokens and simulated provider outages deny without account storage. Module 03/04 checklist and acceptance gates remain open.
- Verification: Focused local workerd ingress 2/2 and TypeScript/lint/boundaries/docs checks passed. [Ingress evidence](evidence/03-workers-ingress.md) distinguishes injected responses from live provider behavior. No deployed provider, audit or Argon2id performance check ran.
- Decisions/blockers: Deployed gateway provenance, remote D1 binding, real Siteverify token/egress, multi-location counters and measured route budgets remain. Independent Phase 03 work continues; Free minimum tier stays disabled.

### 2026-09-27 — Isolated deployed Workers attempt stopped at HTTP reachability

- Progress: A test-only private API Worker and public service-bound gateway uploaded with the `hyperbug-test-1` D1 and hidden secrets; the API had no public target. Gateway HTTP timed out from this host, so no deployed route or counter acceptance was obtained. Both temporary Workers were deleted, leaving test D1 migrations intact.
- Verification: Wrangler 4.133.0 dry-runs/uploads/deletions passed; three HTTPS requests timed out at 15 seconds and an in-app browser attempt timed out. Direct D1 primary query showed zero local-password identities. [Ingress evidence](evidence/03-workers-ingress.md) records the scope and cleanup. No audit or Argon2id performance check ran.
- Decisions/blockers: The HTTP connection path and the earlier local Worker/remote D1 timeout remain unresolved. Continue independent Phase 03 implementation and keep all dependent acceptance gates open.

### 2026-09-27 — Signed ingress rejection hardening

- Progress: The gateway now strips ordinary forwarded address headers and returns no-store 503 for early ingress rejection. The private API still requires a valid signed assertion and authoritative primary counters.
- Verification: Focused ingress unit 2/2 and local workerd multiworker/D1 2/2 passed with TypeScript/scoped lint. [Ingress evidence](evidence/03-workers-ingress.md) remains local for this change; deployed trust and D1 behavior are open.
- Decisions/blockers: Continue independent non-audit Phase 03 development; no checklist or acceptance gate changed.
- Next action: Continue independent non-audit 03.3e/03.3f provider/egress integration and trusted Workers ingress work, then batch deployed provider/rate acceptance at a meaningful milestone. Preserve the uncommitted tree and migrations.

### 2026-09-27 — Registration persistence response bound

- Progress: Local Node and workerd registration now return a closed 503 within five seconds when the account store stalls. Phase 03/04 checklists and acceptance remain open.
- Verification: Focused unit 8/8, Node HTTP 32/32, local workerd HTTP 34/34, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the response bound and late-commit limit.
- Decisions/blockers: An already-dispatched database write can outlive the HTTP deadline; deployed ingress/D1/provider, multi-instance behavior and login-time rehash remain open. Continue non-audit development; the Free tier stays disabled separately.
- Next action: Implement revision-safe login-time rehash on a narrow account-owned path, then run focused checks on both standard profiles. Preserve the uncommitted tree and migrations.

### 2026-09-27 — Standard credential replacement support

- Progress: PostgreSQL and D1 account stores now load active User credentials from the primary and conditionally replace a verified record at its observed revision. No login route is exposed; 03.2e and Module 04 remain open.
- Verification: Focused isolated PostgreSQL 18.6 1/1 and local workerd/D1 1/1, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the D1/node-postgres documentation lookup and limits.
- Decisions/blockers: Stale or suspended writes deny; the future login operation must handle verification races and issue credentials only under Module 04's account/session contract. Deployed D1/ingress/provider evidence remains missing. Audits and Argon2id performance testing stay stopped; Free tier stays disabled.
- Next action: Integrate verified login and rehash with root-selected admission on both standard profiles, then run focused route/storage failure checks. Preserve the uncommitted tree and migrations.

### 2026-09-27 — Internal login verification checkpoint

- Progress: A shared internal account operation now verifies standard-profile passwords, persists revision-checked rehash records and reloads active credentials before returning a revision-bound identity. Public login remains closed; 03.2e and Module 04 stay open.
- Verification: Focused unit 4/4, isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, TypeScript, lint/boundaries and formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the operation and limits.
- Decisions/blockers: A usable login credential needs Module 04 session/token issuance and race-safe binding; a boolean credential oracle was not exposed. Deployed ingress/D1/provider/multi-instance acceptance remains missing. Free tier stays disabled; audits and Argon2id performance testing remain stopped.
- Next action: Implement the narrow issuance dependency, connect the owned login route to root-selected admission and rehash, and verify both standard profiles. Preserve all uncommitted changes and migrations.

### 2026-09-27 — Registration route/failure observation checkpoint

- Progress: The existing registration route now emits privacy-minimized fixed route and rate-outage observations in both local standard profiles. This advances partial non-audit 03.3d/03.3f without extending 03.2e or completing a checklist/gate.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, unit security 6/6, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the workerd hook finding, Context7 transport failure and open deployed evidence.
- Decisions/blockers: Deployed gateway provenance, Worker/D1 binding, live provider/egress, multi-instance rate behavior and measured budgets remain open. Test D1 stays separate; audits and Argon2id performance testing remain stopped, and the Free tier stays disabled.
- Next action: Verify restored Cloudflare API connectivity and retry an isolated deployed gateway/private-API milestone, while continuing independent 03.3c–03.3f implementation if external access fails. Preserve the uncommitted tree and migrations.

### 2026-09-27 — Deployed test D1 readiness probe

- Progress: Restored Cloudflare API access allowed test-only private API and gateway uploads. A deployed health-only service-binding probe returned liveness 200 and D1-backed readiness 200; the signed ingress still failed closed on this host's preexisting `X-Real-IP`, so registration was not exercised. Both Workers and temporary secrets were removed.
- Verification: Wrangler 4.133.0 remote test D1 primary read, dry-runs/uploads/deletions, deployed health 200/200, account GET 503 and final primary local-password identity count zero. [Workers ingress evidence](evidence/03-workers-ingress.md) records limits; no D1 write, live provider, multi-instance, audit or Argon2id performance test ran.
- Decisions/blockers: Preserve strict ingress provenance and keep 03.3c–03.3f, Module 04 and all acceptance gates open. The Free tier remains disabled on its separate path.
- Next action: Continue independent local 03.3c–03.3f integration, then retry deployed signed registration from a verified ingress path without injected `X-Real-IP`; preserve the uncommitted tree and migrations.

### 2026-09-27 — Shared dual-runtime request observation checkpoint

- Progress: Shared HTTP request observations now use success/error hooks verified in Node and workerd, retaining fixed registration and rate/CAPTCHA failure labels without raw subjects. This is partial non-audit 03.3d; no gate closes.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, Node HTTP 32/32, workerd HTTP 34/34, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the hook finding and limits.
- Decisions/blockers: Deployed telemetry delivery, trusted ingress, D1 registration writes, live provider/egress and multi-instance behavior remain open. Audits/Argon2id performance testing remain stopped; Free tier remains disabled.
- Next action: Continue independent 03.3c–03.3f route/provider failure integration and obtain a trusted deployed ingress path before repeating registration acceptance.

### 2026-09-27 — Local authoritative registration denial checkpoint

- Progress: Both real standard-profile account-route fixtures now prove a primary account counter's 429, retry hint, no-store response and absent account write after active-version prefill, followed by a fail-closed 503 on counter outage. 03.3c/03.3d and 03.V3 remain open.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the request and observation outcomes; no deployed write, multi-instance, provider, audit or Argon2id performance result is claimed.
- Decisions/blockers: Primary counters stay authoritative; deployed ingress provenance and measured route budgets remain open. Free tier stays disabled separately.
- Next action: Exercise the configured provider failure path on the real Node/PostgreSQL route, then continue deployed signed route work once ingress provenance can be verified.

### 2026-09-27 — Configured provider account-route checkpoint

- Progress: Complete optional Turnstile configuration on the real Node/PostgreSQL registration route now has a focused missing-token 403 and private-DNS provider 503 check before persistence. The signed local workerd/D1 fixture still covers configured provider success/outage. Partial 03.3e/03.3f only; no checklist or acceptance gate closes.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 ingress 2/2, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) distinguishes injected/private-DNS behavior from live provider egress.
- Decisions/blockers: Trusted deployed ingress, D1 registration writes, real Siteverify and multi-instance budgets remain open. Free tier stays disabled; audits and Argon2id performance testing stay stopped.
- Next action: Verify test-only deployed D1 registration and provider egress through a guarded synthetic ingress, keeping real client-provenance acceptance open; preserve the uncommitted tree and migrations.

### 2026-09-27 — Synthetic deployed D1 write and dummy Siteverify checkpoint

- Progress: A capability-guarded synthetic gateway with a fixed test IP reached the private Worker account route. One no-provider registration returned 202 and primary D1 read found a User/Argon2id credential and account/IP counters. Published dummy Turnstile bindings then denied missing, semantically incomplete and always-fail tokens without another User write. Both temporary Workers/secrets and the exact test User/credential were removed; abuse counters remain in `hyperbug-test-1`.
- Verification: Wrangler 4.133.0 dry-runs/uploads/deletions, primary D1 queries, deployed 202/403/503 route outcomes, and a live Siteverify dummy diagnostic 200. Final primary D1 read found zero local-password identities, credentials and Users after exact test-row cleanup. Documentation build and scoped diff whitespace passed. [Workers ingress evidence](evidence/03-workers-ingress.md) distinguishes the synthetic address and dummy keys from real signed ingress and valid challenge acceptance. No audit, Argon2id performance or multi-instance check ran.
- Decisions/blockers: Trusted ingress, configured successful challenge, measured budgets and multi-instance consistency remain open. Keep 03.3c–03.3f, Module 04 and all dependent gates open; Free tier stays disabled separately.
- Next action: Implement and verify a pre-parse approximate IP shed for malformed registration requests on Node and workerd while preserving the full primary gate. Then verify signed deployed registration from a provenance-safe client and a real `register` action token when available. Preserve migrations and all uncommitted changes.

### 2026-09-27 — Pre-parse registration shed checkpoint

- Progress: The real registration POST now consumes a distinct trusted-IP approximate bucket before parsing on both standard profiles. Two malformed requests returned 400 and the third was shed 429 in focused two-slot runtime fixtures, without a primary counter write; valid registration still used all-version authoritative account/IP counters. This is partial non-audit 03.3c/03.3d and narrow Module 04 support; no checklist or gate closes.
- Verification: Isolated PostgreSQL route 1/1, local workerd/D1 route 2/2, focused unit 17/17, Node HTTP 32/32, workerd HTTP 34/34, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the failure paths and limits. No deployed or multi-instance check ran for this increment.
- Decisions/blockers: Missing key, trusted address or approximate limiter denies 503; the early bucket does not replace primary counters. Genuine signed ingress, a valid configured Turnstile token, provider egress, measured budgets and multi-instance evidence remain open. Test D1 stays separate; audits and Argon2id performance testing stay stopped, and the Free tier stays disabled.
- Next action: Continue independent 03.3e/03.3f provider/runtime failure-path integration, then batch deployed signed-ingress, valid-provider and multi-instance evidence when prerequisites are available. Preserve all uncommitted changes and migrations.

### 2026-09-27 — Configured Node provider route checkpoint

- Progress: The real Node/PostgreSQL registration route now proves a valid injected Siteverify response reaches one User/Argon2id credential, while wrong action, malformed provider data, outage and primary 429 deny before further storage. Signed local workerd/D1 configured-provider success/outage still passes. This is partial 03.3e/03.3f and narrow Module 04 support; no checklist or gate closes.
- Verification: Isolated PostgreSQL route 1/1, local signed workerd/D1 ingress 2/2, focused unit 15/15, TypeScript, lint/boundaries and scoped formatting passed. A one-off Node direct provider call failed closed before TLS on special-use DNS answers; [registration evidence](evidence/03-registration-admission.md) records the limits and Context7 lookup. No valid live token or deployed provider success is claimed.
- Decisions/blockers: Keep the Node public-address egress guard intact. Genuine signed ingress, valid configured challenge, live Node TLS, budgets and multi-instance consistency remain open; Free tier stays disabled, audits suspended and Argon2id performance testing stopped.
- Next action: Exercise pre-parse shedding through the signed local Workers gateway, then collect deployed ingress/provider evidence only from a provenance-safe path. Preserve uncommitted changes, migrations and isolated test D1.

### 2026-09-27 — Signed local Workers pre-parse checkpoint

- Progress: The production-root signed gateway/private-API fixture now proves unsigned malformed registration closes 503, two signed malformed requests return 400, and the third is shed 429 without a primary counter write. A valid request from another trusted address still reaches D1 User persistence and primary counters. This is partial non-audit 03.3c/03.3d with narrow Module 04 support; no checklist or gate closes.
- Verification: Local signed workerd/D1 ingress 2/2, isolated PostgreSQL account route 1/1, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records the exact local scope; no deployed or multi-location run occurred.
- Decisions/blockers: Real signed edge provenance, valid configured Turnstile challenge, Node direct TLS, measured budgets and multi-instance consistency remain open. Preserve test D1 isolation, all uncommitted changes/migrations, audit suspension, stopped Argon2id performance testing and disabled Free tier.
- Next action: Verify primary counter denial across two separately composed Node and Workers roots sharing PostgreSQL/D1 while approximate limiters remain separate. Then seek a provenance-safe deployed signed ingress and live valid-action provider token for acceptance.

### 2026-09-27 — Separate local primary-counter roots checkpoint

- Progress: Separately composed Node roots with distinct process limiters and workerd roots with distinct approximate namespaces denied registration from shared PostgreSQL/D1 primary account counters. This advances partial 03.3c/03.3d/03.V3 and narrow Module 04 route evidence without closing any item or gate.
- Verification: Isolated PostgreSQL route 1/1, local workerd/D1 route 3/3, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) distinguishes local roots from deployed instances and records the corrected Miniflare type mismatch.
- Decisions/blockers: Deployed multi-instance/location consistency, genuine signed ingress, valid configured Turnstile challenge, Node direct TLS and measured budgets remain open. Preserve isolated test D1, all uncommitted changes/migrations, audit suspension, stopped Argon2id performance testing and disabled Free tier.
- Next action: Batch a test-only deployed two-Worker primary-counter check on `hyperbug-test-1` while keeping synthetic address evidence separate from trusted provenance; continue independent 03.3e/03.3f development if the external path fails.

### 2026-09-27 — Deployed sequential two-Worker primary checkpoint

- Progress: Two private test-only Workers with independent approximate binding configurations shared `hyperbug-test-1`. Synthetic fixed-IP gateway A registered 202; after exact primary counter prefill, gateway B denied 429 with retry hint and no second User. This is partial 03.3c/03.3d/03.V3 and narrow Module 04 evidence; no checklist or gate closes.
- Verification: Wrangler 4.141.0 four dry-runs/uploads/deletions, deployed 202/429 and primary D1 queries/updates passed. Final independent primary read found zero local-password identities, credentials, Users and fresh-version counters. [Workers ingress evidence](evidence/03-workers-ingress.md) records the synthetic/manual limits and cleanup. No concurrent/cross-location, trusted ingress or valid provider check ran.
- Decisions/blockers: Genuine signed client provenance, valid `register` token, live Node TLS, measured budgets and concurrent/multi-location primary behavior remain open. The isolated test D1 retains migrations and older counters only; staging/production untouched. Audits/Argon2id performance testing stay stopped and Free tier stays disabled.
- Next action: Pursue a provenance-safe deployed signed gateway and real configured challenge when available; continue independently actionable 03.3e/03.3f behavior without waiting for those external prerequisites. Preserve all uncommitted changes and migrations.

### 2026-09-27 — Deployed concurrent two-Worker primary checkpoint

- Progress: Two private test-only API Workers with distinct approximate namespaces raced synthetic fixed-IP registrations after exact primary D1 account-counter prefill to four. Responses were 202 and no-store 429; the primary count reached six and one User existed. This is partial 03.3c/03.3d/03.V3 and narrow Module 04 evidence; no checklist or gate closes.
- Verification: Wrangler 4.141.0 deployments/deletions and four Worker-not-found checks passed. A final independent primary D1 read found zero local-password identities, credentials, Users and fresh-version counters. Automated cleanup stopped after credential deletion; exact manual primary deletes finished the remaining rows. [Workers ingress evidence](evidence/03-workers-ingress.md) records the one-host synthetic-IP limit.
- Decisions/blockers: Genuine edge provenance, valid `register` challenge, Node direct TLS, cross-location/outage behavior, measured budgets and standard staging/production configuration remain open. Test D1 migrations and older counters remain; staging and production were untouched. Audits/Argon2id performance work stay stopped and Free tier disabled.
- Next action: Close the next independently actionable 03.3 route/runtime failure path on Node/PostgreSQL and workerd/D1; batch external verification at the next meaningful milestone. Preserve all uncommitted changes and migrations.

### 2026-09-27 — Unsafe configured-provider response checkpoint

- Progress: Redirected and oversized Siteverify responses now have focused 03.3e/03.3f route evidence on Node/PostgreSQL and signed local workerd/D1: both deny 503 before another User write. A valid fixture still registers, and primary 429 still prevents provider work. This is narrow Module 04 support; no checklist or gate closes.
- Verification: Isolated PostgreSQL route 1/1, local workerd/D1 ingress 2/2, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) distinguishes injected transport/service responses from live Node TLS or deployed Siteverify egress. No production code or migration changed.
- Decisions/blockers: Trusted ingress, valid live `register` token, direct Node TLS, cross-location/outage consistency and measured budgets remain open. Preserve all uncommitted work/migrations; audits and Argon2id performance work stay stopped, Free tier disabled.
- Next action: Exercise configured-provider timeout and concurrent egress saturation through the two standard-profile account routes, then batch external checks at a meaningful integration milestone.

### 2026-09-27 — Configured-provider deadline checkpoint

- Progress: The real Node/PostgreSQL and signed local workerd/D1 registration routes return no-store `CAPTCHA_UNAVAILABLE` 503 within the CAPTCHA budget for injected Siteverify calls delayed beyond the central three-second outbound deadline, without another User write. Partial 03.3e/03.3f/03.V2 and narrow Module 04 evidence only; no gate closes.
- Verification: Isolated PostgreSQL route 1/1, local workerd/D1 ingress 2/2 and TypeScript passed. [Registration evidence](evidence/03-registration-admission.md) records the injected-transport limit; no live timeout or deployed check ran for this increment. No production code or migration changed.
- Decisions/blockers: Trusted ingress, valid live challenge, Node direct TLS, cross-location/outage behavior and measured budgets remain open. Preserve migrations/uncommitted work; audits and Argon2id performance testing stay stopped, Free tier disabled.
- Next action: Exercise concurrent configured-provider egress saturation through both account routes, then continue independently actionable 03.3 route work.

### 2026-09-27 — Approximate limiter outage on the real registration route

- Progress: The Node/PostgreSQL account route denies 503 from an unavailable root-selected limiter; the signed local workerd/D1 production root denies 503 with its Rate Limiting binding absent. Neither path writes a primary counter or User. This is partial 03.3c/03.3d/03.V3 and narrow Module 04 evidence; no gate closes.
- Verification: Isolated PostgreSQL route 1/1, signed local workerd/D1 ingress 3/3, TypeScript, lint/boundaries and scoped formatting passed. [Registration evidence](evidence/03-registration-admission.md) records unchanged primary hits and zero D1 account rows. No deployed outage check ran; no production code or migration changed.
- Decisions/blockers: Approximate failure stays closed and primary allowance remains authoritative. Genuine ingress, valid live challenge, Node direct TLS, cross-location/outage behavior and measured budgets remain open. Preserve uncommitted work/migrations, audit suspension, stopped Argon2id performance testing and disabled Free tier.
- Next action: Build a real login admission consumer with only the necessary Module 04 session/token dependency on both standard profiles, keeping 03.2e and all Module 04 acceptance open pending full evidence.

### 2026-09-28 — Standard-profile login admission checkpoint

- Progress: Both real account roots now route login through trusted root-selected approximate and primary account/IP admission, optional configured CAPTCHA, password verification and revision-bound first-party sessions. Primary-backed session read and logout work locally; Phase 03 03.3c–03.3f and Module 04 remain partial, with all acceptance gates open.
- Verification: Isolated PostgreSQL account route 1/1, signed local workerd/D1 ingress 5/5, TypeScript, lint/boundaries, Drizzle history, scoped formatting and docs build passed. [Login evidence](evidence/03-login-admission.md) records success and security failures, the PostgreSQL bigint fix and Miniflare fixture limit. Credential-store progress had already been logged separately.
- Decisions/blockers: No deployed session migration, genuine edge provenance, valid live Turnstile action, Node direct TLS, measured budgets or cross-location consistency is claimed. Registration's dispatched write can finish after its five-second 503. Audits/Argon2id performance work remain stopped; Free tier stays disabled.
- Next action: Verify concurrent configured Siteverify egress saturation through both real account routes, then continue independent 03.3 runtime integration and batch external evidence at the next meaningful milestone. Preserve all uncommitted changes, migrations and test D1 isolation.

### 2026-09-28 — Local configured-provider saturation checkpoint

- Progress: Both standard-profile registration roots deny a ninth concurrent Siteverify call 503 before a User write while authoritative account/IP counters still record the attempt; capacity recovers after the eight held calls resolve. Partial 03.3e/03.3f/03.V2 and narrow Module 04 support only; gates remain open.
- Verification: Isolated PostgreSQL route 1/1, signed local workerd/D1 ingress 6/6, TypeScript and scoped lint/formatting passed. [Registration evidence](evidence/03-registration-admission.md) records local injected-provider scope; no live or deployed acceptance is claimed.
- Decisions/blockers: Genuine ingress, live valid Turnstile action, Node direct TLS, measured budgets and cross-location/outage behavior remain open. Audits/Argon2id performance work stay stopped; Free tier disabled.
- Next action: Wire route-specific trusted-IP approximate shedding before session-read and logout storage work on both standard profiles, then continue independent non-audit 03.3 development. Preserve uncommitted work, migrations and test D1 isolation.

### 2026-09-28 — Session and logout route shedding checkpoint

- Progress: Both standard-profile roots now bound session read and logout with separate trusted-IP approximate buckets before primary session storage. Missing limiter denies no-store 503 and bucket exhaustion denies no-store 429; password login/registration primary counters remain authoritative. Partial 03.3c/03.3d/03.3f and narrow Module 04 support; gates stay open.
- Verification: Isolated PostgreSQL account route 1/1 and signed local workerd/D1 ingress 7/7, TypeScript, lint/boundaries, scoped formatting and diff whitespace passed. [Login evidence](evidence/03-login-admission.md) records storage-call/row checks and local limits. Fixture-only nonfatal listener and bundle warnings remain.
- Decisions/blockers: No deployed trusted ingress, live valid challenge, Node direct TLS, measured budgets or cross-location/outage acceptance is claimed. Audits and Argon2id performance work stay stopped; Free tier remains disabled.
- Next action: Continue independent non-audit 03.3c–03.3f route/runtime integration after inspecting the next concrete gap; batch external checks at a meaningful milestone. Preserve uncommitted changes, migrations and test D1 isolation.

### 2026-09-28 — Test D1 session schema checkpoint

- Progress: Only `0011_authorization_sessions.sql` was pending and then applied on exact test-only `hyperbug-test-1` UUID; primary reads found latest history and zero sessions. Partial Phase 03/Module 04 deployment prerequisite only; gates stay open.
- Verification: Wrangler 4.141.0 remote list/apply/list and primary D1 reads passed; [login evidence](evidence/03-login-admission.md) records the scope. Staging/production were untouched and no deployed HTTP session result is claimed.
- Decisions/blockers: Genuine ingress, live valid Turnstile, Node direct TLS, measured budgets and full account acceptance remain open. Audits/Argon2id performance testing stay stopped; Free tier disabled.
- Next action: Test deployed login/session/logout through a temporary capability-guarded synthetic-address gateway, then delete exact Workers/rows; continue independent Phase 03 work if external execution fails. Preserve migrations and uncommitted tree.

### 2026-09-28 — Test-only deployed session checkpoint

- Progress: Two temporary private Workers sharing `hyperbug-test-1` observed registration/login on A, primary-backed session read/logout on B and revoked reuse denial on A. This is partial Phase 03 03.3c/03.3d/03.3f/03.V3 and narrow Module 04 support; no checklist or gate closes.
- Verification: Wrangler 4.141.0 four dry-runs/uploads/deletions, deployed 202/403/200/200/204/401 route outcomes, primary D1 session/counter reads and four independent Worker-not-found checks passed. Final primary reads found zero test accounts/sessions/current token keys/fresh counters; two permanent test key tombstones remain removed. [Login evidence](evidence/03-login-admission.md) records the stopped first attempt and exact cleanup.
- Decisions/blockers: The gateways used fixed synthetic IP and test auth origin, so genuine edge/browser provenance, live valid Turnstile, Node direct TLS, cross-location/outage consistency and budgets remain open. Staging/production untouched; audits/Argon2id performance work stopped, Free tier disabled.
- Next action: Continue independent non-audit Phase 03 development and pursue provenance-safe external acceptance only when its prerequisites exist. Preserve all uncommitted changes, migrations and isolated test D1.

### 2026-09-28 — Local session-token failure checkpoint

- Progress: The Node/PostgreSQL and signed local workerd/D1 session routes deny a tampered issued cookie with no-store 401 without revoking the valid session; missing or malformed token-key material denies with no-store 503. Partial 03.3f/03.V2 and narrow Module 04 support only; checklists and gates stay open.
- Verification: Focused PostgreSQL route 1/1, workerd ingress 7/7, TypeScript, lint/boundaries, scoped formatting and diff whitespace passed. [Login evidence](evidence/03-login-admission.md) records the tests and their local limits.
- Decisions/blockers: Deployed key outage, genuine edge/browser provenance, live valid Turnstile, Node direct TLS, cross-location behavior and measured budgets remain open. Audits and Argon2id performance testing stay stopped; Free tier disabled.
- Next action: Integrate token-key availability into standard-profile runtime readiness as the next independent 03.3f gap, with focused success/failure checks on both profiles. Preserve all uncommitted work, migrations and isolated test D1.

### 2026-09-28 — Token-key runtime-readiness checkpoint

- Progress: Both production roots now mark `/health/ready` unavailable when the current token-HMAC key cannot be loaded. Node reuses the same provider for readiness and account routes; workerd checks its D1-backed provider. Partial 03.3f and narrow Module 04 support only; checklists and gates remain open.
- Verification: Isolated PostgreSQL route 1/1, Node admission unit 3/3, workerd production entry 2/2 and signed ingress 7/7 passed, as did TypeScript, lint/boundaries, source formatting, diff whitespace and docs build. [Login evidence](evidence/03-login-admission.md) records the local failure/recovery cases and limits.
- Decisions/blockers: Readiness proves neither deployed key availability nor trusted ingress, live valid Turnstile, Node direct TLS, cross-location consistency, write permission or measured budgets. Audits/Argon2id performance stopped; Free tier disabled.
- Next action: Inspect current-route 03.3c–03.3f gaps and implement the next independent behavior increment if one remains; batch external checks at a meaningful milestone. Preserve uncommitted tree, migrations and test D1 isolation.

### 2026-09-28 — Node direct-egress recheck

- Progress: A read-only exact public GET through the pinned Node HTTPS adapter still denied `UNAVAILABLE`; the host resolver returned benchmark-range addresses. No production code changed and 03.3e/03.V2 remain open.
- Verification: Focused adapter invocation and system DNS lookup; no direct TLS handshake, provider credential or live Siteverify call. [Login evidence](evidence/03-login-admission.md) records the limit.
- Decisions/blockers: Preserve the nonpublic-address denial. Verify direct TLS in an actual Node deployment environment; Cloudflare API connectivity alone does not resolve this egress gap. Audits/Argon2id performance remain stopped and Free tier disabled.
- Next action: Continue 03.3c–03.3f where a real consumer remains; keep external/provider acceptance separate and preserve all uncommitted work and migrations.

### 2026-09-28 — Logout token-key failure checkpoint

- Progress: Both standard-profile logout routes return no-store 503 without clearing or revoking the valid session when token-key verification is unavailable. This is partial 03.3f/03.V2 and narrow Module 04 evidence; checklists and gates stay open.
- Verification: Focused PostgreSQL route 1/1 and signed workerd ingress 7/7 passed. An initial Node fixture returned 403 before key verification because its origin was absent from the allowlist; correction and rerun passed. TypeScript, scoped lint and formatting passed. [Login evidence](evidence/03-login-admission.md) records the local scope.
- Decisions/blockers: Deployed key outage, genuine ingress, live valid Turnstile, direct Node TLS and measured budgets remain open. Keep audits/Argon2id performance stopped and Free tier disabled.
- Next action: Continue Phase 03 from the existing route inventory; remaining 03.3c–03.3f consumers for recovery, privileged/project/token activity and plugin permissions require their owning routes, while deployed acceptance remains open. Preserve all uncommitted work, migrations and test D1 isolation.

### 2026-09-28 — Primary login-counter outage checkpoint

- Progress: Both real standard-profile login routes deny no-store 503 when the authoritative counter fails after approximate allowance; no session is issued. The Node fixture records zero password reads. Partial 03.3c/03.3d/03.V3 and narrow Module 04 evidence only; gates remain open.
- Verification: Isolated PostgreSQL route 1/1, signed workerd ingress 7/7, TypeScript, scoped lint and formatting passed. [Login evidence](evidence/03-login-admission.md) distinguishes local injected/isolated failure from deployed outage.
- Decisions/blockers: Primary counters stay authoritative. Genuine ingress, live valid Turnstile, direct Node TLS, deployed outage/cross-location behavior and budgets remain open; audits/Argon2id performance stopped, Free tier disabled.
- Next action: Check the remaining locally actionable authorization/session-store failure path on both routes, then batch external acceptance at a meaningful milestone. Preserve uncommitted changes, migrations and test D1 isolation.

### 2026-09-28 — Session-store outage checkpoint

- Progress: Valid-cookie session read returns no-store 503 when primary session storage is unavailable on both standard profiles. Logout also denies without a clearing cookie on both profiles; the Node healthy root still reads the original session. This is partial 03.3f/03.V2 and narrow Module 04 evidence; no checklist or gate closes.
- Verification: Focused PostgreSQL route 1/1 and signed workerd ingress 7/7 passed, with TypeScript, scoped lint and formatting. [Login evidence](evidence/03-login-admission.md) records the isolated local failure scope.
- Decisions/blockers: Deployed storage outage, genuine ingress, live valid Turnstile, direct Node TLS, cross-location behavior and measured budgets remain open; audit and Argon2id performance work stopped, Free tier disabled.
- Next action: Reassess the full non-audit Phase 03 checklist for another independent runtime task; keep Module 04 scope bounded and preserve all uncommitted work, migrations and test D1 isolation.

### 2026-09-28 — Bounded rate-counter cleanup checkpoint

- Progress: Node/PostgreSQL and Workers/D1 roots now schedule one non-overlapping or single-invocation 1,000-row expired-counter purge every five minutes. This is partial 03.3c/03.3d and narrow 09.3d support; 03, 04 and 09 checklists and G1/G2 stay open.
- Verification: Node scheduler 2/2, isolated PostgreSQL account route 1/1, workerd entry/signed ingress 9/9, TypeScript, scoped lint/boundaries and staging Wrangler dry run passed. The dry run warned that staging lacks a D1 binding; no deployed Cron or physical-retention claim is made. [Rate evidence](evidence/03-rate-limits-validation.md) records scope and remaining limits.
- Decisions/blockers: Full Module 09 retention, genuine ingress, live valid Turnstile, Node direct TLS, cross-location/outage behavior and measured budgets remain open. Audits/Argon2id performance work stay stopped; Free tier disabled.
- Next action: Continue the next locally actionable 03.3c–03.3f route/runtime consumer without expanding Module 04 beyond its Phase 03 dependency. Preserve uncommitted changes, migrations and test D1 isolation.

### 2026-09-28 — Test-only deployed counter-cleanup checkpoint

- Progress: A temporary private Worker using the production scheduled handler and a one-minute test trigger purged one expired counter in isolated `hyperbug-test-1` while preserving a fresh row. The Worker and both test rows were removed. This advances partial 03.3d/03.V3 and narrow 09.3d only; no checklist or gate closes.
- Verification: Wrangler 4.141.0 deployment/tail `ok`, primary D1 before/after/final reads and Worker-not-found 10007 passed. [Rate evidence](evidence/03-rate-limits-validation.md) records exact scope. Tracked five-minute staging/production Cron, sustained retention and other location/provider behavior remain unverified.
- Decisions/blockers: Registration/login already consume the available rate/CAPTCHA/outbound/fail-closed services; additional recovery, token, project and plugin categories need their owning routes. Genuine ingress, live valid Turnstile, direct Node TLS and measured budgets remain open. Audits/Argon2id performance work stopped; Free tier disabled.
- Next action: Advance the next independently actionable 03.3c–03.3f route/runtime dependency when available, or verify a current-route security failure not yet covered; keep Module 04 narrow and preserve the uncommitted worktree and test D1 isolation.

### 2026-09-28 — Login session-write failure checkpoint

- Progress: Node/PostgreSQL and signed workerd/D1 login routes deny no-store 503 without a cookie when primary session creation fails after a valid password. Local session rows do not increase. This adds partial 03.3f/03.V2 and narrow Module 04 evidence; checklists and gates remain open.
- Verification: Focused PostgreSQL route 1/1, workerd ingress 7/7, TypeScript, scoped lint/boundaries and formatting passed. [Login evidence](evidence/03-login-admission.md) records the local scope and late-write limit.
- Decisions/blockers: Deployed write outage, genuine ingress, live valid Turnstile, Node direct TLS, cross-location behavior and measured budgets remain open. Audits/Argon2id performance testing stopped; Free tier disabled.
- Next action: Continue current-route 03.3 failure-path inventory, then the next actual 03.3 category consumer with its owning route; preserve all uncommitted changes and test D1 isolation.

### 2026-09-28 — Previous-key login limit checkpoint

- Progress: Both real standard-profile login routes deny 429 from a saturated previous active abuse-key account counter even when the current-version approximate bucket allows. Primary rows show both versions consumed. Partial 03.3c/03.3d/03.V3 and narrow Module 04 only; no checklist or gate closes.
- Verification: Focused PostgreSQL route 1/1, signed workerd ingress 7/7, TypeScript, scoped lint/boundaries and formatting passed. [Login evidence](evidence/03-login-admission.md) records the local scope; deployed key rollover remains unverified.
- Decisions/blockers: Primary counters remain authoritative through key overlap. Genuine ingress, live valid Turnstile, Node direct TLS, deployed rotation/cross-location behavior and measured budgets remain open. Audits/Argon2id performance testing stopped; Free tier disabled.
- Next action: Continue the remaining independent 03.3 consumer and acceptance work while keeping Module 04 limited to its Phase 03 dependency. Preserve the uncommitted tree, migrations and test D1 isolation.

### 2026-09-28 — Worktree consolidation and feature hold

- Scope and checklist IDs: Repository-wide stabilization of existing Phase 03 work and its narrow Module 04/09 dependencies; no checklist or gate closure.
- Progress: Inventoried the large uncommitted tree, committed existing behavior and documentation in dependency slices, and retained the user-directed hold on new features, audits, Argon2id performance work, Free-tier activation, and SPA development.
- Change summary: Fixed three stale test expectations, aligned bilingual security guidance with implemented local account routes, and documented migration and sensitive-file state. No migration was rewritten or applied during consolidation.
- Files/artifacts: Shared/security/data/server and Node/Workers commits, affected module plans and progress records, and the [consolidation record](evidence/2026-09-28-worktree-consolidation.md).
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and full local 301-test suite passed. A fresh export of committed source passed frozen offline install, typecheck, and all 301 tests on retry; the first cold run had one Wrangler dry-run/Wasm timeout. Read-only Wrangler checks confirmed test D1 0000–0011 and local D1 0000–0008 with 0009–0011 pending. The linked record details limits and warnings.
- Decisions and deviations: Keep G1/G2 closed and all partial checklist items open. No production or staging operation, audit implementation, Argon2id benchmark, Free-tier enablement, Module 04/09 expansion, or SPA work occurred.
- Blockers/open questions: Persistent PostgreSQL migration state was unavailable without a configured URL; deployed ingress, live challenge, Node TLS, consistency, and measured budgets remain open acceptance evidence.
- Next actions: Hold feature work until a later user instruction; then inspect current state and resume only the authorized checklist scope. Inspect exact migration target state before any future apply.
- Next-session cautions: Preserve immutable applied D1 histories and ignored local/audit snapshots. Test-only D1 is at 0011; local D1 still has three pending files. Do not infer deployed acceptance from local tests.

### 2026-09-29 — Module 03 closure-first session

- Progress: Every unchecked Module 03 item was classified (locally closable, externally blocked, suspended, Free-tier path) with exact unblock requirements in the new [closure matrix](evidence/03-closure-matrix.md); 03.2e was accepted after real-provider login-time rehash verification on both standard profiles. No gate changed; G1/G2 remain closed.
- Verification: Node 24.21.0 full matrix — both typechecks, lint/boundaries, both Drizzle histories, 303 tests (unit/contract 99, node 50, workerd 104, isolated PostgreSQL 18.6 50), build, secret scan, docs build, whole-tree format check and diff check passed. See the [module 03 handoff](progress/03-security-foundation.md).
- Decisions/blockers: Remaining Module 03 items are externally blocked, suspended or on the disabled Free-tier path; the G1 governance conflict between suspended audit items and modules 00–09 completeness is recorded with its smallest actionable resolution and awaits an explicit user instruction.
- Next action: Obtain the G1 governance decision; batch external acceptance evidence at the next deployment milestone.

### 2026-09-29 — Module 03 audit resume and 03.3a acceptance

- Progress: An explicit user instruction resumed Module 03 audit work (03.3a in full; audit portions of 03.3d/03.3g/03.V4/03.V6/03.V7) with a Free-tier Wrangler environment and the test-only `hyperbug-test-1` D1. The parked 2026-09-21 audit snapshot was restored by reviewed re-integration, its two recorded follow-ups fixed, and 03.3a accepted with local unit/contract/runtime suites plus test-only deployed verification on `hyperbug-test-1`.
- Verification: unit 4/4 audit corpus; unit+contract 103/103; node 50/50; workerd 111/111 including the 4000-event indexed D1 traversal; isolated PostgreSQL 18.6 repository 55/55; both typechecks, lint/boundaries, formatting and diff checks; deployed authorized/forbidden/unavailable/tamper phases with the temporary Worker deleted afterwards. See the [module 03 handoff](progress/03-security-foundation.md) and [audit validation](evidence/03-audit-validation.md).
- Decisions/blockers: Later-module audit portions remain suspended; Argon2id performance testing remains stopped; the Free minimum tier stays disabled. Five permanent audit test rows remain in `hyperbug-test-1` by design.
- Next action: Assess 03.V4 closure against the resumed evidence, then the remaining resumed audit portions; keep the G1 governance record in the [closure matrix](evidence/03-closure-matrix.md) current.

### 2026-09-29 — 03.V4 acceptance and audited provider-outage policy

- Progress: 03.V4 was accepted on consolidated seeded-secret/unauthorized-access evidence, and the resumed audit portion of 03.3d was implemented: a `provider.outage` audit event under the `core.admission` system actor is appended when a configured CAPTCHA provider fails, with the denial standing regardless of the audit outcome, on both standard profiles.
- Verification: unit 105/105, node 50/50, workerd 111/111, isolated PostgreSQL 18.6 56/56 with route-level audit-row assertions; both typechecks, lint/boundaries, docs build, formatting and diff checks. See the [module 03 handoff](progress/03-security-foundation.md) and [audit validation](evidence/03-audit-validation.md).
- Decisions/blockers: Module 03's remaining audit portions (03.3g, 03.V6, 03.V7) require enabling or further implementing the minimum tier, which stays disabled under standing instructions; the module is no longer blocked by audit work per se.
- Next action: Module 03 completion now rests on the external-environment items, the disabled minimum-tier path and the G1 governance decision recorded in the [closure matrix](evidence/03-closure-matrix.md).

### 2026-09-29 — Measured minimum-tier policy closes 03.2g and 03.V7

- Progress: A real Free-plan PBKDF2 feasibility measurement (100,000 iterations per invocation succeed deterministically, 100,500 fail, linear in total CPU) fixed the minimum tier's credential policy — current 50,000, stored maximum 100,000, adapter-enforced ceiling — and the reviewed 600,000-iteration floor is unmet, so the executable floor rule disables tier password login. 03.2g and 03.V7 are accepted; the tier still refuses startup pending its remaining mechanisms and 13.G6.
- Verification: unit+contract 107/107, node 50/50, workerd 111/111, isolated PostgreSQL 18.6 56/56, both typechecks, lint/boundaries, docs build, formatting and diff checks. See the [tier evidence](evidence/03-deployment-tier-validation.md) and [measurement artifact](evidence/03-free-pbkdf2-measurement.json).
- Decisions/blockers: The floor was not lowered to fit the plan; password-login disablement is the specification's designed outcome. Module 03's remaining items: 03.3c–03.3f and 03.V2/03.V3 (external), 03.3h, 03.3g's audited enablement/startup warning, 03.V6.
- Next action: Inventory and implement 03.3h's compensating abuse controls, then 03.3g/03.V6.

### 2026-09-30 — Module 03 reduced to external evidence

- Progress: 03.V6 closed on the clause-by-clause tier-gate mapping (including the deployed 10021 upload refusal), completing every Module 03 item actionable locally or through the authorized test deployments. The measured tier path also landed: 03.2g/03.3g/03.3h/03.V7 with real Free-plan measurement, chosen lockout parameters, digest-only administrator alerting and the declared limit-consistency model.
- Verification: Full matrix across the closing batches — unit+contract 111/111, node 50/50, workerd 112/112, isolated PostgreSQL 18.6 56/56, both typechecks, lint/boundaries, docs builds, formatting and diff checks; deployed test-only evidence on `hyperbug-test-1` and the free account with exact cleanup. See the [module 03 handoff](progress/03-security-foundation.md).
- Decisions/blockers: Module 03 remains In progress solely on external prerequisites recorded per item in the [closure matrix](evidence/03-closure-matrix.md); the G1 audit conflict is now confined to later modules' suspended audit portions.
- Next action: When external environments exist, execute the closure-matrix procedures; separately, the later-module audit portions still need an explicit resume or a recorded deferral decision.
