# Phase 03 security foundation evidence

Started: 2026-09-19; updated: 2026-09-25. Status: **policy, credential/envelope mechanisms, durable key lifecycle and CORS accepted; module 03 remains In progress**. Scope: 03.1a–03.1d, 03.2a–03.2d and 03.3b; 03.3f cache/failure policy remains partial. This report does not claim password hashing, distributed rate limiting, audit access or SSRF acceptance.

## 03.V1 cross-runtime crypto acceptance — 2026-09-25

The shared `/_proof/crypto` HTTP case ran in Node 24.21.0 and local Miniflare/workerd. Each runtime returned four true platform known answers (NIST AES-256-GCM, RFC 3394 AES-256-KW, RFC 4231 HMAC-SHA-256 sign and native verify) and all 37 credential/envelope scenarios true. The scenarios include component tampering, every AAD context field, previous/current key rotation, credential digest migration, DEK rewrapping without ciphertext/IV change, revocation and provider failure. The test invokes platform Web Crypto; it implements no cipher, MAC or key-wrap primitive.

The separate durable proof ran in Node against the real PostgreSQL 18.6 adapter and inside workerd against the real local D1 adapter. It passed eight checks per runtime for retained-reference removal denial, rewrap and current-key decryption, immediate next-operation revocation denial, and eventual removal after the protected record is deleted. The repository suites also exercise independent instances and atomic lifecycle transitions. This combines the earlier known-answer/service evidence with the later 03.2d persistence evidence and satisfies the exact 03.V1 checklist wording.

- `corepack pnpm exec vitest run --project node tests/node/http.test.ts`: 20/20 passed.
- `corepack pnpm exec vitest run --project workerd tests/workerd/http.test.ts`: 22/22 passed.
- `corepack pnpm exec vitest run --project workerd tests/workerd/repository.test.ts`: 43/43 passed.
- `corepack pnpm test:postgres -- tests/postgres/repository.test.ts`: 41/41 passed on an isolated local PostgreSQL 18.6 cluster.

This is local runtime and real-adapter evidence, not a deployed Workers/provider, live KMS, backup restore or production key-administration claim. 03.V2–03.V7 and the remaining implementation items retain their separate gates; audit work and Argon2id performance testing remain suspended/stopped under the current user instruction.

## Implementation and checklist mapping

| Item | Artifacts | Evidence |
| --- | --- | --- |
| 03.1a | `docs/SECURITY-FOUNDATION.md`, ADR 0005, config/security schema, security/classification | Trust-boundary/classification map; invalid config, debug, wildcard, coercion and budget tests; immutable policy objects |
| 03.1b | `packages/security/src/authorization.ts` | 35 identical permission/provider scenarios on Node and workerd, plus host unit execution; exact actor/action/object/project checks, User/Staff split, public/private/archived behavior, suspension/revocation/expiry, role/assurance/recency, malformed facts, timeouts and snapshot isolation |
| 03.1c | server errors/input/bounds, observability, runtime config | HTTP depth/cardinality/string/query rejection on both runtimes; safe errors even for tampered expected exception text; no seeded secrets in diagnostic output; unique server request IDs; staging/production debug rejection |
| 03.1d | `SecurityConfig.retentionSeconds`, foundation specification | Seven independent immutable retention values, bounded validation and cutoff/controlled-cleanup semantics; no automatic purge is claimed |
| 03.3b | server/cors, shared HTTP contract | Exact allowed/rejected/opaque/lookalike origins, errors with CORS headers, no-Origin transport clients, explicit preflight methods/headers, duplicate rejection, 300-second max-age and Vary; no cookie credentials |
| 03.3f (partial) | Foundation specification, late shared no-store guard, outbound no-store subrequests, authorization resolver | Current no-store behavior, including native/immutable handler responses and errors, an outbound transport option, and authorization fail-closed behavior tested. Live Workers cache and concrete key/token/required-CAPTCHA/plugin providers remain later work; item stays unchecked. |

