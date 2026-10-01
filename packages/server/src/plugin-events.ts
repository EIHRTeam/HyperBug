import type {
  PluginEventOutboxStore,
  PluginRegistryStore,
} from '@hyperbug/application';
import {
  isPluginHookEnvelope,
  pluginHookPoint,
  pluginMayOccupyPoint,
  type PluginHookEnvelope,
} from '@hyperbug/plugin-api';
import { RequestFailure } from './errors.ts';

/**
 * Publication of async hook events into the outbox model (PLUGIN-SPEC
 * §13.3). The row is written only for a plugin that is enabled, occupies the
 * catalog point, and passes envelope validation; dispatch and side-effect
 * consumers are module 09's and stay out of scope here. This service is the
 * internal trigger surface for business actions (module 06+), not a public
 * endpoint.
 */
export interface PluginEventPublisherDependencies {
  readonly registry: PluginRegistryStore | null;
  readonly events: PluginEventOutboxStore | null;
}

export async function publishPluginEvent(
  dependencies: PluginEventPublisherDependencies,
  input: { pluginId: string; point: string; payload: unknown },
  nowMs: number = Date.now(),
): Promise<{ eventId: string }> {
  if (!dependencies.registry || !dependencies.events)
    throw new RequestFailure('PLUGIN_UNAVAILABLE');
  const record = await dependencies.registry.load(input.pluginId);
  if (!record) throw new RequestFailure('NOT_FOUND');
  // Only an enabled plugin participates; a disabled or merely registered
  // plugin is safely inert (§10.4).
  if (record.state !== 'enabled')
    throw new RequestFailure('PLUGIN_STATE_CONFLICT');
  const definition = pluginHookPoint(input.point);
  if (!definition || definition.mode !== 'async')
    throw new RequestFailure('PLUGIN_INVALID');
  const participation = pluginMayOccupyPoint({
    point: input.point,
    declaredCapabilities: record.manifest.capabilities,
    trustTier: record.manifest.trustTier,
  });
  if (!participation.ok) throw new RequestFailure('PLUGIN_INVALID');
  if (!record.manifest.extensionPoints.includes(input.point))
    throw new RequestFailure('PLUGIN_INVALID');
  const envelope: PluginHookEnvelope = {
    hook: input.point,
    eventId: crypto.randomUUID(),
    payloadVersion: definition.payloadVersion,
    occurredAt: new Date(nowMs).toISOString(),
    pluginId: input.pluginId,
    payload: input.payload,
  };
  if (!isPluginHookEnvelope(envelope))
    throw new RequestFailure('PLUGIN_INVALID');
  await dependencies.events.publish({
    envelope,
    createdAtMs: nowMs,
    availableAtMs: nowMs,
  });
  return { eventId: envelope.eventId };
}
