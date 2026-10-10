# Module 09 async processing evidence

## Scope and delivery decision — 2026-10-10

HANDOFF-09 authorizes B1–B5 on `feat/v1`; 09.3e remains suspended. Module 08's 08.2e/08.V5 are integration handoffs closed by B3, not prerequisites that forbid dispatch implementation. G1/G2 and 13.G6 do not close here.

At-least-once delivery is explicit. Separate `async_deliveries` sidecars retain publication and execution leases, bounded attempt counts, safe enumerated failure reasons and stable downstream identities. Source rows remain undelivered after queue send until the consumer commits its acknowledgement. Expired publication leases and the five-minute reconciliation interval allow retransmission even after provider retention expires. Failed rows require fresh operator authorization for replay. No exactly-once external side-effect or cross-service atomicity is claimed: downstream systems must honor the delivery identity, or operators must reconcile ambiguous external effects before replay.

## Current documentation

Lookup date: 2026-10-10. Context7 resolve followed by query, selecting high-reputation exact project sources:

- `/cloudflare/cloudflare-docs`: [Queues JavaScript APIs](https://developers.cloudflare.com/queues/configuration/javascript-apis/), [configuration](https://developers.cloudflare.com/queues/configuration/configure-queues/), [limits](https://developers.cloudflare.com/queues/platform/limits/); producer send, consumer ack/retry, batch bounds and retention. Provider Free-specific quotas need actual account evidence; general limits do not establish Free headroom.
- `/cloudflare/cloudflare-docs`: [Workflows Workers API](https://developers.cloudflare.com/workflows/build/workers-api/), [local lifecycle support](https://developers.cloudflare.com/changelog/2026-03-23-local-dev-instance-methods/); named bounded step.do retries and pause/resume/restart/terminate support. Installed Miniflare behavior still needs a runtime test in B4.
- `/graphile/worker`: [library](https://worker.graphile.org/docs/library), [addJob](https://worker.graphile.org/docs/library/add-job), [queue](https://worker.graphile.org/docs/library/queue); run/taskList, singleton WorkerUtils migration, bounded concurrency, jobKeyMode and scheduling. The npm release is verified before installation in B2.
- `/drizzle-team/drizzle-orm-docs`: generate/additive SQLite/PostgreSQL migrations. Installed drizzle-kit 0.31.11 retains separate journals; newer documentation describing v1 folder changes is not applied to this workspace.

## B1 — portable model

Paths: `packages/application/src/async-processing.ts`, both database `src/async-processing.ts` and schemas, D1 `0030_async_processing.sql`, PostgreSQL `0029_async_processing.sql`, and `tests/fixtures/async-contract.ts`. Additive tables only; existing SQL/history, outbox row shapes and plugin envelopes remain unchanged.

Verified with Node 24, Vitest 5.0.1, installed Miniflare 5.20260926.1-alpha/workerd D1 emulation, real isolated PostgreSQL 18.6:

- `corepack pnpm test:unit tests/unit/async-processing.test.ts`: 1 passed.
- `corepack pnpm test:contract`: 1 passed.
- `corepack pnpm test:workerd tests/workerd/repository.test.ts -t 'async durable sidecars'`: 3 passed; 182 unrelated cases deselected by filter.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts -t 'async durable sidecars'`: final 3 passed; 168 unrelated cases deselected. Initial failure found PostgreSQL inferred 32-bit arithmetic for the retry timestamp; explicit bigint cast fixed it.
- `corepack pnpm typecheck`, `corepack pnpm lint` (including boundaries), `corepack pnpm db:check`, `git diff --check`: passed after correcting initial erasable-syntax/type and serial-transaction lint failures. Existing historical Drizzle timestamp warnings unchanged.
- `corepack pnpm db:generate:d1 --name async_processing` and `corepack pnpm db:generate:postgres --name async_processing`: generated and inspected only additive tables/indexes/FKs. Both repository harnesses apply the complete migration sequence after populated prior schema setup; no remote migration or resource created.
- Scoped `corepack pnpm exec oxfmt --write` used on changed code; final scoped check recorded at commit.

Invariants exercised: concurrent claim exclusion, lease expiry/reclamation, stale-worker fencing, source acknowledgement, duplicate acknowledgement, poison retention, denied/fresh authorized replay, crash retry exhaustion, atomic step witnesses/checkpoints, cancel fencing, result bounds. Primary focused review checked conditional writes and transaction ordering; no independent audit claim. B1 closes 09.1b/09.1e, 09.2a, 09.3a at this portable-store scope. Platform/consumer/full workflow acceptance remains B2–B5.

## B2 — queue adapters, bounds and telemetry

Added `graphile-worker@0.18.0` exactly to the Node app (registry engine >=22.18.0, MIT; Node 24 compatible). Its transitive graph is frozen in pnpm-lock.yaml; lifecycle allowBuilds unchanged and all 11 installed license expressions pass. No other direct dependency added. Context7 initially found no Miniflare library; alternate resolution selected `/cloudflare/workers-sdk`, then query retrieved current v4 queue option schemas and broker retry/DLQ behavior. Installed Miniflare supports this slice, proven below rather than inferred.

Adapters: `apps/api-cloudflare/src/task-queue.ts` uses Queue.send/json with bounded delay, per-message ack/retry and bounded batch consumption. `apps/api-node/src/task-queue.ts` uses WorkerUtils/addJob with stable job keys, unsafe_dedupe plus application idempotency, five attempts, bounded delay and a two-concurrent-worker runner with graceful shutdown. A provider key alone is never business idempotency. Cloudflare retry overflow is deferred, never dropped by the adapter.

`async-runner.ts` bounds dispatch to ten references and one downstream send per event, two active underlying sends/handlers, a 1,000 ms deadline, and a 30-second isolate-local circuit after three transient failures. Underlying stalled native work holds its slot after timeout. Timed-out publication may still succeed; source state remains recoverable and duplicate consumption is expected. Telemetry carries only bounded counts, outcomes, duration and lag/age; diagnostic failures cannot change delivery state. Backlog counts are lower bounds at saturation (1,001 per source/failure category); oldest timestamp is exact via new covering pending-age indexes. D1 0031/PostgreSQL 0030 contain only those two indexes and do not alter outbox row shapes.

Verification:

- `corepack pnpm test:unit tests/unit/async-processing.test.ts`: 3 passed, including stalled handler/send capacity and malformed reference rejection.
- `corepack pnpm test:workerd tests/workerd/async-queue.test.ts`: 1 passed, actual local Queue delivery/retry/ack in 32.26 s with identical stable identity and attempts 1 -> 2. No mock broker or hosted claim.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts -t 'Graphile adapter'`: 1 passed on isolated PostgreSQL 18.6; actual Graphile schema migration, delayed task execution, scheduling bound and graceful shutdown; 171 unrelated cases filtered.
- After bounded telemetry/index changes, `corepack pnpm test:workerd tests/workerd/repository.test.ts -t 'retains poison failures'` and the corresponding `test:postgres` command: 1 passed each; remaining cases filtered. Both complete migration sequences include the new indexes.
- `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm db:check`, `corepack pnpm scan:licenses`, `corepack pnpm scan:secrets`, `git diff --check`: passed. Historical Drizzle journal warnings unchanged. Fixture build is performed by the Queue lane using existing build tooling.
- Scoped formatting checked at commit. No hosted resources created. No paid-plan acceptance inferred.

Primary focused performance/security review checked fixed fan-out, lower-bound telemetry scans, diagnostic isolation, safe error output, unresolved-work capacity and replay after ambiguous publication. B2 closes 09.1a, 09.2b/09.2c for the adapter/runner mechanisms. Production consumer wiring, full failures and workflow/Minimum paths remain B3–B5.

## B3 — connected consumers and failure acceptance

Production roots connect the existing search bridge and host-compiled async plugin bindings to bounded dispatch/reconciliation: the Cloudflare queue handler and existing Cron, and Graphile initialization plus the existing Node cleanup interval. Queue startup failures are non-critical and do not prevent canonical HTTP writes. Standard Wrangler profiles declare ten-message/two-consumer bounds and four provider retries (five deliveries); no resources are created by these configuration edits. Minimum remains on its separate B5 path.

Consumers reload canonical source rows. Search calls `handleSearchOutboxEvent` unchanged and derives revision from the immutable timeline. Known comment events are intentionally acknowledged because comments do not contribute to MVP issue search. Unsupported core events/versions fail visibly. Plugin consumption validates envelope/id/hook/version, current enabled/trusted registry/capabilities, host module version, reference-only payloads, current settings and a fresh Core host authorization callback before its one effect. No stored paths/eval/code loading exists. The host binding list defaults empty: no official notification/integration feature is introduced; missing installed native bindings remain bounded transient failures, and disabled/uninstalled entries cancel without an effect. External providers without idempotent APIs need operator reconciliation before replay, as documented by the delivery decision.

Verification:

- `corepack pnpm test:workerd tests/workerd/repository.test.ts -t 'async connected consumers'`: 3 passed; 185 unrelated cases filtered.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts -t 'async connected consumers'`: 3 passed on isolated PostgreSQL 18.6; 172 unrelated cases filtered.
- Explicit processing-crash refinement: the corresponding two `repository.test.ts -t 'rolls back a failed business commit'` lanes each pass 1 after adding that named failure point; green unrelated cases not rerun.
- `corepack pnpm test:workerd tests/workerd/issue-route.test.ts`: 2 passed; actual backend HTTP lifecycle/authz/content journey on workerd/D1.
- `corepack pnpm test:postgres tests/postgres/issue-route.test.ts`: 2 passed on actual Node/PostgreSQL HTTPS and local S3 emulator. The shared HTTP journey establishes queue outage before creation, proves 201 authorized creation with the outbox retained, and proves anonymous creation still receives 401.
- `corepack pnpm typecheck`, `corepack pnpm lint`/boundaries, `corepack pnpm build`, `corepack pnpm scan:secrets`, scoped formatting/diff: passed. Initial fixture auditAction literal typing corrected before runtime verification.

Fault scopes are explicit: actual unique outbox insertion failure rolls back business/timeline writes; simulated queue failures before and after send acceptance leave committed events recoverable; injected processing failure precedes index writes; injected acknowledgement failure follows an actual index commit. Subsequent execution converges; duplicate/stale created events cannot revert the newer edited projection. Plugin downstream idempotency is a deterministic simulated provider honoring the stable key, not a claim about a live notification service. It is exercised on actual database stores and current principal suspension is rechecked. Unsupported persisted versions and malformed persisted payloads become safe failed rows; replay is authorized. B1 crash budgets/poison replay and B2 slow-provider/malformed-reference tests supply the other 09.V2 cases.

Primary focused review checked source validation, current lifecycle/configuration/authorization, stable downstream keys, closed error mapping and unchanged request authorization. 09.1c/09.1d, 09.2d, 09.V1/09.V2/09.V5 close at this recorded local/injected-failure scope. Module 08 08.2e/08.V5 dispatch/retry handoffs close; its prior rebuild/deletion/redaction/authorization evidence is retained. No hosted resource, remote migration, independent audit or G1/G2/13.G6 acceptance is claimed.

## B4 — workflows and scheduled maintenance

Cloudflare Standard has named bounded Workflows steps and a restart/resume/cancel binding adapter; Node has PostgreSQL checkpoints plus Graphile tasks and scheduled recovery. Conformance jobs generate tiny witnesses, not large artifacts; result references remain null instead of pointing to a nonexistent object. Future large artifacts must live behind object-store references. Persisted cleanup cursors fence 90-second leases and rotate projects; existing upload services retain all deletion/link/physical-absence/accounting guards. Existing Cron/Node interval also schedule configured async terminal retention, session/token expiry and upload intent/orphan/multipart cleanup. No added scheduler or dependency.

Context7 on 2026-10-10: resolved Cloudflare Workflows to `/websites/developers_cloudflare_workflows`, queried binding get/status/restart/resume/terminate and local development. Sources: https://developers.cloudflare.com/workflows/build/workers-api/ and https://developers.cloudflare.com/workflows/build/trigger-workflows/. No documented structured missing-instance discriminator was supplied: lookup failure attempts fixed-ID creation; creation errors propagate, and status/restart errors are not caught as absence. Optional newer runtime/package Workflow APIs differ; the adapter declares only the methods it actually uses.

Graphile keys changed from B2 `unsafe_dedupe` to `replace`: exhausted jobs retain their key and otherwise obstruct reconciliation. Actual PostgreSQL verification demonstrates replacement resets provider attempts to zero; application attempts/idempotency remain authoritative.

Verification (installed Miniflare 5.20260926.1-alpha/workerd, PostgreSQL 18.6, Graphile 0.18.0):

- `corepack pnpm test:workerd tests/workerd/async-workflow.test.ts tests/workerd/repository.test.ts -t 'actual local Workflow|scheduled maintenance'`: cleanup 1 passed; Workflow initially failed due to passing a migration object instead of its SQL statements. Corrected fixture and ran only the failed Workflow lane.
- `corepack pnpm test:workerd tests/workerd/async-workflow.test.ts`: final 1 passed (2.31 s), actual named-step retry after injected DB-commit/platform-result failure, termination, persistent emulator disposal/recreation, restart/resume, cancellation, two unique committed witnesses, <=1024-byte output. The persistence refinement initially reused a disposed D1 proxy; recreated that proxy and reran the affected case. No missing-emulation substitute or mock workflow engine.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts -t 'Graphile workflow|scheduled maintenance'`: 2 passed; actual Graphile task execution, process runner shutdown/restart after injected next-enqueue failure, durable checkpoint recovery, cancel, exhausted retained provider key replacement, bounded result; real quota/cleanup state. 175 unrelated cases filtered.
- Shared cleanup proof on both stores: actual lease expiry/fencing/project rotation, abandoned multipart reconciliation seam, used/reserved quota release, and linked attachment preservation. Blob deletion/discovery is synthetic; it is not hosted provider acceptance. B3's unchanged search/plugin consistency proofs complete the local 09.V4 slice.
- `corepack pnpm types:cloudflare`, `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm db:check`, `corepack pnpm build`, `corepack pnpm scan:secrets`, scoped oxfmt and `git diff --check`: passed. Initial typecheck errors (runtime-specific fixture lane, optional Workflow API mismatch, small callback result type) corrected. Existing historical journal warnings remain.

Additive migrations D1 0032/PostgreSQL 0031 contain only async maintenance state and apply in the focused fresh-database lanes. Primary focused review checked cancellation/lease fences, atomic witnesses, current upload guards, tiny outputs and retry-safe keys. Internal [operator runbook](../../ASYNC-PROCESSING.md) covers semantics/recovery/replay/differences/configuration. B4 closes 09.3b/c/d/f and local 09.V3/V4; hosted behavior follows B5. No hosted resources created, no normative edit, no independent audit, no gate closure.

## B5 — Minimum prototype and hosted CPU blocker

Status: **Blocked; uncommitted prototype, not accepted.** `09.1f`, `09.2e`, `09.3g` and `09.V6` remain unchecked. B1–B4 are committed as `a18d49c`, `b669b34`, `ef7f66d` and `462fd3c`. HANDOFF-09 requires: “If a bound cannot be met, stop and report.” The required 10 ms Free CPU dispatcher bound failed; no bound, normative source, permission or scanner policy was relaxed. No B5 commit, push or PR update occurred.

### Prototype and local evidence

Uncommitted paths include `apps/api-cloudflare/src/async-{budget,minimum}.ts`, `packages/application/src/async-minimum.ts`, `packages/database/d1/src/async-minimum.ts`, associated roots/exports, both terminal-retention stores, public instance capability fields, tests/build target, internal runbook and synchronized English/Chinese Cloudflare deployment guides. Additive migrations: D1 `0033_async_minimum` / `0034_async_job_retention`, PostgreSQL `0032_async_job_retention`, with journal/snapshot families.

The prototype imports one source through persistent bounded cursors, claims its execution lease/source snapshot atomically, validates it through the existing consumers, and fences acknowledgement in D1. It reserves 5,000 reads/100 writes per invocation from a separate daily async allocation of 1,500,000/30,000; admission refusal retains work. It stops work at 40 combined SQL/provider calls with five diagnostic slots (hard total 45); native R2 and multipart signed fetch share the same pre-I/O counter. Five phases rotate on the existing five-minute Cron, yielding a corresponding dispatch/job phase every 25 minutes. Conformance jobs have four steps/1,024-byte checkpoints. Bulk/import/export/long-running flags stay false because those features are absent. Failed retention atomically retires the source before deleting failure metadata; pending retries survive. Bounded terminal job retention deletes witnesses together with eligible conformance jobs.

Recorded focused local outcomes (commands below reproduce the selected suites/filters; they were not rerun after the CPU stop):

- `corepack pnpm test:workerd tests/workerd/async-minimum.test.ts tests/workerd/repository.test.ts -t 'Minimum resumes|retains poison failures'`: Minimum recovery/quota/rollover and poison-retention checks, 2 passes. The repository case is named `retains poison failures, denies unauthorized replay, and bounds retries across crashes`.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts tests/postgres/bootstrap-route.test.ts -t 'retains poison failures|publishes the unauthenticated instance capability document'`: retention and Standard capability checks, 2 passes on actual isolated PostgreSQL 18.6.
- `corepack pnpm test:workerd tests/workerd/minimum-tier-route.test.ts -t 'reports the enabled tier truthfully'`: 1 pass, Minimum public capability fields.
- `corepack pnpm test:unit tests/unit/async-minimum.test.ts`: 1 pass, a maximum-size multipart sweep stops at 40 combined calls.
- After the direct-claim optimization, only the affected `corepack pnpm test:workerd tests/workerd/async-minimum.test.ts` case reran: 1 pass, persistent restart/event/job/quotas/retention.
- `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm db:check`, `corepack pnpm build`, `corepack pnpm docs:build`, `corepack pnpm scan:secrets` passed at implementation checkpoints. Migration fresh/upgrade application is covered by these focused database fixtures. Historical Drizzle journal warnings remain. Final scoped formatting/document checks are recorded in the final progress entry.

These checks prove the recorded local mechanisms, not actual Free CPU or provider-global quota acceptance. No new direct dependency was added in B5.

### Hosted environment, headroom and results

Hosted UTC date: 2026-10-09 (local session date 2026-10-10). Account `aa51b5f3a1a926d4c97fbd0bd7e48646`, **Workers Free, user-attested**; subscription API denied independent confirmation. Installed Node 24.21.0, Wrangler 4.144.0. Owned resources: Worker `hyperbug-09-d61de8b43059`, Queue `hyperbug-09-events-d61de8b43059`, Workflow `hyperbug-09-workflow-d61de8b43059`, custom domain `async-d61de8b43059.test.eihrteam.org`. Used only authorized test D1 `hyperbug-test-1` (`5081af9c-7740-42b7-bc91-10010a0b8323`). R2 `test` was unused and unmodified. No paid-only CPU override or Logpush.

[Sanitized machine-readable receipt](09-hosted-minimum-receipt.json) records individual timestamps, CPU, statement/subrequest counters, D1 rows and cleanup. All samples used the same Free account and pre-test observed remaining headroom: D1 4,999,242 reads/100,000 writes; Workers 99,976 requests; empty Queue/Workflow datasets corresponding to observed 10,000 operations/3,000 steps available. Adaptive analytics are delayed snapshots, not real-time billing guarantees. Post-test snapshot at 18:42:31 UTC observed D1 2,162 reads/281 writes (remaining 4,997,838/99,719), Workers 83 requests (remaining 99,917), Queues four operations (remaining 9,996). Workflow event counts do not measure billable steps; post-test step headroom is unavailable. Recent cleanup may not yet be reflected.

| Free-account invocation | CPU | Statements / combined subrequests | D1 reads / writes | Acceptance |
| --- | --- | --- | --- | --- |
| Original search dispatch, explicit tick | 15 ms | 19 / 19 | 40 / 15 | Fails 10 ms |
| Original real Cron with work | 20 ms | 17 / 17 | 37 / 16 | Fails 10 ms |
| Optimized search dispatch, explicit tick | 15 ms | 15 / 15 | 43 / 21 | Fails 10 ms |
| Checkpoint steps, explicit ticks | 10 / 8 ms | 11 / 11 each | 18 / 9; 16 / 9 | Behavior observed, no general CPU acceptance |
| Empty real Cron samples | 3 / 7 / 3 ms | 8 / 9 / 9 | 18 / 3; 19 / 3; 19 / 7 | Empty work only |
| Queue consumer retry then completion | 0 / 12 ms | Consumer summary only | Not separately metered | Actual retry/ack behavior; no Free CPU acceptance |

The optimization removed four dispatcher statements by using a trusted claim token/source snapshot and database-fenced completion; it still invokes `handleSearchOutboxEvent` and the existing D1 search adapter unchanged. It did not meet the bound. Seed/edit HTTP fixture CPU is outside async acceptance. A canceled Workflow invocation reported 12 ms aggregate CPU; aggregate tail output does not prove its per-step CPU. Successful HTTP/database results never override CPU failure.

Actual behavior observed: Queue attempt 1 retries and attempt 2 acknowledges the same reference; native Workflow retries an injected crash after committing a D1 step, completes with two unique witnesses, and supports cancellation; D1 event lease and job checkpoint survive Worker redeployment and complete without duplicate witnesses. Search reaches canonical revision 1, then optimized dispatch reaches revision 2. Hosted quota-exhaustion injection was **not run** after the CPU stop; local exhaustion/rollover evidence alone cannot close 09.V6.

The ignored authenticated probe wrapper calls production functions. Its real Cron deliberately forces dispatch phase 0 to protect pre-existing expired records. Local tests exercise all five phases; this hosted slice does not prove full production-root/cleanup-phase acceptance. One redeploy returned exit 1 after custom-domain re-registration API 504, although application/triggers were deployed and the existing domain served the probe; actual state was inspected before cleanup. This is not a fully successful deployment claim.

### Backup, migrations and verified cleanup

Before changes, D1 export was imported into SQLite and its foreign keys verified; the backup and secret/config receipts remain mode 0600 in ignored `.local/module09-hosted/`. The test database needed reviewed additive Module08 prerequisites `0028/0029`, then Module09 `0030–0034`. Existing migration history and data were preserved; appended additive schema/history remain after cleanup. No staging/production migration.

Cleanup used the scoped ignored `cleanup.mjs resources`, then `cleanup.mjs data`; helper failures were corrected without changing production code: handle successful empty DELETE responses, detach the owned Queue consumer before Worker deletion, split parameterized multi-statement history queries, and make the test-only table drop idempotent. Successful final API inventory verifies **zero owned Workers, custom-domain mappings, Queues and Workflows**. The tail process and its child stopped. Exact-hostname raw DNS inventory was denied (403/code10000), so independent DNS-record absence is **unverified**; the custom-domain mapping is verified absent.

Final D1 comparison verifies all **85 pre-existing rows**, matching every original column value, including baseline append-only and migration history. Foreign-key checks pass. Owned mutable outbox/delivery/job/step/search rows are zero; mission-created async cursor/budget/search-budget singletons are empty and `workflow_crashes` is dropped. One deleted principal, archived project and redacted/deleted issue remain to preserve their **two timeline and two audit records**. No append-only history was deleted. Receipt guards confirm these tombstones are inactive. After the stop, hosted actions were limited to cleanup and read-only receipts; no further B5 acceptance run occurred.

### Unblock boundary

Keep B5 uncommitted and the four checks open. A possible next authorized investigation is Module08 D1 search-index profiling and batched database work, preserving existing revision, authorization, quota and public-contract semantics. HANDOFF-09 excludes changes needed in another module: this direction requires explicit scope authorization before implementation, followed by the affected local checks and a new hosted 10 ms test. It is a proposal, not an established CPU fix. 09.3e stays suspended; G1/G2 stay closed and 13.G6 open.

Final stop-session checks: `corepack pnpm docs:build`, `corepack pnpm scan:secrets`, `corepack pnpm exec oxfmt --check <changed paths excluding protected drafts>` and `git diff --check` pass. Checklist/status, sanitized receipt, new local handoff links, bilingual paths and empty staging were verified. Formatting changed layout only; no application test lane was rerun after the stop.

## Authorized Module08 D1 batching follow-up — 2026-10-10

The user explicitly authorized a bounded Module08 search profiling/batching investigation and B5 retry after the CPU stop. Scope preserves public/application ports, immutable revision resolution, current canonical fences, quota admission/ceilings, tokenization and security behavior. No audit resume or normative edit.

The Minimum single-event D1 backfill now appends a canonical source scalar projection to the existing atomic budget `INSERT ... RETURNING`. Admission denial evaluates no returned source, exposes no content and throws the same `SEARCH_BUDGET_EXHAUSTED`. The guarded write still rechecks canonical revision/projection/moderation/deletion; missing/stale and duplicate events preserve their previous results. Standard and bounded bulk rebuild paths are unchanged. This removes one statement and one D1 call per Minimum search event (search segment four calls -> three); it does not claim the CPU bound is met.

Current documentation: Context7 resolve/query `/llmstxt/developers_cloudflare_d1_llms-full_txt` confirms sequential transactional `batch`, rollback and D1 result row metadata ([D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)). No `changes()` cross-statement witness guarantee was supplied; the optimization uses a single `RETURNING` statement instead. Wrangler exact-name resolution found only the Action package; alternate resolution/query `/cloudflare/workers-sdk` retrieved remote export and tail behavior. Installed `wrangler deploy --help` confirms `--secrets-file`. Raw JSON tail can contain credentials, so only bounded sanitized metadata is retained by the ignored tail wrapper.

Focused verification after the complete scoped patch:

- `corepack pnpm test:workerd tests/workerd/repository.test.ts tests/workerd/async-minimum.test.ts -t 'replays current outbox|atomically reserves minimum quotas|Minimum resumes'`: 4 passed, 187 unrelated cases deselected. Actual local workerd/D1 tests both Standard and Minimum duplicate/stale/delete/redaction behavior, concurrent quota admission/exhaustion, bounded ten-document full-body rebuild and persistent Minimum restart/quota/retention.
- `corepack pnpm test:postgres tests/postgres/repository.test.ts -t 'replays current outbox|atomically reserves minimum quotas'`: 3 passed, 175 unrelated cases deselected on real isolated PostgreSQL 18.6; confirms shared semantics are preserved.
- `corepack pnpm typecheck`, `corepack pnpm lint`, scoped oxfmt and `git diff --check`: pass. Initial test typing incorrectly treated a measured SQL string as an object; removed that unnecessary assertion before running the runtime checks.

Fresh hosted baseline preparation: Wrangler remote export refused the now-installed FTS5 virtual table. A logical backup reconstructs accessible canonical tables/schema, restores records before guard triggers, rebuilds derived FTS and verifies foreign keys/counts in local SQLite. First attempts encountered provider-owned `_cf_KV` access denial and restore trigger order; neither changed remote data. Provider metadata and derived FTS shadow pages are excluded from canonical row comparison. Verified 59 canonical tables / 102 pre-existing rows; ignored backups are mode 0600. The baseline includes existing async cursor/budget rows, which cleanup must restore exactly rather than clear. No migration is needed or applied for this follow-up. Hosted resource results/cleanup follow below; no new acceptance claim yet.

### Hosted follow-up result and stop

[Fresh sanitized receipt](09-hosted-minimum-batching-receipt.json). Workers Free remains user-attested, with subscription API confirmation denied. Fresh Worker `hyperbug-09-c6b9b129da37` and custom domain `async-c6b9b129da37.test.eihrteam.org`; no Queue/Workflow created, R2 unused/unmodified, no paid-only option. D1 remains the authorized test database; no migrations applied.

Before-test observed daily headroom at 2026-10-10 04:52:32 UTC: D1 4,998,347 reads/100,000 writes, Workers 99,998 requests; Queue/Workflow datasets empty and no corresponding new usage. Post-test adaptive snapshot at 05:00:42 UTC: D1 2,295 reads/49 writes (remaining 4,997,705/99,951), Workers 61 requests (remaining 99,939). These snapshots may omit recent cleanup and are not real-time billing. Subscription/certificate-status inspection was permission-denied. TLS initially failed on the new hostname; a later same-deployment probe returned 401 with certificate verification enabled. The first seed attempt failed before TLS and created no database fixture; canonical state was checked before retrying. No deployment was restarted solely for the observation delay.

| Free-account measurement | CPU | SQL/native behavior | Result |
| --- | --- | --- | --- |
| Instrumented search-only update | 11 ms | Three D1 calls; query durations 0.1776 + 1.3088 + 0.7008 ms; processed 1 / updated 1, metered 8 reads / 6 writes / 2 index statements | Confirms three calls, not an uninstrumented CPU acceptance claim |
| Uninstrumented production-function dispatcher, replay of indexed source | **22 ms** | 14 statements/combined subrequests, 43 reads/18 writes; source acknowledged, no duplicate projection | **Fails required 10 ms; stop** |

The search-only probe includes private instrumentation/fixture overhead. Full dispatch calls the production Minimum function through the protected wrapper, without that profiling proxy. The current source has seven D1 call boundaries: async admission, claim/import batch, revision lookup, search admission/source, guarded index batch, acknowledgement batch, backlog batch. This inspection identifies a candidate for further batching; it does not attribute every CPU millisecond to D1. The fresh dispatcher replay differs from the earlier index-write sample/isolate, so 22 ms versus 15 ms is not a controlled comparative regression measurement. Both exceed 10 ms. No further edit/max-body, quota-exhaustion or recovery acceptance probe ran after the new failure.

Cleanup `cleanup.mjs resources` then `cleanup.mjs data` passes: zero owned Worker/custom-domain mappings/Queue/Workflow, no live tail processes; all 102 captured canonical rows match each original column, including captured singleton budgets/cursors. Foreign keys valid; owned outbox/delivery/job/step/search/mutation work removed. A deleted principal, archived project and redacted/deleted issue preserve one timeline/one audit record. Existing earlier inactive fixtures/history remain untouched. Derived FTS state is maintained by deletion triggers; provider-internal rows/physical FTS shadow pages are not claimed as canonical row backups. Independent raw DNS inventory for the fresh hostname was not repeated; these credentials previously received 403, so only custom-domain mapping absence is verified.

B5 and the scoped search optimization remain uncommitted; 09.1f/09.2e/09.3g/09.V6 stay open. The authorized Module08 investigation is complete at its recorded local/profile scope, and did not unblock B5. A concrete next candidate is to batch the Minimum dispatcher's admission/claim/source staging and completion/telemetry, retaining durable quota refusal, lease fences, existing consumers/search checks and every numeric ceiling. Any continuation after this repeated bound failure needs a new user-directed scope decision under HANDOFF-09's stop rule. No new implementation is authorized by this proposal; no threshold waiver, normative edit or paid capability is proposed. G1/G2 remain closed, 13.G6 open, 09.3e suspended.

Final follow-up `corepack pnpm docs:build`, `corepack pnpm scan:secrets`, scoped oxfmt and `git diff --check` pass; receipt/cleanup/open-checklist/local-link/empty-staging guards pass. Corrected the stale Module08 integration narrative to match its already verified B3 checkbox closure; no checklist/gate changed. No runtime lane was rerun after the hosted CPU stop.
