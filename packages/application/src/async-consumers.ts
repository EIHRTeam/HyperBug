import {
  isPluginHookEnvelope,
  pluginHookPoint,
  pluginMayOccupyPoint,
  validatePluginManifest,
  type PluginHookEnvelope,
} from '@hyperbug/plugin-api';
import { AsyncError, type AsyncEvent } from './async-processing.ts';
import {
  handleSearchOutboxEvent,
  type SearchIndexStore,
} from './search-index.ts';
import { SearchError } from './search.ts';
import type { PluginRegistryStore } from './plugin-registry.ts';
import type {
  PluginSettingsStore,
  PluginSettingRecord,
} from './plugin-settings.ts';

/** Host-compiled bindings only. No stored module paths, eval or user code loading. */
export interface AsyncPluginBinding {
  id: string;
  version: string;
  /** Validate a bounded reference-only payload; content/secrets are loaded after authorization. */
  validateReferences(envelope: PluginHookEnvelope): boolean;
  /** Core host gate: reload relevant principal/resource permissions for this delayed action. */
  authorize(
    envelope: PluginHookEnvelope,
    signal: AbortSignal,
  ): Promise<boolean>;
  run(
    envelope: PluginHookEnvelope,
    context: {
      signal: AbortSignal;
      idempotencyKey: string;
      settings: readonly PluginSettingRecord[];
    },
  ): Promise<void>;
}
export function createAsyncEventHandler(input: {
  search: SearchIndexStore;
  registry: PluginRegistryStore;
  settings: PluginSettingsStore;
  bindings?: readonly AsyncPluginBinding[];
  tier?: 'standard' | 'cloudflare-minimum';
}) {
  const bindings = input.bindings ?? [];
  if (
    bindings.length > 10 ||
    new Set(bindings.map((b) => b.id)).size !== bindings.length
  )
    throw new AsyncError('invalid');
  return async (event: AsyncEvent, signal: AbortSignal): Promise<void> => {
    signal.throwIfAborted();
    if (event.eventVersion !== 1) throw new AsyncError('unsupported');
    if (event.reference.source === 'core') {
      // Comments do not contribute to this MVP search projection. Their canonical writes stay intact.
      if (/^comment\.(create|edit|moderated|deleted)$/.test(event.eventType))
        return;
      try {
        await handleSearchOutboxEvent(
          input.search,
          {
            projectId: event.projectId!,
            aggregateId: event.aggregateId!,
            eventType: event.eventType,
            payload: event.payload as { issueId: string; mutationId: string },
          },
          input.tier ?? 'standard',
          signal,
        );
      } catch (error) {
        if (error instanceof SearchError && error.code === 'SEARCH_VALUE')
          throw new AsyncError('invalid');
        throw error;
      }
      return;
    }
    if (!isPluginHookEnvelope(event.payload)) throw new AsyncError('invalid');
    const envelope = event.payload as PluginHookEnvelope;
    const point = pluginHookPoint(envelope.hook);
    if (
      envelope.eventId !== event.reference.eventId ||
      envelope.hook !== event.eventType ||
      !point ||
      point.mode !== 'async' ||
      point.securityCritical
    )
      throw new AsyncError('invalid');
    if (envelope.payloadVersion !== point.payloadVersion)
      throw new AsyncError('unsupported');
    const registry = await input.registry.load(envelope.pluginId);
    // Disabled/deleted plugins participate in nothing; acknowledge this intentional cancellation.
    if (!registry || registry.state !== 'enabled') return;
    const manifest = validatePluginManifest(registry.manifest);
    if (
      !manifest.ok ||
      registry.manifest.trustTier !== 'trusted-native' ||
      !registry.manifest.extensionPoints.includes(envelope.hook) ||
      !pluginMayOccupyPoint({
        point: envelope.hook,
        declaredCapabilities: registry.manifest.capabilities,
        trustTier: registry.manifest.trustTier,
      }).ok
    )
      throw new AsyncError('permanent');
    const binding = bindings.find((b) => b.id === envelope.pluginId);
    if (!binding) throw new AsyncError('transient');
    if (binding.version !== registry.version)
      throw new AsyncError('unsupported');
    if (!binding.validateReferences(envelope)) throw new AsyncError('invalid');
    const settings = await input.settings.list(envelope.pluginId);
    signal.throwIfAborted();
    if (!(await binding.authorize(envelope, signal)))
      throw new AsyncError('permanent');
    signal.throwIfAborted();
    await binding.run(envelope, {
      signal,
      idempotencyKey: event.reference.deliveryId,
      settings,
    });
  };
}
