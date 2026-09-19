# 03 — Core security, cryptography, audit, and abuse controls

Phase: MVP backend  
Prerequisites: 02 complete.  
Progress: [Session log and current status](../progress/03-security-foundation.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Implement reusable Core security services before exposing business writes or account credentials.

## Ordered checklist

### Step 03.1 — Translate policy into enforceable contracts

- [ ] **03.1a** Write an English threat-boundary/data-classification map and security configuration schema covering public, personal, sensitive, and secret data.
- [ ] **03.1b** Define permission evaluation, object-level checks, principal assurance, fail-closed behavior, and sensitive-administration requirements in `packages/security`.
- [ ] **03.1c** Implement safe API error envelopes, sensitive-value redaction, request correlation, input/cardinality/depth limits, and production debug restrictions.
- [ ] **03.1d** Specify independent retention settings for security logs, audit, abuse metadata, expired sessions, deleted accounts, temporary uploads, and exports.

### Step 03.2 — Implement credentials and recoverable-secret protection

- [ ] **03.2a** Implement CSPRNG credential creation, keyed token digests, timing-safe verification, key IDs/versions, and key-purpose separation using mature platform cryptography.
- [ ] **03.2b** Implement AES-256-GCM envelope encryption with per-key unique 96-bit nonces, contextual AAD, DEKs, approved wrapping, and self-describing encrypted records.
- [ ] **03.2c** Define a KeyProvider port and supply Workers-secret and self-host secret-provider implementations. Do not make a beta secrets product the only option.
- [ ] **03.2d** Implement current/previous key handling, KEK rotation and DEK rewrapping, blind-index rotation where used, and emergency revocation. Prevent removal of keys still needed by retained data/backups.
- [ ] **03.2e** Benchmark an audited Argon2id implementation on both runtimes; evaluate the source-approved memory-hard fallback only with recorded security/performance evidence. Version parameters and support rehash-on-login.
- [ ] **03.2f** Document platform TLS/PQ capability verification and crypto-agility metadata. Do not implement custom PQ primitives or promise end-to-end PQ authentication.

### Step 03.3 — Implement Core enforcement services

- [ ] **03.3a** Implement permission-aware, append-only audit writes and bounded authorized reads; distinguish audit from diagnostic logs and define controlled retention cleanup.
- [ ] **03.3b** Implement explicit CORS origin/method/header rules, safe preflight caching, origin validation when present, and authenticated no-Origin clients. Do not require cookies for business APIs.
- [ ] **03.3c** Define rate-limit/anti-abuse ports and implement both deployment adapters. Separate approximate volumetric protection from sufficiently consistent login/recovery/privileged-operation limits.
- [ ] **03.3d** Bound per-IP, principal, account, token, project, and route activity as appropriate; use privacy-minimized abuse metadata, retry hints, and audited provider-outage policy.
- [ ] **03.3e** Implement a centralized outbound-fetch policy for schemes, destination classes, redirects, timeouts, response sizes, and concurrency. Validate runtime-specific DNS/egress protections before allowing arbitrary destinations.
- [ ] **03.3f** Define public/private cache policy and fail-closed handling for key, token, authorization, required CAPTCHA, and plugin-permission failures.

## Verification and acceptance

- [ ] **03.V1** Run known-answer/tamper/wrong-AAD/key-rotation tests across both runtimes without implementing crypto primitives in tests.
- [ ] **03.V2** Demonstrate that forbidden origins, malformed input, excessive requests, private/metadata destinations, redirect escapes, and oversized outbound bodies are rejected.
- [ ] **03.V3** Confirm multi-instance rate-limit behavior meets the declared security consistency model and provider outages do not grant access.
- [ ] **03.V4** Inspect logs/audit/errors for seeded secrets and verify unauthorized audit access fails.
- [ ] **03.V5** Record password-hash CPU, memory, concurrency, and overload results; unresolved unsafe runtime behavior blocks password-based release.

## Source coverage

SECURITY §§1–6, 28–45, 62–98, 106–116, 124–150, 154–161; PERFORMANCE §§33–34, 47–53, 58–61, 69–76.

