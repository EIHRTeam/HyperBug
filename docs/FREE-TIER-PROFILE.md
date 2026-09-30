# HyperBug Cloudflare Free minimum-tier profile

Status: Opt-in deployment-tier specification adopted as direction by [ADR 0007](decisions/0007-cloudflare-free-minimum-tier.md). Configuration/posture and the PBKDF2/password-pepper mechanism are implemented, with startup still refused. The production iteration policy is fixed from the 2026-09-29 real Free-plan measurement ([evidence](plan/evidence/03-free-pbkdf2-measurement.json)): current 50,000, stored maximum 100,000, reviewed floor 600,000 — the floor is unmet, so per the floor rule the tier offers no password login (`passwordLogin: false`) until plan limits change. The tier is a variant of Profile A, is never part of G1 or G2, and is accepted only by its own checklist (`13.G6`). Reader-facing disclosure is published through `docs/site/` in English and Simplified Chinese.

This specification is normative for the tier it defines. Where it differs from a requirement that applies to the standard profiles, the difference is recorded per section of the source baseline and is limited to deployments that explicitly enable the tier.

## Tier identity and enablement contract

The tier identifier is `cloudflare-free-minimum`. It is a deliberate, degraded operating mode, not an automatic reaction to a provider plan.

- `HYPERBUG_DEPLOYMENT_TIER` selects the tier. An absent value means `standard`; the only other accepted value is `cloudflare-free-minimum`.
- `cloudflare-free-minimum` additionally requires `HYPERBUG_DEGRADATION_ACK` with the exact value `free-minimum-v1`. A missing, stale or mistyped acknowledgement fails startup with a message that points to this specification.
- The tier is accepted only on the Cloudflare runtime. The Node composition root rejects it, because the tier exists to fit the Workers Free envelope and must not silently become a supported self-host mode.
- The application never infers the tier from the provider plan, a quota error, an absent binding or a missing capability. Only the explicit operator configuration enables it.
- Changing the tier requires a restart. Enabling, changing or acknowledging the tier emits an audit event and a startup warning listing the active degradation identifiers.
- Readiness and the public capability document report the tier, the degradation identifiers and the password-hash policy; no secret, quota credential or key material is included. The current readiness and instance capability contracts report the running standard tier and would truthfully report the minimum tier's flags (password capabilities advertise only under the standard algorithm); the minimum tier still fails startup, so no enabled-tier document exists yet.

## Non-negotiable invariants

The following never change on this tier, and a configuration or plugin cannot disable them: object-level authorization and role checks; append-only audit integrity with metadata redaction; the Markdown/CSP/sanitization policy; keyed-digest credentials and AES-256-GCM envelope encryption; TLS and HSTS; memory-only browser tokens; bearer-only business APIs; fail-closed authorization; and the prohibition on debug, test or authorization bypass paths.

## Degradation catalog

Identifiers are stable and are referenced by the configuration warning, the capability document, the reader documentation and the release notes.

