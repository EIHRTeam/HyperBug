import type { D1Database } from '@cloudflare/workers-types';
import {
  AuditFailure,
  auditEvent,
  auditListOptions,
  type AuditEvent,
  type AuditRepository,
} from '@hyperbug/security';

type Row = Omit<AuditEvent, 'metadata'> & { metadata: string };
const columns =
  'id, project_id AS projectId, actor_id AS actorId, system_actor AS systemActor, action, target_id AS targetId, result, request_id AS requestId, created_at AS createdAt, metadata';

export function createD1AuditRepository(db: D1Database): AuditRepository {
  return {
    async append(input, signal) {
      const event = auditEvent(input);
      try {
        signal.throwIfAborted();
        const result = await db
          .withSession('first-primary')
          .prepare(
            'INSERT INTO audit_events (id, project_id, actor_id, system_actor, action, target_id, result, request_id, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
          )
          .run();
        signal.throwIfAborted();
        if (!result.success || result.meta.changes !== 1)
          throw new AuditFailure();
      } catch {
        throw new AuditFailure();
      }
    },
    async list(input, signal) {
      const options = auditListOptions(input);
      try {
        signal.throwIfAborted();
        const values: (string | number)[] = [options.projectId];
        const boundary = options.before ? ' AND (created_at, id) < (?, ?)' : '';
        if (options.before)
          values.push(options.before.createdAt, options.before.id);
        values.push(options.limit + 1);
        const result = await db
          .withSession('first-primary')
          .prepare(
            `SELECT ${columns} FROM audit_events WHERE project_id = ?${boundary} ORDER BY created_at DESC, id DESC LIMIT ?`,
          )
          .bind(...values)
          .all<Row>();
        signal.throwIfAborted();
        if (!result.success || result.results.length > options.limit + 1)
          throw new AuditFailure();
        return result.results.map((row) => {
          if (typeof row.metadata !== 'string' || row.metadata.length > 1024)
            throw new AuditFailure();
          return auditEvent({ ...row, metadata: JSON.parse(row.metadata) });
        });
      } catch {
        throw new AuditFailure();
      }
    },
  };
}
