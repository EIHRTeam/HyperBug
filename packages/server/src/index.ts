import { Elysia, t } from 'elysia';
import type { ElysiaAdapter } from 'elysia/adapter';
import {
  assertDeploymentAvailable,
  type RuntimeConfig,
} from '@hyperbug/config';
import type { Telemetry, RouteLabel } from '@hyperbug/observability';
import {
  auditEvent,
  minimumTierPasswordLoginEnabled,
} from '@hyperbug/security';
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
  ProjectDocumentSchema,
  CreateProjectRequestSchema,
  ConfigureProjectRequestSchema,
  LabelRequestSchema,
  LabelUpdateRequestSchema,
  LabelListSchema,
  LabelDocumentSchema,
  IssueTypeRequestSchema,
  IssueTypeUpdateRequestSchema,
  IssueTypeListSchema,
  IssueTypeDocumentSchema,
  MilestoneRequestSchema,
  MilestoneUpdateRequestSchema,
  MilestoneListSchema,
  MilestoneDocumentSchema,
  IssueDocumentSchema,
  IssuePageSchema,
  CreateIssueRequestSchema,
  EditIssueRequestSchema,
  IssueCloseRequestSchema,
  IssueRevisionRequestSchema,
  IssueSetLabelsRequestSchema,
  IssueSetAssigneesRequestSchema,
  IssueSetTypeRequestSchema,
  IssueSetMilestoneRequestSchema,
  PluginListSchema,
  PluginRecordSchema,
  PluginSummarySchema,
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
  type ProjectDocument,
  type CreateProjectRequest,
  type ConfigureProjectRequest,
  type LabelRequest,
  type LabelUpdateRequest,
  type LabelList,
  type LabelDocument,
  type IssueTypeRequest,
  type IssueTypeUpdateRequest,
  type IssueTypeList,
  type IssueTypeDocument,
  type MilestoneRequest,
  type MilestoneUpdateRequest,
  type MilestoneList,
  type MilestoneDocument,
  type IssueDocument,
  type IssuePage,
  type CreateIssueRequest,
  type EditIssueRequest,
  type IssueCloseRequest,
  type IssueRevisionRequest,
  type IssueSetLabelsRequest,
  type IssueSetAssigneesRequest,
  type IssueSetTypeRequest,
  type IssueSetMilestoneRequest,
  type PluginList,
  type PluginRecord,
  type PluginSummary,
} from '@hyperbug/contracts';
import type {
  AccountAdministrationStore,
  PluginRegistryStore,
  PluginSettingsStore,
  AccountPasswordStore,
  AccountRecoveryStore,
  AccountRegistrationStore,
  AccountSessionStore,
  OAuthAccessTokenStore,
  OAuthCodeStore,
  ProjectRoleStore,
  ProjectStore,
  IssueRepository,
  StaffEnrollmentStore,
  TaxonomyStore,
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
  type AuditAppend,
  type SensitiveAdmissionDependencies,
} from './sensitive-admission.ts';
import { appendRequiredAuditEvent } from './audit-emit.ts';
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
  authorizeErrorRedirect,
  authorizeLoginPage,
  oauthFields,
  type AuthorizeQuery,
} from './authorize-pages.ts';
import {
  AuthorizeProtocolFailure,
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
  configurePlugin,
  disablePlugin,
  enablePlugin,
  listPlugins,
  loadPlugin,
  readConfiguration,
  registerPlugin,
  uninstallPlugin,
  upgradePlugin,
  type PluginManagementContext,
} from './plugin-management.ts';
import { publishPluginEvent } from './plugin-events.ts';
import {
  archiveProject,
  configureProject,
  createProject,
  readProject,
  type ProjectContext,
} from './projects.ts';
import {
  closeIssue,
  createIssue,
  editIssue,
  listIssues,
  readIssue,
  reopenIssue,
  setIssueAssignees,
  setIssueLabels,
  setIssueMilestone,
  setIssueType,
  type IssueContext,
} from './issues.ts';
import {
  createIssueType,
  createLabel,
  createMilestone,
  deleteIssueType,
  deleteLabel,
  deleteMilestone,
  listIssueTypes,
  listLabels,
  listMilestones,
  updateIssueType,
  updateLabel,
  updateMilestone,
} from './taxonomy.ts';
export {
  publishPluginEvent,
  type PluginEventPublisherDependencies,
} from './plugin-events.ts';
import type { PluginEventOutboxStore } from '@hyperbug/application';
import {
  authorizationPolicy,
  createDbAuthorizationResolver,
} from './authorization-facts.ts';
import {
  clearedSessionCookie,
  currentAccountSession,
  issueSessionCookieFor,
  requireAuthOrigin,
  requireAuthReadOrigin,
  revokeAccountSession,
} from './account-session.ts';
import {
  CryptoFailure,
  type AccountPasswordService,
  type KeyProvider,
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
  standardPassword?: AccountPasswordService | null;
  /** Peppered PBKDF2 service; required by the minimum tier, refused otherwise. */
  minimumPassword?: AccountPasswordService | null;
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
  /** Project persistence for the issue-tracking core. */
  projectStore?: ProjectStore | null;
  /** Per-project label/type/milestone persistence. */
  taxonomyStore?: TaxonomyStore | null;
  /** Project-scoped issue persistence (the module-02 repository). */
  issueRepository?: IssueRepository | null;
  /** Deployment-level plugin registry persistence for plugin management. */
  pluginRegistry?: PluginRegistryStore | null;
  /** Namespaced plugin configuration persistence. */
  pluginSettings?: PluginSettingsStore | null;
  /** Outbox-model persistence for async plugin hook events. */
  pluginEventOutbox?: PluginEventOutboxStore | null;
  /** Principal/project directory and staff account administration. */
  accountAdministration?: AccountAdministrationStore | null;
  /** Append-only audit sink for the audited account/role mutations. */
  auditAppend?: AuditAppend | null;
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
  minimumPassword = null,
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
  projectStore = null,
  taxonomyStore = null,
  issueRepository = null,
  pluginRegistry = null,
  pluginSettings = null,
  pluginEventOutbox = null,
  accountAdministration = null,
  auditAppend = null,
  bootstrapState = null,
  minimumLoginAdmission,
}: AppOptions) {
  assertDeploymentAvailable(config.deployment);
  const deployment = Object.freeze({
    tier: config.deployment.tier,
    degradationIds: Object.freeze([...config.deployment.degradationIds]),
    passwordHashPolicy: config.deployment.requiredPasswordAlgorithm,
  });
  const tierSelected = deployment.tier === 'cloudflare-free-minimum';
  // Exactly one profile's password service may be composed, matching the
  // selected tier; the minimum tier's peppered service is mandatory because
  // bootstrap enrollment and recovery still write credentials on that tier.
  if (tierSelected && (!minimumPassword || standardPassword != null))
    throw new Error('Invalid minimum-tier password composition');
  if (!tierSelected && minimumPassword != null)
    throw new Error('Invalid standard-tier password composition');
  const accountPasswordService = tierSelected
    ? minimumPassword
    : (standardPassword ?? null);
  // Password capabilities are advertised only under the standard algorithm,
  // and on the minimum tier only when the reviewed parameter floor is met —
  // the floor-disabled login must not present itself as usable.
  const passwordCapable = tierSelected
    ? minimumTierPasswordLoginEnabled
    : accountPasswordService != null;
  // Persistent account-surface notice for the reduced-capability tier.
  const degradationNotice = tierSelected
    ? 'This instance runs the Cloudflare Free minimum tier, a reduced-capability mode. Password sign-in is disabled on this instance; passkeys and single-use recovery codes are the sign-in path, and some capabilities are limited or unavailable.'
    : null;
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
      // Recovery codes are hash-policy-independent: they remain the
      // recommended path on the minimum tier even while its password login
      // is floor-disabled, so they follow the recovery-store wiring.
      recoveryCodes: recoveryStore != null,
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
    const value = (name: (typeof oauthFields)[number]): string | null => {
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
  // Registry failures render on this origin; a protocol-shape rejection of
  // an already-verified client/redirect redirects back per RFC 6749
  // §4.2.2.1 / RFC 7636 §4.4.1.
  const authorizeValidationFailure = (
    query: AuthorizeQuery,
    error: unknown,
  ): Response =>
    error instanceof AuthorizeProtocolFailure
      ? authorizeErrorRedirect({
          redirectUri: query.redirect_uri,
          error: error.protocolError,
          state: query.state,
        })
      : authorizeErrorPage('Unknown client or redirect target.');
  const authorizeRequestBody = (query: AuthorizeQuery): AuthorizeRequest => ({
    responseType: query.response_type,
    clientId: query.client_id,
    redirectUri: query.redirect_uri,
    scope: query.scope,
    state: query.state,
    codeChallenge: query.code_challenge,
    codeChallengeMethod: query.code_challenge_method,
  });
  const captchaGate = captcha ?? createCaptchaGate();
  const boundSensitiveAdmission = createBoundSensitiveActionAdmission(
    captchaGate,
    abuse ?? null,
  );
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
      await appendRequiredAuditEvent({
        append: auditAppend,
        event: auditEvent({
          id: crypto.randomUUID(),
          projectId: null,
          actorId: principal.principalId,
          systemActor: null,
          action: suspend ? 'principal.suspended' : 'principal.activated',
          targetId,
          result: 'success',
          requestId: boundaryFor(request).requestId,
          createdAt: Date.now(),
          metadata: { v: 1 },
        }),
        signal: request.signal,
      });
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
  // Ordered (method, path) matchers over the frozen ROUTE_LABELS universe in
  // @hyperbug/observability; the first hit wins and everything else falls back
  // to 'unmatched'. Derived from RouteLabel so a label outside the frozen list
  // cannot compile here.
  const pluginIdPattern = /^@[a-z0-9][a-z0-9-]{0,62}\/[a-z0-9][a-z0-9-]{0,62}$/;
  /** Plugin ids contain a slash, so item actions carry the id in the body. */
  const pluginIdBodySchema = t.Object(
    { id: t.String({ minLength: 3, maxLength: 128 }) },
    { additionalProperties: false },
  );
  function pluginIdBody(body: { id: string }): string {
    const id = body.id;
    if (!pluginIdPattern.test(id)) throw new RequestFailure('NOT_FOUND');
    return id;
  }

  const routeLabelRules: readonly {
    readonly label: RouteLabel;
    /** null matches every method. */
    readonly methods: readonly string[] | null;
    readonly path?: string;
    readonly prefix?: string;
    readonly infix?: string;
  }[] = [
    {
      label: 'account.register',
      methods: ['GET', 'POST'],
      path: '/api/v1/accounts/register',
    },
    { label: 'account.login', methods: ['GET', 'POST'], path: '/auth/login' },
    { label: 'account.session', methods: ['GET'], path: '/auth/session' },
    { label: 'account.logout', methods: ['POST'], path: '/auth/logout' },
    {
      label: 'account.bootstrap',
      methods: ['POST'],
      path: '/auth/bootstrap/enroll',
    },
    { label: 'account.instance', methods: ['GET'], path: '/api/v1/instance' },
    { label: 'account.account', methods: ['GET'], path: '/api/v1/account' },
    {
      label: 'account.sessions',
      methods: ['GET', 'DELETE'],
      path: '/api/v1/account/sessions',
    },
    {
      label: 'admin.principal',
      methods: ['POST'],
      prefix: '/api/v1/admin/principals/',
    },
    {
      label: 'project.members',
      methods: ['PUT', 'DELETE'],
      prefix: '/api/v1/projects/',
      infix: '/members/',
    },
    {
      label: 'project.taxonomy',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      prefix: '/api/v1/projects/',
      infix: '/labels',
    },
    {
      label: 'project.taxonomy',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      prefix: '/api/v1/projects/',
      infix: '/issue-types',
    },
    {
      label: 'project.taxonomy',
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      prefix: '/api/v1/projects/',
      infix: '/milestones',
    },
    {
      label: 'issue.triage',
      methods: ['POST', 'PUT'],
      prefix: '/api/v1/projects/',
      infix: '/issues/',
    },
    {
      label: 'issue.write',
      methods: ['POST', 'PATCH'],
      prefix: '/api/v1/projects/',
      infix: '/issues',
    },
    {
      label: 'issue.read',
      methods: ['GET'],
      prefix: '/api/v1/projects/',
      infix: '/issues',
    },
    {
      label: 'project.manage',
      methods: ['POST'],
      path: '/api/v1/projects',
    },
    {
      label: 'project.manage',
      methods: ['POST', 'PATCH'],
      prefix: '/api/v1/projects/',
    },
    { label: 'project.read', methods: ['GET'], prefix: '/api/v1/projects/' },
    {
      label: 'account.recovery-codes',
      methods: ['POST'],
      path: '/auth/recovery-codes',
    },
    { label: 'account.recover', methods: ['POST'], path: '/auth/recover' },
    {
      label: 'account.passkey',
      methods: ['POST'],
      prefix: '/auth/passkey/',
    },
    { label: 'account.authorize', methods: null, path: '/auth/authorize' },
    { label: 'account.authorize', methods: null, prefix: '/auth/authorize/' },
    { label: 'account.token', methods: ['POST'], path: '/auth/token' },
    {
      label: 'account.token',
      methods: ['POST'],
      path: '/auth/token/revoke',
    },
    {
      label: 'admin.plugins',
      methods: null,
      prefix: '/api/v1/admin/plugins',
    },
    { label: 'health.live', methods: ['GET'], path: '/health/live' },
    { label: 'health.ready', methods: ['GET'], path: '/health/ready' },
    { label: 'proof', methods: null, prefix: '/_proof' },
  ];

  function routeLabelFor(path: string, method: string): RouteLabel {
    for (const rule of routeLabelRules) {
      if (rule.methods !== null && !rule.methods.includes(method)) continue;
      if (rule.path !== undefined && path !== rule.path) continue;
      if (rule.prefix !== undefined && !path.startsWith(rule.prefix)) continue;
      if (rule.infix !== undefined && !path.includes(rule.infix)) continue;
      return rule.label;
    }
    return 'unmatched';
  }

  const observeRequest = (request: Request, status: number): void => {
    const label = routeLabelFor(new URL(request.url).pathname, request.method);
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
  const pluginManagement: PluginManagementContext = {
    keyProvider: keyProvider ?? null,
    tokenStore: oauthCodeStore,
    authorizationResolver,
    authorizationPolicy,
    roleStore,
    registry: pluginRegistry,
    settings: pluginSettings,
    auditAppend,
  };
  const projectContext: ProjectContext = {
    keyProvider: keyProvider ?? null,
    tokenStore: oauthCodeStore,
    authorizationResolver,
    authorizationPolicy,
    roleStore,
    administration,
    projects: projectStore,
    taxonomy: taxonomyStore,
  };
  const issueContext: IssueContext = {
    ...projectContext,
    issues: issueRepository,
    admission: boundSensitiveAdmission,
  };
  return new Elysia({ adapter, aot: true, normalize: false })
    .decorate('captcha', captchaGate)
    .decorate('captchaSiteKey', publicCaptchaSiteKey)
    .decorate('keyProvider', keyProvider ?? unavailableKeyProvider)
    .decorate('sensitiveAdmission', boundSensitiveAdmission)
    .decorate('accountPassword', accountPasswordService)
    .decorate(
      'minimumLoginAdmission',
      minimumLoginAdmission ?? unavailableMinimumLoginAdmission,
    )
    .decorate(
      'pluginEventPublisher',
      pluginEventOutbox
        ? {
            publish: (input: {
              pluginId: string;
              point: string;
              payload: unknown;
            }) =>
              publishPluginEvent(
                { registry: pluginRegistry, events: pluginEventOutbox },
                input,
              ),
          }
        : null,
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
        // A suspended or deleted principal denies like any other invalid
        // credential; no account state is disclosed.
        const kind = await requireActivePrincipalKind(
          request,
          principal.principalId,
        );
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
        await appendRequiredAuditEvent({
          append: auditAppend,
          event: auditEvent({
            id: crypto.randomUUID(),
            projectId: null,
            actorId: principal.principalId,
            systemActor: null,
            action: 'session.revoked',
            targetId: id,
            result: 'success',
            requestId: boundaryFor(request).requestId,
            createdAt: Date.now(),
            metadata: { v: 1 },
          }),
          signal: request.signal,
        });
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
          await appendRequiredAuditEvent({
            append: auditAppend,
            event: auditEvent({
              id: crypto.randomUUID(),
              projectId,
              actorId: principal.principalId,
              systemActor: null,
              action: 'role.granted',
              targetId: principalId,
              result: 'success',
              requestId: boundaryFor(request).requestId,
              createdAt: Date.now(),
              metadata: { v: 1, role: body.role },
            }),
            signal: request.signal,
          });
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
        await appendRequiredAuditEvent({
          append: auditAppend,
          event: auditEvent({
            id: crypto.randomUUID(),
            projectId,
            actorId: principal.principalId,
            systemActor: null,
            action: 'role.revoked',
            targetId: principalId,
            result: 'success',
            requestId: boundaryFor(request).requestId,
            createdAt: Date.now(),
            metadata: { v: 1 },
          }),
          signal: request.signal,
        });
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/api/v1/projects',
      async ({ request, body, set }): Promise<ProjectDocument> => {
        const view = await createProject(request, projectContext, {
          slug: body.slug,
          name: body.name,
          visibility: body.visibility,
        });
        set.status = 201;
        return view;
      },
      {
        body: t.Unsafe<CreateProjectRequest>(CreateProjectRequestSchema),
        response: { 201: t.Unsafe<ProjectDocument>(ProjectDocumentSchema) },
      },
    )
    .get(
      '/api/v1/projects/:projectId',
      async ({ request, params }): Promise<ProjectDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return readProject(request, projectContext, projectId);
      },
      { response: t.Unsafe<ProjectDocument>(ProjectDocumentSchema) },
    )
    .patch(
      '/api/v1/projects/:projectId',
      async ({ request, params, body }): Promise<ProjectDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return configureProject(request, projectContext, projectId, {
          expectedRevision: body.expectedRevision,
          name: body.name,
          visibility: body.visibility,
        });
      },
      {
        body: t.Unsafe<ConfigureProjectRequest>(ConfigureProjectRequestSchema),
        response: t.Unsafe<ProjectDocument>(ProjectDocumentSchema),
      },
    )
    .post(
      '/api/v1/projects/:projectId/archive',
      async ({ request, params, body }): Promise<ProjectDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return archiveProject(
          request,
          projectContext,
          projectId,
          body.expectedRevision,
        );
      },
      {
        body: t.Object(
          { expectedRevision: t.Integer({ minimum: 1 }) },
          { additionalProperties: false },
        ),
        response: t.Unsafe<ProjectDocument>(ProjectDocumentSchema),
      },
    )
    .post(
      '/api/v1/projects/:projectId/labels',
      async ({ request, params, body, set }): Promise<LabelDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        const view = await createLabel(request, projectContext, projectId, {
          name: body.name,
          description: body.description,
          color: body.color,
        });
        set.status = 201;
        return view;
      },
      {
        body: t.Unsafe<LabelRequest>(LabelRequestSchema),
        response: { 201: t.Unsafe<LabelDocument>(LabelDocumentSchema) },
      },
    )
    .get(
      '/api/v1/projects/:projectId/labels',
      async ({ request, params }): Promise<LabelList> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return {
          labels: [...(await listLabels(request, projectContext, projectId))],
        };
      },
      { response: t.Unsafe<LabelList>(LabelListSchema) },
    )
    .patch(
      '/api/v1/projects/:projectId/labels/:labelId',
      async ({ request, params, body }): Promise<LabelDocument> => {
        const { projectId, labelId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          labelId === undefined ||
          !uuidPattern.test(labelId)
        )
          throw new RequestFailure('NOT_FOUND');
        return updateLabel(request, projectContext, projectId, labelId, {
          expectedRevision: body.expectedRevision,
          name: body.name,
          description: body.description,
          color: body.color,
        });
      },
      {
        body: t.Unsafe<LabelUpdateRequest>(LabelUpdateRequestSchema),
        response: t.Unsafe<LabelDocument>(LabelDocumentSchema),
      },
    )
    .delete(
      '/api/v1/projects/:projectId/labels/:labelId',
      async ({ request, params, set }) => {
        const { projectId, labelId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          labelId === undefined ||
          !uuidPattern.test(labelId)
        )
          throw new RequestFailure('NOT_FOUND');
        await deleteLabel(request, projectContext, projectId, labelId);
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/api/v1/projects/:projectId/issue-types',
      async ({ request, params, body, set }): Promise<IssueTypeDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        const view = await createIssueType(request, projectContext, projectId, {
          name: body.name,
          description: body.description,
          icon: body.icon,
          color: body.color,
          position: body.position,
          enabled: body.enabled,
        });
        set.status = 201;
        return view;
      },
      {
        body: t.Unsafe<IssueTypeRequest>(IssueTypeRequestSchema),
        response: { 201: t.Unsafe<IssueTypeDocument>(IssueTypeDocumentSchema) },
      },
    )
    .get(
      '/api/v1/projects/:projectId/issue-types',
      async ({ request, params }): Promise<IssueTypeList> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return {
          types: [
            ...(await listIssueTypes(request, projectContext, projectId)),
          ],
        };
      },
      { response: t.Unsafe<IssueTypeList>(IssueTypeListSchema) },
    )
    .patch(
      '/api/v1/projects/:projectId/issue-types/:typeId',
      async ({ request, params, body }): Promise<IssueTypeDocument> => {
        const { projectId, typeId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          typeId === undefined ||
          !uuidPattern.test(typeId)
        )
          throw new RequestFailure('NOT_FOUND');
        return updateIssueType(request, projectContext, projectId, typeId, {
          expectedRevision: body.expectedRevision,
          name: body.name,
          description: body.description,
          icon: body.icon,
          color: body.color,
          position: body.position,
          enabled: body.enabled,
        });
      },
      {
        body: t.Unsafe<IssueTypeUpdateRequest>(IssueTypeUpdateRequestSchema),
        response: t.Unsafe<IssueTypeDocument>(IssueTypeDocumentSchema),
      },
    )
    .delete(
      '/api/v1/projects/:projectId/issue-types/:typeId',
      async ({ request, params, set }) => {
        const { projectId, typeId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          typeId === undefined ||
          !uuidPattern.test(typeId)
        )
          throw new RequestFailure('NOT_FOUND');
        await deleteIssueType(request, projectContext, projectId, typeId);
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/api/v1/projects/:projectId/milestones',
      async ({ request, params, body, set }): Promise<MilestoneDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        const view = await createMilestone(request, projectContext, projectId, {
          title: body.title,
          description: body.description,
          dueDate: body.dueDate,
        });
        set.status = 201;
        return view;
      },
      {
        body: t.Unsafe<MilestoneRequest>(MilestoneRequestSchema),
        response: { 201: t.Unsafe<MilestoneDocument>(MilestoneDocumentSchema) },
      },
    )
    .get(
      '/api/v1/projects/:projectId/milestones',
      async ({ request, params }): Promise<MilestoneList> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return {
          milestones: [
            ...(await listMilestones(request, projectContext, projectId)),
          ],
        };
      },
      { response: t.Unsafe<MilestoneList>(MilestoneListSchema) },
    )
    .patch(
      '/api/v1/projects/:projectId/milestones/:milestoneId',
      async ({ request, params, body }): Promise<MilestoneDocument> => {
        const { projectId, milestoneId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          milestoneId === undefined ||
          !uuidPattern.test(milestoneId)
        )
          throw new RequestFailure('NOT_FOUND');
        return updateMilestone(
          request,
          projectContext,
          projectId,
          milestoneId,
          {
            expectedRevision: body.expectedRevision,
            title: body.title,
            description: body.description,
            dueDate: body.dueDate,
            state: body.state,
          },
        );
      },
      {
        body: t.Unsafe<MilestoneUpdateRequest>(MilestoneUpdateRequestSchema),
        response: t.Unsafe<MilestoneDocument>(MilestoneDocumentSchema),
      },
    )
    .delete(
      '/api/v1/projects/:projectId/milestones/:milestoneId',
      async ({ request, params, set }) => {
        const { projectId, milestoneId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          milestoneId === undefined ||
          !uuidPattern.test(milestoneId)
        )
          throw new RequestFailure('NOT_FOUND');
        await deleteMilestone(request, projectContext, projectId, milestoneId);
        set.status = 204;
        return null;
      },
      { body: t.Object({}, { additionalProperties: false }) },
    )
    .post(
      '/api/v1/projects/:projectId/issues',
      async ({ request, params, body, set }): Promise<IssueDocument> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        const view = await createIssue(
          request,
          issueContext,
          projectId,
          boundaryFor(request).requestId,
          {
            title: body.title,
            body: body.body,
            typeId: body.typeId,
            milestoneId: body.milestoneId,
            labelIds: body.labelIds,
            assigneeIds: body.assigneeIds,
          },
        );
        set.status = 201;
        return view as IssueDocument;
      },
      {
        body: t.Unsafe<CreateIssueRequest>(CreateIssueRequestSchema),
        response: { 201: t.Unsafe<IssueDocument>(IssueDocumentSchema) },
      },
    )
    .get(
      '/api/v1/projects/:projectId/issues',
      async ({ request, params, query }): Promise<IssuePage> => {
        const projectId = params.projectId;
        if (projectId === undefined || !uuidPattern.test(projectId))
          throw new RequestFailure('NOT_FOUND');
        return (await listIssues(request, issueContext, projectId, {
          state: query.state,
          limit: query.limit === undefined ? undefined : Number(query.limit),
          cursor: query.cursor,
        })) as IssuePage;
      },
      {
        query: t.Object(
          {
            state: t.Optional(
              t.Union([t.Literal('open'), t.Literal('closed')]),
            ),
            limit: t.Optional(t.Integer({ minimum: 1, maximum: 100 })),
            cursor: t.Optional(t.String({ maxLength: 1024 })),
          },
          { additionalProperties: false },
        ),
        response: t.Unsafe<IssuePage>(IssuePageSchema),
      },
    )
    .get(
      '/api/v1/projects/:projectId/issues/:issueId',
      async ({ request, params }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await readIssue(
          request,
          issueContext,
          projectId,
          issueId,
        )) as IssueDocument;
      },
      { response: t.Unsafe<IssueDocument>(IssueDocumentSchema) },
    )
    .patch(
      '/api/v1/projects/:projectId/issues/:issueId',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await editIssue(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          {
            expectedRevision: body.expectedRevision,
            title: body.title,
            body: body.body,
          },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<EditIssueRequest>(EditIssueRequestSchema),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
      },
    )
    .post(
      '/api/v1/projects/:projectId/issues/:issueId/close',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await closeIssue(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          { expectedRevision: body.expectedRevision, reason: body.reason },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<IssueCloseRequest>(IssueCloseRequestSchema),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
      },
    )
    .post(
      '/api/v1/projects/:projectId/issues/:issueId/reopen',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await reopenIssue(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          { expectedRevision: body.expectedRevision },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<IssueRevisionRequest>(IssueRevisionRequestSchema),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
      },
    )
    .put(
      '/api/v1/projects/:projectId/issues/:issueId/labels',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await setIssueLabels(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          { expectedRevision: body.expectedRevision, labelIds: body.labelIds },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<IssueSetLabelsRequest>(IssueSetLabelsRequestSchema),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
      },
    )
    .put(
      '/api/v1/projects/:projectId/issues/:issueId/assignees',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await setIssueAssignees(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          {
            expectedRevision: body.expectedRevision,
            assigneeIds: body.assigneeIds,
          },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<IssueSetAssigneesRequest>(
          IssueSetAssigneesRequestSchema,
        ),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
      },
    )
    .put(
      '/api/v1/projects/:projectId/issues/:issueId/type',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await setIssueType(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          { expectedRevision: body.expectedRevision, typeId: body.typeId },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<IssueSetTypeRequest>(IssueSetTypeRequestSchema),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
      },
    )
    .put(
      '/api/v1/projects/:projectId/issues/:issueId/milestone',
      async ({ request, params, body }): Promise<IssueDocument> => {
        const { projectId, issueId } = params;
        if (
          projectId === undefined ||
          !uuidPattern.test(projectId) ||
          issueId === undefined ||
          !uuidPattern.test(issueId)
        )
          throw new RequestFailure('NOT_FOUND');
        return (await setIssueMilestone(
          request,
          issueContext,
          projectId,
          issueId,
          boundaryFor(request).requestId,
          {
            expectedRevision: body.expectedRevision,
            milestoneId: body.milestoneId,
          },
        )) as IssueDocument;
      },
      {
        body: t.Unsafe<IssueSetMilestoneRequest>(
          IssueSetMilestoneRequestSchema,
        ),
        response: t.Unsafe<IssueDocument>(IssueDocumentSchema),
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
        accountPassword: passwordService,
      }) => {
        // A floor-disabled tier answers the password surface with the
        // documented capability error before any admission or parsing work;
        // a standard composition that lacks its password service stays an
        // availability failure, not a capability statement.
        if (!passwordCapable && tierSelected)
          throw new RequestFailure('PASSWORD_CAPABILITY_DISABLED');
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
      '/api/v1/admin/plugins',
      async ({ request }): Promise<PluginList> => ({
        plugins: await listPlugins(request, pluginManagement),
      }),
      { response: t.Unsafe<PluginList>(PluginListSchema) },
    )
    .post(
      '/api/v1/admin/plugins',
      async ({ request, body, set }): Promise<PluginSummary> => {
        const summary = await registerPlugin(
          request,
          pluginManagement,
          body.manifest,
          boundaryFor(request).requestId,
        );
        set.status = 201;
        return summary;
      },
      {
        body: t.Object(
          { manifest: t.Object({}, { additionalProperties: true }) },
          { additionalProperties: false },
        ),
        response: { 201: t.Unsafe<PluginSummary>(PluginSummarySchema) },
      },
    )
    .post(
      '/api/v1/admin/plugins/load',
      async ({ request, body }): Promise<PluginRecord> =>
        loadPlugin(request, pluginManagement, pluginIdBody(body)),
      {
        body: pluginIdBodySchema,
        response: t.Unsafe<PluginRecord>(PluginRecordSchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/configure',
      async ({ request, body }): Promise<PluginSummary> =>
        configurePlugin(
          request,
          pluginManagement,
          pluginIdBody(body),
          {
            values: body.values,
            secrets: body.secrets,
          },
          boundaryFor(request).requestId,
        ),
      {
        body: t.Object(
          {
            id: t.String({ minLength: 3, maxLength: 128 }),
            values: t.Optional(
              t.Record(
                t.String(),
                t.Union([t.String(), t.Number(), t.Boolean()]),
              ),
            ),
            secrets: t.Optional(t.Record(t.String(), t.String())),
          },
          { additionalProperties: false },
        ),
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/configuration',
      async ({ request, body }) => ({
        settings: await readConfiguration(
          request,
          pluginManagement,
          pluginIdBody(body),
        ),
      }),
      {
        body: pluginIdBodySchema,
        response: t.Object(
          {
            settings: t.Array(
              t.Object(
                {
                  key: t.String(),
                  kind: t.Union([t.Literal('public'), t.Literal('secret')]),
                  value: t.Optional(
                    t.Union([t.String(), t.Number(), t.Boolean()]),
                  ),
                  secretPresent: t.Optional(t.Boolean()),
                },
                { additionalProperties: false },
              ),
            ),
          },
          { additionalProperties: false },
        ),
      },
    )
    .post(
      '/api/v1/admin/plugins/enable',
      async ({ request, body }): Promise<PluginSummary> =>
        enablePlugin(
          request,
          pluginManagement,
          pluginIdBody(body),
          boundaryFor(request).requestId,
        ),
      {
        body: pluginIdBodySchema,
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/disable',
      async ({ request, body }): Promise<PluginSummary> =>
        disablePlugin(
          request,
          pluginManagement,
          pluginIdBody(body),
          boundaryFor(request).requestId,
        ),
      {
        body: pluginIdBodySchema,
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/upgrade',
      async ({ request, body }): Promise<PluginSummary> =>
        upgradePlugin(
          request,
          pluginManagement,
          body.id,
          body.manifest,
          boundaryFor(request).requestId,
        ),
      {
        body: t.Object(
          {
            id: t.String({ minLength: 3, maxLength: 128 }),
            manifest: t.Object({}, { additionalProperties: true }),
          },
          { additionalProperties: false },
        ),
        response: t.Unsafe<PluginSummary>(PluginSummarySchema),
      },
    )
    .post(
      '/api/v1/admin/plugins/uninstall',
      async ({ request, body, set }) => {
        await uninstallPlugin(
          request,
          pluginManagement,
          body.id,
          body.policy,
          boundaryFor(request).requestId,
        );
        set.status = 204;
        return null;
      },
      {
        body: t.Object(
          {
            id: t.String({ minLength: 3, maxLength: 128 }),
            policy: t.Union([t.Literal('retain'), t.Literal('delete')]),
          },
          { additionalProperties: false },
        ),
        response: { 204: t.Null() },
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
        if (!passwordCapable && tierSelected)
          throw new RequestFailure('PASSWORD_CAPABILITY_DISABLED');
        const { cookie } = await loginAccount({
          request,
          body,
          admission: sensitiveAdmission,
          requestId: boundaryFor(request).requestId,
          passwordService: accountPasswordService,
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
          password: accountPasswordService,
          code: bootstrapCode,
          store: staffEnrollmentStore,
          auditAppend,
          requestId: boundaryFor(request).requestId,
        });
        set.status = 201;
        if (tierSelected) {
          // The tier's password login is floor-disabled, so a bootstrapped
          // administrator could never sign in; enrollment therefore completes
          // by issuing the first-party session the operator uses to register
          // a passkey and recovery codes immediately.
          if (!passwordStore || !keyProvider || !sessionStore)
            throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
          const credential = await withDeadline(request.signal, 1000, () =>
            passwordStore!.loadCredentialByIdentity(result.identityId),
          );
          if (!credential || credential.principalId !== result.principalId)
            throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
          set.headers['set-cookie'] = await issueSessionCookieFor({
            account: {
              principalId: result.principalId,
              identityId: result.identityId,
              credentialRevision: credential.revision,
            },
            provider: keyProvider,
            store: sessionStore,
            signal: request.signal,
            nowMs: Date.now(),
          });
        }
        return { enrolled: true as const };
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
          auditAppend,
          requestId: boundaryFor(request).requestId,
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
          password: accountPasswordService,
          passwordStore: passwordStore ?? null,
          recoveryStore: recoveryStore ?? null,
          sessionStore: sessionStore ?? null,
          keyProvider: keyProvider ?? null,
          auditAppend,
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
          auditAppend,
          requestId: boundaryFor(request).requestId,
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
        validateAuthorizeQuery(
          registeredClients ?? [],
          authorizeRequestBody(query),
        );
      } catch (error) {
        return authorizeValidationFailure(query, error);
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
        return authorizeConsentPage({
          query,
          handle: null,
          error: null,
          notice: degradationNotice,
        });
      set.status = 200;
      return authorizeLoginPage({
        query,
        captchaRequired: captchaGate.enabled,
        captchaSiteKey: publicCaptchaSiteKey,
        error: null,
        passwordSigninAvailable: passwordCapable,
        notice: degradationNotice,
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
          validateAuthorizeQuery(
            registeredClients ?? [],
            authorizeRequestBody(query),
          );
        } catch (error) {
          return authorizeValidationFailure(query, error);
        }
        if (!passwordCapable && tierSelected)
          return authorizeErrorPage(
            'Password sign-in is disabled on this instance.',
            403,
          );
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
            passwordService: accountPasswordService,
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
            passwordSigninAvailable: passwordCapable,
            notice: degradationNotice,
          });
        }
        const issued = await issueCodeForSession({
          query: authorizeRequestBody(query),
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
        try {
          validateAuthorizeQuery(
            registeredClients ?? [],
            authorizeRequestBody(query),
          );
        } catch (error) {
          return authorizeValidationFailure(query, error);
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
        if (!session) {
          set.status = 401;
          return authorizeLoginPage({
            query,
            captchaRequired: captchaGate.enabled,
            captchaSiteKey: publicCaptchaSiteKey,
            error: 'Sign-in failed. Check your credentials.',
            passwordSigninAvailable: passwordCapable,
            notice: degradationNotice,
          });
        }
        const issued = await issueAuthorizationCode({
          request,
          query: authorizeRequestBody(query),
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
export { parsePasskeyConfiguration } from './passkey.ts';
export {
  constantTimeEquals,
  parseOAuthClients,
  validateAuthorizeQuery,
} from './oauth.ts';
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
export type {
  AuditAppend,
  SensitiveAdmissionDependencies,
} from './sensitive-admission.ts';
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
export { authenticateBearer } from './bearer-auth.ts';
export type { BearerPrincipal } from './bearer-auth.ts';
export { createCaptchaGate, requireRequiredCaptcha } from './captcha.ts';
export {
  configureOptionalTurnstile,
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from './turnstile.ts';