The no-Origin test carries a seeded bearer header to prove transport eligibility. It does not validate a real token; module 04 owns real authentication. These are server policy/ports and minimal protocol fixtures, not product endpoints or SPA work.

## First HTTP/policy increment verification

Environment: macOS, Node 24.21.0, pnpm 11.26.0, TypeScript 7.0.2, Elysia 1.4.30 / @elysia/node 1.4.6 / srvx 0.11.22; pinned workerd via Miniflare 5.20260916.0-alpha; local PostgreSQL 18.6 (Homebrew). No dependency added by this security increment.

- `corepack pnpm typecheck`: passed Node and Cloudflare configurations.
- `corepack pnpm lint`: passed warnings-as-errors and package boundaries.
- `corepack pnpm format:check`: passed, 92 checked files at this checkpoint.
- `corepack pnpm test`: **99 passed**: unit/contract 16, Node 17, workerd 42, PostgreSQL 24. The runtime lanes run in separate processes, as required by foundation guidance.
- `corepack pnpm build`: passed both production artifacts and test fixtures. Node artifact remains one file; Workers artifact remains chunked. Entry tests verify fixture routes are absent.
- `corepack pnpm scan:secrets`: passed known-signature scan. This is not a claim of exhaustive secret detection.
- `corepack pnpm docs:build`: passed VitePress build and page rendering.
- One-off documentation validation passed 7 focused engineering files, 26 local links/anchors, the five completed checklist IDs, and matching bilingual page paths. Scoped `git diff --check` passed. The full working-tree check found unrelated trailing whitespace at `docs/.vitepress/config.ts:83`; that concurrent config edit was preserved.
- Not run: hosted CI, live Cloudflare deployment, live external providers, password/crypto benchmark, audit permission service, distributed rate tests and SSRF acceptance. G1/G2 remain closed.

## Reproduced failure and correction

Initial complete Node runs consistently failed the existing cooperative-disconnect test with `ECONNRESET` after about six seconds. Isolated and partial groups sometimes passed; instrumentation-only success was not accepted as a fix. Low-overhead request/response tracing showed both preceding 413 responses finished with `IncomingMessage.complete === false`, followed by a reused connection timing out before the next streaming request completed. No request bodies, tokens or live identities were traced. Temporary instrumentation was removed.

`apps/api-node/src/rejected-request.ts` now uses srvx's documented runtime Node request/response primitives to set `shouldKeepAlive=false` and `Connection: close` for an error response while its body is incomplete. The response is sent before closure; no unbounded drain and no blanket keep-alive disablement are introduced. The shared server exposes only a runtime-neutral rejection-cleanup callback; production Node and its fixture supply the adapter, while Workers retains its own transport.

The regression uses a real Node HTTP agent with one keep-alive socket and deliberately unfinished Content-Length and chunked bodies. Each gets a complete 413 with Connection: close and a successful subsequent health request. The complete Node lane passed after this correction, then the full 99-test matrix passed. This explains and fixes the reproduced early-body reuse path; it does not claim to explain every historical transport failure.

## Current documentation research

Context7 resolve-then-query on 2026-09-19 selected `/elysiajs/documentation`, `/h3js/srvx` and `/websites/nodejs_latest-v24_x_api`. Elysia results included lifecycle/error handling and older blog material; the exact installed AOT adapter behavior was therefore validated on both runtimes. The first Elysia query did not substantiate the early-body reset; no documentation proof is claimed for that gap. srvx documentation confirmed access to `request.runtime.node.req/res`; its latest source examples differ from installed 0.11.22 and were checked against installed source and the focused regression. Node docs confirmed incomplete-message semantics and response-header behavior.

References:

