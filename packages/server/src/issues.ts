import { contentRepresentation, storedPreview } from './content.ts';
import { deriveMarkdownTree, type SafeTree } from '@hyperbug/security/markdown';
import {
  DomainError,
  validateContent,
  type Issue,
  type IssueListItem,
} from '@hyperbug/domain';
import {
  closeReasons,
  maxIssueAssignees,
  maxIssueLabels,
  type CloseIssueIntent,
  type CreateIssueIntent,
  type EditIssueIntent,
  type IssueRepository,
  type ReopenIssueIntent,
  type SetIssueAssigneesIntent,
  type SetIssueLabelsIntent,
  type SetIssueMilestoneIntent,
  type SetIssueTypeIntent,
  type ContentDefinitionStore,
  type IssueFormSubmissionIntent,
  IssueFormError,
  validateIssueFormAnswers,
} from '@hyperbug/application';
import type { Permission } from '@hyperbug/security';
import type { BearerPrincipal } from './bearer-auth.ts';
import { requireAuthorizedAction } from './authorization.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
import {
  projectBearer,
  requireVisibleProject,
  type ProjectContext,
} from './projects.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';
import { mutationIdentityOf } from './mutation-identity.ts';

const storeTimeoutMs = 1_000;
const receiptValidityMs = 86_400_000;

/** Everything the issue handlers need, supplied by the app. */
export interface IssueContext extends ProjectContext {
  readonly issues: IssueRepository | null;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'requireRate'> | null;
  readonly contentDefinitions: ContentDefinitionStore | null;
}

function repository(context: IssueContext): IssueRepository {
  if (!context.issues) throw new RequestFailure('ISSUE_UNAVAILABLE');
  return context.issues;
}

/** Provisional local budgets; production numbers are the staging milestone. */
const issueCreateRule = Object.freeze({
  limit: 60,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});
const issueProjectRule = Object.freeze({
  limit: 1_200,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});

function mapDomainError(error: unknown): never {
  if (error instanceof IssueFormError) throw new RequestFailure(error.code);
  if (error instanceof DomainError) {
    if (error.code === 'NOT_FOUND') throw new RequestFailure('NOT_FOUND');
    if (error.code === 'REVISION_CONFLICT')
      throw new RequestFailure('REVISION_CONFLICT');
    if (error.code === 'IDEMPOTENCY_CONFLICT')
      throw new RequestFailure('IDEMPOTENCY_CONFLICT');
    if (error.code === 'IDEMPOTENCY_EXPIRED')
      throw new RequestFailure('IDEMPOTENCY_EXPIRED');
    if (error.code === 'INVALID_CURSOR')
      throw new RequestFailure('INVALID_CURSOR');
    if (error.code === 'CURSOR_STALE')
      throw new RequestFailure('INVALID_CURSOR');
    throw new RequestFailure('ISSUE_INVALID');
  }
  if (error instanceof RequestFailure) throw error;
  throw new RequestFailure('ISSUE_UNAVAILABLE');
}

async function requireIssuePermission(
  request: Request,
  context: IssueContext,
  principal: BearerPrincipal | null,
  permission: Permission,
  projectId: string,
  issueId: string,
  targetType: 'issue' | 'project' = 'issue',
): Promise<void> {
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    request: {
      actorId: principal?.principalId ?? null,
      permission,
      target: {
        projectId,
        type: targetType,
        id: targetType === 'project' ? projectId : issueId,
      },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
  });
}

/** Moderators see hidden and redacted rows; everyone else sees visible only. */
async function mayModerate(
  request: Request,
  context: IssueContext,
  principal: BearerPrincipal | null,
  projectId: string,
  issueId: string,
): Promise<boolean> {
  try {
    await requireIssuePermission(
      request,
      context,
      principal,
      'issue:moderate',
      projectId,
      issueId,
    );
    return true;
  } catch {
    return false;
  }
}

export interface IssueView {
  readonly id: string;
  readonly projectId: string;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly preview: string | null;
  readonly textProjectionVersion: string | null;
  readonly bodyTree?: SafeTree;
  readonly contentPolicyVersion?: string;
  readonly representationEtag?: string;
  readonly state: string;
  readonly closeReason: string | null;
  readonly typeId: string | null;
  readonly milestoneId: string | null;
  readonly moderation: string;
  readonly authorId: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly labelIds: readonly string[];
  readonly assigneeIds: readonly string[];
}

