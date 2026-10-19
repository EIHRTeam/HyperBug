# Configure security

[Documentation home](../index.md) · [Installation](deployment.md) · [Operations](operations.md) · [Private reporting](troubleshooting.md)

The candidate’s security mechanisms have local evidence at their recorded scopes. Hosted backend G1, MVP G2 and real-Free13.G6 remain open; this is not production certification. Native plugins cannot weaken Core policy.

## Environment, origins and browser boundary

Set `HYPERBUG_ENV` explicitly to `local`, `staging` or `production`. `DEBUG` defaults to false and true is local-only. `ALLOWED_ORIGINS` contains1–16 unique exact HTTPS origins, with no wildcard, path, credentials or trailing slash; explicit local mode also accepts loopback HTTP. Invalid policy prevents startup. A missing Origin does not waive authentication/permission checks.

Register public client `hyperbug-web`, exact frontend `/oauth/callback` and scope `public-api`; it has no secret. Credential entry, passkey ceremony and consent happen on the first-party authorization origin. Business APIs use bearer tokens with credentials omitted, never cross-site session cookies. App tokens/drafts remain in memory; reload/expiry/sign-out/access loss clears private state. Keep the frontend static, with deployment-generated restrictive CSP and no runtime script/plugin injection, SSR, Pages Functions or API proxy.

Private/account/token/error responses use no-store. Anonymous instance metadata may cache60seconds with validators and Origin/Authorization/Cookie variation. Preflight lifetime caps at300seconds. Frontend config is public/no-store, unversioned HTML revalidates and hashed assets are immutable. Exact API/upload CORS and isolated media permissions must match the actual deployment.

## Input and operational bounds

| Setting | Default / accepted range |
| --- | --- |
| `MAX_BODY_BYTES`, `REQUEST_TIMEOUT_MS` | 65,536bytes /10,000ms; stricter route limits still apply |
| JSON depth/nodes/object keys/array items/string length |16 /4,096 /128 /256 /32,768UTF-16 units |
| URL length/query count/name/value |8,192 /64 /128 /2,048UTF-16 units |
| `AUTHORIZATION_TIMEOUT_MS` |1,000ms;10–5,000 |
| `STORE_READ_TIMEOUT_MS`, `STORE_WRITE_TIMEOUT_MS` |1,000ms;10–10,000 |
| `ADMIN_RECENT_AUTH_SECONDS` |300seconds;1–900 |
| `RETENTION_EXPIRED_SESSION_SECONDS` |86,400seconds;1–2,592,000 |
| `ASYNC_ORPHAN_RETENTION_SECONDS` |86,400 after intent expiry;3,600–31,536,000 |
| `ASYNC_TERMINAL_RETENTION_SECONDS` |2,592,000seconds;86,400–31,536,000 |

Use the canonical [configuration specification](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/SECURITY-FOUNDATION.md) for every setting and parser bound. Former security-log/audit/abuse/deleted-account/temporary-upload/export `RETENTION_*` values remain reserved and explicit values refuse startup; do not invent cleanup configuration. Scheduled cleanup preserves audit/content history, active references and required key/blob accounting. Provider log retention is separate.

Complete optional Turnstile secret/site-key/hostname bindings select required challenge verification; partial configuration fails. Public test keys are local-only. A configured provider failure denies the protected action. CAPTCHA never replaces trusted-IP/account rate admission, durable lockout or permissions. Node reads its native socket peer and ignores arbitrary forwarded headers; a reverse proxy’s real-client policy needs verification. Workers use a controlled signed ingress and private API; direct unsigned callers do not gain trusted client identity.

## Accounts, assurance and recovery

Public Users and Staff are separate identity domains; email/name equality grants nothing. Project Triage/Maintainer/Administrator roles do not grant the separate `instance-administrator` role. Bootstrap enrolls the first Staff through a one-time operator-channel secret; no unauthenticated bypass exists. Upgrade role backfill chooses the earliest active Staff, so inspect the actual target before migration. Suspension and credential changes deny old sessions/tokens on the next primary-backed validation; session renewal never upgrades authentication time/assurance.

