# HyperBug plugin specification (PLUGIN-SPEC)

Specification version: **1.3.0** — carried by [`@hyperbug/plugin-api`](../packages/plugin-api/package.json); this document's version follows that package's version, not Core's.

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

## 9. Manifests and compatibility

The manifest is the single declaration a plugin makes about itself. It is data, not code: the runtime reads and validates it before any plugin code participates. `@hyperbug/plugin-api` carries it as a TypeBox schema (`PluginManifestSchema`) so the SDK validates at author time and the runtime validates at registration with identical rules. Manifest validation is additive across this specification's chapters: lifecycle states (05.1c) and hook declarations (05.1d) extend the same object.

### 9.1 Identity and shape

- `id` — scoped identifier `@vendor/name`, lowercase alphanumeric/kebab segments (pattern `^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$`). Official plugins use `@hyperbug/<name>`. The id is immutable for the plugin's lifetime; a different id is a different plugin. It derives the data namespace (§9.7).
- `version` — the plugin's own semver (exact `X.Y.Z`, optional prerelease, no build metadata). Upgrade ordering is defined by the lifecycle chapter (05.1c).
- `trustTier` — `trusted-native` or `isolated-external` (§3).
- Optional `displayName` (≤64 chars) and `description` (≤280 chars) are display metadata only.
- Unknown fields are rejected (`additionalProperties: false`): manifests cannot smuggle undeclared declarations past validation.

### 9.2 Plugin API compatibility

`apiVersion` declares the Plugin API range the plugin requires: an exact version or a caret/tilde range (`^1.1.0`, `~1.1.0`, `1.1.0`). The full semver-range grammar is deliberately out of scope so hosts and authors share one small rule set, implemented once in `apiVersionSatisfies(range, version)`:

- exact: equality including prerelease;
- caret: same major, and when the major is `0` the same minor (and for `0.0.x`, the same patch) — npm semantics;
- tilde: same major.minor;
- a prerelease version satisfies only a range whose base has the same core version and the same prerelease.

The host accepts a plugin only when its own `PLUGIN_API_VERSION` satisfies the manifest's `apiVersion`; otherwise registration fails with a compatibility error (tested by 05.3a). Core's version is irrelevant here (§4): manifests never reference it.

### 9.3 Capabilities and extension points

`capabilities` is a non-empty subset of the fixed vocabulary (PRODUCT §25): `authentication`, `sso`, `captcha`, `notifications`, `issue-actions`, `issue-metadata`, `integrations`, `import`, `export`, `search`, `settings.admin`, `settings.project`, `ui`. Unknown capability ids are rejected (tested by 05.3a). The concrete per-capability contracts — what a plugin may register, what Core guarantees, and which policy boundaries apply — are defined by module 05.2c; the vocabulary here only names the surfaces.

`extensionPoints` lists the bounded points the plugin participates in, each referencing a declared capability as `capability:point-id` (for example `settings.admin:panel`, `issue-actions:menu`). A point whose capability prefix is not declared in `capabilities` fails validation. Core owns the set of existing point ids per capability; a plugin can only choose among them, never define new ones at runtime.

### 9.4 Permissions

`permissions` is a subset of `data:read`, `data:write`, `secrets:read`, `events:publish`, `events:subscribe`, `network:fetch`, `ui:extend` (SECURITY §38 least privilege; no blanket grant exists). For native plugins permissions are review and disclosure metadata — not a sandbox (§3.2); Core grants native plugin code nothing it does not already have as trusted code. For external plugins permissions are the inputs that scope revocable capability APIs (05.1e). Module 05.2c binds each permission to the capability APIs that actually check it; a permission nothing checks is a review finding.

### 9.5 Configuration: public versus secret settings

`settings` declares the plugin's configuration surface. Every setting has a `key` (lowercase kebab, unique within the plugin) and a kind:

- **public** — declares `valueType` (`string` | `number` | `boolean`), may carry a `defaultValue`. Public settings are readable through the plugin configuration read API.
- **secret** — write-only (SECURITY §121). The schema rejects `defaultValue` and `valueType` outright: a secret default would be a plaintext credential in the manifest. Secrets are obtained from the Secret Provider, updated through write-only APIs, and never returned in plaintext by any ordinary read; reads are redacted (implementation: module 05.2b).