function viewOf(
  issue: Issue | IssueListItem,
  labelIds: readonly string[],
  assigneeIds: readonly string[],
): IssueView {
  return {
    id: issue.id,
    projectId: issue.projectId,
    number: issue.number,
    title: issue.title,
    body: 'body' in issue ? issue.body : null,
    preview:
      issue.moderation === 'visible' && issue.deletedAt === null
        ? storedPreview(issue.bodyText)
        : null,
    textProjectionVersion:
      issue.moderation === 'visible' && issue.deletedAt === null
        ? issue.bodyTextVersion
        : null,
    ...('body' in issue &&
    issue.moderation === 'visible' &&
    issue.deletedAt === null
      ? contentRepresentation(issue.id, issue.revision, issue.body)
      : {}),
    state: issue.state,
    closeReason: issue.closeReason,
    typeId: issue.typeId,
    milestoneId: issue.milestoneId,
    moderation: issue.moderation,
    authorId: issue.authorId,
    revision: issue.revision,
    createdAt: new Date(issue.createdAt).toISOString(),
    updatedAt: new Date(issue.updatedAt).toISOString(),
    closedAt:
      issue.closedAt === null ? null : new Date(issue.closedAt).toISOString(),
    labelIds: [...labelIds],
    assigneeIds: [...assigneeIds],
  };
}

async function detailView(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  includeHidden: boolean,
): Promise<IssueView> {
  const issue = await withDeadline(request.signal, storeTimeoutMs, () =>
    repository(context).getIssue(projectId, issueId, { includeHidden }),
  );
  if (!issue) throw new RequestFailure('NOT_FOUND');
  const relations = await withDeadline(request.signal, storeTimeoutMs, () =>
    repository(context).relations(projectId, [issueId]),
  );
  return viewOf(
    issue,
    relations.labels.get(issueId) ?? [],
    relations.assignees.get(issueId) ?? [],
  );
}

function checkedUuidList(values: unknown, maximum: number): readonly string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values) || values.length > maximum)
    throw new RequestFailure('ISSUE_INVALID');
  const pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string' || !pattern.test(value))
      throw new RequestFailure('ISSUE_INVALID');
    if (seen.has(value)) throw new RequestFailure('ISSUE_INVALID');
    seen.add(value);
  }
  return values as string[];
}

function checkedOptionalUuid(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (typeof value !== 'string' || !pattern.test(value))
    throw new RequestFailure('ISSUE_INVALID');
  return value;
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new RequestFailure('ISSUE_INVALID');
  return value as number;
}

/** POST /api/v1/projects/:projectId/issues */
export async function createIssue(
  request: Request,
  context: IssueContext,
  projectId: string,
  requestId: string,
  input: {
    title: unknown;
    body: unknown;
    typeId: unknown;
    milestoneId: unknown;
    labelIds: unknown;
    assigneeIds: unknown;
    form?: { id: string; version: number; draftId?: string; values: unknown };
  },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssuePermission(
    request,
    context,
    principal,
    'issue:create',
    projectId,
    projectId,
    'project',
  );
  if (context.admission)
    await context.admission.requireRate({
      request,
      category: 'issue-create',
      checks: [
        {
          dimension: 'principal',
          canonicalSubject: principal.principalId,
          rule: issueCreateRule,
        },
        {
          dimension: 'project',
          canonicalSubject: projectId,
          rule: issueProjectRule,
        },
      ],
      nowMs: Date.now(),
      signal: request.signal,
      timeoutMs: 1000,
    });
  let title = input.title;
  let body = input.body;
  let formSubmission: IssueFormSubmissionIntent | undefined;
  if (input.form) {
    if (!context.contentDefinitions)
      throw new RequestFailure('CONTENT_UNAVAILABLE');
    const form = await withDeadline(request.signal, storeTimeoutMs, () =>
      context.contentDefinitions!.getForm(
        projectId,
        input.form!.id,
        input.form!.version,
      ),
    );
    if (!form) throw new RequestFailure('FORM_VERSION_STALE');
    try {
      // Read the pinned immutable schema; active-version and defaults checks
      // belong after the repository's successful-receipt replay check.
      const answers = validateIssueFormAnswers(
        form.definition,
        input.form.values,
      );
      if (answers.attachmentIds.length && !input.form.draftId)
        throw new RequestFailure('FORM_ATTACHMENTS_INVALID');
      body = answers.markdown;
      title = title === undefined ? form.definition.title : title;
      formSubmission = {
        formId: form.id,
        formVersion: form.version,
        ...(input.form.draftId ? { draftId: input.form.draftId } : {}),
        values: answers.values,
      };
    } catch (error) {
      mapDomainError(error);
    }
  }
  if (typeof title !== 'string' || typeof body !== 'string')
    throw new RequestFailure('ISSUE_INVALID');
  try {
    validateContent(title, body);
    deriveMarkdownTree(body);
  } catch {
    throw new RequestFailure('ISSUE_INVALID');
  }
  const intent: CreateIssueIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'issue.create',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: crypto.randomUUID(),
    title,
    body,
    typeId: checkedOptionalUuid(input.typeId),
    milestoneId: checkedOptionalUuid(input.milestoneId),
    labelIds: checkedUuidList(input.labelIds, maxIssueLabels),
    assigneeIds: checkedUuidList(input.assigneeIds, maxIssueAssignees),
    ...(formSubmission ? { formSubmission } : {}),
  };
  let created: { id: string };
  try {
    const outcome = await withDeadline(request.signal, 5_000, () =>
      repository(context).createIssue(intent),
    );
    // A replayed receipt returns the original aggregate's snapshot, so the
    // response must address the original id, never the fresh one.
    created = outcome.result;
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, created.id, false);
}

