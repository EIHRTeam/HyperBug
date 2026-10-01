import type { Pool } from 'pg';
import {
  validatePluginEventRecord,
  type PluginEventOutboxRecord,
  type PluginEventOutboxStore,
} from '@hyperbug/application';
import {
  isPluginHookEnvelope,
  type PluginHookEnvelope,
} from '@hyperbug/plugin-api';

interface EventRow {
  payload: unknown;
  created_at: string | number;
  available_at: string | number;
  delivered_at: string | number | null;
}

function toRecord(row: EventRow): PluginEventOutboxRecord {
  if (!isPluginHookEnvelope(row.payload))
    throw new Error('Invalid persisted plugin event envelope');
  const record: PluginEventOutboxRecord = {
    envelope: row.payload as PluginHookEnvelope,
    createdAtMs: Number(row.created_at),
    availableAtMs: Number(row.available_at),
  };
  validatePluginEventRecord(record);
  return record;
}

/** PostgreSQL adapter for the module-05 outbox-model event rows. */
export function createPostgresPluginEventOutbox(
  pool: Pool,
): PluginEventOutboxStore {
  return {
    async publish(record) {
      validatePluginEventRecord(record);
      await pool.query(
        'INSERT INTO plugin_event_outbox (event_id, plugin_id, point, payload_version, payload, created_at, available_at, attempts, delivered_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 0, NULL) ON CONFLICT (event_id) DO NOTHING',
        [
          record.envelope.eventId,
          record.envelope.pluginId,
          record.envelope.hook,
          record.envelope.payloadVersion,
          JSON.stringify(record.envelope),
          record.createdAtMs,
          record.availableAtMs,
        ],
      );
    },
    async load(eventId) {
      const result = await pool.query<EventRow>(
        'SELECT payload, created_at, available_at, delivered_at FROM plugin_event_outbox WHERE event_id = $1 AND delivered_at IS NULL LIMIT 1',
        [eventId],
      );
      const row = result.rows[0];
      return row === undefined ? null : toRecord(row);
    },
    async pending(limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new Error('Invalid plugin event pending bound');
      const result = await pool.query<EventRow>(
        'SELECT payload, created_at, available_at, delivered_at FROM plugin_event_outbox WHERE delivered_at IS NULL AND available_at <= $1 ORDER BY available_at, event_id LIMIT $2',
        [Date.now(), limit],
      );
      return result.rows.map(toRecord);
    },
  };
}
