import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '@cloudflare/workers-types';
import type { PreparedAuditEvent } from '@hyperbug/application';
import { auditEvent, AuditFailure } from '@hyperbug/security';

/** Place immediately after the authoritative mutation in the same batch. */
export function d1AuditInsert(
  db: D1Database,
  input: PreparedAuditEvent,
  conditional = true,
): D1PreparedStatement {
  const event = auditEvent(input);
  return db
    .prepare(
      `INSERT INTO audit_events (id, project_id, actor_id, system_actor, action, target_id, result, request_id, created_at, metadata) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${conditional ? ' WHERE changes() > 0' : ''}`,
    )
    .bind(
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
    );
}

export async function d1AuditedMutation<T>(
  db: D1Database,
  mutation: D1PreparedStatement,
  audit: PreparedAuditEvent,
  after: readonly D1PreparedStatement[] = [],
): Promise<D1Result<T>> {
  const insert = d1AuditInsert(db, audit);
  try {
    const results = await db.batch<T>([mutation, insert, ...after]);
    if (results.some((result) => !result.success)) throw new AuditFailure();
    return results[0]!;
  } catch {
    throw new AuditFailure();
  }
}