export interface IssuePageView {
  readonly items: readonly IssueView[];
  readonly nextCursor: string | null;
}

/** GET /api/v1/projects/:projectId/issues */
export async function listIssues(
  request: Request,
  context: IssueContext,
  projectId: string,
  query: { state?: unknown; limit?: unknown; cursor?: unknown },
): Promise<IssuePageView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  let includeHidden = false;
  if (principal) {
    // A hidden row is only ever listed for a principal that may moderate.
    includeHidden = await mayModerate(
      request,
      context,
      principal,
      projectId,
      projectId,
    );
  }
  await requireIssuePermission(
    request,
    context,
    principal,
    'project:read',
    projectId,
    projectId,
    'project',
  );
  if (
    (query.state !== undefined &&
      query.state !== 'open' &&
      query.state !== 'closed') ||
    (query.limit !== undefined &&
      (!Number.isSafeInteger(query.limit) ||
        (query.limit as number) < 1 ||
        (query.limit as number) > 100)) ||
    (query.cursor !== undefined &&
      (typeof query.cursor !== 'string' || query.cursor.length > 1024))
  )
    throw new RequestFailure('ISSUE_INVALID');
  try {
    const page = await withDeadline(request.signal, storeTimeoutMs, () =>
      repository(context).listIssues({
        projectId,
        ...(query.state === undefined
          ? {}
          : { state: query.state as 'open' | 'closed' }),
        ...(query.limit === undefined ? {} : { limit: query.limit as number }),
        ...(query.cursor === undefined
          ? {}
          : { after: query.cursor as string }),
        includeHidden,
      }),
    );
    const relations = await withDeadline(request.signal, storeTimeoutMs, () =>
      repository(context).relations(
        projectId,
        page.items.map((item) => item.id),
      ),
    );
    return {
      items: page.items.map((item) =>
        viewOf(
          item,
          relations.labels.get(item.id) ?? [],
          relations.assignees.get(item.id) ?? [],
        ),
      ),
      nextCursor: page.nextCursor,
    };
  } catch (error) {
    mapDomainError(error);
  }
}

/** GET /api/v1/projects/:projectId/issues/:issueId */
export async function readIssue(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  const includeHidden = principal
    ? await mayModerate(request, context, principal, projectId, issueId)
    : false;
  await requireIssuePermission(
    request,
    context,
    principal,
    'issue:read',
    projectId,
    issueId,
  );
  return detailView(request, context, projectId, issueId, includeHidden);
}

/** PATCH /api/v1/projects/:projectId/issues/:issueId — own content or moderate. */
export async function editIssue(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown; title: unknown; body: unknown },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  const issue = await withDeadline(request.signal, storeTimeoutMs, () =>
    repository(context).getIssue(projectId, issueId, { includeHidden: true }),
  );
  if (!issue) throw new RequestFailure('NOT_FOUND');
  const ownVisible =
    issue.authorId === principal.principalId && issue.moderation === 'visible';
  await requireIssuePermission(
    request,
    context,
    principal,
    ownVisible ? 'issue:update' : 'issue:moderate',
    projectId,
    issueId,
  );
  if (typeof input.title !== 'string' || typeof input.body !== 'string')
    throw new RequestFailure('ISSUE_INVALID');
  try {
    validateContent(input.title, input.body);
    deriveMarkdownTree(input.body);
  } catch {
    throw new RequestFailure('ISSUE_INVALID');
  }
  const intent: EditIssueIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'issue.edit',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: issueId,
    expectedRevision: checkedRevision(input.expectedRevision),
    title: input.title,
    body: input.body,
  };
  try {
    await withDeadline(request.signal, 5_000, () =>
      repository(context).editIssue(intent),
    );
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, issueId, true);
}

