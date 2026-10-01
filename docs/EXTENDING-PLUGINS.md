# Extending HyperBug with plugins — author quickstart

This guide gets an extension author from zero to a working plugin using only the public SDK. The full protocol lives in [PLUGIN-SPEC](PLUGIN-SPEC.md); this page is the practical path.

## Read this first: what installing a plugin means

> **Installing a Native Plugin means trusting its code.**

A native plugin builds, bundles and executes together with Core. Its privileges are in practice those of the application itself; the manifest's permissions are review and disclosure metadata, **not a sandbox**. If your extension needs strong isolation, it must run as an isolated external service and talk to Core through the scoped, signed channels of [PLUGIN-SPEC §12](PLUGIN-SPEC.md#12-external-service-protocol) — never by loading code into the process.

Plugins provide *mechanisms*; Core defines *policy*. Your plugin can choose which CAPTCHA provider, which notifier or which identity source backs a capability. It can never decide whether authorization, input validation, sanitization, rate limiting, audit, encryption policy, CORS or secret handling run. Security-critical hooks fail closed: if your verification errors or times out, the protected operation is denied — it is never silently skipped.

## Prerequisites

- Your plugin declares `apiVersion` as a range the host satisfies (`^1.0.0` style); registration rejects an incompatible manifest. Core's version is irrelevant to your manifest.
- Author against `@hyperbug/plugin-sdk` only. Never import the host runtime or server internals.

## The minimal plugin

```ts
import { definePlugin } from '@hyperbug/plugin-sdk';

export const myNotifier = definePlugin({
  id: '@your-org/my-notifier',
  version: '1.0.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['notifications'],
  extensionPoints: ['notifications:deliver'],
  permissions: ['events:publish'],
  settings: [
    { key: 'webhook-url', kind: 'secret' },
    { key: 'min-priority', kind: 'public', valueType: 'string', defaultValue: 'low' },
  ],
  displayName: 'My Notifier',
  description: 'Delivers notifications to my service.',
});
```

`definePlugin` validates the manifest at build time — an invalid plugin fails in your CI, not at registration.

## Lifecycle, from the operator's side

1. **Register** — `POST /api/v1/admin/plugins` with the manifest. A valid, compatible manifest lands as `registered`; it changes no behavior yet.
2. **Configure** — `POST /api/v1/admin/plugins/configure` with public `values` and write-only `secrets`. Secret values are encrypted per deployment and never readable back — reads (`POST /api/v1/admin/plugins/configuration`) show `{ secretPresent: true }`.
3. **Enable** — requires complete configuration (every secret present, every undefaulted public value set).
4. **Disable** — safe at any time: no new invocations, configuration and data retained.
5. **Upgrade** — disable first; the new manifest must keep the id and raise the version.
6. **Uninstall** — the operator explicitly chooses `retain` or `delete` for your plugin's namespaced data; there is no default.

## Hooks

Hooks are the only way your code runs. Sync points exist only where Core's result immediately depends on you (CAPTCHA verification, identity assertion, SSO resolution); everything else — notifications included — is delivered as a signed, versioned event envelope through the outbox model, at-least-once, deduplicated by `eventId`. Every sync invocation is bounded: a payload limit, a deadline and a concurrency ceiling, all enforced by the host. See [PLUGIN-SPEC §11](PLUGIN-SPEC.md#11-hook-protocol).

## Publishing

Ship your plugin as source compiled into the deployment (native) or as a service speaking [§12's channels](PLUGIN-SPEC.md#12-external-service-protocol) (external). There is no runtime code-hosting platform, and the frontend integrates plugins at build time only — no remote script URLs, ever.
