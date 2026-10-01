// Package identity and trust-tier vocabulary (PLUGIN-SPEC §§2–4).

/** Package identity of the Plugin API, as referenced by plugin manifests. */
export const PLUGIN_API_PACKAGE = '@hyperbug/plugin-api' as const;

/**
 * Version of this package. The specification document version follows this
 * value; manifests declare compatibility against it (PLUGIN-SPEC §4).
 */
export const PLUGIN_API_VERSION = '1.6.1' as const;

/**
 * Trust tiers a plugin can occupy (PLUGIN-SPEC §3; SECURITY §117). A
 * trusted-native plugin builds, bundles and executes with Core and is trusted
 * application code — its manifest permissions are not a sandbox. An
 * isolated-external plugin runs outside the process and communicates through
 * scoped capabilities.
 */
export const PLUGIN_TRUST_TIERS = [
  'trusted-native',
  'isolated-external',
] as const;

export type PluginTrustTier = (typeof PLUGIN_TRUST_TIERS)[number];
