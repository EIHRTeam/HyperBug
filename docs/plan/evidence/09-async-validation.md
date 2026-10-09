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
