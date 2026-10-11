# ADR 0015: Registered callback origin in authorization-page CSP

Date: 2026-10-11. Status: Accepted by explicit user authorization for the narrow Module04 CSP repair; runtime verification is recorded in the [review](../plan/evidence/10-auth-csp-review.md).

Owners: Module04; acceptance dependency10.2d. Refines the backend-owned page implementation described in [API conventions](../API-CONVENTIONS.md), without changing the OAuth protocol or registered client contract.

## Problem and decision

Chrome enforces `form-action` on a native form submission's redirect chain. The self-only login/consent policy prevented the existing registered cross-site callback, even though the form POST goes to the authorization origin. The [browser finding](../plan/evidence/10-browser-auth-blocker.md) reproduced this with an actual securitypolicyviolation witness.

For login/consent documents only, append the serialized origin of the already validated exact registered callback URI to `form-action 'self'`. Every renderer caller validates client/redirect/scope/protocol before page construction. Include only one callback origin for that request; never concatenate the raw URI, paths, query values, all clients, a wildcard or a scheme-wide source. Defensively reject non-web protocols in the policy builder. Registry/error pages retain self-only form-action. All other directives and CAPTCHA provider pins remain unchanged.

## Trust boundary and residual risk

The browser policy now permits a form navigation to any path at that one origin. This is broader than the exact callback path enforced by the server. A hypothetical markup-injection failure could direct a form there; the registered client origin is therefore trusted for this navigation. All current form actions remain backend-relative and all interpolations are HTML-escaped; no script/style permission is added. The server continues to validate the exact URI before issuing a single-use PKCE S256 code. Session cookies remain Secure/HttpOnly/first-party and business API requests require bearer tokens with credentials omitted. No browser-persistent credential or API proxy is introduced.

This deliberate CSP allowance requires security ADR/review under SECURITY154–155. The user explicitly authorized it after reviewing the prepared narrow patch. It does not authorize any other CSP relaxation or an unrelated module change.

## Verification and release impact

The focused review covers every page caller, origin serialization/header injection, denied clients/redirects, unchanged CSRF/PKCE/cookies and both backend browser fixtures. Actual Chrome and independent HTTPS sites prove login plus top-level session recovery while third-party cookies are blocked. Local workerd/D1 remains emulation; this is not a paid Workers measurement. No staging/production deployment occurred. Rollback removes the optional callback source and restores the known cross-site Chrome failure; no database transition is needed.

Context7 resolve then query on2026-10-11 selected `/mdn/content`: [MDN form-action](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/form-action) explicitly notes inconsistent browser redirect enforcement. modern-web-guidance `security` (retrieved2026-10-11) applies exact sources, secure cookies and no unsafe DOM sinks. Existing URL/CSP/native-form mechanisms remain within Baseline Widely Available; no new browser capability or fallback dependency is introduced. The actual Chrome proof establishes the tested browser scope, not a Safari/Firefox test claim.
