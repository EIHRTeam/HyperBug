// Host-side plugin runtime (PLUGIN-SPEC §§2, 11, 13). Core — never plugin
// authors — imports this package. This first machinery is the bounded
// sync-hook executor: registry state and the plugin module are supplied by
// the caller (the server owns persistence), so the runtime stays
// contract-only and infrastructure-free.
import {
  pluginHookPoint,
  pluginMayOccupyPoint,
  pointFailurePolicy,
  validatePluginManifest,
  type PluginHookEnvelope,
  type PluginHookFailureAction,
  type PluginHookPointName,
  type PluginManifest,
} from '@hyperbug/plugin-api';

/** Package identity of the plugin runtime. */
export const PLUGIN_RUNTIME_PACKAGE = '@hyperbug/plugin-runtime' as const;

/** Version of this package, independent of the Plugin API version. */
export const PLUGIN_RUNTIME_VERSION = '1.1.0' as const;

/** A native plugin module authored against the public SDK surface. */
export interface PluginHookModule {
  readonly manifest: PluginManifest;
  readonly hooks: Partial<
    Record<PluginHookPointName, (envelope: PluginHookEnvelope) => unknown>
  >;
}

/** What the caller observed about the plugin's registry state. */
export type PluginRuntimeState =
  | 'registered'
  | 'enabled'
  | 'disabled'
  | 'absent';

export type HookInvocation =
  | { action: 'continue'; result: unknown }
  /** A disabled plugin participates in nothing; the caller decides the mapping. */
  | { action: 'disabled'; error: 'disabled' }
  | {
      action: Exclude<PluginHookFailureAction, 'continue'>;
      error: 'error' | 'timeout' | 'invalid';
    };

/** Validate a module before any invocation: manifest and native trust only. */
export function validatePluginModule(
  module: PluginHookModule,
): { ok: true; manifest: PluginManifest } | { ok: false; errors: string[] } {
  const manifest = validatePluginManifest(module.manifest);
  if (!manifest.ok) return { ok: false, errors: manifest.errors };
  if (manifest.manifest.trustTier !== 'trusted-native')
    return {
      ok: false,
      errors: ['the in-process runtime only hosts trusted-native plugins'],
    };
  for (const point of Object.keys(module.hooks)) {
    const participation = pluginMayOccupyPoint({
      point,
      declaredCapabilities: manifest.manifest.capabilities,
      trustTier: manifest.manifest.trustTier,
    });
    if (!participation.ok) return { ok: false, errors: participation.errors };
    if (!manifest.manifest.extensionPoints.includes(point))
      return {
        ok: false,
        errors: [`module hook ${point} is not declared in the manifest`],
      };
  }
  return { ok: true, manifest: manifest.manifest };
}

/**
 * Invoke one sync hook under §11's bounds: only an enabled plugin runs
 * (§10.4), the handler races the deadline (§11.3), and any error or timeout
 * maps through the effective failure policy — fail-closed on
 * security-critical points (§11.4, the 03.3f re-scope).
 */
export async function invokePluginHook(input: {
  readonly module: PluginHookModule;
  readonly point: PluginHookPointName;
  readonly state: PluginRuntimeState;
  readonly payload: unknown;
  readonly nowMs: number;
  readonly deadlineMs: number;
  readonly timer?: (ms: number) => Promise<never>;
}): Promise<HookInvocation> {
  // A non-enabled plugin participates in nothing, whatever it declares.
  if (input.state !== 'enabled')
    return input.state === 'disabled'
      ? { action: 'disabled', error: 'disabled' }
      : { action: 'fail-request', error: 'invalid' };
  const definition = pluginHookPoint(input.point);
  const validated = validatePluginModule(input.module);
  if (!definition || !validated.ok || definition.mode !== 'sync')
    return { action: 'fail-request', error: 'invalid' };
  const handler = input.module.hooks[input.point];
  if (!handler) return { action: 'fail-request', error: 'invalid' };
  if (
    !Number.isSafeInteger(input.deadlineMs) ||
    input.deadlineMs < 1 ||
    input.deadlineMs > 3000
  )
    return { action: 'fail-request', error: 'invalid' };
  const envelope: PluginHookEnvelope = {
    hook: input.point,
    eventId: crypto.randomUUID(),
    payloadVersion: definition.payloadVersion,
    occurredAt: new Date(input.nowMs).toISOString(),
    pluginId: input.module.manifest.id,
    payload: input.payload,
  };
  const timeout =
    input.timer ??
    ((ms: number) =>
      new Promise<never>((_, reject) => {
        const handle = setTimeout(() => reject(new Error('deadline')), ms);
        if (typeof handle === 'object' && 'unref' in handle) handle.unref();
      }));
  const startedMs = performance.now();
  const timeoutPromise = timeout(input.deadlineMs);
  try {
    // Awaiting races the handler against the deadline. Native CPU-bound code
    // between awaits cannot be preempted (§11.3's documented limitation), so
    // the wall clock is checked afterwards: a result produced past the
    // deadline is not adopted even when the race itself resolved first.
    const result = await Promise.race([
      Promise.resolve(handler(envelope)),
      timeoutPromise,
    ]);
    if (performance.now() - startedMs > input.deadlineMs)
      throw new Error('deadline');
    return { action: 'continue', result };
  } catch {
    // The declared policy is fail-request for undetermined modules; the
    // catalog's security-critical override inside forces fail-closed.
    const policy = pointFailurePolicy(definition, 'fail-request');
    const action =
      policy === 'fail-closed'
        ? ('deny' as const)
        : policy === 'enqueue-retry'
          ? ('enqueue-retry' as const)
          : ('fail-request' as const);
    const error =
      performance.now() - startedMs > input.deadlineMs ? 'timeout' : 'error';
    return { action, error };
  }
}

export { PLUGIN_API_PACKAGE, PLUGIN_API_VERSION } from '@hyperbug/plugin-api';