- [Elysia lifecycle](https://github.com/elysiajs/documentation/blob/main/docs/essential/life-cycle.md)
- [srvx runtime request access](https://github.com/h3js/srvx/blob/main/docs/1.guide/2.handler.md)
- [Node 24 HTTP](https://nodejs.org/docs/latest-v24.x/api/http.html)

No HTML/CSS/client-side JavaScript changed in this increment, so modern-web implementation guidance was not newly triggered. Reader Markdown is synchronized in English and Simplified Chinese.

## Focused security and cost review

Self-review of this bounded increment (not an independent audit) checked that permission facts are bound to actor/action/resource/project, provider failures cannot become success, public visibility cannot expose audit/admin data, User membership cannot elevate to Staff, and sensitive actions enforce both role and verified recent assurance. Resolvers are trusted server code and future credential/grant implementations must load current state; this evaluator is not a sandbox or transaction boundary.

Reviewed error/telemetry output as allowlisted fields, including unknown fields and malicious expected-error messages. Reviewed CORS actual requests and preflights separately; no-Origin eligibility never bypasses authentication. JSON parsing remains byte-bounded; depth is checked before parsing and iterative cardinality checks precede framework validation. Shared cache remains disabled. Retention settings cannot delete records, extend sessions or silently discard audit.

Review corrections: reject wildcard hostnames accepted by URL parsing, avoid numeric coercion of booleans/whitespace/exponents, restrict Staff writes to current membership even in public projects, catch malformed authorization facts, and close Node connections after rejecting unread bodies. No cryptographic primitive, unreviewed key provider, browser credential store, framework/database replacement or normative security relaxation was introduced. Remaining high-cost crypto/rate/outbound work requires its own measurements.

## Credential/envelope/key-source increment

Accepted scope: **03.2a–03.2c**. ADR 0006 and [CRYPTOGRAPHY](../../CRYPTOGRAPHY.md) define the format/ownership boundaries. Shared services implement 32-byte CSPRNG opaque tokens, HMAC-SHA-256 digests/native verification, contextual AES-256-GCM with a new DEK per value, AES-256-KW wrappers, previous/current digest migration, DEK rewrapping, bounded blind-index candidates and strict versioned records. Both key-source adapters require a separate authoritative lifecycle; no permissive default exists.

At this increment, the lifecycle fixture was explicitly **not** a production registry. Revocation, missing retained backup keys, provider failures/timeouts and rotation mechanics were tested against that port, while 03.2d and 03.V1 still awaited real D1/PostgreSQL persistence, atomic references and controlled removal. The later durable-lifecycle section below supplies that evidence; the 2026-09-25 runtime rerun at the end of this report closes 03.V1.

### Runtime and source evidence

- Four platform known-answer results pass on Node and inside workerd: NIST CAVP AES-256-GCM, RFC 3394 AES-256-KW, RFC 4231 HMAC-SHA-256 signing and native verification.
- 37 shared service scenarios pass on both runtimes: credential format/verification/tamper/context/purpose, plaintext round-trip, separate DEKs/nonces, bounded parsers, unknown record metadata, each encrypted component's tamper, every AAD context field, current/previous migration, wrapper-only rotation, context validation before rewrap, blind-index rotation, old-key revocation, current-key continuity, missing retained-backup material, provider outage/timeout/malformed policy, duplicate material and nonextractable long-lived keys.
- A real POSIX file test covers private file reads, 0400/0600 versus 0644, missing files, symlinks, directories, cancellation, oversize/malformed content and atomic replacement. File reads are bounded independently of stat and reject detected in-place changes.
- A Miniflare Worker binding test loads the provider through `env.HYPERBUG_KEY_RING` and rejects an absent binding. This verifies local binding semantics, not a live cloud secret upload.
- `secrets.required` was added consistently across Wrangler local/staging/production; types were generated using the installed `pnpm types:cloudflare` command. Root dependency pins are unchanged. The lockfile adds exactly two workspace links to `@hyperbug/security` and no external resolution change.

Latest complete verification: frozen installation, generated Worker types, `typecheck`, `lint`, `format:check` (99 files), **`test`: 105 passed** (unit/contract 18, Node 19, workerd 44, PostgreSQL 24), both production/fixture builds and secret signature scan pass. The new reader documentation build is verified separately at the handoff. No live deployment, remote mutation, new production secret, hosted CI or password benchmark occurred.

Initial cross-profile type checking caught Workers' generic CryptoKey/CryptoKeyPair generateKey result, absent DOM-only algorithm interfaces and wider typed-array encoder return types. The implementation now validates/narrows actual key types/algorithm properties and creates owned ArrayBuffer-backed bytes, rather than adding unchecked casts or disabling a type lane.

### Research and vector provenance

Context7 lookup on 2026-09-19 used `/websites/nodejs_latest-v24_x_api` and resolve-then-query `/llmstxt/developers_cloudflare_workers_llms-full_txt` for Web Crypto, Workers node:crypto, static Wasm support, secret declarations/type generation and Node file APIs. Workers docs confirm native AES-GCM/AES-KW/HMAC, native Argon2 absence and precompiled Wasm requirements; password implementation suitability remains unproven. Current Workers best practices and `@cloudflare/workers-types` 5.20260919.1 were downloaded for read-only comparison. Installed version pins remain unchanged.

- [Cloudflare Web Crypto matrix](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)
- [Cloudflare Node crypto exceptions](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)
- [Workers Wasm](https://developers.cloudflare.com/workers/runtime-apis/webassembly/)
- [Wrangler required secrets](https://developers.cloudflare.com/workers/wrangler/configuration/#secrets-configuration-property)
- [Node 24 Web Crypto](https://nodejs.org/docs/latest-v24.x/api/webcrypto.html) and [file APIs](https://nodejs.org/docs/latest-v24.x/api/fs.html)
- [NIST GCM vectors](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/mac/gcmtestvectors.zip): `gcmEncryptExtIV256.rsp`, Keylen=256, IVlen=96, PTlen=128, AADlen=128, Taglen=128, Count=0. Archive SHA-256 `f9fc479e134cde2980b3bb7cddbcb567b2cd96fd753835243ed067699f26a023`.
- [RFC 3394 §4.6](https://www.rfc-editor.org/rfc/rfc3394#section-4.6), 256-bit KEK wrapping 256-bit data. Retrieved text SHA-256 `faa400c69c22e5f4a911222dc19c17091931a4b8c0658adc7011163e63b253ff`.
- [RFC 4231 §4.7](https://www.rfc-editor.org/rfc/rfc4231#section-4.7), test case 6. Retrieved text SHA-256 `72178527ce93500e730bc8eb182b857e583096d652b64ece0879c52ba1df973b`.

### Focused crypto/key-source review

Self-review checked platform-only primitives, purpose-separated material and MAC domains, unique-per-DEK nonce usage, immutable context/key-reference snapshots before awaits, native authentication before returning plaintext or rewrapping, nonextractable long-lived keys, bounded encodings/secret documents and safe provider errors. No cipher primitive is implemented in source or tests. Public known-answer bytes are not production secrets.

Reviewed file source for symlink/FIFO/directory/permission/ownership/size risks: O_NOFOLLOW/O_NONBLOCK, regular-file and running-UID check, 0400/0600 only, bounded actual reads, before/after metadata check, zeroed owned buffers and closed handles. Parent directory/ACL protection and atomic replacement remain operator requirements; unsupported ownership semantics require another reviewed provider. Reviewed Worker factory for plain-secret binding use, no beta-only dependency, no vars fallback, no request-global cache and generated binding types.

Provider lifecycle state is fetched afresh, deadline failures deny use, and retained versions cannot be omitted unnoticed. Persistent lifecycle correctness and multi-instance concurrency are deliberately unclaimed until the next batch. Blind-index queries are capped at three key versions; exact envelope/token key reads may retain up to 32 references. Password/PQ decisions remain outside this ADR and cannot be inferred from AES/HMAC tests.


## Durable lifecycle acceptance (03.2d)

Implemented an infrastructure-free `KeyRegistry` port and strict mutation/record validation, with separate D1 and PostgreSQL adapters. Migrations **0005–0006** add five tables (30 total), immutable key identities/transition guards, backup pins, protected payload/reference ownership and ordered covering indexes. All prior 0000–0004 migration SQL/snapshots remain unchanged. Only two additional workspace links were added; no external dependency/version changed.

Fresh primary reads and a generation guard serialize activation/revocation/removal, record revisions and backup state transitions. D1 batch CHECK failures abort zero-row/stale preconditions. PostgreSQL uses a primary transaction with one-second statement/lock limits. Successful operations append one sanitized audit row atomically. Provider functions still require this policy; production health-only roots expose no credential or key-administration route.

### Verified outcomes

Thirteen added database/runtime cases run in each profile (D1 repository suite 38, PostgreSQL suite 37). They cover independent-instance current/previous/revoked views; no revival of revoked/removed identities; competing generation writes with exactly one successful audit; complete rollback when audit insertion fails; record payload/reference/revision atomicity; outdated-key write denial; DB removal/identity guards; capture/rotation races; pinned backup retention after expiry; explicit destruction attestation; three-version blind-index and 32-active-key bounds; retained-material omission; cancellation/malformed commands; and query cost. An eight-check envelope lifecycle proof runs **inside workerd** and Node against the real corresponding adapters, including unchanged ciphertext/IV after rewrap, retained reference removal denial, current-key decryption and immediate next-operation revocation denial.

The integrated provider test also exercises credential migration and blind-index candidates against real databases and checks audit rows for seeded plaintext, address, token, ciphertext and digest leakage. Internal mutation identity is the fixed `core.key-registry` system actor; authenticated administration and permission-aware audit access remain separate unfinished modules/services. These tests do not claim live provider backup creation/destruction or restore reconciliation.

Latest complete suite: **133 passed** — unit/contract 20, Node 19, workerd 57, PostgreSQL 37. `typecheck`, `lint`, `db:check`, build, secret scan and docs build pass. Frozen offline install passes. Scoped formatting and diff checks pass. Full-tree `format:check` currently reports concurrently added `.vscode/settings.json`; full-tree `git diff --check` reports pre-existing/concurrent trailing whitespace in `docs/.vitepress/config.ts:83`. Neither file was rewritten by this security work. The initial new positive lint fixture failed because its imported type was unused; exporting that type now tests the intended allowed dependency, while forbidden reverse/server/relative imports still fail.

Wrangler 4.133.0 applied 0005 and 0006 to the **local** existing D1 development database. The normal PostgreSQL migration runner proves fresh application, no-op and checksum mismatch on a disposable PostgreSQL 18.6 cluster. No deployment, remote migration, hosted CI, commit or PR was performed. These migrations have now run locally and must be preserved; future corrections use another migration.

### Measured query bound and focused review

On 2026-09-19, the actual adapter snapshot query was measured with 4,000 protected records, 500 retained backup manifests/references, three active keys and 4,000 additional removed-key tombstones. Thirty reads were measured after setup/ANALYZE. D1 includes loopback HTTP into workerd; PostgreSQL uses a local Unix socket. Host: Apple M4 Pro, macOS 15.7.9, Node 24.21.0, pnpm 11.26.0, Miniflare 5.20260916.0-alpha and PostgreSQL 18.6. d1: median 2.318 ms, p95 3.271 ms; postgres: median 0.090 ms, p95 0.139 ms. These are local observations, not provider/SLA promises. Exact samples/plans: [D1](03-d1-key-registry-query.json), [PostgreSQL](03-postgres-key-registry-query.json).

The first PostgreSQL plan used sequential scans for correlated EXISTS misses (about 4,000 retained rows examined for an absent reference). Migration 0006 adds ordered covering lookup columns and a partial active-key index. The revised scalar `ORDER BY ... LIMIT 1` probes use `protected_record_key`, `key_backup_reference_key` and `key_active_versions` on both profiles. Tests assert one snapshot statement and those indexes; PostgreSQL has no sequential scan in the measured plan. Each reference probe returns at most one row, and the final snapshot caps at 33 to detect violation of the 32-key limit. Historical tombstones do not join the active snapshot.

Focused self-review (not an independent audit) covered key identity permanence, primary routing, one-snapshot consistency, copied inputs before awaits, transaction guard behavior under races, backup capture barriers, no automatic expiry release, reference/JSON agreement, source omission/revocation denial and audit rollback/redaction. Review preserves global-key administration as an internal capability, never a project-admin endpoint. Restores must reconcile current revocations and all retained-backup manifests before enabling credential service; module 13 owns real backup/restore orchestration. Global mutation serialization and the bounded generation are explicit throughput/lifecycle constraints; module 04/10 must measure realistic identity load and may not remove consistency checks to improve throughput.

### Current documentation lookup

Context7 resolve-then-query on 2026-09-19 used `/llmstxt/developers_cloudflare_d1_llms-full_txt`, `/websites/postgresql_18` and `/drizzle-team/drizzle-orm-docs`. D1 documents transaction rollback for batch failure and fresh first-primary sessions; PostgreSQL documents row locks and transaction snapshots. Drizzle docs confirmed named migration generation; exact emitted SQL and indexes were inspected and verified using installed 0.31.10/0.45.2 rather than assuming the latest documentation output format.

- [D1 database/batch/sessions](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [Drizzle migration naming](https://orm.drizzle.team/docs/drizzle-kit-generate)

03.2d is accepted on this evidence. At this checkpoint, 03.2e–03.2f, remaining 03.3 and all final 03.V items were still open. Later checkpoints completed 03.2f and 03.V1; the full Phase 03 goal stays active.

## Late private-cache guard (03.3f partial; 2026-09-25)

The global `onRequest` no-store default did not control a native `Response` carrying `Cache-Control: public, max-age=3600`: the first new regression failed in both Node and Miniflare/workerd with that public header. A shared `onAfterHandle` guard now reapplies no-store to the framework header set and native responses. If a response has immutable headers, it creates an equivalent streamed response with no-store. The error hook explicitly sets no-store; existing preflight handling retains its no-store request default. This is a concrete fix for the current private-only API, not authorization for a public-cache path.

After the fix, `corepack pnpm exec vitest run --project node tests/node/http.test.ts` passed 20/20 and `corepack pnpm exec vitest run --project workerd tests/workerd/http.test.ts` passed 22/22 on Node 24.21.0 and local Miniflare/workerd. The shared case covers a native response's public cache header, a handler replacing `set.headers`, and an immutable redirect response. Both `corepack pnpm typecheck` configurations, `corepack pnpm lint` with workspace boundaries, `corepack pnpm docs:build`, `corepack pnpm scan:secrets`, scoped `oxfmt --check` and `git diff --check` passed. A one-off check passed seven affected engineering documents, 127 relative links, open 03.3c/03.3d/03.3f/03.V3 states and the audit suspension marker; its first run failed on an incorrect literal suspension-text assertion, corrected without changing the documents. Context7 resolve-then-query on 2026-09-25 used [Elysia lifecycle hooks](https://github.com/elysiajs/documentation/blob/main/docs/essential/life-cycle.md) and [handler headers](https://github.com/elysiajs/documentation/blob/main/docs/essential/handler.md); the actual installed Elysia 1.4.30 Node/workerd behavior was verified by the failed-then-passing tests. Local emulator/HTTP tests do not prove an external CDN configuration. Key/token/CAPTCHA/plugin providers and their fail-closed integration remain open, so 03.3f stays unchecked.

## Optional minimum-tier password mechanism (03.2g partial; 2026-09-25)

The separate [tier evidence](03-deployment-tier-validation.md#2026-09-25-partial-password-mechanism-checkpoint) records the strict PBKDF2/pepper mechanism, dual-dialect `0008_password_pepper` upgrade, real-adapter rotation/backup proof and the final 193-test local suite. The production iteration count and reviewed floor require real Cloudflare Free measurement under 03.V7; startup provisioning, account integration and independent 13.G6 acceptance are still missing. This mechanism does not satisfy standard-profile Argon2id acceptance, and no Argon2id performance or suspended audit work was resumed.

## Late exact-origin and security-header guard (03.3b follow-up, 03.3f partial; 2026-09-25)

A new shared HTTP regression gave a native handler `Response` an unapproved `Access-Control-Allow-Origin: https://evil.test`, credentials permission, attacker request ID, unsafe content-type option and public cache header. It failed in both Node and local workerd: the native response emitted the unapproved origin despite the earlier `onRequest` exact-origin check. This was a demonstrated response-policy gap, not a theoretical header concern.

The shared application now snapshots its generated request ID and validated request-specific CORS policy before handing control to a route. The late response hook removes handler-supplied `Access-Control-*`, `Vary`, request ID, `nosniff` and cache values from both `set.headers` and native `Response` headers, then applies the trusted snapshot. Immutable native headers are cloned into an equivalent response; the error hook repairs handler-modified headers as well. No-Origin requests receive no `Access-Control-Allow-Origin` or credentials permission. The existing exact-origin request rejection remains unchanged.

Focused HTTP suites passed Node **22/22** and Miniflare/workerd **24/24** after the fix. They exercise hostile native headers, uppercase handler `set.headers` replacement, an error thrown after header modification and an immutable redirect, with exact origin, no credentials, `Vary: Origin`, server UUID, `nosniff` and no-store assertions. The final `corepack pnpm test` run passed **195/195** (unit/contract 49, Node 30, workerd 73, PostgreSQL 43); both typechecks, lint/boundaries, profile/fixture builds, docs build, secret scan and scoped source formatting passed. A four-document check passed 147 local links, whitespace, the open 03.3f checklist and audit-suspension marker; scoped `git diff --check` passed. The PostgreSQL lane is a broad regression check; this response change does not alter persistence.

Context7 resolve-then-query on 2026-09-25 selected `/elysiajs/documentation` (high reputation, 2,450 snippets). The [handler guide](https://github.com/elysiajs/documentation/blob/main/docs/essential/handler.md) documents `set.headers`; the [lifecycle guide](https://github.com/elysiajs/documentation/blob/main/docs/essential/life-cycle.md) documents `mapResponse` header merging but does not settle this installed native-response precedence. The failing then passing Node 24.21.0/Elysia 1.4.30 and local workerd tests establish the actual behavior for these versions. Deployed CDN/ingress behavior, public-cache policy and key/token/CAPTCHA/plugin provider failure integration remain open; full 03.3f and related deployment acceptance are not claimed. No suspended audit or Argon2id performance work ran.

## Route authorization admission (03.3f partial; 2026-09-25)

`requireAuthorizedAction` composes the existing fresh, abort-aware `authorize` resolver with a closed HTTP failure catalog. It returns only for an allowed and still-active request. The resolver snapshots policy bounds, the caller signal and clock source before waiting; a cross-runtime regression mutates the recent-authentication policy while facts are pending and confirms the original stricter value still denies. A malformed caller signal is also an unavailable decision, not an escaping setup exception. Forbidden facts map to 403 `FORBIDDEN`; stale or insufficient assurance maps to 403 `REAUTHENTICATION_REQUIRED`; resolver exception, timeout, malformed decision or cancellation maps to 503 `AUTHORIZATION_UNAVAILABLE`. A shared Node/workerd HTTP fixture uses a private project-configuration permission and records protected action execution. It verifies an allowed action executes once, while object denial, stale assurance, thrown provider detail and a timed-out provider do not execute it or expose provider text. All responses retain the global no-store boundary.

Focused security unit passed 6/6, Node HTTP passed 24/24 and local Miniflare/workerd HTTP passed 26/26 on Node 24.21.0. The final local `corepack pnpm test` suite passed 200/200 (unit/contract 50, Node 32, workerd/D1 75, isolated PostgreSQL 18.6 43). Both TypeScript configurations, lint/boundaries, profile/fixture builds, docs build, secret scan and scoped formatting passed. This proves shared route ordering, policy snapshot and safe mapping with fixture facts, not real session/token validation, production resolver freshness, or an account/product route. 03.3f remains open for key, token, required-CAPTCHA, plugin-permission and deployed failure behavior; no audit or Argon2id performance test ran.
