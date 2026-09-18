# 01 — Backend workspace and runtime foundation

Phase: MVP backend  
Prerequisites: 00 complete.  
Progress: [Session log and current status](../progress/01-backend-foundation.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Create a reproducible workspace and one shared HTTP application running in Workers and Node. Do not scaffold the SPA yet.

## Ordered checklist

### Step 01.1 — Resolve the toolchain and package boundaries

- [x] **01.1a** Verify Node 24 LTS, pnpm 11, TypeScript 7, current stable Elysia, and latest stable Vitest against current official documentation/registries; capture exact resolutions and compatibility evidence.
- [x] **01.1b** If a required version is unavailable or incompatible, record an explicit blocker and proposed ADR. Do not silently downgrade, claim an unavailable release exists, or reopen the framework selection without cause.
- [x] **01.1c** Create the pnpm workspace, Node version file, strict TypeScript configuration, package exports, shared lint/format settings, lifecycle-script policy, and a single committed lockfile.
- [x] **01.1d** Establish `apps/api-cloudflare`, `apps/api-node`, `packages/contracts`, `domain`, `application`, `server`, `security`, `config`, `testing`, and adapter package boundaries as needed. Decide explicit workspace globs for nested adapter packages.
- [x] **01.1e** Add import-boundary checks preventing domain code from depending on infrastructure types and clients from importing server implementation types.

### Step 01.2 — Prove shared Elysia runtime behavior

- [x] **01.2a** Verify the Node adapter package name/export from current official docs; the initial sources and retrieved excerpts use differing names.
- [x] **01.2b** Build one application factory in `packages/server`, with runtime-specific startup and bindings only in the two application entry points.
- [x] **01.2c** Prove Workers ahead-of-time compilation under an explicit compatibility date/flags; test middleware encapsulation and validation. Do not copy old `aot: false` workarounds by default.
- [x] **01.2d** Add liveness and readiness endpoints with safe responses, request IDs, safe error mapping, and bounded request-body handling.
- [x] **01.2e** Add typed runtime configuration, fail-closed security configuration validation, example non-secret configuration, and clear local/staging/production separation.
- [x] **01.2f** Verify streaming, abort/timeout propagation, response creation, and any Node compatibility requirements on the actual target runtimes.

### Step 01.3 — Make development and CI repeatable

- [x] **01.3a** Define and document workspace commands for development, lint, formatting, typecheck, unit tests, contract tests, integration tests, builds, and migrations as they become available.
- [x] **01.3b** Add CI using the frozen lockfile and separate Workers/workerd and Node 24 jobs. Add dependency, secret, and license scanning with actionable failure reporting.
- [x] **01.3c** Provide local PostgreSQL 18.x and an S3-compatible test service for later modules; record exact images and startup/cleanup instructions without committing credentials.
- [x] **01.3d** Define telemetry ports for logs, metrics, traces, and correlation; implement initial runtime adapters with redaction and bounded metric cardinality.
- [x] **01.3e** Consider an allowed-to-fail Elysia next compatibility lane separately from required stable checks.

## Acceptance evidence

[Local validation report](../evidence/01-foundation-validation.md). The local runtime suite passes without expected failures. The workspace and single lockfile are included in the scoped implementation commit; required hosted CI has not run, so the module remains In progress.

A clean checkout installs reproducibly and serves the same validated sample contract on both runtimes. Required CI lanes pass; incompatible runtime APIs are detected. No application implementation depends on the frontend.

## Verification cases

- [x] **01.V1** Compare success, validation failure, missing route, oversized body, internal error, and request ID behavior across runtimes.
- [x] **01.V2** Reject invalid production configuration and verify secrets/stack traces are absent from responses and logs.
- [x] **01.V3** Confirm a deliberately forbidden import fails the boundary check.

## Source coverage

ARCHITECTURE §§2–6, 22–27, 42–48; TECH-STACK §§2–7, 31–40, 45–47, 52–53; SECURITY §§110–132.

