import type { PreparedAuditEvent } from './prepared-audit.ts';
import { assertInstant } from '@hyperbug/domain';
import type {
  PluginLifecycleState,
  PluginManifest,
} from '@hyperbug/plugin-api';
import { PLUGIN_LIFECYCLE_STATES } from '@hyperbug/plugin-api';

/**
 * A registry row for one plugin (PLUGIN-SPEC §10.1). The manifest is stored
 * as validated data; the state is the registry's own lifecycle state, never
 * plugin-controlled.
 */
export interface PluginRegistryRecord {
  readonly id: string;
  readonly version: string;
  readonly state: PluginLifecycleState;
  readonly manifest: PluginManifest;
  readonly registeredAtMs: number;
  readonly updatedAtMs: number;
}

export function isPluginLifecycleState(
  value: unknown,
): value is PluginLifecycleState {
  return (
    typeof value === 'string' &&
    (PLUGIN_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

/**
 * A lifecycle transition. The full post-transition row is always written —
 * state-only transitions rewrite the observed manifest, which keeps the
 * update atomic and idempotent instead of partially overwriting columns.
 */
export interface PluginRegistryTransition {
  readonly id: string;
  readonly state: PluginLifecycleState;
  readonly version: string;
  readonly manifest: PluginManifest;
  readonly nowMs: number;
}

/**
 * Persistence port for the plugin registry. All operations are bounded and
 * conditional: a transition never overwrites a row whose stored state the
 * caller did not observe, and `null`/`false` mean "not found", never "applied".
 */
export interface PluginRegistryStore {
  /** Insert a new row; 'conflict' when the id already exists. */
  insert(
    record: PluginRegistryRecord,
    audit: PreparedAuditEvent,
  ): Promise<'inserted' | 'conflict'>;
  load(id: string): Promise<PluginRegistryRecord | null>;
  /** Deterministic, bounded listing ordered by id. */
  list(): Promise<readonly PluginRegistryRecord[]>;
  /**
   * Apply a transition only when the stored state matches `expectedState`
   * (and the stored version matches `expectedVersion` when given), returning
   * the updated record; null when no matching row exists.
   */
  transition(
    input: PluginRegistryTransition & {
      readonly expectedState: PluginLifecycleState;
      readonly expectedVersion?: string;
    },
    audit: PreparedAuditEvent,
  ): Promise<PluginRegistryRecord | null>;
  /** Remove the entry; false when the id was not registered. */
  remove(
    id: string,
    audit: PreparedAuditEvent,
    deleteSettings?: boolean,
  ): Promise<boolean>;
}

export function validatePluginRegistryRecord(
  input: PluginRegistryRecord,
): void {
  if (
    typeof input.id !== 'string' ||
    !/^@[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/.test(input.id)
  )
    throw new Error('Invalid plugin registry id');
  if (typeof input.version !== 'string' || input.version.length === 0)
    throw new Error('Invalid plugin registry version');
  if (!isPluginLifecycleState(input.state))
    throw new Error('Invalid plugin registry state');
  assertInstant(input.registeredAtMs);
  assertInstant(input.updatedAtMs);
  if (input.updatedAtMs < input.registeredAtMs)
    throw new Error('Invalid plugin registry timestamps');
}

/** The registry view the management API returns; the manifest stays opaque JSON. */
export interface PluginRegistryView {
  readonly id: string;
  readonly version: string;
  readonly state: PluginLifecycleState;
  readonly registeredAt: string;
  readonly updatedAt: string;
}

export function pluginRegistryView(
  record: PluginRegistryRecord,
): PluginRegistryView {
  return {
    id: record.id,
    version: record.version,
    state: record.state,
    registeredAt: new Date(record.registeredAtMs).toISOString(),
    updatedAt: new Date(record.updatedAtMs).toISOString(),
  };
}
