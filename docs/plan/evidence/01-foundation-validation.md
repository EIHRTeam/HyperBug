# Module 01 foundation validation

Date: 2026-09-18. Environment: macOS arm64, Node 24.21.0, pnpm 11.26.0, TypeScript 7.0.2, Elysia 1.4.30 / `@elysia/node` 1.4.6, Vitest 5.0.1, Wrangler 4.133.0, Miniflare 5.20260916.0-alpha / workerd 1.20260916.1. Bundling, linting and formatting moved to tsdown 0.23.0/rolldown 1.2.9, oxlint 1.83.0 and oxfmt 0.68.0 later the same day ([ADR 0004](../../decisions/0004-oxc-toolchain-migration.md)); the runs recorded below that predate the migration used esbuild/Biome/Prettier. Exact choices, lookup references and reviewed development dependencies are in [TOOLCHAIN](../../development/TOOLCHAIN.md).

## Verified local outcomes

- Thirteen workspace projects, explicit nested globs, strict separate runtime type configurations, source exports, boundary checker, formatter/linter and lifecycle allowlist.
- Shared application factory, module-initialized Workers AOT, real Node listener lifecycle, production bundles without fixture routes, safe health/readiness, request IDs, errors and telemetry, bounded JSON including chunked input and stalled cancellation cleanup.
- HTTP comparisons cover success, schema/JSON failure, missing route, oversized bytes, safe internal errors, plugin encapsulation, streaming and cooperative timeout. Invalid/missing production configuration fails closed. Deliberate infrastructure imports fail the real boundary-check command.
- Local PostgreSQL 18.6 private-cluster start/query/migrate/test/stop and local S3 signed PUT/HEAD/GET/DELETE with signature rejection. See [development commands](../../development/README.md) and [migration operations](../../development/MIGRATIONS.md).
- `pnpm install --frozen-lockfile`, `typecheck`, `build`, `lint`, `format:check`, `db:check`, `scan:secrets`, `scan:licenses` and `audit --audit-level high` passed using `fnm exec --using=24.21.0 corepack pnpm`.
- The latest local suite has **80 passing tests and no expected failures**: unit/contract 10; Node 10; workerd 36; PostgreSQL 24. An earlier isolated source snapshot with no node_modules installed from the frozen lockfile/offline package cache and repeated typechecks, both builds and its then-current suite successfully (77 ordinary passes plus the formerly expected disconnect failure, before two database regressions were added). The exact committed revision `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d` then passed an offline frozen install, both typechecks/builds and all 80 tests from a separate clean Git worktree. Its 15 foundation documents passed 98 local link/anchor checks without the unrelated uncommitted policy documents. These are local clean-checkout results; hosted results are recorded separately below.

The dependency audit reports one moderate Drizzle Kit legacy esbuild-loader advisory. No high advisory remains, no audit exclusion was added, and the vulnerable development-server API is unused. License exceptions are limited to reviewed development-only package/version combinations. The signature scanner is bounded known-pattern evidence, not proof that arbitrary secrets cannot exist.

After the Oxc toolchain migration the same local matrix was re-run on the current tree with **81 passing tests and no expected failures** (unit/contract 11 because the oxlint configuration gained a negative-fixture test; Node 10; workerd 36; PostgreSQL 24), plus `typecheck`, `lint`, `format:check`, `build`, `db:check`, `scan:secrets`, `scan:licenses` and the high-severity audit gate. Those are local results on this workstation; the hosted runs recorded below were produced with the replaced toolchain and are not evidence for the new one until CI re-runs.

## Disconnect verification

01.2f now passes on both actual local runtimes. The earlier failure used an idle response: workerd observes a disconnected peer when it next writes to that connection. The shared fixture now writes a 50 ms heartbeat and explicitly asserts both service cleanup and the incoming `request.signal` abort, rather than accepting stream cancellation alone. There are no expected-failure markers. Production still has only health endpoints; this is runtime evidence for later streaming features.

The durable, Elysia-free [probe](../../../tooling/probe-workerd-disconnect.mjs) uses Miniflare's direct workerd socket. Run `fnm exec --using=24.21.0 node tooling/probe-workerd-disconnect.mjs`. With a 500 ms heartbeat, the 100 ms observation had zero writes/aborts; after the first write it had one abort. With a 50 ms heartbeat, the 100 ms observation already had the abort. Both assertions passed on the pinned runtime. This explains the previous idle-stream failure without claiming immediate notification for silent streams. Future long-lived streams need bounded heartbeat intervals and deadlines; cooperative work must consume the propagated signal.