/** POST /api/v1/projects/:projectId/issues/:issueId/close */
export async function closeIssue(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown; reason: unknown },
): Promise<IssueView> {
  return stateChange(
    request,
    context,
    projectId,
    issueId,
    requestId,
    'issue.close',
    'issue:close',
    input,
  );
}

/** POST /api/v1/projects/:projectId/issues/:issueId/reopen */
export async function reopenIssue(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown },
): Promise<IssueView> {
  return stateChange(
    request,
    context,
    projectId,
    issueId,
    requestId,
    'issue.reopen',
    'issue:close',
    input,
  );
}

async function stateChange(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  operation: 'issue.close' | 'issue.reopen',
  permission: 'issue:close',
  input: { expectedRevision: unknown; reason?: unknown },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssuePermission(
    request,
    context,
    principal,
    permission,
    projectId,
    issueId,
  );
  const expectedRevision = checkedRevision(input.expectedRevision);
  const identity = await mutationIdentityOf(
    request,
    requestId,
    operation,
    JSON.stringify(input),
    principal.principalId,
    projectId,
    receiptValidityMs,
  );
  try {
    if (operation === 'issue.close') {
      if (
        typeof input.reason !== 'string' ||
        !(closeReasons as readonly string[]).includes(input.reason)
      )
        throw new RequestFailure('ISSUE_INVALID');
      const intent: CloseIssueIntent = {
        ...identity,
        id: issueId,
        expectedRevision,
        reason: input.reason as CloseIssueIntent['reason'],
      };
      await withDeadline(request.signal, 5_000, () =>
        repository(context).closeIssue(intent),
      );
    } else {
      const intent: ReopenIssueIntent = {
        ...identity,
        id: issueId,
        expectedRevision,
      };
      await withDeadline(request.signal, 5_000, () =>
        repository(context).reopenIssue(intent),
      );
    }
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, issueId, true);
}

/** PUT /api/v1/projects/:projectId/issues/:issueId/labels */
export async function setIssueLabels(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown; labelIds: unknown },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssuePermission(
    request,
    context,
    principal,
    'issue:triage',
    projectId,
    issueId,
  );
  const intent: SetIssueLabelsIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'issue.labels',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: issueId,
    expectedRevision: checkedRevision(input.expectedRevision),
    labelIds: checkedUuidList(input.labelIds, maxIssueLabels),
  };
  try {
    await withDeadline(request.signal, 5_000, () =>
      repository(context).setIssueLabels(intent),
    );
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, issueId, true);
}

/** PUT /api/v1/projects/:projectId/issues/:issueId/assignees */
export async function setIssueAssignees(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown; assigneeIds: unknown },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssuePermission(
    request,
    context,
    principal,
    'issue:assign',
    projectId,
    issueId,
  );
  const intent: SetIssueAssigneesIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'issue.assignees',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: issueId,
    expectedRevision: checkedRevision(input.expectedRevision),
    assigneeIds: checkedUuidList(input.assigneeIds, maxIssueAssignees),
  };
  try {
    await withDeadline(request.signal, 5_000, () =>
      repository(context).setIssueAssignees(intent),
    );
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, issueId, true);
}

/** PUT /api/v1/projects/:projectId/issues/:issueId/type */
export async function setIssueType(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown; typeId: unknown },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssuePermission(
    request,
    context,
    principal,
    'issue:triage',
    projectId,
    issueId,
  );
  const intent: SetIssueTypeIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'issue.type',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: issueId,
    expectedRevision: checkedRevision(input.expectedRevision),
    typeId: checkedOptionalUuid(input.typeId),
  };
  try {
    await withDeadline(request.signal, 5_000, () =>
      repository(context).setIssueType(intent),
    );
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, issueId, true);
}

/** PUT /api/v1/projects/:projectId/issues/:issueId/milestone */
export async function setIssueMilestone(
  request: Request,
  context: IssueContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { expectedRevision: unknown; milestoneId: unknown },
): Promise<IssueView> {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssuePermission(
    request,
    context,
    principal,
    'issue:triage',
    projectId,
    issueId,
  );
  const intent: SetIssueMilestoneIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'issue.milestone',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: issueId,
    expectedRevision: checkedRevision(input.expectedRevision),
    milestoneId: checkedOptionalUuid(input.milestoneId),
  };
  try {
    await withDeadline(request.signal, 5_000, () =>
      repository(context).setIssueMilestone(intent),
    );
  } catch (error) {
    mapDomainError(error);
  }
  return detailView(request, context, projectId, issueId, true);
}
