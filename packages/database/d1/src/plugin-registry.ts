import { d1AuditedMutation } from './audit-write.ts';
import type { PreparedAuditEvent } from '@hyperbug/application';
import type { D1Database } from '@cloudflare/workers-types';
import {
  validatePluginRegistryRecord,
  type PluginRegistryRecord,
  type PluginRegistryStore,
  type PluginRegistryTransition,
} from '@hyperbug/application';
import {
  validatePluginManifest,
  type PluginLifecycleState,
} from '@hyperbug/plugin-api';

interface RegistryRow {
  id: string;
  version: string;
  state: string;
  manifest: string;
  registered_at: number;
  updated_at: number;
}

function toRecord(row: RegistryRow): PluginRegistryRecord {
  const manifest = validatePluginManifest(JSON.parse(row.manifest));
  if (!manifest.ok) throw new Error('Invalid persisted plugin manifest');
  const state = row.state;
  if (state !== 'registered' && state !== 'enabled' && state !== 'disabled')
    throw new Error('Invalid persisted plugin state');
  const record: PluginRegistryRecord = {
    id: row.id,
    version: row.version,
    state: state as PluginLifecycleState,
    manifest: manifest.manifest,
    registeredAtMs: row.registered_at,
    updatedAtMs: row.updated_at,
  };
  validatePluginRegistryRecord(record);
  return record;
}

const columns = 'id, version, state, manifest, registered_at, updated_at';

/**
 * D1 adapter for the deployment-level plugin registry. The manifest is stored
 * as canonical JSON text and re-validated on read; the conditional transition
 * writes the full post-transition row only when the stored state (and, for
 * upgrades, version) still matches what the caller observed.
 */
export function createD1PluginRegistryStore(
  db: D1Database,
): PluginRegistryStore {
  return {
    async insert(record, audit) {
      validatePluginRegistryRecord(record);
      const result = await d1AuditedMutation<{ id: string }>(
        db,
        db
          .prepare(
            'INSERT INTO plugin_registry (id, version, state, manifest, registered_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING RETURNING id',
          )
          .bind(
            record.id,
            record.version,
            record.state,
            JSON.stringify(record.manifest),
            record.registeredAtMs,
            record.updatedAtMs,
          ),
        audit,
      );
      return result.meta.changes === 0 ? 'conflict' : 'inserted';
    },
    async load(id) {
      const row = await db
        .prepare(`SELECT ${columns} FROM plugin_registry WHERE id = ? LIMIT 1`)
        .bind(id)
        .first<RegistryRow>();
      return row === null ? null : toRecord(row);
    },
    async list() {
      const rows = await db
        .prepare(`SELECT ${columns} FROM plugin_registry ORDER BY id LIMIT 200`)
        .all<RegistryRow>();
      return rows.results.map(toRecord);
    },
    async transition(
      input: PluginRegistryTransition & {
        readonly expectedState: PluginLifecycleState;
        readonly expectedVersion?: string;
      },
      audit: PreparedAuditEvent,
    ) {
      validatePluginRegistryRecord({
        ...input,
        registeredAtMs: input.nowMs,
        updatedAtMs: input.nowMs,
      });
      const guarded = input.expectedVersion !== undefined;
      const sql = guarded
        ? `UPDATE plugin_registry SET state = ?, version = ?, manifest = ?, updated_at = ? WHERE id = ? AND state = ? AND version = ? RETURNING ${columns}`
        : `UPDATE plugin_registry SET state = ?, version = ?, manifest = ?, updated_at = ? WHERE id = ? AND state = ? RETURNING ${columns}`;
      const bindings = guarded
        ? [
            input.state,
            input.version,
            JSON.stringify(input.manifest),
            input.nowMs,
            input.id,
            input.expectedState,
            input.expectedVersion,
          ]
        : [
            input.state,
            input.version,
            JSON.stringify(input.manifest),
            input.nowMs,
            input.id,
            input.expectedState,
          ];
      const result = await d1AuditedMutation<RegistryRow>(
        db,
        db.prepare(sql).bind(...bindings),
        audit,
      );
      const row = result.results[0];
      return row === undefined ? null : toRecord(row);
    },
    async remove(id, audit, deleteSettings = false) {
      const result = await d1AuditedMutation(
        db,
        db.prepare('DELETE FROM plugin_registry WHERE id = ?').bind(id),
        audit,
        deleteSettings
          ? [
              db
                .prepare(
                  'DELETE FROM plugin_settings WHERE plugin_id = ? AND EXISTS (SELECT 1 FROM audit_events WHERE id = ?)',
                )
                .bind(id, audit.id),
            ]
          : [],
      );
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid plugin registry deletion');
      return result.meta.changes === 1;
    },
  };
}
