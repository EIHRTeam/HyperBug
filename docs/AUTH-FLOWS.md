# Authentication flows

Owner: [04.1](plan/modules/04-identity-and-access.md). Decision context: [ADR 0009](decisions/0009-standard-password-login.md) (standard-profile password login), [ADR 0007](decisions/0007-cloudflare-free-minimum-tier.md) (minimum-tier account path). Status as of 2026-09-30: specification for the standard profiles. The narrow registration/login/session/logout dependency from Phase 03 exists and is cited below as implemented; the authorization-code flow, bearer token exchange, recovery, passkeys, Staff enrollment and rotation remain to be implemented under 04.2. Audit work is [suspended](plan/AUDIT-SUSPENSION.md) and no audit portion of this document is claimed.

## Origins and trust boundaries

A deployment exposes three origins, each of which may be on a different registrable domain and provider: the static frontend (for example `issues.example.org`), the public API (`api.example.net`) and the authorization service (`auth.example.net`). The security model MUST NOT rely on shared origins, shared-domain cookies, third-party cookies, a reverse proxy or same-provider deployment.

Deployment shape: the authorization service is an origin-scoped route group of the shared backend (modular monolith) — today the `/auth/*` routes on the standard roots — served under the authorization origin. It may be split into its own Worker/service later under the documented service-split policy; the protocol and cookie scope above are identical either way.

- The **authorization service** owns every cookie-authenticated interaction: login, the authorization/consent pages behind the code flow, session read, logout and account-recovery pages. It also owns the login/consent **user interface**: these backend-owned pages live on the authorization origin (built under 04.2d with the modern-web-guidance and accessibility baseline); the SPA never hosts the credential-entry form and never proxies it.
- The **public API** authenticates business requests with `Authorization: Bearer <access-token>` only. Business API requests are independent of cookies and frontend proxies: clients send `credentials: "omit"`, and the API never enables credentialed CORS. A no-Origin authorized API client remains valid (04.V4). Non-SPA machine clients (CLI/bots) use the same bearer surface; a personal-access-token registry is a future separately reviewed contract (SECURITY §22) and no client-credentials flow is offered now.
- The **frontend** is an untrusted execution environment. Anything readable in the browser is not a secret; access tokens live in memory only.

Cross-origin browser access to the API uses the explicit CORS allowlist from [SECURITY-FOUNDATION](SECURITY-FOUNDATION.md); the authorization service additionally enforces same-origin checks on its cookie-authenticated mutations (see CSRF defenses below).

## Identity model

