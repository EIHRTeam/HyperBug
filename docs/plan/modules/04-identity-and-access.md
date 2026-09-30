# 04 — Authentication, identity, and project authorization

Phase: MVP backend  
Prerequisites: 03 complete.  
Progress: [Session log and current status](../progress/04-identity-and-access.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Provide a working authorization service and account/project permission system without depending on the SPA or an installed SSO/email plugin.

**Execution override (2026-09-21): [All audit work is suspended — no audit for now](../AUDIT-SUSPENSION.md). Continue the non-audit portions of this module; suspended work remains unchecked.**

**Password-login direction (2026-09-25):** Implement and expose password registration/login/recovery on the standard profiles as part of this module. Independent audit may be deferred or run in parallel and never blocks development or password-login enablement. Further Argon2id performance testing remains stopped. The optional Free minimum tier remains subject to its separate PBKDF2 parameter-floor and acceptance requirements. See [ADR 0009](../../decisions/0009-standard-password-login.md).

**Deferred Phase 03 scope owned here (2026-09-30 re-scope):** the recovery and token rate-limit categories and their measured budgets deferred from 03.3c/03.3d are implemented with this module's owning routes — recovery with 04.2f, token activity with 04.2b/04.2e, privileged operations with 04.3c — using the frozen category-dimension policy from module 03. Production budget numbers are measured under the staging real-load budget milestone, not inferred from local fixtures.

## Ordered checklist

### Step 04.1 — Prove the authentication implementation

- [x] **04.1a** Write `docs/AUTH-FLOWS.md` covering authorization-service, API, and frontend origins; public-client registration; assurance; session lifetimes; recovery; logout; and bootstrap. Accepted 2026-09-30: the specification covers all listed topics with an implementation-status map, derives every normative value from the SECURITY/PRODUCT/TECH-STACK sources, records the operator-channel one-time-code bootstrap design for 04.1c, and marks specified-but-unimplemented parts for their owning items.
- [x] **04.1b** Run a bounded Better Auth candidate PoC against current documentation and both database/runtime profiles. Accept it only if it supports the required protocol, opaque tokens, revocation, and session/storage rules; record the outcome without changing the selected business framework. Completed 2026-09-30: Better Auth 1.7.6 + `@better-auth/oauth-provider` 1.7.6 verified on Node/PostgreSQL 18.6 and workerd/D1 — protocol, opaque tokens and revocation work on both profiles, but the session/storage rules deviate from the baseline (191-bit default token entropy, unkeyed digest, session-id storage model, opaque-userinfo gap) and adoption would force a drizzle-orm upgrade; the candidate is **not accepted**, the selected framework is unchanged, and the outcome is recorded in the [PoC evidence](../evidence/04-better-auth-poc.md).
- [ ] **04.1c** Choose an operational public-account mechanism and a safe initial administrator enrollment/recovery mechanism. Support an installation with no email plugin; do not implement an unauthenticated production bootstrap bypass.
- [ ] **04.1d** Specify and implement standard-profile password registration/login/recovery and a passkey path for non-SSO Staff. Password login is approved to be exposed when its functional account flow and provider implementation are complete; independent audit does not gate enablement, and further performance testing remains stopped. Record any initial assurance limitation and its user-facing impact.
- [ ] **04.1e** Specify the Cloudflare Free minimum tier's account mechanism in `docs/AUTH-FLOWS.md`: password registration, login and recovery with the tier's PBKDF2 policy, passkeys and single-use recovery codes as the recommended path, administrator-assisted recovery without email, the assurance difference from the standard tier, and the rule that existing Argon2id records are migrated or reset before a downgrade. Follow [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md).

### Step 04.2 — Implement cross-site authorization

- [ ] **04.2a** Implement Authorization Code + PKCE S256, fresh high-entropy state/verifier, exact redirect allowlists, client/challenge binding, and short-lived single-use codes (initial target at most 60 seconds).
- [ ] **04.2b** Implement short-lived opaque access tokens with at least 256-bit random secrets, keyed digest storage, expiry, immediate revocation, and a default lifetime of 10 minutes within the documented 5–15 minute range.
- [ ] **04.2c** Implement first-party authorization-session cookies with Secure, HttpOnly, host scope, Path=/, and SameSite=Lax; add cookie-flow CSRF defenses, idle/absolute expiry, fixation protection, and rotation.
- [ ] **04.2d** Provide the authorization-service login/consent/account interaction needed to exercise the flow before the SPA. Any HTML for these backend-owned flows must use modern-web-guidance and the security/accessibility baseline.
- [ ] **04.2e** Implement bearer authentication for business APIs, no-store token/account responses, logout/revocation, and recent-authentication checks. Keep business API requests independent of cookies and frontend proxies.
- [ ] **04.2f** Implement one-time account verification/reset tokens and enumeration-resistant responses when those account features are enabled; verify invalidation after use and session revocation after recovery.
- [ ] **04.2g** Expose a stable unauthenticated instance capability document (for example `GET /api/v1/instance`) reporting the deployment tier, the active degradation identifiers, the available authentication capabilities and `passwordHashPolicy` including its downgraded flag, plus the documented instance limits. Consolidate it into the public OpenAPI in 10.1a. The SPA consumes it through 11.1g and must never imply a capability the instance lacks.

### Step 04.3 — Implement identity and permission management

- [ ] **04.3a** **Audit portion suspended — no audit for now.** Model User and Staff principals separately; keep stable external Staff identities keyed by issuer + subject and explicit audited account linking only.
- [ ] **04.3b** Implement project roles/permissions, resource ownership, suspension, and authoritative object-level checks. Never rely on hidden UI controls or stale embedded role claims.
- [ ] **04.3c** **Audit portion suspended — no audit for now.** Implement account/profile and authorized role-management APIs with bounded lists, safe public DTOs, audit, and assurance requirements.
- [ ] **04.3d** Expose provider contracts for later SSO/CAPTCHA integrations without requiring those plugins for basic Core operation.

## Verification and acceptance

- [ ] **04.V1** Exercise the full redirect/code/token flow using an HTTP harness and a minimal browser fixture on separate registrable domains with third-party cookies blocked.
- [ ] **04.V2** Reject missing/wrong state, PKCE plain/wrong verifier, reused or expired code, redirect mismatch, replay, expired/revoked tokens, and session fixation.
- [ ] **04.V3** Test anonymous/User/Triage/Maintainer/Admin behavior, cross-project access, same-email User/Staff, permission removal, suspended accounts, and recent-auth requirements on both profiles.
- [ ] **04.V4** Verify authorized no-Origin API clients work and disallowed browser origins fail.
- [ ] **04.V5** **Audit portion suspended — no audit for now.** Confirm Core works without email/SSO/CAPTCHA plugins and the chosen bootstrap/recovery procedure is documented and auditable.
- [ ] **04.V6** Exercise the minimum-tier account journey without an email channel: password registration/login/recovery under the tier's PBKDF2 policy, passkey login, single-use recovery codes and administrator-assisted recovery; verify that the capability document matches server enforcement, that password endpoints fail with a documented capability error when the reviewed parameter floor disables them, and that the degradation notice is reachable from the account surfaces.

## Source coverage

PRODUCT §§3–5, 24, 29; SECURITY §§7–44, 137–138, 148–151; TECH-STACK §§41–43; PERFORMANCE §§33–34, 52.
See [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md) for the minimum-tier account and capability requirements in 04.1e, 04.2g and 04.V6.
