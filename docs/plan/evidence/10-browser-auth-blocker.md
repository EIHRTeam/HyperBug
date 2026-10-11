# Module 10 — Separate-domain browser auth blocker

Date: 2026-10-11. Owning implementation: Module04, `packages/server/src/authorize-pages.ts`. Acceptance owner:10.2d. **Resolved under explicit user authorization.** The original failure below remains historical; [ADR0015](../../decisions/0015-authorize-callback-form-action.md) and [review/verification](10-auth-csp-review.md) record the narrow repair and successful both-profile browser evidence.

## Reproduction and observed result

Opt-in existing Node/PostgreSQL journey with independent HTTPS listener/callback and actual Chrome155:

```sh
CI=true HYPERBUG_ACCEPTANCE_BROWSER=1 corepack pnpm test:postgres tests/postgres/acceptance-journey.test.ts --reporter=verbose
```

Loopback maps distinct registrable sites `hyperbug-auth.test` and `hyperbug-browser.test`; TLS uses an isolated self-signed test certificate/browser exception. There is no frontend API proxy. Fresh Chrome profile explicitly blocks third-party cookies, with CDP Network.setCookieControls restrictions and a canary cookie `SameSite=None; Secure`. The canary is present first-party and absent cross-site with recorded blocked-cookie reasons before auth starts.

The existing backend login page submits to its own `/auth/authorize/login`; that handler validates the exact registered callback and returns302 to the other site. Chrome aborts navigation (`net::ERR_ABORTED`) and the document's `securitypolicyviolation` event reports `effectiveDirective=form-action`. The response policy is `default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`. Its form navigation cannot reach the cross-site callback. This confirms a product-policy blocker, rather than merely the automation limitation attributed in the historical04 browser record. No code/token/cookie/account body is written to evidence.

Initial fixture failures: a source-edit guard mismatch ran only the ordinary journey (not browser evidence); lint shadow warning repaired; synchronous child execution starved local HTTPS listeners (replaced by asynchronous execFile). Later scalar-only diagnostics confirmed the CSP violation. These failures do not close10.2d. The test services, Chrome and temporary certificate/profile are removed by each owned fixture's teardown.

## Concrete repair prepared for scope approval

Prepared review patch: `/tmp/hyperbug-10-auth-csp-proposal.diff` (not applied). Pass the already validated exact client redirect URI into the login/consent document builder and append **only its serialized origin** to those pages' `form-action`. Keep `'self'`, default-src/base-uri/frame-ancestors and all exact server redirect validation, PKCE/single-use/CSRF/cookie rules unchanged. Error pages retain the original self-only policy; no wildcard, script permission, new endpoint, frontend proxy or persistent token is proposed.

Release impact: the existing top-level HTML login/consent form path currently fails across registrable sites in Chrome. A focused security review/ADR must record why the registered callback origin is trusted for the redirect and why unrelated destinations remain denied; source parameters must come only after `validateAuthorizeQuery`, never directly from unvalidated query strings. Regression verification would cover header scoping, malicious/unregistered redirects, login/consent cross-site callbacks and actual cookie-free browser exchange/business requests on both backend profiles. The callback-origin CSP allowance is a deliberate policy change, not a silent test bypass.

HANDOFF-10 limits implementation to its batch IDs and says to stop/report an out-of-list defect for its owning module. Applying this Module04 CSP repair requires an explicit scope extension; no approval is inferred from the browser requirement.10.2d remains unchecked,10.G4 unmet, global G1 Not passed and SPA blocked. Even a verified repair cannot satisfy the excluded actual Standard requirement.

## Lookup and compatibility

Context7 resolve/query2026-10-11: Playwright `/microsoft/playwright`, Miniflare via `/cloudflare/workers-sdk` (direct Miniflare resolution unavailable; SDK README/type declarations supply HTTPS options). Playwright docs cover persistent profiles/CDP sessions but not current cookie restriction semantics; a focused Chrome canary verifies enforcement. modern-web-guidance search then retrieve `security`,2026-10-11: secure contexts, Secure/HttpOnly cookies, CSP, exact CORS and no unsafe DOM sinks applied. Fetch/URL/Web Crypto/semantic forms use existing Baseline Widely Available mechanisms; Chromium CDP is test tooling only, not a product dependency or compatibility promise. No additional package installed.
