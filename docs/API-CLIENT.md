# Public API client and OpenAPI

The checked artifact is [OpenAPI 3.1](../packages/contracts/openapi.json). `packages/contracts` owns DTO/TypeBox JSON Schemas; `tooling/public-api.ts` consolidates them with the registered server methods and shared telemetry route registry. Build-time tooling may inspect the server; the generated client imports no Elysia, runtime root, adapter or server type. No external dependency was added. Optional services may return a closed unavailable error until configured.

Run `corepack pnpm api:generate` after an intentional contract change and `corepack pnpm api:check` to detect drift. The contract lane also compares every registered method/request/query/response and recursive reference. `api:check` is a compatibility/drift check against the committed snapshot, not automatic permission to change a contract. Requests remain closed; response consumers tolerate additive properties. Review breaking meaning/enum/input/order changes under API-CONVENTIONS before regenerating.

The JSON artifact includes 99 API/auth/health methods and two existing isolated-media methods on 75 paths. The TypeScript operation map covers registered routes; the client accepts business/health operations and cookie-free token exchange/revocation. Backend-owned cookie/HTML authorization pages belong on their authorization origin and are intentionally outside the client transport. WebAuthn options/credential payloads remain opaque protocol objects. Media responses are streams on the separately configured media origin, rather than JSON business responses.

## Non-browser consumer

Within this workspace, import `@hyperbug/api-client`. The package is private and has not been published to a registry. Node 24 supplies native fetch. Configure the independently hosted HTTPS API origin; HTTP is accepted only on loopback for development. Pass a token supplied by the registered Authorization Code + S256 PKCE flow. Never use an account-session cookie as a business credential or persist browser access tokens.

```ts
import { createApiClient, ApiClientError } from '@hyperbug/api-client';
let token: string | null = null; // obtained through the registered PKCE protocol
const client = createApiClient({
  baseUrl: 'https://api.example.com',
  getToken: () => token,
  timeoutMs: 10_000,
  maxRetries: 2,
});
const instance = await client.request('GET /api/v1/instance');
console.log(instance.tier, instance.search.textScope);
const projectId = '10000000-0000-4000-8000-000000000001';
const page = await client.request('GET /api/v1/projects/{projectId}/issues', {
  params: { projectId }, query: { limit: 40 },
});
if (page.nextCursor) {
  await client.request('GET /api/v1/projects/{projectId}/issues', {
    params: { projectId }, query: { limit: 40, after: page.nextCursor },
  });
}
// A one-shot Issue submission is never automatically retried.
try {
  await client.request('POST /api/v1/projects/{projectId}/issues', {
    params: { projectId }, body: { title: 'Example', body: 'Reproduction steps' },
  });
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error(error.code, error.requestId);
    // If ambiguous, reconcile the submitted operation before submitting again.
  }
}
```

For an explicitly replayable submission, generate one key before the initial attempt, retain it with the exact submitted payload for its documented 24-hour receipt lifetime, and use that same key on every retry:

```ts
await client.request('POST /api/v1/projects/{projectId}/issues', {
  params: { projectId }, body: { title: 'Example', body: 'Reproduction steps' },
  idempotencyKey: crypto.randomUUID(), retryMutation: true,
});
```

Only Issue create/edit/triage, comment create/edit and form submission advertise header receipt replay. Upload reservation PUT uses the caller's `uploadId` UUID as its exact-payload resource identity; opt-in `retryMutation` may replay that PUT. No retry opt-in can replay an unsupported mutation, capability generation, finalize, reaction, plugin change or single-use OAuth code exchange. Revision-bearing writes include the current `expectedRevision`; refetch on conflict, never remove the guard. A replay returns its recorded snapshot; explicit refetch obtains current state.

## Transport and error behavior

Every attempt uses `credentials: 'omit'`, `redirect: 'error'`, no referrer and `cache: 'no-store'`. Stable Accept/Content-Type/Authorization/Idempotency-Key headers are owned by the client; no caller-controlled arbitrary headers or cookie channel exists. Tokens are read from the supplied getter for each attempt and never logged or persisted by the client. OAuth token/revoke requests use form encoding without a bearer header.

Caller cancellation and one total timeout cover token acquisition, fetch, response reading and retry waits. AbortController plus an explicit timer/listener fallback avoid relying on newer AbortSignal composition helpers. GET/HEAD may retry network failures and 429/502/503/504, at most two additional attempts. Receipt/resource-protected mutations additionally require `retryMutation: true`. Integer Retry-After is respected when the wait fits the bounded two-second retry window and deadline; longer hints return the error without an early retry. Mutation payload is serialized once. Redirects are refused to prevent credential forwarding. JSON response reading is bounded (default 8 MiB, configurable 1 KiB–64 MiB); upload/download binary streams do not pass through this transport.

`ApiClientError` exposes status, bounded stable code, UUID correlation ID and whether a mutation's outcome is ambiguous. Its message never copies a provider/server exception, body, signed URL, token or request URL. Unknown codes remain forward compatible; no success-schema stripping removes additive fields. Malformed/oversized success responses do not establish a failed mutation.

## Direct upload

Reserve the authorized intent with a caller UUID; request its short-lived capability; send bytes directly to the returned storage URL with only the signed headers, without the API bearer or cookies; then finalize through the API. Never log/persist capabilities or infer scanning/release from an upload or finalize response. Scan results and released attachment authorization remain independent server checks. Do not retry a storage PUT based on API receipt policy.

## Research and limits

Documentation lookup: 2026-10-11. Context7 resolve/query selected `/sinclairzx81/typebox`, `/websites/nodejs_latest-v24_x_api` and `/elysiajs/documentation`. TypeBox documentation describes direct JSON Schema, union anyOf, static inference and non-JSON Undefined; the current docs use the newer package spelling, so installed @sinclair/typebox 0.34.52 serialization and recursive IDs were verified by the actual contract lane. No newer codegen/Schema.Intern API is used. Elysia docs cover per-status schemas/OpenAPI but do not establish the exact route introspection shape; installed Elysia 1.4.30 probes and drift checks fill that gap. Node 24 docs cover fetch and abort primitives.

Modern-web-guidance search/retrieve IDs: `deprioritize-background-fetches` (Fetch priority Newly Available, guide dated Baseline 2024-10-29), `full-session-analytics` (fetchLater Limited Availability). Those analytics features do not serve response-dependent API requests; no fetchLater/polyfill/priority dependency was introduced. The applicable cancellation principle uses widely available fetch/AbortController plus manual timer/listener cleanup. No HTML/UI change or accessibility claim is made.

Verification, review and acceptance limitations are recorded in [B2 evidence](plan/evidence/10-contract-client-validation.md). OpenAPI/client compatibility does not establish deployment, provider performance, Standard acceptance or the SPA gate.
