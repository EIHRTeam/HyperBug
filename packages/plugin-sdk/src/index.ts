// Author-facing Plugin SDK. Plugin code imports this package — never the host
// runtime — so the contract surface authors see stays independently versioned
// from Core. `definePlugin` is the single authoring entry: it validates the
// manifest through the shared Plugin API schema and returns it typed.
import {
  validatePluginManifest,
  type PluginManifest,
} from '@hyperbug/plugin-api';

/** Package identity of the Plugin SDK. */
export const PLUGIN_SDK_PACKAGE = '@hyperbug/plugin-sdk' as const;

/** Version of this package, independent of the Plugin API version. */
export const PLUGIN_SDK_VERSION = '1.1.0' as const;

/**
 * Declare a plugin. Throws with the manifest validation errors when the
 * declaration is invalid, so an invalid plugin fails at author/build time
 * instead of at registration (PLUGIN-SPEC §9).
 */
export function definePlugin(manifest: PluginManifest): PluginManifest {
  const result = validatePluginManifest(manifest);
  if (!result.ok)
    throw new Error(`invalid plugin manifest: ${result.errors.join('; ')}`);
  return manifest;
}

export {
  PLUGIN_API_PACKAGE,
  PLUGIN_API_VERSION,
  PLUGIN_TRUST_TIERS,
  type PluginTrustTier,
} from '@hyperbug/plugin-api';
export {
  API_VERSION_RANGE_PATTERN,
  EXTENSION_POINT_PATTERN,
  HTTPS_ORIGIN_PATTERN,
  PLUGIN_CAPABILITIES,
  PLUGIN_ID_PATTERN,
  PLUGIN_PERMISSIONS,
  PluginCspOriginsSchema,
  PluginManifestSchema,
  PluginSettingSchema,
  PublicPluginSettingSchema,
  SEMVER_PATTERN,
  SecretPluginSettingSchema,
  SETTING_KEY_PATTERN,
  type ManifestValidation,
  type PluginCapability,
  type PluginCspOrigins,
  type PluginManifest,
  type PluginPermission,
  type PluginSetting,
  apiVersionSatisfies,
  pluginDataNamespace,
  validatePluginManifest,
} from '@hyperbug/plugin-api';
