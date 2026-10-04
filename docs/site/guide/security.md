# Configure the initial security foundation

[Documentation home](../index.md) · [Operations](operations.md)

> Status: Backend security/account flows are locally verified at their recorded scopes. Cloudflare Minimum is a formal third profile with disclosed password risk. Full G1/G2 and real-Free acceptance remain open; this is not production readiness. Later-module audit and Argon2id performance work remain suspended.

## Set the environment and browser origins

Set `HYPERBUG_ENV` explicitly to `local`, `staging` or `production`. Set `ALLOWED_ORIGINS` to a comma-separated list of exact HTTPS origins, such as `https://issues.example.org`. Up to 16 unique origins are supported. Do not include paths, credentials, wildcard domains or a trailing slash. Local mode also permits HTTP loopback origins such as `http://localhost:5173`.

A request with an unlisted Origin receives `ORIGIN_FORBIDDEN` (403). A request without Origin remains eligible for the normal authentication and permission checks; omitting Origin does not grant access. Business APIs do not enable cross-origin cookies. Allowed preflights expire after at most 300 seconds. Anonymous instance metadata may be cached for 60 seconds with an ETag and Origin/Authorization/Cookie variation. Credentialed instance requests, errors and all other API routes use `Cache-Control: no-store`.

`DEBUG` defaults to `false`. `DEBUG=true` is valid only in the explicit local environment. API errors always contain a safe code, message and server-generated request ID, never a stack trace or provider message. Configuration must contain policy settings only; do not put credentials in policy values.

## Bound API input

The defaults are 65536 body bytes and a 10000 ms request deadline. JSON is limited to depth 16, 4096 values, 128 keys per object, 256 items per array and 32768 characters per string. URLs are limited to 8192 characters, query parameters to 64 (including duplicates), names to 128 characters and decoded values to 2048 characters. Character limits count UTF-16 code units. Endpoint schemas may impose smaller limits.

Use `MAX_BODY_BYTES`, `REQUEST_TIMEOUT_MS`, `MAX_JSON_DEPTH`, `MAX_JSON_NODES`, `MAX_JSON_OBJECT_KEYS`, `MAX_JSON_ARRAY_ITEMS`, `MAX_JSON_STRING_LENGTH`, `MAX_URL_LENGTH`, `MAX_QUERY_PARAMETERS` and `MAX_QUERY_VALUE_LENGTH` for reviewed deployment settings. Invalid or out-of-range supplied values prevent startup rather than selecting a permissive fallback.

## Configure implemented retention and deadlines

`RETENTION_EXPIRED_SESSION_SECONDS` defaults to 86400 seconds (one day) and accepts 1–2592000. Existing five-minute schedulers remove bounded batches of expired/revoked sessions, OAuth credentials and passkey challenges after this retention. Receipts, counters and D1 lockouts use stored expiry. Audit, content history, recovery codes and attachments remain untouched.

Security decisions use `AUTHORIZATION_TIMEOUT_MS` (1000 ms default, 10–5000). Store reads/writes use `STORE_READ_TIMEOUT_MS` / `STORE_WRITE_TIMEOUT_MS` (1000 ms each, 10–10000). These bounds cover the recorded live D1 sample; they are configurable and do not promise sustained p99 latency. Password hashing and streaming keep their separate bounds. Local debug emits safe route/status/request-ID diagnostics only.

The former security-log, audit, abuse, deleted-account, temporary-upload and export `RETENTION_*` settings are reserved and explicit values now prevent startup: their cleanup owners are unfinished. Configure provider log retention independently and review holds, references and retained backup/key versions before future deletion.

The Workers Minimum password service caps work at ten simultaneous operations per isolate; durable rate admission and lockout still apply. The 2026-10-05 test run completed ten concurrent logins, but instrumented CPU reached 20–47 ms and billing-plan attribution was unavailable. Free-plan CPU headroom and release acceptance remain unverified.

Production API/ingress Worker logs use explicit 10% head sampling; local and staging use 100%. Required durable audit records remain complete. Log-byte quotas have not been measured.

