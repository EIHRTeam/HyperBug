# Module 10 — Authorized auth-page CSP repair review

Date: 2026-10-11. Scope: user-authorized narrow Module04 repair for10.2d. Primary-agent focused source/security review; no independent reviewer claimed. Decision: [ADR0015](../../decisions/0015-authorize-callback-form-action.md).

## Reviewed boundaries

| Boundary | Finding |
| --- | --- |
| Origin authority | GET authorize, POST login (including credential failure), POST consent (including lost-session fallback) all call validateAuthorizeQuery before rendering. Registry validation still requires exact client/redirect/scope and code/S256 protocol. There is no unvalidated page caller in production. |
| Header injection | URL serialization selects only origin. Paths, fragments and query values cannot become source tokens; parser failures/non-http(s) refuse rendering. Deployment registry separately enforces HTTPS except explicitly allowed loopback development. |
| CSP scope | Login/consent include self plus one registered web origin. Error documents stay self-only. default-src none, base-uri none, frame-ancestors none and optional Turnstile origins unchanged. No wildcard/script/style allowance. |
| Forms and credentials | Actual forms retain relative same-origin action and escaping. requireAuthOrigin remains on both form POSTs. Cookies, session/code stores, PKCE/replay/expiry, business bearer/CORS and cryptographic parameters unchanged. Callback-origin/path residual risk is explicit in ADR0015. |
| Architecture/performance | Shared page builder serves both compositions. One URL parse per rendered document; no dependency, database, public DTO or background work added. |

No unresolved source defect found in the narrow repair. Wider profile/capacity/billing/release evidence remains open under the gate assessment.

## Verification

Actual Chrome155 blocked-cookie login and consent recovery pass on Node/PostgreSQL18.6 and local workerd/D1 Standard composition. Each executes its existing full MVP journey as well. Six token/business network requests omit Cookie; both code replays400, independent frontend API404, sibling CORS denial and unregistered callback400. Scalar receipts: [Node](10-node-postgres-browser.json), [workerd Standard local](10-workerd-standard-browser.json). Minimum and affected OAuth/static checks are recorded after their final results below.

Exact commands:

```sh
CI=true HYPERBUG_ACCEPTANCE_BROWSER=1 corepack pnpm test:postgres tests/postgres/acceptance-journey.test.ts --reporter=verbose
CI=true HYPERBUG_ACCEPTANCE_BROWSER=1 corepack pnpm test:workerd tests/workerd/acceptance-journey.test.ts --reporter=verbose
CI=true HYPERBUG_ACCEPTANCE_BROWSER=1 HYPERBUG_ACCEPTANCE_TIER=minimum corepack pnpm test:workerd tests/workerd/acceptance-journey.test.ts --reporter=verbose
CI=true corepack pnpm test:postgres tests/postgres/oauth-route.test.ts --reporter=verbose
CI=true corepack pnpm test:workerd tests/workerd/oauth-route.test.ts --reporter=verbose
```

Initial sandbox PostgreSQL initdb failed before tests because shared-memory allocation was denied; the same authorized fixture succeeds outside that restriction. No source invariant was bypassed. Teardown stops owned clusters/listeners/browser and removes temporary certificates/profile. No hosted resource is created. CAPTCHA success and other browser engines are outside this fixture's claim; existing evidence is retained separately.

Final affected results: Node OAuth3pass (includes actual61-second expiry), workerd OAuth2pass; Minimum browser/full journey1pass ([receipt](10-workerd-cloudflare-minimum-browser.json)). Types/lint pass. Existing OAuth diagnostic printed a disposable fixture session cookie; removed that diagnostic from the affected test before committing. No cookie is retained in repository evidence; its isolated database/session is destroyed by teardown. Removal changes diagnostics only, so the passing lane was not gratuitously repeated.
