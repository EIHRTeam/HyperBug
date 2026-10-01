// Public Plugin API contract surface for HyperBug. Plugin authors compile
// against this package; the specification it carries is docs/PLUGIN-SPEC.md.
// It stays infrastructure-free so one contract serves both production
// profiles, and it is versioned independently of Core and of the SDK/runtime
// packages (PLUGIN-SPEC §4). Its single external dependency is TypeBox, so a
// manifest schema can be both a TypeScript type and a runtime check.

export {
  PLUGIN_API_PACKAGE,
  PLUGIN_API_VERSION,
  PLUGIN_TRUST_TIERS,
  type PluginTrustTier,
} from './identity.ts';
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
} from './manifest.ts';
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
} from './lifecycle.ts';
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
} from './hooks.ts';
