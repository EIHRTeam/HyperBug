# 04 progress — Authentication, identity, and project authorization

Plan: [Detailed checklist](../modules/04-identity-and-access.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress (full module scope, released from the 2026-09-28 hold by the 2026-09-30 user instruction)
- Delivery scope: MVP backend
- Prerequisites: 03 complete (2026-09-30 compliant completion with the recorded re-scope; the recovery/token/privileged category routes deferred from 03.3c/03.3d are owned here).
- Implementation started: Narrow registration/login/session work exists as the Phase 03 dependency starting point; the full 04.1 ordered work begins now and must finish rather than rewrite that foundation.
- Completed implementation checklist IDs: 04.1a, 04.1b.
- Active/next checklist group: 04.1c (public-account mechanism + initial-administrator enrollment), then 04.1d–04.1e, 04.2a–04.2g, 04.3a–04.3d and acceptance 04.V1–04.V6 (non-suspended portions). The Better Auth candidate is recorded as not accepted (04.1b evidence); the Core-owned implementation proceeds. Standard-profile password login is approved under [ADR 0009](../../decisions/0009-standard-password-login.md); the optional Free tier stays startup-disabled on its separate path. Audit portions of 04.3a/04.3c/04.V5 remain suspended and unchecked.
- Last updated: 2026-09-30 (04.1a/04.1b accepted).
- Blocking issues discovered: None structural. The existing registration/login/session routes are proven locally and on the authorized test deployments (genuine ingress, live challenge, cross-location consistency closed in module 03's evidence); the authorization-service flows, recovery, Staff enrollment and project authorization remain to be built in this module.
- Evidence: [Registration admission](../evidence/03-registration-admission.md), [login/session admission](../evidence/03-login-admission.md) and [signed ingress](../evidence/03-workers-ingress.md) cover the existing narrow dependency; no Module 04 acceptance claim.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 04.1 | Prove the authentication implementation | In progress (04.1a next) | Narrow 04.1c/04.1d registration/login dependency exists ([registration](../evidence/03-registration-admission.md), [login](../evidence/03-login-admission.md)); full items open |
| 04.2 | Implement cross-site authorization | In progress (narrow 04.2c dependency only) | [Login admission](../evidence/03-login-admission.md); authorization-service flows not started |
| 04.3 | Implement identity and permission management | Not started | None yet |

The linked module plan owns the detailed checkboxes. Update this table as work proceeds and link test reports/decisions rather than duplicating the whole checklist.

## Next actions

1. Write `docs/AUTH-FLOWS.md` (04.1a), then run the Better Auth candidate PoC with current documentation on both profiles (04.1b).
2. Continue 04.1c–04.1e and 04.2a–04.2g in small reviewable batches, finishing the existing registration/login/session foundation rather than rewriting it.
3. Implement 04.3a–04.3d non-audit portions; keep audit portions suspended and unchecked.

## Next-session cautions

Keep User and Staff identities separate. Email equality must never grant Staff privileges; the official SPA must not persist access or refresh tokens.

Do not infer completed implementation from this initialized record. Inspect the current repository and prior session entries before continuing.

## Session log

Every session affecting this module MUST append an entry following the [required template](../EXECUTION.md#required-session-entry-template), including progress, a change summary, verification, next actions, and next-session cautions. This includes planning, investigation, failed attempts, and documentation-only work.

### 2026-09-17 — Plan initialization

- Scope and checklist IDs: Defined module 04; no implementation checklist items executed.
- Progress: Created the detailed module plan and this paired progress record.
- Change summary: Established ordered work, dependencies, acceptance evidence, and continuity requirements for authentication, identity, and project authorization.
- Files/artifacts: `docs/plan/modules/04-identity-and-access.md`; `docs/plan/progress/04-identity-and-access.md`.
- Verification: Reviewed planning scope against the initial architecture and cross-module boundaries. Package-wide documentation checks are recorded in master progress; application/runtime tests were not run because this session only created plans.
- Decisions and deviations: Follow the source reconciliations in [SOURCES](../SOURCES.md). No new implementation deviation approved.
- Blockers/open questions: None resolved by implementation; close the module's design/compatibility decisions during its ordered steps.
- Next actions: Complete prerequisites, then begin 04.1.
- Next-session cautions: Keep User and Staff identities separate. Email equality must never grant Staff privileges; the official SPA must not persist access or refresh tokens.

### 2026-09-25 — Standard-profile password-login plan direction

- Scope and checklist IDs: Planning decision for 04.1d; no implementation checklist completed.
- Progress: Module 04 is still Not started pending module 03, but its plan now treats standard-profile password login as approved to open once the functional account flow and provider implementation are complete.
- Change summary: Added the standard-profile direction to 04.1d and linked [ADR 0009](../../decisions/0009-standard-password-login.md). Independent audit does not block implementation or enablement; further Argon2id performance testing remains stopped. The Free minimum-tier account journey remains governed separately.
- Files/artifacts: [module 04](../modules/04-identity-and-access.md), [ADR 0009](../../decisions/0009-standard-password-login.md), [module 03 plan](../modules/03-security-foundation.md), this record and master progress.
- Verification: VitePress documentation build passed; 290 local links across 12 affected documents and scoped `git diff --check` passed. No application tests or runtime checks were run because this batch changed planning policy only.
- Decisions and deviations: Explicit user direction. No login endpoint or account flow was implemented in this documentation batch.
- Blockers/open questions: Module 03 prerequisite, identity/storage contract, provider composition and account persistence/rehash remain.
- Next actions: Start 04.1 after module 03's non-audit prerequisite work; include the approved standard-profile password journey in 04.1d.
- Next-session cautions: Keep User and Staff identities distinct, do not infer login implementation from this plan decision, and preserve the Free tier's independent parameter-floor gate.

### 2026-09-20 — Minimum-tier account and capability requirements planned

- Scope and checklist IDs: Planning only. Added 04.1e, 04.2g and 04.V6. No implementation item was completed or checked.
- Progress: Defined the tier's account mechanism (password plus passkey plus single-use recovery codes and administrator-assisted recovery without email), the unauthenticated instance capability document, and the downgrade rule that existing Argon2id records must be migrated or reset before the tier is enabled.
- Change summary: Extended the module plan with the tier items and a source-coverage pointer to [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md); no existing item was weakened.
- Files/artifacts: `docs/plan/modules/04-identity-and-access.md`; [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md); this record.
- Verification: Documentation-only session; the package-wide validator and language-policy results are recorded in the master session entry. No authentication code, test or deployment ran.
- Decisions and deviations: The capability document reports `passwordHashPolicy` including its downgraded flag, so a client cannot imply Argon2id where the tier does not provide it.
- Blockers/open questions: 04.V6 cannot pass until 03.V7 fixes the tier's parameters and the capability contract is implemented.
- Next actions: Keep 04.1/04.2 in the standard order; implement the capability document together with the tier gate rather than before it.
- Next-session cautions: Keep User and Staff identities separate, never treat capability advertisement as authorization, and do not expose password endpoints as available when the reviewed floor disables them.


### 2026-09-21 — Audit work suspended by user instruction

- Scope and checklist IDs: Audit-related portions of this module's canonical checklist; see the [suspension register](../AUDIT-SUSPENSION.md).
- Progress: Marked planned audit work Suspended with the explicit instruction “no audit for now”; unrelated development remains eligible.
- Change summary: Added visible suspension labels and an execution override, preserving unchecked states and earlier history.
- Files/artifacts: This module's plan and progress record; the shared suspension register.
- Verification: Documentation consistency is checked with the suspension batch; no audit implementation or audit acceptance run.
- Decisions and deviations: Explicit user-directed scheduling suspension, not completion, automatic resumption, or deletion of existing audit behavior.
- Blockers/open questions: Audit evidence remains deferred; it does not block unrelated development or count as a passed release gate.
- Next actions: Execute the next eligible non-audit work within the authorized scope; Phase 03 proceeds with transport security.
- Next-session cautions: Do not restart audit tasks through mixed feature checklists or earlier next-action entries; resume only when the user explicitly requests it. Preserve existing history and protections.

### 2026-09-27 — Narrow registration dependency for Phase 03

- Scope and checklist IDs: Partial 04.1c/04.1d support for 03.3c–03.3f; no 04 item or gate is complete.
- Progress: A real handle/password User registration route now exercises Phase 03 security admission and atomically stores a User principal, identity and versioned Argon2id credential on both local profiles. Full 04.1/04.2 and all 04 acceptance items remain open.
- Change summary: Added a separate credential table and dual adapters, bounded public GET/POST registration contract, generic duplicate 202 response and route/root wiring. Registration grants no session or Staff privilege.
- Files/artifacts: `packages/application/src/account-registration.ts`, both database adapters/schemas and additive migrations, server route/contracts and both roots, focused route/repository tests, [data model](../../DATA-MODEL.md), [API conventions](../../API-CONVENTIONS.md) and [Phase 03 evidence](../evidence/03-registration-admission.md).
- Verification: Local Node/PostgreSQL and workerd/D1 functional route and repository checks passed, including atomic duplicate/concurrent behavior, versioned primary counters and store outages. Both typechecks, lint/boundaries, dual migration checks, docs build and secret scan passed. Details/commands are in the linked evidence; no deployed, audit or Argon2id performance check ran.
- Decisions and deviations: Account registration is the smallest owned sensitive action that can exercise rate, trusted subject and optional CAPTCHA behavior before the rest of 04.1/04.2. No Staff privilege or session is granted by registration.
- Blockers/open questions: Full account mechanism, login/recovery, revision-safe rehash, Staff enrollment and authorization flows remain for Module 04; trusted Workers ingress and deployed provider evidence remain for Module 03.
- Next actions: Continue actionable non-audit Phase 03 work, then resume ordered 04.1 after its prerequisite is met.
- Next-session cautions: Do not infer 04 completion, login availability or an accepted Cloudflare ingress boundary from this partial route.

### 2026-09-27 — Registration schema readiness follow-up

- Scope and checklist IDs: Partial 04.1c/04.1d support for the Phase 03 registration dependency; both items remain open.
- Progress: Both roots now require the credential and primary rate tables in read-only readiness. The isolated test D1 received migration 0010; no deployed registration path was accepted.
- Change summary: Added schema checks for the registration credential dependency and recorded the test-only migration outcome.
- Files/artifacts: `apps/api-{cloudflare,node}/src/index.ts`, [registration evidence](../evidence/03-registration-admission.md), this record and master progress.
- Verification: Focused PostgreSQL and local workerd readiness checks passed; remote Worker readiness timed out on test D1 despite successful direct Wrangler reads. See the linked evidence. No staging/production, audit or Argon2id performance check ran.
- Decisions and deviations: Readiness does not establish writable admission or complete Module 04 account behavior.
- Blockers/open questions: Trusted Workers ingress, remote Worker D1 binding and full account/login/recovery work remain.
- Next actions: Continue only the narrow Phase 03 supporting integration; resume ordered Module 04 after its prerequisite.
- Next-session cautions: Preserve migrations 0000–0010 and test-only binding separation; do not infer Module 04 completion from registration.

### 2026-09-27 — Registration through signed Workers ingress

- Scope and checklist IDs: Narrow partial 04.1c/04.1d route support for 03.3c–03.3f; no Module 04 item is complete.
- Progress: The existing registration route now passes locally through a public gateway and private service-bound production API Worker with a verified short-lived IP assertion and primary D1 counters. Unsigned direct requests deny.
- Change summary: Added only ingress composition for the existing route; no login, recovery, session, Staff or authorization behavior was added.
- Files/artifacts: `apps/api-cloudflare`, shared admission guard, focused workerd test and [ingress evidence](../evidence/03-workers-ingress.md).
- Verification: Local workerd multiworker/D1 1/1 and Node/workerd HTTP/entry regressions 67/67 passed; TypeScript, lint/boundaries and documentation checks passed. No deployed account flow, audit or Argon2id performance test ran.
- Decisions and deviations: A locally signed address is a functional path, not accepted deployed client provenance.
- Blockers/open questions: The actual same-zone policy, remote Worker D1 binding and full 04 account journey remain open.
- Next actions: Continue Phase 03 route/provider checks; resume ordered Module 04 after its prerequisite.
- Next-session cautions: Keep the private API Worker off public routes and do not infer Module 04 completion from registration.

### 2026-09-27 — Configured challenge on the signed registration path

- Scope and checklist IDs: Narrow partial 04.1c/04.1d support for Phase 03 03.3e/03.3f; all Module 04 items remain open.
- Progress: Local workerd/D1 now exercises the production registration route through the signed gateway with an optional configured CAPTCHA: public challenge metadata, missing-token denial, fixture success and provider-outage denial before persistence.
- Change summary: Added focused route composition evidence and synchronized reader status; no additional account mechanism was implemented.
- Files/artifacts: `tests/workerd/ingress.test.ts`, [ingress evidence](../evidence/03-workers-ingress.md), bilingual security guides and this record.
- Verification: Local workerd ingress 2/2, TypeScript, scoped lint/boundaries and docs build passed; provider responses were injected. No deployed account/provider, audit or Argon2id performance check ran.
- Decisions and deviations: This proves local configured composition only; Module 04 and live provider acceptance remain open.
- Blockers/open questions: Deployed ingress/D1/Turnstile and full login/recovery/authorization work remain.
- Next actions: Continue Phase 03 runtime work; resume ordered Module 04 after its prerequisite.
- Next-session cautions: Do not infer login, recovery or live challenge acceptance from this registration fixture.

### 2026-09-27 — Isolated deployed registration attempt

- Scope and checklist IDs: Partial 04.1c/04.1d deployment dependency for Phase 03; no Module 04 checklist outcome passed.
- Progress: Test-only private API and public gateway Workers uploaded with the test D1 binding, but gateway HTTP timed out from this host. No deployed account route response or User write was observed; both temporary Workers were deleted.
- Change summary: Recorded deployment-limit evidence without changing registration semantics or staging/production resources.
- Files/artifacts: [Workers ingress evidence](../evidence/03-workers-ingress.md), this record and master progress; ignored temporary configs remain under `.local/phase03-signed-deploy/` without generated secret files.
- Verification: Wrangler uploads/deletions passed; three HTTPS probes and in-app browser failed to connect. Direct D1 primary read found zero test local-password identities. No live provider, audit or Argon2id performance check ran.
- Decisions and deviations: Upload success is not account-route acceptance.
- Blockers/open questions: Reachable isolated hostname, Worker/D1 request path and full 04 account journey remain.
- Next actions: Continue Phase 03 independent work; repeat deployed registration only when the connection path works.
- Next-session cautions: No test Worker remains deployed; keep test D1 separate from staging/production.

### 2026-09-27 — Registration ingress failure boundary

- Scope and checklist IDs: Narrow partial 04.1c/04.1d support; no checklist outcome is complete.
- Progress: The signed registration gateway now sends no-store 503 on its early denials and removes ordinary address headers before forwarding to the private API.
- Change summary: Limited the forwarded trust surface without changing registration or account persistence semantics.
- Files/artifacts: Workers ingress source, focused tests, [ingress evidence](../evidence/03-workers-ingress.md) and this record.
- Verification: Ingress unit 2/2, local workerd multiworker/D1 2/2 and TypeScript/scoped lint passed. No deployed route, audit or Argon2id performance check ran.
- Decisions and deviations: Deployed client-IP provenance and Module 04 acceptance remain open.
- Blockers/open questions: Reachable isolated hostname and full account journey remain.
- Next actions: Continue Phase 03 route/runtime work; resume ordered Module 04 after its prerequisite.
- Next-session cautions: Keep test D1 separate and the private API off public routes.

### 2026-09-27 — Registration persistence response bound

- Scope and checklist IDs: Narrow partial 04.1d support for Phase 03 03.3f; Module 04 remains open.
- Progress: The registration route now denies a stalled account store within five seconds on local Node and workerd HTTP paths.
- Change summary: Added a store await deadline and focused failure-path tests; the bound does not cancel a write already dispatched to a database.
- Files/artifacts: `packages/server/src/account-registration.ts`, focused registration tests, [registration evidence](../evidence/03-registration-admission.md) and this record.
- Verification: Unit 8/8, Node HTTP 32/32, local workerd HTTP 34/34, TypeScript, lint/boundaries and scoped formatting passed. No deployed provider, late-commit, audit or Argon2id performance check ran.
- Decisions and deviations: Generic 503 disclosure and primary admission policy remain. No login/session/recovery capability follows from this response bound.
- Blockers/open questions: Full Module 04 account journey and deployed Workers trust remain open.
- Next actions: Continue the narrow Phase 03 dependency with revision-safe login-time rehash behavior.
- Next-session cautions: Preserve migrations 0000–0010 and the uncommitted tree; no test Worker remains deployed.

### 2026-09-27 — Credential replacement support for Phase 03

- Scope and checklist IDs: Narrow partial 04.1d support for 03.2e; Module 04 remains open.
- Progress: Both stores now expose active User credential reads and revision-checked record replacement for later login-time rehash. No login or session route was opened.
- Change summary: Added primary read and conditional update behavior to the existing registration adapters without changing registration responses or schema.
- Files/artifacts: Application account port, both database account adapters, focused repository cases, [registration evidence](../evidence/03-registration-admission.md) and this record.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, TypeScript, lint/boundaries and scoped formatting passed. No deployed provider, audit or Argon2id performance check ran.
- Decisions and deviations: A stale revision or suspended account cannot accept a rehash write. Login must later handle verification races before issuing any credential.
- Blockers/open questions: Full login/session/recovery and deployed Workers/D1 trust remain open.
- Next actions: Add an account-owned verified login operation using Phase 03 admission and this store, then verify both standard profiles.
- Next-session cautions: Preserve the uncommitted tree and migrations; this adapter support alone does not complete 04.1d.

### 2026-09-27 — Internal verifier for Phase 03 rehash

- Scope and checklist IDs: Narrow partial 04.1d dependency for 03.2e; all Module 04 acceptance stays open.
- Progress: The internal account operation verifies active User passwords, persists revision-checked replacement records and reloads the active credential. It issues no login credential and is not exposed publicly.
- Change summary: Added shared bounded verification with an unknown-account dummy hash and failure-closed race handling.
- Files/artifacts: Server account verifier, focused unit/dual-adapter tests, [registration evidence](../evidence/03-registration-admission.md) and this record.
- Verification: Unit 4/4, isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, TypeScript, lint/boundaries and scoped formatting passed. No deployed provider, audit or Argon2id performance check ran.
- Decisions and deviations: A useful public login needs the Module 04 first-party session or opaque token contract; a bare boolean response is not exposed. The issuer must revalidate account status/revision before it grants a credential.
- Blockers/open questions: Session/token issuance and the full account journey remain; deployed Workers/D1 trust remains open.
- Next actions: Add the minimal safe issuance contract and then connect root-selected login rate/CAPTCHA admission on both standard profiles.
- Next-session cautions: Keep Module 04 checklist items open and preserve migrations/uncommitted work.

### 2026-09-27 — Registration observation support for Phase 03

- Scope and checklist IDs: Narrow 04.1d route support for partial non-audit 03.3d/03.3f; no Module 04 checklist or acceptance item closed.
- Progress: The existing registration route emits allowlisted success/failure observations locally on Node/PostgreSQL and workerd/D1; rate-counter outage remains a closed 503 without a second account write.
- Change summary: Shared route/runtime telemetry classification only; registration admission, persistence, password behavior and public response contract were not changed.
- Files/artifacts: `packages/{server,observability}/src/index.ts`, focused account-route tests and Worker fixture, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, unit security 6/6, TypeScript, lint/boundaries and scoped formatting passed. No deployed account route, live provider, audit or Argon2id performance test ran.
- Decisions and deviations: Registration telemetry carries only fixed labels/status/request IDs; it does not issue a login credential or constitute a security audit.
- Blockers/open questions: Full Module 04 account/session journey and deployed Workers trust remain open.
- Next actions: Continue independent Phase 03 03.3c–03.3f integration and deployed test-only gateway/D1 verification; resume ordered Module 04 only for a necessary Phase 03 dependency.
- Next-session cautions: Preserve the internal verifier and all uncommitted migrations; do not infer login or Module 04 completion from this route.

### 2026-09-27 — Test-only deployed account dependency probe

- Scope and checklist IDs: Narrow deployed 04.1d dependency check for partial Phase 03 03.3c–03.3f; no Module 04 checklist item completed.
- Progress: A private deployed API Worker read the test D1 credential/rate schema for readiness through a health-only service binding; the signed registration gateway still denied this host before the account route.
- Change summary: Temporary test-only Workers and random secrets were created and removed; no tracked account behavior changed.
- Files/artifacts: [Workers ingress evidence](../evidence/03-workers-ingress.md), this record and Phase 03/master progress.
- Verification: Deployed liveness/readiness 200 through a health-only diagnostic gateway, account GET 503, signed gateway 503 on an `X-Real-IP`-bearing request, final test D1 local-password identity count zero, both Workers deleted. No deployed account write, provider, audit or Argon2id performance test ran.
- Decisions and deviations: Keep signed ingress fail-closed; health readiness is not account-route acceptance.
- Blockers/open questions: Trusted deployed client provenance and all actual Module 04 login/session/recovery outcomes remain open.
- Next actions: Continue Phase 03 local route/runtime work; repeat signed registration only after the provenance boundary is demonstrably valid.
- Next-session cautions: No temporary Worker or secret remains; preserve test D1 isolation, migrations and all uncommitted changes.

### 2026-09-27 — Shared registration request observation path

- Scope and checklist IDs: Narrow 04.1d route dependency for partial Phase 03 03.3d; no Module 04 checklist or acceptance outcome closed.
- Progress: Registration still emits one fixed-label success/failure observation on both local profiles after shared route telemetry moved to hooks verified in workerd.
- Change summary: Shared server observation placement only; no account, credential, admission or public contract change.
- Files/artifacts: `packages/server/src/index.ts`, focused account-route tests, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, Node HTTP 32/32, workerd HTTP 34/34, TypeScript, lint/boundaries and scoped formatting passed. No deployed account write or provider evidence.
- Decisions and deviations: Diagnostic events are not a Module 04 session or audit capability.
- Blockers/open questions: Full identity journey and trusted deployed registration remain open.
- Next actions: Continue independent Phase 03 03.3c–03.3f behavior; keep ordered Module 04 work scoped to actual dependencies.
- Next-session cautions: Preserve internal verifier, migrations and uncommitted tree; Free tier remains separately disabled.

### 2026-09-27 — Registration primary-limit denial evidence

- Scope and checklist IDs: Narrow 04.1d registration support for partial Phase 03 03.3c/03.3d; no Module 04 item completed.
- Progress: Local Node/PostgreSQL and workerd/D1 registration deny 429 from their authoritative account counter with a retry hint, no-store response and no account write. Counter outage continues to deny 503.
- Change summary: Focused real-route tests only; account behavior and public contract were unchanged.
- Files/artifacts: `tests/{postgres,workerd}/account-route.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL 18.6 1/1, local workerd/D1 1/1, TypeScript, lint/boundaries and scoped formatting passed. No deployed registration or Module 04 journey acceptance.
- Decisions and deviations: This supports Phase 03 rate evidence and does not establish login/session behavior.
- Blockers/open questions: Trusted deployed ingress, full account journey and multi-instance rate evidence remain.
- Next actions: Continue independent Phase 03 configured-provider route work; leave Module 04 checklist open.
- Next-session cautions: Preserve current migrations and internal verifier; no test Worker remains deployed.

### 2026-09-27 — Configured challenge on the Node registration dependency

- Scope and checklist IDs: Narrow 04.1d route evidence for partial Phase 03 03.3e/03.3f; Module 04 remains open.
- Progress: A complete optional Turnstile configuration on the Node/PostgreSQL registration route requires a token and fails closed on private-address provider egress before account persistence.
- Change summary: Added a focused Node account-route case; no production account or public contract change.
- Files/artifacts: `tests/postgres/account-route.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL 18.6 1/1, signed local workerd/D1 configured-provider ingress 2/2, TypeScript, lint/boundaries and scoped formatting passed. Provider responses on workerd were injected; Node DNS was a private-address fixture. No live provider/deployed account acceptance.
- Decisions and deviations: Optional setup remains optional, while complete setup enables required verification. This does not add login or finish Module 04.
- Blockers/open questions: Live Siteverify, trusted deployed registration and full account journey remain open.
- Next actions: Continue Phase 03 controlled deployed D1/provider integration; keep Module 04 checklist open.
- Next-session cautions: Preserve the existing internal verifier, uncommitted migrations and test D1 isolation.

### 2026-09-27 — Synthetic deployed registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c–03.3f; no Module 04 checklist or acceptance item closed.
- Progress: A guarded synthetic gateway reached the private deployed API and created one test User/Argon2id credential in the isolated D1, with authoritative account/IP counters. Configured published dummy Turnstile outcomes denied three further account attempts without additional User rows.
- Change summary: Temporary test-only deployment and secrets were removed after verification; no tracked Module 04 behavior changed.
- Files/artifacts: [Workers ingress evidence](../evidence/03-workers-ingress.md), [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Deployed no-provider registration 202; primary D1 credential/counter read; configured dummy missing-token 403, always-pass semantically incomplete 503 and always-fail 403; both Workers deleted. The exact test credential/identity/principal were deleted afterward, and the final primary D1 read found zero local-password identities, credentials and Users. Synthetic fixed IP does not prove trusted client provenance or valid configured challenge.
- Decisions and deviations: Keep signed ingress and full Module 04 acceptance open despite the D1 write-path proof.
- Blockers/open questions: Real client provenance, valid Turnstile action/hostname token, session/login/recovery and multi-instance acceptance remain.
- Next actions: Continue Phase 03's pre-parse volumetric registration admission increment on both profiles, then repeat deployed registration only under verified ingress; leave ordered Module 04 work scoped to necessary dependencies.
- Next-session cautions: The isolated test D1 retains four-hit account/IP abuse counters but no test User; temporary Workers/secrets are gone. Preserve migrations/uncommitted changes.

### 2026-09-27 — Registration pre-parse admission dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d; no Module 04 item or acceptance outcome closed.
- Progress: The existing account-owned registration POST now sheds malformed bodies using a root-selected trusted-IP approximate bucket before parsing; valid requests retain the full primary account/IP gate, optional CAPTCHA and atomic User persistence.
- Change summary: Shared request-hook and admission changes, focused account-route and unit checks; no login, session, recovery or credential behavior changed.
- Files/artifacts: `packages/server/src/{index,sensitive-admission,account-registration}.ts`, focused tests, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL 18.6 route 1/1, local workerd/D1 route 2/2, focused unit 17/17, Node HTTP 32/32 and workerd HTTP 34/34, TypeScript, lint/boundaries and scoped formatting passed. No deployed trusted-ingress or full account-journey acceptance.
- Decisions and deviations: The early shed writes no primary counter and does not substitute for the route's authoritative gate. No Module 04 checklist state changed.
- Blockers/open questions: Trusted deployed ingress, full account journey, provider-success and multi-instance evidence remain open.
- Next actions: Continue Phase 03's independent 03.3e/03.3f behavior work; add further Module 04 route support only where that integration requires it.
- Next-session cautions: Preserve the internal verifier, migrations and uncommitted tree; keep Free tier disabled and audit/Argon2id performance work stopped.

### 2026-09-27 — Configured Node registration provider path

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3e/03.3f; no Module 04 checklist item or acceptance outcome closed.
- Progress: A deterministic valid Siteverify fixture now reaches one User/credential write through the real Node/PostgreSQL route; wrong action, malformed response, outage and authoritative 429 leave no additional identity. Signed local workerd/D1 success/outage remains green.
- Change summary: Focused PostgreSQL route evidence only; no login/session/recovery or production account behavior changed.
- Files/artifacts: `tests/postgres/account-route.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1, local workerd ingress 2/2, focused unit 15/15, TypeScript, lint/boundaries and scoped formatting passed. Node live TLS probe stopped at the public-address DNS guard before Siteverify; fixture success is not live provider acceptance.
- Decisions and deviations: Keep Module 04 narrow and open. The blocked direct DNS answer must not be treated as provider failure or bypassed.
- Blockers/open questions: Valid live challenge, trusted deployed ingress and the full account journey remain unverified.
- Next actions: Continue Phase 03 signed-ingress and provider work; add Module 04 behavior only when a specific Phase 03 integration requires it.
- Next-session cautions: Preserve the internal verifier and migrations; audits and Argon2id performance testing remain stopped, Free tier remains disabled.

### 2026-09-27 — Signed ingress pre-parse registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d; no Module 04 item or acceptance gate closed.
- Progress: Local production-root Workers ingress denies unsigned malformed registration before parsing and sheds repeated signed malformed requests without a primary write; a valid signed registration still reaches D1 User persistence and authoritative counters.
- Change summary: Focused signed ingress test only; account route, credential storage and migrations were unchanged.
- Files/artifacts: `tests/workerd/ingress.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Local signed workerd/D1 ingress 2/2, isolated PostgreSQL route 1/1, TypeScript, lint/boundaries and scoped formatting passed. No deployed trusted-provenance or full Module 04 journey evidence.
- Decisions and deviations: Local signed fixture is not deployed ingress acceptance; keep the Module 04 prerequisite and checklist open.
- Blockers/open questions: Genuine deployed address provenance, valid live challenge and login/session/recovery remain open.
- Next actions: Support Phase 03's focused two-root primary-counter route check on both profiles, then continue deployed integration; add further Module 04 behavior only as a specific dependency.
- Next-session cautions: Preserve migrations, internal verifier and uncommitted tree; Free tier stays disabled and suspended work stays stopped.

### 2026-09-27 — Shared primary limits across local account roots

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d/03.V3; no Module 04 checklist item or acceptance gate closed.
- Progress: A separate Node root denies from the PostgreSQL account counter despite its fresh process limiter; a separate workerd root denies from the shared D1 counter despite a different approximate namespace. One D1 User remains after the denial.
- Change summary: Focused account-route tests only; no product account, credential, session or migration behavior changed.
- Files/artifacts: `tests/{postgres,workerd}/account-route.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1, local workerd/D1 route 3/3, TypeScript, lint/boundaries and scoped formatting passed. This is local separate-root evidence, not deployed account-journey or multi-location acceptance.
- Decisions and deviations: Primary counters remain the source of denial. Keep Module 04 prerequisite and checklist open.
- Blockers/open questions: Deployed multi-instance behavior, genuine ingress, valid live challenge and full login/session/recovery journey remain open.
- Next actions: Support the test-only deployed two-Worker primary-counter milestone if provider connectivity allows; otherwise continue Phase 03 route integration.
- Next-session cautions: Preserve uncommitted tree, test D1 separation and internal verifier; audits/Argon2id performance work stays stopped and Free tier disabled.

### 2026-09-27 — Test-only deployed two-Worker registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d/03.V3; no Module 04 checklist or acceptance gate closed.
- Progress: Two private deployed API Workers sharing the isolated test D1 showed sequential primary account-limit denial after one synthetic fixed-IP registration and direct test-only counter prefill. No second User was stored.
- Change summary: Temporary test deployment and exact row/counter cleanup only; no tracked Module 04 behavior or staging/production resource changed.
- Files/artifacts: [Workers ingress evidence](../evidence/03-workers-ingress.md), [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Four Wrangler dry-runs/uploads/deletions passed, deployed 202/429 and primary D1 reads/writes matched expectations; final primary read found zero test User/credential/identity and fresh-version counters. No genuine ingress, valid provider or full account journey was verified.
- Decisions and deviations: Sequential synthetic ingress evidence cannot close Module 04 registration or Phase 03 multi-instance acceptance.
- Blockers/open questions: Deployed trusted provenance, valid challenge, concurrent/cross-location primary behavior and login/session/recovery remain open.
- Next actions: Continue Phase 03 independent provider/failure-path work and seek a provenance-safe deployed gateway test; keep Module 04 work scoped to actual dependencies.
- Next-session cautions: Temporary Workers/secrets and test User are gone; preserve test D1 isolation, migrations, internal verifier and uncommitted tree. Free tier disabled; audits/Argon2id performance work stopped.

### 2026-09-27 — Concurrent deployed registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d/03.V3; no Module 04 checklist or acceptance gate closed.
- Progress: Two test-only private API Workers with distinct approximate namespaces returned one 202 and one 429 for concurrent synthetic fixed-IP registration after exact D1 counter prefill. One User existed and the primary account count was six.
- Change summary: Deployment evidence and cleanup only; no tracked Module 04 behavior or staging/production resource changed.
- Files/artifacts: [Workers ingress evidence](../evidence/03-workers-ingress.md), [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Four temporary Workers were deleted and independently absent; final primary D1 read found zero local-password identities, credentials, Users and fresh-version counters. Automated cleanup stopped after credential deletion; exact manual primary deletes completed the remaining rows. This does not verify real client provenance, cross-location behavior or the full account journey.
- Decisions and deviations: The concurrent primary admission result remains partial Phase 03 evidence; Module 04 prerequisites and checklist stay open.
- Blockers/open questions: Genuine ingress, valid configured challenge, cross-location/outage consistency and login/session/recovery remain open.
- Next actions: Support only the next specific Phase 03 route integration dependency; continue independent 03.3 work.
- Next-session cautions: Preserve test D1 isolation, migrations, internal verifier and uncommitted tree. Free tier disabled; audits and Argon2id performance work stopped.

### 2026-09-27 — Provider response failure on the registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3e/03.3f/03.V2; no Module 04 checklist or acceptance gate closed.
- Progress: Both standard-profile registration route fixtures deny redirected and oversized configured Siteverify responses before another User write, while the valid fixture still registers.
- Change summary: Focused Node/PostgreSQL and signed local workerd/D1 route checks only; no product account/session behavior changed.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1, local workerd/D1 ingress 2/2, TypeScript, lint/boundaries and scoped formatting passed. Provider responses were injected, so live Siteverify and full Module 04 acceptance remain unverified.
- Decisions and deviations: Keep Module 04 limited to this Phase 03 route dependency; do not extend the internal login verifier from this evidence.
- Blockers/open questions: Valid live challenge, trusted deployed ingress, Node direct TLS and full login/session/recovery journey remain open.
- Next actions: Support Phase 03 timeout/concurrency route failure checks on both profiles; retain the Module 04 prerequisite and checklist open.
- Next-session cautions: Preserve test D1 isolation, migrations, internal verifier and uncommitted tree. Free tier disabled; audit and Argon2id performance work stopped.

### 2026-09-27 — Provider deadline on the registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3e/03.3f/03.V2; no Module 04 item or gate closed.
- Progress: Both standard-profile registration routes return 503 within the CAPTCHA budget when a configured provider exceeds the central three-second outbound deadline; neither stores the timed-out handle.
- Change summary: Focused route fixtures only; account/session production behavior and migrations unchanged.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1, signed local workerd/D1 ingress 2/2 and TypeScript passed. Injected transports do not prove live Siteverify egress.
- Decisions and deviations: Keep the narrow Module 04 dependency and all checklists open; do not extend login-time rehash from this result.
- Blockers/open questions: Valid live challenge, trusted deployed ingress, Node direct TLS and the full account journey remain open.
- Next actions: Support Phase 03's concurrent provider egress admission check on both profiles.
- Next-session cautions: Preserve uncommitted tree, migrations, test D1 isolation and internal verifier; Free tier disabled, audits and Argon2id performance work stopped.

### 2026-09-27 — Approximate limiter outage on the registration dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d/03.V3; no Module 04 checklist or gate closed.
- Progress: Both standard-profile account routes deny 503 before primary counter or User writes when root-selected approximate limiting is unavailable; the Workers check uses the signed production gateway with an absent API Rate Limiting binding.
- Change summary: Focused PostgreSQL and local workerd/D1 route checks only; no production account/session behavior or migration changed.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1, signed local workerd/D1 ingress 3/3, TypeScript, lint/boundaries and scoped formatting passed. No deployed outage or full account journey was verified.
- Decisions and deviations: Preserve primary-authoritative policy; the missing approximate dependency cannot grant registration.
- Blockers/open questions: Trusted deployed ingress, live valid challenge, login/session/recovery and standard staging/production acceptance remain open.
- Next actions: Implement only the Module 04 session/token work necessary to expose a real login admission consumer for Phase 03 03.3c/03.3d, without claiming either module complete.
- Next-session cautions: Preserve internal verifier, migrations, test D1 separation and uncommitted work; Free tier disabled, audits and Argon2id performance work stopped.

### 2026-09-28 — Narrow session dependency for Phase 03 login admission

- Scope and checklist IDs: Partial 04.1d/04.2c supporting 03.3c–03.3f; no Module 04 checklist or acceptance gate closes.
- Progress: Standard-profile password login now issues a first-party host-only secure cookie after root-bound rate/CAPTCHA admission, and primary-backed session read/logout routes validate revision, active status, expiry and revocation. This is the account-owned consumer needed by Phase 03; the login UI, token exchange, recovery, rotation and complete authorization flow remain open.
- Change summary: Added `authorization_sessions` migrations and adapters for both stores, shared account-session port and route contract, login/session handlers and focused real-root cases. PostgreSQL session expiry decoding now handles `pg` string `bigint`. The existing credential-read/replacement record remains separate; it did not previously wire login.
- Files/artifacts: `packages/{application,contracts,database/{d1,postgres},server}/`, `apps/api-{node,cloudflare}/src/`, `tests/{postgres,workerd}/`, [login evidence](../evidence/03-login-admission.md), `docs/{API-CONVENTIONS,DATA-MODEL}.md`, `docs/development/MIGRATIONS.md`, this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL account route 1/1 and signed local workerd/D1 ingress 5/5 passed; success/revocation, wrong credentials, revision change, Origin, primary 429, missing dependencies and configured CAPTCHA success/failure were observed. TypeScript, lint/boundaries, Drizzle history, scoped formatting and docs build passed. No deployed session migration or account journey acceptance is claimed.
- Decisions and deviations: Keep this dependency narrow and primary-backed. A configured provider denies wrong action/outage; absent provider requires no challenge. Local provider fixtures and synthetic signed ingress do not prove live Turnstile or genuine edge provenance.
- Blockers/open questions: Full account flow, session rotation, deployed ingress, live valid challenge, shared migration rollout and measured profile behavior remain open.
- Next actions: Support Phase 03's next real-route provider saturation check without extending 03.2e or Module 04 for unrelated work.
- Next-session cautions: Preserve uncommitted migrations and test D1 separation. Keep audit/Argon2id performance work stopped and Free tier disabled.

### 2026-09-28 — Account-route provider saturation dependency

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3e/03.3f/03.V2; Module 04 items and gates remain open.
- Progress: Configured registration on Node/PostgreSQL and signed local workerd/D1 denies a ninth concurrent provider call before another User write, while primary account/IP counters still count it. After eight provider denials, a fresh valid challenge registers successfully.
- Change summary: Focused account-route fixtures only; no account/session production code or migration changed.
- Files/artifacts: `tests/{postgres,workerd}/` account/ingress routes, [registration evidence](../evidence/03-registration-admission.md), this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1, signed local workerd/D1 ingress 6/6, TypeScript and scoped lint/formatting passed. Transport was injected; live Siteverify and full Module 04 acceptance remain unverified.
- Decisions and deviations: Keep the Module 04 dependency narrow and primary counters authoritative.
- Blockers/open questions: Full account journey, live configured provider, genuine ingress and measured budgets remain open.
- Next actions: Support only the Phase 03 session/logout approximate-shed route increment, without extending 03.2e or unrelated Module 04 work.
- Next-session cautions: Preserve uncommitted tree, migrations and isolated test D1; Free tier disabled and suspended work stopped.

### 2026-09-28 — Session-route abuse guard for Phase 03

- Scope and checklist IDs: Narrow 04.2c support for partial 03.3c/03.3d/03.3f; no Module 04 checklist or acceptance gate closes.
- Progress: Existing session-read and logout routes now shed requests in separate trusted-IP approximate buckets before touching primary session storage. Their accepted cookie lifecycle still works; missing limiter denies 503 and exhausted bucket denies 429.
- Change summary: Shared bound-admission callbacks and request-boundary wiring, plus focused real-route checks. No new account flow, credential format or migration.
- Files/artifacts: `packages/server/src/{sensitive-admission,index}.ts`, `tests/{postgres,workerd}/` account/ingress routes, [login evidence](../evidence/03-login-admission.md), `docs/API-CONVENTIONS.md`, this record, Phase 03 and master progress.
- Verification: Isolated PostgreSQL route 1/1 and signed local workerd/D1 ingress 7/7 passed; shed requests made no further session-store mutation/read, and absent limiter returned no-store 503. TypeScript, lint/boundaries, scoped formatting and diff whitespace passed. Fixture-only Node listener warning and nonfatal workerd bundle warning remained.
- Decisions and deviations: Primary login account/IP counters remain authoritative for password attempts; session polling uses a separate approximate route bucket so it does not exhaust the five-attempt login policy.
- Blockers/open questions: Complete Module 04 session rotation, UI, token flow, recovery and deployed behavior remain open.
- Next actions: Support only the next concrete Phase 03 route/runtime gap; do not extend 03.2e for unrelated behavior.
- Next-session cautions: Preserve uncommitted work, migrations and isolated test D1; Free tier disabled and suspended work stopped.

### 2026-09-28 — Test-only D1 authorization-session schema

- Scope and checklist IDs: Narrow 04.2c deployment prerequisite for Phase 03; Module 04 checklist and acceptance remain open.
- Progress: D1 `0011_authorization_sessions` was applied only to exact test database `hyperbug-test-1`; its latest history row and zero session rows were verified on the primary. Staging/production were untouched.
- Change summary: Test-only migration application and evidence; no tracked account behavior or migration text changed.
- Files/artifacts: [login evidence](../evidence/03-login-admission.md), `docs/development/MIGRATIONS.md`, this record, Phase 03 and master progress.
- Verification: Wrangler 4.141.0 one-pending apply succeeded, subsequent list empty, primary history/table reads passed. No deployed login or session route was yet verified.
- Decisions and deviations: Schema queryability does not establish the functional account flow or deployed ingress trust.
- Blockers/open questions: Deployed HTTP, full Module 04 flow and external provider/provenance evidence remain open.
- Next actions: Run an isolated synthetic-address deployed login/session/logout route check with exact test-row and Worker cleanup.
- Next-session cautions: Preserve test D1 separation, uncommitted work and prior migrations; Free tier disabled and suspended work stopped.

### 2026-09-28 — Test-only deployed session dependency

- Scope and checklist IDs: Narrow 04.1d/04.2c support for partial Phase 03 03.3c/03.3d/03.3f/03.V3; Module 04 checklist and acceptance remain open.
- Progress: Two temporary private API Workers sharing test-only D1 exercised registration/login on A, session read/logout on B and revoked-session denial on A. Primary D1 held one revoked session and one account/IP login attempt before exact cleanup.
- Change summary: Synthetic capability-guarded fixed-IP deployment and cleanup only; no tracked account implementation or migration changed. A first pre-registration probe failed at an unknown gateway status; cleanup was completed and the corrected runner succeeded.
- Files/artifacts: [login evidence](../evidence/03-login-admission.md), ignored `.local/phase03-session-deploy/run.mjs`, this record, Phase 03 and master progress.
- Verification: Deployed 202 registration, 403 wrong Origin, 200 login/session, 204 logout and 401 revoked reuse; four Worker deletions independently returned not-found. Primary D1 final counts were zero sessions, local-password identities, credentials, Users, current token keys and fresh-range counters. Two test key identity tombstones correctly remain `removed`.
- Decisions and deviations: Fixed synthetic IP and rewritten test auth origin do not establish real browser or edge trust. No full account journey, live configured provider or standard staging/production acceptance is claimed.
- Blockers/open questions: Complete Module 04 flows and genuine deployed ingress/provider evidence remain open.
- Next actions: Support only the next concrete Phase 03 dependency; preserve full Module 04 plan scope for its owning phase.
- Next-session cautions: Preserve uncommitted work and test D1 isolation; audits/Argon2id performance work stopped, Free tier disabled.

### 2026-09-28 — Session-token failure support for Phase 03

- Scope and checklist IDs: Narrow 04.2c support for partial Phase 03 03.3f/03.V2; Module 04 checklist and acceptance stay open.
- Progress: Node/PostgreSQL and signed local workerd/D1 session routes now have focused evidence that tampering denies 401 without revoking the original cookie, while missing/malformed token-key material denies 503.
- Change summary: Added route fixture checks only; no additional Module 04 behavior or migration.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, workerd ingress 7/7, TypeScript, lint/boundaries, scoped formatting and diff whitespace passed. Fixture warnings were nonfatal.
- Decisions and deviations: Preserve valid sessions after failed token verification; report unavailable key material without disclosing it.
- Blockers/open questions: Full Module 04 flow, deployed key outage, genuine ingress, live valid Turnstile and measured budgets remain open.
- Next actions: Support only the Phase 03 runtime-readiness key failure increment; defer wider Module 04 work.
- Next-session cautions: Preserve uncommitted work and test D1 separation. Audits/Argon2id performance stopped; Free tier disabled.

### 2026-09-28 — Token-key readiness support for Phase 03

- Scope and checklist IDs: Narrow 04.2c support for partial Phase 03 03.3f; Module 04 checklist and acceptance stay open.
- Progress: Runtime readiness now reports unavailable if the current session-token HMAC key cannot be loaded on either standard profile.
- Change summary: Node shares one provider between readiness and account routes; Workers checks its existing key provider. Account flows and schema are unchanged.
- Files/artifacts: `apps/api-node/src/{abuse-admission,index}.ts`, `apps/api-cloudflare/src/index.ts`, focused PostgreSQL/workerd fixtures, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, Node admission unit 3/3, workerd entry 2/2, signed ingress 7/7, TypeScript, lint/boundaries, source formatting, diff whitespace and docs build passed. Markdown oxfmt check is excluded by tool configuration.
- Decisions and deviations: Readiness checks a current key but does not prove write permissions or the complete authorization service.
- Blockers/open questions: Full Module 04 journey and deployed key/ingress/provider acceptance remain open.
- Next actions: Support only further concrete Phase 03 consumer needs; do not expand Module 04 scope.
- Next-session cautions: Preserve uncommitted migrations and isolated test D1; suspended work and Free tier remain disabled.

### 2026-09-28 — Logout key-failure support for Phase 03

- Scope and checklist IDs: Narrow 04.2c support for partial 03.3f/03.V2; Module 04 items remain open.
- Progress: Both standard-profile logout routes deny unavailable token keys with no-store 503, no clearing cookie and a still-valid original session.
- Change summary: Focused route fixture assertions only; initial Node fixture Origin omission produced 403, then passed after allowlist correction.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, signed workerd ingress 7/7, TypeScript, scoped lint and formatting passed; no product or migration code changed.
- Decisions and deviations: Keep failed logout from revoking a valid session or issuing a success cookie.
- Blockers/open questions: Full Module 04 account/authorization journey and deployed acceptance remain open.
- Next actions: Support only another concrete Phase 03 route need; otherwise resume Module 04 after its prerequisite.
- Next-session cautions: Preserve uncommitted work and migrations; test D1 separate, audits/Argon2id performance stopped, Free tier disabled.

### 2026-09-28 — Primary login-counter outage support for Phase 03

- Scope and checklist IDs: Narrow 04.1d support for partial 03.3c/03.3d/03.V3; Module 04 items stay open.
- Progress: Both standard-profile real login routes return no-store 503 without a session when authoritative primary admission fails; the Node fixture confirms zero password-credential reads.
- Change summary: Focused route assertions only, with a test-local lint fix; no account implementation or migration changed.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, signed workerd ingress 7/7, TypeScript, scoped lint and formatting passed. Deployed outage behavior was not exercised.
- Decisions and deviations: Approximate allowance cannot substitute for the primary login counter.
- Blockers/open questions: Full account/authorization journey and deployed security acceptance remain open.
- Next actions: Support only the next concrete Phase 03 route failure path; do not expand Module 04.
- Next-session cautions: Preserve uncommitted work/migrations and test D1 isolation; suspended work and Free tier remain disabled.

### 2026-09-28 — Session-store outage support for Phase 03

- Scope and checklist IDs: Narrow 04.2c support for partial 03.3f/03.V2; Module 04 items remain open.
- Progress: Both standard-profile routes deny primary session-store outage with no-store 503 for a valid cookie; logout on both profiles issues no clearing cookie. The Node original session remains usable through its healthy root.
- Change summary: Added focused route fixture checks only; account implementation and migrations unchanged.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, signed workerd ingress 7/7, TypeScript, scoped lint and formatting passed; the workerd logout failure assertion was added and rerun in the cleanup continuation. Deployed outage was not exercised.
- Decisions and deviations: An authorization-store failure cannot be treated as a valid session or completed logout.
- Blockers/open questions: Full account/authorization journey and deployed provider/ingress acceptance remain open.
- Next actions: Support only a further concrete Phase 03 route consumer need; preserve Module 04's wider scope for its owning phase.
- Next-session cautions: Preserve uncommitted work/migrations and test D1 isolation; suspended work and Free tier remain disabled.

### 2026-09-28 — Phase 03 counter-cleanup dependency checkpoint

- Scope and checklist IDs: Narrow Phase 03 03.3c/03.3d support; no new Module 04 checklist item or acceptance claim.
- Progress: The existing registration/login/session/logout wiring and outage tests still pass while both standard-profile runtimes gain bounded expired-counter scheduling.
- Change summary: No additional Module 04 feature, route or migration was added. The Node account route and signed workerd ingress were rerun after the Worker default export changed to include a scheduled handler.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [rate evidence](../evidence/03-rate-limits-validation.md), this record, Phase 03/09 and master progress.
- Verification: Isolated PostgreSQL route 1/1 and signed local workerd/D1 ingress 7/7 passed; TypeScript and scoped lint/boundaries passed. These checks include prior success and security-failure paths, not a deployed login or Cron result.
- Decisions and deviations: Keep Module 04 scope paused beyond this Phase 03 dependency.
- Blockers/open questions: Complete identity/authorization journeys and deployed ingress/provider evidence remain open.
- Next actions: Support only a concrete remaining 03.3c–03.3f route need; leave Module 04 checklist and acceptance open.
- Next-session cautions: Preserve uncommitted migrations and test D1 isolation; audits and Argon2id performance testing stopped, Free tier disabled.

### 2026-09-28 — Phase 03 deployed cleanup boundary

- Scope and checklist IDs: Narrow dependency record only; no Module 04 checklist or acceptance item closes.
- Progress: A temporary test-only Worker proved the Phase 03 counter-cleanup scheduled handler against isolated D1. No login/session route, credential or identity data was changed.
- Change summary: No Module 04 code or migration change; the temporary Worker and two test counter rows were removed.
- Files/artifacts: [Rate evidence](../evidence/03-rate-limits-validation.md), this record, Phase 03/09 and master progress.
- Verification: Deployed scheduled tail `ok`, primary D1 expired/fresh row check and independent Worker-not-found confirmation. This is not Module 04 deployed route or ingress acceptance.
- Decisions and deviations: Keep Module 04 expansion paused until an actual Phase 03 route consumer needs it.
- Blockers/open questions: Full account/authorization flows, genuine ingress and live configured provider success remain open.
- Next actions: Support only another concrete Phase 03 consumer need; keep all Module 04 checklists and gates open.
- Next-session cautions: Preserve uncommitted work and test D1 isolation; audits/Argon2id performance testing stopped, Free tier disabled.

### 2026-09-28 — Session-issuance write failure support

- Scope and checklist IDs: Narrow 04.2c support for partial Phase 03 03.3f/03.V2; Module 04 items and acceptance stay open.
- Progress: Both real login routes deny no-store 503 without a cookie when session creation fails after valid password verification; no additional session is persisted in the local fixtures.
- Change summary: Added Node/PostgreSQL and signed workerd/D1 route failure assertions only; no account feature, route or migration changed.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, workerd ingress 7/7, TypeScript, scoped lint/boundaries and formatting passed. No deployed session-write outage was tested.
- Decisions and deviations: Do not issue a cookie when primary session persistence fails; late writes can leave an undelivered token row.
- Blockers/open questions: Complete Module 04 identity/authorization flows and deployed provider/ingress evidence remain open.
- Next actions: Keep Module 04 paused beyond concrete Phase 03 consumers; inspect any remaining current-route 03.3 failure path.
- Next-session cautions: Preserve uncommitted migrations and test D1 isolation; audits/Argon2id performance testing stopped, Free tier disabled.

### 2026-09-28 — Previous-key primary login limit support

- Scope and checklist IDs: Narrow 04.1d support for partial Phase 03 03.3c/03.3d/03.V3; Module 04 items remain open.
- Progress: Both real login routes return no-store 429 from a previous active key's saturated primary account counter even when the current-key approximate bucket allows.
- Change summary: Strengthened existing PostgreSQL/workerd route fixtures only; no account feature, route or migration changed.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/workerd/ingress.test.ts`, [login evidence](../evidence/03-login-admission.md), this record, Phase 03 and master progress.
- Verification: PostgreSQL route 1/1, signed workerd ingress 7/7, TypeScript, scoped lint/boundaries and formatting passed; deployed rotation remains untested.
- Decisions and deviations: Keep primary counters authoritative across abuse-key overlap.
- Blockers/open questions: Full Module 04 flows and deployed ingress/provider/key-rollout evidence remain open.
- Next actions: Support only further concrete Phase 03 route needs; keep Module 04 checklist and acceptance open.
- Next-session cautions: Preserve uncommitted work/migrations and test D1 isolation; audits/Argon2id performance testing stopped, Free tier disabled.

### 2026-09-28 — Worktree consolidation and scope hold

- Scope and checklist IDs: 04.1d/04.2c narrow Phase 03 account dependency; no checklist closure.
- Progress: Existing uncommitted work was inventoried and committed by dependency; no new checklist or gate was closed.
- Change summary: Committed existing registration, login, session, logout, and dual-profile account-store work as a bounded Phase 03 dependency.
- Files/artifacts: This progress record, its paired plan where changed, and the [consolidation record](../evidence/2026-09-28-worktree-consolidation.md); commit details are in Git history.
- Verification: Node 24.21.0 frozen offline install, typecheck, lint, Drizzle history, formatting, build, docs build, secret/license scans, and 301 local tests passed; a clean committed-source retry also passed 301. This is repository/local evidence only; see the linked record for the first clean-run timeout and exact limits.
- Decisions and deviations: Respect the user-directed hold on new features; audits and Argon2id performance work remain suspended, Free tier disabled, Module 04/09 scope bounded, and SPA unstarted.
- Blockers/open questions: Full identity/authorization acceptance, recovery, deployed ingress, and provider evidence remain open.
- Next actions: Do not expand Module 04 during the hold; later resume only from its existing checklist.
- Next-session cautions: Preserve applied migration files and ignored local/audit snapshots. Inspect the actual worktree and target environment before any future operation.

### 2026-09-28 — PostgreSQL CI account-route fixture repair

- Scope and checklist IDs: Maintain the existing narrow 04.1d/04.2c Phase 03 route coverage; no Module 04 checklist or acceptance item closes.
- Progress: The account-route suite in [Backend Tests run 36427041598](https://github.com/EIHRTeam/HyperBug/actions/runs/36427041598/job/108943448711) could not initialize its Node root because CI supplies a loopback TCP `PGHOST`, while the fixture passed it as a Unix-socket directory.
- Change summary: The existing first and second Node roots now use the shared test-only PostgreSQL binding selector; route behavior, production code, and migrations are unchanged.
- Files/artifacts: `tests/postgres/account-route.test.ts`, `tests/fixtures/postgres-node-bindings.ts`, this record and the Module 03 progress record.
- Verification: Node 24.21.0/PostgreSQL 18.6: complete postgres Vitest project passed 49/49 on both private Unix socket and isolated loopback TCP; typecheck, lint, formatting, and diff whitespace checks passed. Commit `f8f9298` passed all four hosted jobs in both [PR run 36428342535](https://github.com/EIHRTeam/HyperBug/actions/runs/36428342535) and [push run 36428335118](https://github.com/EIHRTeam/HyperBug/actions/runs/36428335118).
- Decisions and deviations: Accept only private socket paths or local loopback for this isolated test fixture. Keep Module 04 scope frozen beyond existing Phase 03 dependencies.
- Blockers/open questions: None for this CI repair; full Module 04 acceptance and deployed provider/ingress evidence remain open.
- Next actions: Preserve the existing Module 04 scope hold.
- Next-session cautions: Do not infer deployed account-route acceptance from these local tests. Audits and Argon2id performance work remain suspended; Free tier stays disabled.

### 2026-09-29 — Shared account-store rehash conformance evidence

- Scope and checklist IDs: Narrow Phase 03 dependency only (03.2e acceptance); no Module 04 checklist item or code changed.
- Progress: Module 03's 03.2e closure added a shared rehash conformance fixture that registers a credential and performs login-time supersession rehash through the real `verifyAccountPassword` operation against the real PostgreSQL and D1 account stores. Both profile cases passed inside the owning suites.
- Change summary: Test fixtures and documentation only; see the [module 03 record](03-security-foundation.md) and [password research](../evidence/03-password-research.md).
- Files/artifacts: `tests/fixtures/standard-password-rehash-contract.ts`, `tests/postgres/repository.test.ts`, `tests/workerd/standard-password.test.ts`.
- Verification: Isolated PostgreSQL 18.6 repository suite 49/49 and workerd password suite 5/5 passed as part of the full 303-test matrix recorded in module 03.
- Decisions and deviations: None; the narrow dependency boundary is unchanged.
- Blockers/open questions: None from this batch; the module's own acceptance remains pending its prerequisite.
- Next actions: Unchanged — resume the ordered 04.1/04.2 account journey when the prerequisite gate and authorization allow.
- Next-session cautions: The rehash fixture intentionally binds a superseding policy through the same constructors the production roots call; production roots still pin the initial source-floor policy.

### 2026-09-30 — Module 04 released from hold; Phase 03 remainder re-scoped in

- Scope and checklist IDs: Planning/session-start batch for the full module; no implementation checklist item was executed or checked. Affected ownership: 04.2b/04.2e (token activity), 04.2f (recovery), 04.3c (privileged operations).
- Progress: The 2026-09-30 user instruction released Module 04 from the 2026-09-28 hold to advance its entire checklist, with the hold's other parts (no SPA, no Free-tier enablement, suspended later-module audit portions, stopped Argon2id performance work, no Module 09 expansion) still in force. The same instruction re-scoped module 03's remainder: this module now formally owns the recovery/token/privileged-operation rate-limit categories and their measured budgets (production numbers at the staging real-load budget milestone), using module 03's frozen category-dimension policy. Module 03 is recorded as compliantly complete, which clears this module's stated prerequisite.
- Change summary: The module plan gained the deferred-ownership note; this record's status, step tracking and next actions moved from the narrow-dependency hold to the full ordered checklist. No application code changed.
- Files/artifacts: [module 04 plan](../modules/04-identity-and-access.md), [module 03 plan](../modules/03-security-foundation.md), [closure matrix](../evidence/03-closure-matrix.md), this record, master progress and the plan README/EXECUTION/COVERAGE synchronization.
- Verification: Documentation-only session; no application tests were run because no application behavior changed. Shared batch checks are recorded in the master session entry.
- Decisions and deviations: The 2026-09-28 hold's Module 04 portion is lifted by explicit user instruction; the rest of that hold remains. The untracked root `SECURITY.md` is a protected user draft that must never be committed.
- Blockers/open questions: None structural; the G1 audit-governance decision (resume vs deferral+ADR for suspended audit portions) remains with the user and will be raised when only suspended portions remain.
- Next actions: Begin 04.1a (AUTH-FLOWS specification), then 04.1b (Better Auth PoC with current documentation), in small reviewable batches.
- Next-session cautions: Keep User and Staff identities separate — email equality never grants Staff. The SPA must never persist access/refresh tokens. Finish the existing registration/login/session foundation; do not rewrite it. Keep audit portions of 04.3a/04.3c/04.V5 suspended and unchecked, and the Free tier startup-disabled.

### 2026-09-30 — 04.1a accepted: AUTH-FLOWS specification

- Scope and checklist IDs: **04.1a accepted**; no other item changed.
- Progress: Wrote the authentication-flow specification from the initial-architecture sources (SECURITY §§5–34, PRODUCT §§3–5, TECH-STACK §§41–43) and the implemented Phase 03 dependency surface. It covers origins/trust boundaries, the User/Staff identity model, public-client registration with exact-match redirect allowlists, Authorization Code + PKCE S256 with ≤60 s single-use codes, opaque `at_` bearer tokens (≥256-bit secret, keyed digest, 10-minute default, immediate revocation), the first-party `__Host-hb_session` cookie contract (implemented idle/absolute values recorded; rotation specified for 04.2c), assurance levels with the password-only initial limitation, recovery (single-use recovery codes, optional-channel reset tokens, administrator-assisted no-email recovery, last-admin re-arm), logout and token revocation, and the operator-channel one-time-code bootstrap design for 04.1c with no unauthenticated bypass.
- Change summary: New `docs/AUTH-FLOWS.md` with an implementation-status map separating implemented dependency behavior from specified 04.2/04.3 work; documentation-index and cross-link updates only.
- Files/artifacts: `docs/AUTH-FLOWS.md` (new); `docs/README.md`; `docs/plan/README.md`; `docs/API-CONVENTIONS.md`; the module checklist and this record.
- Verification: `corepack pnpm docs:build` passed (vitepress v1.6.4); one-off relative-link/anchor check over the four changed files passed (90 links, `RESULT: PASS`). No application tests were run because no application behavior changed.
- Decisions and deviations: Normative values derive from the sources (code ≤60 s, token 10 min in 5–15, reset 15–30 min, cookie attributes, memory-only tokens); the operator-channel bootstrap design and Staff-session limits (15-minute idle/12-hour absolute) are this module's recorded choices within the source constraints, to be confirmed by 04.1c/04.3 implementation. No ADR: the flow follows the source-prescribed architecture; the bootstrap choice is recorded here and revisited if implementation disproves it.
- Blockers/open questions: None for 04.1a; production route budgets remain at the staging real-load milestone.
- Next actions: Run 04.1b (Better Auth candidate PoC) against current documentation on both runtime/database profiles.
- Next-session cautions: The specified-but-unimplemented items (authorize/token endpoints, rotation, recovery, bootstrap) must not be treated as existing behavior in API-CONVENTIONS or the SPA.

### 2026-09-30 — 04.1b accepted: Better Auth candidate PoC, not adopted

- Scope and checklist IDs: **04.1b accepted** (PoC executed and outcome recorded; candidate library not adopted). No application code changed; the workspace dependency graph is untouched.
- Progress: Ran the bounded candidate PoC on both required profiles — Node 24.21.0/PostgreSQL 18.6 (isolated cluster, real HTTP server, 16/20 checks) and workerd/D1 (Miniflare, 11/11 checks) — using Better Auth 1.7.6 + @better-auth/oauth-provider 1.7.6 with `disableJwtPlugin` opaque tokens, 60 s codes, 600 s access tokens and a public PKCE client. The full Authorization Code + PKCE S256 flow, hashed token storage, public-client revocation and session sign-out/revocation were verified on both profiles.
- Change summary: Evidence documentation only. Ten gaps/deviations were recorded, the decisive ones being: default opaque-token entropy ≈191 bits (below the ≥256-bit baseline), unkeyed SHA-256 token digest by default, a session-id storage model that differs from HyperBug's keyed-digest cookie contract, `/oauth2/userinfo` rejecting the public-client opaque token in this configuration, a cross-profile revoke status inconsistency, Workers build patching (variable dynamic import) and a drizzle-orm ≥0.45.2 peer requirement against the workspace's 0.44.7.
- Files/artifacts: [PoC evidence](../evidence/04-better-auth-poc.md) (new); [SOURCES](../SOURCES.md) (2026-09-30 Context7 lookup record); the module checklist and this record. Scratch scripts remain ignored under `.local/phase04-betterauth-poc/`.
- Verification: PoC runs as recorded above (PostgreSQL 16/20 with each failure explained by a recorded upstream gap; workerd/D1 11/11); `corepack pnpm docs:build` and the changed-file link check passed for this documentation batch. No repository application tests were run because no application behavior changed.
- Decisions and deviations: Candidate **not accepted** per 04.1b's own rule (session/storage rules deviate from the baseline); the selected business framework is unchanged and 04.2 proceeds Core-owned. TECH-STACK §42's boundary (authorization/roles/permissions/Staff identity stay Core) is unaffected either way.
- Blockers/open questions: None for this module; the recorded upstream gaps are a future-reconsideration note, not a blocker.
- Next actions: Implement 04.1c (operational public-account mechanism and the operator-channel initial-administrator enrollment from AUTH-FLOWS), then 04.1d.
- Next-session cautions: Do not treat the PoC scratch as production code or add its dependencies to the workspace; the PoC's redirect-URI/cookie values are fixtures, not policy.
