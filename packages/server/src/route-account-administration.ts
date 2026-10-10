import { t, type AnyElysia } from 'elysia';
import type { AppOptions, BoundaryHeaders } from './index.ts';
import { storeReadTimeoutMs, storeWriteTimeoutMs } from './bounds.ts';
import { scopeKeyProvider } from '@hyperbug/security';
import { auditEvent } from '@hyperbug/security';
import {
  AccountDocumentSchema,
  AccountSessionsSchema,
  PrincipalStatusSchema,
  type AccountDocument,
  type AccountSessions,
  type PrincipalStatus,
} from '@hyperbug/contracts';
import { RequestFailure, withDeadline } from './bounds.ts';
import { appendRequiredAuditEvent } from './audit-emit.ts';
import { authenticateBearer } from './bearer-auth.ts';
export interface AccountAdministrationDependencies {
  readonly auditAppend: Exclude<AppOptions['auditAppend'], undefined>;
  readonly keyProvider: AppOptions['keyProvider'];
  readonly oauthCodeStore: AppOptions['oauthCodeStore'];
  readonly requireActivePrincipalKind: (
    request: Request,
    principalId: string,
  ) => Promise<'user' | 'staff'>;
  readonly sessionStore: AppOptions['sessionStore'];
  readonly canonicalInstant: (ms: number) => string;
  readonly uuidPattern: RegExp;
  readonly boundaryFor: (request: Request) => BoundaryHeaders;
  readonly suspendPrincipal: (
    request: Request,
    targetId: string,
    suspended: boolean,
  ) => Promise<PrincipalStatus>;
}
export function accountAdministrationRoutes(
  app: AnyElysia,
  dependencies: AccountAdministrationDependencies,
) {
  const {
    auditAppend,
    keyProvider,
    oauthCodeStore,
    requireActivePrincipalKind,
    sessionStore,
    canonicalInstant,
    uuidPattern,
    boundaryFor,
    suspendPrincipal,
  } = dependencies;
  return app
    .get(
      '/api/v1/account',
      async ({ request }): Promise<AccountDocument> => {
        // Bearer-only business read: cookies are never credentials here and
        // no Origin is required (no-Origin API clients stay valid). Like
        // /auth/session this authenticated read takes no rate admission.
        // Recent authentication stays with the shared authorization guard
        // for the route owners that need it; this route does not.
        const principal = await authenticateBearer(request, {
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
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
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!sessionStore)
          throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
        await requireActivePrincipalKind(request, principal.principalId);
        let sessions;
        try {
          sessions = await withDeadline(
            request.signal,
            storeReadTimeoutMs(request.signal),
            () =>
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
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
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
          revoked = await withDeadline(
            request.signal,
            storeWriteTimeoutMs(request.signal),
            () =>
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
    );
}
