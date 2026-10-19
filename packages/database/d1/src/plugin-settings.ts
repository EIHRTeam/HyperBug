import { d1AuditedMutation } from './audit-write.ts';
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
    async configure(records, audit) {
      if (records.length > 64)
        throw new Error('Plugin configuration exceeds the bound');
      if (records.length === 0) return;
      for (const record of records) {
        validatePluginSettingRecord(record);
        if (record.pluginId !== audit.targetId)
          throw new Error('Invalid configuration namespace');
      }
      await d1AuditedMutation(
        db,
        db
          .prepare(`INSERT INTO plugin_settings (id, plugin_id, setting_key, kind, public_value, secret_record, updated_at)
        SELECT json_extract(value, '$.id'), json_extract(value, '$.pluginId'), json_extract(value, '$.key'), json_extract(value, '$.kind'), json_extract(value, '$.publicValue'), json_extract(value, '$.secret'), json_extract(value, '$.updatedAtMs') FROM json_each(?) WHERE 1
        ON CONFLICT (plugin_id, setting_key) DO UPDATE SET id = excluded.id, kind = excluded.kind, public_value = excluded.public_value, secret_record = excluded.secret_record, updated_at = excluded.updated_at`)
          .bind(
            JSON.stringify(
              records.map((record) => ({
                ...record,
                secret:
                  record.secretRecord === undefined
                    ? null
                    : JSON.stringify(record.secretRecord),
              })),
            ),
          ),
        audit,
      );
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
  };
}
