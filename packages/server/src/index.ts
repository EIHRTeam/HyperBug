import { Elysia, t } from 'elysia';
import type { ElysiaAdapter } from 'elysia/adapter';
import {
  assertDeploymentAvailable,
  type RuntimeConfig,
} from '@hyperbug/config';
import type { Telemetry, RouteLabel } from '@hyperbug/observability';
import {
  HealthSchema,
  ReadinessSchema,
  RegistrationAcceptedSchema,
  RegistrationChallengeSchema,
  RegistrationRequestSchema,
  LoginRequestSchema,
  LoginChallengeSchema,
  AccountSessionSchema,
  BootstrapEnrollRequestSchema,
  BootstrapEnrolledSchema,
  type RegistrationRequest,
  type RegistrationAccepted,
  type RegistrationChallenge,
  type ReadinessResponse,
  type LoginRequest,
  type LoginChallenge,
  type AccountSession,
  type BootstrapEnrollRequest,
  type BootstrapEnrolled,
} from '@hyperbug/contracts';
import type {
  AccountPasswordStore,
  AccountRegistrationStore,
  AccountSessionStore,
  StaffEnrollmentStore,
} from '@hyperbug/application';
import { readBoundedJson, RequestFailure, withDeadline } from './bounds.ts';
import { publicFailure } from './errors.ts';
import { assertQueryBounds } from './input.ts';
import { corsPolicy } from './cors.ts';
import { createCaptchaGate, type CaptchaGate } from './captcha.ts';
import {
  createBoundSensitiveActionAdmission,
  type SensitiveAdmissionDependencies,
} from './sensitive-admission.ts';
import type { BoundMinimumLoginAdmission } from './minimum-login-admission.ts';
import { registerAccount } from './account-registration.ts';
import { loginAccount } from './account-login.ts';
import { enrollInitialStaff } from './bootstrap-enrollment.ts';
import {
  clearedSessionCookie,
  currentAccountSession,
  requireAuthOrigin,
  requireAuthReadOrigin,
  revokeAccountSession,
} from './account-session.ts';
import {
  CryptoFailure,
  type KeyProvider,
  type StandardPasswordService,
} from '@hyperbug/security';

export interface AppOptions {
  adapter: ElysiaAdapter;
  config: RuntimeConfig;
  telemetry: Telemetry;
  ready: (signal: AbortSignal) => Promise<boolean>;
  onRejectedRequest?: (request: Request) => void;
  captcha?: CaptchaGate;
  /** Public widget key selected by the root, never the verifier secret. */
  captchaSiteKey?: string | null;
  abuse?: SensitiveAdmissionDependencies | null;
  keyProvider?: KeyProvider | null;
  standardPassword?: StandardPasswordService | null;
  registrationStore?: AccountRegistrationStore | null;
  passwordStore?: AccountPasswordStore | null;
  sessionStore?: AccountSessionStore | null;
  /** Operator-channel one-time enrollment code; null disarms the route. */
  bootstrapCode?: string | null;
  staffEnrollmentStore?: StaffEnrollmentStore | null;
  /** Reports pending enrollment for readiness; null or failure omits the field. */
  bootstrapState?: (() => Promise<boolean>) | null;
  minimumLoginAdmission?: BoundMinimumLoginAdmission | null;
}

const unavailableKeyProvider: KeyProvider = Object.freeze({
  current: async () => {
    throw new CryptoFailure();
  },
  get: async () => {
    throw new CryptoFailure();
  },
  readable: async () => {
    throw new CryptoFailure();
  },
});

const unavailableMinimumLoginAdmission: BoundMinimumLoginAdmission =
  Object.freeze({
    require: async () => {
      throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    },
  });

interface BoundaryHeaders {
  readonly requestId: string;
  readonly cors: Readonly<Record<string, string>>;
}

function protectedHeader(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized.startsWith('access-control-') ||
    normalized === 'cache-control' ||
    normalized === 'vary' ||
    normalized === 'x-request-id' ||
    normalized === 'x-content-type-options'
  );
}

function boundaryValues(boundary: BoundaryHeaders): Record<string, string> {
  return {
    'x-request-id': boundary.requestId,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...boundary.cors,
  };
}

function enforceSetHeaders(
  headers: Record<string, string | number>,
  boundary: BoundaryHeaders,
): void {
  for (const name of Object.keys(headers)) {
    if (protectedHeader(name)) delete headers[name];
  }
  Object.assign(headers, boundaryValues(boundary));
}

