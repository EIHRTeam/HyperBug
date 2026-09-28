# ADR 0007: Opt-in Cloudflare Free minimum deployment tier

- Date: 2026-09-20
- Status: Accepted direction; configuration/posture foundations implemented, runtime enablement refused, no Free-plan measurement or gate change. Password credentials on this tier stay closed until the evidence listed under Verification passes.
- Owners: 03.1e, 03.2g, 03.3g, 03.3h, 03.V6, 03.V7; 04.1e, 04.2g, 04.V6; 08.2h, 08.V6; 09.1f, 09.2e, 09.3g, 09.V6; 10.2f, 10.3g; 11.1g, 11.V5; 12.3f, 12.V7; 13.1f, 13.1g, 13.2g, 13.3f, 13.G6; 16.1d, 16.2i, 16.3f
- Sources: SECURITY §§28–34, 96–98, 111, 114–116, 129–130, 144–147, 155, 158–160; TECH-STACK §§6–8, 16–17, 47–53; PERFORMANCE §§33–34, 47–53

## Context

The two first-class profiles are Workers + D1 + R2 + Queues + Workflows and Node 24 + PostgreSQL 18.x + S3-compatible storage + Graphile Worker. Neither can be reproduced inside the Workers Free plan envelope, and the documentation facts are dated provider statements, not measured results:

- Workers Free allows 10 ms of CPU per invocation, 100,000 requests per day shared with Durable Object requests and Workflow executions, 50 subrequests per invocation, and 5 Cron Triggers per account. `limits.cpu_ms` is a Standard (paid) usage-model setting.
- D1 Free allows 500 MB per database, 5 GB per account, 5 million rows read and 100,000 rows written per day, 50 queries per Worker invocation, and 7-day Time Travel.
- Queues is available on Free since 2026-02-04 with 10,000 operations per day and a non-configurable 24-hour retention; Workflows Free allows 3,000 steps per day, 10 ms CPU per step, 1,024 steps per instance and 3-day instance-state retention.
- Workers Logpush is paid-only; Workers Logs Free retains 3 days.
- Cloudflare Email Service sending to arbitrary recipients requires Workers Paid; only verified destination addresses can be sent to on Free.
- Durable Object CPU documentation is self-contradictory for the Free plan (the limits table states 30 seconds per invocation without a plan split, the FAQ states Workers plan parity), so a Durable Object cannot currently be relied on as a compute escape hatch.

At the time of this decision, the module 03 password investigation measured the source Argon2id profile (19 MiB, two passes) at roughly 16–27 ms of CPU per hash in a nonproduction Node probe, which was above the Free per-invocation budget before workerd or the Free plan was considered. Its then-current research record kept password release closed pending both-runtime evidence. The subsequent [ADR 0009](0009-standard-password-login.md) approves standard-profile password login after functional account/provider implementation and makes audit/performance characterization non-gating. That decision does not alter this ADR's separate Free-tier PBKDF2 floor or acceptance requirements. The standard profiles keep the SECURITY §§28–34 password baseline unchanged.

The user requested an explicitly opt-in, clearly disclosed minimum solution that keeps account/password login available on the Cloudflare Free plan, accepts reduced security, auditability and functionality for that tier only, allows public production use behind mandatory degradation warnings, and avoids adding any new documentation-language requirement.

## Decision

Add exactly one optional deployment tier, `cloudflare-free-minimum`, as a variant of Profile A rather than a third first-class profile:

- It is enabled only by explicit configuration plus an exact acknowledgement value; absence or mismatch fails startup on both runtimes, and the tier is rejected on the Node runtime. The application never infers the tier from the plan, from quota errors or from the absence of a binding.
- Password login is retained on this tier using PBKDF2-HMAC-SHA256 through platform Web Crypto with a mandatory server-side pepper, a per-user random salt, the highest iteration count that fits the measured Free per-invocation CPU budget with margin, and versioned algorithm/iteration/pepper records. The concrete iteration count is fixed by measurement (03.V7), not assumed here, and is subject to the reviewed floor rule below.
- **No Argon2id path is implemented on this tier.** Argon2id (or the source-approved memory-hard fallback with recorded evidence) remains the mandatory baseline for the standard profiles, including the requirement not to reduce parameters to fit a runtime.
- Durable background work uses a D1 outbox with a bounded Cron-driven dispatcher and a D1 failed-job store instead of relying on free Queues retention or Workflow durability. The required Queues/Workflows/Graphile adapters of the standard profiles are unchanged.
- Email delivery uses a self-implemented SMTP transport (Worker `cloudflare:sockets` and the Node runtime sharing one protocol layer) against an operator-provided relay; Cloudflare Email Service remains an optional adapter and, on Free, is limited to verified destination addresses.
- The tier carries the degradation catalog FREE-01…FREE-08, its compensating controls and its disclosure obligations in [FREE-TIER-PROFILE](../FREE-TIER-PROFILE.md).
- Enabling or changing the tier is an audited operation; readiness reports the tier, the degradation identifiers and the password-hash policy; the running instance carries an operator and end-user degradation notice; reader documentation states the degradations in English and Simplified Chinese through `docs/site/`.
- The tier is accepted by its own checklist (`13.G6`) and is never part of G1 or G2, never counted as MVP acceptance, and never used as evidence for the first-class profiles.