## Understand sensitive administration

Sensitive project administration requires that project’s administrator role. Instance account and plugin administration requires the separate `instance-administrator` role; creating a project cannot grant it. Bootstrap grants the instance role, and an upgrade selects the earliest active Staff principal, so review that recipient before migrating. The final active instance administrator cannot be suspended.

Sensitive operations require a fresh verified passkey login. Assurance and authentication time belong to the presented session/token; signing in on another device cannot upgrade an old token. Existing tokens after the assurance migration need a new passkey login. `ADMIN_RECENT_AUTH_SECONDS` defaults to 300 (the former hardcoded window was 900) and accepts 1–900. `AUTHORIZATION_TIMEOUT_MS` defaults to 1000 and accepts 10–5000; both runtime profiles consume these settings, and verification errors/timeouts deny access.

CAPTCHA setup is optional. Omit `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY` and `TURNSTILE_HOSTNAME` to run without a provider. Supply all three through appropriate backend bindings to select Turnstile automatically; partial setup prevents startup. Cloudflare's public test keys work only in local development; staging and production reject them. The secret stays backend-only. For local Workers development with Turnstile, put the three bindings and the two required key rings in the ignored `apps/api-cloudflare/.dev.vars.local-turnstile` file, or export them in the shell. The normal `corepack pnpm dev:cloudflare` command selects this configuration automatically when that file or a Turnstile shell binding exists and starts without CAPTCHA when neither exists. `GET /api/v1/accounts/register` publishes the selected public site key and the `register` challenge action. `POST` enforces a configured challenge after rate admission and before password hashing; without a provider it needs no challenge token. A failed or unavailable check denies registration, and CAPTCHA does not replace rate limits or permission checks. A local workerd test through the signed gateway verifies the configured branch with a fixture provider: missing tokens and provider outages deny before account storage; live provider behavior remains unverified.

The registration route is the first product consumer of the sensitive rate-limit guard. It limits the canonical account handle and a trusted client IP before password hashing or account storage. Node takes the IP from its native socket peer, ignoring forwarded headers; operators behind a reverse proxy still need a separately verified client-IP policy. Its approximate load-shedding limit runs before the primary counter; passing the approximate limit never skips the primary check. The standard Workers profile has a public ingress Worker and a private API Worker connected by a service binding. They share a secret used to sign and verify a short-lived client-address assertion; direct unsigned API requests return 503. Local workerd registration and login pass through this pair; genuine deployed client provenance remains unverified. Registration creates only a User account and does not sign in or grant Staff privileges. Separate login, session read, and logout routes work locally; recovery and full authorization remain unfinished.

`/health/live` remains available during health-only startup. `/health/ready` returns 503 until the abuse key ring and current token-HMAC key load and the primary-counter, credential, and authorization-session tables are queryable; Workers also needs its approximate limit binding. A 200 response confirms those read-only prerequisites, not that account writes, trusted Workers ingress, or deployed counters are ready.