| ID | Degradation | Compensating control | Owner |
| --- | --- | --- | --- |
| FREE-01 | Password hashing uses PBKDF2-HMAC-SHA256 with measured parameters instead of Argon2id; no Argon2id path exists on this tier | Mandatory service-side pepper, per-user random salt, versioned algorithm/iteration/pepper records, reviewed parameter floor, login-time rehash after an upgrade, passkey and one-time recovery code alternatives | 03.2g, 03.V7, 04.1e |
| FREE-02 | Sensitive rate limits are approximate and per Cloudflare location; no globally consistent counter exists | D1-backed account lockout and progressive delay, per-account and per-route quotas, required Turnstile when configured, administrator alerting, declared consistency model | 03.3h, 03.V6 |
| FREE-03 | Background work is a D1 outbox with bounded Cron dispatch; message retention beyond 24 hours and Workflow-grade durability are not guaranteed | Idempotency records, post-crash reconciliation, D1 failed-job storage with authorized replay, visible backlog age | 09.1f, 09.2e, 09.3g, 09.V6 |
| FREE-04 | Shorter audit and diagnostic-log retention; no Logpush or OTLP export; Workers Logs retains 3 days | Audit stays append-only and complete; administrator audit browsing and bounded operator queries; quota and backlog alerts | 03.3g, 13.1f |
| FREE-05 | Capacity ceilings: 500 MB per D1 database, 5 GB per account, 5 million rows read and 100,000 rows written per day, 50 queries per invocation, 100,000 requests per day shared with Durable Objects and Workflows, 5 Cron Triggers, 50 subrequests per invocation | Instance ceiling derived from measured fixtures, bounded batches with quota pre-checks, explicit capacity errors instead of silent loss | 08.2h, 09.1f, 10.3g, 13.1f |
| FREE-06 | No first-party sending to arbitrary recipients; an operator-provided SMTP relay is required and deliverability is not guaranteed | TLS plus SASL authentication to the relay, credentials encrypted through the KeyProvider, bounded retry and deduplication, header-injection protection; verified destination addresses may use Cloudflare Email Service on Free for administrator notices | 16.1d, 16.2i, 16.3f |
| FREE-07 | Recovery objectives are bounded by 7-day D1 Time Travel and the absence of log export | RPO/RTO measured and recorded for this tier; backup and restore rehearsed under its limits; standard-profile objectives are not inherited | 13.2g, 13.G6 |
| FREE-08 | Bulk, import/export and long multi-step jobs are disabled or size-capped; providers that need paid capabilities are unavailable | Capability-gated API and UI with explanatory states, bounded administrator-triggered alternatives | 09.3g, 12.3f, 16.3f |

The FREE-02 account lockout mechanism now has a bounded delay policy and a D1 store in migration `0009_account_lockouts`. A canonical account name is HMAC-digested under the existing dedicated abuse-key ring; the table holds only each active key version, its digest, a failure count, the next permitted time and expiry. An atomic primary-write upsert increments a failed-password streak and advances the next permitted time. A verified success clears the streak; expired rows can be purged in bounded batches. Reads rely on the current no-replica D1 policy. Key rotation requires checking, updating and clearing every active version and retaining the previous version through the longest live streak.

The route contract is rate admission first, lockout admission before password verification, failure recording after an invalid password, and clearing only after a verified success. An unknown account uses the same canonical account-name digest path, so the storage operation cannot reveal account existence. The account route and canonicalization rule remain owned by module 04, and deployed read-replication/multi-location behavior remains tier acceptance scope. Chosen delay parameters (500 ms initial, doubling every two failures, 15-minute cap and streak reset), digest-only administrator alerting (one alert per subject digest per ten-minute suppression window, per isolate, best-effort) and the declared consistency model are fixed since 2026-09-30: D1 account lockout and authoritative admission counters are consistent; volumetric per-route/per-IP shedding and administrator alerts are approximate. These do not activate the minimum tier.

Shared HTTP guards now give each lockout admission, failure record and verified-success clear a 10–5,000 ms caller-selected deadline. A locked account receives the closed `RATE_LIMITED` response with a bounded retry hint; unavailable, malformed, stalled or cancelled D1 work receives `RATE_LIMIT_UNAVAILABLE`. A timed-out write may finish after the response, but it never grants a login credential after the deadline. The future account route must retain the same trusted subject set across these operations and deny completion when a required transition fails.

`createMinimumLoginAdmission` composes the intended order for an owned account route: authoritative account/IP rate counters, D1 lockout, then the optional CAPTCHA gate with the fixed `login` action. One abuse-key snapshot produces both the rate counter subjects and the account digests used by the lockout and its later failure/success transition. A successful admission returns a one-use server-side permit; the caller records an invalid password or clears a verified success before completing the login. The public server package now exposes a bound variant that fixes the key, counter and lockout sources at the application root and replaces a route-supplied IP with the root's trusted address. The shared app supplies a closed default while no minimum-tier root composition exists. The future route still owns canonical account input, password verification, credentials and generic account-existence responses. No route uses this service, and the minimum tier remains unavailable.

