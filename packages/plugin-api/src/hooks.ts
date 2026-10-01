// Hook protocol contract (PLUGIN-SPEC §11). Hooks are the only way plugin
// code runs: Core defines the extension points and their policies, plugins
// implement them. These constants and types are the shared boundary between
// the runtime (which enforces them) and plugin authors (who code against
// them); nothing here may be weakened per-point by a plugin.
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

/** Hook execution modes (PLUGIN-SPEC §11.1). */
export const PLUGIN_HOOK_MODES = ['sync', 'async'] as const;
export type PluginHookMode = (typeof PLUGIN_HOOK_MODES)[number];

/**
 * Failure policies (PLUGIN-SPEC §11.4; PERFORMANCE §49). `fail-closed` denies
 * the protected operation; `fail-request` surfaces an error to the caller;
 * `enqueue-retry` defers the effect through the outbox; `continue-without-effect`
 * proceeds while recording the skipped non-critical side effect.
 */
export const PLUGIN_HOOK_FAILURE_POLICIES = [
  'fail-closed',
  'fail-request',
  'enqueue-retry',
  'continue-without-effect',
] as const;
export type PluginHookFailurePolicy =
  (typeof PLUGIN_HOOK_FAILURE_POLICIES)[number];

/**
 * Hard ceiling for a serialized sync-hook payload (PLUGIN-SPEC §11.3).
 * Async effects ride the outbox and its own bounded envelope.
 */
export const SYNC_HOOK_PAYLOAD_LIMIT_BYTES = 65_536;

/**
 * Hard ceiling for a sync-hook deadline (PLUGIN-SPEC §11.3). Points may
 * declare tighter budgets; nothing may exceed this ceiling.
 */
export const SYNC_HOOK_DEADLINE_CEILING_MS = 3_000;

/**
 * Maximum concurrent invocations a single plugin may occupy at one extension
 * point in one isolate/process (PLUGIN-SPEC §11.3). Fan-out beyond this is
 * shed before dispatch.
 */
export const MAX_CONCURRENT_HOOK_INVOCATIONS = 8;

/** Failure origins a hook invocation can report to the runtime. */
export const PLUGIN_HOOK_ERROR_KINDS = [
  'error',
  'timeout',
  'unavailable',
  'cancelled',
] as const;
export type PluginHookErrorKind = (typeof PLUGIN_HOOK_ERROR_KINDS)[number];

/** Action the runtime takes after a hook failure, derived from the policy. */
export type PluginHookFailureAction =
  | 'deny'
  | 'fail-request'
  | 'enqueue-retry'
  | 'continue';

/**
 * The effective failure policy for an extension point (PLUGIN-SPEC §11.4):
 * security-critical points are `fail-closed` by Core decision, and a plugin's
 * declared policy can never weaken them — this is the fail-closed rule
 * re-scoped from Phase 03's 03.3f. A failing, timing-out or unavailable
 * security-critical hook denies; it never silently disables verification.
 */
export function effectiveFailurePolicy(
  pointIsSecurityCritical: boolean,
  declared: PluginHookFailurePolicy,
): PluginHookFailurePolicy {
  return pointIsSecurityCritical ? 'fail-closed' : declared;
}

/** Map a failure policy to the runtime action for any error kind. */
export function hookFailureAction(
  policy: PluginHookFailurePolicy,
  _error: PluginHookErrorKind,
): PluginHookFailureAction {
  switch (policy) {
    case 'fail-closed':
      return 'deny';
    case 'fail-request':
      return 'fail-request';
    case 'enqueue-retry':
      return 'enqueue-retry';
    case 'continue-without-effect':
      return 'continue';
  }
}

/**
 * Hook/event envelope shared by sync delivery and the async outbox path
 * (PLUGIN-SPEC §11.5; outbox connection lands with 05.2d). `eventId` is the
 * idempotency identity: consumers treat repeated ids as duplicates. Formats
 * are expressed as patterns, not `format` annotations: TypeBox's Value
 * validation rejects unregistered formats, and the contract must validate
 * identically in every environment without a format registry.
 */
export const PluginHookEnvelopeSchema = Type.Object(
  {
    hook: Type.String({
      pattern: '^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)?:[a-z0-9][a-z0-9-]*$',
    }),
    eventId: Type.String({
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    }),
    payloadVersion: Type.Integer({ minimum: 1 }),
    occurredAt: Type.String({
      pattern:
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$',
    }),
    pluginId: Type.String({
      pattern: '^@[a-z0-9][a-z0-9-]{0,62}/[a-z0-9][a-z0-9-]{0,62}$',
    }),
    payload: Type.Unknown(),
  },
  { additionalProperties: false },
);
export type PluginHookEnvelope = Static<typeof PluginHookEnvelopeSchema>;

/** Validate a hook/event envelope — used by dispatch paths and conformance fixtures. */
export function isPluginHookEnvelope(input: unknown): boolean {
  return Value.Check(PluginHookEnvelopeSchema, input);
}

/**
 * Serialized byte length of a sync payload against the §11.3 ceiling. The
 * runtime rejects an oversized payload before dispatch; plugins receive the
 * same constant to validate at author time.
 */
export function isWithinSyncPayloadLimit(serializedBytes: number): boolean {
  return (
    Number.isSafeInteger(serializedBytes) &&
    serializedBytes >= 0 &&
    serializedBytes <= SYNC_HOOK_PAYLOAD_LIMIT_BYTES
  );
}