### 9.6 CSP origins

`csp` optionally declares frontend origins as four explicit lists — `scriptOrigins`, `frameOrigins`, `connectOrigins`, `imageOrigins` — each an https origin without path or wildcard (≤8 entries). Origins are hints for Core's build-time review and merge (§7, SECURITY §123); a plugin never edits CSP itself, and undeclared origins must not appear in a merged policy. Merge rules and review arrive with module 05.2e.

### 9.7 Namespaced data and migrations

All plugin-owned persistent state lives in a namespace derived from the validated id: `@vendor/name` → `plugin_vendor_name` (`pluginDataNamespace`). The namespace prefixes plugin tables/objects/settings keys and namespaces plugin-published events (05.2d). Rules, following the database-migrations baseline:

- Native plugins needing schema of their own use namespaced, reviewed migrations — additive within their namespace; they must not touch Core tables or another plugin's namespace. Each migration records the plugin id and version it belongs to (the migration model is implemented with module 05.2b; upgrade/retention behavior is tested by 05.3d).
- External plugins never receive Core SQL access (TECH-STACK §44): they reach data through scoped storage under the same namespace.
- Uninstall-time retention or deletion of namespaced data follows the explicit lifecycle policy (05.1c).

## 10. Lifecycle

A plugin's registry entry moves through a small state machine owned by Core (implemented by the registry in module 05.2; the rules live in `@hyperbug/plugin-api` as `PLUGIN_LIFECYCLE_STATES`, `PLUGIN_LIFECYCLE_TRANSITIONS` and the pure decision helpers). All lifecycle administration is sensitive administration: Administrator with recent re-authentication (§5; SECURITY §39).

### 10.1 States

| State | Meaning | Participation |
| --- | --- | --- |
| `registered` | Manifest accepted and recorded; never enabled, or no complete configuration yet | None |
| `enabled` | Configuration complete and the plugin activated | Hooks and extension points active, bounded by §6 |
| `disabled` | Turned off from `enabled`; configuration and data retained | None — in-flight invocations finish or hit their deadline; no new invocations |

### 10.2 Register and compatibility validation

Registration validates the manifest (§9) and requires the host's Plugin API version to satisfy the manifest's `apiVersion` range; a failure rejects registration with the reasons. An id that already exists in the registry is a conflict — registration never overwrites. Registration alone changes no Core behavior: with zero enabled plugins, Core runs exactly as documented (§5).

### 10.3 Configure and enable

- `configure` writes setting values: public values through the configuration API, secret values through write-only secret updates (§9.5; mechanism in module 05.2b). Configuration changes are legal in `registered` and `disabled`.
- `enable` is legal from `registered` and `disabled` and requires complete configuration: every public setting has a value of its declared type or a declared default, every secret setting is present in the secret provider, and unknown keys are rejected. Enable decisions are pure over the supplied facts (`decideEnable`), so the same completeness rule governs configuration validation (05.3a fixtures) and runtime registration.

### 10.4 Disable

`disable` is legal from `enabled`. Disabling is safe by construction: the runtime stops scheduling new invocations, in-flight invocations run to their deadline (§11 bounds them), and no Core policy depends on a disabled plugin — Core policy never delegates to plugins in the first place (§5). Configuration and namespaced data are retained.

### 10.5 Upgrade

- Upgrades apply to `registered` and `disabled` entries only; an enabled plugin must be disabled first. This makes every upgrade an explicit, reviewable operator action.
- An upgrade keeps the plugin id, validates the new manifest, and requires a strictly higher version than the registry records (`compareSemver`); downgrades and re-registrations of the same version are rejected.
- The new manifest's `apiVersion` must satisfy the host. Namespaced migrations follow §9.7; upgrade/data-retention handling is verified by 05.3d.

### 10.6 Uninstall and data policy

`uninstall` is legal from any state. It removes the registry entry and stops all participation. Namespaced data is handled through an **explicit operator choice** between:

- `retain` — namespaced data stays for a future reinstall (a reinstall starts at `registered` with its own compatibility validation);
- `delete` — namespaced data is deleted through a bounded, reviewed procedure scoped strictly to the plugin's namespace (§9.7).

There is no default: the uninstall operation must state its policy. Deletion is irreversible; retention leaves data owned by an absent plugin and must not be readable by a different plugin id (namespace ownership is enforced by the storage interfaces, module 05.2b).

