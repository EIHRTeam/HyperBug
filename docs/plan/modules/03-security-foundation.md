# 03 — Core security, cryptography, audit, and abuse controls

Phase: MVP backend  
Prerequisites: 02 complete.  
Progress: [Session log and current status](../progress/03-security-foundation.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Implement reusable Core security services before exposing business writes or account credentials.

The optional Cloudflare Free minimum tier adds a documented, opt-in degradation surface (03.1e, 03.2g, 03.3g–03.3h, 03.V6–03.V7) defined by [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md). Those items never widen or substitute for the standard-profile acceptance in 03.V1–03.V5.

**Execution override (2026-09-21): [All audit work is suspended — no audit for now](../AUDIT-SUSPENSION.md). Continue the non-audit portions of this module; suspended work remains unchecked.**

**Password-login direction (2026-09-25, [ADR 0009](../../decisions/0009-standard-password-login.md)): Standard-profile password login is approved to be opened once the account flow and provider implementation are complete. Independent audit may be deferred or run in parallel and never blocks development or standard-profile password-login enablement. Further Argon2id performance testing remains stopped and is not a prerequisite. 03.2e's evidence has existed since 2026-09-29; keep 03.V5 unchecked until its evidence exists. The optional Free minimum tier remains separately governed by its PBKDF2 floor and 13.G6 acceptance.**

## Ordered checklist

### Step 03.1 — Translate policy into enforceable contracts

- [x] **03.1a** Write an English threat-boundary/data-classification map and security configuration schema covering public, personal, sensitive, and secret data.
- [x] **03.1b** Define permission evaluation, object-level checks, principal assurance, fail-closed behavior, and sensitive-administration requirements in `packages/security`.
- [x] **03.1c** Implement safe API error envelopes, sensitive-value redaction, request correlation, input/cardinality/depth limits, and production debug restrictions.
- [x] **03.1d** Specify independent retention settings for security logs, audit, abuse metadata, expired sessions, deleted accounts, temporary uploads, and exports.
- [x] **03.1e** Extend the threat-boundary/data-classification map with the deployment-tier posture model: the non-negotiable invariant list, the stable degradation identifiers FREE-01–FREE-08, the compensating control of each, and the rule that a tier can remove capabilities but cannot relax an invariant.

### Step 03.2 — Implement credentials and recoverable-secret protection

- [x] **03.2a** Implement CSPRNG credential creation, keyed token digests, timing-safe verification, key IDs/versions, and key-purpose separation using mature platform cryptography.
- [x] **03.2b** Implement AES-256-GCM envelope encryption with per-key unique 96-bit nonces, contextual AAD, DEKs, approved wrapping, and self-describing encrypted records.
- [x] **03.2c** Define a KeyProvider port and supply Workers-secret and self-host secret-provider implementations. Do not make a beta secrets product the only option.
- [x] **03.2d** Implement current/previous key handling, KEK rotation and DEK rewrapping, blind-index rotation where used, and emergency revocation. Prevent removal of keys still needed by retained data/backups.
- [x] **03.2e** Implement standard-profile Argon2id password records and login-time rehash using versioned parameters. Independent provider audit may be deferred or run in parallel and does not block development or enabling password login after the account flow and provider implementation are complete. Further performance testing remains stopped. Do not reduce the source baseline. See [ADR 0009](../../decisions/0009-standard-password-login.md).
- [x] **03.2f** Document platform TLS/PQ capability verification and crypto-agility metadata. Do not implement custom PQ primitives or promise end-to-end PQ authentication.
- [ ] **03.2g** Implement the tier-scoped credential policy. The standard profiles keep the Argon2id baseline unchanged; the Cloudflare Free minimum tier uses PBKDF2-HMAC-SHA256 with a mandatory keyed pepper, a per-user random salt, the measured highest iteration count, versioned algorithm/iteration/pepper records and login-time rehash, refuses to verify a stronger hash with a weaker verifier, and disables password login when the reviewed parameter floor cannot be met. Follow [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md).

### Step 03.3 — Implement Core enforcement services

- [ ] **03.3a** **Suspended — no audit for now.** Implement permission-aware, append-only audit writes and bounded authorized reads; distinguish audit from diagnostic logs and define controlled retention cleanup.
- [x] **03.3b** Implement explicit CORS origin/method/header rules, safe preflight caching, origin validation when present, and authenticated no-Origin clients. Do not require cookies for business APIs.
- [ ] **03.3c** Define rate-limit/anti-abuse ports and implement both deployment adapters. Separate approximate volumetric protection from sufficiently consistent login/recovery/privileged-operation limits.
- [ ] **03.3d** **Audit portion suspended — no audit for now.** Bound per-IP, principal, account, token, project, and route activity as appropriate; use privacy-minimized abuse metadata, retry hints, and audited provider-outage policy.
- [ ] **03.3e** Implement a centralized outbound-fetch policy for schemes, destination classes, redirects, timeouts, response sizes, and concurrency. Validate runtime-specific DNS/egress protections before allowing arbitrary destinations.
- [ ] **03.3f** Define public/private cache policy and fail-closed handling for key, token, authorization, required CAPTCHA, and plugin-permission failures. CAPTCHA setup is optional; a configured provider enables required verification by default, while an absent provider does not require a token. Malformed configuration or failure of a configured provider must not silently disable verification.
- [ ] **03.3g** **Audit portion suspended — no audit for now.** Implement the fail-closed deployment-tier gate in the typed configuration: exact tier value, required acknowledgement value, startup refusal on mismatch or on the Node runtime, no inference from provider plan or quota errors, audited enablement/change, startup warning, and readiness reporting of the tier, degradation identifiers and password-hash policy.
- [ ] **03.3h** Implement the minimum tier's compensating abuse controls and declare its limit-consistency model: D1-backed account lockout and progressive delay, per-account and per-route quotas, required Turnstile when a provider is configured, administrator alerting, and explicit classification of which limits are approximate and which are consistent.

## Verification and acceptance

- [x] **03.V1** Run known-answer/tamper/wrong-AAD/key-rotation tests across both runtimes without implementing crypto primitives in tests.
- [ ] **03.V2** Demonstrate that forbidden origins, malformed input, excessive requests, private/metadata destinations, redirect escapes, and oversized outbound bodies are rejected.
- [ ] **03.V3** Confirm multi-instance rate-limit behavior meets the declared security consistency model and provider outages do not grant access.
- [ ] **03.V4** **Audit portion suspended — no audit for now.** Inspect logs/audit/errors for seeded secrets and verify unauthorized audit access fails.
- [ ] **03.V5** Record password-hash CPU, memory, concurrency, and overload results for the standard profiles when available. This characterization is not a prerequisite for standard-profile password-login enablement; address any observed correctness or availability defect as a normal implementation defect. Minimum-tier PBKDF2 parameters are recorded as a documented degradation and never as standard-profile evidence.
- [ ] **03.V6** **Audit portion suspended — no audit for now.** Verify the tier gate on both runtimes: enabling without the exact acknowledgement fails startup, the tier is rejected on Node, the tier is never inferred from the provider plan or a quota error, and no tier configuration can disable an invariant, weaken audit integrity or bypass authorization.
- [ ] **03.V7** **Audit portion suspended — no audit for now.** Measure, on a real Cloudflare Free account, the PBKDF2-HMAC-SHA256 cost curve for this tier and fix the iteration count within the per-invocation CPU budget with recorded margin, together with the security-review floor decision and the applicable audit/log retention measurements. Local probes may prepare the matrix but cannot substitute for plan-tier evidence.

## Source coverage

SECURITY §§1–6, 28–45, 62–98, 106–116, 124–150, 154–161; PERFORMANCE §§33–34, 47–53, 58–61, 69–76.
See [ADR 0007](../../decisions/0007-cloudflare-free-minimum-tier.md) and [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md) for the opt-in minimum tier implemented by 03.1e, 03.2g, 03.3g–03.3h and verified by 03.V6–03.V7.
