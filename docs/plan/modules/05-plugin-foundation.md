# 05 — Plugin protocol, SDK, registry, and trusted runtime

Phase: MVP backend  
Prerequisites: 04 complete; event/outbox contracts from 02.  
Progress: [Session log and current status](../progress/05-plugin-foundation.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Make plugin boundaries a real, versioned part of the backend before building feature-specific integrations. Prove them with local conformance fixtures, not production third-party dependencies.

**Deferred Phase 03 scope owned here (2026-09-30 re-scope):** 03.3f's fail-closed plugin-permission failure handling is implemented with 05.2c when this module's runtime resumes; a plugin-permission check that fails, times out or is unavailable must deny without silently disabling verification.

**Execution override (2026-09-21, module-05 audit portions lifted 2026-10-01): [Audit suspension](../AUDIT-SUSPENSION.md). The module's own audit portions (05.2a audited endpoints, 05.3d configuration audits) were resumed and closed by explicit user instruction on 2026-10-01; later modules' audit portions remain suspended under the register.**

## Ordered checklist

### Step 05.1 — Define the plugin specification

- [x] **05.1a** Write `docs/PLUGIN-SPEC.md` and create `packages/plugin-api`, `plugin-sdk`, and `plugin-runtime` with separately versioned public contracts.
- [x] **05.1b** Define manifest ID/version/API compatibility, capabilities, configuration schemas, public versus secret settings, CSP origins, extension points, and namespaced data/migrations.
- [x] **05.1c** Define lifecycle: register, validate compatibility, configure, enable, disable, upgrade, uninstall, and retain/delete plugin data through an explicit policy.
- [x] **05.1d** Define hook mode, ordering, payload version/limits, deadlines, concurrency, failure semantics, and side-effect idempotency. Security-critical hooks fail closed; ordinary effects use durable async dispatch.
- [x] **05.1e** Separate trusted native code from isolated external services in the specification. For external services, define scoped/revocable capability APIs and signed/versioned events; defer an arbitrary code-hosting platform.

### Step 05.2 — Implement Core integration

- [x] **05.2a** Implement registry/lifecycle validation and authorized, audited plugin-management endpoints. (The audit portion was resumed by user instruction on 2026-10-01 and closed with the audited registry trail; see the [suspension register](../AUDIT-SUSPENSION.md).)
- [x] **05.2b** Implement scoped configuration and storage interfaces, secret-provider access, write-only secret updates, redacted reads, and namespace ownership.
- [x] **05.2c** Define authentication/SSO, CAPTCHA, notifications, issue actions/metadata, search, import/export, and settings extension contracts with their Core policy boundaries, including the fail-closed plugin-permission failure handling re-scoped from 03.3f (2026-09-30).
- [x] **05.2d** Connect hook/event envelopes to the outbox model; complete actual async dispatch in module 09 before enabling side-effect consumers.
- [x] **05.2e** Define build-time frontend extension descriptors and reviewed CSP merging. Do not implement remote JavaScript URL loading.
- [x] **05.2f** Provide one minimal official example plugin and a failing/slow plugin fixture that use only the public SDK/API.

### Step 05.3 — Verify lifecycle and compatibility

- [x] **05.3a** Test incompatible versions, malformed manifests, unknown capabilities, missing secrets, invalid configuration, and disabled-plugin behavior.
- [x] **05.3b** Test permissions and object authorization at every plugin-facing API boundary, including cross-project access and unauthorized secret reads.
- [x] **05.3c** Verify timeout/error behavior and bounded hook invocation. Document that in-process CPU-bound native code cannot be securely preempted by a promise timeout.
- [x] **05.3d** Test upgrade/data-retention handling, namespaced migrations, configuration audits, and contract compatibility across both runtimes. (The configuration-audit portion was resumed by user instruction on 2026-10-01; see the [suspension register](../AUDIT-SUSPENSION.md).)
- [x] **05.3e** Publish an English extension-author quickstart stating that installing native code means trusting it.

## Acceptance evidence

A conforming example plugin loads, participates in a bounded extension point, and can be safely disabled on both profiles. Compatibility and negative-permission fixtures pass. Core security remains active with zero plugins installed.

## Source coverage

PRODUCT §§2.4, 25–28; ARCHITECTURE §§34–36; TECH-STACK §44; SECURITY §§117–123; PERFORMANCE §§47–50.

### B4 remediation addendum (2026-10-05)

The original post-commit audit limitation above is superseded for principal suspend/activate, project-role grant/revoke, bootstrap enrollment, recovery-code replacement and plugin registry/configuration mutations: mutation and prepared audit event now share a transaction, with both-store rollback and zero-change denial evidence. Recovery-code generation requires recent authentication, and passkey login forwards configured CAPTCHA before WebAuthn verification. Standalone session revocation/link/redeem events retain their original path; later-module audit remains suspended. See the [remediation record](../evidence/2026-10-05-review-remediation.md). No gate closes here.
