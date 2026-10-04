import type {
  AbuseKeyProvider,
  ActiveAbuseKey,
  AuditEvent,
  CanonicalRateCheck,
  RateCategory,
  RateCounterStore,
  VolumetricLimiter,
} from '@hyperbug/security';
import { auditEvent } from '@hyperbug/security';
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
  /** Correlates an audited provider outage with the denied request. */
  readonly requestId?: string | null;
}

export interface SensitiveActionAdmission {
  require(intent: SensitiveActionIntent): Promise<void>;
}

/** Append-only audit sink shared by every audited server policy. */
export type AuditAppend = (
  event: AuditEvent,
  signal: AbortSignal,
) => Promise<void>;

export interface SensitiveAdmissionDependencies {
  readonly provider: AbuseKeyProvider;
  readonly store: RateCounterStore;
  readonly limiter?: VolumetricLimiter;
  /** Root-owned trusted client address; omit when provenance is unavailable. */
  readonly clientAddress?: (request: Request) => string | Promise<string>;
  /** Append-only audit sink for the audited provider-outage policy. */
  readonly auditAppend?: AuditAppend | null;
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
  /** Rate admission without a CAPTCHA leg: authenticated route classes. */
  requireRate(
    intent: Omit<BoundSensitiveActionIntent, 'captchaAction'>,
  ): Promise<void>;
  /** Shed registration requests before JSON parsing, using only trusted IP. */
  preparseRegistration(request: Request): Promise<void>;
  /** Shed login requests before JSON parsing, using only trusted IP. */
  preparseLogin(request: Request): Promise<void>;
  /** Bound cookie validation before any primary session read. */
  preparseSession(request: Request): Promise<void>;
  /** Bound cookie revocation before parsing or primary session work. */
  preparseLogout(request: Request): Promise<void>;
}

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Rate admission is always authoritative; a configured CAPTCHA follows it. */
export function createSensitiveActionAdmission(
  captcha: CaptchaGate,
  auditAppend?: SensitiveAdmissionDependencies['auditAppend'],
): SensitiveActionAdmission {
  if (
    !captcha ||
    typeof captcha.enabled !== 'boolean' ||
    typeof captcha.require !== 'function'
  )
    throw new Error('Invalid CAPTCHA admission gate');
  if (
    auditAppend !== undefined &&
    auditAppend !== null &&
    typeof auditAppend !== 'function'
  )
    throw new Error('Invalid audit admission sink');
  const requireCaptcha = captcha.require.bind(captcha);
  return Object.freeze({
    async require(intent: SensitiveActionIntent): Promise<void> {
      const signal = intent?.signal;
      const captchaToken = intent?.captchaToken ?? null;
      const captchaAction = intent?.captchaAction;
      await requireSensitiveRateAdmission(intent);
      try {
        await requireCaptcha({
          token: captchaToken,
          expectedAction: captchaAction,
          signal,
        });
      } catch (error) {
        // Audited provider-outage policy: a configured provider that cannot
        // be verified is recorded; the denial itself never depends on the
        // audit write succeeding.
        if (
          captcha.enabled &&
          error instanceof RequestFailure &&
          error.code === 'CAPTCHA_UNAVAILABLE' &&
          auditAppend
        ) {
          const requestId =
            typeof intent?.requestId === 'string' &&
            requestIdPattern.test(intent.requestId)
              ? intent.requestId
              : crypto.randomUUID();
          try {
            await withDeadline(
              signal ?? new AbortController().signal,
              1000,
              (bound) =>
                auditAppend(
                  auditEvent({
                    id: crypto.randomUUID(),
                    projectId: null,
                    actorId: null,
                    systemActor: 'core.admission',
                    action: 'provider.outage',
                    targetId: JSON.stringify(['turnstile', captchaAction]),
                    result: 'failure',
                    requestId,
                    createdAt: Date.now(),
                    metadata: { v: 1, outcome: 'unavailable' },
                  }),
                  bound,
                ),
            );
          } catch {
            /* An audit failure cannot soften a fail-closed denial. */
          }
        }
        throw error;
      }
      if (!signal || signal.aborted)
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    },
  });
}

/** App routes receive only root-selected sources; a missing source denies. */
const admissionRings = new WeakMap<
  AbuseKeyProvider,
  WeakMap<Request, Promise<readonly ActiveAbuseKey[]>>
>();
export function scopeAdmissionAbuseKeys(
  provider: AbuseKeyProvider,
  request: Request,
): AbuseKeyProvider {
  let requestRings = admissionRings.get(provider);
  if (!requestRings) {
    requestRings = new WeakMap();
    admissionRings.set(provider, requestRings);
  }
  const rings = requestRings;
  return {
    active: async (signal) => {
      if (signal.aborted) throw new Error('Aborted admission');
      let keys = rings.get(request);
      if (!keys) {
        keys = provider.active(signal);
        rings.set(request, keys);
      }
      const ring = await keys;
      if (signal.aborted || request.signal.aborted)
        throw new Error('Aborted admission');
      return ring;
    },
  };
}

export function createBoundSensitiveActionAdmission(
  captcha: CaptchaGate,
  dependencies: SensitiveAdmissionDependencies | null,
): BoundSensitiveActionAdmission {
  const admission = createSensitiveActionAdmission(
    captcha,
    dependencies?.auditAppend,
  );
  if (dependencies === null)
    return Object.freeze({
      require: async () => {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      },
      requireRate: async () => {
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
  const requestProvider = (request: Request) =>
    scopeAdmissionAbuseKeys(provider, request);
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
          requestProvider(request),
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
    requireRate: async (
      intent: Omit<BoundSensitiveActionIntent, 'captchaAction'>,
    ) => {
      try {
        if (!intent?.request || !Array.isArray(intent.checks))
          throw new Error('Missing trusted request');
        const needsIp = intent.checks.some(
          (check) => check?.dimension === 'ip',
        );
        if (needsIp && !clientAddress)
          throw new Error('Client address unavailable');
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
        await requireSensitiveRateAdmission({
          provider: requestProvider(intent.request),
          store,
          ...(limiter !== undefined ? { limiter } : {}),
          category: intent.category,
          checks,
          nowMs: intent.nowMs,
          signal: intent.signal,
          timeoutMs: intent.timeoutMs,
        });
      } catch (error) {
        if (error instanceof RequestFailure) throw error;
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      }
    },
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
          provider: requestProvider(intent.request),
          store,
          ...(limiter !== undefined ? { limiter } : {}),
        });
      } catch {
        throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
      }
    },
  });
}
