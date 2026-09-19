# Configure the initial security foundation

[Documentation home](../index.md) · [Operations](operations.md)

> Status: The initial backend security controls are implemented. Authentication, credential encryption, password hashing, audit access, distributed rate limiting and outbound-fetch protection are not yet complete. This is not a production readiness claim.

## Set the environment and browser origins

Set `HYPERBUG_ENV` explicitly to `local`, `staging` or `production`. Set `ALLOWED_ORIGINS` to a comma-separated list of exact HTTPS origins, such as `https://issues.example.org`. Up to 16 unique origins are supported. Do not include paths, credentials, wildcard domains or a trailing slash. Local mode also permits HTTP loopback origins such as `http://localhost:5173`.

A request with an unlisted Origin receives `ORIGIN_FORBIDDEN` (403). A request without Origin remains eligible for the normal authentication and permission checks; omitting Origin does not grant access. Business APIs do not enable cross-origin cookies. Allowed preflights expire after at most 300 seconds. All current responses use `Cache-Control: no-store`.

`DEBUG` defaults to `false`. `DEBUG=true` is valid only in the explicit local environment. API errors always contain a safe code, message and server-generated request ID, never a stack trace or provider message. Configuration must contain policy settings only; do not put credentials in policy values.

## Bound API input

The defaults are 65536 body bytes and a 10000 ms request deadline. JSON is limited to depth 16, 4096 values, 128 keys per object, 256 items per array and 32768 characters per string. URLs are limited to 8192 characters, query parameters to 64 (including duplicates), names to 128 characters and decoded values to 2048 characters. Character limits count UTF-16 code units. Endpoint schemas may impose smaller limits.

Use `MAX_BODY_BYTES`, `REQUEST_TIMEOUT_MS`, `MAX_JSON_DEPTH`, `MAX_JSON_NODES`, `MAX_JSON_OBJECT_KEYS`, `MAX_JSON_ARRAY_ITEMS`, `MAX_JSON_STRING_LENGTH`, `MAX_URL_LENGTH`, `MAX_QUERY_PARAMETERS` and `MAX_QUERY_VALUE_LENGTH` for reviewed deployment settings. Invalid or out-of-range supplied values prevent startup rather than selecting a permissive fallback.

## Configure separate retention periods

All values below are in seconds. They define intended cleanup cutoffs; automatic cleanup and privileged audit-retention procedures are still pending. They do not extend credential validity or authorize deletion of referenced records.

| Setting | Default |
| --- | --- |
| `RETENTION_SECURITY_LOG_SECONDS` | 2592000 (30 days) |
| `RETENTION_AUDIT_SECONDS` | 31536000 (365 days) |
| `RETENTION_ABUSE_SECONDS` | 86400 (1 day) |
| `RETENTION_EXPIRED_SESSION_SECONDS` | 86400 (1 day) |
| `RETENTION_DELETED_ACCOUNT_SECONDS` | 2592000 (30 days) |
| `RETENTION_TEMPORARY_UPLOAD_SECONDS` | 86400 (1 day) |
| `RETENTION_EXPORT_SECONDS` | 86400 (1 day) |

Review legal holds, privacy needs, linked records and required backup/key versions before a future cleanup procedure. These defaults do not establish legal compliance.

## Understand sensitive administration

The permission contract requires project administrator rights, verified authentication assurance and recent authentication for sensitive administration. `ADMIN_RECENT_AUTH_SECONDS` defaults to 300 and cannot exceed 900. `AUTHORIZATION_TIMEOUT_MS` defaults to 1000 and cannot exceed 5000; verification errors and timeouts deny access. Account flows and feature routes must still integrate this contract in their implementation phases.

For all setting ranges and implementation boundaries, see the [engineering specification](https://github.com/EIHRTeam/HyperBug/blob/main/docs/SECURITY-FOUNDATION.md).
