# ADR 0012: Cloudflare Minimum formal profile

- Date: 2026-10-05
- Status: Accepted by the user for B8; local implementation and real-Free evidence recorded separately
- Supersedes: ADR 0007's third-profile exclusion and 600,000-iteration password floor rule
- Owners: 03, 04, 10, 13

## Decision

Cloudflare Minimum is the third profile alongside Cloudflare Standard and Node/PostgreSQL. G1/G2 require all three; 13.G6 remains additional real-Free budget/recovery evidence. Canonical configuration and contracts report `cloudflare-minimum`. Accept `cloudflare-free-minimum` as a deprecated input alias with a warning, but require the new explicit acknowledgement `minimum-v2`. Refuse the old acknowledgement because the disclosed password risk changed. Historical audit rows retain their original identifiers; new enablement records use a distinct deterministic event ID and the canonical identifier.

Minimum enables public password registration, login and recovery with peppered PBKDF2-HMAC-SHA256: 50,000 iterations for new records and a 100,000 stored-cost ceiling, revalidated in B15. This deliberately departs from SECURITY §§28–32's password baseline and ADR 0007's 600,000 floor. It offers less offline-guessing resistance than Argon2id or the old PBKDF2 floor. Neither CAPTCHA, account lockout nor online rate limits compensates for offline guessing after the database and pepper are compromised. Require new passwords of at least 12 Unicode code points, bounded UTF-8 input and a bundled bounded common-password denylist; recommend passkeys. The pepper stays isolated from stored verifiers, versioned and immediately revocable on new requests. No online breach lookup is introduced without outbound-destination review.

Wire authoritative account/IP rate admission, durable progressive lockout and optional required CAPTCHA before password work; record failures and clear lockout only after verified success. Keep concurrency bounded. Standard profiles verify an existing peppered PBKDF2 record once and replace it with Argon2id after successful login using the expected credential revision. Minimum refuses Argon2id records; downgrade requires passkeys, recovery codes or an administrator-assisted reset. No silent downgrade or key fallback.

Only account/auth/password/write requests await audited activation. Liveness, the instance document and anonymous GETs remain available during activation failure; readiness reports unavailable while activation is pending or fails. The activation still requires pepper preflight and append-only enablement audit. Use a separate Minimum entry sharing composition if dry-run measurements show static Argon2id Wasm shipping in its graph.

All other security invariants remain: object authorization, token ceremony binding, Origin validation, atomic required audit, TLS, CSP/sanitization, keyed credential digests, memory-only browser tokens and fail-closed provider checks. No SPA, queues/workflows expansion or later-module audit is authorized.

## Review and evidence

Primary focused review and both-runtime changed-behavior checks belong to the B8 remediation record. The approved deviation is specific to this acknowledged profile. Local workerd cannot prove Free CPU fit or capacity; real-Free measurements belong to B15 and 13.G6. Cloudflare Standard real deployment evidence remains open on the authorized Free account. Independent Sonnet review is unavailable and is not claimed.
