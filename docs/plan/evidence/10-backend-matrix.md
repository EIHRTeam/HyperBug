# Module 10 B4 — Three-profile backend acceptance matrix

Date: 2026-10-11. Branch `feat/v1`; prerequisite B3 `3889f62`. No staging/production deployment. Standard is **not measured** by explicit user decision. Emulation, real local services and actual disposable Cloudflare test deployments are separately attributed below. A passing local Standard composition does not fill its production row. See the separate [Standard expectation model](10-standard-expectation-model.md); analysis never substitutes for acceptance.

## Integrated MVP journey

The existing `tests/{workerd,postgres}/acceptance-journey.test.ts` now share `tests/fixtures/acceptance-content-journey.ts`, adding the previously missing form/upload/search seam to the original account/PKCE/project/discussion/triage/state/timeline journey. Staff creates an enabled YAML form; reporter reserves an exact draft upload, obtains a capability, stages bytes, finalizes immutable processing, receives an explicitly synthetic clean result, submits the form and replays the same receipt. Search initially returns `SEARCH_INDEX_INCOMPLETE`, bounded explicit backfill makes the same Issue searchable. Existing reaction, taxonomy, close/reopen and ordered timeline assertions follow on that same Issue. No product route/contract/adapter changed; no second competing journey was introduced.

Processing/backfill are explicit test orchestration, not a claim that a deployed dispatcher selected a scanner. Actual signed ClamAV acceptance and production async dispatch are separate reused evidence. Workers storage in this journey is R2 emulation; Node storage is S3 emulation. Actual R2 and SeaweedFS compatibility remains independently proven by module 07.

| Profile/environment | Integrated journey status | Tier/headroom |
| --- | --- | --- |
| Node24/PostgreSQL18.6, real private local database, real Node listener; S3 emulator | Pass, one full extended HTTP journey | Standard self-host configuration. No cloud quota; physical host/service saturation headroom not measured by this functional test. |
| Cloudflare Standard composition, local workerd/D1/R2 emulation | Pass, one full extended HTTP journey | Local `standard` policy; emulator has no billing/Free CPU enforcement. Not production acceptance. |
| Cloudflare Standard, actual paid deployment | **Not measured**, user decision | Paid plan unavailable/not purchased; headroom unknown. Expectation model is not evidence. |
| Cloudflare Minimum, local workerd/D1 and actual disposable Workers | Integrated local Minimum journey passes (supplement below); actual disposable Workers account/search/async/upload slices pass independently; full actual integrated journey unmeasured | Free user-attested; latest native headroom below. Local policy fixtures do not enforce actual CPU. |

10.2a remains incomplete: the integrated Node/local Standard journey is verified; full actual Standard and actual integrated Minimum journeys are absent. This is an evidence gap, not a passing mock row.

## Migration, provider, async and plugin matrix (10.2b)

Unchanged code is covered by recorded lane results rather than a new broad run. Evidence applies to its source revision; the selected 2026-10-11 audit provides current affected-store checks, not remeasurement of every older provider/CPU receipt.

