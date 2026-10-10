import { postgresAuditedMutation } from './audit-write.ts';
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
    async configure(records, audit) {
      if (records.length > 64)
        throw new Error('Plugin configuration exceeds the bound');
      for (const record of records) {
        validatePluginSettingRecord(record);
        if (record.pluginId !== audit.targetId)
          throw new Error('Invalid configuration namespace');
      }
      await postgresAuditedMutation(pool, audit, async (db) => {
        for (const record of records) {
          // A single transaction owns the complete bounded configuration.
          // eslint-disable-next-line no-await-in-loop
          await db.query(
            'INSERT INTO plugin_settings (id, plugin_id, setting_key, kind, public_value, secret_record, updated_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) ON CONFLICT (plugin_id, setting_key) DO UPDATE SET id = excluded.id, kind = excluded.kind, public_value = excluded.public_value, secret_record = excluded.secret_record, updated_at = excluded.updated_at',
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
        }
        return { value: undefined, changed: records.length > 0 };
      });
    },
    async list(pluginId) {
      const result = await pool.query<SettingRow>(
        'SELECT id, plugin_id, setting_key, kind, public_value, secret_record, updated_at FROM plugin_settings WHERE plugin_id = $1 ORDER BY setting_key LIMIT 64',
        [pluginId],
      );
      return result.rows.map(toRecord);
    },
  };
}
