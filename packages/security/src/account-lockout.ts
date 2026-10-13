import {
  progressiveAccountDelayMs,
  type ProgressiveDelayPolicy,
} from './account-delay.ts';
import { RateLimitFailure, type RateSubject } from './rate-limit.ts';

export interface AccountLockoutPolicy extends ProgressiveDelayPolicy {
  /** Failure streak expires after this much inactivity. */
  readonly resetAfterMs: number;
}

export interface AccountLockoutState {
  readonly failedAttempts: number;
  readonly notBeforeMs: number;
  readonly expiresAtMs: number;
}

/** One D1 row per active HMAC version of a canonical login account name. */
export interface AccountLockoutStore {
  get(subject: RateSubject, nowMs: number): Promise<AccountLockoutState | null>;
  recordFailure(
    subject: RateSubject,
    nowMs: number,
    policy: AccountLockoutPolicy,
  ): Promise<AccountLockoutState>;
  clear(subject: RateSubject): Promise<void>;
  purgeExpired(nowMs: number, limit: number): Promise<number>;
}

const maxTime = 8640000000000000;
const digest = /^[0-9a-f]{64}$/;

export function validAccountLockoutSubject(value: RateSubject): boolean {
  return (
    value?.category === 'login' &&
    value.dimension === 'account' &&
    Number.isSafeInteger(value.keyVersion) &&
    value.keyVersion >= 1 &&
    value.keyVersion <= 2147483647 &&
    typeof value.digest === 'string' &&
    digest.test(value.digest)
  );
}

export function validAccountLockoutPolicy(
  policy: AccountLockoutPolicy,
  nowMs: number,
): boolean {
  try {
    progressiveAccountDelayMs(1, policy);
  } catch {
    return false;
  }
  return (
    Number.isSafeInteger(policy.resetAfterMs) &&
    policy.resetAfterMs >= policy.maximumMs &&
    policy.resetAfterMs <= 2592000000 &&
    Number.isSafeInteger(nowMs) &&
    nowMs >= 0 &&
    nowMs <= maxTime - policy.resetAfterMs
  );
}

function validState(value: AccountLockoutState): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    Number.isSafeInteger(value.failedAttempts) &&
    value.failedAttempts >= 1 &&
    value.failedAttempts <= 2147483647 &&
    Number.isSafeInteger(value.notBeforeMs) &&
    value.notBeforeMs >= 0 &&
    value.notBeforeMs <= maxTime &&
    Number.isSafeInteger(value.expiresAtMs) &&
    value.expiresAtMs >= value.notBeforeMs &&
    value.expiresAtMs <= maxTime
  );
}

function snapshotSubjects(subjects: readonly RateSubject[]): RateSubject[] {
  if (!Array.isArray(subjects) || subjects.length < 1 || subjects.length > 8)
    throw new RateLimitFailure();
  const versions = new Set<number>();
  return subjects.map((subject) => {
    if (
      !validAccountLockoutSubject(subject) ||
      versions.has(subject.keyVersion)
    )
      throw new RateLimitFailure();
    versions.add(subject.keyVersion);
    return { ...subject };
  });
}

export type AccountLockoutDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: 'limited' | 'unavailable';
      readonly retryAfterSeconds: number | null;
    };

/** Reads every active key version; any D1 failure denies the login attempt. */
export async function checkAccountLockout(
  store: AccountLockoutStore,
  subjects: readonly RateSubject[],
  nowMs: number,
): Promise<AccountLockoutDecision> {
  try {
    const keys = snapshotSubjects(subjects);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > maxTime)
      throw new RateLimitFailure();
    let retryAfterSeconds = 0;
    const states = await Promise.all(keys.map((key) => store.get(key, nowMs)));
    for (const state of states) {
      if (state === null) continue;
      if (!validState(state) || state.expiresAtMs <= nowMs)
        throw new RateLimitFailure();
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.ceil((state.notBeforeMs - nowMs) / 1000),
      );
    }
    if (retryAfterSeconds > 86400) throw new RateLimitFailure();
    return retryAfterSeconds > 0
      ? { allowed: false, reason: 'limited', retryAfterSeconds }
      : { allowed: true };
  } catch {
    return { allowed: false, reason: 'unavailable', retryAfterSeconds: null };
  }
}

/** A failed password consumes every live HMAC version before returning. */
export async function recordAccountFailure(
  store: AccountLockoutStore,
  subjects: readonly RateSubject[],
  nowMs: number,
  policy: AccountLockoutPolicy,
): Promise<AccountLockoutState> {
  const keys = snapshotSubjects(subjects);
  const selected = { ...policy };
  if (!validAccountLockoutPolicy(selected, nowMs)) throw new RateLimitFailure();
  let latest: AccountLockoutState | null = null;
  let states: AccountLockoutState[];
  try {
    states = await Promise.all(
      keys.map((key) => store.recordFailure(key, nowMs, selected)),
    );
  } catch {
    throw new RateLimitFailure();
  }
  for (const state of states) {
    if (
      !validState(state) ||
      state.notBeforeMs > nowMs + selected.maximumMs ||
      state.expiresAtMs !== nowMs + selected.resetAfterMs
    )
      throw new RateLimitFailure();
    if (!latest || state.notBeforeMs > latest.notBeforeMs) latest = state;
  }
  if (!latest) throw new RateLimitFailure();
  return latest;
}

/** Call only after successful password verification; failure denies completion. */
export async function clearAccountLockout(
  store: AccountLockoutStore,
  subjects: readonly RateSubject[],
): Promise<void> {
  try {
    await Promise.all(
      snapshotSubjects(subjects).map((key) => store.clear(key)),
    );
  } catch {
    throw new RateLimitFailure();
  }
}
