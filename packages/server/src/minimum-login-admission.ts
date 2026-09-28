import {
  checkSensitiveRateAdmissionWithSubjects,
  validAccountLockoutPolicy,
  type AbuseKeyProvider,
  type AccountLockoutPolicy,
  type AccountLockoutStore,
  type CanonicalRateCheck,
  type RateCounterStore,
  type RateSubject,
} from '@hyperbug/security';
import type { CaptchaGate } from './captcha.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';
import type { BoundRateCheck } from './sensitive-admission.ts';
import {
  requireAccountLockoutAdmission,
  requireAccountLockoutCleared,
  requireAccountLockoutFailureRecorded,
} from './account-lockout.ts';

export interface MinimumLoginAdmissionPolicy {
  readonly lockout: AccountLockoutPolicy;
  readonly rateTimeoutMs: number;
  readonly lockoutTimeoutMs: number;
}

export interface MinimumLoginIntent {
  readonly provider: AbuseKeyProvider;
  readonly rateStore: RateCounterStore;
  readonly lockoutStore: AccountLockoutStore;
  /** Trusted, canonical account and client-IP checks; account may have two windows. */
  readonly checks: readonly CanonicalRateCheck[];
  readonly nowMs: number;
  readonly signal: AbortSignal;
  readonly captchaToken?: string | null;
}

export interface MinimumLoginPermit {
  /** Call once after an invalid password, before sending the generic failure. */
  recordFailure(nowMs: number): Promise<void>;
  /** Call once after verified success, before issuing a credential. */
  clearAfterSuccess(): Promise<void>;
}

export interface MinimumLoginAdmission {
  require(intent: MinimumLoginIntent): Promise<MinimumLoginPermit>;
}

export interface BoundMinimumLoginDependencies {
  readonly provider: AbuseKeyProvider;
  readonly rateStore: RateCounterStore;
  readonly lockoutStore: AccountLockoutStore;
  /** Root-owned trusted client address; omit when provenance is unavailable. */
  readonly clientAddress?: (request: Request) => string;
}

export type BoundMinimumLoginIntent = Omit<
  MinimumLoginIntent,
  'provider' | 'rateStore' | 'lockoutStore' | 'checks'
> & { readonly request: Request; readonly checks: readonly BoundRateCheck[] };

export interface BoundMinimumLoginAdmission {
  require(intent: BoundMinimumLoginIntent): Promise<MinimumLoginPermit>;
}

function validDeadline(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 10 && value <= 5000;
}

function sameSubjects(
  left: readonly RateSubject[],
  right: readonly RateSubject[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (subject, index) =>
        subject.keyVersion === right[index]?.keyVersion &&
        subject.digest === right[index]?.digest,
    )
  );
}

