# B15 live Minimum measurements and cleanup (2026-10-05)

The authorized test deployment exercised Cloudflare Minimum on actual Workers/D1/R2. **Billing-plan attribution is unverified; CPU headroom and 13.G6 remain unproven.** The subscription API denied access, and the account's standard usage model does not establish Free/Paid billing. Standard-profile deployment performance remains unmeasured. G1/G2 stay closed.

The [machine-readable receipt](2026-10-05-b15-live-metrics.json) contains allowlisted measurements and verification summaries. Private configuration, credentials, passkeys, cookies, exports and signed URLs remain in ignored local receipts.

## Method and fixture

Node 24.21.0 and Wrangler 4.144.0 deployed random-suffix API/ingress Workers and a test-only custom domain. D1 held 10 User accounts, 10 Staff fixtures, 101 issues, 20 labels and 10 assignees on every issue; three comments exercised history. The OCI host sent the ten-login burst over SSH. Native Chromium CDP provided a virtual authenticator with required user verification. Other client measurements ran from the local Node/browser environment. These locations differ and their latencies are not directly comparable.

An ignored Worker wrapper counts request-scoped D1 metadata, including each batch statement, and records handler wall time. Tail CPU is milliseconds and includes this instrumentation; D1 rows written include index/trigger work. Handler time includes I/O. Cold-labelled rows are first observed requests after deployment, not independently confirmed cold isolates. Samples are bounded functional observations, not sustained-load percentiles or an SLO.

## Recorded paths

Ranges below show observed minima/maxima. CPU is Worker time; handler elapsed time includes network waits. Client latency is available only where the safe receipt survived.

| Path | Samples / HTTP | CPU ms | Handler ms | Client ms | Statements | Rows read | Rows written |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public registration | 1 / 202 | 45 | 637 | 1028.038 | 8 | 16 | 15 |
| First password login | 1 / 200 | 40 | 1215 | 1509.66 | 11 | 33 | 12 |
| Warm password login | 1 / 200 | 32 | 1184 | Not captured | 11 | 35 | 11 |
| Ten simultaneous password logins | 10 / 200 | 20–47 | 322–493 | 945.564–1242.579 | 9–11 | 30–35 | 11–12 |
| Worst create (20 labels, 10 assignees) | 1 / 201 | 33 | 1555 | Not captured | 19 | 176 | 110 |
| Comment burst | 3 / 201 | 11–16 | 1033–1171 | Not captured | 12 | 18–19 | 15–16 |
| Full page (100 items, all relations) | 3 / 200 | 8–19 | 592–682 | 789.534–1647.762 | 4 | 3700 | 0 |
| Session polling | 5 / 200 | 5–8 | 237–248 | 430.925–663.28 | 2 | 6 | 0 |
| Invalid password/lockout delay | 5 / 401, 429 | 4–49 | 251–860 | Not captured | 3–8 | 9–15 | 4–8 |
| Locked login | 1 / 429 | 2 | 127 | Not captured | 2 | 8 | 4 |
| Stale recovery generation | 1 / 403 | 7 | 226 | Not captured | 2 | 6 | 0 |
| Fresh recovery generation | 1 / 200 | 9 | 474 | Not captured | 15 | 19 | 33 |
| Recovery redemption | 1 / 200 | 48 | 1340 | 2233.233 | 12 | 56 | 19 |
| Old session after recovery | 1 / 401 | 16 | 334 | 1010.497 | 3 | 4 | 0 |
| Native passkey registration | 1 / 200 | 12 | 601 | 804.077 | 5 | 10 | 7 |
| Passkey login without configured CAPTCHA | 1 / 200 | 16 | 874 | 1087.804 | 8 | 29 | 13 |
| Configured CAPTCHA: missing token | 1 / 403 | 7 | 136 | 437.839 | 2 | 6 | 6 |

The final ten-login burst passed 10/10 with median client latency 1170.369 ms and median CPU 29 ms. The one-operation root bound had produced 7/10 successes and three 503s; an additional run produced three successes, six AUTHORIZATION_UNAVAILABLE responses and one RATE_LIMITED response. The root now caps native PBKDF2 work at ten concurrent operations per isolate. Final verification waited for the normal hourly rate window; no counter reset or hash-parameter reduction occurred. The earlier Python user agent received ten WAF 403s before Core; the curl user agent reached Core.

50,000 iterations remain unchanged. Final login CPU 20–47 ms, initial registration 45 ms and recovery redemption 48 ms exceed the nominal Free 10 ms budget in this instrumented run. No uninstrumented Free-plan fit, capacity ceiling or headroom is established. Raising concurrency resolved the observed availability defect; it does not establish CPU safety on Free.

The native passkey registration/login and authorize login/consent redirects succeeded. The Playwright Credentials helper's registration attempt failed before the native CDP journey passed. Configured Turnstile rejected a missing token with CAPTCHA_DENIED before ceremony consumption. Headless and visible browsers did not obtain an automatic challenge token; the visible attempt timed out and closed. No human challenge was completed. Successful live CAPTCHA passkey login remains unverified; B4's configured-provider fixture success remains local evidence. Same-origin authorize redirects do not establish separate-domain/third-party-cookie acceptance.

