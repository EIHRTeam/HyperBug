import type { Pool } from 'pg';
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
  secret_record: unknown;
  updated_at: string | number;
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
          updatedAtMs: Number(row.updated_at),
        }
      : {
          id: row.id,
          pluginId: row.plugin_id,
          key: row.setting_key,
          kind: 'secret',
          secretRecord: row.secret_record ?? undefined,
          updatedAtMs: Number(row.updated_at),
        };
  validatePluginSettingRecord(record);
  return record;
}

/** PostgreSQL adapter for namespaced plugin settings; secrets stay opaque envelopes. */
export function createPostgresPluginSettingsStore(
  pool: Pool,
): PluginSettingsStore {
  return {
    async upsert(record) {
      validatePluginSettingRecord(record);
      await pool.query(
        'INSERT INTO plugin_settings (id, plugin_id, setting_key, kind, public_value, secret_record, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) ON CONFLICT (plugin_id, setting_key) DO UPDATE SET kind = excluded.kind, public_value = excluded.public_value, secret_record = excluded.secret_record, updated_at = excluded.updated_at',
        [
          record.id,
          record.pluginId,
          record.key,
          record.kind,
          record.publicValue ?? null,
          record.secretRecord === undefined
            ? null
            : JSON.stringify(record.secretRecord),
          record.updatedAtMs,
        ],
      );
    },
    async list(pluginId) {
      const result = await pool.query<SettingRow>(
        'SELECT id, plugin_id, setting_key, kind, public_value, secret_record, updated_at FROM plugin_settings WHERE plugin_id = $1 ORDER BY setting_key LIMIT 64',
        [pluginId],
      );
      return result.rows.map(toRecord);
    },
    async remove(pluginId, key) {
      const result = await pool.query(
        'DELETE FROM plugin_settings WHERE plugin_id = $1 AND setting_key = $2',
        [pluginId, key],
      );
      if (result.rowCount !== null && result.rowCount > 1)
        throw new Error('Invalid plugin setting deletion');
      return result.rowCount === 1;
    },
    async removeAll(pluginId) {
      const result = await pool.query(
        'DELETE FROM plugin_settings WHERE plugin_id = $1',
        [pluginId],
      );
      if (result.rowCount === null)
        throw new Error('Invalid plugin settings deletion');
      return result.rowCount;
    },
  };
}
