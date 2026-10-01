// Extension-point catalog (PLUGIN-SPEC §13). Core owns this table: it fixes
// which points exist per capability, their execution mode, payload version,
// and whether the point is security-critical — a security-critical point is
// fail-closed by Core decision and a plugin declaration can never weaken it
// (§11.4, the 03.3f re-scope). Plugins choose among these points; they never
// define new ones.
import {
  effectiveFailurePolicy,
  type PluginHookFailurePolicy,
} from './hooks.ts';
import type { PluginCapability } from './manifest.ts';

export type PluginHookPointName =
  | 'captcha:verify-required'
  | 'authentication:assert-identity'
  | 'sso:resolve-principal'
  | 'notifications:deliver'
  | 'issue-actions:menu'
  | 'issue-metadata:validate'
  | 'search:augment-query'
  | 'import:transform-batch'
  | 'export:format-batch'
  | 'settings.admin:panel'
  | 'settings.project:panel'
  | 'ui:build-time-descriptor';

/** One row of the Core-owned extension-point catalog. */
export interface PluginHookPointDefinition {
  readonly point: PluginHookPointName;
  readonly capability: PluginCapability;
  /** §11.1 mode; sync exists only where Core's result immediately depends on the plugin. */
  readonly mode: 'sync' | 'async';
  /** Current payload version for this point (§11.3); Core increments it on shape changes. */
  readonly payloadVersion: number;
  /**
   * Security-critical points force fail-closed (§11.4): a failing, timing-out
   * or unavailable check denies the protected operation — verification is
   * never silently disabled.
   */
  readonly securityCritical: boolean;
}

const point = (
  definition: PluginHookPointDefinition,
): PluginHookPointDefinition => definition;

/**
 * The closed catalog. PERFORMANCE §48 fixes the sync set: authentication
 * assertion, SSO principal resolution and required CAPTCHA verification are
 * the only sync points; everything else dispatches through the outbox
 * (envelopes only until module 09 completes dispatch).
 */
export const PLUGIN_HOOK_POINTS: readonly PluginHookPointDefinition[] = [
  point({
    point: 'captcha:verify-required',
    capability: 'captcha',
    mode: 'sync',
    payloadVersion: 1,
    securityCritical: true,
  }),
  point({
    point: 'authentication:assert-identity',
    capability: 'authentication',
    mode: 'sync',
    payloadVersion: 1,
    securityCritical: true,
  }),
  point({
    point: 'sso:resolve-principal',
    capability: 'sso',
    mode: 'sync',
    payloadVersion: 1,
    securityCritical: true,
  }),
  point({
    point: 'notifications:deliver',
    capability: 'notifications',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'issue-actions:menu',
    capability: 'issue-actions',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'issue-metadata:validate',
    capability: 'issue-metadata',
    mode: 'sync',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'search:augment-query',
    capability: 'search',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'import:transform-batch',
    capability: 'import',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'export:format-batch',
    capability: 'export',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'settings.admin:panel',
    capability: 'settings.admin',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'settings.project:panel',
    capability: 'settings.project',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
  point({
    point: 'ui:build-time-descriptor',
    capability: 'ui',
    mode: 'async',
    payloadVersion: 1,
    securityCritical: false,
  }),
] as const;

const catalog = new Map(PLUGIN_HOOK_POINTS.map((p) => [p.point, p]));

/** Look up a catalog row; unknown points are not extension points. */
export function pluginHookPoint(
  name: string,
): PluginHookPointDefinition | undefined {
  return catalog.get(name as PluginHookPointName);
}

/**
 * The effective failure policy a plugin gets for a point (§11.4): the
 * catalog's security-critical classification wins over any declaration.
 */
export function pointFailurePolicy(
  definition: PluginHookPointDefinition,
  declared: PluginHookFailurePolicy,
): PluginHookFailurePolicy {
  return effectiveFailurePolicy(definition.securityCritical, declared);
}

/**
 * Decide a plugin's participation in a point during registration-time
 * validation: the manifest must declare the point's capability, the point
 * must exist, and trust tiers constrain which points a plugin may occupy.
 * External plugins cannot take in-process sync points — their verification
 * would sit on the request path without process isolation; a separate-service
 * sync protocol is defined with 05.1e's channels when module 16 needs it.
 */
export function pluginMayOccupyPoint(input: {
  readonly point: string;
  readonly declaredCapabilities: readonly string[];
  readonly trustTier: 'trusted-native' | 'isolated-external';
}): { ok: true } | { ok: false; errors: string[] } {
  const definition = pluginHookPoint(input.point);
  const errors: string[] = [];
  if (!definition) {
    return {
      ok: false,
      errors: [`${input.point} is not a Core extension point`],
    };
  }
  if (
    !input.declaredCapabilities.includes(
      definition.capability as PluginCapability,
    )
  )
    errors.push(
      `${input.point} requires capability ${definition.capability} that the manifest does not declare`,
    );
  if (input.trustTier === 'isolated-external' && definition.mode === 'sync')
    errors.push(
      `${input.point} is an in-process sync point and is reserved for trusted-native plugins`,
    );
  return errors.length ? { ok: false, errors } : { ok: true };
}
