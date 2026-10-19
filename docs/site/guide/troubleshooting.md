# Troubleshoot and get help

[Documentation home](../index.md) · [Accounts](accounts.md) · [Operations](operations.md)

Use the displayed safe error code and request ID to correlate a failure. Include the candidate/source version, profile, timestamp/timezone and a minimal reproduction. Never send bearer/session tokens, cookies, passwords, key files, secret settings, private content or signed upload/download URLs.

## Sign-in and permission failures

| Symptom | Action |
| --- | --- |
| Reload loses app access | Use Account → Sign in for a fresh top-level authorization flow; app tokens are memory-only |
| Callback expired/state mismatch | Start a new flow; do not reuse the code/verifier or edit redirect parameters |
| Sensitive action needs recent authentication | Use a fresh verified passkey; password-only sign-in does not meet assurance 2 |
| Project/action denied after previously working | Recheck current membership/account status with an authorized administrator; old credentials do not freeze permission |
| No recovery email or SSO | Check instance capabilities; named provider integrations are deferred. Use an enrolled passkey/recovery code or an actually available operator recovery path |
| All last-administrator methods lost | Stop and use the authenticated operator channel; no public bypass/forced password setter exists, and bootstrap re-arm must satisfy current store preconditions |

Do not repeatedly submit denied sensitive actions or send credentials to someone offering to repair a session.

## Submission, content and upload failures

A conflict requires loading the current revision and deliberately reviewing edits. A changed form requires reloading its definition and reviewing answers. An uncertain submission should be retried unchanged so its receipt can reconcile it; a changed payload is a new submission. Drafts can disappear after navigation, reload, expiry, sign-out or access loss.

A syntax/complexity error needs a narrower documented query. `SEARCH_INDEX_INCOMPLETE` means an authorized operator must complete bounded reconciliation; refreshing cannot force a fallback scan. Minimum searches titles only and retires old cursors after a search-mode transition.

Missing upload configuration, empty/disallowed files, quota exhaustion or expired reservations have explained states. Retry an expired reservation with a new upload; do not edit signed URLs/headers. Processing, scanner failure or quarantine must be resolved before release. An isolated download/preview failure does not permit bypassing media authorization or treating an unscanned object as safe.

## Installation and background failures

Invalid config stops startup; compare the exact public policy and complete binding/secret pairs. Readiness503 means a required primary/key/counter/session/tier prerequisite is missing or unavailable. A healthy liveness probe alone does not establish account/write readiness.

Stop a failed migration, inspect committed history/data and use the documented repair/forward-fix or coordinated restore. Do not edit applied migrations, drop history or disable constraints. For delayed work inspect primary oldest-age/failure state, safe async summaries, leases and provider readiness; only use authorized replay. Minimum has one applicable phase every 25 minutes, so five-minute silence can be expected. Missing/ambiguous native CPU attribution or a harness invocation over 10 ms stops hosted evidence collection.

The unresolved hosted instance403 remains a release blocker in backend acceptance. Its producer is not attributed; do not infer an application cause, CPU success or a permission bypass workaround. This release-preparation work does not reopen that pilot.

## Public help and private security reporting

For non-sensitive bugs, use [GitHub Issues](https://github.com/EIHRTeam/HyperBug/issues) with redacted reproduction steps and version/profile information. Check existing reports first. No support response-time or availability commitment is established.

For a suspected vulnerability, use [GitHub private vulnerability reporting](https://github.com/EIHRTeam/HyperBug/security/advisories/new). A read-only repository API check on 2026-10-19 returned `enabled: true`; no report was submitted. Provide impact, affected revision/profile and a minimal safe reproduction privately. Do not open a public Issue containing exploit details or credentials. If that private route becomes unavailable, do not publish the sensitive report; wait for a maintainer-approved private channel. No fabricated email address or disclosure deadline is promised.