Sensitive actions need current role and a recent user-verified passkey login (assurance2). Password/bootstrap credentials have assurance1; registering a passkey alone does not upgrade the presented token. Existing assurance-migration credentials need a fresh ceremony. Recovery-code regeneration requires recent authentication; codes are displayed once, stored as keyed digests and redeem once, replacing the credential and revoking prior sessions/tokens. No forced password setter or instance-role management API is available. Lost-last-admin operator re-arm must satisfy store preconditions; never delete Staff/history to force enrollment.

## Keys, backups and plugin trust

Use `node tooling/provision-operator-files.ts /absolute/new/private/directory` offline under a private parent. Generated independently random secret files use0700directory/0600files and exclusive writes; no values are printed. Generation does not activate keys. Activate public references through the existing audited trusted KeyRegistry integration; the PostgreSQL CLI requires a query-free TCP URI with verified TLS, while D1 uses a native private binding integration. There is no public key/replay/rebuild maintenance endpoint.

Node key/abuse/bootstrap/storage mounts are owned regular no-symlink files with0400/0600permissions. Worker equivalents use Secret bindings, never vars or public config. Bootstrap uses `HYPERBUG_BOOTSTRAP_ENROLLMENT` on Workers and `HYPERBUG_BOOTSTRAP_FILE` on Node. HMAC credential/blind-index/abuse/password-pepper purposes and AES envelope keys remain separate. Recoverable secrets use AES-256-GCM with wrapped per-record keys; stored records identify exact key versions. Missing/revoked material or unavailable lifecycle state denies use.

Planned rotation retains current/previous/required versions, rewraps or migrates under expected revisions and removes only unreferenced keys. Backup capture pins all required versions; expiry alone does not release pins. Compromise requires immediate audited revocation and current-state reconciliation after restoring an older database. See [operations](operations.md) for the exercised sequence and explicit recovery limits.

Native plugins execute with application privileges and are not sandboxed. Review source/provenance, permissions, destinations, secret fields and build-time UI/CSP before integration. External services use scoped signed contracts; plugins never decide Core policy. Secret settings are write-only; configuration reads expose presence only.

## Minimum and deployment acceptance

Select `cloudflare-minimum` / `minimum-v2` explicitly; Node refuses Minimum. It uses mandatory versioned pepper plus per-user16-byte salt and PBKDF2-HMAC-SHA256,50,000new iterations/100,000stored maximum. New passwords require12Unicode code points, at most1,024UTF-8bytes and common-password rejection. This is weaker offline protection than Argon2id; online controls cannot compensate after database-plus-pepper compromise. Prefer passkeys. Standard rehashes verified PBKDF2 at login; Minimum refuses Argon2id, requiring a verified downgrade recovery plan.

All FREE-01–FREE-08 degradations/compensations and immutable authorization, audit, content, encryption, TLS/HSTS and browser-token invariants are in the [matrix](deployment.md) and [Free runbook](deploy-cloudflare.md). Account/write routes wait for audited activation and pepper preflight; readiness remains unavailable until activated. Public reads/liveness do not imply account/write readiness. Source policy is not measured Free CPU fit or a released capability.

Verify certificate/hostname, HTTPS/HSTS, actual proxy/client-IP isolation, storage CORS and scanner bridge/resource isolation/update at the selected production environment before release. Cloudflare’s hybrid TLS capability is not proof of the negotiated deployment handshake or end-to-end post-quantum authentication. Never disable TLS verification. Upload success does not prove scanning/release, and scanner/storage failures retain quarantine/accounting. [Private vulnerability reporting](troubleshooting.md) is the verified confidential channel; no production SLA or support response deadline is promised.
