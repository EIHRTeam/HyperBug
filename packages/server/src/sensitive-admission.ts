import type {
  AbuseKeyProvider,
  CanonicalRateCheck,
  RateCategory,
  RateCounterStore,
  VolumetricLimiter,
} from '@hyperbug/security';
import { activeAbuseSubjects, canonicalIpAddress } from '@hyperbug/security';
import type { CaptchaGate } from './captcha.ts';
import {
  requireSensitiveRateAdmission,
  type SensitiveAdmissionIntent,
} from './rate-admission.ts';
import { RequestFailure } from './errors.ts';
import { withDeadline } from './bounds.ts';

export interface SensitiveActionIntent extends SensitiveAdmissionIntent {
  readonly captchaAction: string;
  readonly captchaToken?: string | null;
}

export interface SensitiveActionAdmission {
  require(intent: SensitiveActionIntent): Promise<void>;
}

export interface SensitiveAdmissionDependencies {
  readonly provider: AbuseKeyProvider;
  readonly store: RateCounterStore;
  readonly limiter?: VolumetricLimiter;
  /** Root-owned trusted client address; omit when provenance is unavailable. */
  readonly clientAddress?: (request: Request) => string | Promise<string>;
}

export type BoundRateCheck =
  | (Omit<CanonicalRateCheck, 'dimension' | 'canonicalSubject'> & {
      readonly dimension: 'ip';
      /** Ignored; the application root supplies the actual IP. */
      readonly canonicalSubject?: string;
    })
  | (CanonicalRateCheck & {
      readonly dimension: Exclude<CanonicalRateCheck['dimension'], 'ip'>;
    });

export type BoundSensitiveActionIntent = Omit<
  SensitiveActionIntent,
  'provider' | 'store' | 'limiter' | 'checks'
> & { readonly request: Request; readonly checks: readonly BoundRateCheck[] };

export interface BoundSensitiveActionAdmission {
  require(intent: BoundSensitiveActionIntent): Promise<void>;
  /** Shed registration requests before JSON parsing, using only trusted IP. */
  preparseRegistration(request: Request): Promise<void>;
  /** Shed login requests before JSON parsing, using only trusted IP. */
  preparseLogin(request: Request): Promise<void>;
  /** Bound cookie validation before any primary session read. */
  preparseSession(request: Request): Promise<void>;
  /** Bound cookie revocation before parsing or primary session work. */
  preparseLogout(request: Request): Promise<void>;
}

/** Rate admission is always authoritative; a configured CAPTCHA follows it. */
export function createSensitiveActionAdmission(
  captcha: CaptchaGate,
): SensitiveActionAdmission {
  if (
    !captcha ||
    typeof captcha.enabled !== 'boolean' ||
    typeof captcha.require !== 'function'
  )
    throw new Error('Invalid CAPTCHA admission gate');
  const requireCaptcha = captcha.require.bind(captcha);
  return Object.freeze({
    async require(intent: SensitiveActionIntent): Promise<void> {
      const signal = intent?.signal;
      const captchaToken = intent?.captchaToken ?? null;
      const captchaAction = intent?.captchaAction;
      await requireSensitiveRateAdmission(intent);
      await requireCaptcha({
        token: captchaToken,
        expectedAction: captchaAction,
        signal,
      });
      if (!signal || signal.aborted)
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    },
  });
}

/** App routes receive only root-selected sources; a missing source denies. */
export function createBoundSensitiveActionAdmission(
  captcha: CaptchaGate,
  dependencies: SensitiveAdmissionDependencies | null,
): BoundSensitiveActionAdmission {
  const admission = createSensitiveActionAdmission(captcha);
  if (dependencies === null)
    return Object.freeze({
      require: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
      preparseRegistration: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
      preparseLogin: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
      preparseSession: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
      preparseLogout: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
    });
  const provider = dependencies?.provider;
  const store = dependencies?.store;
  const limiter = dependencies?.limiter;
  const clientAddress = dependencies?.clientAddress;
  if (
    typeof provider?.active !== 'function' ||
    typeof store?.increment !== 'function' ||
    typeof store?.purgeExpired !== 'function' ||
    (limiter !== undefined && typeof limiter?.consume !== 'function') ||
    (clientAddress !== undefined && typeof clientAddress !== 'function')
  )
    throw new Error('Invalid sensitive admission dependencies');
  const preparse = async (
    request: Request,
    category: RateCategory,
    route: string,
  ): Promise<void> => {
    if (!request || !clientAddress || !limiter)
      throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    let decision: Awaited<ReturnType<VolumetricLimiter['consume']>>;
    try {
      decision = await withDeadline(request.signal, 1000, async (signal) => {
        const address = canonicalIpAddress(await clientAddress(request));
        // A separate route/IP bucket keeps login and registration from
        // consuming the ordinary IP approximate bucket twice. Their primary
        // account/IP counters still run after parsing on every valid request.
        const subjects = await activeAbuseSubjects(
          provider,
          category,
          'route',
          `${route}|${address}`,
          signal,
        );
        if (signal.aborted) throw new Error('Aborted admission');
        const outcome = await limiter.consume(subjects[0]!.digest, Date.now());
        if (signal.aborted) throw new Error('Aborted admission');
        return outcome;
      });
    } catch {
      throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    }
    if (decision?.allowed === true && !('reason' in decision)) return;
    if (decision?.allowed === false && decision.reason === 'limited')
      throw new RequestFailure('RATE_LIMITED');
    throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
  };
  return Object.freeze({
    preparseRegistration: (request: Request) =>
      preparse(request, 'registration', '/api/v1/accounts/register'),
    preparseLogin: (request: Request) =>
      preparse(request, 'login', '/auth/login'),
    preparseSession: (request: Request) =>
      preparse(request, 'login', '/auth/session'),
    preparseLogout: (request: Request) =>
      preparse(request, 'login', '/auth/logout'),
    require: async (intent: BoundSensitiveActionIntent) => {
      try {
        if (!intent?.request || !Array.isArray(intent.checks))
          throw new Error('Missing trusted request');
        const needsIp = intent.checks.some(
          (check) => check?.dimension === 'ip',
        );
        if (needsIp && !clientAddress)
          throw new Error('Client address unavailable');
        if (
          needsIp &&
          (!Number.isSafeInteger(intent.timeoutMs) ||
            intent.timeoutMs < 10 ||
            intent.timeoutMs > 5000)
        )
          throw new Error('Invalid address deadline');
        const ip = needsIp
          ? await withDeadline(intent.signal, intent.timeoutMs, () =>
              Promise.resolve(clientAddress!(intent.request)),
            )
          : null;
        const checks = intent.checks.map((check) =>
          check?.dimension === 'ip'
            ? { ...check, canonicalSubject: ip! }
            : check,
        );
        return admission.require({
          ...intent,
          checks,
          provider,
          store,
          ...(limiter !== undefined ? { limiter } : {}),
        });
      } catch {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      }
    },
  });
}
