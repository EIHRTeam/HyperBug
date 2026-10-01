// Author-facing Plugin SDK. Plugin code imports this package — never the host
// runtime — so the contract surface authors see stays independently versioned
// from Core. `definePlugin` is the authoring entry for manifests; hook types
// let hook implementations code against the same envelope the runtime sends.
import {
  validatePluginManifest,
  type PluginManifest,
} from '@hyperbug/plugin-api';

/** Package identity of the Plugin SDK. */
export const PLUGIN_SDK_PACKAGE = '@hyperbug/plugin-sdk' as const;

/** Version of this package, independent of the Plugin API version. */
export const PLUGIN_SDK_VERSION = '1.4.0' as const;

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
  compareSemver,
  pluginDataNamespace,
  validatePluginManifest,
} from '@hyperbug/plugin-api';
export {
  PLUGIN_LIFECYCLE_STATES,
  PLUGIN_LIFECYCLE_TRANSITIONS,
  PLUGIN_UNINSTALL_POLICIES,
  type LifecycleDecision,
  type PluginConfigurationInput,
  type PluginLifecycleOperation,
  type PluginLifecycleState,
  type PluginUninstallPolicy,
  checkConfiguration,
  decideEnable,
  decideRegistration,
} from '@hyperbug/plugin-api';
export {
  MAX_CONCURRENT_HOOK_INVOCATIONS,
  PLUGIN_HOOK_ERROR_KINDS,
  PLUGIN_HOOK_FAILURE_POLICIES,
  PLUGIN_HOOK_MODES,
  SYNC_HOOK_DEADLINE_CEILING_MS,
  SYNC_HOOK_PAYLOAD_LIMIT_BYTES,
  PluginHookEnvelopeSchema,
  type PluginHookEnvelope,
  type PluginHookErrorKind,
  type PluginHookFailureAction,
  type PluginHookFailurePolicy,
  type PluginHookMode,
  effectiveFailurePolicy,
  hookFailureAction,
  isPluginHookEnvelope,
  isWithinSyncPayloadLimit,
} from '@hyperbug/plugin-api';
export {
  EXTERNAL_PLUGIN_CHANNELS,
  PLUGIN_EVENT_SIGNATURE_ALGORITHM,
  PLUGIN_EVENT_SIGNATURE_VERSION,
  SIGNED_EVENT_FRESHNESS_WINDOW_MS,
  CapabilityGrantSchema,
  SignedPluginEventSchema,
  type CapabilityGrant,
  type ExternalPluginChannel,
  type SignedPluginEvent,
  isCapabilityGrant,
  isSignedPluginEvent,
  isWithinSignedEventFreshness,
} from '@hyperbug/plugin-api';
export {
  PLUGIN_HOOK_POINTS,
  type PluginHookPointDefinition,
  type PluginHookPointName,
  pluginHookPoint,
  pluginMayOccupyPoint,
  pointFailurePolicy,
} from '@hyperbug/plugin-api';
