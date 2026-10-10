import {
  validAccountLockoutPolicy,
  type AccountLockoutPolicy,
  type AccountLockoutState,
} from './account-lockout.ts';

/**
 * Chosen FREE-02 lockout parameters for the minimum tier: a 500 ms first
 * delay doubling every two failures, capped at 15 minutes, with the failure
 * streak expiring after 15 minutes of inactivity. Bounded by
 * `validAccountLockoutPolicy`; persistence stays in the D1 lockout store.
 */
export const minimumTierAccountLockoutPolicy: AccountLockoutPolicy =
  Object.freeze({
    initialMs: 500,
    maximumMs: 900_000,
    failuresPerStep: 2,
    resetAfterMs: 900_000,
  });

if (!validAccountLockoutPolicy(minimumTierAccountLockoutPolicy, 0)) {
  throw new Error('Invalid minimum tier account lockout policy');
}

/** Only the HMAC subject digest is ever alerted or retained. */
export type AdministratorAbuseAlertKind = 'account-lockout';

export interface AdministratorAbuseAlert {
  readonly kind: AdministratorAbuseAlertKind;
  readonly subjectDigest: string;
  readonly engagedAtMs: number;
  readonly failedAttempts: number;
  readonly notBeforeMs: number;
}

/** Best-effort bounded delivery; a sink failure never affects admission. */
export type AdministratorAlertSink = (
  alert: AdministratorAbuseAlert,
  signal: AbortSignal,
) => Promise<void>;

/**
 * FREE-02's declared limit-consistency model for the minimum tier, fixed
 * after the 2026-09-29 plan measurement (100,000 D1 writes/day,
 * ~100,000 PBKDF2 iterations per invocation; see
 * docs/plan/evidence/03-free-pbkdf2-measurement.json).
 */
export const minimumTierLimitConsistency = Object.freeze({
  consistent: Object.freeze([
    Object.freeze({
      limit: 'account lockout and progressive delay',
      mechanism: 'D1 primary upsert per failed password and success clear',
      rationale:
        'mandatory FREE-02 compensation; writes scale with failures, not logins',
    }),
    Object.freeze({
      limit: 'authoritative account and trusted-IP admission counters',
      mechanism: 'D1 primary counters per registration/login attempt',
      rationale:
        'kept consistent within the measured write budget; dropping them would weaken enforcement below the security baseline',
    }),
  ]),
  approximate: Object.freeze([
    Object.freeze({
      limit: 'volumetric per-route and per-IP shedding',
      mechanism: 'Workers Rate Limiting binding, per Cloudflare location',
      rationale:
        'cheap protection before parsing; allowance never replaces consistent limits',
    }),
    Object.freeze({
      limit: 'administrator lockout alerts',
      mechanism: 'per-isolate suppression windows',
      rationale:
        'at-least-one alert per subject window per isolate; delivery is best-effort',
    }),
  ]),
  declaredAt: '2026-09-30',
});

export interface LockoutAlertEmitter {
  /** Called with the recorded failure state; engages once per suppression window. */
  (state: AccountLockoutState, subjectDigest: string, nowMs: number): void;
}

/**
 * Per-isolate, per-digest suppression so a sustained attack cannot flood the
 * sink: the first engaged lockout in each window alerts, later ones within
 * the window are dropped without awaiting the sink.
 */
export function createLockoutAlertEmitter(
  sink: AdministratorAlertSink,
  options: { readonly suppressionMs: number; readonly maxTracked: number } = {
    suppressionMs: 600_000,
    maxTracked: 10_000,
  },
): LockoutAlertEmitter {
  if (
    typeof sink !== 'function' ||
    !Number.isSafeInteger(options.suppressionMs) ||
    options.suppressionMs < 1000 ||
    options.suppressionMs > 86400000 ||
    !Number.isSafeInteger(options.maxTracked) ||
    options.maxTracked < 1 ||
    options.maxTracked > 100000
  )
    throw new Error('Invalid lockout alert emitter');
  const lastAlertAt = new Map<string, number>();
  return (state, subjectDigest, nowMs) => {
    if (
      !state ||
      typeof subjectDigest !== 'string' ||
      subjectDigest.length < 1 ||
      subjectDigest.length > 512 ||
      !Number.isSafeInteger(nowMs) ||
      nowMs < 0 ||
      state.notBeforeMs <= nowMs
    )
      return;
    const previous = lastAlertAt.get(subjectDigest);
    if (previous !== undefined && nowMs - previous < options.suppressionMs)
      return;
    if (previous === undefined && lastAlertAt.size >= options.maxTracked)
      return;
    lastAlertAt.set(subjectDigest, nowMs);
    void Promise.resolve()
      .then(() =>
        sink(
          {
            kind: 'account-lockout',
            subjectDigest,
            engagedAtMs: nowMs,
            failedAttempts: state.failedAttempts,
            notBeforeMs: state.notBeforeMs,
          },
          AbortSignal.timeout(Math.min(options.suppressionMs, 5000)),
        ),
      )
      .catch(() => {
        /* Best-effort alerting must never affect admission. */
      });
  };
}