Using D1 counters for every login is stronger than an approximate per-location limit and consumes Free-plan writes for every active key version and dimension; after the 2026-09-29 measurement (100,000 D1 writes per day) the declared model keeps them consistent — the write budget accommodates a small instance's attempt volume and dropping them would weaken enforcement below the security baseline — while volumetric shedding stays approximate on the Workers Rate Limiting binding. The D1 lockout compensation is mandatory either way.

## Password credentials on this tier

The planned tier retains password login for ordinary accounts, subject to the reviewed floor. It is **not available in the current build**: startup is refused and no account service uses the mechanism yet.

- Algorithm: PBKDF2-HMAC-SHA256 through platform Web Crypto, with a per-user random salt and a mandatory keyed pepper managed as a versioned key through the existing KeyProvider and rotation procedures. A missing pepper is a startup failure, never a fallback to unpeppered hashing.
- Iterations: the highest count that completes within the measured Free per-invocation CPU budget with a recorded margin. The value is produced by 03.V7 measurement on the actual plan, not by assumption. Measured 2026-09-29: current 50,000 (≈50% CPU margin), stored-record maximum 100,000 (the deterministic per-invocation fit); the Cloudflare tier adapter refuses policies above the measured ceiling. The verifier also requires a deployment-selected maximum acceptable stored count and rejects records above it before pepper lookup or derivation. That maximum must itself fit the measured CPU budget; it is not a substitute for the reviewed floor or a reason to lower an existing stronger record.
- Floor rule: if the measured count is below the floor confirmed by security review, the tier must not offer password login, and the capability document must report `passwordLogin: false`. Publishing a hash without meaningful protection is not an acceptable outcome of this specification.
- Records: algorithm identifier, iteration count, pepper version, salt and format version are stored per credential, and a login-time rehash upgrades the record whenever a stronger policy becomes available.
- Prohibited: deriving a weaker verifier for an existing stronger hash; verifying Argon2id records with the PBKDF2 path; unsalted, single-round SHA-256/SHA-512/MD5 storage; plaintext or reversible password storage; client-side hashing as the only factor; and any statement or interface that implies Argon2id protection on this tier.
- Alternatives: passkeys and single-use recovery codes remain available and are the recommended path. Because no email channel is required, recovery must also work through recovery codes and administrator-assisted recovery.

The current mechanism has no default iteration count. Functional Node/workerd and D1/PostgreSQL fixtures use 1,000/1,200 iterations only to verify record parsing, context binding, pepper rotation, backup retention and rehash persistence; those numbers are not candidates for deployment. The separate `password-pepper` key purpose was added in migration 0008. A policy-bound service and Cloudflare adapter now preflight the current pepper with a bounded wait; production-root provisioning and account integration remain open. The real Free-plan CPU measurement and the reviewed floor decision were completed on 2026-09-29 (see the [measurement](plan/evidence/03-free-pbkdf2-measurement.json) and [tier validation](plan/evidence/03-deployment-tier-validation.md)): the policy is fixed at current 50,000 / stored maximum 100,000 iterations with the 600,000 floor unmet, so the floor rule disables tier password login. The tier still fails startup.

## Capacity ceilings and quotas

The provider facts below are dated documentation statements (2026-09-20). They must be re-verified when the tier is implemented, and they must not be presented as measured local results.

| Resource | Workers Free ceiling | Consequence for this tier |
| --- | --- | --- |
| Worker CPU per invocation | 10 ms | Password hashing, search compilation and dispatch must fit the budget; `limits.cpu_ms` is not available |
| Requests per day | 100,000 shared with Durable Object requests and Workflow executions | Instance ceiling is measured, not promised; acceptance must record quota headroom |
| D1 | 500 MB per database, 5 GB per account, 50 queries per invocation, 5 million rows read and 100,000 rows written per day | Full-text indexing, audit retention and job tables share the write budget |
| Queues | 10,000 operations per day, 24-hour non-configurable retention | Not a durability guarantee; D1 failed-job storage is authoritative |
| Workflows | 3,000 steps per day, 10 ms CPU per step, 1,024 steps per instance, 100 concurrent instances, 3-day state retention | Long multi-step jobs are out of scope; bulk and import/export are capability-gated |
| Cron Triggers | 5 per account | Cleanup, dispatch and retention schedules are consolidated and budgeted |
| R2 | 10 GB-month, 1 million Class A and 10 million Class B operations per month | Attachment quotas and cleanup thresholds are configured per tier |
| Observability | Workers Logs 200,000 events per day, 3-day retention; Logpush is paid-only | Operator queries replace export; retention is disclosed |