## 11. Hook protocol

Hooks are the only way plugin code runs. Core owns the extension points, their policies and their budgets; plugins implement them. The contract constants and types live in `@hyperbug/plugin-api` (`PLUGIN_HOOK_MODES`, `PLUGIN_HOOK_FAILURE_POLICIES`, the envelope schema and the ceiling constants).

### 11.1 Mode (PERFORMANCE §48)

- `sync` — the hook runs on the request path and the business result immediately depends on it. Sync hooks exist only where Core cannot answer without the plugin: authentication providers, authorization-related providers and required CAPTCHA verification. Every other effect — notifications, webhooks, analytics, external synchronization — uses `async`.
- `async` — the effect is recorded and dispatched durably through the outbox model (module 02); the request path never waits for it. Actual dispatch consumers are completed by module 09 before side-effect consumers are enabled (05.2d connects the envelopes).

### 11.2 Ordering

Within one extension point, sync hooks run one at a time in a stable, deterministic order — registry order, the order in which enabled plugins were registered. There are no numeric priorities in MVP and no parallel invocations of hooks at the same point within one request.

### 11.3 Payload version, limits, deadlines and concurrency (PERFORMANCE §47)

- Every payload carries a `payloadVersion` owned by Core, incremented when a point's payload shape changes; plugins accept the versions they declare. Per-extension-point contracts (05.2c) pin the current version of each payload.
- A serialized sync payload is at most `SYNC_HOOK_PAYLOAD_LIMIT_BYTES` (65,536); the runtime rejects an oversized payload before dispatch. Async envelopes ride the outbox's own bounded records.
- Every sync invocation carries a deadline enforced by the runtime, at most `SYNC_HOOK_DEADLINE_CEILING_MS` (3,000 ms); points may declare tighter budgets. External-plugin calls always have a timeout (PERFORMANCE §49).
- A single plugin holds at most `MAX_CONCURRENT_HOOK_INVOCATIONS` (8) concurrent invocations at one point in one isolate/process; excess invocations are shed before dispatch.
- Wall-clock deadlines bound waiting, not native CPU: in-process native code cannot be securely preempted by a promise timeout. This limitation is documented and verified by 05.3c; the practical control for native plugins is review plus bounded request budgets, not preemption.

### 11.4 Failure semantics (PERFORMANCE §49; the 03.3f re-scope)

Each extension point has an explicit failure policy from `fail-closed` / `fail-request` / `enqueue-retry` / `continue-without-effect`, mapping to the runtime actions deny / fail-request / enqueue-retry / continue.

**Security-critical points are `fail-closed` by Core decision.** A plugin cannot weaken them (`effectiveFailurePolicy` forces `fail-closed` regardless of what a plugin declares). A hook on a security-critical point that fails, times out, is cancelled or is unavailable denies the protected operation — it never silently disables verification. This is the fail-closed plugin-permission rule re-scoped from Phase 03's 03.3f and is verified by 05.2c/05.3 fixtures.

Non-critical points use their declared policy; `continue-without-effect` records the skipped side effect rather than dropping it silently.

### 11.5 Side-effect idempotency

Every hook/event carries an `eventId` (UUID) and an `occurredAt` timestamp in the shared envelope (`PluginHookEnvelope`). Async dispatch is at-least-once; consumers deduplicate on `eventId` and must be idempotent per event. Retries are bounded with the outbox's retry semantics; dead effects are retained as recoverable failures, not silently discarded.

## Chapter status

| Chapter | Content | Defined by |
| --- | --- | --- |
| §1–§8 | Frame: scope, components, trust, versioning, policy, performance, frontend, conformance | 05.1a |
| §9 | Manifests and compatibility: identity, API ranges, capabilities, extension points, permissions, public/secret settings, CSP origins, namespaced data/migrations | 05.1b |
| §10 | Lifecycle: states, register/validate, configure, enable, disable, upgrade, uninstall and explicit retain/delete policy | 05.1c |
| §11 | Hook protocol: mode, ordering, payload version/limits, deadlines, concurrency, failure semantics, idempotency | 05.1d (this version) |
| External service protocol | Scoped/revocable capability APIs, signed/versioned events | 05.1e |
