# 05 — Plugin protocol, SDK, registry, and trusted runtime

Phase: MVP backend  
Prerequisites: 04 complete; event/outbox contracts from 02.  
Progress: [Session log and current status](../progress/05-plugin-foundation.md)  
Protocol: [Mandatory execution and handoff rules](../EXECUTION.md)

## Outcome and scope

Make plugin boundaries a real, versioned part of the backend before building feature-specific integrations. Prove them with local conformance fixtures, not production third-party dependencies.

## Ordered checklist

### Step 05.1 — Define the plugin specification

- [ ] **05.1a** Write `docs/PLUGIN-SPEC.md` and create `packages/plugin-api`, `plugin-sdk`, and `plugin-runtime` with separately versioned public contracts.
- [ ] **05.1b** Define manifest ID/version/API compatibility, capabilities, configuration schemas, public versus secret settings, CSP origins, extension points, and namespaced data/migrations.
- [ ] **05.1c** Define lifecycle: register, validate compatibility, configure, enable, disable, upgrade, uninstall, and retain/delete plugin data through an explicit policy.
- [ ] **05.1d** Define hook mode, ordering, payload version/limits, deadlines, concurrency, failure semantics, and side-effect idempotency. Security-critical hooks fail closed; ordinary effects use durable async dispatch.
- [ ] **05.1e** Separate trusted native code from isolated external services in the specification. For external services, define scoped/revocable capability APIs and signed/versioned events; defer an arbitrary code-hosting platform.

### Step 05.2 — Implement Core integration

- [ ] **05.2a** Implement registry/lifecycle validation and authorized, audited plugin-management endpoints.
- [ ] **05.2b** Implement scoped configuration and storage interfaces, secret-provider access, write-only secret updates, redacted reads, and namespace ownership.
- [ ] **05.2c** Define authentication/SSO, CAPTCHA, notifications, issue actions/metadata, search, import/export, and settings extension contracts with their Core policy boundaries.
- [ ] **05.2d** Connect hook/event envelopes to the outbox model; complete actual async dispatch in module 09 before enabling side-effect consumers.
- [ ] **05.2e** Define build-time frontend extension descriptors and reviewed CSP merging. Do not implement remote JavaScript URL loading.
- [ ] **05.2f** Provide one minimal official example plugin and a failing/slow plugin fixture that use only the public SDK/API.

### Step 05.3 — Verify lifecycle and compatibility

- [ ] **05.3a** Test incompatible versions, malformed manifests, unknown capabilities, missing secrets, invalid configuration, and disabled-plugin behavior.
- [ ] **05.3b** Test permissions and object authorization at every plugin-facing API boundary, including cross-project access and unauthorized secret reads.
- [ ] **05.3c** Verify timeout/error behavior and bounded hook invocation. Document that in-process CPU-bound native code cannot be securely preempted by a promise timeout.
- [ ] **05.3d** Test upgrade/data-retention handling, namespaced migrations, configuration audits, and contract compatibility across both runtimes.
- [ ] **05.3e** Publish an English extension-author quickstart stating that installing native code means trusting it.

## Acceptance evidence

A conforming example plugin loads, participates in a bounded extension point, and can be safely disabled on both profiles. Compatibility and negative-permission fixtures pass. Core security remains active with zero plugins installed.

## Source coverage

PRODUCT §§2.4, 25–28; ARCHITECTURE §§34–36; TECH-STACK §44; SECURITY §§117–123; PERFORMANCE §§47–50.

