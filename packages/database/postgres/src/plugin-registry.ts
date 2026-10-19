import { postgresAuditedMutation } from './audit-write.ts';
import type { PreparedAuditEvent } from '@hyperbug/application';
import type { Pool } from 'pg';
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
  manifest: unknown;
  registered_at: string | number;
  updated_at: string | number;
}

function toRecord(row: RegistryRow): PluginRegistryRecord {
  const manifest = validatePluginManifest(row.manifest);
  if (!manifest.ok) throw new Error('Invalid persisted plugin manifest');
  const state = row.state;
  if (state !== 'registered' && state !== 'enabled' && state !== 'disabled')
    throw new Error('Invalid persisted plugin state');
  const registeredAtMs = Number(row.registered_at);
  const updatedAtMs = Number(row.updated_at);
  const record: PluginRegistryRecord = {
    id: row.id,
    version: row.version,
    state: state as PluginLifecycleState,
    manifest: manifest.manifest,
    registeredAtMs,
    updatedAtMs,
  };
  validatePluginRegistryRecord(record);
  return record;
}

const columns = 'id, version, state, manifest, registered_at, updated_at';

/**
 * PostgreSQL adapter for the deployment-level plugin registry, mirroring the
 * D1 adapter: manifest stored as JSON, re-validated on read, conditional
 * full-row transitions.
 */
export function createPostgresPluginRegistryStore(
  pool: Pool,
): PluginRegistryStore {
  return {
    async insert(record, audit) {
      validatePluginRegistryRecord(record);
      return postgresAuditedMutation(pool, audit, async (db) => {
        const result = await db.query(
          'INSERT INTO plugin_registry (id, version, state, manifest, registered_at, updated_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6) ON CONFLICT (id) DO NOTHING RETURNING id',
          [
            record.id,
            record.version,
            record.state,
            JSON.stringify(record.manifest),
            record.registeredAtMs,
            record.updatedAtMs,
          ],
        );
        return {
          value:
            result.rowCount === 1
              ? ('inserted' as const)
              : ('conflict' as const),
          changed: result.rowCount === 1,
        };
      });
    },
    async load(id) {
      const result = await pool.query<RegistryRow>(
        `SELECT ${columns} FROM plugin_registry WHERE id = $1 LIMIT 1`,
        [id],
      );
      const row = result.rows[0];
      return row === undefined ? null : toRecord(row);
    },
    async list() {
      const result = await pool.query<RegistryRow>(
        `SELECT ${columns} FROM plugin_registry ORDER BY id LIMIT 200`,
      );
      return result.rows.map(toRecord);
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
        ? `UPDATE plugin_registry SET state = $1, version = $2, manifest = $3::jsonb, updated_at = $4 WHERE id = $5 AND state = $6 AND version = $7 RETURNING ${columns}`
        : `UPDATE plugin_registry SET state = $1, version = $2, manifest = $3::jsonb, updated_at = $4 WHERE id = $5 AND state = $6 RETURNING ${columns}`;
      const values = guarded
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
      return postgresAuditedMutation(pool, audit, async (db) => {
        const result = await db.query<RegistryRow>(sql, values);
        const row = result.rows[0];
        return {
          value: row === undefined ? null : toRecord(row),
          changed: result.rowCount === 1,
        };
      });
    },
    async remove(id, audit, deleteSettings = false) {
      return postgresAuditedMutation(pool, audit, async (db) => {
        const result = await db.query(
          'DELETE FROM plugin_registry WHERE id = $1',
          [id],
        );
        if (result.rowCount !== null && result.rowCount > 1)
          throw new Error('Invalid plugin registry deletion');
        if (result.rowCount === 1 && deleteSettings)
          await db.query('DELETE FROM plugin_settings WHERE plugin_id = $1', [
            id,
          ]);
        return { value: result.rowCount === 1, changed: result.rowCount === 1 };
      });
    },
  };
}