| Check | Node/PostgreSQL evidence | Workers/D1 evidence | Classification / limitation |
| --- | --- | --- | --- |
| Fresh and populated upgrade, rollback and repository conformance | [02 foundation](02-data-foundation-validation.md); [08 current search migrations](08-search-validation.md#b2--parser-and-dual-store-compilers-2026-10-09); new journey applies complete current history | Same shared contracts and complete D1 history | Real local PostgreSQL18.6; local workerd/D1, hosted foundation Linux CI. Later migration histories are not claimed from the old 02 count. |
| CRUD, metadata, checksums, presign, multipart/abort/streaming, immutable promotion | [07 actual SeaweedFS4.48 and S3/R2 signing](07-storage-validation.md) | Actual R2 binding/S3/native-local-workerd proofs, same record | Real local service and actual remote storage; no other S3 provider. New exact S3 CORS browser proof [B3](10-upload-closure.md). |
| Queue replay, poison/duplicate/out-of-order/failure, current authorization | [09 B3](09-async-validation.md#b3--connected-consumers-and-failure-acceptance), real PostgreSQL/D1 durable stores with injected provider faults | Same shared consumers; earlier actual Queue/native Workflow receipts | Actual store behavior vs injected transport faults distinguished. No new paid broker benchmark. |
| Durable workflow restart, checkpoint/result loss/cancel | [09 B4](09-async-validation.md#b4--workflows-and-scheduled-maintenance), actual Graphile/PostgreSQL runner shutdown/restart | Local native Workflow dispose/recreate plus recorded hosted retry/cancel; Minimum [R14](09-hosted-composed-native-recovery-receipt.json) actual Cron interruption/redeploy/resume | Actual local provider/real service and distinct actual Cloudflare events. Invocation interruption is not OS process kill. |
| Plugin registration/activation/settings/unload/version/capability/permission failures | [05 foundation](05-plugin-foundation-validation.md) and 09 connected consumer fixtures | Same shared contracts on D1/workerd | Trusted native plugin model; no untrusted-code sandbox claim. |
| Audited canonical mutations/forms/replay/retention | [selected audit](2026-10-11-selected-audit.md), 399 focused checks | Same selected shared fixtures; four optional-provider cases not counted | Current source, local D1/real PostgreSQL; predecessor native CPU receipts remain earlier-source evidence. |

The checklist's storage/migration/queue/workflow/plugin behavior is verified at the explicitly recorded real/local/provider scopes. Close 10.2b; actual full-profile acceptance remains 10.G2.

## Security regression mapping (10.2c)

| Required family | Passing recorded coverage / source |
| --- | --- |
| BOLA and identity confusion | [06 core](06-issue-core-validation.md) and existing acceptance-negatives/concurrency suites; project/parent/current-role fences, User/Staff separation; [04](04-acceptance-validation.md). |
| Token expiry/revocation and PKCE/OAuth | [04 acceptance](04-acceptance-validation.md): wrong verifier/code replay/exact redirect/scope denial, actual61-second code expiry, distinct sessions, immediate token/recovery revocation; new journey uses real PKCE bearer exchange. Client state checking remains client-owned. |
| CORS/CSRF, origin/IP provenance | [03 closure](03-closure-matrix.md), [ingress](03-workers-ingress.md), exact origin and cookie/business separation; [B3 actual upload browser](10-upload-closure.md). |
| XSS and unsafe URLs | [07 content](07-content-validation.md), final-tree corpus and derivation bounds; [03 core security](03-security-foundation-validation.md) outbound redirects/size/timeout and unsafe schemes. |
| Upload handling | [B3 mapping](10-upload-closure.md): all07.V4 negatives; real signed ClamAV separately linked. |
| Rate limits and fail-closed windows | [03 rate limits](03-rate-limits-validation.md), [login](03-login-admission.md), [registration](03-registration-admission.md); actual deployed rejection/boundary and local provider failures distinctly recorded. |
| Plugin boundaries | [05](05-plugin-foundation-validation.md), current capability/settings/version checks, host authorization and private redacted failure; [09](09-completion-audit.md) duplicate/current-permission rechecks. |

Close 10.2c at this automated regression scope; the matrix reuses unchanged security lanes under the handoff's test cadence. It does not claim a new exhaustive audit, new live external-provider success or browser acceptance for every profile.

## Separate-domain auth requirement (10.2d)

**Verified locally on both backend profiles and the Minimum composition.** Explicitly authorized [ADR0015](../../decisions/0015-authorize-callback-form-action.md) repairs the confirmed cross-site form-action blocker. [Focused review](10-auth-csp-review.md) records exact commands and limits. Actual Chrome155/independent HTTPS sites demonstrate first-party login, top-level consent recovery, six cookie-free token/business requests, both single-use code replays400, exact sibling-origin denial, unregistered callback400 and frontend API404. The SameSite=None canary is present first-party and absent cross-site under explicit CDP cookie restrictions (`UserPreferences`). No frontend proxy or browser-persistent token.

[Node/PostgreSQL receipt](10-node-postgres-browser.json), [local workerd Standard receipt](10-workerd-standard-browser.json), [local Minimum receipt](10-workerd-cloudflare-minimum-browser.json). Backend stores are respectively actual private PostgreSQL18.6 and emulated D1/R2; TLS is isolated self-signed test TLS, mapped separate registrable .test domains. No production DNS/provider or other browser-engine claim. Close10.2d at the required both-profile minimal-fixture scope; paid Standard/full deployment acceptance remains10.G2.

## Environment attribution and quota (10.2e/f)

All reused records identify their versions/commands and classifications. Actual Cloudflare rows are disposable authorized test deployments, **not staging**; no staging deployment was authorized. Native Minimum R14 executed source `b756222`, predating the selected audit patch. Actual R2 tests are provider evidence even when the caller/database is local.

| Environment / timestamp | Tier | Quota/headroom evidence |
| --- | --- | --- |
| New local Node/PostgreSQL/S3-emulated journey | Standard self-host, local | Cloud quota not applicable; resource/capacity headroom not established. |
| New local workerd/D1/R2 journey | Standard local emulation | Cloud billing/headroom not applicable; no actual platform CPU enforcement. |
| B3 Node/SeaweedFS/Chrome | Standard adapter, isolated local development | Five owned keys/7positive bytes; all isolated data removed. No cloud quota. |
| Earlier actual Workers/ingress/D1/R2 upload | Exact test account/resources in07 receipt | Tier/account budget attribution not measured by that slice; preserve unknown rather than assume Standard. Eight targets and all owned deployment/ledger resources cleaned. |
| Minimum R14 native Cron,2026-10-11 05:34:06→05:51:42 UTC | Free, human-attested; subscription/billing API unavailable | Delayed adaptive estimate: requests99,715→99,641; D1 reads4,992,005→4,991,118; writes99,705→99,621 remaining. Queue/Workflow absent, R2 unused. [Receipt](09-hosted-composed-native-recovery-receipt.json). These are not exact billing counters. |
| B15 actual Minimum HTTP,2026-10-05 | Billing attribution unverified in original observation | Keep [B15](2026-10-05-b15-live-measurements.md) separate; instrumented CPU20–47ms login exceeds nominal10ms Free ceiling, no accepted headroom/capacity. |
| Actual paid Standard | **Not measured** | Unknown; separate expectation model only. |

10.2e's classification/reporting outcome closes; no missing hosted access is filled with emulation. 10.2f's full remaining-headroom measurement stays incomplete where unknown. Minimum functional evidence belongs in G1's three-profile matrix; its quota evidence remains separately attributed for13.G6, which stays open.

## New verification, review and cleanup

Versions: Node24.21.0, pnpm11.26.0, Vitest5.0.1, PostgreSQL18.6; repository pinned workerd/Miniflare, Elysia and AWS SDK. No new package/API configuration, dependency or schema. Existing fixture composition APIs are reused; no new library documentation question introduced by the journey change.

Commands: `CI=true corepack pnpm exec vitest run --project workerd tests/workerd/acceptance-journey.test.ts --reporter=verbose`: **1 pass**,2.79s total,326ms journey. `CI=true corepack pnpm test:postgres tests/postgres/acceptance-journey.test.ts --reporter=verbose`: **1 pass**,6.37s total,285ms journey. Each journey's multiple assertions are not counted as separate tests or benchmarks. Final `CI=true corepack pnpm typecheck` and `lint` pass. Initial typecheck lacked the explicit Workers D1Database type import; initial workerd assertion expected a filename although canonical form Markdown uses `Attachment` plus the opaque attachment path. Corrected import/assertion, failed journey rerun passed, then the dependent PostgreSQL lane ran once. No threshold or security behavior changed.

Primary focused review: helper retains genuine HTTP authentication/authorization/validation/audit, labels synthetic scanning, tests replay after attachment consumption and explicit search unavailability before index readiness; proof hooks stay existing test-only fixtures. No ordinary upload buffering, production hook or silent background effect. AfterAll closes Node listener/S3 adapter/emulator, removes its key directory, drops disposable database; cluster orchestrator stops/removes its owned PostgreSQL cluster. Miniflare disposal removes owned runtime resources. No hosted resource created in B4. Final build/docs/scoped format/link/secrets/diff verification is recorded in progress.

## Integrated Minimum supplement (2026-10-11)

`CI=true HYPERBUG_ACCEPTANCE_TIER=minimum corepack pnpm exec vitest run --project workerd tests/workerd/acceptance-journey.test.ts --reporter=verbose` passes1 full journey using the existing fixture on local workerd/D1/R2 emulation. Explicit minimum-v2 activation writes one deployment.enablement audit; all3 credentials are peppered PBKDF2-HMAC-SHA256; durable account/IP/lockout admission stays active; public capability reports tier Minimum/textScope title; derived index body is empty. Account/PKCE/roles/project/form/upload/replay/search/comment/reaction/triage/close/reopen/timeline all pass together. Manual immutable processing and synthetic scanner remain explicit.

The first run completed the API path but failed a new assertion using the wrong capability field deploymentTier; the public field is tier. That failed run is not acceptance. Corrected final run passes; no public contract or product behavior changed. Production-owned activation/native dispatch/actual storage/scanner slices remain separately proven by their existing receipts. This supplement fills the local integrated Minimum gap, not actual full-profile CPU/performance/billing acceptance.10.2a stays partial because actual Standard is not measured;13.G6 remains open.


Current-source Minimum continuation: [local benchmark](10-minimum-local-performance.md) separately records eight paths; [production-root upload attempts](10-native-upload-attempts.json) are failed deployment evidence, not integrated journey results. Correct registered OAuth configuration exposes a binding-dependent upload-time [Module04 blocker](10-native-startup-blocker.md), subsequently repaired under a separate explicit user authorization; native upload now passes (see continuation below). Both finite-guard trials cleaned; no HTTP acceptance, object, Queue or Workflow action.10.2a/f remain partial; Standard still not measured.

Fresh continuation sampled headroom:13:56:52UTC requests99,370/reads4,990,390/writes99,600; corrected14:35:25UTC post-cleanup requests99,369/reads4,987,961/writes99,520 ([receipt](10-native-headroom-after.json)). Adaptive sampling/other account activity/diagnostic SQL prevent per-trial attribution. Billing403 unchanged; Queue/Workflow/R2 operations0 in these trials. Complete quota/runtime/capacity acceptance is not inferred.


Authorized auth-composition repair:4 focused production-entry workerd regressions pass and native Minimum/ingress upload succeeds with real authorized bindings. [Review](10-native-startup-blocker.md) and [trial3 receipt](10-native-composition-upload.json). First HTTPS fetch returns no response, no native acceptance/CPU sample; cleanup preserves185 original records and0 owned resources/active data. Upload success is deployability evidence only.


Final native continuation: [fresh TLS-gated trial4](10-native-tls-guarded-pilot.json) uploads repaired production entries; no acceptance-harness HTTP request runs.13 verified-TLS attempts fail.12 unlabelled native API events have CPU6–21ms/all outcomes ok; independent guard stops on first delivered14ms. They cannot establish a functional path, measured baseline or sustainable ceiling.189 original rows/FKs/0 owned Workers/domains/active data verified; generated secrets removed. Signed-in dashboard verifies no certificates matching either owned trial3/4 hostname. No further native load under the existing10ms stop rule; Standard not measured,10.2a/f,10.3b/g incomplete and G1 Not passed.

Retained-log clarification (2026-10-12): [read-only review](10-native-retained-log-review.md) and its scalar supplement show twelve owned API invocation records, all GET 404 to root/eight-letter paths, with the same twelve CPU/wall/outcome tuples as trial4. Native 404 CPU reaches 21 ms; the 14 ms guard-stop tuple is also an eight-letter 404 path. These are outside-harness requests, not MVP-path or benchmark samples. Exact request-ID joining was unavailable in the original scalar tail receipt. TLS cause, full actual metrics/quota/capacity and unmeasured Standard remain blockers; all gate/checklist states are unchanged. Further provider work uses MCP or Wrangler under the user preference; report unavailable access rather than use the dashboard.
