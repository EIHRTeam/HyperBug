# 04 — Authentication, identity, and project authorization

Phase: MVP backend  
Prerequisites: 03 complete.  
Progress: [Session log and current status](../progress/04-identity-and-access.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Provide a working authorization service and account/project permission system without depending on the SPA or an installed SSO/email plugin.

## Ordered checklist

### Step 04.1 — Prove the authentication implementation

- [ ] **04.1a** Write `docs/AUTH-FLOWS.md` covering authorization-service, API, and frontend origins; public-client registration; assurance; session lifetimes; recovery; logout; and bootstrap.
- [ ] **04.1b** Run a bounded Better Auth candidate PoC against current documentation and both database/runtime profiles. Accept it only if it supports the required protocol, opaque tokens, revocation, and session/storage rules; record the outcome without changing the selected business framework.
- [ ] **04.1c** Choose an operational public-account mechanism and a safe initial administrator enrollment/recovery mechanism. Support an installation with no email plugin; do not implement an unauthenticated production bootstrap bypass.
- [ ] **04.1d** Specify password registration/login/recovery when enabled and a passkey path for non-SSO Staff. Record any initial assurance limitation and its release impact.

### Step 04.2 — Implement cross-site authorization

- [ ] **04.2a** Implement Authorization Code + PKCE S256, fresh high-entropy state/verifier, exact redirect allowlists, client/challenge binding, and short-lived single-use codes (initial target at most 60 seconds).
- [ ] **04.2b** Implement short-lived opaque access tokens with at least 256-bit random secrets, keyed digest storage, expiry, immediate revocation, and a default lifetime of 10 minutes within the documented 5–15 minute range.
- [ ] **04.2c** Implement first-party authorization-session cookies with Secure, HttpOnly, host scope, Path=/, and SameSite=Lax; add cookie-flow CSRF defenses, idle/absolute expiry, fixation protection, and rotation.
- [ ] **04.2d** Provide the authorization-service login/consent/account interaction needed to exercise the flow before the SPA. Any HTML for these backend-owned flows must use modern-web-guidance and the security/accessibility baseline.
- [ ] **04.2e** Implement bearer authentication for business APIs, no-store token/account responses, logout/revocation, and recent-authentication checks. Keep business API requests independent of cookies and frontend proxies.
- [ ] **04.2f** Implement one-time account verification/reset tokens and enumeration-resistant responses when those account features are enabled; verify invalidation after use and session revocation after recovery.

### Step 04.3 — Implement identity and permission management

- [ ] **04.3a** Model User and Staff principals separately; keep stable external Staff identities keyed by issuer + subject and explicit audited account linking only.
- [ ] **04.3b** Implement project roles/permissions, resource ownership, suspension, and authoritative object-level checks. Never rely on hidden UI controls or stale embedded role claims.
- [ ] **04.3c** Implement account/profile and authorized role-management APIs with bounded lists, safe public DTOs, audit, and assurance requirements.
- [ ] **04.3d** Expose provider contracts for later SSO/CAPTCHA integrations without requiring those plugins for basic Core operation.

## Verification and acceptance

- [ ] **04.V1** Exercise the full redirect/code/token flow using an HTTP harness and a minimal browser fixture on separate registrable domains with third-party cookies blocked.
- [ ] **04.V2** Reject missing/wrong state, PKCE plain/wrong verifier, reused or expired code, redirect mismatch, replay, expired/revoked tokens, and session fixation.
- [ ] **04.V3** Test anonymous/User/Triage/Maintainer/Admin behavior, cross-project access, same-email User/Staff, permission removal, suspended accounts, and recent-auth requirements on both profiles.
- [ ] **04.V4** Verify authorized no-Origin API clients work and disallowed browser origins fail.
- [ ] **04.V5** Confirm Core works without email/SSO/CAPTCHA plugins and the chosen bootstrap/recovery procedure is documented and auditable.

## Source coverage

PRODUCT §§3–5, 24, 29; SECURITY §§7–44, 137–138, 148–151; TECH-STACK §§41–43; PERFORMANCE §§33–34, 52.

