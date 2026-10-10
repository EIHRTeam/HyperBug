import type { Pool, PoolClient } from 'pg';
import {
  AuditFailure,
  auditEvent,
  auditListOptions,
  type AuditEvent,
  type AuditRepository,
} from '@hyperbug/security';

type Row = Omit<AuditEvent, 'createdAt'> & { createdAt: string };
const columns =
  'id, project_id AS "projectId", actor_id AS "actorId", system_actor AS "systemActor", action, target_id AS "targetId", result, request_id AS "requestId", created_at AS "createdAt", metadata';

/** Pool must use the primary and finite connection/idle-in-transaction timeouts. */
export function createPostgresAuditRepository(pool: Pool): AuditRepository {
  async function transaction<T>(
    signal: AbortSignal,
    operation: (db: PoolClient) => Promise<T>,
  ): Promise<T> {
    signal.throwIfAborted();
    const db = await pool.connect().catch(() => {
      throw new AuditFailure();
    });
    let broken = false;
    try {
      signal.throwIfAborted();
      await db.query('BEGIN');
      await db.query("SET LOCAL statement_timeout = '1000ms'");
      await db.query("SET LOCAL lock_timeout = '1000ms'");
      signal.throwIfAborted();
      const result = await operation(db);
      signal.throwIfAborted();
      await db.query('COMMIT');
      signal.throwIfAborted();
      return result;
    } catch {
      await db.query('ROLLBACK').catch(() => {
        broken = true;
      });
      throw new AuditFailure();
    } finally {
      db.release(broken);
    }
  }
  return {
    async append(input, signal) {
      const event = auditEvent(input);
      await transaction(signal, async (db) => {
        const result = await db.query(
          'INSERT INTO audit_events (id, project_id, actor_id, system_actor, action, target_id, result, request_id, created_at, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            event.id,
            event.projectId,
            event.actorId,
            event.systemActor,
            event.action,
            event.targetId,
            event.result,
            event.requestId,
            event.createdAt,
            JSON.stringify(event.metadata),
          ],
        );
        if (result.rowCount !== 1) throw new AuditFailure();
      });
    },
    async list(input, signal) {
      const options = auditListOptions(input);
      return transaction(signal, async (db) => {
        const values: (string | number)[] = [options.projectId];
        const boundary = options.before
          ? ' AND (created_at, id) < ($2, $3)'
          : '';
        if (options.before)
          values.push(options.before.createdAt, options.before.id);
        values.push(options.limit + 1);
        const result = await db.query<Row>(
          `SELECT ${columns} FROM audit_events WHERE project_id = $1${boundary} ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
          values,
        );
        if (result.rows.length > options.limit + 1) throw new AuditFailure();
        return result.rows.map((row) => {
          if (
            typeof row.createdAt !== 'string' ||
            !/^(0|[1-9][0-9]*)$/.test(row.createdAt)
          )
            throw new AuditFailure();
          return auditEvent({ ...row, createdAt: Number(row.createdAt) });
        });
      });
    },
  };
}
