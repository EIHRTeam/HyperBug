# 04 progress — Authentication, identity, and project authorization

Plan: [Detailed checklist](../modules/04-identity-and-access.md)  
Master: [Overall progress](../PROGRESS.md)  
Required protocol: [Execution and handoff rules](../EXECUTION.md)

## Current status

- Status: In progress (full module scope, released from the 2026-09-28 hold by the 2026-09-30 user instruction)
- Delivery scope: MVP backend
- Prerequisites: 03 complete (2026-09-30 compliant completion with the recorded re-scope; the recovery/token/privileged category routes deferred from 03.3c/03.3d are owned here).
- Implementation started: Narrow registration/login/session work exists as the Phase 03 dependency starting point; the full 04.1 ordered work begins now and must finish rather than rewrite that foundation.
- Completed implementation checklist IDs: 04.1a, 04.1b, 04.1c.
- Module state: every non-suspended checklist item is accepted (04.V1–04.V4 accepted; 04.V6's executable parts accepted with the tier-journey remainder explicitly on the activation path; 04.V5 stays suspended; the audit portions of 04.3a/04.3c stay suspended and unchecked). The module is compliantly complete within the goal's boundary. The Better Auth candidate is recorded as not accepted (04.1b evidence); the Core-owned implementation proceeds. Standard-profile password login is approved under [ADR 0009](../../decisions/0009-standard-password-login.md); the optional Free tier stays startup-disabled on its separate path. Audit portions of 04.3a/04.3c/04.V5 remain suspended and unchecked.
- Last updated: 2026-10-01 (module complete within the goal boundary).
- Blocking issues discovered: None structural. The existing registration/login/session routes are proven locally and on the authorized test deployments (genuine ingress, live challenge, cross-location consistency closed in module 03's evidence); the authorization-service flows, recovery, Staff enrollment and project authorization remain to be built in this module.
- Evidence: [Registration admission](../evidence/03-registration-admission.md), [login/session admission](../evidence/03-login-admission.md) and [signed ingress](../evidence/03-workers-ingress.md) cover the existing narrow dependency; no Module 04 acceptance claim.

## Step tracking

| Step | Purpose | State | Evidence |
| --- | --- | --- | --- |
| 04.1 | Prove the authentication implementation | Complete | [AUTH-FLOWS](../../AUTH-FLOWS.md); [PoC evidence](../evidence/04-better-auth-poc.md); bootstrap/recovery/passkey route suites | Narrow 04.1c/04.1d registration/login dependency exists ([registration](../evidence/03-registration-admission.md), [login](../evidence/03-login-admission.md)); full items open |
| 04.2 | Implement cross-site authorization | Complete | [Acceptance evidence](../evidence/04-acceptance-validation.md); [API conventions](../../API-CONVENTIONS.md) | [Login admission](../evidence/03-login-admission.md); authorization-service flows not started |
| 04.3 | Implement identity and permission management | Complete (non-audit) | Roles/sessions/administration suites; [API conventions](../../API-CONVENTIONS.md); audit portions suspended |

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

### 2026-09-30 — 04.1c accepted: initial-administrator bootstrap enrollment

- Scope and checklist IDs: **04.1c accepted**. New route `POST /auth/bootstrap/enroll`; no migration (uses the existing principals/identities/password_credentials tables).
- Progress: Implemented the AUTH-FLOWS operator-channel bootstrap on both profiles. The enrollment code is `hbbs1_` + 256-bit base64url; the Node root arms the route from a private `HYPERBUG_BOOTSTRAP_FILE` mount (same ownership/mode/no-follow rules as the key rings) and the Workers root from the optional `HYPERBUG_BOOTSTRAP_ENROLLMENT` Secret (present-but-malformed refuses startup; absent disarms). The route enforces the same-origin mutation check, registration-class account/IP admission, optional configured CAPTCHA (`bootstrap` action) and a constant-time post-hash code comparison, then creates the Staff principal, local-password identity and Argon2id credential atomically — the conditional `INSERT ... WHERE NOT EXISTS (active staff)` plus batch/transaction rollback makes enrollment single-shot against concurrent calls without mutable secret state. Wrong code, taken handle and existing active Staff all answer one generic no-store 403; no session is issued. Readiness now reports `deployment.bootstrapPending` when a staff store is configured. The local-password lookup, credential replacement and session create/load/touch queries became staff-aware (`kind IN ('user','staff')`), so the enrolled administrator signs in through the existing `/auth/login`; identity uniqueness keeps Staff and User handles disjoint. Email equality is never consulted.
- Change summary: New `StaffEnrollmentStore` application port with D1/PostgreSQL adapters, new server enrollment module, contracts additions, readiness state probe, both-root wiring, observability label, fixture-worker wiring, and two new focused route suites.
- Files/artifacts: `packages/application/src/staff-enrollment.ts` (new) + index; `packages/database/{d1,postgres}/src/staff-enrollment.ts` (new) + indexes and staff-aware account queries in `account-registration.ts`/`account-session.ts`; `packages/contracts/src/index.ts`; `packages/observability/src/index.ts`; `packages/server/src/{bootstrap-enrollment.ts (new),errors.ts,index.ts}`; `apps/api-node/src/{bootstrap.ts (new),index.ts,abuse-admission.ts}`; `apps/api-cloudflare/src/index.ts`; `tests/fixtures/account-worker.ts`; `tests/{postgres,workerd}/bootstrap-route.test.ts` (new); [API conventions](../../API-CONVENTIONS.md), [AUTH-FLOWS](../../AUTH-FLOWS.md) and the development README.
- Verification: Node 24.21.0 — full matrix passed: unit/contract 111/111, node 50/50, workerd 115/115, isolated PostgreSQL 18.6 60/60 (the new suites contribute 4 PostgreSQL and 2 workerd cases covering success, wrong code, cross-origin, code-free 503, second-enrollment closure, staff row/credential assertions, readiness state transitions and staff login); both typechecks, lint/boundaries, build, both Drizzle histories, secret scan, docs build, whole-tree format and diff whitespace passed. No deployed behavior is claimed; the Workers Secret and Node file are documented but not provisioned anywhere.
- Decisions and deviations: Single-shot atomicity uses the conditional-insert/FK-rollback pattern per dialect (D1 batch; PostgreSQL row-count transaction) rather than a schema constraint, preserving multiple active Staff for later role management. The route reuses the `registration` rate category per AUTH-FLOWS instead of inventing a bootstrap category. No audit write: the enrollment event's audit portion falls under the standing suspension and stays unclaimed.
- Blockers/open questions: None for this item; Staff role/permission assignment (project roles) remains 04.3 scope.
- Next actions: Implement 04.1d (finish password registration/login/recovery and the non-SSO Staff passkey path).
- Next-session cautions: The enrollment code is a deployment secret — never commit one; keep `bootstrapPending` free of code detail; do not relax the generic denial to distinguish wrong-code from staff-exists.

### 2026-09-30 — 04.1d (partial): single-use recovery codes

- Scope and checklist IDs: 04.1d recovery portion (the AUTH-FLOWS no-email recovery path); the non-SSO Staff passkey path and the item's acceptance remain open, so 04.1d stays unchecked.
- Progress: `POST /auth/recovery-codes` generates a ten-code single-use set for the signed-in identity (plaintext returned once; versioned keyed digests stored; regeneration replaces the generation atomically), and `POST /auth/recover` redeems one code — same-origin check, `password-reset`-category account/IP admission, optional configured CAPTCHA (`password-reset` action), decoy verification for unknown handles, atomic single-use consumption, revision-checked password replacement and revocation of every active session of the principal. The generic 403 `RECOVERY_DENIED` covers unknown handle, wrong/used/stale code and revision races. New dual-dialect additive migration `0012_recovery_codes` (D1) / `0011_recovery_codes` (PostgreSQL) with mirrored Drizzle schema entries; `currentAccountSession` now also returns the session's identity; `AccountSessionStore` gained `revokeAllForPrincipal`; the fixture worker gained session/key/recovery/password wiring.
- Change summary: New `AccountRecoveryStore` port + both adapters, new server recovery module, two routes, contracts, observability labels, error codes, root wiring, migration + schemas, fixture wiring, two focused route suites, and documentation synchronization.
- Files/artifacts: `packages/application/src/account-recovery.ts` (new) + session-port extension; `packages/database/{d1,postgres}/src/account-recovery.ts` (new), `account-session.ts` updates and `migrations/001{2,1}_recovery_codes.sql` + journals + schema entries; `packages/server/src/account-recovery.ts` (new), `errors.ts`, `index.ts`; `packages/contracts/src/index.ts`; `packages/observability/src/index.ts`; both roots; `tests/fixtures/account-worker.ts`; `tests/{postgres,workerd}/recovery-route.test.ts` (new); migration-position updates in `tests/{postgres/workerd}` suites; [API conventions](../../API-CONVENTIONS.md), [AUTH-FLOWS](../../AUTH-FLOWS.md), [DATA-MODEL](../../DATA-MODEL.md).
- Verification: Full matrix — unit/contract 111/111, node 50/50, workerd 116/116, isolated PostgreSQL 18.6 61/61 (new suites: 1 PostgreSQL and 1 workerd journey each covering generation, digest-only storage, wrong/unknown/reuse/stale denials, password change, old-session revocation and new-password login); both typechecks, lint/boundaries, build, both Drizzle histories, secret scan, docs build, format and diff checks. One intermittent workerd failure appeared in a single full-matrix run and passed on every standalone and repeated full rerun; not reproduced or diagnosed further.
- Decisions and deviations: Sequential code verification with inline lint disables is deliberate (early match without parallel timing signals); generation replacement uses delete-then-insert transactions so exactly one generation is ever active; consumption precedes password replacement so a racing redemption can never keep a spent code.
- Blockers/open questions: None for this slice; the passkey path needs the WebAuthn design batch.
- Next actions: Complete 04.1d with the non-SSO Staff passkey path; then 04.1e.
- Next-session cautions: Recovery codes are bearer secrets — never log or persist plaintext outside the single response; the local D1 still has migrations 0000–0008 pending (0009–0012 apply remotely only through authorized test flows); preserve the immutable migration journals.

### 2026-09-30 — 04.1d accepted: passkey path completes step 04.1

- Scope and checklist IDs: **04.1d accepted** (password registration/login were already finished from the Phase 03 dependency; the recovery-code batch landed earlier this session; this batch adds the passkey path). Step 04.1 is complete.
- Progress: Passkey registration and discoverable login are implemented on both profiles with the pinned `@simplewebauthn/server` 14.0.3 (Context7-researched, dual-runtime). Session-authenticated registration issues discoverable-credential options with required user verification and a single-use stored challenge bound to the session identity; verification enforces challenge, origin, RP ID and user verification and persists only public material (COSE key, counter, transports, device/backup state, AAGUID). Public login options store an anonymous single-use challenge; login verifies the assertion, advances the replay counter (clone-regressed counters deny), rate-admits under the `login` category keyed by credential id + trusted IP with the `login` CAPTCHA action, and issues the first-party session through the shared revision-bound issuance — so a password change still invalidates passkey-issued sessions. New dual-dialect migration `0013_webauthn` (D1) / `0012_webauthn` (PostgreSQL) adds `passkey_credentials` and `webauthn_challenges` with mirrored Drizzle schemas; `AccountPasswordStore` gained an identity-scoped lookup and `currentAccountSession` an identity-bearing record. A test-only software authenticator (fmt `none` registration, ECDSA P-256 DER assertions, minimal CBOR encoder) drives real ceremonies without a browser.
- Change summary: New port + adapters + server module + four routes + contracts/labels/error codes + both-root and fixture wiring + the pinned dependency and oxlint boundary allowance + two route suites + migration-position updates in existing suites + documentation.
- Files/artifacts: `packages/application/src/passkey-store.ts` (new); `packages/database/{d1,postgres}/src/passkey-store.ts` (new) + `account-registration.ts` identity lookup; `migrations/001{3,2}_webauthn.sql` + journals + schemas; `packages/server/src/passkey.ts` (new), `account-session.ts`, `account-password.ts`, `errors.ts`, `index.ts`; `.oxlintrc.json`; `packages/server/package.json`; both roots; `tests/fixtures/{account-worker,fake-authenticator}.ts`; `tests/{postgres,workerd}/passkey-route.test.ts` (new); [API conventions](../../API-CONVENTIONS.md), [AUTH-FLOWS](../../AUTH-FLOWS.md), [DATA-MODEL](../../DATA-MODEL.md), [SOURCES](../SOURCES.md).
- Verification: Full matrix — unit/contract 111/111, node 50/50, workerd 117/117, isolated PostgreSQL 18.6 62/62, including the two new passkey ceremony suites (registration, discoverable login, session read, challenge replay denial); typechecks, lint/boundaries, build, both Drizzle histories, secret and license scans, docs build, format and diff checks. Two ceremony-fixture defects (CBOR negative-integer encoding, raw-vs-DER ECDSA signature) and one consume-semantics conflation (anonymous challenge identity) were found by the tests and fixed before the recorded passing runs.
- Decisions and deviations: Passkeys are available to every local-password identity (Staff and User) rather than Staff-only — narrower than the item's minimum, consistent with SECURITY §34 (Public User MAY, Staff SHOULD). Passkey login sessions stay credential-revision-bound by design. The dependency is pinned exactly (14.0.3) and allowed only in `packages/server` by the lint boundary.
- Blockers/open questions: Session records do not yet carry an assurance level; the resolver-side enforcement belongs to 04.3. Browser-driven ceremonies (resident-credential UX) await the backend-owned authorization pages in 04.2d.
- Next actions: 04.1e (minimum-tier account documentation in AUTH-FLOWS) and 04.2g (instance capability document), then the 04.2 protocol work.
- Next-session cautions: The fake authenticator is test-only; never ship it. Migration journals are immutable; local D1 still has 0009–0013 pending. The passkey config is all-three-or-none — do not partially enable.

### 2026-09-30 — 04.1e and 04.2g accepted: tier documentation and instance document

- Scope and checklist IDs: **04.1e and 04.2g accepted**; with 04.1 complete, the ordered remaining scope is 04.2a–04.2f.
- Progress: AUTH-FLOWS gained the minimum-tier account-mechanism section — PBKDF2 password surface with the measured 50k/100k policy and the floor-unmet password disablement, passkeys and recovery codes as the recommended path, no-email administrator-assisted recovery, the PBKDF2 assurance degradation and the Argon2id migrate-or-reset downgrade rule — and `GET /api/v1/instance` now serves the stable unauthenticated capability document on both profiles with a closed contract whose password flags cannot advertise the tier's floor-disabled login.
- Change summary: The endpoint (contracts, server route, observability label, both-root-independent computation from composed state, two focused route cases) was implemented by a delegated implementation subagent and reviewed in-tree; the documentation and checklist/progress updates are this session's.
- Files/artifacts: `packages/contracts/src/index.ts`, `packages/observability/src/index.ts`, `packages/server/src/index.ts`, `tests/postgres/bootstrap-route.test.ts`, `tests/workerd/passkey-route.test.ts`, [AUTH-FLOWS](../../AUTH-FLOWS.md), [API conventions](../../API-CONVENTIONS.md), the module checklist and this record.
- Verification: Full matrix — unit/contract 111/111, node 50/50, workerd 118/118, isolated PostgreSQL 18.6 63/63 (the two new instance cases included); typechecks, lint/boundaries, build, secret scan, docs build and format checks pass. The endpoint's `limits.documented` anchor was verified against the real FREE-TIER-PROFILE section heading rather than the plan's example string.
- Decisions and deviations: Password capability advertisement is gated on the standard Argon2d algorithm specifically so a future enabled-but-floor-limited tier cannot claim password login; the instance document is computed once at composition because every input is static per deployment.
- Blockers/open questions: None; the OpenAPI consolidation stays with 10.1a and the SPA consumption with 11.1g as planned.
- Next actions: 04.2a — Authorization Code + PKCE S256 with ≤60 s single-use codes and the client registry configuration.
- Next-session cautions: The instance document is a capability contract, never an authorization decision; do not derive permissions from it.

### 2026-09-30 — 04.2a and 04.2b accepted: authorization-code flow and opaque tokens

- Scope and checklist IDs: **04.2a and 04.2b accepted**; the JSON authorization-service page wrappers (04.2d) and bearer-authenticated route owners (04.2e) remain open.
- Progress: The Authorization Code + PKCE S256 core is implemented on both profiles. `POST /auth/authorize` (same-origin, session-authenticated) matches the deployment client registry exactly — client id, redirect URI (https, or loopback for local tests, fragment-free) and scope containment — and stores a keyed-digest code (`<uuid>.<hb1_ secret>`, 60-second CHECK-bounded lifetime) bound to client, redirect, scope, challenge and the session's principal/identity. `POST /auth/token` (the boundary's only form-encoded endpoints, via a bounded `readBoundedForm` carve-out) consumes the code atomically before verification — a wrong verifier burns it — verifies S256 with a double-hash constant-time comparison, checks the exact client/redirect binding and issues the opaque `at_` token (256-bit secret, keyed digest context-bound to the token id, 600-second CHECK-bounded lifetime) with `{ tokenType, accessToken, expiresIn, scope }`. `POST /auth/token/revoke` implements RFC 7009 semantics (always 204 for unknown/expired/revoked; fail-closed only on dependency failures) with primary-backed revocation. Both token endpoints rate-admit under the `login` category (client-id/token-id account dimension + trusted IP, `login` CAPTCHA action). The implementation was produced by a delegated subagent against the AUTH-FLOWS specification and independently reviewed and re-verified in-tree; its recorded deviations (revoke account dimension from the presented token id, registry caps 16 clients and a strict scope charset, loopback http allowance, an extra token-expiry index, URLSearchParams encoding, consume returning the stored challenge, empty registry equal to unconfigured) were each inspected and accepted.
- Change summary: New dual-dialect migration 0014 (D1) / 0013 (PostgreSQL) with mirrored schemas and journals; `OAuthCodeStore`/`OAuthAccessTokenStore` ports with both adapters; server oauth module, error codes, form parsing; contracts; observability labels; both-root registry/store wiring with all-or-nothing startup refusal; fixture wiring; two route suites; migration-position updates.
- Files/artifacts: See the module checklist acceptance notes; [API conventions](../../API-CONVENTIONS.md), [AUTH-FLOWS](../../AUTH-FLOWS.md), [DATA-MODEL](../../DATA-MODEL.md), [SOURCES](../SOURCES.md) (Elysia onParse lookup record).
- Verification: Independently re-run full matrix — unit/contract 111/111, node 50/50, workerd 119/119, isolated PostgreSQL 18.6 64/64 (the two new oauth suites cover wrong-verifier burn, correct exchange, replay denial, revoke idempotence and digest-only storage); typechecks, lint/boundaries, build, both Drizzle histories, secret scan, docs build, format and diff checks.
- Decisions and deviations: Consume-before-verify is deliberately stricter than the RFC minimum (prevents verifier brute-force); the token endpoints exempt the same-origin check because possession of the code/PKCE verifier (not cookies) is the credential, while the authorize endpoint keeps the same-origin mutation check.
- Blockers/open questions: The authorize endpoint currently answers JSON (the 04.2d HTML consent/login pages wrap it); business-API bearer enforcement arrives with 04.2e route owners.
- Next actions: 04.2c rotation assessment, then 04.2d authorization-service pages (guides pre-fetched).
- Next-session cautions: The client registry is deployment configuration — never register a wildcard; codes and tokens are bearer secrets, never logged; migration journals immutable.

### 2026-09-30 — 04.2d accepted: backend-owned authorization pages

- Scope and checklist IDs: **04.2d accepted**; the JSON authorize endpoint from 04.2a remains for API-driven clients.
- Progress: `GET /auth/authorize` renders the server-side login form (no session) or consent page (current session) after registry validation — unknown clients, redirect URIs or scopes render an error page on the authorization origin, never a redirect. `POST /auth/authorize/login` (form-encoded, same-origin) runs the shared login admission and password verification, sets the first-party session cookie and issues the code directly from the just-authenticated session facts (a new `issueCodeForSession` split avoids re-reading a cookie the response has not yet delivered); `POST /auth/authorize/consent` (session-authenticated) issues the code the same way; both redirect (302, explicit Response) to the exact registered callback with `code` and `state`. `loginAccount` now returns the session facts alongside the cookie. The pages follow the retrieved guides (`forms`, `accessible-error-announcement`): semantic forms with fieldsets, visible labels, aria-describedby hints, aria-live/role=alert error regions, lang attribute, UA-default focus outlines, no inline styles and no scripts except the Turnstile loader when CAPTCHA is configured; CSP is `default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`, widened only for challenges.cloudflare.com when the widget is present (the loader is not SRI-pinnable by provider design — the exact-origin script-src pin is the control, recorded against the security-guidance lint finding).
- Change summary: New `authorize-pages.ts` renderer, three routes, form-parse carve-out extension, the issuance split in oauth.ts, session-fact return from login, label widening, and two browser-flow suites (PostgreSQL and workerd) covering the error page, login-page accessibility markers, wrong-password re-render, 302 with cookie, code exchange, consent page and consent-issued code.
- Files/artifacts: `packages/server/src/{authorize-pages.ts (new),oauth.ts,account-login.ts,index.ts}`, `tests/{postgres,workerd}/oauth-route.test.ts`, [API conventions](../../API-CONVENTIONS.md), [AUTH-FLOWS](../../AUTH-FLOWS.md), the module checklist and this record.
- Verification: Full matrix — unit/contract 111/111, node 50/50, workerd 120/120, isolated PostgreSQL 18.6 65/65 (both new browser-flow cases); typechecks, lint/boundaries, build, both Drizzle histories, secret scan, docs build, format and diff checks. Two fixture findings fixed en route: workerd requires pair-only cookie headers, and a shared client id exhausts the login-category account bucket across journeys (the page journey uses its own registered client).
- Decisions and deviations: Pages render with no client framework and no inline styles (CSP-strict); the login POST issues the code from session facts rather than a follow-up session read.
- Blockers/open questions: None; the consent page does not yet display the account handle (the session record carries ids, not the handle) — cosmetic, deferred.
- Next actions: 04.2e bearer-authenticated route owners with recent-authentication enforcement; 04.2c/04.2f assessments.
- Next-session cautions: Never widen the page CSP beyond the CAPTCHA origin; never redirect authorization failures to client-provided URIs.

### 2026-09-30 — 04.3d accepted; 04.3a non-audit modeling assessed

- Scope and checklist IDs: **04.3d accepted**; 04.3a's non-audit portion assessed complete (the audited linking portion stays suspended, so the item remains unchecked).
- Progress: The provider-contract section in [AUTH-FLOWS](../../AUTH-FLOWS.md) records the implemented CAPTCHA contract and the specified SSO contract for module 16; Core's zero-plugin operation is proven on both profiles by every existing account route. 04.3a's modeling inventory: separate principal kinds, operator-channel Staff enrollment, identity uniqueness preventing email-based linking, staff-aware login/credential/session paths.
- Change summary: Documentation and checklist notes only.
- Files/artifacts: [AUTH-FLOWS](../../AUTH-FLOWS.md), the module checklist, this record.
- Verification: Documentation-only increment; the docs build passed with the batch that follows it.
- Decisions and deviations: None beyond the recorded suspension.
- Blockers/open questions: The audited account-linking mechanism waits for the audit resume decision.
- Next actions: 04.2e (delegated, in flight), then the 04.3b/04.3c role-and-account batch.
- Next-session cautions: SSO claims never bypass local grants; provider absence never weakens a route.

### 2026-09-30 — 04.2e accepted: bearer authentication for business APIs

- Scope and checklist IDs: **04.2e accepted**; the remaining step-04.2 items are the 04.2c/04.2f assessments.
- Progress: `authenticateBearer` implements bearer-only authentication — the opaque `at_` token locates its authoritative row, the secret is verified against the stored keyed digest under the exact issuing context, and every missing/malformed/unknown/revoked/expired/mismatched credential answers one generic 401 `AUTHENTICATION_REQUIRED` (closed 503 `AUTHENTICATION_UNAVAILABLE` only on dependency failure, following the catalog's DENIED/UNAVAILABLE pairing). `GET /api/v1/account` is the first business consumer: cookies are rejected as credentials (proven by a cookie-only 401 case), no Origin is required (the no-Origin client case of 04.V4), the principal kind is enforced against the active row, and the response is no-store `{principalId, identityId, kind}`. Implemented by a delegated subagent, reviewed in-tree; it also found and fixed a real regex-anchor concatenation defect in the bearer pattern.
- Change summary: New `bearer-auth.ts`, the account route with its `account.account` label, `AUTHENTICATION_REQUIRED`/`AUTHENTICATION_UNAVAILABLE` error codes, `loadPrincipalKind` on the token store with both adapters, the `AccountDocument` contract, and five new assertions per oauth suite.
- Files/artifacts: `packages/server/src/{bearer-auth.ts (new),index.ts,errors.ts}`, `packages/application/src/oauth-code-store.ts`, `packages/database/{d1,postgres}/src/oauth-store.ts`, `packages/contracts/src/index.ts`, `packages/observability/src/index.ts`, `tests/{postgres,workerd}/oauth-route.test.ts`, [API conventions](../../API-CONVENTIONS.md), [AUTH-FLOWS](../../AUTH-FLOWS.md), the module checklist and this record.
- Verification: Independently re-run full matrix — unit/contract 111/111, node 50/50, workerd 120/120, isolated PostgreSQL 18.6 65/65; typechecks, lint/boundaries, build, secret scan, format and diff checks.
- Decisions and deviations: The second error code (503 pairing) was the subagent's justified addition; `/api/v1/account` currently carries no admission (recorded asymmetry versus the session-read route's approximate bucket — a parity decision for the staging budget milestone); recent-authentication stays with the shared guard per AUTH-FLOWS.
- Blockers/open questions: None.
- Next actions: The 04.3b/04.3c role-and-account batch; then the 04.2c/04.2f assessments and the V acceptance items.
- Next-session cautions: Never accept cookies as business-API credentials; keep the 401 envelope generic.

### 2026-10-01 — 04.3b and 04.3c accepted: roles, object checks and account administration

- Scope and checklist IDs: **04.3b accepted; 04.3c accepted in its non-audit scope** (the audit portions of the management APIs remain suspended and unclaimed per the standing instruction). With this, every Module 04 implementation item is accepted except the 04.2c/04.2f assessments.
- Progress: The `project_roles` store (atomic grant/replace on the composite key, revoke, role loading, administrator anchors) backs a primary-store `AuthorizationFacts` resolver that feeds the shared `requireAuthorizedAction` guard: principal kind/status/credential activity, project visibility/state, membership role and token issuance all come from current server state, never client claims. The ceremony mapping is server-side and matches the SECURITY-FOUNDATION contract — password is assurance 1; a passkey login with required user verification carries assurance 2 while within the fifteen-minute recent-authentication bound, so password-issued tokens answer sensitive administration with `REAUTHENTICATION_REQUIRED` until the administrator steps up (proven by the passkey step-up journey in both suites). New APIs: session listing and owned revocation, project member grant/replace/revoke (User principals can never hold roles — membership never converts a User into Staff), principal suspend/activate with last-active-staff protection and immediate token/session denial for suspended principals. The bootstrap administrator's initial project role is seeded out of band; every later grant goes through the guarded API.
- Change summary: New `ProjectRoleStore` and `AccountAdministrationStore` ports with both adapters, the DB facts resolver with the guard policy, the `revokeOwned`/`listActiveByPrincipal` session extensions, five routes with labels, contracts, root/fixture wiring, and two full management suites (including the step-up journey).
- Files/artifacts: `packages/application/src/{project-role-store,account-administration}.ts` (new) + session-port extensions; `packages/database/{d1,postgres}/src/{project-role-store,account-administration}.ts` (new) + session adapters; `packages/server/src/{authorization-facts.ts (new),index.ts}`; contracts; observability; both roots and the fixture worker; `tests/{postgres,workerd}/roles-route.test.ts` (new); [API conventions](../../API-CONVENTIONS.md), the module checklist and this record.
- Verification: Full matrix — unit/contract 111/111, node 50/50, workerd 121/121, isolated PostgreSQL 18.6 66/66 (the two new suites each cover sessions, password-token reauthentication-required, passkey step-up, user-grant prohibition, role replacement, suspension denial, last-staff protection, activation recovery and member removal); typechecks, lint/boundaries, build, both Drizzle histories, secret scan, docs build, format and diff checks. One intermittent workerd failure appeared in one parallel full run and passed on every standalone and repeated rerun (same load-sensitive pattern as previously recorded).
- Decisions and deviations: The delegated implementation subagent hit an external usage limit mid-batch; this session completed the root/fixture wiring, the tests and the acceptance in-tree (three type defects and a duplicated-options merge artifact from the interruption were fixed first). The assurance/authenticatedAt facts derive from the passkey ceremony stamp and token issuance as the agent designed — reviewed against the sensitive-rule evaluation order (role check precedes the step-up check).
- Blockers/open questions: The resource `permissionGranted` hook stands open for module 06 feature predicates by design; the audited variants of the management APIs wait for the audit resume decision.
- Next actions: The 04.2c/04.2f assessment records, then the 04.V1–V4/V6 executable acceptance evidence.
- Next-session cautions: The bootstrap administrator's seeded role is deployment policy, not an API path; never lower the sensitive assurance floor; keep management 403 envelopes generic.

### 2026-10-01 — 04.2c and 04.2f accepted by recorded assessment

- Scope and checklist IDs: **04.2c and 04.2f accepted**; with these, every Module 04 implementation checklist item is accepted (audit portions of 04.3a/04.3c remain suspended and unchecked by instruction).
- Progress: 04.2c — the cookie contract, CSRF defenses, idle/absolute expiry and fixation protection are implemented and regression-covered since the Phase 03 dependency; the rotation mapping over every trigger that exists on the implemented surface is recorded (login/step-up mint fresh identifiers; recovery revokes outright; no in-session password change exists), with the SECURITY §18 triggers that would attach to a future cookie-session management surface recorded as standing invariants. 04.2f — the enabled (no-email) feature set's reset path is the single-use recovery-code journey with atomic single-use consumption, enumeration-resistant generic denials, timing-parity decoys and full session revocation; the email-channel token variant belongs to the module 16 plugin and must reuse the same contract, recorded as a standing requirement.
- Change summary: Checklist acceptance notes only; no code changed.
- Files/artifacts: The module checklist; this record.
- Verification: Documentation-only increment; docs build passed with the batch that follows.
- Decisions and deviations: Both acceptances are scope assessments over already-verified behavior, not new evidence claims; the standing invariants (rotate on privilege/role change for any future cookie-session management; email tokens reuse the single-use contract) are explicit so no future surface silently misses them.
- Blockers/open questions: None.
- Next actions: The 04.V1–V4/V6 executable acceptance evidence.
- Next-session cautions: A future cookie-session management API must rotate on the recorded triggers before it ships.

### 2026-10-01 — Acceptance: 04.V1–04.V4 and 04.V6's executable parts; module complete

- Scope and checklist IDs: **04.V1, 04.V2, 04.V3 and 04.V4 accepted; 04.V6's executable parts accepted with the tier-journey remainder recorded on the activation path (item stays unchecked); 04.V5 stays suspended.** With this, Module 04 is compliantly complete within the goal's boundary: every non-suspended checklist and acceptance item is closed on both profiles' evidence.
- Progress: The [acceptance evidence](../evidence/04-acceptance-validation.md) records the full journey matrix — harness flows on both profiles, the real-Chrome fixture on separate origins (with the automation browser's cross-origin post-form redirect refusal recorded as an automation limitation; the completed same-origin browser journey through token issuance and the session-driven consent re-issue), every negative protocol case including a real 61-second code expiry, the principal-class and role-behavior matrix with passkey step-up, the no-Origin/evil-Origin pair, and the capability-document/enforcement agreement. The V2/V3 additions landed as a third oauth journey and a second roles journey with their own registered clients (rate-bucket isolation).
- Change summary: Two new test journeys, the acceptance evidence file, checklist/status updates and this record. The V1 fixture scaffolding stays ignored under `.local/v1-browser/`.
- Files/artifacts: `tests/postgres/{oauth,roles}-route.test.ts`, [acceptance evidence](../evidence/04-acceptance-validation.md) (new), the module checklist, this record and master progress.
- Verification: Full matrix — unit/contract 111/111, node 50/50, workerd 121/121, isolated PostgreSQL 18.6 68/68 (the two new journeys included; the 61-second expiry case is a real wait, timeout-raised and honestly labelled); typechecks, lint/boundaries, build, both Drizzle histories, secret scan, docs build, format and diff checks. The browser fixture ran against the live Node root on the private cluster with exact teardown.
- Decisions and deviations: 04.V6 stays unchecked because the tier journey cannot run while the tier is startup-disabled under the goal's boundary — the executable capability-document portion is accepted, the remainder is explicitly on the activation path (13.G6). `state` verification is recorded as the SPA's client-side obligation per AUTH-FLOWS.
- Blockers/open questions: None within this module. The G1 audit-governance decision (resume vs deferral+ADR for the suspended audit portions across modules 04–09) is now the only blocker to G1 readiness and is presented to the user per the goal's completion definition.
- Next actions: None in this module under the current goal; the suspended audit portions and the tier activation path await user decisions.
- Next-session cautions: The automation-browser limitation must not be cited as a server defect; the `.local/v1-browser` fixture is scratch; the module's standing invariants (User/Staff separation, no SPA token persistence, generic denials) remain binding for later modules.
### 2026-10-01 — Module 04 review: over-defense and complexity pass
- Scope and checklist IDs: Read-only `/code-review max` over the module 04 range `aa6795a..c39473c` (19 commits) with an additional focus on unnecessary complexity and over-defensive programming; no checklist item changed.
- Progress: Review complete: 2 behavioral defects, 1 dead debug no-op, and 12 high-confidence simplification findings. The defects: the `jsonTelemetry` route allowlist omits `account.account`, so all `/api/v1/account` traffic serializes as `unmatched`; and the backend-owned authorize pages never validate `response_type`/`code_challenge_method` although the doc comment claims upstream schema enforcement. The no-op is a forgotten debug probe in `passkey.ts` login. The simplifications: four zero-caller exports (`bearerScope`, `validatePrincipalAdministrationId`, `loadPasswordCredentialByIdentity`, the `issueAccountSession` forwarding alias); duplicated helpers (`enrollmentCodeMatches` vs `constantTimeEquals`; staff-role lists maintained in four places against `projectStaffRoles`/`isProjectStaffRole`; ~30 lines of passkey env parsing copy-pasted across both app roots with drift; private `assertUuid`/`assertInstant` re-implementations at four diverging strictness levels); a third validation layer in `createDbAuthorizationResolver` over invariants already guaranteed by DB CHECKs and adapter returns; the unreachable `'deleted'` variant of `ProjectVisibilityFacts.state` (schema CHECKs allow only active/archived); two always-false guards (`parsed.length < 0` in `oauth.ts`, `!Number.isInteger(digests.length)` in account-recovery); and inline duplication of `requireActivePrincipalKind` (plus `oauthQueryFields` and the consent session re-read) in `server/index.ts`.
- Change summary: None to code; this progress record only.
- Files/artifacts: Key finding sites: `packages/observability/src/index.ts`, `packages/server/src/{oauth,passkey,bearer-auth,account-password,account-session,authorization-facts,bootstrap-enrollment,index}.ts`, `packages/application/src/{account-administration,account-recovery}.ts`, both database adapters' stores, and both app roots.
- Verification: Re-verified against current HEAD in the recording session: both behavioral defects, the debug no-op, the three zero-caller exports (repo-wide grep), the always-false `parsed.length < 0` guard, and the `validateAuthorizeQuery` field coverage. The remaining duplication claims come from the review agent's grep-verified report and were not independently re-checked.
- Decisions and deviations: None; findings are not yet triaged.
- Blockers/open questions: Whether the telemetry and authorize-validation defects require revisiting the just-recorded module 04 acceptance evidence.
- Next actions: Triage the findings; fix accepted ones under the development skill (smallest simplification per site); add `account.account` to the `jsonTelemetry` allowlist.
- Next-session cautions: Re-verify each review-agent claim at its site before editing; do not delete the redundant validation layers unless the adapter contracts remain the single enforcement point.
### 2026-10-01 — Module 04 review cross-check (simplify angles)
- Scope and checklist IDs: Second read-only pass (`/simplify` angles: reuse, simplification, efficiency, altitude) over the same `aa6795a..c39473c` range; no checklist item changed; no code modified.
- Progress: Two new findings. (1) The route-label universe is maintained in three manually synchronized places — the `RouteLabel` union, the 54-line nested-ternary chain at `server/index.ts:477-530`, and the `jsonTelemetry` allowlist — and the previously reported missing `account.account` entry is the realized sync failure; derive all three from one frozen label array. (2) Constructor-time re-validation of app-root-provided config (`server/index.ts:341-352`) duplicates the roots' env-parser guarantees (same triple-layer pattern as the resolver finding; secondary confidence). Negative results worth keeping: the systematic export-caller audit found no dead exports beyond the four already reported; the five `validate*Insert/Input` application validators are called by both adapters and are the layer to keep when deleting the resolver re-validation; all four consecutive-await sites in the server are security-ordered (lockout before captcha, decoy-digest timing equalization, captcha before challenge consumption) and must not be parallelized.
- Change summary: None to code; this progress record only.
- Files/artifacts: This record; evidence: `server/index.ts` slices 320-402/460-530/695-775, repo-wide symbol greps, await-pair contexts.
- Verification: All claims in this entry re-verified directly in the recording session (file reads plus repo-wide greps).
- Decisions and deviations: The `/simplify` apply-fixes phase was skipped per the user's explicit "do not modify code" instruction.
- Blockers/open questions: None new.
- Next actions: Merge findings N1/N2 into the pending triage; route-label unification is the structural fix behind the telemetry defect.
- Next-session cautions: Security-ordered awaits must not be parallelized by later efficiency cleanups.
### 2026-10-01 — Review findings triaged and fixed; decisions A/a landed

- Scope and checklist IDs: Post-acceptance defect-fix increment over the two 2026-10-01 review passes (17 findings on `aa6795a..c39473c`); every finding fixed or recorded as skipped below. No checklist item was reopened: 04.V2 carries the authorize-side addendum annotation per decision a, and the acceptance evidence gained its [addendum](../evidence/04-acceptance-validation.md). Decisions A and a are both landed.
- Progress: Five batches, one commit each. (1) `facb87b` — `ROUTE_LABELS` in `@hyperbug/observability` is the single frozen source for the `RouteLabel` type, the server's route matching (now an ordered typed table replacing the 54-line ternary chain) and the `jsonTelemetry` allowlist, so the missing `account.account` gap is structurally impossible; the passkey debug no-op is gone. (2) `372327c` — decision A: `validateAuthorizeQuery` enforces `response_type === 'code'` and `code_challenge_method === 'S256'` after the registry check, every issuance path re-checks them, `AuthorizeRequestSchema` carries both fields through, and `AuthorizeProtocolFailure` rejections of a verified client/redirect redirect back to the verified redirect URI with the RFC 6749 §4.2.2.1 / RFC 7636 §4.4.1 error plus state on GET, login POST and consent POST (the consent path previously ran no explicit validation at all) before any credential work; API-CONVENTIONS/AUTH-FLOWS synchronized, the false "enforced by the request schema upstream" comment corrected, and both profiles gained rejection-path regressions (JSON 400 with zero stored codes; page 302 error redirects with no code and no cookie) with the positive journeys unchanged. (3) `ca9fc66` — the four zero-caller exports (`bearerScope`, `validatePrincipalAdministrationId`, `loadPasswordCredentialByIdentity`, `issueAccountSession`) are deleted; the one caller now uses `issueSessionCookieFor` directly. (4) `dd1d97f` — the staff role set converges on `projectStaffRoles`/`isProjectStaffRole` (both adapters' `validRole` and the resolver), `enrollmentCodeMatches` is replaced by the now-shared `constantTimeEquals`, and the two app roots' drifted passkey env parsing becomes `parsePasskeyConfiguration` in the server package. (5) `d1abab8` — the resolver's third shape layer is removed (application `validate*Insert/Input` plus DB CHECKs and adapter mappings verified as the existing layers; only the semantic null-issuance fail-closed stays), `ProjectVisibilityFacts` narrows to the two states its CHECK allows, the adapters' private `assertUuid`/`assertInstant` become `@hyperbug/domain` asserts, both always-false guards are deleted, `/api/v1/account` reuses `requireActivePrincipalKind`, and the server reuses authorize-pages' exported field table.
- Change summary: See the five commits `facb87b`, `372327c`, `ca9fc66`, `dd1d97f`, `d1abab8` (plus `945f284` committing the two review records themselves). No migrations, no new dependencies, no route additions or removals.
- Files/artifacts: `packages/observability/src/index.ts`; `packages/contracts/src/index.ts`; `packages/server/src/{index,oauth,authorize-pages,passkey,bearer-auth,account-session,account-password,account-login,authorization-facts,bootstrap-enrollment}.ts`; `packages/application/src/{account-administration,account-recovery}.ts`; `packages/database/{d1,postgres}/src/{project-role-store,oauth-store}.ts`; `apps/api-{node,cloudflare}/src/index.ts`; `tests/{postgres,workerd}/{oauth,roles}-route.test.ts`; `docs/{API-CONVENTIONS,AUTH-FLOWS}.md`; `docs/plan/evidence/04-acceptance-validation.md`; the module checklist and this record.
- Verification: Node 24.21.0. Per batch: both typechecks, oxlint/boundaries and format passed; full local matrix green at every batch — unit+contract 111 (110+1), node 50, workerd 121, isolated PostgreSQL 18.6 68 — with `docs:build` and `git diff --check` additionally green for batch 2's documentation changes. One honest failure: batch 5's first run deleted the `captchaSiteKey` constructor check and `tests/node/http.test.ts` failed 49/50 on the existing regression case; the check was restored after on-site review (see decisions) and the suite returned to 50/50. The audit evidence JSONs that `test:postgres` rewrites were restored to their committed values after each run. A read-only independent review pass over `c39473c..d1abab8` (fork subagent, 2026-10-01) reported no defects: the error redirect is only ever reachable after exact registry redirect matching, the route-label table matches the old ternary chain rule for rule, the serialized security awaits are untouched, and both noted nits (session check ordering on the JSON authorize path; missing-field queries rendering the error page rather than redirecting an unverified redirect URI) were verified acceptable with reasons.
- Decisions and deviations: Decision A implemented as specified (enforcement in `validateAuthorizeQuery` plus issuance-path re-checks; schema fields are pass-through, not literal-enforced, keeping one enforcement point). Decision a implemented as the addendum + 04.V2 annotation, no acceptance item reopened. Skipped with reasons: (i) the security package's own `StaffRole` list stays — `@hyperbug/security` has zero dependencies and cannot import `@hyperbug/application`; the mirroring is already documented in `project-role-store.ts`. (ii) The `captchaSiteKey` constructor re-validation stays — it is covered by an existing regression case and direct `createApp` consumers (the proof fixture) bypass the roots' parser guarantees, so it is not a pure duplicate. (iii) The consent path's second session read stays — outside the goal's batch list, behavior is correct, and removing it would need a wider refactor of `issueAuthorizationCode`. The four security-ordered awaits were verified untouched (sequential lockout→captcha, recovery decoy equalization, captcha→challenge consume).
- Blockers/open questions: None new; the G1 audit-governance decision (resume vs deferral+ADR for suspended audit portions) remains the only open blocker and stays with the user.
- Next actions: None in this module under the current goal boundary; the suspended audit portions and the Free-tier activation path await user decisions.
- Next-session cautions: Route labels now have exactly one source — add new routes to `ROUTE_LABELS` and the typed table, never to a local list. The authorize protocol literals are enforced in `requireSupportedAuthorizeProtocol` (oauth.ts) for every path; any new authorize surface must call it before issuance. `AuthorizeProtocolFailure` redirects only to the registry-verified redirect URI — never widen it to client-supplied values. `ProjectVisibilityFacts.state` has no 'deleted'; a deleted project is a missing row. The `.local` scratch and the protected root `SECURITY.md` draft remain uncommitted by instruction.
### 2026-10-01 — Audit portions resumed and the Free-tier journey accepted; module complete

- Scope and checklist IDs: **04.3a, 04.3c, 04.V5 and 04.V6 accepted** (audit portions resumed by the user's 2026-10-01 instruction together with the Free-tier journey). Every Module 04 checklist and acceptance item is now closed; the module is Complete.
- Progress: (1) Audit trail — the closed catalog gained the identity/administration events with a `core.identity` system actor; every audited mutation (bootstrap enrollment, passkey linking, recovery generation/redemption, owned session revocation, role grant/revoke, suspension/activation) appends its event after the authoritative write, correlated by the request id; denials append nothing; a missing sink or failed bounded append fails with `AUDIT_UNAVAILABLE` (503) without compensating the write. Both roots and the fixtures wire the append-only D1/PostgreSQL sink. (2) Free-tier journey — the tier starts through its audited activation contract: the Cloudflare root warns, persists the deterministic-id `deployment.enablement` event (cold-start idempotent) and preflights the peppered PBKDF2 service per isolate at first request (Workers global scope forbids the async D1 work while permitting code generation only there — the activation barrier fails every request closed while it fails, and Cloudflare's upload-time 10021 validation forced exactly this layering); the profile-neutral account password port and the widened credential-record union carry either profile's records through registration/login/recovery/bootstrap and both adapters' parsers; the unmet floor answers `PASSWORD_CAPABILITY_DISABLED` (403) on registration and login with zero credential rows while bootstrap (which issues the tier session — the only operable fresh path while the floor stands) and recovery-code redemption write peppered PBKDF2 records; the instance document reports recovery codes per their wiring; the authorize pages render the degradation notice with an explained no-form login state. The journey ran locally (workerd/D1 suite: capability document, capability errors, bootstrap session, passkey link/login, recovery round-trip with post-revision passkey login, consent code flow with bearer read, audited management APIs, last-staff protection) and on a real Cloudflare Free-account deployment (15/15 checks: the same matrix over HTTPS with signed ingress assertions and the real ceremonies), with the audit trail verified by direct primary reads.
- Change summary: `packages/security/src/{audit,minimum-password}.ts`; `packages/application/src/account-registration.ts`; `packages/config/src/{deployment,index}.ts`; `packages/server/src/{index,errors,audit-emit (new),bootstrap-enrollment,passkey,account-recovery,account-registration,account-login,account-password,sensitive-admission,authorize-pages}.ts`; both database adapters' account/staff record parsing; `apps/api-{node,cloudflare}`; `tests/fixtures/{account-worker,minimum-tier-worker (new),standard-password-rehash-contract}.ts`; `tooling/build-targets.ts`; `tsconfig.json`; `tests/workerd/{minimum-tier-route (new),deployment}.test.ts`; `tests/unit/{audit,deployment,account-password}.test.ts`; the postgres suites' sink wiring and assertions; the workerd suites' audit-row assertions; `docs/{AUTH-FLOWS,API-CONVENTIONS,FREE-TIER-PROFILE}.md`; `docs/plan/{AUDIT-SUSPENSION,EXECUTION,PROGRESS}.md`; the module checklist; the [acceptance evidence](../evidence/04-acceptance-validation.md).
- Verification: Node 24.21.0 — full matrix unit+contract 113 (112+1), node 50/50, workerd 128/128, isolated PostgreSQL 18.6 68/68; both typechecks, lint/boundaries, format, docs build, secret scan. Deployed (authorized test infrastructure): migrations 0012–0014 applied to `hyperbug-test-1`; the test Worker `hyperbug-phase04-tier-journey` on `*.test.eihrteam.org` served the truthful tier document; 15/15 journey checks passed; enablement and lifecycle audit rows verified by direct reads. Cleanup verified: Worker deleted, all journey account rows removed, the journey principal tombstoned, the permanent module-03 audit actor restored to active (suspended only for the bootstrap window — bootstrap requires zero active staff), journey key rows transitioned `current→revoked→removed`, one-off secrets destroyed.
- Decisions and deviations: audited activation replaces the hard config barrier (its in-code removal condition could not be satisfied before the journey evidence it was gating — the user's instruction resolves the ordering; 13.G6 remains the support gate and is never implied); the enablement event's deterministic id makes repeated cold starts write it once; mutation audit is append-after-write with the crash window between write and append recorded as the trail's limit; recovery stays enabled on the tier while registration/login are floor-disabled (AUTH-FLOWS amended accordingly); `minimumLoginAdmission` stays unwired — its password-login composition becomes load-bearing only if a plan change meets the floor, recorded in FREE-TIER-PROFILE.
- Blockers/open questions: none in this module. The G1 audit-governance decision now covers only modules 05–09's suspended audit portions and stays with the user; 13.G6 stays open on its independent gate.
- Next actions: none in this module under the current goal; the activation path's remaining journey items (08.V6, 09.V6, 10.3g, 12.V7) belong to their owning modules.
- Next-session cautions: the audited activation never claims tier support; `PASSWORD_CAPABILITY_DISABLED` is a public contract; codes, tokens and recovery codes are bearer secrets; the `.local` scratch directories and the protected root `SECURITY.md` draft remain uncommitted by instruction.


### 2026-10-03 — Module 07 dependency follow-up

- Scope and checklist IDs: Module 07 migration-aware account/readiness regression fixtures only; no additional owning-module checklist item claimed.
- Progress: Replaced relative migration positions with stable names in PostgreSQL account/recovery/passkey/OAuth and workerd readiness fixtures after the additive content migration. No account/auth product or suspended audit behavior changed.
- Change summary: Supports the authorized Module 07 batch; [full handoff](07-content-and-attachments.md) and [verification evidence](../evidence/07-content-validation.md).
- Files/artifacts: Affected package/fixture paths are inventoried in the linked Module 07 record; no older migration or protected SECURITY.md change.
- Verification: Local unit 199, contract 1, Node 50, workerd/D1 143, PostgreSQL 18.6 82 tests passed; typecheck/lint/format/build/database/docs/license/secret checks passed. Local/emulated storage only; no deployment or remote migration.
- Decisions and deviations: Owning-module status/gates and audit holds remain unchanged; no SPA or Module 09 expansion.
- Blockers/open questions: Module 07's V7 policy-upgrade fixture and forms/storage acceptance remain with Module 07.
- Next actions: Continue the authorized Module 07 goal; no unrelated feature work starts from this follow-up.
- Next-session cautions: All changes remain uncommitted; preserve the protected draft and prior edits, suspended audits, existing migration history and initially clean module-03 measurement snapshots.

### 2026-10-03 — Module 07 form/template integration dependency checkpoint

- Scope and checklist IDs: Dependency impact of 07.2a and non-audit form management/submission; no owning-module gate/checklist change.
- Progress/change summary: Shared contracts and both production roots compose immutable content stores, bounded management/history routes and atomic structured issue creation. Added `content:manage` and read-only `content:history` permission rules; existing issue/auth/admission behavior passes the complete regression matrix. New migrations preserve history; no older migration or audit behavior changed.
- Files/artifacts: Owning changes and detailed decisions are inventoried in [Module 07 progress](07-content-and-attachments.md), [specification](../../ISSUE-FORMS.md) and [validation evidence](../evidence/07-content-validation.md).
- Verification: 499 tests passed (unit/contract 204, Node 50, workerd 155, PostgreSQL 18.6 90); typecheck/lint/build/db/docs/license/secret checks passed. This is local runtime/database evidence; no remote migration or deployment.
- Decisions/blockers: Attachment integration remains with Module 07; audit suspension and Module 09/SPA holds remain. G1 stays closed. See the linked record for the detected and corrected PostgreSQL project/receipt lock-order deadlock.
- Next actions/cautions: Continue only the authorized Module 07 goal. Preserve all uncommitted changes and protected SECURITY.md; never resume suspended audit via this dependency record.

### 2026-10-05 — Review remediation B3 verified

- Scope and checklist IDs: 04.2a/b/e, 04.3a/c (post-completion B3).
- Progress: B3 complete locally; overall mission continues at B4. Existing module status/checklists and G1/G2/13.G6 are unchanged.
- Change summary: Bootstrap grants an instance role; session→code→token preserves ceremony facts; older tokens cannot inherit step-up; final administrator suspension is serialized.
- Files/artifacts: Owning stores/routes/schema/tests and specifications listed in the [cross-module remediation record](../evidence/2026-10-05-review-remediation.md#b3-instance-roles-and-token-bound-assurance-2026-10-05). D1 0024/0025; PostgreSQL 0023/0024.
- Verification: Final local matrix **916 passed / 18 optional-provider skips** (349 unit, 1 contract, 121 Node, 262 workerd/D1 emulation, 183 real isolated PostgreSQL 18.6). Typecheck, lint, Drizzle check (old timestamp warnings), docs build, tracked/new-source formatting and diff checks pass. Root formatting flags only supplied untracked review files; reports untouched. No actual deployment/provider claim. Initial wiring/schema/fixture failures and focused primary-agent security review are recorded in the linked evidence.
- Decisions and deviations: Independent instance role and immutable presented-credential facts; configured default 300 s replaces hardcoded 900 s. No policy weakening, new protocol or new ADR required for B3; formal Minimum ADR remains B8.
- Blockers/open questions: None for B3. Independent Sonnet review unavailable (model not callable); no independent review claimed. Atomic account/role/plugin audit remains B4.
- Next actions: B4 audit transaction/failure cases, recovery-code step-up and passkey CAPTCHA forwarding, then B5–B15 in the approved order.
- Next-session cautions: Never stage SECURITY.md or supplied reviews; preserve historical migration/audit rows, apply schema before adapters, inspect upgrade role recipient, and require new passkey login for old tokens. No SPA or later-module audit resume.

### 2026-10-05 — Review remediation B4 accepted locally

- Scope/checklist IDs: Approved B4 post-completion correction to 04.1c/d, 04.2f, 04.3c/V5 and 05.2a/05.3d, with data/security/acceptance dependencies. No later-module audit or gate expansion.
- Progress/change summary: Prepared neutral audit port; atomic both-store account/role/plugin/recovery/enrollment writes, conditional denial guards, one bounded settings transaction and atomic uninstall cleanup. Recovery generation checks immutable ceremony freshness; passkey CAPTCHA admission precedes challenge consumption. B3 last-administrator serialization retained.
- Files/artifacts: [Detailed B4 record](../evidence/2026-10-05-review-remediation.md#b4-atomic-administration-audit-recovery-freshness-and-passkey-captcha-2026-10-05), application ports, both adapters/server, shared rollback/stale and configured-CAPTCHA fixtures, contracts/specifications and paired reader guides.
- Verification: Focused affected D1/workerd **10 passed** and real isolated PostgreSQL **18.6 13 passed**, no skips. Typecheck/lint/boundaries/scoped format/diff, documentation/all runtime builds and credential-signature scan pass; local Minimum journey adds 7 passes; broad unchanged lanes intentionally not repeated under the user's “Test less, write more” preference. Actual duplicate-audit failures roll back every listed mutation; stale generation preserves codes. Initial fixture errors corrected. Primary focused review recorded; no Sonnet or independent-review claim.
- Decisions/blockers: No schema/deployment/provider change or B4 blocker. Standalone session/link/redeem events retain their prior path; later audit remains suspended. G1/G2 closed, 13.G6 open.
- Next actions/cautions: Commit B4, then B5 conditional session renewal and B6–B15. Keep primary validation/revocation, atomic audit, last-admin locks and required UV/CAPTCHA. Preserve protected files, old SQL/audit history and test measurement artifacts.

### 2026-10-05 — Review remediation B5 conditional session renewal

- Scope/checklist IDs: Approved B5 correction to 04.2c with 02 session-port and 10 acceptance dependencies.
- Progress/change summary: Primary session load now includes kind/idle expiry; requests validate current state and digest every time, renew only when due (User five minutes, Staff three minutes), and avoid writes when absolute expiry prevents growth. Conditional SQL and original ceremony facts remain unchanged.
- Files/artifacts: [B5 record](../evidence/2026-10-05-review-remediation.md#b5-conditional-session-renewal-2026-10-05), application/D1/PostgreSQL/server session files, shared actual-adapter renewal contract, AUTH-FLOWS and paired reader guides.
- Verification: Focused D1/workerd **4 passed**, real isolated PostgreSQL 18.6 **5 passed**, no skips; final changed renewal contract rerun on both stores. Covers intervals, near-idle/absolute expiry, concurrent tabs and immediate logout/owned revocation/credential revision rejection. Typecheck/lint/boundaries/scoped formatting/diff and documentation build pass. Broad unchanged tests omitted per user direction.
- Decisions/blockers: No schema/deployment/crypto change or blocker. Concurrent due observations may each perform a safe conditional renewal; no global cache. Existing 30-minute/seven-day issuance retained, and the misleading shorter-Staff-lifetime documentation claim corrected. Gates unchanged.
- Next actions/cautions: Commit B5, then B6 request-scoped authorization facts reuse and measured read-query counts. Preserve primary validation, recent-authentication timestamp, monotonic expiry and revocation semantics; never stage protected files.
