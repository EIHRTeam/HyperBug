# ADR 0001: Shared HTTP foundation and runtime proof

Status: Accepted; both runtime suites and hosted CI passed. See the linked foundation evidence.
Date: 2026-09-18.

## Decision

Use Elysia 1.4.30 with `@elysia/node` 1.4.6 on Node 24.21.0 and the built-in `CloudflareAdapter` on workerd. The server owns HTTP routing, validation, request IDs, safe error mapping and body bounds. Entry points own runtime startup, environment bindings and telemetry sinks. A single framework-independent TypeBox schema package describes public payloads.

Use Miniflare 5.20260916.0-alpha, the exact version already used by Wrangler 4.133.0. The initially tried stable 4.20260730.0 brought vulnerable undici/sharp dependencies; moving to the Wrangler-aligned version removes both high-severity advisories without forcing transitive overrides. Prerelease development tooling is allowed by TECH-STACK. Pin compatibility date 2026-09-16 to the bundled workerd build and enable `nodejs_compat` and `enable_request_signal`. Keep AOT enabled and compile at module initialization. Test both runtime packages on every update.

The original idle-stream disconnect probe did not observe an abort before its timeout. A focused bare-Worker experiment found that workerd detects the closed peer on the next write. The shared HTTP fixture now emits a bounded 50 ms heartbeat and verifies incoming `request.signal` plus cooperative cleanup on both Node and workerd, without expected failures. Retain the [bare probe](../../tooling/probe-workerd-disconnect.mjs) and [timing evidence](../plan/evidence/01-foundation-validation.md). Later long-lived streams must combine bounded heartbeat intervals with deadlines and signal-aware work; silent-stream immediate notification is not promised. This resolves 01.2f's local runtime proof without a runtime/framework substitution.

Health endpoints expose process readiness only while no business dependencies are wired. The readiness port is abort-aware and bounded. Later modules must compose actual required dependency readiness; the current response does not advertise a complete product backend.

Only test fixtures contain proof/error/stream endpoints. They are absent from production bundles. API error bodies and logs never include raw provider errors, paths, headers, request bodies or stack traces. Request IDs are generated on the server, not trusted from client headers. Metric dimensions are fixed route categories and status classes.

CORS/authentication are not implemented by a permissive placeholder. The configured exact origins are validated now for later security modules. These health-only applications expose no authenticated business mutations.

## Verification required

Node HTTP and workerd tests must compare success, invalid schema/JSON, missing route, oversized bodies, internal errors, request ID uniqueness, plugin encapsulation, streaming and timeouts. Unit tests must reject insecure production configuration and prove telemetry redaction. Boundary checks must reject an intentionally forbidden import.

Node and workerd do not have identical cancellation transports. Test local signal cancellation and timeout propagation, and document any runtime disconnect limitation rather than claiming equivalence from an in-memory handler.

## Consequences

The default framework and both production profiles are preserved. Compiler/lint tooling must support TypeScript 7; Biome avoids typescript-eslint's currently incompatible compiler peer range. The allowed-to-fail Elysia next lane may detect future changes but cannot replace stable required checks.

## Independent module 02 work

Module 02.1 domain/API specifications and 02.2–02.3 persistence contracts, schema generation and database suites do not depend on transport disconnect notification or a hosted CI run. G0 is satisfied, the shared HTTP behavior/type/build foundation is proven, and PostgreSQL 18.6 is locally usable. This exception allowed those bounded items to proceed while the module 01 verification gap was still open. This follows the plan's documented dependency-analysis exception; it did not itself declare module 01 complete, open G1, or authorize product endpoints/SPA work. Module 01 subsequently completed its own runtime and hosted-CI acceptance, as recorded in the foundation evidence.
