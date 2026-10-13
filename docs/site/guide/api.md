# Use the public API

[Documentation home](../index.md)

The backend provides versioned JSON APIs and a framework-independent TypeScript client. The contract/client are available in the repository; the package is not published to a registry. Backend acceptance remains incomplete, including the unmeasured Cloudflare Standard profile.

## Configure a consumer

Use `@hyperbug/api-client` from the workspace and set `baseUrl` to your independently hosted HTTPS API origin. Obtain an opaque bearer token through the registered Authorization Code + S256 PKCE flow; keep browser tokens only in memory. The client sends no account-session cookies and needs no frontend-host proxy.

```ts
import { createApiClient } from '@hyperbug/api-client';
let token: string | null = null;
const api = createApiClient({
  baseUrl: 'https://api.example.com', getToken: () => token,
});
const instance = await api.request('GET /api/v1/instance');
console.log(instance.tier, instance.search.textScope);
```

`search.textScope` is `title` for Minimum and `title-and-body` for Standard. Capabilities report actual tier/password/degradation behavior; they do not grant permissions.

## Pagination, writes and errors

Use each operation's typed params/body/query. Pass opaque pagination cursors unchanged; include the current expected revision for updates. Private project and Staff actions still require server-authorized membership/assurance. Safe reads have bounded retries; Issue submissions are one-shot unless you explicitly opt into the documented idempotency receipt using the same key and exact payload. An ambiguous error requires reconciliation before another submission.

Use `signal` to cancel and `timeoutMs` to set a total deadline. `ApiClientError` gives a stable code, status, correlation ID and ambiguity flag without copying private provider text. Refetch on revision conflicts.

Upload files directly to the short-lived storage capability with its signed headers, without the API bearer or cookies. Finalize through the API; upload success does not prove scanning or release. Fetch released media from its isolated origin under current authorization.

## Contract and examples

[OpenAPI artifact](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/packages/contracts/openapi.json), [client source](https://github.com/EIHRTeam/HyperBug/tree/feat/v1/packages/api-client), and [non-browser examples and retry rules](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/API-CLIENT.md) describe the current repository contract. Run `corepack pnpm api:check` to detect source drift. Response consumers tolerate additive properties; breaking protocol changes require a versioned contract decision.
