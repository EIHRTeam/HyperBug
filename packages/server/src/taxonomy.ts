import type {
  IssueTypeRecord,
  LabelRecord,
  MilestoneView,
  TaxonomyStore,
} from '@hyperbug/application';
import {
  issueTypeView,
  isValidColor,
  isValidDescription,
  isValidDueDate,
  isValidIcon,
  isValidTaxonomyName,
  isValidTitle,
  labelView,
  milestoneView,
} from '@hyperbug/application';
import { RequestFailure } from './errors.ts';
import {
  projectBearer,
  requireVisibleProject,
  type ProjectContext,
} from './projects.ts';
import { credentialFactsOf, requireAuthorizedAction } from './authorization.ts';
import { withDeadline } from './bounds.ts';

const storeTimeoutMs = 1_000;

function store(context: ProjectContext): TaxonomyStore {
  if (!context.taxonomy) throw new RequestFailure('TAXONOMY_UNAVAILABLE');
  return context.taxonomy;
}

async function requireTaxonomyManager(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<void> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  // The archived-project read-only rule comes from the evaluator's write
  // check; the maintainer-or-higher role from the taxonomy:manage rule.
  await requireAuthorizedAction({
    httpRequest: request,
    request: {
      actorId: principal.principalId,
      permission: 'taxonomy:manage',
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
    credential: credentialFactsOf(principal),
  });
}

async function requireProjectReader(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<void> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    httpRequest: request,
    request: {
      actorId: principal?.principalId ?? null,
      permission: 'project:read',
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
    credential: credentialFactsOf(principal),
  });
}

function requiredRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new RequestFailure('TAXONOMY_INVALID');
  return value as number;
}

function checkedName(value: unknown): string {
  if (typeof value !== 'string' || !isValidTaxonomyName(value))
    throw new RequestFailure('TAXONOMY_INVALID');
  return value;
}

function checkedText(
  value: unknown,
  field: 'description' | 'icon',
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new RequestFailure('TAXONOMY_INVALID');
  if (field === 'description' && !isValidDescription(value))
    throw new RequestFailure('TAXONOMY_INVALID');
  if (field === 'icon' && !isValidIcon(value))
    throw new RequestFailure('TAXONOMY_INVALID');
  return value;
}

function checkedColor(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !isValidColor(value))
    throw new RequestFailure('TAXONOMY_INVALID');
  return value;
}

/** POST /api/v1/projects/:projectId/labels */
export async function createLabel(
  request: Request,
  context: ProjectContext,
  projectId: string,
  input: { name: unknown; description: unknown; color: unknown },
): Promise<ReturnType<typeof labelView>> {
  await requireTaxonomyManager(request, context, projectId);
  const name = checkedName(input.name);
  const description = checkedText(input.description, 'description') ?? '';
  const color = checkedColor(input.color) ?? '';
  const id = crypto.randomUUID();
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).createLabel({
      id,
      projectId,
      name,
      description,
      color,
    }),
  );
  if (outcome === 'name-conflict')
    throw new RequestFailure('TAXONOMY_CONFLICT');
  const records = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).listLabels(projectId),
  );
  const created = records.find((label: LabelRecord) => label.id === id);
  if (!created) throw new RequestFailure('TAXONOMY_UNAVAILABLE');
  return labelView(created);
}

/** GET /api/v1/projects/:projectId/labels */
export async function listLabels(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<readonly ReturnType<typeof labelView>[]> {
  await requireProjectReader(request, context, projectId);
  const records = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).listLabels(projectId),
  );
  return records.map(labelView);
}

/** PATCH /api/v1/projects/:projectId/labels/:labelId */
export async function updateLabel(
  request: Request,
  context: ProjectContext,
  projectId: string,
  labelId: string,
  input: {
    expectedRevision: unknown;
    name: unknown;
    description: unknown;
    color: unknown;
  },
): Promise<ReturnType<typeof labelView>> {
  await requireTaxonomyManager(request, context, projectId);
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).updateLabel({
      id: labelId,
      projectId,
      expectedRevision: requiredRevision(input.expectedRevision),
      name: input.name === undefined ? null : checkedName(input.name),
      description: checkedText(input.description, 'description'),
      color: checkedColor(input.color),
    }),
  );
  if (outcome.outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome.outcome === 'name-conflict')
    throw new RequestFailure('TAXONOMY_CONFLICT');
  if (outcome.outcome === 'conflict')
    throw new RequestFailure('REVISION_CONFLICT');
  return labelView(outcome.record);
}

