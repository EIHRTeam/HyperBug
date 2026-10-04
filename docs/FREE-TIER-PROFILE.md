# HyperBug Cloudflare Free minimum-tier profile

Status: Formal third profile under [ADR 0012](decisions/0012-cloudflare-minimum-formal-profile.md), superseding ADR 0007's password-floor and gate exclusions. Public peppered PBKDF2 accounts are enabled with the disclosed Minimum-only exception (50,000 new / 100,000 stored maximum iterations), at least 12 characters and a bounded bundled common-password denylist. This provides less offline-guessing resistance than the standard Argon2id baseline. G1/G2 cover all three profiles; 13.G6 remains additional actual Free-plan evidence and is open. Prior measurements and journeys are historical evidence of their recorded versions; B15 revalidates the changed profile. Reader disclosure is synchronized in English and Simplified Chinese.

This specification is normative for the tier it defines. Where it differs from a requirement that applies to the standard profiles, the difference is recorded per section of the source baseline and is limited to deployments that explicitly enable the tier.

## Tier identity and enablement contract

Canonical tier: `cloudflare-minimum`. Absent `HYPERBUG_DEPLOYMENT_TIER` selects `standard`. The deprecated input alias `cloudflare-free-minimum` normalizes to the canonical tier with a warning; both inputs require `HYPERBUG_DEGRADATION_ACK=minimum-v2`. The old `free-minimum-v1` acknowledgement is refused with the new value named. Node refuses Minimum; provider-plan/quota state never selects a profile.

Audited activation requires a current password pepper, append-only `deployment.enablement` and a warning. New activation uses a distinct deterministic v2 event ID; historical v1 rows are never rewritten. Account/auth/password/write requests wait for activation and fail closed on failure. Liveness, instance metadata and anonymous GETs remain available; readiness reports unavailable while pending. The separate `apps/api-cloudflare/src/minimum.ts` entry shares composition and excludes Argon2id Wasm; `minimum-local` selects it for local work.

The instance document reports the canonical tier, actual PBKDF2 policy and password registration/login capabilities. Recovery/passkey flags reflect their configured stores. Activation never implies release acceptance or 13.G6.

## Non-negotiable invariants

The following never change on this tier, and a configuration or plugin cannot disable them: object-level authorization and role checks; append-only audit integrity with metadata redaction; the Markdown/CSP/sanitization policy; keyed-digest credentials and AES-256-GCM envelope encryption; TLS and HSTS; memory-only browser tokens; bearer-only business APIs; fail-closed authorization; and the prohibition on debug, test or authorization bypass paths.

## Degradation catalog

Identifiers are stable and are referenced by the configuration warning, the capability document, the reader documentation and the release notes.

| ID | Degradation | Compensating control | Owner |
| --- | --- | --- | --- |
| FREE-01 | Password hashing uses PBKDF2-HMAC-SHA256 with measured parameters instead of Argon2id; no Argon2id path exists on this tier | Mandatory service-side pepper, per-user random salt, versioned algorithm/iteration/pepper records, disclosed Minimum-only exception, login-time rehash after an upgrade, passkey and one-time recovery code alternatives | 03.2g, 03.V7, 04.1e |
| FREE-02 | Sensitive rate limits are approximate and per Cloudflare location; no globally consistent counter exists | D1-backed account lockout and progressive delay, per-account and per-route quotas, required Turnstile when configured, administrator alerting, declared consistency model | 03.3h, 03.V6 |
| FREE-03 | Background work is a D1 outbox with bounded Cron dispatch; message retention beyond 24 hours and Workflow-grade durability are not guaranteed | Idempotency records, post-crash reconciliation, D1 failed-job storage with authorized replay, visible backlog age | 09.1f, 09.2e, 09.3g, 09.V6 |
| FREE-04 | Shorter audit and diagnostic-log retention; no Logpush or OTLP export; Workers Logs retains 3 days | Audit stays append-only and complete; administrator audit browsing and bounded operator queries; quota and backlog alerts | 03.3g, 13.1f |
| FREE-05 | Capacity ceilings: 500 MB per D1 database, 5 GB per account, 5 million rows read and 100,000 rows written per day, 50 queries per invocation, 100,000 requests per day shared with Durable Objects and Workflows, 5 Cron Triggers, 50 subrequests per invocation | Instance ceiling derived from measured fixtures, bounded batches with quota pre-checks, explicit capacity errors instead of silent loss | 08.2h, 09.1f, 10.3g, 13.1f |
| FREE-06 | No first-party sending to arbitrary recipients; an operator-provided SMTP relay is required and deliverability is not guaranteed | TLS plus SASL authentication to the relay, credentials encrypted through the KeyProvider, bounded retry and deduplication, header-injection protection; verified destination addresses may use Cloudflare Email Service on Free for administrator notices | 16.1d, 16.2i, 16.3f |
| FREE-07 | Recovery objectives are bounded by 7-day D1 Time Travel and the absence of log export | RPO/RTO measured and recorded for this tier; backup and restore rehearsed under its limits; standard-profile objectives are not inherited | 13.2g, 13.G6 |
| FREE-08 | Bulk, import/export and long multi-step jobs are disabled or size-capped; providers that need paid capabilities are unavailable | Capability-gated API and UI with explanatory states, bounded administrator-triggered alternatives | 09.3g, 12.3f, 16.3f |

