import { definePlugin } from '@hyperbug/plugin-sdk';

/**
 * The minimal official example plugin (PLUGIN-SPEC §8; 05.2f). It uses only
 * the public SDK: `definePlugin` validates the manifest at author time, and
 * one async notification hook records what it receives. Installing native
 * code means trusting it — this module is compiled into the application.
 */
export const exampleNotifierPlugin = definePlugin({
  id: '@hyperbug/example-notifier',
  version: '1.0.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['notifications'],
  extensionPoints: ['notifications:deliver'],
  permissions: ['events:publish'],
  settings: [],
  displayName: 'Example Notifier',
  description: 'Minimal example plugin for the extension quickstart.',
});

/** The hook module the runtime hosts; the handler is pure test code. */
export const exampleNotifierHooks = {
  'notifications:deliver': (envelope: { payload: unknown }) => ({
    received: true,
    payload: envelope.payload,
  }),
} as const;
