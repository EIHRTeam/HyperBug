import type { Pool, PoolClient } from 'pg';
import type { PreparedAuditEvent } from '@hyperbug/application';
import { auditEvent, AuditFailure } from '@hyperbug/security';

/** The caller owns the transaction; no separate connection or commit. */
export async function postgresAuditInsert(
  db: PoolClient,
  input: PreparedAuditEvent,
): Promise<void> {
  const event = auditEvent(input);
  try {
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
  } catch {
    throw new AuditFailure();
  }
}

export async function postgresAuditedMutation<T>(
  pool: Pool,
  input: PreparedAuditEvent,
  operation: (db: PoolClient) => Promise<{ value: T; changed: boolean }>,
): Promise<T> {
  const audit = auditEvent(input);
  const db = await pool.connect();
  let broken = false;
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL statement_timeout = '1000ms'");
    await db.query("SET LOCAL lock_timeout = '1000ms'");
    const result = await operation(db);
    if (result.changed) await postgresAuditInsert(db, audit);
    await db.query('COMMIT');
    return result.value;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {
      broken = true;
    });
    throw error;
  } finally {
    db.release(broken);
  }
}
