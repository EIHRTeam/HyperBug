# Module 10 B6 — Separately attributed Minimum quota assessment

Date: 2026-10-11. Profile `cloudflare-minimum`, Workers Free user-attested; subscription/billing permissions unavailable. This evidence is separate from Standard/local performance baselines. 13.G6 remains open. The measured sources below are reused because this batch changes no Minimum runtime, quota or search semantics; source revisions and instrumentation limits remain explicit.

## Observed behavior, not an instance-capacity promise

| 10.3g component | Evidence/environment | Measured result | Remaining gap |
| --- | --- | --- | --- |
| Quota exhaustion/recovery | Actual native Cron [R9 receipt](09-hosted-native-declarative-retry-receipt.json),2026-10-10, source371aeb9; application quota deliberately exhausted, not provider account spend | Refusal2ms CPU/7statements/22reads/0writes, pending source1 retained; restore budget and next native Cron recovers4ms CPU,64reads/21writes with source/index convergence | This does not exhaust Cloudflare's actual shared daily account quota or validate billing counters. |
| Degraded search | Current ADR0014 title-only fixtures and [R14 maximum-content witness](09-hosted-composed-native-recovery-receipt.json); [09 validation](09-async-validation.md) | Maximum200-title/32768-canonical body, indexed body0; exact mode/projection/cursor fences and bounded10-document rebuild. Current quota/readiness unavailability preserves direct Issue reads | Full actual HTTP search/auth distribution and sustained capacity unmeasured. [08 reindex receipt](08-d1-minimum-reindex.json) predates ADR0014 and indexed body content; it is historical evidence only, not current title-only measurement. Full-text Standard behavior is not inferred from title-only work. |
| Degraded authentication | [B15 actual Minimum](2026-10-05-b15-live-measurements.md); [04 tier fixture](04-acceptance-validation.md), policy50,000PBKDF2 iterations/versioned pepper, lockout/current admission | Final actual10-login burst10/10; CPU20–47ms, client945.564–1242.579ms. Earlier one-slot saturation produced503s; ten-slot production bound now fixed. Required configured CAPTCHA rejects missing token | Instrumented CPU exceeds nominal Free10ms; billing attribution unverified in that run. Successful live configured-CAPTCHA passkey login absent. These are concerns, not a proven Free-safe authentication ceiling. |
| Dispatch backpressure/recovery | [R14 native composition](09-hosted-composed-native-recovery-receipt.json),2026-10-11, sourceb756222; existing5-minute Cron; local real-store guards in09 | Actual interruption9ms/resume6ms/max-content dispatch9ms; exact[0,1] witnesses/pending event preserved; dispatch10statements/conservative subrequests,63reads/22writes. Pre-I/O45-call ceiling,10-item/2-concurrency consumer and bounded retained failures separately tested | One sample per fresh deployment; predecessor source before selected audit; no current full-profile/sustained CPU distribution or backlog service rate. |
| Instance capacity ceiling | [08 search fixtures](08-search-validation.md), native max-content witnesses and headroom below | Explicit functional/result/scan/index/page ceilings; maximum-payload dispatch and deliberate quota refusal observed | **Not measured** as sustainable maximum users/Issues/requests/attachments. Fixture size, documented provider ceilings and arithmetic are not a measured instance capacity. 10.3g stays incomplete. |

## Exact headroom attribution

[R14 receipt](09-hosted-composed-native-recovery-receipt.json) is the latest independently cleaned native proof:

| Delayed adaptive analytics | Before05:34:06.631UTC | After05:51:42.743UTC | Observed delta |
| --- | --- | --- | --- |
| Estimated remaining Worker requests | 99,715 | 99,641 | 74 |
| Estimated remaining D1 reads | 4,992,005 | 4,991,118 | 887 |
| Estimated remaining D1 writes | 99,705 | 99,621 | 84 |

