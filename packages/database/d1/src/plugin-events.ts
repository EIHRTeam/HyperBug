import type { D1Database } from '@cloudflare/workers-types';
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
  payload: string;
  created_at: number;
  available_at: number;
  delivered_at: number | null;
}

function toRecord(row: EventRow): PluginEventOutboxRecord {
  const envelope = JSON.parse(row.payload) as unknown;
  if (!isPluginHookEnvelope(envelope))
    throw new Error('Invalid persisted plugin event envelope');
  const record: PluginEventOutboxRecord = {
    envelope: envelope as PluginHookEnvelope,
    createdAtMs: row.created_at,
    availableAtMs: row.available_at,
  };
  validatePluginEventRecord(record);
  return record;
}

/** D1 adapter for the module-05 outbox-model event rows. */
export function createD1PluginEventOutbox(
  db: D1Database,
): PluginEventOutboxStore {
  return {
    async publish(record) {
      validatePluginEventRecord(record);
      await db
        .prepare(
          'INSERT INTO plugin_event_outbox (event_id, plugin_id, point, payload_version, payload, created_at, available_at, attempts, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL) ON CONFLICT (event_id) DO NOTHING',
        )
        .bind(
          record.envelope.eventId,
          record.envelope.pluginId,
          record.envelope.hook,
          record.envelope.payloadVersion,
          JSON.stringify(record.envelope),
          record.createdAtMs,
          record.availableAtMs,
        )
        .run();
    },
    async load(eventId) {
      const row = await db
        .prepare(
          'SELECT payload, created_at, available_at, delivered_at FROM plugin_event_outbox WHERE event_id = ? AND delivered_at IS NULL LIMIT 1',
        )
        .bind(eventId)
        .first<EventRow>();
      return row === null ? null : toRecord(row);
    },
    async pending(limit) {
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
        throw new Error('Invalid plugin event pending bound');
      const rows = await db
        .prepare(
          'SELECT payload, created_at, available_at, delivered_at FROM plugin_event_outbox WHERE delivered_at IS NULL AND available_at <= ? ORDER BY available_at, event_id LIMIT ?',
        )
        .bind(Date.now(), limit)
        .all<EventRow>();
      return rows.results.map(toRecord);
    },
  };
}