For all setting ranges and implementation boundaries, see the [engineering specification](https://github.com/EIHRTeam/HyperBug/blob/main/docs/SECURITY-FOUNDATION.md).

## Credential protection status

Core now supplies CSPRNG opaque credentials, purpose-bound HMAC digests, AES-256-GCM envelope encryption and AES-256-KW key wrapping. The available key sources are the `HYPERBUG_KEY_RING` Worker Secret binding and a private self-hosted POSIX file owned by the running user with permissions 0400 or 0600. Keys do not belong in ordinary runtime configuration.

These mechanisms now have D1 and PostgreSQL key-lifecycle registries. They track current, previous and revoked versions and prevent removing a key referenced by stored data or retained backups. Both backend roots now connect their key source to the registry and the shared server. Self-hosted Node selects its key source with optional `HYPERBUG_KEY_FILE` and a complete PostgreSQL connection; the separate abuse key file is not needed to load the registry, but account admission and readiness still require it. Supplying the key file without a database connection refuses startup. Without a key source, health-only startup is allowed and operations needing keys fail closed. Registration and login now use the standard password service and primary-backed sessions locally; recovery and deployed-provider verification remain pending. A key being present is not enough to permit use, and missing/revoked keys or provider errors deny the operation. Do not substitute an always-allow policy or delete key versions needed by retained data/backups. See the [cryptography implementation boundaries](https://github.com/EIHRTeam/HyperBug/blob/main/docs/CRYPTOGRAPHY.md).

Backup capture pins required keys before the snapshot begins and blocks rotation/removal until capture finishes. Backup expiry does not release those keys automatically: a trusted operator must confirm that all copies have been destroyed after the retention period. Provider backup/restore procedures remain pending; a restored database must be reconciled with current revocations and retained backups before use. These internal controls do not expose a public key-administration endpoint.

## Deployment tier status

Three profiles are planned for acceptance: Node/PostgreSQL and Cloudflare Standard use Argon2id; Cloudflare Minimum uses peppered PBKDF2. Select Minimum with `HYPERBUG_DEPLOYMENT_TIER=cloudflare-minimum` and `HYPERBUG_DEGRADATION_ACK=minimum-v2`. The old tier name is a deprecated alias; the old acknowledgement is refused. Node refuses Minimum. Remove the acknowledgement when selecting `standard`.

Minimum enables public password registration, login and recovery. New passwords need at least 12 characters, bounded input and rejection of common bundled passwords. New records use 50,000 iterations, stored costs cap at 100,000. This provides less offline-guessing protection than Argon2id. Keep the pepper separate and prefer passkeys. Online rate limits, durable progressive lockout and configured CAPTCHA cannot compensate for offline guessing after both database and pepper compromise.

Account/auth/write routes wait for append-only audited activation and pepper preflight; liveness, instance metadata and anonymous public GETs remain available. Readiness stays unavailable while activation is pending or fails. The instance document reports actual capabilities. Standard login upgrades verified PBKDF2 to Argon2id; Minimum refuses Argon2id, so prepare passkeys/recovery or a credential reset before downgrade.

G1/G2 require all three profiles. Additional actual Free-plan acceptance (13.G6) remains open; local success is not release support. Free-plan background durability, retention/export, capacity, email relay, recovery and bulk limits remain disclosed in the [profile specification](https://github.com/EIHRTeam/HyperBug/blob/main/docs/FREE-TIER-PROFILE.md). Authorization, atomic required audit, content security, encryption, TLS and browser-token policy remain mandatory.

## Verify HTTPS and transport claims

Check the frontend and API hostnames separately. Cloudflare can negotiate hybrid `X25519MLKEM768` key agreement with supporting TLS 1.3 clients. Self-hosted deployments need a configured HTTPS terminator; the current Node listener uses local HTTP. Check the actual negotiated group, verified certificate, proxy boundary and HSTS settings before describing a deployment as protected. A TLS cipher name alone does not identify its key agreement.

Local Node checks passed for hybrid negotiation, classical fallback and certificate/protocol rejection. They do not verify a live Cloudflare or self-hosted deployment. Hybrid key agreement protects confidentiality; it does not establish post-quantum authentication across the whole application path. Cloudflare's origin-facing ML-DSA support is a separate capability that has not been configured or verified here. See the [transport verification procedure and evidence](https://github.com/EIHRTeam/HyperBug/blob/main/docs/TRANSPORT-SECURITY.md).

Recovery-code generation and regeneration require authentication within `ADMIN_RECENT_AUTH_SECONDS` (default 300 seconds). A stale session receives `REAUTHENTICATION_REQUIRED` (403), leaving existing codes valid. With CAPTCHA configured, passkey login requires a `captchaToken` for the login action. Account/role/plugin administration, bootstrap enrollment and recovery-code replacement commit their audit event with the database mutation; an audit insert failure rolls everything back and returns `AUDIT_UNAVAILABLE` (503).

Session state is read from the primary on every request. Idle expiry is renewed only when due: every five minutes for Users and three minutes for Staff, within the existing absolute lifetime. Logout, revocation and credential changes still take effect on the next request.
