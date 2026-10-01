import type { AuditEvent } from '@hyperbug/security';
import type { AuditAppend } from './sensitive-admission.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

/**
 * Append a required audit event after its authoritative mutation succeeded.
 * A missing sink or a failed bounded write fails the request closed; the
 * mutation itself is never compensated, and the crash window between the
 * committed write and this append is the recorded limit of this trail.
 */
export async function appendRequiredAuditEvent(input: {
  readonly append: AuditAppend | null;
  readonly event: AuditEvent;
  readonly signal: AbortSignal;
}): Promise<void> {
  const { append, event, signal } = input;
  if (!append) throw new RequestFailure('AUDIT_UNAVAILABLE');
  try {
    await withDeadline(signal, 1000, (bound) => append(event, bound));
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('AUDIT_UNAVAILABLE');
  }
}

/** Correlate an audited mutation with the request that performed it. */
export function auditRequestId(requestId: string | null | undefined): string {
  return typeof requestId === 'string' && requestId.length > 0
    ? requestId
    : crypto.randomUUID();
}
