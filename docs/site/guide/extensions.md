# Build and manage extensions

[Documentation home](../index.md) · [Public API](api.md) · [Security](security.md)

Native plugins are trusted application code, with the process’s effective privileges. Manifest permissions describe reviewed intent; they are not a sandbox. Plugins provide mechanisms and cannot weaken Core authorization, validation, rate limits, required audit, encryption, sanitization or CORS. Arbitrary untrusted-code hosting is deferred.

## Author against the public SDK

Use workspace `@hyperbug/plugin-sdk`, whose version is independent of Core and the Plugin API. It exports `definePlugin`, manifest/settings schemas, lifecycle decisions, hook envelopes, signed-event/capability contracts and CSP descriptors. The package is not published to a registry. Do not import host runtime/server internals into a plugin.

The actual [minimal example](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/tests/fixtures/plugins/example-notifier.ts) defines `@hyperbug/example-notifier`, version `1.0.0`, trust tier `trusted-native`, API range `^1.0.0`, `notifications:deliver` and `events:publish`. `definePlugin` rejects an invalid manifest at author/build time. This test example echoes an accepted envelope; it is not an installed email notifier or delivered-message claim.

Use the [author quickstart](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/EXTENDING-PLUGINS.md) and [versioned specification](https://github.com/EIHRTeam/HyperBug/blob/feat/v1/docs/PLUGIN-SPEC.md) for exact fields and accepted protocol limits. The repository’s plugin unit/contracts and both-runtime persistence/hook suites verify lifecycle, permissions, settings, envelopes and failures.

## Configure and manage

An instance administrator needs current permission and a recent verified passkey ceremony. Register a compatible manifest first; registration alone runs no plugin code. Configure public values and write-only secrets, then enable only when required configuration is complete. Reads report secret presence, never its value; the management UI clears submitted secrets. Review native code/build provenance before integrating it into the backend.

Disable before upgrading; preserve the ID and raise the version. Disable retains settings/data and prevents new invocations. Uninstall requires an explicit retain/delete policy for namespaced plugin data. Review retained jobs, secrets and backups; do not assume uninstall erases external effects or Core history.

## Handle work and UI safely

Sync security hooks have bounded payloads, deadlines and concurrency and fail closed. Deferred reference-only events use the outbox with at-least-once delivery, current registry/permission checks and stable delivery identities. Supply downstream idempotency; a crash after an external effect may duplicate it if the provider lacks an idempotent API. Replay requires trusted authorized operator integration, not arbitrary queue mutation.

External services use scoped signed contracts with freshness/replay checks; they never receive arbitrary Core SQL. UI plugins are reviewed build-time descriptors with exact declared CSP origins. Public runtime config cannot load code or scripts. No remote script URL is a runtime installation mechanism.

SMTP/email, SSO providers, source-control connectors and other named integrations remain module 16 work. Do not advertise them as installed because the manifest vocabulary or example exists. Core account recovery remains available through its implemented passkey/recovery-code paths without requiring a mail plugin.
