import type { AccountPasswordService } from '@hyperbug/security';
import { t, type AnyElysia } from 'elysia';
import type { AppOptions, BoundaryHeaders } from './index.ts';
import { storeReadTimeoutMs } from './bounds.ts';
import { scopeKeyProvider } from '@hyperbug/security';
import {
  LoginRequestSchema,
  LoginChallengeSchema,
  AccountSessionSchema,
  BootstrapEnrollRequestSchema,
  BootstrapEnrolledSchema,
  RecoveryCodesSchema,
  RecoveryRequestSchema,
  RecoveredSchema,
  type LoginRequest,
  type LoginChallenge,
  type AccountSession,
  type BootstrapEnrollRequest,
  type BootstrapEnrolled,
  type RecoveryCodes,
  type RecoveryRequest,
  type Recovered,
} from '@hyperbug/contracts';
import { RequestFailure, withDeadline } from './bounds.ts';
import { type CaptchaGate } from './captcha.ts';
import { loginAccount } from './account-login.ts';
import { enrollInitialStaff } from './bootstrap-enrollment.ts';
import {
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegistrationOptions,
  passkeyRegistrationVerify,
} from './passkey.ts';
import {
  generateAccountRecoveryCodes,
  recoverAccount,
} from './account-recovery.ts';
import {
  clearedSessionCookie,
  currentAccountSession,
  issueSessionCookieFor,
  revokeAccountSession,
} from './account-session.ts';
export interface AccountsDependencies {
  readonly accountPasswordService: AccountPasswordService | null;
  readonly tierSelected: boolean;
  readonly unavailableMinimumLoginAdmission: NonNullable<
    AppOptions['minimumLoginAdmission']
  >;
  readonly captchaGate: CaptchaGate;
  readonly publicCaptchaSiteKey: string | null;
  readonly boundaryFor: (request: Request) => BoundaryHeaders;
  readonly minimumLoginAdmission: AppOptions['minimumLoginAdmission'];
  readonly passwordStore: AppOptions['passwordStore'];
  readonly keyProvider: AppOptions['keyProvider'];
  readonly sessionStore: AppOptions['sessionStore'];
  readonly bootstrapCode: Exclude<AppOptions['bootstrapCode'], undefined>;
  readonly staffEnrollmentStore: Exclude<
    AppOptions['staffEnrollmentStore'],
    undefined
  >;
  readonly auditAppend: Exclude<AppOptions['auditAppend'], undefined>;
  readonly recoveryStore: AppOptions['recoveryStore'];
  readonly authorizationPolicy: AppOptions['config']['security']['authorization'];
  readonly passkey: Exclude<AppOptions['passkey'], undefined>;
}
export function accountsRoutes(
  app: AnyElysia,
  dependencies: AccountsDependencies,
) {
  const {
    accountPasswordService,
    tierSelected,
    unavailableMinimumLoginAdmission,
    captchaGate,
    publicCaptchaSiteKey,
    boundaryFor,
    minimumLoginAdmission,
    passwordStore,
    keyProvider,
    sessionStore,
    bootstrapCode,
    staffEnrollmentStore,
    auditAppend,
    recoveryStore,
    authorizationPolicy,
    passkey,
  } = dependencies;
  return app
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
          passwordService:
            accountPasswordService?.forRequest?.(request) ??
            accountPasswordService,
          minimumAdmission: tierSelected
            ? (minimumLoginAdmission ?? unavailableMinimumLoginAdmission)
            : null,
          passwordStore: passwordStore ?? null,
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
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
          provider: keyProvider ? scopeKeyProvider(keyProvider, request) : null,
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
          provider: keyProvider ? scopeKeyProvider(keyProvider, request) : null,
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
          password:
            accountPasswordService?.forRequest?.(request) ??
            accountPasswordService,
          code: bootstrapCode,
          store: staffEnrollmentStore,
          auditAppend,
          requestId: boundaryFor(request).requestId,
        });
        set.status = 201;
        if (tierSelected) {
          // Enrollment issues a session for immediate passkey/recovery setup.
          if (!passwordStore || !keyProvider || !sessionStore)
            throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
          const credential = await withDeadline(
            request.signal,
            storeReadTimeoutMs(request.signal),
            () => passwordStore!.loadCredentialByIdentity(result.identityId),
          );
          if (!credential || credential.principalId !== result.principalId)
            throw new RequestFailure('BOOTSTRAP_UNAVAILABLE');
          set.headers['set-cookie'] = await issueSessionCookieFor({
            account: {
              principalId: result.principalId,
              identityId: result.identityId,
              credentialRevision: credential.revision,
            },
            ceremony: { method: 'bootstrap', assurance: 1 },
            provider: scopeKeyProvider(keyProvider, request),
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
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
          recoveryStore: recoveryStore ?? null,
          sessionStore: sessionStore ?? null,
          auditAppend,
          requestId: boundaryFor(request).requestId,
          recentAuthMaxAgeMs: authorizationPolicy.recentAuthMaxAgeMs,
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
          password:
            accountPasswordService?.forRequest?.(request) ??
            accountPasswordService,
          passwordStore: passwordStore ?? null,
          recoveryStore: recoveryStore ?? null,
          sessionStore: sessionStore ?? null,
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
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
          body: body as { response: never; captchaToken?: string },
          admission: sensitiveAdmission,
          relyingParty: passkey,
          nowMs: Date.now(),
          requestId: boundaryFor(request).requestId,
        });
        set.headers['set-cookie'] = cookie;
        return { authenticated: true as const };
      },
      {
        body: t.Object(
          {
            response: t.Any(),
            captchaToken: t.Optional(
              t.String({ minLength: 1, maxLength: 4096 }),
            ),
          },
          { additionalProperties: false },
        ),
        response: t.Unsafe<AccountSession>(AccountSessionSchema),
      },
    );
}
