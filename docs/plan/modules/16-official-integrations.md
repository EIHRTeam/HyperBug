# 16 — Post-MVP official plugins and isolated integration APIs

Phase: Post-MVP optional integrations  
Prerequisites: 15 complete; plugin protocol from 05. Each provider's backend acceptance precedes its UI.  
Progress: [Session log and current status](../progress/16-official-integrations.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Implement the named optional integrations through the public plugin protocol. Keep Core functional with every integration disabled.

## Ordered checklist

### Step 16.1 — Establish provider conformance and security fixtures

- [ ] **16.1a** Define reusable provider tests for enable/disable, invalid config, secret rotation, timeout, outage, revocation, namespace isolation, and version compatibility.
- [ ] **16.1b** Refresh Context7/official provider documentation for each implementation; record verified endpoints, supported protocols, capability scope, and test environments.
- [ ] **16.1c** Require backend configuration/secrets, safe outbound-fetch wrappers, least privilege, audited admin changes, and explicit outage policies.

### Step 16.2 — Implement backend plugins in this order

- [ ] **16.2a** Implement Internal SSO using OIDC with issuer + subject Staff identity, explicit local role mapping, signature/issuer/audience/time/nonce/state verification, trusted JWKS, and assurance propagation.
- [ ] **16.2b** Implement Turnstile, hCaptcha, and reCAPTCHA as separate optional providers; verify tokens server-side and check hostname/action/time/score when applicable.
- [ ] **16.2c** Ensure CAPTCHA success never bypasses rate limits/authorization and required-provider outage follows explicit audited policy.
- [ ] **16.2d** Implement an email channel through the notification API with safe content encoding, trusted links, retry/dedupe, and backend-only secrets.
- [ ] **16.2e** Implement outbound webhooks with delivery ID, timestamp, HMAC signature, key rotation, bounded retry/DLQ, and SSRF-safe destinations/redirects; add receiver verification/replay fixtures.
- [ ] **16.2f** Implement GitHub integration with optional project association, minimal scopes, event validation, durable synchronization, conflict/loop prevention, and rate-limit handling. Do not introduce a repository requirement into Core.
- [ ] **16.2g** Verify external-service access through scoped, expiring/revocable capabilities and public Domain/Plugin APIs; no arbitrary Core SQL.
- [ ] **16.2h** Accept each provider independently on both deployment profiles using conformance fixtures and authorized provider test accounts where available. Label mocked-only coverage explicitly.

### Step 16.3 — Add controlled frontend integration and release

- [ ] **16.3a** After each provider backend passes, refresh web guidance and add settings/SSO/CAPTCHA interactions through build-time extension points.
- [ ] **16.3b** Review declared CSP origins and lazy-load optional provider resources. Distinguish reviewed fixed provider SDK origins from arbitrary plugin-code URLs.
- [ ] **16.3c** Verify accessibility, blocked scripts, CSP errors, token expiry, provider outage, role changes, and configuration secrecy in browser tests.
- [ ] **16.3d** Publish English installation/configuration/trust/upgrade/removal guides, plugin API compatibility ranges, and tested provider/profile versions.
- [ ] **16.3e** Run release checks per provider and verify disabling all plugins preserves the full Core MVP workflow.

## Explicitly deferred

SAML/LDAP/SCIM, additional chat/forge providers, AI, vector search, realtime collaborative editing, and hosting untrusted third-party runtime code require separately scoped plans. Defining an external protocol does not implement an arbitrary code execution platform.

## Acceptance evidence

Each completed official plugin uses the same published SDK/API available to third parties, preserves Core policy, and has its own provider compatibility and outage evidence.

## Source coverage

PRODUCT §§5, 23–28, 30–31; TECH-STACK §§42–44; SECURITY §§24–27, 89–98, 106–123, 139–159; PERFORMANCE §§43, 47–51.

