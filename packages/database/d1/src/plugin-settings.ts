import type { D1Database } from '@cloudflare/workers-types';
import {
  validatePluginSettingRecord,
  type PluginSettingRecord,
  type PluginSettingsStore,
} from '@hyperbug/application';

interface SettingRow {
  id: string;
  plugin_id: string;
  setting_key: string;
  kind: string;
  public_value: string | null;
  secret_record: string | null;
  updated_at: number;
}

function toRecord(row: SettingRow): PluginSettingRecord {
  if (row.kind !== 'public' && row.kind !== 'secret')
    throw new Error('Invalid persisted plugin setting kind');
  const record: PluginSettingRecord =
    row.kind === 'public'
      ? {
          id: row.id,
          pluginId: row.plugin_id,
          key: row.setting_key,
          kind: 'public',
          ...(row.public_value === null
            ? {}
            : { publicValue: row.public_value }),
          updatedAtMs: row.updated_at,
        }
      : {
          id: row.id,
          pluginId: row.plugin_id,
          key: row.setting_key,
          kind: 'secret',
          secretRecord:
            row.secret_record === null
              ? undefined
              : (JSON.parse(row.secret_record) as unknown),
          updatedAtMs: row.updated_at,
        };
  validatePluginSettingRecord(record);
  return record;
}

/** D1 adapter for namespaced plugin settings; secrets stay opaque envelopes. */
export function createD1PluginSettingsStore(
  db: D1Database,
): PluginSettingsStore {
  return {
    async upsert(record) {
      validatePluginSettingRecord(record);
      await db
        .prepare(
          'INSERT INTO plugin_settings (id, plugin_id, setting_key, kind, public_value, secret_record, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (plugin_id, setting_key) DO UPDATE SET kind = excluded.kind, public_value = excluded.public_value, secret_record = excluded.secret_record, updated_at = excluded.updated_at',
        )
        .bind(
          record.id,
          record.pluginId,
          record.key,
          record.kind,
          record.publicValue ?? null,
          record.secretRecord === undefined
            ? null
            : JSON.stringify(record.secretRecord),
          record.updatedAtMs,
        )
        .run();
    },
    async list(pluginId) {
      const rows = await db
        .prepare(
          'SELECT id, plugin_id, setting_key, kind, public_value, secret_record, updated_at FROM plugin_settings WHERE plugin_id = ? ORDER BY setting_key LIMIT 64',
        )
        .bind(pluginId)
        .all<SettingRow>();
      return rows.results.map(toRecord);
    },
    async remove(pluginId, key) {
      const result = await db
        .prepare(
          'DELETE FROM plugin_settings WHERE plugin_id = ? AND setting_key = ?',
        )
        .bind(pluginId, key)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid plugin setting deletion');
      return result.meta.changes === 1;
    },
    async removeAll(pluginId) {
      const result = await db
        .prepare('DELETE FROM plugin_settings WHERE plugin_id = ?')
        .bind(pluginId)
        .run();
      if (!Number.isSafeInteger(result.meta.changes))
        throw new Error('Invalid plugin settings deletion');
      return result.meta.changes;
    },
  };
}
