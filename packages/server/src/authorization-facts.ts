import { AUTHORIZATION_TIMEOUT_MS } from './bounds.ts';
import type {
  AuthorizationFacts,
  AuthorizationResolver,
  InstanceRoleFacts,
  PermissionRequest,
  CredentialFacts,
  StaffRole,
} from '@hyperbug/security';

/** Default policy for isolated callers; createApp uses parsed runtime config. */
export const authorizationPolicy = Object.freeze({
  recentAuthMaxAgeMs: 300_000,
  timeoutMs: AUTHORIZATION_TIMEOUT_MS,
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
  } | null>;
  loadInstanceRole(principalId: string): Promise<InstanceRoleFacts | null>;
  loadProject(projectId: string): Promise<{
    visibility: 'public' | 'private';
    state: 'active' | 'archived';
  } | null>;
  loadMembership(
    projectId: string,
    principalId: string,
  ): Promise<{ role: StaffRole } | null>;
}

/** A missing project row becomes deny-shaped facts, not an error. */
function deniedProject(projectId: string) {
  return Object.freeze({
    id: projectId,
    visibility: 'private' as const,
    state: 'deleted' as const,
  });
}

function resolverFromDependencies(
  deps: DbAuthorizationDependencies,
): AuthorizationResolver {
  return {
    async resolve(
      request: PermissionRequest,
      signal: AbortSignal,
      credential: CredentialFacts | null = null,
    ): Promise<AuthorizationFacts> {
      if (signal.aborted) throw new Error('Aborted');
      const actorId = request.actorId;
      const scoped = request.target.type === 'instance';
      const principalRow =
        actorId === null ? null : await deps.loadPrincipal(actorId);
      const [projectRow, membershipRow, instanceRoleRow] = await Promise.all([
        scoped
          ? Promise.resolve(null)
          : deps.loadProject(request.target.projectId),
        actorId === null || scoped
          ? Promise.resolve(null)
          : deps.loadMembership(request.target.projectId, actorId),
        actorId === null || !scoped
          ? Promise.resolve(null)
          : deps.loadInstanceRole(actorId),
      ]);
      if (signal.aborted) throw new Error('Aborted');
      // Row shapes come validated from the adapters and the database CHECKs
      // (application validate*Insert/Input on writes, adapter mapping on
      // reads); this resolver adds no third shape layer. Only the semantic
      // guarantee below is enforced here.
      let authenticatedAtMs: number | null = null;
      let assurance: CredentialFacts['assurance'] | null = null;
      if (actorId !== null && credential !== null) {
        authenticatedAtMs = credential.authenticatedAtMs;
        assurance = credential.assurance;
      }
      if (actorId !== null && authenticatedAtMs === null) {
        // A verified bearer credential always carries its own ceremony facts;
        // a wiring gap fails closed rather than guessing an instant.
        throw new Error('Missing credential ceremony facts');
      }
      const principal =
        principalRow !== null && actorId !== null
          ? Object.freeze({
              id: actorId,
              kind: principalRow.kind,
              status: principalRow.status,
              credentialActive: principalRow.credentialActive,
              expiresAtMs: principalRow.credentialActive ? farFutureMs : 0,
              authenticatedAtMs: authenticatedAtMs as number,
              assurance: assurance as CredentialFacts['assurance'],
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
        instanceRole: instanceRoleRow,
        project: scoped
          ? Object.freeze({
              id: request.target.projectId,
              visibility: 'private' as const,
              state: 'active' as const,
            })
          : projectRow === null
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
          publicReadable: !scoped,
          permissionGranted: true,
        }),
      });
    },
  };
}

interface RequestFacts {
  readonly dependencies: DbAuthorizationDependencies;
  readonly resolver: AuthorizationResolver;
  readonly projects: Map<
    string,
    Promise<Awaited<ReturnType<DbAuthorizationDependencies['loadProject']>>>
  >;
}
const scopes = new WeakMap<
  AuthorizationResolver,
  {
    dependencies: DbAuthorizationDependencies;
    requests: WeakMap<Request, RequestFacts>;
  }
>();

function memoized<K, V>(
  cache: Map<K, Promise<V>>,
  key: K,
  load: () => Promise<V>,
): Promise<V> {
  let value = cache.get(key);
  if (value === undefined) {
    value = Promise.resolve().then(load);
    cache.set(key, value);
  }
  return value;
}
function requestFacts(
  request: Request,
  resolver: AuthorizationResolver,
): RequestFacts | null {
  const scope = scopes.get(resolver);
  if (!scope) return null;
  const existing = scope.requests.get(request);
  if (existing) return existing;
  const principals = new Map<
    string,
    Promise<Awaited<ReturnType<DbAuthorizationDependencies['loadPrincipal']>>>
  >();
  const projects = new Map<
    string,
    Promise<Awaited<ReturnType<DbAuthorizationDependencies['loadProject']>>>
  >();
  const memberships = new Map<
    string,
    Promise<Awaited<ReturnType<DbAuthorizationDependencies['loadMembership']>>>
  >();
  const instanceRoles = new Map<
    string,
    Promise<
      Awaited<ReturnType<DbAuthorizationDependencies['loadInstanceRole']>>
    >
  >();
  const dependencies: DbAuthorizationDependencies = {
    loadPrincipal: (id) =>
      memoized(principals, id, () => scope.dependencies.loadPrincipal(id)),
    loadProject: (id) =>
      memoized(projects, id, () => scope.dependencies.loadProject(id)),
    loadMembership: (projectId, principalId) =>
      memoized(memberships, `${projectId}:${principalId}`, () =>
        scope.dependencies.loadMembership(projectId, principalId),
      ),
    loadInstanceRole: (id) =>
      memoized(instanceRoles, id, () =>
        scope.dependencies.loadInstanceRole(id),
      ),
  };
  const facts = {
    dependencies,
    resolver: resolverFromDependencies(dependencies),
    projects,
  };
  scope.requests.set(request, facts);
  return facts;
}

/** Facts only, never decisions or credential assurance; lifetime is one HTTP Request. */
export function requestAuthorizationResolver(
  request: Request,
  resolver: AuthorizationResolver,
): AuthorizationResolver {
  return requestFacts(request, resolver)?.resolver ?? resolver;
}
/** Start a fresh authorization phase after awaited external acquisition. */
export function refreshAuthorizationFacts(
  request: Request,
  resolver: AuthorizationResolver | null,
): void {
  if (resolver) scopes.get(resolver)?.requests.delete(request);
}
export function seedAuthorizationProject(
  request: Request,
  resolver: AuthorizationResolver | null,
  projectId: string,
  project: Awaited<ReturnType<DbAuthorizationDependencies['loadProject']>>,
): void {
  if (resolver)
    requestFacts(request, resolver)?.projects.set(
      projectId,
      Promise.resolve(project === null ? null : Object.freeze({ ...project })),
    );
}
export function requestAuthorizationDependencies(
  request: Request,
  resolver: AuthorizationResolver | null,
): DbAuthorizationDependencies | null {
  return resolver === null
    ? null
    : (requestFacts(request, resolver)?.dependencies ?? null);
}
export function createDbAuthorizationResolver(
  dependencies: DbAuthorizationDependencies,
): AuthorizationResolver {
  const resolver = resolverFromDependencies(dependencies);
  scopes.set(resolver, { dependencies, requests: new WeakMap() });
  return resolver;
}