`principals` are `user` or `staff` ([DATA-MODEL](DATA-MODEL.md#principals-and-actor-references)). Public Users and Staff are separate identity domains; identical emails, email domains, display names or external profiles never grant Staff privileges. Linking a User and Staff identity, if ever performed, is an explicit audited operation (audit portion currently suspended).

- A **public User** authenticates with a local password account: identity `(provider: local-password, issuer: hyperbug, subject: canonical lower-case ASCII handle)` with a versioned Argon2id record in `password_credentials`. Registration and login under this contract are implemented (see [API conventions](API-CONVENTIONS.md)).
- **Staff** authenticate through SSO (external identity keyed by exact `issuer + subject`, never an email join) or, in non-SSO installations, through the same local-password mechanism plus a passkey path. SSO is a plugin-provided mechanism (04.3d); Core authorization always remains local.
- A principal may hold multiple identities over time; each authorization session and access token records the principal and the identity/credential revision it was issued under.

## Public-client registration

The official SPA is an OAuth 2.0 **public client**: it holds no client secret and cannot be issued one. The deployment configuration registers:

- a stable client identifier for the official SPA;
- one or more **exact-match** redirect URIs (scheme, host, port and path; no wildcards, no `*.example.com/callback` patterns);
- the allowed scope set (initially `public-api`).

Dynamic or self-service client registration is not offered. Authorization requests with an unknown client, an unregistered redirect URI, or a `return_to`/`next`-style target outside the allowlist are rejected; every redirect target is allowlisted explicitly. A future machine client registry (personal access tokens) is out of scope here and requires its own reviewed contract (SECURITY §22).

## Authorization Code + PKCE flow (04.2a, specified)

The browser default protocol is OAuth 2.0 Authorization Code with PKCE `S256` (OAuth 2.1-style; the Implicit flow and `plain` PKCE are prohibited). One flow:

```text
SPA (memory)                         authorization service                 API
  |  GET /auth/authorize (top-level)        |
  |  client_id, redirect_uri, scope, state, |
  |  code_challenge (S256), method          |
  |---------------------------------------->|
  |        login page / existing session    |   (first-party cookie)
  |        continue / consent               |
  |  302 redirect_uri?code&state            |
  |<----------------------------------------|
  |  POST /auth/token                        |
  |  grant_type=authorization_code           |
  |  code, redirect_uri, client_id,          |
  |  code_verifier                           |
  |---------------------------------------->|
  |  200 { access_token, expires_in }        |
  |<----------------------------------------|
  |  Authorization: Bearer <token>           |
  |----------------------------------------------------------------->|
```

Requirements:

- `state` is a fresh single-use CSPRNG value of at least 128 bits per authorization request, bound to the browser context and discarded after the callback; a mismatch terminates the flow. (OIDC `nonce` applies additionally when an SSO plugin drives an OIDC flow.)
- `code_verifier` is fresh per request, 43–128 characters, CSPRNG-generated, never persisted to long-lived storage; `code_challenge_method` must be `S256`.
- The authorization `code` is single-use, bound to the client, the exact redirect URI and the PKCE challenge, and short-lived with a default of 60 seconds (upper bound 60 seconds). Redeeming it twice, after expiry, with the wrong verifier, the wrong client or the wrong redirect URI fails and consumes the code. A successful exchange invalidates it immediately.
- All authorize/token errors are closed catalogued envelopes; no stack detail, no token in a URL fragment, and no redirect to an unregistered URI (the error is shown on the authorization-service origin instead).
- The token endpoint requires no client secret (public client) but enforces the same rate admission categories as login for the requesting IP.

The SPA keeps the access token in memory only. After a page refresh the SPA repeats the top-level authorization redirect; an existing authorization session reissues a code without interaction. The official SPA holds no persistent refresh token; introducing one would require its own security ADR (SECURITY §16).

## Access tokens (04.2b, specified)

- Format `at_<public-id>.<secret>`: the public id locates the token record; the secret is at least 256 bits of CSPRNG entropy.
- The server stores `public_id` and a keyed digest `HMAC-SHA-256(index-key, secret)` (or equivalent keyed digest from the existing key-provider machinery), never plaintext; verification is constant-time.
- Default lifetime 10 minutes, configurable only within 5–15 minutes. Long-lived browser tokens are prohibited without an ADR.
- Revocation is immediate and primary-backed: revoking a token (logout-of-API, suspected compromise, password reset, suspension) takes effect on the next request. Token state is always read from the authoritative store; no long-lived permission state is encoded into a self-contained JWT.
- Bearer tokens are transmitted only in the `Authorization` header — never in URL query, fragment, path or Referer-visible locations. Token, session and account responses are `Cache-Control: no-store`.
- Sensitive management operations can additionally require **recent authentication** (a bound on time since the authorization session's last credential verification; provisional default 15 minutes, configurable within 5–60 minutes until measured); the API answers stale assurance with `REAUTHENTICATION_REQUIRED` (403), which the existing shared authorization guard already maps ([API conventions](API-CONVENTIONS.md)).

## Authorization sessions (first-party cookies)

The implemented first-party session contract (Phase 03 dependency):

- Cookie `__Host-hb_session` with `Secure`, `HttpOnly`, `Path=/`, `SameSite=Lax`, host-scoped (no `Domain` attribute). Value `<session-uuid>.<opaque-secret>`; the secret is digested with a versioned keyed HMAC context-bound to the session id and never stored plaintext.
- Public User lifetime: 30-minute idle timeout, 7-day absolute timeout (implemented; provisional until measured under load). Staff sessions use shorter limits — 15-minute idle, 12-hour absolute (specified; implemented with 04.3).
- Fixation protection: every login mints a fresh session id and the store revalidates the principal's active status and credential revision on each read; suspension, credential replacement, expiry or revocation denies reuse.
- Rotation (specified; to implement with 04.2c): the session identifier must rotate after login, password change, privilege escalation, Staff role change, MFA/step-up completion and account recovery.
- CSRF defenses: cookie-authenticated mutations on the authorization-service origin (`POST /auth/login`, `POST /auth/logout`, the authorize/consent and recovery mutations) require `Origin` equal to the authorization-service origin and, when present, `Sec-Fetch-Site: same-origin`; reads accept `same-origin`/`none`. These checks are implemented for the current routes.
- Session-read and logout routes consume their own trusted-IP approximate buckets before storage work, while password login/registration stay governed by the authoritative account/IP counters (see [RATE-LIMITING](RATE-LIMITING.md)).

## Assurance

Core represents authentication assurance levels: `password`, `passkey`, `sso`, `sso+mfa`, `step-up`. High-risk operations may require a minimum assurance level; the permission resolver's assurance snapshot already enforces this boundary generically.

Initial limitation (recorded per 04.1d): until passkeys and SSO ship, the only attestable assurance is `password`, and step-up is approximated by recent-authentication checks. User-facing impact: operations that will later demand `passkey`/`sso+mfa` assurance are unavailable rather than degraded, and Staff without SSO must use the local-password plus passkey path.

## Registration, login and abuse controls (implemented for the current routes)

- `GET /api/v1/accounts/register` publishes the optional CAPTCHA challenge descriptor; `POST` accepts a bounded handle/password, consumes account+trusted-IP admission (provisional 5 per handle and 20 per IP per hour), then optional configured CAPTCHA, then Argon2id verification and the atomic principal/identity/credential write. Duplicate and accepted handles return the same generic 202; no existence is disclosed.
- `GET /auth/login` publishes the login challenge descriptor; `POST /auth/login` runs the same admission order before password verification. Unknown or wrong credentials return the same no-store `LOGIN_DENIED` (401); dependency failures return closed 503 envelopes. Success issues the first-party session cookie described above.
- Every auth route fails closed on unavailable key material, stores, counters or configured providers; see [API conventions](API-CONVENTIONS.md) for the closed error catalog. Production budgets for these categories are measured at the staging real-load budget milestone ([closure matrix](plan/evidence/03-closure-matrix.md)).

## Recovery (04.2f, specified)

Account recovery never depends on an email plugin being installed:

1. **Single-use recovery codes.** An account may generate a bounded set (default 10) of one-time recovery codes, each a ≥256-bit CSPRNG value stored only as a keyed digest. Codes are displayed exactly once at generation; each redeems exactly once and revokes the remaining session/token state of the account when used to set a new password. Regenerating the set invalidates all previous codes.
2. **Reset tokens (when a delivery channel exists).** With an email/notification plugin configured, a password-reset token is CSPRNG-generated, single-use, account-bound, server-side hashed, and short-lived (default 30 minutes, allowed 15–30). Requests are enumeration-resistant: the same generic accepted response is returned whether or not the account exists, and the token consumer never reveals account state. A successful reset revokes the account's authorization sessions and access tokens.
3. **Administrator-assisted recovery (no-email installations).** A Staff administrator with the account-management permission verifies the requester out-of-band, then issues a forced credential reset through the audited account-management API; the administrator cannot read or set the user's password, only force a fresh enrollment (a new recovery path for the user). This keeps Core operable with zero plugins while leaving an operational trail.
4. **Lost last-administrator access** is restored through the operator-channel bootstrap re-arm below, never through an unauthenticated HTTP path.

All recovery routes are rate-admitted under the `password reset` category (account + trusted IP dimensions) and use enumeration-resistant responses.

## Account states

A principal is `active`, `suspended` or `deleted`. Suspension takes effect immediately on the primary-backed validation paths: existing authorization sessions and access tokens deny on their next use, new sessions/tokens are not issued, and write operations are refused, while already-dispatched side effects are not retroactively undone. Deletion leaves the tombstone principal for attribution and removes personal data through the retention workflow; suspended accounts can only be restored by an authorized administrator.

## Logout

- `POST /auth/logout` (authorization-service origin, same-origin check): revokes the current authorization session in the primary store and clears the cookie. Implemented.
- The SPA discards its in-memory access token; additionally `POST /auth/revoke` (specified) revokes a presented bearer access token for API-only logout or suspected token compromise. Revocation of all sessions/tokens for an account happens on password reset and suspension.

## Bootstrap and initial administrator enrollment (04.1c, specified)

There is no unauthenticated production bootstrap bypass. The first Staff administrator is enrolled through an operator-channel one-time code:

1. A deployment with zero Staff principals may configure a single-use enrollment secret (`bootstrap` versioned record: high-entropy CSPRNG code from the operator channel — Node private file or Worker Secret, never ordinary configuration or repository content).
2. `POST /auth/bootstrap/enroll` verifies the code (constant-time), requires that no Staff principal exists, then creates the first Staff administrator through the same bounded password/passkey enrollment contract as any account. The route is rate-admitted (`registration`-class account+IP dimensions) and its success consumes the code permanently.
3. Once any Staff principal exists the endpoint denies permanently, and readiness reports only a boolean bootstrap state without code detail. Re-arming after losing the last administrator requires operator-channel action (a fresh code) and is recorded as a deployment event; the audit trail is subject to the standing audit suspension and is not claimed here.
4. The enrollment code is never logged, echoed or included in error envelopes; failed attempts consume rate admission under the bootstrap category.

This mechanism's trust root is authenticated operator access to the deployment's secret channel, which is the same trust root as deployment configuration itself.

## Minimum tier account mechanism (Cloudflare Free)

This section specifies the `cloudflare-free-minimum` account surface per [FREE-TIER-PROFILE](FREE-TIER-PROFILE.md) and [ADR 0007](decisions/0007-cloudflare-free-minimum-tier.md); the tier stays startup-disabled until its 13.G6 acceptance, and nothing here substitutes for the standard profiles.

- **Password under the tier's PBKDF2 policy (FREE-01).** Password registration, login and recovery use PBKDF2-HMAC-SHA256 with the mandatory keyed pepper (a missing pepper fails startup; there is no unpeppered fallback), per-user random salt and versioned algorithm/iteration/pepper records with login-time rehash when a stronger policy becomes available; the measured policy fixes current 50,000 / stored-maximum 100,000 iterations, and the reviewed 600,000-iteration floor is unmet, so **password login and registration advertise as disabled** (`authentication.passwordLogin = false` in the instance document) until plan limits change. A stored record stronger than the configured maximum refuses verification rather than downgrading, and no plan measurement can lower the floor — an unmet floor disables login rather than permitting weak storage. Nothing on this tier may state or imply Argon2id protection.
- **Passkeys and single-use recovery codes are the recommended path.** The passkey and recovery-code mechanisms specified above are hash-policy-independent and are the recommended account journey on the tier; D1-backed account lockout with progressive delay, per-account/per-route quotas and required Turnstile when a provider is configured compensate for the reduced password posture (FREE-02's frozen lockout parameters: 500 ms initial delay doubling per two failures, fifteen-minute cap and streak reset), with digest-only bounded administrator alerting and the declared limit-consistency model.
- **Administrator-assisted recovery without email.** The no-email recovery path is identical to the standard tier: single-use recovery codes, plus administrator-assisted reset through the account-management API; an email channel exists only when an email plugin is installed (later module).
- **Assurance difference.** Standard-profile assurance distinguishes Argon2id-verified passwords from passkey/SSO ceremonies; the tier's password path (when a future floor change enables it) provides PBKDF2-verified assurance only — a recorded degradation (FREE identifiers), never an equal claim. High-assurance operations on the tier rely on passkeys and recent authentication.
- **Downgrade rule.** Existing Argon2id records are never verified by the tier's PBKDF2 path (a weaker verifier never verifies a stronger hash). Enabling the tier on data with existing Argon2id credentials requires migrating or resetting those records first (re-registration or administrator-forced reset); the migration path is part of any future activation acceptance, not of this specification.

## Provider optionality and contracts

Core operates with zero plugins: no email, SSO or CAPTCHA provider is required for accounts, sessions, the code flow, recovery codes or administrator-assisted recovery. A configured CAPTCHA provider enables required verification on the account routes automatically (implemented); SSO/email plugins plug into the provider contracts below and in later modules without weakening any boundary above.

**CAPTCHA provider contract (implemented).** The root composes an optional verifier from complete runtime bindings (secret, site key, trusted hostname); no setup preserves startup, partial setup refuses it, and a configured provider enables per-action required verification (`register`, `login`, `password-reset`, `bootstrap`) with a single catalogued outbound Siteverify call. Provider failure, timeout or malformed data denies (403/503) and never bypasses rate admission; success waives nothing. A future provider (hCaptcha, reCAPTCHA) implements the same gate interface; the closed tuple of provider kinds widens only through an owning-feature decision.

**SSO provider contract (specified; plugin implementations are module 16).** A Staff SSO plugin supplies an OIDC/OAuth 2.0 client against the authorization service: it returns verified identity claims keyed by exact `issuer + subject` after validating issuer, audience, signature, `exp`/`iat`, `nonce` and `state` (rejecting `alg: none` and undefined algorithm allowlists, with JWKS from a trusted HTTPS endpoint). Claims are authentication input only: group/role mappings convert to local roles through explicit audited configuration, and every authorization decision remains the local engine's. Email equality never links or grants anything. The plugin never handles first-party session cookies; a completed SSO ceremony feeds the same session-issuance path as password/passkey login under the Staff principal it maps to.

## Implementation status map

| Specification | Status |
| --- | --- |
| Origins/trust boundaries, CORS/origin enforcement | Implemented (shared HTTP boundary) |
| Public-client registration, authorize/token endpoints, PKCE | Implemented (both profiles; exact-match registry, 60 s single-use codes, consume-before-verify, S256 constant-time) |
| Opaque bearer tokens, revocation, recent authentication | `at_` tokens implemented (keyed digest, 600 s, RFC 7009 revocation, both profiles); recent-authentication enforcement remains for 04.2e route owners |
| First-party session cookie, idle/absolute expiry, fixation protection | Implemented; rotation specified for 04.2c |
| Registration/login routes with admission and CAPTCHA | Implemented (narrow Phase 03 dependency) |
| Assurance representation | Guard implemented; `password`-only initial assurance recorded |
| Recovery codes, reset tokens, admin-assisted recovery, sessions revocation | Single-use recovery codes implemented (generation, regeneration, redemption, session revocation, enumeration resistance); channel-delivered reset tokens and admin-assisted reset remain for 04.2f/04.3c |
| Logout (session) | Implemented; token revocation endpoint specified |
| Account states (active/suspended/deleted) | Suspension/expiry denial implemented on session validation; full account-state surface specified |
| Bootstrap enrollment | Implemented (both profiles; operator-channel code, single-shot, readiness state) |
| Staff SSO/passkey paths, account/role management APIs | Passkey registration and discoverable login implemented (user-verification required, revision-bound session issuance); SSO plugin contracts and role APIs remain for 04.3 |
