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
  InstanceDocumentSchema,
  RegistrationAcceptedSchema,
  RegistrationChallengeSchema,
  RegistrationRequestSchema,
  LoginRequestSchema,
  LoginChallengeSchema,
  AccountSessionSchema,
  AccountDocumentSchema,
  BootstrapEnrollRequestSchema,
  BootstrapEnrolledSchema,
  RecoveryCodesSchema,
  RecoveryRequestSchema,
  RecoveredSchema,
  AuthorizeRequestSchema,
  AuthorizeResponseSchema,
  TokenResponseSchema,
  AccountSessionsSchema,
  PrincipalStatusSchema,
  ProjectMemberRoleRequestSchema,
  ProjectMemberRoleSchema,
  type RegistrationRequest,
  type RegistrationAccepted,
  type RegistrationChallenge,
  type ReadinessResponse,
  type LoginRequest,
  type LoginChallenge,
  type AccountSession,
  type AccountDocument,
  type InstanceDocument,
  type BootstrapEnrollRequest,
  type BootstrapEnrolled,
  type RecoveryCodes,
  type RecoveryRequest,
  type Recovered,
  type AuthorizeRequest,
  type AuthorizeResponse,
  type TokenResponse,
  type AccountSessions,
  type PrincipalStatus,
  type ProjectMemberRole,
  type ProjectMemberRoleRequest,
} from '@hyperbug/contracts';
import type {
  AccountAdministrationStore,
  AccountPasswordStore,
  AccountRecoveryStore,
  AccountRegistrationStore,
  AccountSessionStore,
  OAuthAccessTokenStore,
  OAuthCodeStore,
  ProjectRoleStore,
  StaffEnrollmentStore,
} from '@hyperbug/application';
import {
  readBoundedForm,
  readBoundedJson,
  RequestFailure,
  withDeadline,
} from './bounds.ts';
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
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegistrationOptions,
  passkeyRegistrationVerify,
  type PasskeyRelyingParty,
} from './passkey.ts';
import {
  generateAccountRecoveryCodes,
  recoverAccount,
} from './account-recovery.ts';
import {
  authorizeConsentPage,
  authorizeErrorPage,
  authorizeLoginPage,
  type AuthorizeQuery,
} from './authorize-pages.ts';
import {
  exchangeAuthorizationCode,
  issueAuthorizationCode,
  issueCodeForSession,
  revokeAccessToken,
  validateAuthorizeQuery,
  type OAuthClientRegistration,
} from './oauth.ts';
import { authenticateBearer } from './bearer-auth.ts';
import { requireAuthorizedAction } from './authorization.ts';
import {
  authorizationPolicy,
  createDbAuthorizationResolver,
} from './authorization-facts.ts';
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
  recoveryStore?: AccountRecoveryStore | null;
  /** Relying-party configuration; null disarms every passkey route. */
  passkey?: PasskeyRelyingParty | null;
  /** Registered public clients; an empty list disarms the code flow. */
  oauthClients?: readonly OAuthClientRegistration[] | null;
  /** Authorization-code and access-token persistence for the code flow and
   * bearer-authenticated business reads. */
  oauthCodeStore?: (OAuthCodeStore & OAuthAccessTokenStore) | null;
  /** Staff project-role persistence for membership management. */
  projectRoleStore?: ProjectRoleStore | null;
  /** Principal/project directory and staff account administration. */
  accountAdministration?: AccountAdministrationStore | null;
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
  recoveryStore = null,
  passkey = null,
  oauthClients = [],
  oauthCodeStore = null,
  projectRoleStore = null,
  accountAdministration = null,
  bootstrapState = null,
  minimumLoginAdmission,
}: AppOptions) {
  assertDeploymentAvailable(config.deployment);
  const deployment = Object.freeze({
    tier: config.deployment.tier,
    degradationIds: Object.freeze([...config.deployment.degradationIds]),
    passwordHashPolicy: config.deployment.requiredPasswordAlgorithm,
  });
  // Password capabilities are advertised only under the standard algorithm:
  // the minimum tier's floor-disabled login must not present itself as usable.
  const passwordCapable =
    standardPassword != null && deployment.passwordHashPolicy === 'argon2id';
  const instanceDocument: InstanceDocument = Object.freeze({
    tier: deployment.tier,
    degradationIds: [...deployment.degradationIds],
    passwordHashPolicy: {
      algorithm: deployment.passwordHashPolicy,
      downgraded: deployment.passwordHashPolicy !== 'argon2id',
    },
    authentication: {
      passwordRegistration: passwordCapable,
      passwordLogin: passwordCapable,
      recoveryCodes: passwordCapable,
      passkeys: passkey != null,
      administratorAssistedRecovery: staffEnrollmentStore != null,
    },
    limits: {
      documented: 'docs/FREE-TIER-PROFILE.md#capacity-ceilings-and-quotas',
    },
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
  const authorizeQueryFrom = (
    fields: Record<string, unknown>,
  ): AuthorizeQuery | null => {
    const value = (name: (typeof oauthQueryFields)[number]): string | null => {
      const raw = fields[name];
      return typeof raw === 'string' && raw.length >= 1 && raw.length <= 2048
        ? raw
        : null;
    };
    const query = {
      response_type: value('response_type'),
      client_id: value('client_id'),
      redirect_uri: value('redirect_uri'),
      scope: value('scope'),
      state: value('state'),
      code_challenge: value('code_challenge'),
      code_challenge_method: value('code_challenge_method'),
    };
    for (const field of Object.values(query)) if (field === null) return null;
    return query as AuthorizeQuery;
  };
  const starts = new WeakMap<Request, number>();
  const boundaries = new WeakMap<Request, BoundaryHeaders>();
  const oauthQueryFields = [
    'response_type',
    'client_id',
    'redirect_uri',
    'scope',
    'state',
    'code_challenge',
    'code_challenge_method',
  ] as const;
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
  // Registered clients without their session/key prerequisites would arm a
  // code flow that fails closed on every request; refuse startup instead.
  const registeredClients = oauthClients ?? [];
  if (registeredClients.length > 0 && (!oauthCodeStore || !keyProvider))
    throw new Error('Invalid OAuth client configuration');
  const publicCaptchaSiteKey = captchaSiteKey ?? null;
  const administration = accountAdministration;
  const roleStore = projectRoleStore;
  // The resolver binds the authorization-facts loaders to the staff role
  // store; either side missing disarms every guarded management route.
  const authorizationResolver =
    administration && roleStore
      ? createDbAuthorizationResolver({
          loadPrincipal: (principalId) =>
            administration.loadPrincipal(principalId),
          loadProject: (projectId) => administration.loadProject(projectId),
          tokenIssuedAtMs: (principalId) =>
            administration.tokenIssuedAtMs(principalId),
          loadMembership: (projectId, principalId) =>
            roleStore.loadRole(projectId, principalId),
        })
      : null;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const canonicalInstant = (ms: number): string => new Date(ms).toISOString();
  // A suspended or deleted principal denies like any other invalid bearer
  // credential; the kind lookup is shared by the account-session routes.
  const requireActivePrincipalKind = async (
    request: Request,
    principalId: string,
  ): Promise<'user' | 'staff'> => {
    let kind: 'user' | 'staff' | null;
    try {
      kind = await withDeadline(request.signal, 1000, () =>
        oauthCodeStore!.loadPrincipalKind(principalId),
      );
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
    }
    if (kind !== 'user' && kind !== 'staff')
      throw new RequestFailure('AUTHENTICATION_REQUIRED');
    return kind;
  };
  // Deployment-level staff account administration. The permission inventory
  // has no deployment-scope resource type yet and the shared evaluator is
  // project-centric, so the guard anchors to an active project the actor
  // administrates under the closest deployment-wide sensitive permission
  // ('data:export'); a deployment-role model or a dedicated permission
  // replaces this anchor when the inventory grows one.
  const suspendPrincipal = async (
    request: Request,
    targetId: string | undefined,
    suspend: boolean,
  ): Promise<PrincipalStatus> => {
    if (targetId === undefined || !uuidPattern.test(targetId))
      throw new RequestFailure('NOT_FOUND');
    const principal = await authenticateBearer(request, {
      keyProvider: keyProvider ?? null,
      tokenStore: oauthCodeStore ?? null,
    });
    if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
    if (
      !authorizationResolver ||
      !administration ||
      !roleStore ||
      !staffEnrollmentStore
    )
      throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
    try {
      const anchors = await withDeadline(request.signal, 1000, () =>
        roleStore.listAdministratorProjectIds(principal.principalId),
      );
      const projectId = anchors[0];
      if (projectId === undefined) throw new RequestFailure('FORBIDDEN');
      await requireAuthorizedAction({
        request: {
          actorId: principal.principalId,
          permission: 'data:export',
          target: { projectId, type: 'export', id: targetId },
        },
        resolver: authorizationResolver,
        policy: authorizationPolicy,
        signal: request.signal,
      });
      const facts = await withDeadline(request.signal, 1000, () =>
        administration.loadPrincipal(targetId),
      );
      if (!facts) throw new RequestFailure('NOT_FOUND');
      if (suspend && facts.kind === 'staff' && facts.status === 'active') {
        const activeStaff = await withDeadline(request.signal, 1000, () =>
          staffEnrollmentStore.countActiveStaff(),
        );
        // Suspending the last active staff principal would strand the
        // deployment behind the operator-channel bootstrap re-arm.
        if (activeStaff <= 1) throw new RequestFailure('FORBIDDEN');
      }
      const applied = await withDeadline(request.signal, 1000, () =>
        suspend
          ? administration.suspendPrincipal(targetId)
          : administration.activatePrincipal(targetId),
      );
      if (!applied) throw new RequestFailure('NOT_FOUND');
      return {
        principalId: targetId,
        status: suspend ? 'suspended' : 'active',
      };
    } catch (error) {
      if (error instanceof RequestFailure) throw error;
      throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
    }
  };
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
                : path === '/api/v1/instance' && request.method === 'GET'
                  ? 'account.instance'
                  : path === '/api/v1/account' && request.method === 'GET'
                    ? 'account.account'
                    : path === '/api/v1/account/sessions' &&
                        (request.method === 'GET' ||
                          request.method === 'DELETE')
                      ? 'account.sessions'
                      : path.startsWith('/api/v1/admin/principals/') &&
                          request.method === 'POST'
                        ? 'admin.principal'
                        : path.startsWith('/api/v1/projects/') &&
                            path.includes('/members/') &&
                            (request.method === 'PUT' ||
                              request.method === 'DELETE')
                          ? 'project.members'
                          : path === '/auth/recovery-codes' &&
                              request.method === 'POST'
                            ? 'account.recovery-codes'
                            : path === '/auth/recover' &&
                                request.method === 'POST'
                              ? 'account.recover'
                              : path.startsWith('/auth/passkey/') &&
                                  request.method === 'POST'
                                ? 'account.passkey'
                                : path === '/auth/authorize' ||
                                    path.startsWith('/auth/authorize/')
                                  ? 'account.authorize'
                                  : (path === '/auth/token' ||
                                        path === '/auth/token/revoke') &&
                                      request.method === 'POST'
                                    ? 'account.token'
                                    : path === '/health/live' &&
                                        request.method === 'GET'
                                      ? 'health.live'
                                      : path === '/health/ready' &&
                                          request.method === 'GET'
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
          path === '/auth/bootstrap/enroll' ||
          path === '/auth/recovery-codes' ||
          path === '/auth/recover' ||
          path === '/auth/authorize' ||
          path.startsWith('/auth/passkey/'))
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
      // The OAuth token endpoints are form-encoded per RFC 6749/7009; every
      // other route keeps the JSON-only boundary.
      if (
        contentType?.startsWith('application/x-www-form-urlencoded') &&
        request.method === 'POST'
      ) {
        const path = new URL(request.url).pathname;
        if (
          path === '/auth/token' ||
          path === '/auth/token/revoke' ||
          path === '/auth/authorize/login' ||
          path === '/auth/authorize/consent'
        )
          return readBoundedForm(
            request,
            config.maxBodyBytes,
            config.requestTimeoutMs,
          );
      }
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
    .get('/api/v1/instance', () => instanceDocument, {
      response: t.Unsafe<InstanceDocument>(InstanceDocumentSchema),
    })
    .get(
      '/api/v1/account',
      async ({ request }): Promise<AccountDocument> => {
        // Bearer-only business read: cookies are never credentials here and
        // no Origin is required (no-Origin API clients stay valid). Like
        // /auth/session this authenticated read takes no rate admission.
        // Recent authentication stays with the shared authorization guard
        // for the route owners that need it; this route does not.
        const principal = await authenticateBearer(request, {
          keyProvider: keyProvider ?? null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        let kind: 'user' | 'staff' | null;
        try {
          kind = await withDeadline(request.signal, 1000, () =>
            oauthCodeStore!.loadPrincipalKind(principal.principalId),
          );
        } catch (error) {
          if (error instanceof RequestFailure) throw error;
          throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
        }
        // A suspended or deleted principal denies like any other invalid
        // credential; no account state is disclosed.
        if (kind !== 'user' && kind !== 'staff')
          throw new RequestFailure('AUTHENTICATION_REQUIRED');
        return {
          principalId: principal.principalId,
          identityId: principal.identityId,
          kind,
        };
      },
      { response: t.Unsafe<AccountDocument>(AccountDocumentSchema) },
    )
    .get(
      '/api/v1/account/sessions',
      async ({ request }): Promise<AccountSessions> => {
        // Bearer-only listing of the token principal's own sessions. Like
        // /api/v1/account this authenticated read takes no rate admission.
        const principal = await authenticateBearer(request, {
          keyProvider: keyProvider ?? null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!sessionStore)
          throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
        await requireActivePrincipalKind(request, principal.principalId);
        let sessions;
        try {
          sessions = await withDeadline(request.signal, 1000, () =>
            sessionStore.listActiveByPrincipal(
              principal.principalId,
              Date.now(),
            ),
          );
        } catch (error) {
          if (error instanceof RequestFailure) throw error;
          throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
        }
        return {
          sessions: sessions.map((session) => ({
            id: session.id,
            createdAt: canonicalInstant(session.createdAtMs),
            idleExpiresAt: canonicalInstant(session.idleExpiresAtMs),
            absoluteExpiresAt: canonicalInstant(session.absoluteExpiresAtMs),
          })),
        };
      },
      { response: t.Unsafe<AccountSessions>(AccountSessionsSchema) },
    )
    .delete(
      '/api/v1/account/sessions/:id',
      async ({ request, params, set }) => {
        const principal = await authenticateBearer(request, {
          keyProvider: keyProvider ?? null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!sessionStore)
          throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
        await requireActivePrincipalKind(request, principal.principalId);
        // A foreign or unknown session id answers the same closed 404.
        const id = params.id;
        if (id === undefined || !uuidPattern.test(id))
          throw new RequestFailure('NOT_FOUND');
        let revoked: boolean;
        try {
          revoked = await withDeadline(request.signal, 1000, () =>
            sessionStore.revokeOwned(id, principal.principalId, Date.now()),
          );
        } catch (error) {
          if (error instanceof RequestFailure) throw error;
          throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
        }
        if (!revoked) throw new RequestFailure('NOT_FOUND');
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/api/v1/admin/principals/:id/suspend',
      async ({ request, params }): Promise<PrincipalStatus> =>
        suspendPrincipal(request, params.id, true),
      {
        body: t.Object({}, { additionalProperties: false }),
        response: t.Unsafe<PrincipalStatus>(PrincipalStatusSchema),
      },
    )
    .post(
      '/api/v1/admin/principals/:id/activate',
      async ({ request, params }): Promise<PrincipalStatus> =>
        suspendPrincipal(request, params.id, false),
      {
        body: t.Object({}, { additionalProperties: false }),
        response: t.Unsafe<PrincipalStatus>(PrincipalStatusSchema),
      },
    )
    .put(
      '/api/v1/projects/:projectId/members/:principalId',
      async ({ request, params, body }): Promise<ProjectMemberRole> => {
        const { projectId, principalId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          principalId === undefined ||
          !uuidPattern.test(principalId)
        )
          throw new RequestFailure('NOT_FOUND');
        const principal = await authenticateBearer(request, {
          keyProvider: keyProvider ?? null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!authorizationResolver || !administration || !roleStore)
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        await requireAuthorizedAction({
          request: {
            actorId: principal.principalId,
            permission: 'role:manage',
            target: { projectId, type: 'project', id: projectId },
          },
          resolver: authorizationResolver,
          policy: authorizationPolicy,
          signal: request.signal,
        });
        try {
          const target = await withDeadline(request.signal, 1000, () =>
            administration.loadPrincipal(principalId),
          );
          if (!target) throw new RequestFailure('NOT_FOUND');
          // Membership never converts a User into Staff; only an active
          // staff principal can hold a project role.
          if (target.kind !== 'staff' || target.status !== 'active')
            throw new RequestFailure('FORBIDDEN');
          await withDeadline(request.signal, 1000, () =>
            roleStore.grant({
              projectId,
              principalId,
              role: body.role,
              nowMs: Date.now(),
            }),
          );
        } catch (error) {
          if (error instanceof RequestFailure) throw error;
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        }
        return { projectId, principalId, role: body.role };
      },
      {
        body: t.Unsafe<ProjectMemberRoleRequest>(
          ProjectMemberRoleRequestSchema,
        ),
        response: t.Unsafe<ProjectMemberRole>(ProjectMemberRoleSchema),
      },
    )
    .delete(
      '/api/v1/projects/:projectId/members/:principalId',
      async ({ request, params, set }) => {
        const { projectId, principalId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          principalId === undefined ||
          !uuidPattern.test(principalId)
        )
          throw new RequestFailure('NOT_FOUND');
        const principal = await authenticateBearer(request, {
          keyProvider: keyProvider ?? null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!authorizationResolver || !roleStore)
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        await requireAuthorizedAction({
          request: {
            actorId: principal.principalId,
            permission: 'role:manage',
            target: { projectId, type: 'project', id: projectId },
          },
          resolver: authorizationResolver,
          policy: authorizationPolicy,
          signal: request.signal,
        });
        let removed: boolean;
        try {
          removed = await withDeadline(request.signal, 1000, () =>
            roleStore.revoke(projectId, principalId),
          );
        } catch (error) {
          if (error instanceof RequestFailure) throw error;
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        }
        if (!removed) throw new RequestFailure('NOT_FOUND');
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
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
        const { cookie } = await loginAccount({
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
        const session = await currentAccountSession({
          request,
          provider: keyProvider ?? null,
          store: sessionStore ?? null,
          nowMs: Date.now(),
        });
        if (!session) throw new RequestFailure('LOGIN_DENIED');
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
    )
    .post(
      '/auth/recovery-codes',
      async ({ request }) =>
        generateAccountRecoveryCodes({
          request,
          keyProvider: keyProvider ?? null,
          recoveryStore: recoveryStore ?? null,
          sessionStore: sessionStore ?? null,
          nowMs: Date.now(),
        }),
      {
        body: t.Object({}, { additionalProperties: false }),
        response: t.Unsafe<RecoveryCodes>(RecoveryCodesSchema),
      },
    )
    .post(
      '/auth/recover',
      async ({ request, body, sensitiveAdmission }) =>
        recoverAccount({
          request,
          body,
          admission: sensitiveAdmission,
          password: standardPassword ?? null,
          passwordStore: passwordStore ?? null,
          recoveryStore: recoveryStore ?? null,
          sessionStore: sessionStore ?? null,
          keyProvider: keyProvider ?? null,
          requestId: boundaryFor(request).requestId,
        }),
      {
        body: t.Unsafe<RecoveryRequest>(RecoveryRequestSchema),
        response: t.Unsafe<Recovered>(RecoveredSchema),
      },
    )
    .post(
      '/auth/passkey/register/options',
      async ({ request }) =>
        passkeyRegistrationOptions({
          request,
          relyingParty: passkey,
          nowMs: Date.now(),
        }),
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/auth/passkey/register',
      async ({ request, body }) =>
        passkeyRegistrationVerify({
          request,
          body: body as { response: never },
          relyingParty: passkey,
          nowMs: Date.now(),
        }),
      {
        body: t.Object({ response: t.Any() }, { additionalProperties: false }),
      },
    )
    .post(
      '/auth/passkey/login/options',
      async ({ request }) =>
        passkeyLoginOptions({
          request,
          relyingParty: passkey,
          nowMs: Date.now(),
        }),
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/auth/passkey/login',
      async ({ request, body, sensitiveAdmission, set }) => {
        const cookie = await passkeyLoginVerify({
          request,
          body: body as { response: never },
          admission: sensitiveAdmission,
          relyingParty: passkey,
          nowMs: Date.now(),
          requestId: boundaryFor(request).requestId,
        });
        set.headers['set-cookie'] = cookie;
        return { authenticated: true as const };
      },
      {
        body: t.Object({ response: t.Any() }, { additionalProperties: false }),
        response: t.Unsafe<AccountSession>(AccountSessionSchema),
      },
    )
    .post(
      '/auth/authorize',
      async ({ request, body }) =>
        issueAuthorizationCode({
          request,
          query: body,
          keyProvider: keyProvider ?? null,
          sessionStore: sessionStore ?? null,
          codeStore: oauthCodeStore ?? null,
          clients: registeredClients,
          nowMs: Date.now(),
        }),
      {
        body: t.Unsafe<AuthorizeRequest>(AuthorizeRequestSchema),
        response: t.Unsafe<AuthorizeResponse>(AuthorizeResponseSchema),
      },
    )
    .get('/auth/authorize', async ({ request, set }) => {
      // Backend-owned authorization page: login form without a session,
      // consent with one; every failure stays on this origin.
      const parameters = Object.fromEntries(new URL(request.url).searchParams);
      const query = authorizeQueryFrom(parameters);
      if (!query) return authorizeErrorPage('Invalid authorization request.');
      try {
        validateAuthorizeQuery(registeredClients ?? [], {
          clientId: query.client_id,
          redirectUri: query.redirect_uri,
          scope: query.scope,
          state: query.state,
          codeChallenge: query.code_challenge,
        });
      } catch {
        return authorizeErrorPage('Unknown client or redirect target.');
      }
      const session =
        keyProvider && sessionStore
          ? await currentAccountSession({
              request,
              provider: keyProvider,
              store: sessionStore,
              nowMs: Date.now(),
            })
          : null;
      if (session)
        return authorizeConsentPage({ query, handle: null, error: null });
      set.status = 200;
      return authorizeLoginPage({
        query,
        captchaRequired: captchaGate.enabled,
        captchaSiteKey: publicCaptchaSiteKey,
        error: null,
      });
    })
    .post(
      '/auth/authorize/login',
      async ({ request, body, set, sensitiveAdmission }) => {
        requireAuthOrigin(request);
        const fields = body as Record<string, unknown>;
        const query = authorizeQueryFrom(fields);
        if (!query) return authorizeErrorPage('Invalid authorization request.');
        try {
          validateAuthorizeQuery(registeredClients ?? [], {
            clientId: query.client_id,
            redirectUri: query.redirect_uri,
            scope: query.scope,
            state: query.state,
            codeChallenge: query.code_challenge,
          });
        } catch {
          return authorizeErrorPage('Unknown client or redirect target.');
        }
        const captchaToken =
          typeof fields.captchaToken === 'string' &&
          fields.captchaToken.length >= 1 &&
          fields.captchaToken.length <= 4096
            ? fields.captchaToken
            : undefined;
        const loginFailure = 'Sign-in failed. Check your credentials.';
        let sessionFacts: { principalId: string; identityId: string };
        try {
          const { cookie, principalId, identityId } = await loginAccount({
            request,
            body: {
              handle: String(fields.handle ?? ''),
              password: String(fields.password ?? ''),
              ...(captchaToken === undefined ? {} : { captchaToken }),
            },
            admission: sensitiveAdmission,
            requestId: boundaryFor(request).requestId,
            passwordService: standardPassword ?? null,
            passwordStore: passwordStore ?? null,
            keyProvider: keyProvider ?? null,
            sessionStore: sessionStore ?? null,
          });
          set.headers['set-cookie'] = cookie;
          sessionFacts = { principalId, identityId };
        } catch {
          set.status = 401;
          return authorizeLoginPage({
            query,
            captchaRequired: captchaGate.enabled,
            captchaSiteKey: publicCaptchaSiteKey,
            error: loginFailure,
          });
        }
        const issued = await issueCodeForSession({
          query: {
            clientId: query.client_id,
            redirectUri: query.redirect_uri,
            scope: query.scope,
            state: query.state,
            codeChallenge: query.code_challenge,
          },
          keyProvider: keyProvider!,
          codeStore: oauthCodeStore ?? null,
          clients: registeredClients,
          nowMs: Date.now(),
          principalId: sessionFacts.principalId,
          identityId: sessionFacts.identityId,
          signal: request.signal,
        });
        return new Response(null, {
          status: 302,
          headers: { location: issued.redirectUri },
        });
      },
      { body: t.Any() },
    )
    .post(
      '/auth/authorize/consent',
      async ({ request, body, set }) => {
        requireAuthOrigin(request);
        const fields = body as Record<string, unknown>;
        const query = authorizeQueryFrom(fields);
        if (!query) return authorizeErrorPage('Invalid authorization request.');
        const session =
          keyProvider && sessionStore
            ? await currentAccountSession({
                request,
                provider: keyProvider,
                store: sessionStore,
                nowMs: Date.now(),
              })
            : null;
        if (!session) {
          set.status = 401;
          return authorizeLoginPage({
            query,
            captchaRequired: captchaGate.enabled,
            captchaSiteKey: publicCaptchaSiteKey,
            error: 'Sign-in failed. Check your credentials.',
          });
        }
        const issued = await issueAuthorizationCode({
          request,
          query: {
            clientId: query.client_id,
            redirectUri: query.redirect_uri,
            scope: query.scope,
            state: query.state,
            codeChallenge: query.code_challenge,
          },
          keyProvider: keyProvider ?? null,
          sessionStore: sessionStore ?? null,
          codeStore: oauthCodeStore ?? null,
          clients: registeredClients,
          nowMs: Date.now(),
        });
        return new Response(null, {
          status: 302,
          headers: { location: issued.redirectUri },
        });
      },
      { body: t.Any() },
    )
    .post(
      '/auth/token',
      async ({ request, body, sensitiveAdmission }) =>
        exchangeAuthorizationCode({
          request,
          body: body as Record<string, unknown>,
          admission: sensitiveAdmission,
          keyProvider: keyProvider ?? null,
          codeStore: oauthCodeStore ?? null,
          tokenStore: oauthCodeStore ?? null,
          requestId: boundaryFor(request).requestId,
        }),
      {
        body: t.Any(),
        response: t.Unsafe<TokenResponse>(TokenResponseSchema),
      },
    )
    .post(
      '/auth/token/revoke',
      async ({ request, body, sensitiveAdmission, set }) => {
        await revokeAccessToken({
          request,
          body: body as Record<string, unknown>,
          admission: sensitiveAdmission,
          keyProvider: keyProvider ?? null,
          store: oauthCodeStore ?? null,
          requestId: boundaryFor(request).requestId,
        });
        set.status = 204;
        return null;
      },
      { body: t.Any() },
    );
}

export { RequestFailure, withDeadline } from './bounds.ts';
export { verifyAccountPassword } from './account-password.ts';
export { parseBootstrapEnrollmentCode } from './bootstrap-enrollment.ts';
export { parseOAuthClients, validateAuthorizeQuery } from './oauth.ts';
export {
  authorizeConsentPage,
  authorizeErrorPage,
  authorizeLoginPage,
} from './authorize-pages.ts';
export type { AuthorizeQuery } from './authorize-pages.ts';
export type { OAuthClientRegistration } from './oauth.ts';
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
export {
  authorizationPolicy,
  createDbAuthorizationResolver,
} from './authorization-facts.ts';
export type { DbAuthorizationDependencies } from './authorization-facts.ts';
export { authenticateBearer, bearerScope } from './bearer-auth.ts';
export type { BearerPrincipal } from './bearer-auth.ts';
export { createCaptchaGate, requireRequiredCaptcha } from './captcha.ts';
export {
  configureOptionalTurnstile,
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from './turnstile.ts';
