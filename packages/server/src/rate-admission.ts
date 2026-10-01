import {
  checkSensitiveRateAdmission,
  type AbuseKeyProvider,
  type CanonicalRateCheck,
  type RateCategory,
  type RateCounterStore,
  type RateDecision,
  type VolumetricLimiter,
} from '@hyperbug/security';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

export interface SensitiveAdmissionIntent {
  readonly provider: AbuseKeyProvider;
  readonly store: RateCounterStore;
  readonly limiter?: VolumetricLimiter;
  readonly category: RateCategory;
  readonly checks: readonly CanonicalRateCheck[];
  readonly nowMs: number;
  readonly signal: AbortSignal;
  /** Route-selected bounded wall-clock budget for key and both limiters. */
  readonly timeoutMs: number;
}

function requireAllowed(decision: RateDecision, signal: AbortSignal): void {
  if (!signal || signal.aborted !== false)
    throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  if (decision.allowed === true) return;
  if (decision.reason === 'limited' && decision.retryAfterSeconds === null)
    throw new RequestFailure('RATE_LIMITED');
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

/** Call before the route's protected side effect with trusted canonical subjects. */
export async function requireSensitiveRateAdmission(
  intent: SensitiveAdmissionIntent,
): Promise<void> {
  if (
    !intent.signal ||
    intent.signal.aborted !== false ||
    !Number.isSafeInteger(intent.timeoutMs) ||
    intent.timeoutMs < 10 ||
    intent.timeoutMs > 5000
  )
    throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  let decision: RateDecision;
  try {
    decision = await withDeadline(intent.signal, intent.timeoutMs, (signal) =>
      checkSensitiveRateAdmission(
        intent.provider,
        intent.store,
        intent.category,
        intent.checks,
        intent.nowMs,
        signal,
        intent.limiter,
      ),
    );
  } catch {
    throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  }
  requireAllowed(decision, intent.signal);
}
