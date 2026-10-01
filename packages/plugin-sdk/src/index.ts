// Author-facing Plugin SDK. Plugin code imports this package — never the host
// runtime — so the contract surface authors see stays independently versioned
// from Core. Authoring helpers (manifest definition, hook typing) arrive with
// the specification chapters of 05.1b+.

/** Package identity of the Plugin SDK. */
export const PLUGIN_SDK_PACKAGE = '@hyperbug/plugin-sdk' as const;

/** Version of this package, independent of the Plugin API version. */
export const PLUGIN_SDK_VERSION = '1.0.0' as const;

export {
  PLUGIN_API_PACKAGE,
  PLUGIN_API_VERSION,
  PLUGIN_TRUST_TIERS,
  type PluginTrustTier,
} from '@hyperbug/plugin-api';
