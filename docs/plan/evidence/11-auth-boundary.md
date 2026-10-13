# Module 11 B1: browser auth boundary

Date: 2026-10-13. Scope: 11.2a–e; no backend change or hosted traffic. G1 remains Not passed, Module 10 Blocked, 13.G6 open.

## Result and focused review

Top-level public-client PKCE S256 uses fresh 256-bit state and verifier, exact callback and an allowlisted return route. Transient per-tab redirect state is origin-bound, accepted for five minutes, removed before exchange and discarded on invalid/abandoned attempts. Callback URL data is stripped before config fetch; startup failure also removes state. Token exchange runs once before React/StrictMode mounts. No access/refresh token enters browser storage, URL, React state, Query cache or logs.

The public API client supplies omitted credentials, no-store, no-referrer and no replay for auth mutations. Expiry and denied credentials/permissions abort in-flight business requests and clear private query/mutation state. Epoch checks reject late results; epoch-keyed route content clears local forms at identity boundaries. Browser edit proof remains B3; no Module 12 editing workflow is added. API-only sign-out discards memory immediately, revokes the captured bearer and sends only a token-free same-origin tab event. The separate first-party authorization cookie session remains active; UI explains this accepted protocol distinction.

Focused security review: no auth policy/contract change, iframe, persistent credential, cookie-bearing business request, client-side authorization substitute, runtime code loading or CSP relaxation. Callback mismatch/replay/expiry/origin/duplicate-state cases deny before exchange. Public instance metadata is the only retained cache. Arbitrary sensitive errors/payloads are not surfaced.

## Commands and environment

Node 24.21.0, pnpm 11.26.0, React19.3.0, TypeScript7.0.2, Vite8.3.4, Query5.104.2.

- `corepack pnpm --filter @hyperbug/web typecheck`, `lint`, `format:check`, `build`: pass after correcting erasable-syntax parameter properties, native output semantics and scoped formatting.
- `corepack pnpm test:unit tests/unit/web-auth.test.ts tests/unit/web-foundation.test.ts`: foundation5 pass; initial auth import fails because Query belongs to the web workspace. Explicit test-local createRequire resolves that workspace. Auth3 then pass after replacing a nonexistent fixture Mutation.setState API with the actual initial-state constructor.
- `node node_modules/typescript/bin/tsc --noEmit`: pass, including fixtures/tests. Scoped fixture lint/format and `git diff --check`: recorded in B1 log.
- `node tooling/postgres-test-cluster.mjs node --import tsx tests/fixtures/web-browser-local.ts --hold`: real PostgreSQL18.6 private socket, real Node/Elysia routes, real Chrome155.0.8059.40 across hyperbug-browser.test and hyperbug-auth.test. Generated TLS certificate temporarily trusted in user keychain; no TLS bypass. Login, reload/token loss, explicit top-level consent/recovery, bearer revocation401 and seven cookie-free requests pass.

[Scalar browser receipt](11-browser-auth.json): a first-party canary is present while the cross-site canary is blocked with UserPreferences. Browser local/session storage, IndexedDB, Cache Storage and readable frontend cookies are empty after both login and logout; callback count2, final URLs and browser console token-free. The first probe failed under app connect-src; the probe now runs in its isolated fixture document, leaving the app policy unchanged. The fixture remains held for B2/B3 and must be terminated with certificate/database/listener cleanup verified at closure.

Context7 resolve/query and mandatory modern-web action searches/retrieval are recorded in [FRONTEND](../../development/FRONTEND.md). No dependency was added. Reader guidance will be synchronized during B3. No hosted/Workers/full browser or release acceptance is claimed.
