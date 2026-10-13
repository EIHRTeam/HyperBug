import type { Pool } from 'pg';
import {
  KeyRegistryFailure,
  registryId,
  registryMutation,
  registrySnapshot,
  registryLifecycle,
  parseProtectedValue,
  type KeyRegistry,
  type RegistryMutation,
  type RegistrySnapshot,
  type RegistryVersion,
} from '@hyperbug/security';

interface RegistryRow {
  generation: number;
  purpose: RegistryVersion['ref']['purpose'] | null;
  key_id: string | null;
  version: number | null;
  state: RegistryVersion['state'] | null;
  required: boolean | number;
}
const snapshotSql = `SELECT c.generation, k.purpose, k.key_id, k.version, k.state,
  ((SELECT r.id FROM protected_records r WHERE r.purpose = k.purpose AND r.key_id = k.key_id AND r.key_version = k.version ORDER BY r.id LIMIT 1) IS NOT NULL
   OR (SELECT b.backup_id FROM key_backup_references b WHERE b.purpose = k.purpose AND b.key_id = k.key_id AND b.key_version = k.version ORDER BY b.backup_id LIMIT 1) IS NOT NULL) AS required
  FROM key_registry_control c LEFT JOIN key_versions k ON k.state != 'removed'
  WHERE c.singleton = 1 ORDER BY k.purpose, k.key_id, k.version LIMIT 33`;
function snapshot(rows: RegistryRow[]): RegistrySnapshot {
  const first = rows[0];
  if (!first) throw new KeyRegistryFailure();
  return registrySnapshot(
    first.generation,
    rows
      .filter((r) => r.purpose !== null)
      .map((r) => {
        if (
          r.key_id === null ||
          r.version === null ||
          r.state === null ||
          r.purpose === null ||
          ![true, false, 0, 1].includes(r.required)
        )
          throw new KeyRegistryFailure();
        return {
          ref: { purpose: r.purpose, id: r.key_id, version: r.version },
          state: r.state,
          required: Boolean(r.required),
        };
      }),
  );
}
interface Statement {
  sql: string;
  values: (string | number)[];
}
function statements(intent: RegistryMutation): Statement[] {
  const result: Statement[] = [];
  const add = (sql: string, ...values: (string | number)[]) => {
    result.push({ sql, values });
  };
  // A CHECK violation aborts the entire transaction, including a zero-row precondition.
  add(
    `INSERT INTO key_registry_control (singleton, generation) VALUES (1, CASE WHEN EXISTS (SELECT 1 FROM key_registry_control WHERE singleton = 1) THEN 1 ELSE -1 END)
    ON CONFLICT (singleton) DO UPDATE SET generation = CASE WHEN key_registry_control.generation = ? THEN key_registry_control.generation + 1 ELSE -1 END`,
    intent.expectedGeneration,
  );
  const guard = (predicate: string, ...values: (string | number)[]) =>
    add(
      `UPDATE key_registry_control SET generation = CASE WHEN (${predicate}) THEN generation ELSE -1 END WHERE singleton = 1`,
      ...values,
    );
  const c = intent.change;
  switch (c.kind) {
    case 'activate': {
      guard(
        `NOT EXISTS (SELECT 1 FROM key_backups WHERE state = 'capturing')
        AND (SELECT count(*) FROM key_versions WHERE state != 'removed') < 32
        AND (? != 'blind-index' OR (SELECT count(*) FROM key_versions WHERE purpose = 'blind-index' AND state IN ('current','previous')) < 3)`,
        c.key.purpose,
      );
      add(
        "UPDATE key_versions SET state = 'previous' WHERE purpose = ? AND state = 'current'",
        c.key.purpose,
      );
      add(
        "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES (?, ?, ?, 'current', ?)",
        c.key.purpose,
        c.key.id,
        c.key.version,
        intent.now,
      );
      break;
    }
    case 'revoke': {
      guard(
        "EXISTS (SELECT 1 FROM key_versions WHERE purpose = ? AND key_id = ? AND version = ? AND state IN ('current','previous'))",
        c.key.purpose,
        c.key.id,
        c.key.version,
      );
      add(
        "UPDATE key_versions SET state = 'revoked' WHERE purpose = ? AND key_id = ? AND version = ?",
        c.key.purpose,
        c.key.id,
        c.key.version,
      );
      break;
    }
    case 'remove': {
      guard(
        `NOT EXISTS (SELECT 1 FROM key_backups WHERE state = 'capturing')
        AND EXISTS (SELECT 1 FROM key_versions WHERE purpose = ? AND key_id = ? AND version = ? AND state IN ('previous','revoked'))
        AND NOT EXISTS (SELECT 1 FROM protected_records WHERE purpose = ? AND key_id = ? AND key_version = ?)
        AND NOT EXISTS (SELECT 1 FROM key_backup_references WHERE purpose = ? AND key_id = ? AND key_version = ?)`,
        c.key.purpose,
        c.key.id,
        c.key.version,
        c.key.purpose,
        c.key.id,
        c.key.version,
        c.key.purpose,
        c.key.id,
        c.key.version,
      );
      add(
        "UPDATE key_versions SET state = 'removed' WHERE purpose = ? AND key_id = ? AND version = ?",
        c.key.purpose,
        c.key.id,
        c.key.version,
      );
      break;
    }
    case 'put': {
      const k = c.record.key;
      guard(
        "EXISTS (SELECT 1 FROM key_versions WHERE purpose = ? AND key_id = ? AND version = ? AND state = 'current')",
        k.purpose,
        k.id,
        k.version,
      );
      if (c.expectedRevision === 0) {
        add(
          'INSERT INTO protected_records (id, revision, purpose, key_id, key_version, record) VALUES (?, 1, ?, ?, ?, ?)',
          c.id,
          k.purpose,
          k.id,
          k.version,
          JSON.stringify(c.record),
        );
      } else {
        guard(
          'EXISTS (SELECT 1 FROM protected_records WHERE id = ? AND revision = ? AND purpose = ?)',
          c.id,
          c.expectedRevision,
          k.purpose,
        );
        add(
          'UPDATE protected_records SET revision = revision + 1, key_id = ?, key_version = ?, record = ? WHERE id = ?',
          k.id,
          k.version,
          JSON.stringify(c.record),
          c.id,
        );
      }
      break;
    }
    case 'delete': {
      guard(
        'EXISTS (SELECT 1 FROM protected_records WHERE id = ? AND revision = ?)',
        c.id,
        c.expectedRevision,
      );
      add('DELETE FROM protected_records WHERE id = ?', c.id);
      break;
    }
    case 'begin-backup': {
      guard(`EXISTS (SELECT 1 FROM key_versions WHERE state != 'removed')
        AND NOT EXISTS (SELECT 1 FROM key_backups WHERE state = 'capturing')`);
      add(
        "INSERT INTO key_backups (id, state, retain_until, created_at) VALUES (?, 'capturing', ?, ?)",
        c.id,
        c.retainUntil,
        intent.now,
      );
      add(
        "INSERT INTO key_backup_references (backup_id, purpose, key_id, key_version) SELECT ?, purpose, key_id, version FROM key_versions WHERE state != 'removed'",
        c.id,
      );
      break;
    }
    case 'finish-backup': {
      guard(
        "EXISTS (SELECT 1 FROM key_backups WHERE id = ? AND state = 'capturing')",
        c.id,
      );
      add("UPDATE key_backups SET state = 'retained' WHERE id = ?", c.id);
      break;
    }
    case 'release-backup': {
      guard(
        "EXISTS (SELECT 1 FROM key_backups WHERE id = ? AND state IN ('capturing','retained') AND retain_until <= ?)",
        c.id,
        intent.now,
      );
      add('DELETE FROM key_backup_references WHERE backup_id = ?', c.id);
      add("UPDATE key_backups SET state = 'released' WHERE id = ?", c.id);
      break;
    }
  }
  const target =
    'key' in c
      ? JSON.stringify([c.key.purpose, c.key.id, c.key.version])
      : c.id;
  // No ciphertext, digest, secret-source content, operator-provided reason or raw key.
  add(
    `INSERT INTO audit_events (id, project_id, actor_id, system_actor, action, target_id, result, request_id, created_at, metadata)
    VALUES (?, NULL, NULL, 'core.key-registry', ?, ?, 'success', ?, ?, ?)`,
    intent.auditId,
    `key-registry.${c.kind}`,
    target,
    intent.requestId,
    intent.now,
    JSON.stringify({ v: 1, generation: intent.expectedGeneration + 1 }),
  );
  return result;
}

