# HyperBug plugin specification (PLUGIN-SPEC)

Specification version: **1.0.0** — carried by [`@hyperbug/plugin-api`](../packages/plugin-api/package.json); this document's version follows that package's version, not Core's.

Status: MVP backend development ([module 05](plan/modules/05-plugin-foundation.md)). This frame is defined by checklist 05.1a; the manifest, lifecycle, hook and external-service chapters land with 05.1b–05.1e and Core integration with 05.2.

Normative sources: PRODUCT §§2.4, 25–28; ARCHITECTURE §§34–36; TECH-STACK §44; SECURITY §§3, 38–39, 46–48, 117–123; PERFORMANCE §§47–50 (see [SOURCES](plan/SOURCES.md)). Where this specification and a source disagree, the source baseline wins and the deviation needs an ADR.

## 1. Purpose and scope

Plugins are a first-class extension protocol, not a late hook collection: Core's data model, event model, API and permission boundaries consider them from the start (PRODUCT §2.4). Official extensions use the public Plugin API wherever possible.

This specification defines the plugin protocol for both first-class backend profiles (Cloudflare Workers/D1/R2 and Node/PostgreSQL/S3-compatible). The plugin protocol must never require Cloudflare-specific capabilities (TECH-STACK §7).

Out of scope: an arbitrary untrusted-code hosting platform. The MVP defines trusted native plugins and the protocol boundary for isolated external services; hosting untrusted runtime code is deferred (§3.4, module 16).

## 2. Components

The plugin system consists of (ARCHITECTURE §34):

| Component | Role | MVP owner |
| --- | --- | --- |
| Plugin API | The public, independently versioned contract plugins compile against | Package `@hyperbug/plugin-api` (05.1a) |
| Plugin SDK | Author-facing surface: re-exports the contract plus authoring helpers | Package `@hyperbug/plugin-sdk` (05.1a; helpers with 05.1b+) |
| Plugin Runtime | Host-side loading, validation and orchestration | Package `@hyperbug/plugin-runtime` (05.1a; machinery with 05.2) |
| Plugin Registry | Persisted registry of installed plugins and their state | Core persistence, module 05.2 |
| Extension Points | Bounded, named points Core opens for plugin participation | Defined per contract, module 05.2c |

The Plugin API package is infrastructure-free: it imports nothing outside itself, so one contract serves both profiles and a plugin author needs no runtime knowledge. The SDK adds no host dependencies. The runtime is imported only by Core, never by plugin code.

## 3. Trust model

### 3.1 Trust tiers (SECURITY §117)

A plugin occupies exactly one tier:

- `trusted-native` — builds, bundles and executes together with Core.
- `isolated-external` — runs outside the Core process and communicates through scoped capabilities.

### 3.2 Trusted native plugins are trusted application code (SECURITY §118)

A native plugin's security privileges are in practice equivalent to application code. **Manifest permissions are not a sandbox.** Permissions are declarative metadata that drive review, least-privilege capability wiring (SECURITY §38) and user-facing disclosure — never an enforcement boundary for native code. Documentation for extension authors must state plainly:

> Installing a Native Plugin means trusting its code.

### 3.3 Isolated external plugins (SECURITY §119; TECH-STACK §44)

Third-party code needing strong isolation runs in a separate Worker, service or external runtime and communicates through scoped tokens, signed webhooks or service bindings. External plugins MUST NOT receive arbitrary Core SQL access; they reach data through the Plugin API, Domain APIs and scoped storage. Their capability APIs are scoped and revocable, and events delivered to them are signed and versioned (chapter defined by 05.1e).

### 3.4 Deferred: untrusted code hosting

An arbitrary code-hosting platform (running untrusted plugin code inside Core's process boundary) is explicitly deferred and is not part of MVP. Nothing in this specification may be read as sandboxing native plugins.

## 4. Versioning and compatibility (PRODUCT §25)

- The Plugin API is versioned independently of Core. Core's version and the Plugin API version are not bound one-to-one.
- `@hyperbug/plugin-api`, `@hyperbug/plugin-sdk` and `@hyperbug/plugin-runtime` carry independent semver versions in their own manifests. A plugin written against one Plugin API version must state its compatibility; manifests declare the required Plugin API version, and the runtime accepts or rejects against it (compatibility rules: chapter defined by 05.1b).
- This document's version equals the `@hyperbug/plugin-api` package version. A specification change that alters the public contract is a package version change.

## 5. Core policy boundaries (PRODUCT §26; SECURITY §3)

> Core defines policy; plugins provide mechanisms.

A plugin may choose *which mechanism* implements a capability — for example which CAPTCHA provider, which SSO provider, which notification provider, which KMS. A plugin must never decide *whether* a Core policy executes. Core always enforces, and plugins cannot weaken or disable:

- Authentication and authorization decisions
- Input validation and output sanitization
- The minimum encryption policy
- Rate limiting and abuse controls
- Audit
- CORS policy
- Secret handling

Core security remains fully active with zero plugins installed; the acceptance fixture proves this (§8). Plugin administration (installation, configuration) is sensitive administration requiring Administrator and SHOULD require recent re-authentication (SECURITY §39).

## 6. Performance and failure baseline (PERFORMANCE §§47–50)

Plugins must not extend Core's synchronous request path without bounds. Every hook declares its execution mode, timeout, payload limit, failure policy and concurrency (chapter defined by 05.1d). In outline:

- Synchronous hooks exist only where a business result immediately depends on the plugin (for example an authentication provider or required CAPTCHA verification). Notifications, webhooks, analytics and external synchronization use durable asynchronous dispatch.
- Every external plugin call has a timeout; Core never waits indefinitely. Per hook type the failure semantics are explicit: fail closed, fail the request, enqueue for retry, or continue without the non-critical side effect. Security-critical verification (including plugin-permission checks re-scoped from 03.3f) fails closed: a check that fails, times out or is unavailable denies — it never silently disables verification.
- Non-critical external integrations support timeout, retry budget and circuit breaking so provider failures cannot pile up requests or exhaust resources.

## 7. Frontend constraints (ARCHITECTURE §36; SECURITY §§120, 123)

The frontend is a static application. Native frontend plugins integrate at build time; plugins do not inject code through remote URLs, dynamic imports or `eval`. If a frontend plugin needs CSP extension, its manifest declares script, frame, connect and image origins, and Core's build process reviews and merges them — a plugin never overrides the whole CSP. (Descriptors and merge rules: module 05.2e.)

## 8. Conformance

A conforming plugin: uses only the public SDK/API surface; carries a valid manifest; participates only in declared extension points; and keeps working when disabled. Module 05 delivers one minimal official example plugin and a failing/slow fixture using only the public SDK/API (05.2f), compatibility and negative-permission fixtures (05.3), and an English extension-author quickstart (05.3e). Local conformance fixtures are the MVP evidence — not production third-party dependencies.

## Chapter status

| Chapter | Content | Defined by |
| --- | --- | --- |
| §1–§8 | Frame: scope, components, trust, versioning, policy, performance, frontend, conformance | 05.1a (this version) |
| Manifests and compatibility | Manifest ID/version/API compatibility, capabilities, configuration schemas, public vs secret settings, CSP origins, extension points, namespaced data/migrations | 05.1b |
| Lifecycle | Register, validate, configure, enable, disable, upgrade, uninstall, data retention | 05.1c |
| Hook protocol | Hook mode, ordering, payload version/limits, deadlines, concurrency, failure semantics, idempotency | 05.1d |
| External service protocol | Scoped/revocable capability APIs, signed/versioned events | 05.1e |