/** DELETE /api/v1/projects/:projectId/labels/:labelId */
export async function deleteLabel(
  request: Request,
  context: ProjectContext,
  projectId: string,
  labelId: string,
): Promise<void> {
  await requireTaxonomyManager(request, context, projectId);
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).deleteLabel(projectId, labelId),
  );
  if (outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome === 'referenced') throw new RequestFailure('TAXONOMY_CONFLICT');
}

/** POST /api/v1/projects/:projectId/issue-types */
export async function createIssueType(
  request: Request,
  context: ProjectContext,
  projectId: string,
  input: {
    name: unknown;
    description: unknown;
    icon: unknown;
    color: unknown;
    position: unknown;
    enabled: unknown;
  },
): Promise<ReturnType<typeof issueTypeView>> {
  await requireTaxonomyManager(request, context, projectId);
  const name = checkedName(input.name);
  if (
    input.position !== undefined &&
    (!Number.isSafeInteger(input.position) || (input.position as number) < 0)
  )
    throw new RequestFailure('TAXONOMY_INVALID');
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean')
    throw new RequestFailure('TAXONOMY_INVALID');
  const id = crypto.randomUUID();
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).createIssueType({
      id,
      projectId,
      name,
      description: checkedText(input.description, 'description') ?? '',
      icon: checkedText(input.icon, 'icon') ?? '',
      color: checkedColor(input.color) ?? '',
      position: input.position === undefined ? 0 : (input.position as number),
      enabled: input.enabled === undefined ? true : (input.enabled as boolean),
    }),
  );
  if (outcome === 'name-conflict')
    throw new RequestFailure('TAXONOMY_CONFLICT');
  const records = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).listIssueTypes(projectId),
  );
  const created = records.find((type: IssueTypeRecord) => type.id === id);
  if (!created) throw new RequestFailure('TAXONOMY_UNAVAILABLE');
  return issueTypeView(created);
}

/** GET /api/v1/projects/:projectId/issue-types */
export async function listIssueTypes(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<readonly ReturnType<typeof issueTypeView>[]> {
  await requireProjectReader(request, context, projectId);
  const records = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).listIssueTypes(projectId),
  );
  return records.map(issueTypeView);
}

/** PATCH /api/v1/projects/:projectId/issue-types/:typeId */
export async function updateIssueType(
  request: Request,
  context: ProjectContext,
  projectId: string,
  typeId: string,
  input: {
    expectedRevision: unknown;
    name: unknown;
    description: unknown;
    icon: unknown;
    color: unknown;
    position: unknown;
    enabled: unknown;
  },
): Promise<ReturnType<typeof issueTypeView>> {
  await requireTaxonomyManager(request, context, projectId);
  if (
    input.position !== undefined &&
    (!Number.isSafeInteger(input.position) || (input.position as number) < 0)
  )
    throw new RequestFailure('TAXONOMY_INVALID');
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean')
    throw new RequestFailure('TAXONOMY_INVALID');
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).updateIssueType({
      id: typeId,
      projectId,
      expectedRevision: requiredRevision(input.expectedRevision),
      name: input.name === undefined ? null : checkedName(input.name),
      description: checkedText(input.description, 'description'),
      icon: checkedText(input.icon, 'icon'),
      color: checkedColor(input.color),
      position:
        input.position === undefined ? null : (input.position as number),
      enabled: input.enabled === undefined ? null : (input.enabled as boolean),
    }),
  );
  if (outcome.outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome.outcome === 'name-conflict')
    throw new RequestFailure('TAXONOMY_CONFLICT');
  if (outcome.outcome === 'conflict')
    throw new RequestFailure('REVISION_CONFLICT');
  return issueTypeView(outcome.record);
}

/** DELETE /api/v1/projects/:projectId/issue-types/:typeId */
export async function deleteIssueType(
  request: Request,
  context: ProjectContext,
  projectId: string,
  typeId: string,
): Promise<void> {
  await requireTaxonomyManager(request, context, projectId);
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).deleteIssueType(projectId, typeId),
  );
  if (outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome === 'referenced') throw new RequestFailure('TAXONOMY_CONFLICT');
}

