import type {
  AuthorizationFacts,
  AuthorizationPolicy,
  AuthorizationResolver,
  PermissionRequest,
  StaffRole,
} from '@hyperbug/security';
import { projectStaffRoles } from '@hyperbug/application';

/**
 * Provisional recent-authentication bound from AUTH-FLOWS: 15 minutes, the
 * maximum the shared evaluator accepts, shared by every guarded management
 * route and the ceremony-assurance mapping below.
 */
const recentAuthMaxAgeMs = 900_000;
const timeoutMs = 1_000;

/** Shared guard policy for the account and role management routes. */
export const authorizationPolicy: AuthorizationPolicy = Object.freeze({
  recentAuthMaxAgeMs,
  timeoutMs,
});

/**
 * Sentinel far-future expiry while the principal's credential is current.
 * Bearer token lifetime is enforced by authentication itself; the evaluator
 * only needs to know the principal has not expired.
 */
const farFutureMs = 8_640_000_000_000_000;

export interface DbAuthorizationDependencies {
  loadPrincipal(principalId: string): Promise<{
    kind: 'user' | 'staff';
    status: 'active' | 'suspended' | 'deleted';
    credentialActive: boolean;
    passkeyUsedAtMs: number | null;
  } | null>;
  loadProject(projectId: string): Promise<{
    visibility: 'public' | 'private';
    state: 'active' | 'archived' | 'deleted';
  } | null>;
  loadMembership(
    projectId: string,
    principalId: string,
  ): Promise<{ role: StaffRole } | null>;
  tokenIssuedAtMs(principalId: string): Promise<number | null>;
}

/**
 * Module 04 ceremony mapping under the SECURITY permission-and-assurance
 * contract: password is single-factor assurance 1. A passkey login ceremony
 * performed required cryptographic user verification, which the passkey
 * store stamps server-side at each login; while that ceremony is within the
 * recent-authentication bound the principal carries assurance 2, and outside
 * it the mapping falls back to 1 so no stale ceremony keeps elevating an
 * account. No client claim is ever consulted.
 */
function ceremonyAssurance(
  passkeyUsedAtMs: number | null,
  nowMs: number,
): 1 | 2 {
  if (passkeyUsedAtMs === null || !Number.isSafeInteger(passkeyUsedAtMs))
    return 1;
  const ageMs = nowMs - passkeyUsedAtMs;
  return ageMs >= 0 && ageMs <= recentAuthMaxAgeMs ? 2 : 1;
}

/** A missing project row becomes deny-shaped facts, not an error. */
function deniedProject(projectId: string) {
  return Object.freeze({
    id: projectId,
    visibility: 'private' as const,
    state: 'deleted' as const,
  });
}

/**
 * Builds AuthorizationFacts from current primary state for a bearer
 * principal: identity, membership and token issuance all come from the
 * authoritative stores, never from request claims. Lookup failures throw so
 * the shared guard maps them to AUTHORIZATION_UNAVAILABLE. The resource
 * block reflects the standing feature-policy hook — module 06 refines
 * `permissionGranted` per object; until then the routes themselves own the
 * remaining object checks.
 */
export function createDbAuthorizationResolver(
  deps: DbAuthorizationDependencies,
): AuthorizationResolver {
  return {
    async resolve(
      request: PermissionRequest,
      signal: AbortSignal,
    ): Promise<AuthorizationFacts> {
      if (signal.aborted) throw new Error('Aborted');
      const nowMs = Date.now();
      const actorId = request.actorId;
      const principalRow =
        actorId === null ? null : await deps.loadPrincipal(actorId);
      const [projectRow, membershipRow, issuedAtMs] = await Promise.all([
        deps.loadProject(request.target.projectId),
        actorId === null
          ? Promise.resolve(null)
          : deps.loadMembership(request.target.projectId, actorId),
        actorId === null
          ? Promise.resolve(null)
          : deps.tokenIssuedAtMs(actorId),
      ]);
      if (signal.aborted) throw new Error('Aborted');
      if (principalRow !== null) {
        const { kind, status, credentialActive, passkeyUsedAtMs } =
          principalRow;
        if (
          (kind !== 'user' && kind !== 'staff') ||
          (status !== 'active' &&
            status !== 'suspended' &&
            status !== 'deleted') ||
          typeof credentialActive !== 'boolean' ||
          (passkeyUsedAtMs !== null && !Number.isSafeInteger(passkeyUsedAtMs))
        )
          throw new Error('Invalid principal facts');
      }
      if (
        projectRow !== null &&
        ((projectRow.visibility !== 'public' &&
          projectRow.visibility !== 'private') ||
          (projectRow.state !== 'active' &&
            projectRow.state !== 'archived' &&
            projectRow.state !== 'deleted'))
      )
        throw new Error('Invalid project facts');
      if (
        membershipRow !== null &&
        !projectStaffRoles.includes(membershipRow.role)
      )
        throw new Error('Invalid membership facts');
      if (actorId !== null) {
        // A verified bearer credential implies an unrevoked issuance; a null
        // answer still fails closed rather than guessing an instant.
        if (issuedAtMs === null)
          throw new Error('No unrevoked token issuance for principal');
        if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0)
          throw new Error('Invalid token issuance');
      }
      const principal =
        principalRow !== null && actorId !== null
          ? Object.freeze({
              id: actorId,
              kind: principalRow.kind,
              status: principalRow.status,
              credentialActive: principalRow.credentialActive,
              expiresAtMs: principalRow.credentialActive ? farFutureMs : 0,
              authenticatedAtMs: issuedAtMs as number,
              assurance: ceremonyAssurance(principalRow.passkeyUsedAtMs, nowMs),
            })
          : null;
      // Membership is active only for staff principals holding a role row.
      const membership =
        principalRow?.kind === 'staff' && membershipRow !== null
          ? Object.freeze({
              principalId: request.actorId as string,
              projectId: request.target.projectId,
              active: true,
              role: membershipRow.role,
            })
          : null;
      const target = Object.freeze({ ...request.target });
      return Object.freeze({
        binding: Object.freeze({ ...request, target }),
        principal,
        project:
          projectRow === null
            ? deniedProject(request.target.projectId)
            : Object.freeze({
                id: request.target.projectId,
                visibility: projectRow.visibility,
                state: projectRow.state,
              }),
        membership,
        resource: Object.freeze({
          ref: target,
          deleted: false,
          publicReadable: true,
          permissionGranted: true,
        }),
      });
    },
  };
}
