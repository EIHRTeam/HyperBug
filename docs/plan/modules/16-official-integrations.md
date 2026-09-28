# 16 — Post-MVP official plugins and isolated integration APIs

Phase: Post-MVP optional integrations  
Prerequisites: 15 complete; plugin protocol from 05. Each provider's backend acceptance precedes its UI.  
Progress: [Session log and current status](../progress/16-official-integrations.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Implement the named optional integrations through the public plugin protocol. Keep Core functional with every integration disabled.

**Execution override (2026-09-21): [All audit work is suspended — no audit for now](../AUDIT-SUSPENSION.md). Continue the non-audit portions of this module; suspended work remains unchecked.**

## Ordered checklist

### Step 16.1 — Establish provider conformance and security fixtures

- [ ] **16.1a** Define reusable provider tests for enable/disable, invalid config, secret rotation, timeout, outage, revocation, namespace isolation, and version compatibility.
- [ ] **16.1b** Refresh Context7/official provider documentation for each implementation; record verified endpoints, supported protocols, capability scope, and test environments.
- [ ] **16.1c** **Audit portion suspended — no audit for now.** Require backend configuration/secrets, safe outbound-fetch wrappers, least privilege, audited admin changes, and explicit outage policies.
- [ ] **16.1d** Provide a local SMTP test fixture and relay sandbox for conformance: authentication failure, STARTTLS and implicit TLS, timeout, rejection, transient failure, oversized message, and header/recipient injection. The fixture runs without a container runtime, consistent with the existing local test infrastructure.

### Step 16.2 — Implement backend plugins in this order

- [ ] **16.2a** Implement Internal SSO using OIDC with issuer + subject Staff identity, explicit local role mapping, signature/issuer/audience/time/nonce/state verification, trusted JWKS, and assurance propagation.
- [ ] **16.2b** Implement Turnstile, hCaptcha, and reCAPTCHA as separate optional providers; verify tokens server-side and check hostname/action/time/score when applicable.
- [ ] **16.2c** **Audit portion suspended — no audit for now.** Ensure CAPTCHA success never bypasses rate limits/authorization and required-provider outage follows explicit audited policy.
- [ ] **16.2d** Implement an email channel through the notification API with safe content encoding, trusted links, retry/dedupe, and backend-only secrets. Delivery is an adapter behind that pipeline, not a second pipeline.
- [ ] **16.2e** Implement outbound webhooks with delivery ID, timestamp, HMAC signature, key rotation, bounded retry/DLQ, and SSRF-safe destinations/redirects; add receiver verification/replay fixtures.
- [ ] **16.2f** Implement GitHub integration with optional project association, minimal scopes, event validation, durable synchronization, conflict/loop prevention, and rate-limit handling. Do not introduce a repository requirement into Core.
- [ ] **16.2g** Verify external-service access through scoped, expiring/revocable capabilities and public Domain/Plugin APIs; no arbitrary Core SQL.
- [ ] **16.2h** Accept each provider independently on both deployment profiles using conformance fixtures and authorized provider test accounts where available. Label mocked-only coverage explicitly.
- [ ] **16.2i** Implement the self-contained SMTP transport adapters: a Worker client over `cloudflare:sockets` supporting only implicit TLS on port 465 or STARTTLS on port 587 (outbound port 25 is prohibited) against a publicly reachable relay with mandatory certificate validation and SASL authentication, and a Node adapter sharing one protocol layer over `node:net`/`node:tls` that may reach a private relay. Bound response parsing, timeouts and message size; reject CRLF header/recipient injection; keep credentials encrypted through the KeyProvider and out of logs; provide bounded retry with idempotent delivery keys and optional DKIM signing. Keep Cloudflare Email Service as an optional adapter, limited on Free to verified destination addresses. Follow [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md).

### Step 16.3 — Add controlled frontend integration and release

- [ ] **16.3a** After each provider backend passes, refresh web guidance and add settings/SSO/CAPTCHA interactions through build-time extension points.
- [ ] **16.3b** Review declared CSP origins and lazy-load optional provider resources. Distinguish reviewed fixed provider SDK origins from arbitrary plugin-code URLs.
- [ ] **16.3c** Verify accessibility, blocked scripts, CSP errors, token expiry, provider outage, role changes, and configuration secrecy in browser tests.
- [ ] **16.3d** Publish English installation/configuration/trust/upgrade/removal guides, plugin API compatibility ranges, and tested provider/profile versions.
- [ ] **16.3e** Run release checks per provider and verify disabling all plugins preserves the full Core MVP workflow.
- [ ] **16.3f** Publish the email transport guidance in both reader languages: relay requirements, TLS and authentication, credential storage and rotation, retry and deduplication behavior, the free-tier limitation to verified destination addresses, and an explicit statement that deliverability depends on the operator's relay and that direct-to-MX delivery is not supported.

## Explicitly deferred

SAML/LDAP/SCIM, additional chat/forge providers, AI, vector search, realtime collaborative editing, and hosting untrusted third-party runtime code require separately scoped plans. Defining an external protocol does not implement an arbitrary code execution platform.

## Acceptance evidence

Each completed official plugin uses the same published SDK/API available to third parties, preserves Core policy, and has its own provider compatibility and outage evidence.

## Source coverage

PRODUCT §§5, 23–28, 30–31; TECH-STACK §§42–44; SECURITY §§24–27, 89–98, 106–123, 139–159; PERFORMANCE §§43, 47–51.
See [FREE-TIER-PROFILE](../../FREE-TIER-PROFILE.md) for the SMTP transport constraints and free-tier email limitations in 16.1d, 16.2d, 16.2i and 16.3f.