## Deadline and sampling decisions

The sample contains 537 D1 round trips, median 109 ms and maximum 284 ms; 627 server statement durations have maximum 5.107 ms. Round trips include batch calls; statement counts are separately recorded. Keep the configured read/write/security defaults at 1,000 ms, above the observed maximum by 3.5×. This does not estimate cold/sustained p99; broader tails remain acceptance work. Password and streaming lifetimes remain separate. The final wiring covers issue/discussion/project/taxonomy/plugin stores and registration/recovery/enrollment writes, plus registry/lockout authorization settings in both roots. A timed-out D1 write can still commit and must retain the closed response/idempotency behavior.

At 100% test sampling, 118 API tail invocations emitted 512 messages, including 118 known measurement messages; 394 remaining messages were observed. The 118 ingress invocations emitted 0 messages. Production head sampling is explicitly 0.1 on both Workers; local/staging remain 1. A 10% head sample is intended to retain about one tenth of invocation log groups, with variation. These counts do not measure persisted bytes or prove a logging quota. Durable required audit is unaffected.

Latest instrumented API upload: 3,293.47 KiB / gzip 624.42 KiB, startup 122 ms. Six successful API deployments reported 115–142 ms startup; ingress reported 2 ms (11.78 KiB / gzip 3.73 KiB). Local Minimum excludes Argon2id Wasm. Initial API GraphQL analytics recorded 78 invocations and zero runtime errors, CPU p50 11,010 / p99 50,076 microseconds (11.010 / 50.076 ms). Its post-deletion query was empty. The separately filtered final ingress query recorded 126 invocations, zero runtime errors, CPU p50 1,076 / p99 2,520 microseconds. Filtering both scripts had returned __unknown__ and is excluded from script attribution. HTTP 503/429 responses can be runtime successes. Both scripts have invocations; Free daily accounting and double-billing interpretation remain unproven.

## Cleanup and preservation

The pre-migration export is 115,185 bytes, SHA-256 cb889ecc98da0fbf5e88dce815acf31fa547c3ac73d1d92afcf80221de85486e, locally restored with valid foreign keys. Remote D1 retains all migrations 0000–0027. Only owned fixtures were removed; 57 baseline rows were verified against their original column values. The registry control intentionally advanced generation 1→5 through four atomic audited revoke/remove mutations using the actual D1 adapter. Ten baseline key identities remain unchanged and two owned identities remain permanently in removed state.

History prevents physical zero. Cleanup retained one deleted User tombstone, one private archived project, one deleted issue and three deleted comments, with three unchanged comment-history rows and one unchanged timeline row. D1 has 21 audits: 11 baseline plus six deployment/journey additions and four key lifecycle audits. The migration's pre-existing Staff backfill/instance role remains. All owned sessions, codes, access tokens, password/passkey/recovery credentials, identities, labels, relations, memberships, outbox rows, lockouts, 46 rate counters and five WebAuthn challenges were removed. Seven baseline counters and two baseline null-identity challenges remain unchanged. Provider-managed _cf_KV was untouched.

Schema and append-only triggers exactly match the post-migration snapshot; foreign-key checks pass. Exact owned domain and both Workers were deleted (ingress before API), all pre-existing Workers/domains remain, and safe tails stopped. R2 CORS and the existing Turnstile widget exactly match captured settings; neither was modified. Actual-R2 signing/tamper/wrong-checksum regression passed two selected checks and cleaned its own objects.

The domain DELETE returned an empty successful body that the first helper could not parse; inventory confirmed deletion before continuation. The helper was corrected for empty responses. Cleanup's first registry step used the wrong snapshot property (versions rather than keys) after the fixture batch committed; corrected and completed. An inspection request with parameters across multiple SQL statements was rejected by the REST API; subsequent verification uses supported single statements. No failed mutation was assumed rolled back: the earlier owned-label REST batch experiment explicitly verified rollback, and final state preservation was checked directly. The local restore's null-prototype rows were compared by column values to JSON receipts.

## Verification and next evidence

Reuse B14's composed matrix: **937 passed / 18 optional-provider skips** across unit/contracts, Node, workerd and real local PostgreSQL 18.6. B15 focused Minimum journey: 7 passed. Node stalled-storage/deadline selection: 2 passed / 31 intentionally unselected; an earlier wrong name filter selected zero tests and supplied no evidence. Actual R2 regression: 2 passed / 6 intentionally unselected. No new automated tests; broad lanes were not repeated under “Test less, write more.” Final compile/lint/build/docs/format/secret checks are recorded in the [remediation record](2026-10-05-review-remediation.md).

Next: establish billing-plan attribution and collect an uninstrumented CPU/budget sample in an authorized Free environment; complete the live human Turnstile journey; separately measure Cloudflare Standard and the remaining quota/recovery/multi-domain criteria. Recreate isolated resources only within the authorized test boundary and repeat inventory/backup/cleanup. G1/G2/13.G6 remain incomplete. No SPA, queue/workflow expansion, later-module audit or Argon2id performance work was started.