These are **delayed sampled analytics against recorded Free limits**, not authoritative billing/exact quota counters or isolated per-fixture costs. Concurrent account activity and reporting delay prevent attributing each delta to this fixture. Queue/Workflow absent; R2 unused. Original one Cron retained during its owned deployment, then owned resources cleaned;172 original records/exact singleton state/FKs/resources preserved. All four owned handles terminal/PIDs absent. No reuse/restart of the cleaned trial or its baseline is permitted.

R9's separate pre/post headroom and cleanup are in its receipt. B15 retains its original billing-attribution gap; current human Free attestation must not retrospectively establish exact provider enforcement on that old sample. FREE-05's documented daily ceilings remain5million reads/100,000writes/100,000requests; Minimum still uses existing D1/Cron mechanisms rather than paid Queue/Workflow assumptions.

## Decision and next evidence

10.3g's refusal/recovery, degraded-path behavior and native bounded dispatch are evidenced at the scopes above; sustainable instance ceiling/complete attribution remain missing. Leave the box unchecked and13.G6 open. The separately labelled Standard model may use these inputs with assumptions, but cannot replace a Minimum measurement or fill acceptance rows.

No cloud mutation, new load, cleanup or documentation-only fixture count is added in B6. Required next experiment, within fresh authorized test inventory/backup/resources: current-source uninstrumented CPU across auth/search/dispatch plus bounded load/backlog and explicit safe stop/headroom criteria, authoritative plan attribution where access permits. Do not lower PBKDF2/Argon2id parameters, alter search/body bounds, spend the account quota to exhaustion or claim a ceiling from a one-event native observation.


## Current-source continuation (2026-10-11)

The separately attributed [local Minimum eight-path benchmark](10-minimum-local-performance.md) now passes on11 seeded Issues with the existing daily/index/search/admission/hash policies. Its initial21-Issue reservation saturation and search20 rejection remain failed setup observations, not measured sustainable instance limits. The [fresh native upload attempts](10-native-upload-attempts.json) do not run HTTP acceptance: correct production-root OAuth configuration fails upload-time binding prerequisites. The [scope-limited repair](10-native-startup-blocker.md) was explicitly authorized, passes4 local production-bundle regressions and native upload; trial3 first HTTPS fetch yields no response ([receipt](10-native-composition-upload.json)). Complete actual distributions/instance ceiling remain not measured. Both owned trials have0 active resource/key/counter/identity state, all pre-existing records unchanged and valid FKs; four removed permanent key identities retained per trial.13.G6 remains open.

Fresh read-only preflight at13:56:52UTC: estimated remaining requests99,370 / D1 reads4,990,390 / writes99,600. Subscription permission still403/code10000; this is delayed adaptive estimation, not billing or exact per-trial costs. Post-cleanup corrected query at14:35:25UTC: estimated remaining requests99,369 / reads4,987,961 / writes99,520 ([scalar receipt](10-native-headroom-after.json)). Difference from the preflight is1request/2,429reads/80writes, covering account activity, backups/inventory/cleanup and reporting delay; it cannot be attributed to native acceptance requests (none ran). Initial post-cleanup queries were malformed by a missing closing GraphQL brace, returning HTTP200 GraphQL syntax errors; corrected queries pass. No billing permission changed.


Final native continuation: [fresh TLS-gated trial4](10-native-tls-guarded-pilot.json) uploads repaired production entries; no acceptance-harness HTTP request runs.13 verified-TLS attempts fail.12 unlabelled native API events have CPU6–21ms/all outcomes ok; independent guard stops on first delivered14ms. They cannot establish a functional path, measured baseline or sustainable ceiling.189 original rows/FKs/0 owned Workers/domains/active data verified; generated secrets removed. Signed-in dashboard verifies no certificates matching either owned trial3/4 hostname. No further native load under the existing10ms stop rule; Standard not measured,10.2a/f,10.3b/g incomplete and G1 Not passed.
