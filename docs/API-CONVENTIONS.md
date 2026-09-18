# Public API conventions

The public business API uses `/api/v1`. Its contract is versioned JSON/REST plus OpenAPI, independent of Elysia server types. `packages/contracts` owns reusable schemas and DTOs; module 10 owns validated OpenAPI generation and the public client. No feature endpoint exists merely because it is listed in the [inventory](API-OPERATIONS.md).

## Representations and compatibility

IDs are lowercase UUID strings. Issue numbers and revisions are positive bounded integers. Instants are canonical UTC strings with exactly three fractional digits. Nullable fields are explicitly null; optional fields describe genuinely absent capabilities, not a second encoding of null. Requests reject unknown fields; response consumers must tolerate additive fields. Breaking field meanings, enum removals, narrowing accepted input, or changing ordering semantics requires a versioned contract change. New closed enums need a documented client compatibility strategy.

Use JSON with `Content-Type: application/json` for ordinary writes. Apply endpoint-specific byte, string, nesting and collection bounds before expensive work. The foundation defaults to a 64 KiB JSON byte ceiling and a 10-second cooperative deadline. Upload binaries use the module 07 direct-upload flow. Framework validation details, stack traces, SQL and provider responses are never public error payloads.

## Errors and correlation

Errors have `{ "error": { "code": "STABLE_CODE", "message": "Safe explanation.", "requestId": "uuid" } }`. Every response gets a server-generated `X-Request-ID`, ignoring untrusted client IDs. Errors and health/private/security responses use `Cache-Control: no-store`. Request IDs may appear in logs/audit/traces, but never as metric dimensions. Logs contain no credentials, cookies, request bodies or raw error objects.

| HTTP status | Meaning |
| --- | --- |
| 400 | Invalid schema/JSON/query/cursor |
| 401 | Missing or invalid authentication (module 04) |
| 403 | Authenticated operation forbidden; use 404 where resource existence is private |
| 404 | Missing or invisible resource |
| 408 | Request deadline or cancellation where a response remains possible |
| 409 | Stale revision, idempotency mismatch/expiry, or domain conflict |
| 413 | Actual request bytes exceed the limit, with or without Content-Length |
| 415 | Unsupported media type |
| 429 | Bounded abuse/rate policy rejects work (module 03) |
| 500 / 503 | Safe internal failure / dependency unavailable |

## Mutations and concurrency

Every mutable resource carries a revision. Update commands include `expectedRevision`; adapters compare it atomically. A mismatch returns `REVISION_CONFLICT` with a safe refetch instruction, never silently overwrites the newer resource. Successful writes return the new representation and revision. Server clocks own timestamps.

Endpoints that support retries require `Idempotency-Key` (16–128 ASCII letters, digits, hyphens, underscores). Scope, payload matching and expiry follow [DATA-MODEL](DATA-MODEL.md). Authorization is evaluated on every attempt including replays. A replay may return the prior snapshot, identified by `Idempotency-Replayed: true`; clients can explicitly refetch current state. Secrets and signed capabilities must not be stored in replay snapshots. Unsupported idempotency behavior must be documented per endpoint; never advertise replay safety for external effects before outbox acceptance.

## Cursor pagination

Collections default to 40 items and cap at 100; an endpoint may impose a stricter bound. Clients pass `limit` and `after`, treat `after` as opaque, and receive `{ items, nextCursor }` where `nextCursor` is null at the end. No unlimited list and no deep offset pagination exist. Lists exclude full Markdown/HTML/tree bodies; module 07 supplies bounded plain-text previews under the [content plan](plan/modules/07-content-and-attachments.md). Detail representation and rendering never change cursor boundaries.

Version 1 cursors encode a bounded base64url JSON envelope containing version, resource, project, normalized filter/sort fingerprint and the last item's immutable sort tuple. Initially the Issue sort is `created_at DESC, id DESC`. Decode validates byte size (maximum 1024), exact known fields, version, UUID/time types and the supplied resource/project/filter/sort. Mismatches are `INVALID_CURSOR` (400), not a silent first-page restart. These non-secret cursors are not authorization capabilities; every page reauthorizes project/object visibility. User tampering can select a different boundary only within the same authorized query, never inject SQL or expand bounds. A future cursor carrying a protected snapshot must be authenticated with a reviewed MAC before use.

A deleted boundary item does not invalidate the tuple; use strict keyset comparisons. Inserts after the previous page's newest boundary appear on a refresh, not later pages. Deletions may shorten a page. Mutable filters can change membership between pages; v1 provides a live traversal, not snapshot isolation. If a version/sort policy is retired, reject the old cursor as `CURSOR_STALE` (400) and instruct refresh. Equal timestamps always use the ID tie-breaker.

## Visibility, authentication and deprecation

[API-OPERATIONS](API-OPERATIONS.md) defines the minimum permission matrix. Public User and Staff identities are separate. Browser bearer credentials remain memory-only; no new auth flow or browser token store is introduced by these conventions. Authentication, CSRF/CORS, assurance and revocation implementation belongs to modules 03–04.

A hidden project/resource yields the same safe 404 as a missing one where existence would disclose information. Moderated content is excluded from public detail, lists, search, history and event metadata. Cross-project references require authorization to both sides and an explicitly accepted feature policy; initial writes disallow them.

Additive changes are documented with release notes and OpenAPI diffs. Deprecations publish migration guidance and an announced removal policy before a breaking version is released; this foundation invents no arbitrary calendar SLA. Module 10 adds consumer compatibility tests and owns readiness to publish the API.
