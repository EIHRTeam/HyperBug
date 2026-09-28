# ADR 0008 — Rate-limit consistency and abuse metadata

Status: Accepted for Phase 03 implementation on 2026-09-25. Owner: [03.3c–03.3d](../plan/modules/03-security-foundation.md). This decision covers non-audit abuse controls only; [audit work remains suspended](../plan/AUDIT-SUSPENSION.md).

## Context

SECURITY §§95–98 require rate limits for login, recovery, registration, writes, search, upload, token creation and webhook configuration, using dimensions beyond a global IP counter. CAPTCHA does not replace these limits. The two first-class profiles require equivalent security semantics. Cloudflare's Workers Rate Limiting binding is location scoped, eventually consistent and designed for approximate protection; a Node process-local map has the same cross-instance limitation. Neither can be the only control for login, recovery or privileged operations.

## Decision

Use two explicit classes of control. Volumetric protection may use the Cloudflare binding or a bounded Node process-local adapter, with its approximate scope disclosed. Sensitive attempts use an authoritative atomic write-and-return counter: a D1 primary `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` or the equivalent PostgreSQL 18 upsert. The key is a versioned, domain-separated HMAC-SHA256 digest of a canonical subject and the route category/dimension. Raw IPs, account names and tokens do not enter the counter table. Rows have a bounded expiry and an indexed, batch-limited purge operation.

Fixed windows are the first counting model. Policy owners must use more than one dimension and may compose short and long windows to bound boundary bursts. A failed store/key/provider check denies the dependent sensitive operation. Increment happens before the protected action; a denied request still consumes its attempt, and an ambiguous write is not retried without an explicit policy. No existing account route is enabled by this decision.

During HMAC-key rotation, the route must consume all active key versions for the same canonical subject, category and dimension. Any limited or unavailable version denies. The previous version remains active for at least the longest configured window so retiring it cannot reset a limit in progress. A bounded shared helper enforces the multi-version decision; provisioning and lifecycle policy remain integration work.

The optional Cloudflare Free minimum tier remains unavailable. Its separate FREE-02 requirements include D1-backed account lockout/progressive delay, configured CAPTCHA and alerts. This counter foundation supplies an authoritative primitive but does not itself satisfy those controls or the independent tier gate.

## Consequences and rejected options

Primary database writes add cost and a hot row per subject/window, so route owners must set measured ceilings and observe quota headroom. The write is one statement; no stale replica read can grant access. Database failure can reduce availability because it denies a sensitive request. Approximate volumetric outages also deny by default in this initial adapter; any later fallback needs its own reviewed policy.

Using only Workers location counters, KV, process memory or a single global IP limit was rejected because multi-location/multi-instance attempts could exceed a security-sensitive limit. Holding raw IP/account values was rejected because the counter needs only a short-lived keyed pseudonym. Automatic unbounded cleanup was rejected; module 09 must schedule bounded expiry calls. The HMAC key must be a dedicated non-extractable secret sourced through each runtime's approved secret mechanism. Strict current/previous key-ring adapters and a per-environment Workers binding are now implemented locally; root provisioning, real account namespace uniqueness and rotation overlap operations remain integration work.

This decision adds no user-facing endpoint, authentication flow or audit implementation. It does not relax SECURITY. Full acceptance still requires route wiring, trusted client-address extraction, key provisioning, multi-instance measurements and provider outage tests.
