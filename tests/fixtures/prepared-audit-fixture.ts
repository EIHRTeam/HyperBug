import type { PreparedAuditEvent } from '@hyperbug/application';

export function preparedAudit(
  action: string,
  targetId: string,
  actorId: string | null = null,
  projectId: string | null = null,
  metadata: PreparedAuditEvent['metadata'] = { v: 1 },
): PreparedAuditEvent {
  return {
    id: crypto.randomUUID(),
    projectId,
    actorId,
    systemActor: actorId === null ? 'core.identity' : null,
    action,
    targetId,
    result: 'success',
    requestId: crypto.randomUUID(),
    createdAt: Date.now(),
    metadata,
  };
}
