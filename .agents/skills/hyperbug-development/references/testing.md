# Testing and acceptance evidence

Read when choosing checks or deciding whether a checklist/gate is complete. Module-specific acceptance cases remain authoritative; use [COVERAGE](../../../../docs/plan/COVERAGE.md) to find integration owners.

## Choose checks from the changed behavior

| Change | Meaningful evidence |
| --- | --- |
| Domain rule/API | Unit and HTTP/contract cases for valid, invalid, forbidden, missing, and conflicting operations; public DTO/OpenAPI compatibility. |
| Persistence | Shared repository suite on D1/workerd and PostgreSQL, fresh/upgrade migrations, rollback/conditional-write behavior, concurrent operations, and stable pagination. |
| Credentials/trust/content | Relevant security regressions: permission loss/BOLA, PKCE/state/replay, expiry/revocation, key rotation/tamper, CORS/CSRF, sanitizer corpus, upload/SSRF boundaries. |
| Queue/workflow/plugin | Duplicate/out-of-order/invalid messages, crash after a side effect, retry/DLQ/lease recovery, timeouts, enable/disable/version mismatch, and bounded fan-out. |
| Blob adapter | Declared PUT/GET/HEAD/DELETE/presign/multipart/abort/metadata/streaming behavior on the actual claimed provider/version. |
| Browser flow | E2E against both profiles, cross-site auth with third-party cookies blocked, keyboard/focus/screen-reader/touch/zoom checks, cache isolation, CSP and relevant failure states. |
| Performance | Representative fixtures with auth/security active; query plans/counts/rows, latency/error rate/CPU/memory where measurable, queue lag, and bundle/CWV regression. |
| Guidance/docs only | Metadata, relative links, reachable references, actual workflow walkthroughs, and checklist/status consistency. Application tests are unnecessary when behavior did not change. |

Run existing relevant checks first. Inspect actual package scripts/tool configuration before invoking a command; do not fabricate a planned script. Add tests for new invariants and meaningful failure modes, not assertions that merely restate implementation.

## Report what the evidence proves

Record the command/check, software versions, fixture, runtime/provider, result, and evidence location. Separate passed, failed, not run, mock, emulator, real local service, and staging results. A mock proves neither live S3 compatibility nor Workers behavior. Source research proves neither installation nor runtime support.

Do not substitute a narrow test for a gate requiring both full deployment profiles. Module 10 opens G1 only after its defined backend matrix; module 13 owns MVP deployment/recovery acceptance. If required access is unavailable, keep the affected gate incomplete and name the missing check.

Benchmark realistic data with bounded authorized loads. Establish regression thresholds from measured baselines; do not invent SLA promises or hide regressions by raising thresholds indefinitely. Security parameters, authorization, and accessibility stay active.

Use [session handoffs](session-handoffs.md) for results, unresolved failures, and next steps.

