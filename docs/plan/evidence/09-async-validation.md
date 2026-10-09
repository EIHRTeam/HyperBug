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