/** Pool must address the primary, never a read replica or transaction cache. */
export function createPostgresKeyRegistry(pool: Pool): KeyRegistry {
  async function inspect(signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      const { rows } = await pool.query<RegistryRow>(snapshotSql);
      signal.throwIfAborted();
      return snapshot(rows);
    } catch {
      throw new KeyRegistryFailure();
    }
  }
  return {
    inspect,
    async load(purpose, signal) {
      try {
        signal.throwIfAborted();
        const { rows } = await pool.query<RegistryRow>(
          snapshotSql.replace(
            "k.state != 'removed'",
            "k.state != 'removed' AND k.purpose = $1",
          ),
          [purpose],
        );
        signal.throwIfAborted();
        return registryLifecycle(snapshot(rows), purpose);
      } catch {
        throw new KeyRegistryFailure();
      }
    },
    async mutate(input) {
      const intent = registryMutation(input);
      const db = await pool.connect().catch(() => {
        throw new KeyRegistryFailure();
      });
      try {
        await db.query('BEGIN');
        await db.query("SET LOCAL statement_timeout = '1000ms'");
        await db.query("SET LOCAL lock_timeout = '1000ms'");
        for (const s of statements(intent)) {
          let parameter = 0;
          // Sequential statements on this exclusively held transaction connection.
          // eslint-disable-next-line no-await-in-loop
          await db.query(
            s.sql.replace(/\?/g, () => `$${++parameter}`),
            s.values,
          );
        }
        await db.query('COMMIT');
        return intent.expectedGeneration + 1;
      } catch {
        await db.query('ROLLBACK').catch(() => undefined);
        throw new KeyRegistryFailure();
      } finally {
        db.release();
      }
    },
    async getRecord(id, signal) {
      try {
        registryId(id);
        signal.throwIfAborted();
        const { rows } = await pool.query<{
          revision: number;
          record: unknown;
        }>({
          text: 'SELECT revision, record FROM protected_records WHERE id = $1',
          values: [id],
        });
        signal.throwIfAborted();
        const row = rows[0];
        return row
          ? {
              id,
              revision: row.revision,
              record: parseProtectedValue(row.record),
            }
          : null;
      } catch {
        throw new KeyRegistryFailure();
      }
    },
  };
}