function enforceResponseHeaders(
  response: Response,
  boundary: BoundaryHeaders,
): Response {
  const repair = (headers: Headers) => {
    for (const name of Array.from(headers.keys())) {
      if (protectedHeader(name)) headers.delete(name);
    }
    for (const [name, value] of Object.entries(boundaryValues(boundary)))
      headers.set(name, value);
  };
  try {
    repair(response.headers);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    repair(headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export function createApp({
  adapter,
  config,
  telemetry,
  ready,
  onRejectedRequest,
  captcha,
  captchaSiteKey,
  abuse,
  keyProvider,
  standardPassword,
  registrationStore,
  passwordStore,
  sessionStore,
  bootstrapCode = null,
  staffEnrollmentStore = null,
  bootstrapState = null,
  minimumLoginAdmission,
}: AppOptions) {
  assertDeploymentAvailable(config.deployment);
  const deployment = Object.freeze({
    tier: config.deployment.tier,
    degradationIds: Object.freeze([...config.deployment.degradationIds]),
    passwordHashPolicy: config.deployment.requiredPasswordAlgorithm,
  });
  const readiness = (
    status: ReadinessResponse['status'],
    pending?: boolean,
  ): ReadinessResponse => ({
    status,
    deployment: {
      ...deployment,
      degradationIds: [...deployment.degradationIds],
      ...(pending === undefined ? {} : { bootstrapPending: pending }),
    },
  });
  const starts = new WeakMap<Request, number>();
  const boundaries = new WeakMap<Request, BoundaryHeaders>();
  const captchaGate = captcha ?? createCaptchaGate();
  const boundSensitiveAdmission = createBoundSensitiveActionAdmission(
    captchaGate,
    abuse ?? null,
  );
  if (
    minimumLoginAdmission != null &&
    typeof minimumLoginAdmission.require !== 'function'
  )
    throw new Error('Invalid minimum login admission');
  if (
    captchaSiteKey != null &&
    (!captchaGate.enabled ||
      typeof captchaSiteKey !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,512}$/.test(captchaSiteKey))
  )
    throw new Error('Invalid public CAPTCHA configuration');
  const publicCaptchaSiteKey = captchaSiteKey ?? null;
  const boundaryFor = (request: Request): BoundaryHeaders => {
    const existing = boundaries.get(request);
    if (existing) return existing;
    const fallback = {
      requestId: crypto.randomUUID(),
      cors: { vary: 'Origin' },
    };
    boundaries.set(request, fallback);
    return fallback;
  };
  const observeRequest = (request: Request, status: number): void => {
    const path = new URL(request.url).pathname;
    const label: RouteLabel =
      path === '/api/v1/accounts/register' &&
      (request.method === 'GET' || request.method === 'POST')
        ? 'account.register'
        : path === '/auth/login' &&
            (request.method === 'GET' || request.method === 'POST')
          ? 'account.login'
          : path === '/auth/session' && request.method === 'GET'
            ? 'account.session'
            : path === '/auth/logout' && request.method === 'POST'
              ? 'account.logout'
              : path === '/auth/bootstrap/enroll' && request.method === 'POST'
                ? 'account.bootstrap'
                : path === '/health/live' && request.method === 'GET'
                  ? 'health.live'
                  : path === '/health/ready' && request.method === 'GET'
                    ? 'health.ready'
                    : path.startsWith('/_proof')
                      ? 'proof'
                      : 'unmatched';
    try {
      telemetry.request({
        requestId: boundaryFor(request).requestId,
        route: label,
        status,
        durationMs:
          performance.now() - (starts.get(request) ?? performance.now()),
      });
    } catch {
      /* Diagnostic transport failure cannot alter an HTTP response. */
    }
  };
  return new Elysia({ adapter, aot: true, normalize: false })
    .decorate('captcha', captchaGate)
    .decorate('captchaSiteKey', publicCaptchaSiteKey)
    .decorate('keyProvider', keyProvider ?? unavailableKeyProvider)
    .decorate('sensitiveAdmission', boundSensitiveAdmission)
    .decorate('standardPassword', standardPassword ?? null)
    .decorate(
      'minimumLoginAdmission',
      minimumLoginAdmission ?? unavailableMinimumLoginAdmission,
    )
    .onRequest(async ({ request, set }) => {
      starts.set(request, performance.now());
      const requestId = crypto.randomUUID();
      boundaries.set(request, { requestId, cors: { vary: 'Origin' } });
      enforceSetHeaders(set.headers, boundaryFor(request));
      const cors = corsPolicy(request, config.allowedOrigins);
      boundaries.set(request, { requestId, cors: { ...cors.headers } });
      enforceSetHeaders(set.headers, boundaryFor(request));
      assertQueryBounds(request, config.security.input);
      const length = request.headers.get('content-length');
      if (
        length !== null &&
        (!/^\d+$/.test(length) || Number(length) > config.maxBodyBytes)
      ) {
        throw new RequestFailure('BODY_TOO_LARGE');
      }
      if (cors.preflight) {
        set.status = 204;
        return new Response(null, { status: 204 });
      }
      const path = new URL(request.url).pathname;
      if (
        request.method === 'POST' &&
        (path === '/auth/login' ||
          path === '/auth/logout' ||
          path === '/auth/bootstrap/enroll')
      )
        requireAuthOrigin(request);
      if (request.method === 'GET' && path === '/auth/session')
        requireAuthReadOrigin(request);
      if (request.method === 'POST' && path === '/api/v1/accounts/register')
        await boundSensitiveAdmission.preparseRegistration(request);
      if (request.method === 'POST' && path === '/auth/login')
        await boundSensitiveAdmission.preparseLogin(request);
      if (request.method === 'GET' && path === '/auth/session')
        await boundSensitiveAdmission.preparseSession(request);
      if (request.method === 'POST' && path === '/auth/logout')
        await boundSensitiveAdmission.preparseLogout(request);
    })
    .onParse(async ({ request, contentType }) => {
      if (contentType !== 'application/json')
        throw new RequestFailure('UNSUPPORTED_MEDIA_TYPE');
      return readBoundedJson(
        request,
        config.maxBodyBytes,
        config.requestTimeoutMs,
        config.security.input,
      );
    })
    .onError(({ code, error, set, request }) => {
      const failure = publicFailure(error, code);
      set.status = failure.status;
      enforceSetHeaders(set.headers, boundaryFor(request));
      if ('retryAfterSeconds' in failure)
        set.headers['retry-after'] = String(failure.retryAfterSeconds);
      try {
        onRejectedRequest?.(request);
      } catch {
        /* Transport cleanup failure must still return the safe denied response. */
      }
      try {
        const component =
          failure.code === 'RATE_LIMITED' ||
          failure.code === 'RATE_LIMIT_UNAVAILABLE'
            ? 'rate'
            : failure.code === 'CAPTCHA_DENIED' ||
                failure.code === 'CAPTCHA_UNAVAILABLE'
              ? 'captcha'
              : 'request';
        telemetry.security?.({
          requestId: String(set.headers['x-request-id']),
          component,
          outcome:
            failure.status >= 500
              ? 'unavailable'
              : failure.status === 401 ||
                  failure.status === 403 ||
                  failure.status === 429
                ? 'denied'
                : 'invalid',
        });
      } catch {
        /* Diagnostic transport failure does not turn a denied request into success. */
      }
      observeRequest(request, failure.status);
      return {
        error: {
          code: failure.code,
          message: failure.message,
          requestId: set.headers['x-request-id'],
        },
      };
    })
    .onAfterHandle(({ request, response, set }) => {
      const boundary = boundaryFor(request);
      // A native Response or handler-modified set can override request-time
      // security headers. Reapply only the server's trusted policy snapshot.
      enforceSetHeaders(set.headers, boundary);
      observeRequest(
        request,
        typeof set.status === 'number'
          ? set.status
          : response instanceof Response
            ? response.status
            : 200,
      );
      if (response instanceof Response)
        return enforceResponseHeaders(response, boundary);
    })
    .get('/health/live', () => ({ status: 'ok' as const }), {
      response: t.Unsafe<{ status: 'ok' | 'unavailable' }>(HealthSchema),
    })
    .get(
      '/health/ready',
      async ({ request, set }) => {
        try {
          const available = await withDeadline(
            request.signal,
            config.requestTimeoutMs,
            ready,
          );
          if (available) {
            let pending: boolean | undefined;
            if (bootstrapState && !request.signal.aborted) {
              try {
                pending = await withDeadline(
                  request.signal,
                  1000,
                  bootstrapState,
                );
              } catch {
                /* A failed state probe omits the field, never fails readiness. */
              }
            }
            return readiness('ok', pending);
          }
        } catch {
          /* Health responses intentionally hide dependency details. */
        }
        set.status = 503;
        return readiness('unavailable');
      },
      {
        response: {
          200: t.Unsafe<ReadinessResponse>(ReadinessSchema),
          503: t.Unsafe<ReadinessResponse>(ReadinessSchema),
        },
      },
    )
    .get(
      '/api/v1/accounts/register',
      (): RegistrationChallenge => ({
        captchaRequired: captchaGate.enabled,
        captchaSiteKey: publicCaptchaSiteKey,
        captchaAction: 'register',
      }),
      {
        response: t.Unsafe<RegistrationChallenge>(RegistrationChallengeSchema),
      },
    )
    .post(
      '/api/v1/accounts/register',
      async ({
        request,
        body,
        set,
        sensitiveAdmission,
        standardPassword: passwordService,
      }) => {
        const result = await registerAccount({
          request,
          body,
          admission: sensitiveAdmission,
          password: passwordService,
          requestId: boundaryFor(request).requestId,
          store: registrationStore ?? null,
        });
        set.status = 202;
        return result;
      },
      {
        body: t.Unsafe<RegistrationRequest>(RegistrationRequestSchema),
        response: {
          202: t.Unsafe<RegistrationAccepted>(RegistrationAcceptedSchema),
        },
      },
    )
    .get(
      '/auth/login',
      (): LoginChallenge => ({
        captchaRequired: captchaGate.enabled,
        captchaSiteKey: publicCaptchaSiteKey,
        captchaAction: 'login',
      }),
      { response: t.Unsafe<LoginChallenge>(LoginChallengeSchema) },
    )
    .post(
      '/auth/login',
      async ({ request, body, set, sensitiveAdmission }) => {
        const cookie = await loginAccount({
          request,
          body,
          admission: sensitiveAdmission,
          requestId: boundaryFor(request).requestId,
          passwordService: standardPassword ?? null,
          passwordStore: passwordStore ?? null,
          keyProvider: keyProvider ?? null,
          sessionStore: sessionStore ?? null,
        });
        set.headers['set-cookie'] = cookie;
        return { authenticated: true as const };
      },
      {
        body: t.Unsafe<LoginRequest>(LoginRequestSchema),
        response: t.Unsafe<AccountSession>(AccountSessionSchema),
      },
    )
    .get(
      '/auth/session',
      async ({ request }) => {
        const principalId = await currentAccountSession({
          request,
          provider: keyProvider ?? null,
          store: sessionStore ?? null,
          nowMs: Date.now(),
        });
        if (!principalId) throw new RequestFailure('LOGIN_DENIED');
        return { authenticated: true as const };
      },
      { response: t.Unsafe<AccountSession>(AccountSessionSchema) },
    )
    .post(
      '/auth/logout',
      async ({ request, set }) => {
        await revokeAccountSession({
          request,
          provider: keyProvider ?? null,
          store: sessionStore ?? null,
          nowMs: Date.now(),
        });
        set.headers['set-cookie'] = clearedSessionCookie;
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/auth/bootstrap/enroll',
      async ({ request, body, set, sensitiveAdmission }) => {
        const result = await enrollInitialStaff({
          request,
          body,
          admission: sensitiveAdmission,
          password: standardPassword ?? null,
          code: bootstrapCode,
          store: staffEnrollmentStore,
          requestId: boundaryFor(request).requestId,
        });
        set.status = 201;
        return result;
      },
      {
        body: t.Unsafe<BootstrapEnrollRequest>(BootstrapEnrollRequestSchema),
        response: { 201: t.Unsafe<BootstrapEnrolled>(BootstrapEnrolledSchema) },
      },
    );
}

export { RequestFailure, withDeadline } from './bounds.ts';
export { verifyAccountPassword } from './account-password.ts';
export { parseBootstrapEnrollmentCode } from './bootstrap-enrollment.ts';
export type { VerifiedAccountPassword } from './account-password.ts';
export { requireSensitiveRateAdmission } from './rate-admission.ts';
export {
  requireAccountLockoutAdmission,
  requireAccountLockoutFailureRecorded,
  requireAccountLockoutCleared,
} from './account-lockout.ts';
export { createSensitiveActionAdmission } from './sensitive-admission.ts';
export { createBoundSensitiveActionAdmission } from './sensitive-admission.ts';
export type { SensitiveAdmissionDependencies } from './sensitive-admission.ts';
export { createBoundMinimumLoginAdmission } from './minimum-login-admission.ts';
export type {
  BoundMinimumLoginAdmission,
  BoundMinimumLoginDependencies,
  BoundMinimumLoginIntent,
  MinimumLoginAdmissionPolicy,
  MinimumLoginPermit,
} from './minimum-login-admission.ts';
export { requireAuthorizedAction } from './authorization.ts';
export { createCaptchaGate, requireRequiredCaptcha } from './captcha.ts';
export {
  configureOptionalTurnstile,
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from './turnstile.ts';
