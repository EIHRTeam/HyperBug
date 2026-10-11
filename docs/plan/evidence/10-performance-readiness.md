# Module 10 B5 — Measured performance and operational readiness

Date: 2026-10-11. B4 source `32a9e0d`; no production change, hosted resource, dependency or cryptographic tuning. Standard paid deployment is **not measured**. This report records local observations, inherited actual Minimum observations and operational limits separately. Nothing here is an SLA/SLO.

## Repeatable security-active benchmark (10.3a)

`tests/fixtures/acceptance-benchmark.ts` extends the existing authenticated journeys only when `HYPERBUG_ACCEPTANCE_BENCHMARK=1`. A synthetic read-scale fixture copies canonical fields from one genuinely HTTP-created form Issue into 1,000 extra rows; project numbering advances explicitly. The seed bypasses creation-side records for those read-scale copies and is not represented as 1,000 actual API creations. Actual measured writes use the real HTTP API with bearer/current permissions, admission counters, validation, Markdown derivation, audit/timeline/outbox/receipt and unchanged hash policy active. Explicit bounded25-document index backfill precedes measurement. No read repairs an index.

Fixture: 1,001 Issues before samples, 1,021 after20 measured creations; list limit100, search limit20, two initial comments then20 measured comments, one released form attachment and16 new untransferred pending intents. Sequential concurrency1;20 samples per ordinary path,16 reservation successes,4 expected quota refusals and3 password logins. Password hashing is measured **inside the complete successful login**, not as isolated hash CPU. Standard Argon2id19MiB/two passes/parallelism1 remains unchanged. No optimization or stopped cryptographic investigation resumed.

Method: client monotonic clock around request plus full JSON consumption; warm loopback samples; nearest-rank quantiles. At n20, p99 is the observed maximum; at n3, p95/p99 are both the maximum. These are small empirical samples, not sustained tail estimates or confidence intervals. Security and queue/provider failures remain fail closed.

| Path | Node/PostgreSQL local p50 / p95 / p99 ms | workerd/D1 local p50 / p95 / p99 ms | Samples |
| --- | --- | --- | --- |
| List100 | 2.262 / 3.179 / 3.637 | 3.866 / 4.786 / 4.933 | 20 each |
| Detail | 1.386 / 2.263 / 3.183 | 2.574 / 3.414 / 3.472 | 20 each |
| Search20 | 24.550 / 26.192 / 26.436 | 5.585 / 7.816 / 10.693 | 20 each |
| Bearer authentication | 0.403 / 0.523 / 0.800 | 1.097 / 1.335 / 2.242 | 20 each |
| Password login including hash | 14.731 / 15.800 / 15.800 | 18.961 / 20.841 / 20.841 | 3 each |
| Issue creation | 2.535 / 3.282 / 5.321 | 4.818 / 6.351 / 7.304 | 20 each |
| Comment creation | 2.104 / 2.799 / 5.010 | 4.362 / 6.793 / 6.982 | 20 each |
| Upload intent | 2.708 / 3.731 / 3.731 | 4.328 / 6.214 / 6.214 | 16 each |
| Expected upload-quota refusal409 | 2.144 / 2.632 / 2.632 | 5.139 / 6.778 / 6.778 | 4 each |
| Actual paid Standard | **Not measured** | **Not measured** | None; separate expectation model only |

All ordinary requests returned their expected200/201; four upload409s per environment are expected admission outcomes. Server5xx rate0 for each recorded path. Raw scalar samples/method/version/fixture and aggregate process metrics: [Node receipt](10-node-postgres-local-http-baseline.json), [workerd receipt](10-workerd-d1-local-http-baseline.json). No bearer, password, cookie, body, signed URL or identifier appears in the published samples.

## Metric attribution and missing measurements (10.3b)

- Node process aggregate benchmark CPU: user299,566µs/system44,984µs. Its RSS after loop368,115,712bytes. This includes test/client/API orchestration and excludes PostgreSQL child CPU; it is not per-request or isolated production server memory. Workerd run's Node orchestration user73,858µs/system13,441µs and RSS487,817,216bytes exclude workerd child CPU/memory. Neither RSS is a Workers isolate measurement or a128MB limit comparison.
- Query count/plan/rows reuse [06 query acceptance](06-issue-core-validation.md): statement count independent of page size (Issue list1 plus relations2, detail3, comments1, merged timeline1, grouped reactions1); actual PostgreSQL indexed plans at2,000 Issues/4,000 filler labels/1,600 comments/1,000 timeline events/2,000 reactions. These are database-slice counts, not complete auth/admission HTTP counts.
- [08 D1](08-d1-search-query.json) / [08 PostgreSQL](08-postgres-search-query.json) retain8,000-Issue fixtures, four search statements including readiness/relations, actual D1 rows metadata and PostgreSQL EXPLAIN ANALYZE/BUFFERS. Full text can still inspect substantial scoped postings; no unsupported constant-cost claim. The new HTTP benchmark does not instrument query cost. Existing approved complexity/result/scan ceilings remain unchanged.
- [B15 actual Minimum](2026-10-05-b15-live-measurements.md) separately records101 Issues/high relations, CPU/statements/read/write/range/handler timings. Login20–47ms exceeds nominal Free10ms; billing attribution unresolved in that observation. Do not relabel its Free/PBKDF2 behavior as Standard/Argon2id.
- [R14 actual native Minimum](09-hosted-composed-native-recovery-receipt.json) records interruption9ms/resume6ms/max dispatch9ms,10 conservative statements/subrequests,63 reads/22 writes on maximum title/body fixture. Sampled backlog age and convergence are exact fixture observations, not queue-lag distributions or current-source CPU after the selected audit patch.
- Upload-intent benchmark does zero blob operations/transfer bytes;16 pending reservations remain until disposable fixture teardown. Actual32MiB streaming/multipart and object operations are separate [07 storage proofs](07-storage-validation.md); exact provider-operation distribution/throughput is not measured here.

