import {
  checkAccountLockout,
  clearAccountLockout,
  recordAccountFailure,
  type AccountLockoutDecision,
  type AccountLockoutPolicy,
  type AccountLockoutStore,
  type RateSubject,
} from '@hyperbug/security';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

export interface AccountLockoutAdmissionIntent {
  readonly store: AccountLockoutStore;
  /** Every active HMAC version of the canonical login account subject. */
  readonly subjects: readonly RateSubject[];
  readonly nowMs: number;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

export interface AccountLockoutFailureIntent extends AccountLockoutAdmissionIntent {
  readonly policy: AccountLockoutPolicy;
}

export interface AccountLockoutSuccessIntent {
  readonly store: AccountLockoutStore;
  readonly subjects: readonly RateSubject[];
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
}

function validBoundary(signal: AbortSignal, timeoutMs: number): boolean {
  return (
    !!signal &&
    signal.aborted === false &&
    Number.isSafeInteger(timeoutMs) &&
    timeoutMs >= 10 &&
    timeoutMs <= 5000
  );
}

async function requireAvailable<T>(
  signal: AbortSignal,
  timeoutMs: number,
  operation: () => Promise<T>,
): Promise<T> {
  if (!validBoundary(signal, timeoutMs))
    throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  try {
    const result = await withDeadline(signal, timeoutMs, operation);
    if (signal.aborted) throw new Error('Cancelled lockout operation');
    return result;
  } catch {
    throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  }
}

/** Require the D1-backed lockout decision before password verification. */
export async function requireAccountLockoutAdmission(
  intent: AccountLockoutAdmissionIntent,
): Promise<void> {
  if (!intent) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  const decision: AccountLockoutDecision = await requireAvailable(
    intent.signal,
    intent.timeoutMs,
    () => checkAccountLockout(intent.store, intent.subjects, intent.nowMs),
  );
  if (decision.allowed) return;
  if (
    decision.reason === 'limited' &&
    Number.isSafeInteger(decision.retryAfterSeconds) &&
    decision.retryAfterSeconds !== null &&
    decision.retryAfterSeconds >= 1 &&
    decision.retryAfterSeconds <= 86400
  )
    throw new RequestFailure('RATE_LIMITED', decision.retryAfterSeconds);
  throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
}

/** Record an invalid password before responding; failure prevents completion. */
export async function requireAccountLockoutFailureRecorded(
  intent: AccountLockoutFailureIntent,
): Promise<void> {
  if (!intent) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  await requireAvailable(intent.signal, intent.timeoutMs, () =>
    recordAccountFailure(
      intent.store,
      intent.subjects,
      intent.nowMs,
      intent.policy,
    ),
  );
}

/** Clear only after verified success and before issuing a login credential. */
export async function requireAccountLockoutCleared(
  intent: AccountLockoutSuccessIntent,
): Promise<void> {
  if (!intent) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  await requireAvailable(intent.signal, intent.timeoutMs, () =>
    clearAccountLockout(intent.store, intent.subjects),
  );
}
