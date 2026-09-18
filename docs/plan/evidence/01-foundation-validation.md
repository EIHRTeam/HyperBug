# Module 01 foundation validation

Date: 2026-09-18. Environment: macOS arm64, Node 24.21.0, pnpm 11.26.0, TypeScript 7.0.2, Elysia 1.4.30 / `@elysia/node` 1.4.6, Vitest 5.0.1, Wrangler 4.133.0, Miniflare 5.20260916.0-alpha / workerd 1.20260916.1. Exact choices, lookup references and reviewed development dependencies are in [TOOLCHAIN](../../development/TOOLCHAIN.md).

## Verified local outcomes

- Thirteen workspace projects, explicit nested globs, strict separate runtime type configurations, source exports, boundary checker, formatter/linter and lifecycle allowlist.
- Shared application factory, module-initialized Workers AOT, real Node listener lifecycle, production bundles without fixture routes, safe health/readiness, request IDs, errors and telemetry, bounded JSON including chunked input and stalled cancellation cleanup.
- HTTP comparisons cover success, schema/JSON failure, missing route, oversized bytes, safe internal errors, plugin encapsulation, streaming and cooperative timeout. Invalid/missing production configuration fails closed. Deliberate infrastructure imports fail the real boundary-check command.
- Local PostgreSQL 18.6 private-cluster start/query/migrate/test/stop and local S3 signed PUT/HEAD/GET/DELETE with signature rejection. See [development commands](../../development/README.md) and [migration operations](../../development/MIGRATIONS.md).
- `pnpm install --frozen-lockfile`, `typecheck`, `build`, `lint`, `format:check`, `db:check`, `scan:secrets`, `scan:licenses` and `audit --audit-level high` passed using `fnm exec --using=24.21.0 corepack pnpm`.
- The latest local suite has **80 passing tests and no expected failures**: unit/contract 10; Node 10; workerd 36; PostgreSQL 24. An earlier isolated source snapshot with no node_modules installed from the frozen lockfile/offline package cache and repeated typechecks, both builds and its then-current suite successfully (77 ordinary passes plus the formerly expected disconnect failure, before two database regressions were added). This proves a clean local source install, not a hosted CI or cloud run.

The dependency audit reports one moderate Drizzle Kit legacy esbuild-loader advisory. No high advisory remains, no audit exclusion was added, and the vulnerable development-server API is unused. License exceptions are limited to reviewed development-only package/version combinations. The signature scanner is bounded known-pattern evidence, not proof that arbitrary secrets cannot exist.

## Disconnect verification

01.2f now passes on both actual local runtimes. The earlier failure used an idle response: workerd observes a disconnected peer when it next writes to that connection. The shared fixture now writes a 50 ms heartbeat and explicitly asserts both service cleanup and the incoming `request.signal` abort, rather than accepting stream cancellation alone. There are no expected-failure markers. Production still has only health endpoints; this is runtime evidence for later streaming features.

The durable, Elysia-free [probe](../../../tooling/probe-workerd-disconnect.mjs) uses Miniflare's direct workerd socket. Run `fnm exec --using=24.21.0 node tooling/probe-workerd-disconnect.mjs`. With a 500 ms heartbeat, the 100 ms observation had zero writes/aborts; after the first write it had one abort. With a 50 ms heartbeat, the 100 ms observation already had the abort. Both assertions passed on the pinned runtime. This explains the previous idle-stream failure without claiming immediate notification for silent streams. Future long-lived streams need bounded heartbeat intervals and deadlines; cooperative work must consume the propagated signal.

Context7 resolve/query on 2026-09-18 retrieved Cloudflare's [Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/): its `enable_request_signal` example also keeps writing pings. The focused experiment above establishes local timing behavior; the docs alone do not.

## Unresolved acceptance

One earlier full run produced an intermittent Node ECONNRESET during the disconnect case. A focused rerun, five consecutive isolated Node HTTP runs, the subsequent full suite and the isolated clean-copy suite passed. Its cause has not been established; the Node fetch fixture now attaches the failing route to errors for a future recurrence. Do not erase this observation or claim a root-cause fix.

CI definitions include frozen-install quality, separate Node/workerd and PostgreSQL 18.6 service lanes. Hosted CI has not run, the proposed `postgres:18.6` container has not been exercised locally, and no deployment/provider test is claimed. The allowed-to-fail Elysia next lane is explicitly deferred while stable-runtime acceptance remains open. G1 is unchanged and no SPA exists.