/** One rate-key snapshot feeds the minimum-tier lockout and later transition. */
export function createMinimumLoginAdmission(
  captcha: CaptchaGate,
  policy: MinimumLoginAdmissionPolicy,
): MinimumLoginAdmission {
  if (
    !captcha ||
    typeof captcha.enabled !== 'boolean' ||
    typeof captcha.require !== 'function' ||
    !validDeadline(policy?.rateTimeoutMs) ||
    !validDeadline(policy.lockoutTimeoutMs) ||
    !validAccountLockoutPolicy(policy.lockout, 0)
  )
    throw new Error('Invalid minimum login admission policy');
  const selected = Object.freeze({
    lockout: Object.freeze({ ...policy.lockout }),
    rateTimeoutMs: policy.rateTimeoutMs,
    lockoutTimeoutMs: policy.lockoutTimeoutMs,
  });
  const requireCaptcha = captcha.require.bind(captcha);
  return Object.freeze({
    async require(intent: MinimumLoginIntent): Promise<MinimumLoginPermit> {
      if (!intent?.signal || intent.signal.aborted !== false)
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      const provider = intent.provider;
      const rateStore = intent.rateStore;
      const lockoutStore = intent.lockoutStore;
      const signal = intent.signal;
      const nowMs = intent.nowMs;
      const captchaToken = intent.captchaToken ?? null;
      const checks = Array.isArray(intent.checks)
        ? intent.checks.map((check) => ({
            dimension: check?.dimension,
            canonicalSubject: check?.canonicalSubject,
            rule: check?.rule && { ...check.rule },
          }))
        : [];
      const accountIndexes = checks.flatMap((check, index) =>
        check.dimension === 'account' ? [index] : [],
      );
      const accountName = checks[accountIndexes[0] ?? -1]?.canonicalSubject;
      if (
        accountIndexes.length < 1 ||
        typeof accountName !== 'string' ||
        accountIndexes.some(
          (index) => checks[index]?.canonicalSubject !== accountName,
        )
      )
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      const rate = await withDeadline(
        signal,
        selected.rateTimeoutMs,
        (boundSignal) =>
          checkSensitiveRateAdmissionWithSubjects(
            provider,
            rateStore,
            'login',
            checks,
            nowMs,
            boundSignal,
          ),
      ).catch(() => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      });
      if (signal.aborted) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      if (!rate.allowed) {
        if (
          rate.reason === 'limited' &&
          Number.isSafeInteger(rate.retryAfterSeconds) &&
          rate.retryAfterSeconds !== null &&
          rate.retryAfterSeconds >= 1 &&
          rate.retryAfterSeconds <= 86400
        )
          throw new RequestFailure('RATE_LIMITED', rate.retryAfterSeconds);
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      }
      const subjects = rate.subjectsByCheck[accountIndexes[0]!] ?? [];
      if (
        subjects.length < 1 ||
        accountIndexes.some(
          (index) => !sameSubjects(subjects, rate.subjectsByCheck[index] ?? []),
        )
      )
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      const captured = Object.freeze([...subjects]);
      await requireAccountLockoutAdmission({
        store: lockoutStore,
        subjects: captured,
        nowMs,
        signal,
        timeoutMs: selected.lockoutTimeoutMs,
      });
      await requireCaptcha({
        token: captchaToken,
        expectedAction: 'login',
        signal,
      });
      if (signal.aborted) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      let settled = false;
      return Object.freeze({
        async recordFailure(failedAtMs: number): Promise<void> {
          if (settled) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
          settled = true;
          if (!Number.isSafeInteger(failedAtMs) || failedAtMs < nowMs)
            throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
          await requireAccountLockoutFailureRecorded({
            store: lockoutStore,
            subjects: captured,
            nowMs: failedAtMs,
            policy: selected.lockout,
            signal,
            timeoutMs: selected.lockoutTimeoutMs,
          });
        },
        async clearAfterSuccess(): Promise<void> {
          if (settled) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
          settled = true;
          await requireAccountLockoutCleared({
            store: lockoutStore,
            subjects: captured,
            signal,
            timeoutMs: selected.lockoutTimeoutMs,
          });
        },
      });
    },
  });
}

/** Fix all security stores at the application root before routes can use them. */
export function createBoundMinimumLoginAdmission(
  captcha: CaptchaGate,
  policy: MinimumLoginAdmissionPolicy,
  dependencies: BoundMinimumLoginDependencies | null,
): BoundMinimumLoginAdmission {
  const admission = createMinimumLoginAdmission(captcha, policy);
  if (dependencies === null)
    return Object.freeze({
      require: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
    });
  const provider = dependencies?.provider;
  const rateStore = dependencies?.rateStore;
  const lockoutStore = dependencies?.lockoutStore;
  const clientAddress = dependencies?.clientAddress;
  if (
    typeof provider?.active !== 'function' ||
    typeof rateStore?.increment !== 'function' ||
    typeof rateStore?.purgeExpired !== 'function' ||
    typeof lockoutStore?.get !== 'function' ||
    typeof lockoutStore?.recordFailure !== 'function' ||
    typeof lockoutStore?.clear !== 'function' ||
    typeof lockoutStore?.purgeExpired !== 'function' ||
    (clientAddress !== undefined && typeof clientAddress !== 'function')
  )
    throw new Error('Invalid minimum login dependencies');
  return Object.freeze({
    require: async (intent: BoundMinimumLoginIntent) => {
      try {
        if (!intent?.request || !Array.isArray(intent.checks))
          throw new Error('Missing trusted request');
        const needsIp = intent.checks.some(
          (check) => check?.dimension === 'ip',
        );
        if (needsIp && !clientAddress)
          throw new Error('Client address unavailable');
        const ip = needsIp ? clientAddress!(intent.request) : null;
        const checks = intent.checks.map((check) =>
          check?.dimension === 'ip'
            ? { ...check, canonicalSubject: ip! }
            : check,
        );
        return admission.require({
          ...intent,
          checks,
          provider,
          rateStore,
          lockoutStore,
        });
      } catch {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      }
    },
  });
}