10.3b remains incomplete: paid Standard, current actual Minimum distributions, complete endpoint query metrics, isolated runtime memory/CPU, queue-lag and object-operation baselines are absent. Unavailable metrics are stated rather than inferred from process totals.

## Authorized abuse and resource-bound evidence (10.3c)

| Required scenario | Recorded check and environment | Result / limit |
| --- | --- | --- |
| Large valid payload | Module09 maximum200-code-point title/32,768-code-point canonical body through actual Minimum dispatcher; local eight-isolate composition and nativeR14 separately linked in [09](09-async-validation.md) | Preserved canonical content, title-only index, bounded dispatch. Not a sustained multi-profile HTTP load. |
| Abusive search | [08](08-search-validation.md): accepted/rejected/fuzz corpus; AST/token/filter/OR/negation ceilings before DB, actual-store scan/readiness quotas/current authorization; HTTP unsupported queries denied | Bounded failures and no fallback scan; local workerd/D1 and actual local PostgreSQL. |
| Failed login bursts | [B15](2026-10-05-b15-live-measurements.md): actual401/429/delay/lockout, deployed admission; [03 login](03-login-admission.md) fail-closed provider/current-key controls | Functional rejection; instrumented CPU budget concern retained. No CAPTCHA bypass or hash reduction. |
| Abandoned uploads | New sixteen pending intents and four409s on both stores; [B3](10-upload-closure.md) failed storage/expired lease/cursor resumption, quota release after actual provider absence, scheduling/current referenced-attachment guards | Pending principal ceiling16 preserved. Actual provider and synthetic maintenance I/O distinctly attributed. |
| Retry storm | [09](09-completion-audit.md): duplicate/stale/poison/ack-loss/lease/crash recovery and five attempts/backoff; current6-check unit/config selection includes native unresolved-slot reservation and max2 consumer capacity | No exactly-once claim; duplicate effects fenced, backpressure retained. Local injected failures/real stores; provider lifecycle evidence separately recorded. |
| Slow providers | Existing deadline/stalled S3 and authorization/provider tests in [remediation B13/B14](2026-10-05-review-remediation.md), [09](09-async-validation.md), [07 caller bounds](07-upload-lifecycle-validation.md#cleanup-storage-wait-bounds-2026-10-04) | Timeout/abort fail closed; unresolved native work retains capacity. Caller wait bound does not imply physical remote cancellation. |

Close10.3c at this authorized bounded scenario-test scope. It does not establish sustained maximum production load or the missing paid/full-profile budget measurements.

## Initial measured regression thresholds (10.3d)

[Threshold artifact](10-local-regression-thresholds.json) contains **only** the two freshly measured local environments. For each path: p95 and p99 investigation limits are `ceil(2 × observed value ×1000)/1000`ms; server5xx rate remains0; candidate sample count must be at least the baseline. The2× margin is an explicit local noise/investigation allowance, not an SLO or a performance promise. Treat repeated exceedance as a regression to investigate; never auto-widen or overwrite the baseline to pass. No Standard-paid or Minimum-native threshold is synthesized from a model. Existing security/resource bounds and the10ms Minimum target remain intact.

Repeat measurement with the commands below; reviewed scalar candidate files can be compared via `node tooling/check-acceptance-baseline.mjs <candidate-receipt>`. The comparator refuses a different runtime/profile/fixture or missing samples. Same recorded-receipt checks pass as **consistency checks only**; a temporary candidate with list p95=10,000ms rejects as expected. No new benchmark is claimed from either comparator check.

## Basic operational readiness (10.3e)

- New [PostgreSQL restore receipt](10-postgres-restore.json): current owned55-public-table database,1,021 Issues,1,001 search documents,41 receipts,49 outbox rows,33 audits, one attachment and three password records. `pg_dump --format=custom`, new `template0` target, `pg_restore --exit-on-error --single-transaction`; compare all table counts, all canonical Issue fields and constraint validation/catalog. Total dump/restore/verification3,430.163ms. Target is dropped, private dump removed and cluster stopped/removed. This is a basic owned database drill; it does not prove blob/secret-manager/encrypted-data or production RTO/RPO recovery.
- Existing actual test-D1 logical backup/restore rehearsal in [R14](09-async-validation.md#r14-committed-source-native-retry--2026-10-11):59 total tables/172 prior records with valid FKs before mutations; final preserved baseline verified. Real cloud source/export, isolated local restoration; not a full cloud production rollback.
- Fresh/upgrade/failure recovery uses [02](02-data-foundation-validation.md) and [08 current histories](08-search-validation.md): failed migrations retain prior schema/data, explicit repaired retry, current fresh/populated-upgrade and checksum-history guards. No migration changed here; no remote migration ran.
- Focused production Node bundle entry check passes1: live200, missing infrastructure ready503 and write fail closed; fixture routes404. Existing both-store ready-success/failure/store shutdown evidence remains in module03/04. Structured telemetry/redaction and deadlines pass the focused6 unit/config/async checks; secret scan covers new public receipts. No raw provider/file output.
- Isolated staging configuration inspected only: API/ingress service names target staging; Queue `hyperbug-staging-events`, Workflow `hyperbug-staging-workflow`, rate namespace703302 differ from production703303; staging full sampling1 versus production0.1; required secrets remain private. Missing environment-specific storage/database/operator configuration must fail readiness, not inherit a production resource or imply provisioning. No staging deployment/actual staging recovery was authorized or performed.

Close10.3e for basic verified configuration/readiness/database recovery; broader release restore/key/blob/automation drills stay module13 work. Production scanner isolation/update and historical upload provenance/quiescence remain [B3 limits](10-upload-closure.md).

## Commands, versions, failures and review (10.3f)

Environment: macOS ARM64, Node24.21.0, pnpm11.26.0, Vitest5.0.1, PostgreSQL18.6 with installed matching pg_dump/pg_restore, repository pinned Miniflare/workerd/Elysia/AWS SDK. All external lockfile versions unchanged. No dependency addition.

```sh
CI=true HYPERBUG_ACCEPTANCE_BENCHMARK=1 corepack pnpm exec vitest run --project workerd tests/workerd/acceptance-journey.test.ts --reporter=verbose
CI=true HYPERBUG_ACCEPTANCE_BENCHMARK=1 corepack pnpm test:postgres tests/postgres/acceptance-journey.test.ts --reporter=verbose
CI=true corepack pnpm exec vitest run --project unit tests/unit/config.test.ts tests/unit/async-processing.test.ts --reporter=verbose
CI=true corepack pnpm exec vitest run --project node tests/node/entry.test.ts --reporter=verbose
CI=true corepack pnpm typecheck
CI=true corepack pnpm lint
node tooling/check-acceptance-baseline.mjs docs/plan/evidence/10-workerd-d1-local-http-baseline.json
node tooling/check-acceptance-baseline.mjs docs/plan/evidence/10-node-postgres-local-http-baseline.json
```

Final benchmark: workerd1pass,6.65s total/4.041s journey; PostgreSQL1pass,11.06s total/4.762s journey including restoration. Focused operational unit6pass/735ms, Node1pass/768ms. Local sockets/processes required approved sandbox access; no remote mutation. Default journeys do not regenerate metrics without the explicit environment switch.

Failed setup was corrected sequentially:41 pages did not converge because the helper passed `cursor` instead of the store's `after` field; an initial explicit25-page-size attempt alone did not repair that field. Actual store API inspection supplied the correct continuation. Initial successful path run then hit the existing16-pending quota while incorrectly expecting20 successes; corrected fixture separates16 successes/four expected409s without changing policy. These failed attempts supplied no accepted baseline. The dependent PostgreSQL benchmark executed only after corrected workerd success. Earlier already-green operational selections were not rerun. Restore publisher was moved after owned target/dump cleanup so a future cleanup failure cannot publish success; current completed drill cleanup was already verified by successful suite/orchestrator exit.

Context7 resolve/query2026-10-11: `/websites/nodejs_latest-v24_x_api` [CPU/memory](https://nodejs.org/docs/latest-v24.x/api/process.html); `/websites/postgresql_18` [dump](https://www.postgresql.org/docs/18/backup-dump.html), [restore](https://www.postgresql.org/docs/18/app-pgrestore.html). Process CPU microseconds/memory bytes measure the current process; children are not relabelled. PostgreSQL docs describe custom format/template0/atomic restore. No browser implementation in B5; modern-web-guidance not triggered.

Primary focused security/performance review: no production imports of fixtures, security bypass in measured HTTP paths, credentials/raw responses in receipts, schema/history edits, policy weakening, artifact auto-widening, unbounded benchmark loads or provider relabeling. Seed and backfill loops have explicit caps; samples fully consume responses; default suites stay small. Local synthetic read-scale copies are explicitly labelled. G1/SPA closed and13.G6 open. Remaining gates: paid Standard and integrated Minimum path/browser/complete quota/runtime metrics, full-provider operational scanner/recovery limits. Close10.3f as this exact report; final docs/format/link/secrets/diff verification is in progress.