/** POST /api/v1/projects/:projectId/milestones */
export async function createMilestone(
  request: Request,
  context: ProjectContext,
  projectId: string,
  input: {
    title: unknown;
    description: unknown;
    dueDate: unknown;
  },
): Promise<ReturnType<typeof milestoneView>> {
  await requireTaxonomyManager(request, context, projectId);
  if (typeof input.title !== 'string' || !isValidTitle(input.title))
    throw new RequestFailure('TAXONOMY_INVALID');
  const description = checkedText(input.description, 'description') ?? '';
  const dueDate = input.dueDate === undefined ? null : input.dueDate;
  if (typeof dueDate !== 'string' && dueDate !== null)
    throw new RequestFailure('TAXONOMY_INVALID');
  if (!isValidDueDate(dueDate)) throw new RequestFailure('TAXONOMY_INVALID');
  const id = crypto.randomUUID();
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).createMilestone({
      id,
      projectId,
      title: input.title as string,
      description,
      dueDate,
      nowMs: Date.now(),
    }),
  );
  if (outcome !== 'created') throw new RequestFailure('TAXONOMY_UNAVAILABLE');
  const milestones = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).listMilestones(projectId),
  );
  const created = milestones.find(
    (milestone: MilestoneView) => milestone.id === id,
  );
  if (!created) throw new RequestFailure('TAXONOMY_UNAVAILABLE');
  return milestoneView(created);
}

/** GET /api/v1/projects/:projectId/milestones */
export async function listMilestones(
  request: Request,
  context: ProjectContext,
  projectId: string,
): Promise<readonly ReturnType<typeof milestoneView>[]> {
  await requireProjectReader(request, context, projectId);
  const records = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).listMilestones(projectId),
  );
  return records.map(milestoneView);
}

/** PATCH /api/v1/projects/:projectId/milestones/:milestoneId */
export async function updateMilestone(
  request: Request,
  context: ProjectContext,
  projectId: string,
  milestoneId: string,
  input: {
    expectedRevision: unknown;
    title: unknown;
    description: unknown;
    dueDate: unknown;
    state: unknown;
  },
): Promise<ReturnType<typeof milestoneView>> {
  await requireTaxonomyManager(request, context, projectId);
  if (
    input.title !== undefined &&
    (typeof input.title !== 'string' || !isValidTitle(input.title))
  )
    throw new RequestFailure('TAXONOMY_INVALID');
  if (
    input.state !== undefined &&
    input.state !== 'open' &&
    input.state !== 'closed'
  )
    throw new RequestFailure('TAXONOMY_INVALID');
  const dueDate =
    input.dueDate === undefined
      ? undefined
      : input.dueDate === null
        ? null
        : input.dueDate;
  if (
    dueDate !== undefined &&
    (typeof dueDate !== 'string' || !isValidDueDate(dueDate))
  )
    throw new RequestFailure('TAXONOMY_INVALID');
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).updateMilestone({
      id: milestoneId,
      projectId,
      expectedRevision: requiredRevision(input.expectedRevision),
      title: input.title === undefined ? null : (input.title as string),
      description: checkedText(input.description, 'description'),
      dueDate,
      state:
        input.state === undefined ? null : (input.state as 'open' | 'closed'),
      nowMs: Date.now(),
    }),
  );
  if (outcome.outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome.outcome === 'conflict')
    throw new RequestFailure('REVISION_CONFLICT');
  return milestoneView(outcome.record);
}

/** DELETE /api/v1/projects/:projectId/milestones/:milestoneId */
export async function deleteMilestone(
  request: Request,
  context: ProjectContext,
  projectId: string,
  milestoneId: string,
): Promise<void> {
  await requireTaxonomyManager(request, context, projectId);
  const outcome = await withDeadline(request.signal, storeTimeoutMs, () =>
    store(context).deleteMilestone(projectId, milestoneId),
  );
  if (outcome === 'not-found') throw new RequestFailure('NOT_FOUND');
  if (outcome === 'referenced') throw new RequestFailure('TAXONOMY_CONFLICT');
}
