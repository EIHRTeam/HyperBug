import { AuditFailure, type AuditEvent } from '@hyperbug/security';
import type { AuditAppend } from './sensitive-admission.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

/**
 * Append a required standalone event. Store-backed administration writes use
 * the prepared event in their authoritative database transaction instead.
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

/** Closed mapping for an audit insert failure within a storage transaction. */
export async function withAtomicAudit<T>(
  signal: AbortSignal,
  timeoutMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await withDeadline(signal, timeoutMs, operation);
  } catch (error) {
    if (error instanceof AuditFailure)
      throw new RequestFailure('AUDIT_UNAVAILABLE');
    throw error;
  }
}