## Deviation record

This decision is recorded rather than silent, as SECURITY §155 requires for security-sensitive direction. For `cloudflare-free-minimum` only:

| Baseline | Minimum-tier behavior | What does not change |
| --- | --- | --- |
| SECURITY §§28–34 password authentication and hash parameters; §160 password baseline | Password hashing is PBKDF2-HMAC-SHA256 with measured parameters instead of Argon2id; the tier never claims or implies Argon2id protection | Standard profiles keep Argon2id or the approved memory-hard fallback; no parameter reduction is authorized outside this tier; pepper, salt, versioned records and rehash-on-login remain mandatory |
| SECURITY §§96–98 rate limiting | Sensitive limits are approximate and per Cloudflare location; no globally consistent counter is available | Endpoint categories and dimensions remain required; login, recovery and privileged operations keep additional compensating controls |
| SECURITY §111 logging, §147 retention | Shorter audit and log retention; no Logpush or OTLP export; 3-day Workers Logs | Audit remains append-only and complete per §§114–116; no audit edit or individual delete path is introduced |
| SECURITY §§144–145 queues and workflows | Reduced durability: D1 outbox, bounded Cron dispatch, D1 failed-job storage, 24-hour message retention not relied upon | Idempotency, reconciliation and authorized replay remain required; the standard adapters and their semantics are unchanged |
| SECURITY §§129–130 configuration and production defaults | A degraded tier exists in production, but only through explicit acknowledgement with a visible warning | Fail-closed validation, no debug mode, exact origins and all other production defaults are unchanged |

Invariants that no tier may relax: object-level authorization and role checks, append-only audit integrity and redaction, Markdown/CSP/sanitization policy, keyed-digest credentials and AES-256-GCM envelope encryption, TLS/HSTS, memory-only browser tokens, bearer-only business APIs, fail-closed authorization (SECURITY §158), and the prohibition on debug or authorization bypasses.

## Consequences

The minimum tier cannot offer the standard tier's password strength, limit consistency, background durability, retention or export. A deployment that downgrades from a standard profile to the minimum tier makes existing Argon2id password records unverifiable within the tier, because a weaker verifier must never be used against a stronger hash; such a deployment must migrate users to passkeys or one-time recovery codes, or reset credentials through administrator-assisted recovery, before the downgrade. Upgrading a minimum-tier deployment to Workers Paid rehashes PBKDF2 records to Argon2id on the next successful login.

The tier documents and measures its own instance ceiling instead of inheriting standard-profile budgets. Provider facts above are dated documentation statements and must be re-verified when the tier is implemented or re-accepted; the Durable Object CPU contradiction stays recorded as an open question rather than a dependency. Module 01, module 02 and the standard-profile acceptance evidence are unaffected, and no gate changes: `13.G6` is independent and remains open until its evidence exists.

## Rejected alternatives

- Running Argon2id inside a Durable Object on the Free plan: the Free-plan Durable Object CPU budget is undocumented and contradicted by the provider's own pages, every login would consume an additional Durable Object request from the shared daily quota, and the complexity is disproportionate to a documented capability variant.
- Splitting or chaining a key derivation across service-binding calls or repeated requests: service-binding CPU is summed across caller and callee, and the approach multiplies request quota consumption and abuse surface.
- Client-side hashing as the only password factor, unsalted or single-round SHA-256/SHA-512/MD5 storage, and plaintext or reversible password storage: rejected outright.
- Declaring or implying Argon2id protection on the minimum tier: rejected; the capability document must report the actual algorithm and its downgraded state.
- Relying on free Queues retention or free Workflow durability for outbox and job semantics: rejected; the 24-hour retention and daily step ceiling cannot carry authorized replay or long jobs.
- Weakening the standard profiles instead of adding an opt-in tier: rejected; the deviation applies only to an explicitly acknowledged tier.

## Verification

Until the following pass, this ADR is accepted direction only and the minimum tier is documentation: 03.V6 (the tier gate cannot be enabled silently, cannot be inferred, and cannot weaken an invariant), 03.V7 (Free-plan PBKDF2 cost measurement, reviewed parameter floor and retention measurements), 04.V6 (password, passkey and recovery journeys without email, with the capability document matching enforcement), 08.V6, 09.V6, 10.3g, 12.V7 (disclosure notice and capability-gated surfaces), and 13.G6 (independent minimum-tier acceptance on a real Free account, otherwise explicitly open). The tier must not be described as supported, secure or released before those items carry evidence.