Context7 resolve/query on 2026-09-18 retrieved Cloudflare's [Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/): its `enable_request_signal` example also keeps writing pings. The focused experiment above establishes local timing behavior; the docs alone do not.

## Hosted acceptance and retained observations

One earlier full run produced an intermittent Node ECONNRESET during the disconnect case. A focused rerun, five consecutive isolated Node HTTP runs, the subsequent full suite and the isolated clean-copy suite passed. Its cause has not been established; the Node fetch fixture now attaches the failing route to errors for a future recurrence. Do not erase this observation or claim a root-cause fix.

[Hosted run 35347249101](https://github.com/EIHRTeam/HyperBug/actions/runs/35347249101) completed successfully on 2026-09-18 for `bcd417c9dc8b19a3476a4d7f0b4645d827ae742d` on `codex/phase-01-02`. All four required jobs passed: quality, Node, workerd and PostgreSQL. Logs confirm 9 unit + 1 contract + 10 Node + 36 workerd + 24 PostgreSQL tests, totaling 80 ordinary passes. Quality also passed frozen installation, both migration histories, typecheck, lint, formatting, secret/license scans, high-severity audit and both builds.

The hosted database is actual PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2), using `postgres:18.6` with observed image digest `sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280`. All fixtures and the container were cleaned up by the job. Runtime jobs used Node 24.21.0 and the frozen package graph on Linux. There is no deployment/live object-provider claim. The optional Elysia next lane remains deferred by the recorded consideration; it is not a required acceptance condition. G1 is unchanged and no SPA exists.

Runner logs warn that checkout/setup-node v4 target the retired action Node 20 runtime and are automatically run on Node 24. Those actions passed in this run; review their maintained major during subsequent tooling upkeep. This action-runtime warning is separate from the application Node 24.21.0 pin. The documented moderate Drizzle Kit development advisory remains; no high finding was suppressed.

## Requirement-to-evidence audit

| Checklist IDs | Inspected evidence and result |
| --- | --- |
| 01.1a, 01.1b | TOOLCHAIN records exact installed/registry versions, official/Context7 references and reviewed compatibility decisions; both pinned runtime builds execute. |
| 01.1c | Commit `bcd417c` contains the workspace, Node version, strict configs/exports, lint/format/lifecycle policy and sole `pnpm-lock.yaml`; its separate clean checkout installs frozen and passes type/build/test checks. |
| 01.1d | Thirteen workspace projects include both API roots and all specified shared packages; explicit `packages/database/*` globs include both adapters. |
| 01.1e, 01.V3 | `tooling/check-boundaries.mjs` inspects actual imports/manifests; the boundary unit test inserts forbidden package/relative/type imports and verifies command failure and cleanup. |
| 01.2a, 01.2b | Verified `@elysia/node` export/lifecycle; the two roots compose `packages/server` and production entry tests serve both bundles without proof routes. |
| 01.2c | Workers root compiles at module initialization under the pinned date/flags; workerd tests exercise validation and plugin encapsulation. |
| 01.2d, 01.V1 | Shared HTTP suite covers health/readiness, request IDs, safe errors, malformed/oversized/chunked input and response parity. |
| 01.2e, 01.V2 | Runtime configuration rejects missing/invalid production settings; explicit local/staging/production configuration and telemetry/error tests prevent fixture secrets leaking. |
| 01.2f | Both actual local HTTP runtimes pass streaming, incoming-signal cleanup and deadline tests; the bare probe explains write-driven workerd detection. |
| 01.3a | `package.json` and development/migration guides contain executable dev/build/type/lint/format/test/database commands used in the recorded runs. |
| 01.3b | Frozen-install quality, Node, workerd and PostgreSQL jobs; dependency/secret/license checks fail on actionable findings. Hosted outcome is recorded separately. |
| 01.3c | Private PostgreSQL 18.6 cluster and pinned local S3 service have bounded startup/cleanup; signed storage operations and signature rejection pass. |
| 01.3d | `Telemetry` and `jsonTelemetry` emit allowlisted logs, bounded-cardinality metrics and correlated traces; both roots supply runtime sinks. |
| 01.3e | TOOLCHAIN/ADR explicitly defer the optional Elysia 2 beta lane; stable required checks remain authoritative. |

No requirement in these rows claims production deployment, live object-store acceptance, authentication or SPA completion. Those gates remain with later modules.