## Email delivery

The notification pipeline stays single; delivery is an adapter behind it.

- The supported Free path is a self-implemented SMTP client over `cloudflare:sockets`: implicit TLS on port 465 or STARTTLS on port 587. Outbound port 25 is prohibited, and Cloudflare, private and loopback destinations are unreachable, so the relay must be publicly reachable and must authenticate the connection.
- The Node runtime uses the same protocol layer over `node:net`/`node:tls` and may reach a private relay; one conformance fixture covers both.
- Credentials are backend-only, encrypted through the KeyProvider, never logged and never returned to a client. TLS certificate validation is mandatory. Response parsing, timeouts and message size are bounded, and header or recipient injection through CRLF is rejected.
- Cloudflare Email Service remains an optional adapter. On Free it can send only to verified destination addresses, which is sufficient for administrator notices but not for public notifications.
- Deliverability is the operator's relay responsibility. Documentation must state that inbox placement is not guaranteed and that direct-to-MX delivery is not supported.

## Capability document

An unauthenticated instance capability document (owned by 04.2g, published through the public OpenAPI) reports at least:

- `deploymentTier`, the active degradation identifiers with short summaries and links to this specification;
- `capabilities`: password login availability, passkey and recovery-code availability, email channel kind, durable-workflow availability, bulk and import/export availability, audit and log export availability, and available CAPTCHA providers;
- `passwordHashPolicy`: algorithm identifier, iteration count, pepper version and an explicit downgraded flag;
- documented instance limits, with values derived from measurement rather than assumption.

Clients and the SPA must render unavailable capabilities as explained, non-actionable states instead of failing controls, and must not present a degraded capability as if it were the standard profile.

## Disclosure requirements

1. Enabling the tier produces a startup warning and an audit event, and the administrator interface shows a persistent status entry listing the active degradations.
2. The end-user interface shows a persistent, accessible degradation notice with a per-session dismissal and a permanent status or footer entry, linking to the operator's documentation. The notice must not imply Argon2id protection or any capability the instance lacks.
3. Reader documentation under `docs/site/guide/` and `docs/site/zh-CN/guide/` states the degradations, the non-negotiable invariants and the compensating controls in both languages, kept in sync per the documentation policy.
4. Release notes state when the degradation list, the password policy or the tier's supported capabilities change.
5. Operator runbooks state the quota budgets, the measured instance ceiling, the retained-data windows and the recovery objectives for this tier instead of inheriting standard-profile statements.

## Upgrade and downgrade rules

- Upgrade to Workers Paid: the tier is disabled, the standard-profile mechanisms apply, and PBKDF2 password records are rehashed to Argon2id on the next successful login. Passkeys and recovery codes are unaffected.
- Downgrade from a standard profile: existing Argon2id password records cannot be verified on this tier. The operator must migrate accounts to passkeys or recovery codes, or reset credentials through administrator-assisted recovery, before enabling the tier. A downgrade pre-check is part of 13.1f.
- The tier must never be enabled as a silent fallback when a standard-profile requirement fails.

## Evidence required before support is claimed

The tier stays documentation until: 03.V6 and 03.V7 pass (tier gate, Free-plan password measurement, reviewed floor, retention measurements); 04.V6 passes (password, passkey and recovery journeys without email, capability document matching enforcement); 08.V6, 09.V6 and 10.3g pass (quota-exhaustion behavior, async recovery, quota-aware measurement recorded as its own evidence set); 12.V7 passes (disclosure notice and capability-gated surfaces); and 13.G6 accepts the tier on a real Free account with published reader documentation. Missing access keeps `13.G6` open rather than substituting emulation for plan evidence.
