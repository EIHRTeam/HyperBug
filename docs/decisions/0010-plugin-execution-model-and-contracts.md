# ADR 0010 — Trusted plugin execution model and separately versioned contracts

Status: Accepted 2026-10-01 with checklist 05.1a. Owners: [05.1a–05.1e](../plan/modules/05-plugin-foundation.md); specification: [PLUGIN-SPEC](../PLUGIN-SPEC.md).

## Context

Module 05 makes plugin boundaries a real, versioned part of the backend before feature-specific integrations. The initial sources fix the constraints: native plugins build, bundle and execute with Core, so their security privileges are equivalent to application code and manifest permissions are not a sandbox (SECURITY §118); code needing strong isolation runs as a separate service communicating through scoped capabilities (SECURITY §119, TECH-STACK §44); the Plugin API is versioned independently of Core and the two are not bound one-to-one (PRODUCT §25); ARCHITECTURE §34 splits the system into Plugin API, SDK, Runtime, Registry and Extension Points with the protocol owned by `PLUGIN-SPEC.md`. Embedding a public contract and an execution model is an irreversible direction that SECURITY §155 routes through an ADR.

## Decision

1. **Execution model.** The MVP ships exactly two plugin tiers: `trusted-native` (trusted application code, no sandbox, permissions are review and least-privilege metadata) and `isolated-external` (separate Worker/service/runtime reached through scoped, revocable capabilities and signed versioned events; no arbitrary Core SQL access). Arbitrary untrusted-code hosting is deferred; nothing may present manifest permissions as a sandbox for native code. Documentation must state that installing a native plugin means trusting its code.
2. **Contract packaging.** The Plugin API, SDK and runtime are workspace packages `@hyperbug/plugin-api`, `@hyperbug/plugin-sdk` and `@hyperbug/plugin-runtime`, each carrying an independent semver version starting at 1.0.0. `PLUGIN-SPEC.md`'s version follows `@hyperbug/plugin-api`. The API package is a dependency leaf (no external dependencies), so one contract serves both production profiles; the SDK re-exports it for authors; the runtime is host-only.
3. **Policy invariants.** Core defines policy and plugins provide mechanisms; plugins can never decide whether authorization, validation, sanitization, rate limiting, audit, encryption policy, CORS or secret handling execute, and Core security stays active with zero plugins installed. Security-critical hook results (including the 03.3f re-scoped plugin-permission checks) fail closed.

## Consequences

05.1b–05.1e define manifest compatibility, lifecycle, hook semantics and the external service protocol inside this model; 05.2 implements registry, storage, secrets and extension contracts on top. Because the three packages are separately versioned, a contract change is a plugin-api version bump, an SDK change an sdk bump, and host behavior a runtime bump — manifests reference the plugin-api version, never Core's. Deferring untrusted code hosting means MVP third-party plugins that need isolation run as external services under 05.1e's protocol, and any future in-process sandbox would be a new ADR. The boundary checker and oxlint keep the API/SDK dependency leaves enforced so the contract cannot silently gain infrastructure dependencies.
