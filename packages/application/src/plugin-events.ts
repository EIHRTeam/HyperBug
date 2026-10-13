import type { PluginHookEnvelope } from '@hyperbug/plugin-api';

/**
 * An outbox-model row for one plugin event (PLUGIN-SPEC §13.3): the §11.5
 * envelope persisted at-least-once. Dispatch, retries and consumers are
 * module 09's; this port only records and reads rows.
 */
export interface PluginEventOutboxRecord {
  readonly envelope: PluginHookEnvelope;
  readonly createdAtMs: number;
  readonly availableAtMs: number;
}

export interface PluginEventOutboxStore {
  /** Persist one event row; the envelope's eventId is the idempotency key. */
  publish(record: PluginEventOutboxRecord): Promise<void>;
  /** Load one row by event id (undelivered or delivered); null when absent. */
  load(eventId: string): Promise<PluginEventOutboxRecord | null>;
  /** Bounded pending listing ordered by availability (module 09's dispatch input). */
  pending(limit: number): Promise<readonly PluginEventOutboxRecord[]>;
}

export function validatePluginEventRecord(
  record: PluginEventOutboxRecord,
): void {
  if (
    typeof record.envelope.pluginId !== 'string' ||
    !/^@[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/.test(
      record.envelope.pluginId,
    )
  )
    throw new Error('Invalid plugin event namespace');
  if (
    typeof record.envelope.hook !== 'string' ||
    record.envelope.hook.length < 3
  )
    throw new Error('Invalid plugin event point');
  if (
    !Number.isSafeInteger(record.createdAtMs) ||
    record.createdAtMs < 0 ||
    !Number.isSafeInteger(record.availableAtMs) ||
    record.availableAtMs < record.createdAtMs
  )
    throw new Error('Invalid plugin event timestamps');
}
