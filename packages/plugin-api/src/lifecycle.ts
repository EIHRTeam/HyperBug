// Lifecycle state and decision model (PLUGIN-SPEC §10). The registry this
// model drives is host-side state (module 05.2); the rules themselves live in
// the contract so the SDK's conformance fixtures, the runtime and the
// lifecycle tests share one definition. Every decision is pure — no I/O, no
// clocks; callers supply the observed facts.
import {
  apiVersionSatisfies,
  compareSemver,
  validatePluginManifest,
  type PluginManifest,
} from './manifest.ts';

/** Registry states a plugin entry can occupy (PLUGIN-SPEC §10.1). */
export const PLUGIN_LIFECYCLE_STATES = [
  'registered',
  'enabled',
  'disabled',
] as const;

export type PluginLifecycleState = (typeof PLUGIN_LIFECYCLE_STATES)[number];

/** Operator's explicit choice for namespaced data at uninstall (PLUGIN-SPEC §10.6). */
export const PLUGIN_UNINSTALL_POLICIES = ['retain', 'delete'] as const;

export type PluginUninstallPolicy = (typeof PLUGIN_UNINSTALL_POLICIES)[number];

/** Lifecycle operations and the states they may start from. */
export type PluginLifecycleOperation =
  | 'configure'
  | 'enable'
  | 'disable'
  | 'upgrade'
  | 'uninstall';

export const PLUGIN_LIFECYCLE_TRANSITIONS: Record<
  PluginLifecycleState,
  readonly PluginLifecycleOperation[]
> = {
  registered: ['configure', 'enable', 'upgrade', 'uninstall'],
  enabled: ['disable', 'uninstall'],
  disabled: ['configure', 'enable', 'upgrade', 'uninstall'],
};

/** Configuration facts the enable/configure decisions evaluate. */
export interface PluginConfigurationInput {
  /** Values for public settings; keys outside the manifest are rejected. */
  publicValues: Readonly<Record<string, string | number | boolean>>;
  /** Keys of secret settings whose value is currently present in the secret provider. */
  secretPresent: readonly string[];
}

export type LifecycleDecision = { ok: true } | { ok: false; errors: string[] };

/**
 * Decide a `register` or `upgrade` attempt (PLUGIN-SPEC §§10.2, 10.5): the
 * manifest must validate, the host's Plugin API version must satisfy the
 * declared range, registration must target a new id, and an upgrade must
 * keep the same id with a strictly higher version from a non-enabled state.
 */
export function decideRegistration(input: {
  kind: 'register' | 'upgrade';
  manifest: unknown;
  hostApiVersion: string;
  currentState?: PluginLifecycleState;
  currentId?: string;
  currentVersion?: string;
}): LifecycleDecision {
  const validated = validatePluginManifest(input.manifest);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  const { manifest } = validated;

  const errors: string[] = [];
  if (!apiVersionSatisfies(manifest.apiVersion, input.hostApiVersion))
    errors.push(
      `apiVersion ${manifest.apiVersion} is not satisfied by host ${input.hostApiVersion}`,
    );

  if (input.kind === 'register') {
    if (input.currentId !== undefined)
      errors.push(`plugin ${input.currentId} is already registered`);
  } else {
    if (
      input.currentState === undefined ||
      input.currentId === undefined ||
      input.currentVersion === undefined
    )
      return {
        ok: false,
        errors: ['upgrade requires the current registry entry'],
      };
    if (input.currentState === 'enabled')
      errors.push('upgrade requires the plugin to be disabled first');
    if (input.currentId !== manifest.id)
      errors.push(`upgrade must keep the plugin id (${input.currentId})`);
    if (compareSemver(manifest.version, input.currentVersion) <= 0)
      errors.push(
        `upgrade version ${manifest.version} must be higher than ${input.currentVersion}`,
      );
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

/**
 * Decide `enable` (PLUGIN-SPEC §10.3): legal from registered/disabled, and
 * the configuration must be complete.
 */
export function decideEnable(input: {
  state: PluginLifecycleState;
  manifest: PluginManifest;
  configuration: PluginConfigurationInput;
}): LifecycleDecision {
  if (!PLUGIN_LIFECYCLE_TRANSITIONS[input.state].includes('enable'))
    return { ok: false, errors: [`enable is not legal from ${input.state}`] };
  return checkConfiguration(input.manifest, input.configuration);
}

/**
 * Validate configuration values against the manifest (PLUGIN-SPEC §§9.5,
 * 10.3): unknown keys are rejected, public values must match their declared
 * type, a public setting needs a value or a declared default, and every
 * secret must be present in the secret provider.
 */
export function checkConfiguration(
  manifest: PluginManifest,
  configuration: PluginConfigurationInput,
): LifecycleDecision {
  const errors: string[] = [];
  const publicKeys = new Set(
    manifest.settings.filter((s) => s.kind === 'public').map((s) => s.key),
  );
  const secretKeys = new Set(
    manifest.settings.filter((s) => s.kind === 'secret').map((s) => s.key),
  );

  for (const key of Object.keys(configuration.publicValues)) {
    if (!publicKeys.has(key))
      errors.push(
        `publicValues ${key} is not a public setting of ${manifest.id}`,
      );
  }
  for (const key of configuration.secretPresent) {
    if (!secretKeys.has(key))
      errors.push(
        `secretPresent ${key} is not a secret setting of ${manifest.id}`,
      );
  }
  for (const setting of manifest.settings) {
    if (setting.kind === 'public') {
      const value = configuration.publicValues[setting.key];
      const effective = value ?? setting.defaultValue;
      if (effective === undefined) {
        errors.push(
          `public setting ${setting.key} has no value and no default`,
        );
        continue;
      }
      if (typeof effective !== setting.valueType)
        errors.push(
          `public setting ${setting.key} expects ${setting.valueType}, got ${typeof effective}`,
        );
    } else if (!configuration.secretPresent.includes(setting.key)) {
      errors.push(`secret setting ${setting.key} is not present`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
