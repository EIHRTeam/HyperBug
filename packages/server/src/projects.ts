import type {
  AccountAdministrationStore,
  OAuthAccessTokenStore,
  OAuthCodeStore,
  ProjectRoleStore,
  ProjectStore,
  ProjectView,
  TaxonomyStore,
} from '@hyperbug/application';
import {
  isValidProjectName,
  isValidProjectSlug,
  projectView,
} from '@hyperbug/application';
import type {
  AuthorizationPolicy,
  AuthorizationResolver,
  KeyProvider,
} from '@hyperbug/security';
import { authenticateBearer, type BearerPrincipal } from './bearer-auth.ts';
import { requireAuthorizedAction } from './authorization.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

/** Everything the project handlers need, supplied by the app. */
export interface ProjectContext {
  readonly keyProvider: KeyProvider | null;
  readonly tokenStore: (OAuthCodeStore & OAuthAccessTokenStore) | null;
  readonly authorizationResolver: AuthorizationResolver | null;
  readonly authorizationPolicy: AuthorizationPolicy;
  readonly roleStore: ProjectRoleStore | null;
  readonly administration: AccountAdministrationStore | null;
  readonly projects: ProjectStore | null;
  readonly taxonomy: TaxonomyStore | null;
}

const storeTimeoutMs = 1_000;

function store(context: ProjectContext): ProjectStore {
  if (!context.projects) throw new RequestFailure('PROJECT_UNAVAILABLE');
  return context.projects;
}

async function bearer(
  request: Request,
  context: ProjectContext,
): Promise<BearerPrincipal | null> {
  return authenticateBearer(request, {
    keyProvider: context.keyProvider,
    tokenStore: context.tokenStore,
  });
}

/**
 * Project creation is a Staff action (PRODUCT §3.2): an active staff
 * principal creates the project and receives its first administrator role in
 * the store's atomic create. There is no deployment-scope target in the
 * permission inventory, so the guard here is the same staff-kind/active
 * check the membership route applies to its targets.
 */
export async function createProject(
  request: Request,
  context: ProjectContext,
  input: { slug: unknown; name: unknown; visibility: unknown },
): Promise<ProjectView> {
  const principal = await bearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.administration) throw new RequestFailure('PROJECT_UNAVAILABLE');
  const actor = await withDeadline(request.signal, storeTimeoutMs, () =>
    context.administration!.loadPrincipal(principal.principalId),
  );
  if (!actor || actor.kind !== 'staff' || actor.status !== 'active')
    throw new RequestFailure('FORBIDDEN');
  if (
    typeof input.slug !== 'string' ||
    !isValidProjectSlug(input.slug) ||
    typeof input.name !== 'string' ||
    !isValidProjectName(input.name)
  )
    throw new RequestFailure('PROJECT_INVALID');
  const visibility =
    input.visibility === undefined ? 'public' : input.visibility;
  if (visibility !== 'public' && visibility !== 'private')
    throw new RequestFailure('PROJECT_INVALID');
  const id = crypto.randomUUID();
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).create({
      id,
      slug: input.slug as string,
      name: input.name as string,
      visibility,
      administratorPrincipalId: principal.principalId,
      nowMs: Date.now(),
    }),
  );
  if (outcome === 'slug-conflict') throw new RequestFailure('PROJECT_CONFLICT');
  const record = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).load(id),
  );
  if (!record) throw new RequestFailure('PROJECT_UNAVAILABLE');
  return projectView(record);
}

/**
 * The visibility pre-check makes private projects invisible (404) to
 * anonymous callers and non-members before any permission semantics could
 * disclose existence; members then run the shared guard so suspension,
 * stale tokens and policy all keep failing closed.
 */
/**
 * The visibility pre-check makes private projects invisible (404) to
 * anonymous callers and non-members before any permission semantics could
 * disclose existence; members then run the shared guard so suspension,
 * stale tokens and policy all keep failing closed.
 */
export async function requireVisibleProject(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<void> {
  const record = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).load(projectId),
  );
  if (!record) throw new RequestFailure('NOT_FOUND');
  if (record.visibility === 'private') {
    const principal = await bearer(request, context);
    if (!principal) throw new RequestFailure('NOT_FOUND');
    if (!context.roleStore || !context.authorizationResolver)
      throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
    const membership = await withDeadline(request.signal, storeTimeoutMs, () =>
      context.roleStore!.loadRole(projectId, principal.principalId),
    );
    if (!membership) throw new RequestFailure('NOT_FOUND');
  }
}

export async function projectBearer(
  request: Request,
  context: ProjectContext,
): Promise<BearerPrincipal | null> {
  return bearer(request, context);
}

/** GET /api/v1/projects/:projectId — visibility-aware public read. */
export async function readProject(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<ProjectView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await bearer(request, context);
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    request: {
      actorId: principal?.principalId ?? null,
      permission: 'project:read',
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
  });
  const record = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).load(projectId),
  );
  if (!record) throw new RequestFailure('NOT_FOUND');
  return projectView(record);
}

/** PATCH /api/v1/projects/:projectId — configure at the observed revision. */
export async function configureProject(
  request: Request,
  context: ProjectContext,
  projectId: string,
  input: {
    expectedRevision: unknown;
    name: unknown;
    visibility: unknown;
  },
): Promise<ProjectView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await bearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    request: {
      actorId: principal.principalId,
      permission: 'project:configure',
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
  });
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    (input.expectedRevision as number) < 1
  )
    throw new RequestFailure('PROJECT_INVALID');
  if (
    input.name !== undefined &&
    (typeof input.name !== 'string' || !isValidProjectName(input.name))
  )
    throw new RequestFailure('PROJECT_INVALID');
  if (
    input.visibility !== undefined &&
    input.visibility !== 'public' &&
    input.visibility !== 'private'
  )
    throw new RequestFailure('PROJECT_INVALID');
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).configure({
      id: projectId,
      expectedRevision: input.expectedRevision as number,
      name: input.name === undefined ? null : (input.name as string),
      visibility:
        input.visibility === undefined
          ? null
          : (input.visibility as 'public' | 'private'),
      nowMs: Date.now(),
    }),
  );
  if (outcome.outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome.outcome === 'conflict')
    throw new RequestFailure('REVISION_CONFLICT');
  return projectView(outcome.record);
}

/** POST /api/v1/projects/:projectId/archive — archive-before-delete. */
export async function archiveProject(
  request: Request,
  context: ProjectContext,
  projectId: string,
  expectedRevision: unknown,
): Promise<ProjectView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await bearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    request: {
      actorId: principal.principalId,
      permission: 'project:configure',
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
  });
  if (
    !Number.isSafeInteger(expectedRevision) ||
    (expectedRevision as number) < 1
  )
    throw new RequestFailure('PROJECT_INVALID');
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).archive({
      id: projectId,
      expectedRevision: expectedRevision as number,
      nowMs: Date.now(),
    }),
  );
  if (outcome.outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome.outcome === 'conflict')
    throw new RequestFailure('REVISION_CONFLICT');
  return projectView(outcome.record);
}
