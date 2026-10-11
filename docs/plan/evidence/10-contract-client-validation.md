# Module 10 B2 — contract and public client

Date: 2026-10-11. Scope: 10.1a–e. Node 24.21.0/pnpm 11.26.0; TypeScript 7.0.2, TypeBox 0.34.52, Elysia 1.4.30, Vitest 5.0.1, oxfmt 0.68.0, oxlint 1.83.0. No deployment or external package addition.

## Result

The checked [OpenAPI 3.1 artifact](../../../packages/contracts/openapi.json) consolidates the TypeBox DTOs, 99 registered API/auth/health methods and two existing isolated-media methods on 75 paths. [Generator](../../../tooling/public-api.ts) checks labelled registration, JSON request/query/response schemas, status-specific/no-body/native HTML responses, recursive references, exact path parameters, form-encoded OAuth requests, receipt/resource replay, auth/cache/rate policies and the existing closed error catalog. Media is explicitly on its isolated origin. Its native handler is documented separately from Elysia registrations. No new endpoint or auth protocol.

[Client](../../../packages/api-client/src/index.ts) imports only public/generated contracts. Request/response operation types are generated from the same schema projection; unknown response fields are tolerated. Runtime client policy enforces configurable HTTPS origin (loopback HTTP for tests), cookie omission, current-memory bearer injection, stable headers, deadline/cancellation covering every phase, bounded JSON reads, redirect refusal and at most two extra attempts. Unsafe replay requires explicit opt-in and the route's actual 24-hour receipt or caller-UUID upload reservation mechanism. Unsupported/unkeyed mutations never replay after ambiguous failure. [English non-browser examples](../../API-CLIENT.md) and matching [EN](../../site/guide/api.md)/[ZH](../../site/zh-CN/guide/api.md) reader guides include pagination, revision conflicts, safe errors, tokens, uploads and publication limits.

Build-time tooling imports Elysia/server only to inspect the current registered schemas; no implementation type or runtime dependency reaches the client. The existing route label registry moved to a shared server module. Its previously unmatched DELETE account/sessions/:id now has its existing account.sessions label; routing/permissions are unchanged. Errors export their existing catalog solely for contract consolidation.

## One batch verification and repairs

Exact commands use `CI=true` to match the installed local virtual-store configuration. All repository commands retain supply-chain validation.

- `corepack pnpm typecheck`: root/Workers/ingress pass.
- `corepack pnpm lint`: no warnings/errors; workspace/client implementation boundaries pass.
- `corepack pnpm exec vitest run --project unit --project contract tests/unit/api-client.test.ts tests/contract/public-api.test.ts`: **9 passed**. Safe bounded transport/read retries, identical keyed replay, unkeyed/unsupported non-replay, privacy, expiry/cancellation of fetch/body/token work, response bounds, form/no-body behavior; entire registered schema/method/generated-source/reference drift check. These are synthetic transport cases and source compatibility, not a deployment/provider claim.
- `corepack pnpm api:check`, `build`, `docs:build`, `scan:licenses`, `scan:secrets`, scoped `oxfmt --check` of ten changed code/manifest files and `git diff --check`: pass. Markdown is excluded by the existing formatter; checked via docs build/links instead.

Initial setup/type/lint/drift failures were corrected. Empty path-param types initially required params; generated types now distinguish absent params. Namespace enumeration differed between Node/Vitest for identical named schemas; stable name sorting makes references deterministic. Sequential bounded retries/stream reads use async recursion rather than parallel operations or a lint exemption. Control-character validation uses numeric character checks. Missing session-delete telemetry classification was caught by consolidation.

Adding a workspace importer required installation. Offline policy metadata was missing and a frozen attempt correctly refused the new workspace link. An unfrozen resolution was stopped before lockfile publication; the original lockfile resolutions were retained and only two workspace links added. Final `CI=true corepack pnpm install --frozen-lockfile` passed all 684-entry supply-chain policies, restored 433 packages and retained every external version. The sandboxed license inventory could not open pnpm’s existing SQLite package index; approved read access then passed all 11 license expressions. No policy bypass, lifecycle exemption, dependency upgrade or new external dependency. Transient provider download retries are setup failures, not test evidence.

## Focused security/compatibility review

Primary review checks cookie and redirect credential isolation, fresh per-attempt bearer, single serialization/key preservation, absence of unsafe default replay, no raw errors/URLs/token logging, bounded retry/body/deadline/listener cleanup and no infrastructure imports. Newer browser abort composition helpers are avoided in favor of widely available AbortController and explicit cleanup. Actual server permission/revocation/CORS and provider effects remain owning matrix evidence; opaque WebAuthn payloads are not falsely described as generated exhaustive schemas. No independent/delegated review claimed. Research references/version gaps and modern-web guide compatibility/fallback choices are in API-CLIENT.

The API client is a private workspace package, not an npm publication. No Standard measurement, SLO, production readiness or gate passes from this batch.
