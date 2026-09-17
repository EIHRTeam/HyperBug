# 10 — Backend acceptance and public API client

Phase: MVP backend gate  
Prerequisites: 00–09 complete. This is the mandatory gate before SPA development.  
Progress: [Session log and current status](../progress/10-backend-acceptance.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Produce a tested, documented backend that another client can use before building `apps/web`.

## Ordered checklist

### Step 10.1 — Complete public contracts and client

- [ ] **10.1a** Consolidate OpenAPI from the public schema source and verify every MVP route's request, response, error, pagination, auth, and rate-limit contract.
- [ ] **10.1b** Build `packages/api-client` against public contracts/OpenAPI, without importing Elysia implementation types or `apps/api-*`.
- [ ] **10.1c** Implement configurable API URL, bearer token injection, business-request `credentials: "omit"`, cancellation/timeouts, stable headers, safe errors, and bounded retry behavior.
- [ ] **10.1d** Retry unsafe mutations only with the documented idempotency mechanism; never blindly replay a submitted Issue after an ambiguous network failure.
- [ ] **10.1e** Add schema drift/compatibility checks and publish English API usage examples for a non-browser client.

### Step 10.2 — Execute the backend MVP acceptance matrix

- [ ] **10.2a** Run the full API journey on both profiles: accounts/permissions → project → Issue Form/upload → Issue → search → comment/reaction → triage → close/reopen → timeline.
- [ ] **10.2b** Run fresh/upgrade database migrations, repository conformance, actual R2 and selected S3 compatibility, queue replay, workflow recovery, and plugin lifecycle tests.
- [ ] **10.2c** Run security regression coverage for BOLA, identity confusion, token expiry/revocation, OAuth/PKCE, CORS/CSRF, XSS, unsafe URLs, upload handling, rate limits, and plugin boundaries.
- [ ] **10.2d** Verify separate registrable domains, exact allowlists, third-party-cookie blocking, and no frontend-host proxy dependency with a minimal auth fixture.
- [ ] **10.2e** Record which checks ran in local emulation, real self-host services, and actual Cloudflare staging. Provision only within the authorized environment; missing access remains an explicit gate blocker.

### Step 10.3 — Establish measurable performance and operational readiness

- [ ] **10.3a** Benchmark list/detail/create/comment/search/auth/password-hash/upload-intent paths using representative data and real security checks.
- [ ] **10.3b** Record p50/p95/p99 latency, error rate, query count/plan/rows, runtime CPU/memory where available, queue lag, and object operations for both profiles.
- [ ] **10.3c** Test large valid payloads, abusive search, failed-login bursts, abandoned uploads, retry storms, and slow providers within an authorized test environment.
- [ ] **10.3d** Set initial regression thresholds and measured environment-specific budgets; do not invent SLA/SLO promises from unmeasured assumptions.
- [ ] **10.3e** Verify readiness, structured telemetry/redaction, basic backup/restore, migration failure recovery, and isolated staging configuration.
- [ ] **10.3f** Write a backend acceptance report with exact commands, versions, fixtures, results, unresolved issues, and links to evidence.

## Backend gate checklist

- [ ] **10.G1** Modules 00–09 are complete and their progress logs identify passing evidence.
- [ ] **10.G2** Both production profiles support the whole MVP API path with security and performance controls active.
- [ ] **10.G3** API/client compatibility, storage/migration semantics, async recovery, and plugin boundaries are verified.
- [ ] **10.G4** Blocking findings are resolved; any source-baseline deviation has the required ADR/review and explicit release impact.
- [ ] **10.G5** Update the master progress document to open the SPA gate. Only then begin module 11.

## Source coverage

PRODUCT §29; TECH-STACK §§38–40, 47–51; ARCHITECTURE §§25–27, 44; SECURITY §§151–159; PERFORMANCE §§62–77.

