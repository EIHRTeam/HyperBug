import type { AuthorizationResolver } from '@hyperbug/security';
import { t, type AnyElysia } from 'elysia';
import type { AppOptions, BoundaryHeaders } from './index.ts';
import { storeReadTimeoutMs, storeWriteTimeoutMs } from './bounds.ts';
import { scopeKeyProvider } from '@hyperbug/security';
import { auditEvent } from '@hyperbug/security';
import {
  ProjectMemberRoleRequestSchema,
  ProjectMemberRoleSchema,
  type ProjectMemberRole,
  type ProjectMemberRoleRequest,
} from '@hyperbug/contracts';
import { RequestFailure, withDeadline } from './bounds.ts';
import { withAtomicAudit } from './audit-emit.ts';
import { authenticateBearer } from './bearer-auth.ts';
import { requireAuthorizedAction } from './authorization.ts';
import { credentialFactsOf } from './authorization.ts';
export interface MembershipDependencies {
  readonly uuidPattern: RegExp;
  readonly keyProvider: AppOptions['keyProvider'];
  readonly oauthCodeStore: AppOptions['oauthCodeStore'];
  readonly authorizationResolver: AuthorizationResolver | null;
  readonly administration: AppOptions['accountAdministration'];
  readonly roleStore: AppOptions['projectRoleStore'];
  readonly authorizationPolicy: AppOptions['config']['security']['authorization'];
  readonly boundaryFor: (request: Request) => BoundaryHeaders;
}
export function membershipRoutes(
  app: AnyElysia,
  dependencies: MembershipDependencies,
) {
  const {
    uuidPattern,
    keyProvider,
    oauthCodeStore,
    authorizationResolver,
    administration,
    roleStore,
    authorizationPolicy,
    boundaryFor,
  } = dependencies;
  return app
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
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!authorizationResolver || !administration || !roleStore)
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        await requireAuthorizedAction({
          httpRequest: request,
          request: {
            actorId: principal.principalId,
            permission: 'role:manage',
            target: { projectId, type: 'project', id: projectId },
          },
          resolver: authorizationResolver,
          policy: authorizationPolicy,
          signal: request.signal,
          credential: credentialFactsOf(principal),
        });
        try {
          const target = await withDeadline(
            request.signal,
            storeReadTimeoutMs(request.signal),
            () => administration.loadPrincipal(principalId),
          );
          if (!target) throw new RequestFailure('NOT_FOUND');
          // Membership never converts a User into Staff; only an active
          // staff principal can hold a project role.
          if (target.kind !== 'staff' || target.status !== 'active')
            throw new RequestFailure('FORBIDDEN');
          const audit = auditEvent({
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
          });
          await withAtomicAudit(
            request.signal,
            storeWriteTimeoutMs(request.signal),
            () =>
              roleStore.grant(
                {
                  projectId,
                  principalId,
                  role: body.role,
                  nowMs: Date.now(),
                },
                audit,
              ),
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
          keyProvider: keyProvider
            ? scopeKeyProvider(keyProvider, request)
            : null,
          tokenStore: oauthCodeStore ?? null,
        });
        if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
        if (!authorizationResolver || !roleStore)
          throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
        await requireAuthorizedAction({
          httpRequest: request,
          request: {
            actorId: principal.principalId,
            permission: 'role:manage',
            target: { projectId, type: 'project', id: projectId },
          },
          resolver: authorizationResolver,
          policy: authorizationPolicy,
          signal: request.signal,
          credential: credentialFactsOf(principal),
        });
        const audit = auditEvent({
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
        });
        let removed: boolean;
        try {
          removed = await withAtomicAudit(
            request.signal,
            storeWriteTimeoutMs(request.signal),
            () => roleStore.revoke(projectId, principalId, audit),
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
    );
}
