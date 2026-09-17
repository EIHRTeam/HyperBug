# Security and review boundaries

Read when work changes security behavior or when deciding review/ADR scope. Authoritative requirements are in SECURITY and PERFORMANCE through [SOURCES](../../../../docs/plan/SOURCES.md); this reference routes decisions rather than replacing those baselines.

## Core policy checks

| Change surface | Invariants and source sections |
| --- | --- |
| Identity/auth | User and Staff are distinct; email matching grants no Staff privilege. PKCE S256, exact redirects, one-use codes, short-lived opaque tokens, immediate revocation, and first-party authorization sessions. SECURITY §§7–44. |
| Authorization | Check object/project permissions on the server, including searches and delayed jobs. Fail closed on verification errors; require assurance/recent authentication where specified. SECURITY §§35–39, 141, 158–159. |
| Credentials/keys | Hash non-recoverable credentials; use mature crypto and AES-256-GCM envelope encryption for recoverable secrets, contextual AAD, unique nonces, key IDs/rotation. Do not lower memory-hard password parameters to fit a runtime. SECURITY §§28–34, 67–91, 148–150. |
| Content/uploads | Final tree sanitization after raw HTML parse; centralized versioned policy. Reauthorize uploads/finalization, verify actual objects, isolate dangerous media, and prevent post-validation overwrite. SECURITY §§53–66, 99–105. |
| Cross-origin/cache | Explicit origins; no ambient cookies for business APIs; CSRF protection for cookie flows. Never reuse private responses through shared caches or weaken CSP for an ordinary plugin. SECURITY §§40–52, 132–136. |
| External/plugin | Central SSRF/redirect/size/timeout limits; scoped secret/capability access. Native code is trusted, not sandboxed; plugins cannot disable Core policy. SECURITY §§92–98, 106–123. |
| Audit/retention | Redact logs/errors; required security actions get append-only audit records. Bound and document retention without silently deleting audit history. SECURITY §§110–116, 139–149. |

CORS is not authentication, CAPTCHA is not authorization, and a cache hit is not a permission check. Provider failure cannot mean successful security verification. Do not claim uploads were scanned without a scanner or full PQ authentication from hosting alone.

## Review and decision routing

- Apply focused security review to authentication/authorization, crypto/password/token storage, sanitization, CSP/CORS, uploads, plugin runtime, outbound fetch, SSO/CAPTCHA, and KMS changes (SECURITY §154). Ordinary feature work does not automatically require a separate exhaustive repository audit.
- Write a security ADR for a new auth flow, persistent browser credential, cipher/password algorithm/key provider, plugin execution model, weaker CSP, raw HTML capability, cross-origin trust, or public-key signature algorithm (SECURITY §155).
- Deviations from SECURITY MUST/MUST NOT require both an ADR and security review (§2). Resolve uncertainty explicitly before embedding a weaker behavior.
- Review hot queries/indexes, list/search/pagination, bulk/cache/fan-out, plugin hooks, uploads/import/export, auth cost, and large dependencies for performance (PERFORMANCE §75).
- Record an ADR for pagination/cache/search/replication/denormalization architecture, sync-to-async shifts, coordination objects, changed queue delivery semantics, or a large persistent frontend dependency (PERFORMANCE §76); core framework/database/service/browser-baseline changes also follow ARCHITECTURE §49.
- Record review evidence and rationale in the owning module's progress entry or linked decision file. A review requirement is not automatically a new user-approval requirement for routine authorized implementation.

Use [testing](testing.md) for adversarial acceptance evidence and the maintenance [deployment reference](../../hyperbug-maintenance/references/deployment.md) for operational key/incident work.