The FREE-02 account lockout mechanism now has a bounded delay policy and a D1 store in migration `0009_account_lockouts`. A canonical account name is HMAC-digested under the existing dedicated abuse-key ring; the table holds only each active key version, its digest, a failure count, the next permitted time and expiry. An atomic primary-write upsert increments a failed-password streak and advances the next permitted time. A verified success clears the streak; expired rows can be purged in bounded batches. Reads rely on the current no-replica D1 policy. Key rotation requires checking, updating and clearing every active version and retaining the previous version through the longest live streak.

The route contract is rate admission first, lockout admission before password verification, failure recording after an invalid password, and clearing only after a verified success. An unknown account uses the same canonical account-name digest path, so the storage operation cannot reveal account existence. The account route and canonicalization rule remain owned by module 04, and deployed read-replication/multi-location behavior remains tier acceptance scope. Chosen delay parameters (500 ms initial, doubling every two failures, 15-minute cap and streak reset), digest-only administrator alerting (one alert per subject digest per ten-minute suppression window, per isolate, best-effort) and the declared consistency model are fixed since 2026-09-30: D1 account lockout and authoritative admission counters are consistent; volumetric per-route/per-IP shedding and administrator alerts are approximate. Activation still requires its separate audit and pepper preflight.

Shared HTTP guards now give each lockout admission, failure record and verified-success clear a 10–5,000 ms caller-selected deadline. A locked account receives the closed `RATE_LIMITED` response with a bounded retry hint; unavailable, malformed, stalled or cancelled D1 work receives `RATE_LIMIT_UNAVAILABLE`. A timed-out write may finish after the response, but it never grants a login credential after the deadline. The account route retains the same trusted subject set across these operations and denies completion when a required transition fails.

`createMinimumLoginAdmission` composes the intended order for an owned account route: authoritative account/IP rate counters, D1 lockout, then the optional CAPTCHA gate with the fixed `login` action. One abuse-key snapshot produces both the rate counter subjects and the account digests used by the lockout and its later failure/success transition. A successful admission returns a one-use server-side permit; the caller records an invalid password or clears a verified success before completing the login. The public server package now exposes a bound variant that fixes the key, counter and lockout sources at the application root and replaces a route-supplied IP with the root's trusted address. The shared app supplies a closed default while no minimum-tier root composition exists. The future route still owns canonical account input, password verification, credentials and generic account-existence responses. No route uses this service, and the minimum tier remains unavailable.

Using D1 counters for every login is stronger than an approximate per-location limit and consumes Free-plan writes for every active key version and dimension; after the 2026-09-29 measurement (100,000 D1 writes per day) the declared model keeps them consistent — the write budget accommodates a small instance's attempt volume and dropping them would weaken enforcement below the security baseline — while volumetric shedding stays approximate on the Workers Rate Limiting binding. The D1 lockout compensation is mandatory either way.

## Password credentials on this tier

The accepted exception uses native PBKDF2-HMAC-SHA256 with a fresh 16-byte salt, separate service-side versioned HMAC pepper and strict algorithm/iteration/key record. New records use 50,000 iterations; stored records above 100,000 are refused before key lookup or derivation. Previous stronger records within this ceiling are never reduced. The 2026-09-29 real-plan measurement motivates the initial bounds; B15 revalidates the complete login under concurrency and actual registry/admission overhead.

New registration, bootstrap and recovery passwords require at least 12 Unicode code points, at most 1,024 UTF-8 bytes, and rejection of the bundled common-password denylist. Verification of existing records is not subject to the new-password policy. The denylist is bounded and local; online breach lookup is deferred pending outbound review. This policy is not equivalent to Argon2id or a 600,000-iteration PBKDF2 floor. Online counters, lockout and CAPTCHA cannot offset offline guessing after both database and pepper compromise.

Minimum login runs authoritative account/IP admission over active abuse-key versions, then D1 progressive lockout, then configured required CAPTCHA, before password work. Invalid credentials record failures; verified success clears lockout before session issuance. Initial delay is 500 ms, doubles per two failures, caps/resets at fifteen minutes. Imported rings and per-request snapshots reuse material without caching cross-request lifecycle decisions. The password service admits one concurrent operation per isolate by default. Provider failures deny; no global-memory counter or compute escape hatch is introduced.

Standard roots verify peppered PBKDF2 records once and issue an Argon2id replacement under the credential's expected revision at successful login. Minimum refuses Argon2id records; before downgrading, establish passkeys/recovery codes or administrator-assisted credential reset. Passkeys remain preferred.

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

Support is claimed only when: 03.V6 and 03.V7 pass (tier gate, Free-plan password measurement, disclosed exception, retention measurements — passed 2026-09-30); 04.V6 passes (password, passkey and recovery journeys without email, capability document matching enforcement — passed 2026-10-01 locally and on a real Free-account test deployment); 08.V6, 09.V6 and 10.3g pass (quota-exhaustion behavior, async recovery, quota-aware measurement recorded as its own evidence set); 12.V7 passes (disclosure notice and capability-gated surfaces); and 13.G6 accepts the tier on a real Free account with published reader documentation. The audited activation enables evidence collection on the remaining journey items; it never substitutes for them, and missing access keeps `13.G6` open rather than accepting emulation for plan evidence.
