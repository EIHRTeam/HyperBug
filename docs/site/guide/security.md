# Configure the initial security foundation

[Documentation home](../index.md) · [Operations](operations.md)

> Status: Initial backend security controls and local registration, login, session, and logout routes exist on both profiles. Credential digests, envelope encryption, and persistent key-lifecycle protection have local tests. Full authentication, recovery, audit access, distributed rate limiting, and outbound-fetch acceptance remain open. This is not a production readiness claim. Audit development and Argon2id performance work are suspended; the Free tier remains disabled.

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

CAPTCHA setup is optional. Omit `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY` and `TURNSTILE_HOSTNAME` to run without a provider. Supply all three through appropriate backend bindings to select Turnstile automatically; partial setup prevents startup. Cloudflare's public test keys work only in local development; staging and production reject them. The secret stays backend-only. For local Workers development with Turnstile, put the three bindings and the two required key rings in the ignored `apps/api-cloudflare/.dev.vars.local-turnstile` file, or export them in the shell. The normal `corepack pnpm dev:cloudflare` command selects this configuration automatically when that file or a Turnstile shell binding exists and starts without CAPTCHA when neither exists. `GET /api/v1/accounts/register` publishes the selected public site key and the `register` challenge action. `POST` enforces a configured challenge after rate admission and before password hashing; without a provider it needs no challenge token. A failed or unavailable check denies registration, and CAPTCHA does not replace rate limits or permission checks. A local workerd test through the signed gateway verifies the configured branch with a fixture provider: missing tokens and provider outages deny before account storage; live provider behavior remains unverified.

The registration route is the first product consumer of the sensitive rate-limit guard. It limits the canonical account handle and a trusted client IP before password hashing or account storage. Node takes the IP from its native socket peer, ignoring forwarded headers; operators behind a reverse proxy still need a separately verified client-IP policy. Its approximate load-shedding limit runs before the primary counter; passing the approximate limit never skips the primary check. The standard Workers profile has a public ingress Worker and a private API Worker connected by a service binding. They share a secret used to sign and verify a short-lived client-address assertion; direct unsigned API requests return 503. Local workerd registration and login pass through this pair; genuine deployed client provenance remains unverified. Registration creates only a User account and does not sign in or grant Staff privileges. Separate login, session read, and logout routes work locally; recovery and full authorization remain unfinished.

`/health/live` remains available during health-only startup. `/health/ready` returns 503 until the abuse key ring and current token-HMAC key load and the primary-counter, credential, and authorization-session tables are queryable; Workers also needs its approximate limit binding. A 200 response confirms those read-only prerequisites, not that account writes, trusted Workers ingress, or deployed counters are ready.

For all setting ranges and implementation boundaries, see the [engineering specification](https://github.com/EIHRTeam/HyperBug/blob/main/docs/SECURITY-FOUNDATION.md).

## Credential protection status

Core now supplies CSPRNG opaque credentials, purpose-bound HMAC digests, AES-256-GCM envelope encryption and AES-256-KW key wrapping. The available key sources are the `HYPERBUG_KEY_RING` Worker Secret binding and a private self-hosted POSIX file owned by the running user with permissions 0400 or 0600. Keys do not belong in ordinary runtime configuration.

These mechanisms now have D1 and PostgreSQL key-lifecycle registries. They track current, previous and revoked versions and prevent removing a key referenced by stored data or retained backups. Both backend roots now connect their key source to the registry and the shared server. Self-hosted Node selects its key source with optional `HYPERBUG_KEY_FILE` and a complete PostgreSQL connection; the separate abuse key file is not needed to load the registry, but account admission and readiness still require it. Supplying the key file without a database connection refuses startup. Without a key source, health-only startup is allowed and operations needing keys fail closed. Registration and login now use the standard password service and primary-backed sessions locally; recovery and deployed-provider verification remain pending. A key being present is not enough to permit use, and missing/revoked keys or provider errors deny the operation. Do not substitute an always-allow policy or delete key versions needed by retained data/backups. See the [cryptography implementation boundaries](https://github.com/EIHRTeam/HyperBug/blob/main/docs/CRYPTOGRAPHY.md).


Backup capture pins required keys before the snapshot begins and blocks rotation/removal until capture finishes. Backup expiry does not release those keys automatically: a trusted operator must confirm that all copies have been destroyed after the retention period. Provider backup/restore procedures remain pending; a restored database must be reconciled with current revocations and retained backups before use. These internal controls do not expose a public key-administration endpoint.

## Deployment tier status

The default `standard` tier retains the standard password policy and both first-class backend profiles. The planned `cloudflare-free-minimum` tier is an explicit Cloudflare Free variant with its own acceptance gate. Its configuration parser requires `HYPERBUG_DEPLOYMENT_TIER=cloudflare-free-minimum` and the exact `HYPERBUG_DEGRADATION_ACK=free-minimum-v1`; Node rejects this tier. Unknown values, whitespace and stale acknowledgements prevent startup. Remove the acknowledgement when selecting `standard`.

The current build also refuses correctly configured minimum-tier startup because its compensating controls and independent acceptance are incomplete. The configuration parser does not enable password login or declare the tier supported. Provider plan, quota errors and missing bindings never select it automatically.

`/health/ready` reports the running tier, degradation IDs and required password-hash policy on both healthy and unavailable responses. Today it reports `standard`, an empty ID list and `argon2id`. This describes policy; it does not mean password login or the full product is ready. The minimum tier cannot return readiness while its startup barrier is active.

The planned differences are PBKDF2 instead of Argon2id, location-scoped rate limits, reduced background durability, shorter retention without log export, Free-plan capacity ceilings, an operator SMTP relay for arbitrary recipients, a shorter recovery window, and capped bulk/long-running jobs. Authorization, audit integrity/redaction, content security, credential/envelope encryption, TLS/HSTS and browser-token rules remain mandatory. See the [minimum-tier specification and compensating controls](https://github.com/EIHRTeam/HyperBug/blob/main/docs/FREE-TIER-PROFILE.md). The standard Workers profile uses the paid-capable runtime envelope; minimum-tier PBKDF2 cannot verify an Argon2id credential.

## Verify HTTPS and transport claims

Check the frontend and API hostnames separately. Cloudflare can negotiate hybrid `X25519MLKEM768` key agreement with supporting TLS 1.3 clients. Self-hosted deployments need a configured HTTPS terminator; the current Node listener uses local HTTP. Check the actual negotiated group, verified certificate, proxy boundary and HSTS settings before describing a deployment as protected. A TLS cipher name alone does not identify its key agreement.

Local Node checks passed for hybrid negotiation, classical fallback and certificate/protocol rejection. They do not verify a live Cloudflare or self-hosted deployment. Hybrid key agreement protects confidentiality; it does not establish post-quantum authentication across the whole application path. Cloudflare's origin-facing ML-DSA support is a separate capability that has not been configured or verified here. See the [transport verification procedure and evidence](https://github.com/EIHRTeam/HyperBug/blob/main/docs/TRANSPORT-SECURITY.md).
