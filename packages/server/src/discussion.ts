import { commentContentView, contentRepresentation } from './content.ts';
import { deriveMarkdownTree } from '@hyperbug/security/markdown';
import {
  isReactionValue,
  validateCommentIntent,
  type CommentCreateIntent,
  type CommentEditIntent,
  type CommentRecord,
  type CommentStore,
  type ReactionStore,
  type ReactionValue,
  type TimelineItem,
  type TimelineStore,
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

/** Everything the discussion handlers need, supplied by the app. */
export interface DiscussionContext extends ProjectContext {
  readonly comments: CommentStore | null;
  readonly reactions: ReactionStore | null;
  readonly timeline: TimelineStore | null;
  readonly issues: import('@hyperbug/application').IssueRepository | null;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'requireRate'> | null;
}

/** Provisional local budgets; production numbers are the staging milestone. */
const commentCreateRule = Object.freeze({
  limit: 120,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});
const discussionProjectRule = Object.freeze({
  limit: 2_400,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});
const reactionRule = Object.freeze({
  limit: 240,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});

function comments(context: DiscussionContext): CommentStore {
  if (!context.comments) throw new RequestFailure('ISSUE_UNAVAILABLE');
  return context.comments;
}

async function requirePermission(
  request: Request,
  context: DiscussionContext,
  principal: BearerPrincipal | null,
  permission: Permission,
  projectId: string,
  targetId: string,
  targetType: 'issue' | 'comment',
): Promise<void> {
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    request: {
      actorId: principal?.principalId ?? null,
      permission,
      target: { projectId, type: targetType, id: targetId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
  });
}

async function requireAdmission(
  request: Request,
  context: DiscussionContext,
  principalId: string,
  projectId: string,
  category: 'comment-create' | 'reaction',
  rule: { limit: number; windowMs: number; retentionMs: number },
): Promise<void> {
  if (!context.admission) return;
  await context.admission.requireRate({
    request,
    category,
    checks: [
      { dimension: 'principal', canonicalSubject: principalId, rule },
      {
        dimension: 'project',
        canonicalSubject: projectId,
        rule: discussionProjectRule,
      },
    ],
    nowMs: Date.now(),
    signal: request.signal,
    timeoutMs: 1000,
  });
}

/**
 * A moderated or deleted comment exists only for moderators and its own
 * author; anyone else gets the same 404 as for a missing comment, so the
 * permission outcome cannot reveal it.
 */
function requireCommentKnown(
  record: CommentRecord,
  principal: BearerPrincipal,
  moderator: boolean,
): void {
  const publicVisible =
    record.moderation === 'visible' && record.deletedAt === null;
  if (!moderator && !publicVisible && record.authorId !== principal.principalId)
    throw new RequestFailure('NOT_FOUND');
}

function checkedBody(value: unknown): string {
  if (typeof value !== 'string') throw new RequestFailure('ISSUE_INVALID');
  const length = [...value].length;
  if (length < 1 || length > 32768 || value.includes('\0'))
    throw new RequestFailure('ISSUE_INVALID');
  try {
    deriveMarkdownTree(value);
  } catch {
    throw new RequestFailure('ISSUE_INVALID');
  }
  return value;
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new RequestFailure('ISSUE_INVALID');
  return value as number;
}

async function loadComment(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  commentId: string,
  includeHidden: boolean,
): Promise<CommentRecord> {
  const record = await withDeadline(request.signal, storeTimeoutMs, () =>
    comments(context).get(projectId, issueId, commentId, { includeHidden }),
  );
  if (!record) throw new RequestFailure('NOT_FOUND');
  return record;
}

/** POST /api/v1/projects/:projectId/issues/:issueId/comments */
export async function createComment(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  requestId: string,
  input: { body: unknown },
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  await requireIssueAccess(request, context, principal, projectId, issueId);
  await requirePermission(
    request,
    context,
    principal,
    'comment:create',
    projectId,
    issueId,
    'issue',
  );
  await requireAdmission(
    request,
    context,
    principal.principalId,
    projectId,
    'comment-create',
    commentCreateRule,
  );
  const body = checkedBody(input.body);
  const intent: CommentCreateIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'comment.create',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: crypto.randomUUID(),
    issueId,
    body,
  };
  try {
    validateCommentIntent(intent, 'comment.create');
    const outcome = await withDeadline(request.signal, 5_000, () =>
      comments(context).create(intent),
    );
    const record = await loadComment(
      request,
      context,
      projectId,
      issueId,
      outcome.result.id,
      false,
    );
    return commentContentView(record, true);
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    if (error instanceof Error) {
      if (error.message === 'idempotency-conflict')
        throw new RequestFailure('IDEMPOTENCY_CONFLICT');
      if (error.message === 'idempotency-expired')
        throw new RequestFailure('IDEMPOTENCY_EXPIRED');
    }
    throw new RequestFailure('ISSUE_UNAVAILABLE');
  }
}

/** GET /api/v1/projects/:projectId/issues/:issueId/comments */
export async function listComments(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  query: { limit?: unknown; cursor?: unknown },
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  const includeHidden = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  await requirePermission(
    request,
    context,
    principal,
    'issue:read',
    projectId,
    issueId,
    'issue',
  );
  if (
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
      comments(context).listByIssue({
        projectId,
        issueId,
        ...(query.limit === undefined ? {} : { limit: query.limit as number }),
        ...(query.cursor === undefined
          ? {}
          : { after: query.cursor as string }),
        includeHidden,
      }),
    );
    return {
      comments: page.items.map((item) => commentContentView(item, false)),
      nextCursor: page.nextCursor,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid cursor')
      throw new RequestFailure('INVALID_CURSOR');
    if (error instanceof Error && error.message === 'stale cursor')
      throw new RequestFailure('INVALID_CURSOR');
    throw new RequestFailure('ISSUE_UNAVAILABLE');
  }
}

async function mayModerate(
  request: Request,
  context: DiscussionContext,
  principal: BearerPrincipal,
  projectId: string,
  issueId: string,
): Promise<boolean> {
  try {
    await requirePermission(
      request,
      context,
      principal,
      'issue:moderate',
      projectId,
      issueId,
      'issue',
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Every issue sub-resource inherits the issue's own visibility: a hidden
 * issue answers 404 for every audience that cannot see the issue itself,
 * and a deleted issue answers 404 for everyone. Moderators reach the
 * sub-resources of hidden issues exactly like the issue detail. The
 * caller's moderator status is resolved once and returned so the route
 * does not repeat the authorization lookup.
 */
async function requireIssueAccess(
  request: Request,
  context: DiscussionContext,
  principal: BearerPrincipal | null,
  projectId: string,
  issueId: string,
): Promise<boolean> {
  if (!context.issues) throw new RequestFailure('ISSUE_UNAVAILABLE');
  const moderator = principal
    ? await mayModerate(request, context, principal, projectId, issueId)
    : false;
  const visible = await withDeadline(request.signal, storeTimeoutMs, () =>
    context.issues!.issueVisible(projectId, issueId, {
      includeHidden: moderator,
    }),
  );
  if (!visible) throw new RequestFailure('NOT_FOUND');
  return moderator;
}

/** GET /api/v1/projects/:projectId/issues/:issueId/comments/:commentId */
export async function readComment(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  commentId: string,
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  const includeHidden = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  await requirePermission(
    request,
    context,
    principal,
    'comment:read',
    projectId,
    commentId,
    'comment',
  );
  const record = await loadComment(
    request,
    context,
    projectId,
    issueId,
    commentId,
    includeHidden,
  );
  return commentContentView(
    record,
    includeHidden || (!record.deletedAt && record.moderation === 'visible'),
  );
}

/** PATCH /api/v1/projects/:projectId/issues/:issueId/comments/:commentId */
export async function editComment(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  commentId: string,
  requestId: string,
  input: { expectedRevision: unknown; body: unknown },
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  const moderator = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  const current = await loadComment(
    request,
    context,
    projectId,
    issueId,
    commentId,
    true,
  );
  requireCommentKnown(current, principal, moderator);
  const ownVisible =
    current.authorId === principal.principalId &&
    current.moderation === 'visible' &&
    current.deletedAt === null;
  await requirePermission(
    request,
    context,
    principal,
    ownVisible ? 'comment:update' : 'issue:moderate',
    projectId,
    commentId,
    'comment',
  );
  const intent: CommentEditIntent = {
    ...(await mutationIdentityOf(
      request,
      requestId,
      'comment.edit',
      JSON.stringify(input),
      principal.principalId,
      projectId,
      receiptValidityMs,
    )),
    id: commentId,
    issueId,
    expectedRevision: checkedRevision(input.expectedRevision),
    body: checkedBody(input.body),
  };
  try {
    const outcome = await withDeadline(request.signal, 5_000, () =>
      comments(context).edit(intent),
    );
    const record = await loadComment(
      request,
      context,
      projectId,
      issueId,
      outcome.result.id,
      true,
    );
    return commentContentView(record, true);
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    if (error instanceof Error) {
      if (error.message === 'revision-conflict')
        throw new RequestFailure('REVISION_CONFLICT');
      if (error.message === 'not-found') throw new RequestFailure('NOT_FOUND');
      if (error.message === 'idempotency-conflict')
        throw new RequestFailure('IDEMPOTENCY_CONFLICT');
      if (error.message === 'idempotency-expired')
        throw new RequestFailure('IDEMPOTENCY_EXPIRED');
    }
    throw new RequestFailure('ISSUE_UNAVAILABLE');
  }
}

/** DELETE /api/v1/projects/:projectId/issues/:issueId/comments/:commentId */
export async function deleteComment(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  commentId: string,
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  const moderator = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  const current = await loadComment(
    request,
    context,
    projectId,
    issueId,
    commentId,
    true,
  );
  requireCommentKnown(current, principal, moderator);
  // A tombstoned comment is no longer deletable by anyone; idempotent
  // re-deletion answers the closed 404.
  if (current.deletedAt !== null) throw new RequestFailure('NOT_FOUND');
  const ownVisible = current.authorId === principal.principalId;
  await requirePermission(
    request,
    context,
    principal,
    ownVisible ? 'comment:update' : 'issue:moderate',
    projectId,
    commentId,
    'comment',
  );
  const removed = await withDeadline(request.signal, storeTimeoutMs, () =>
    comments(context).remove({
      projectId,
      id: commentId,
      actorId: principal.principalId,
      nowMs: Date.now(),
    }),
  );
  if (!removed) throw new RequestFailure('NOT_FOUND');
}

/** POST /api/v1/projects/:projectId/issues/:issueId/comments/:commentId/moderate */
export async function moderateComment(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  commentId: string,
  input: { moderation: unknown },
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  const moderator = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  // The comment must belong to the addressed issue, not merely the project.
  const current = await loadComment(
    request,
    context,
    projectId,
    issueId,
    commentId,
    true,
  );
  requireCommentKnown(current, principal, moderator);
  await requirePermission(
    request,
    context,
    principal,
    'issue:moderate',
    projectId,
    issueId,
    'issue',
  );
  const moderation =
    input.moderation === 'visible' ||
    input.moderation === 'hidden' ||
    input.moderation === 'redacted'
      ? input.moderation
      : null;
  if (moderation === null) throw new RequestFailure('ISSUE_INVALID');
  const moderated = await withDeadline(request.signal, storeTimeoutMs, () =>
    comments(context).moderate({
      projectId,
      id: commentId,
      moderation,
      actorId: principal.principalId,
      nowMs: Date.now(),
    }),
  );
  if (!moderated) throw new RequestFailure('NOT_FOUND');
  return commentContentView(moderated, true);
}

/** GET /api/v1/projects/:projectId/issues/:issueId/comments/:commentId/history */
export async function commentHistory(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  commentId: string,
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  const moderator = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  const current = await loadComment(
    request,
    context,
    projectId,
    issueId,
    commentId,
    true,
  );
  requireCommentKnown(current, principal, moderator);
  await requirePermission(
    request,
    context,
    principal,
    'issue:moderate',
    projectId,
    issueId,
    'issue',
  );
  const page = await withDeadline(request.signal, storeTimeoutMs, () =>
    comments(context).history(projectId, commentId),
  );
  return {
    entries: page.entries.map((entry) => ({
      id: entry.historyId,
      commentId: entry.commentId,
      revision: entry.revision,
      editorId: entry.editorId,
      body: entry.body,
      changedAt: new Date(entry.changedAtMs).toISOString(),
    })),
  };
}

function checkedReaction(value: unknown): ReactionValue {
  if (!isReactionValue(value)) throw new RequestFailure('ISSUE_INVALID');
  return value;
}

async function reactionWrite(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  target: { issueId: string } | { commentId: string; issueId: string },
  reaction: unknown,
  add: boolean,
) {
  try {
    await requireVisibleProject(request, context, projectId);
    const principal = await projectBearer(request, context);
    if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
    const commentTarget = 'commentId' in target ? target : null;
    const issueTarget = commentTarget === null ? target : null;
    const targetType = commentTarget !== null ? 'comment' : 'issue';
    const targetId = commentTarget?.commentId ?? issueTarget!.issueId;
    await requireVisibleTarget(request, context, principal, projectId, target);
    await requirePermission(
      request,
      context,
      principal,
      'reaction:write',
      projectId,
      targetId,
      targetType,
    );
    await requireAdmission(
      request,
      context,
      principal.principalId,
      projectId,
      'reaction',
      reactionRule,
    );
    const value = checkedReaction(reaction);
    if (!context.reactions) throw new RequestFailure('ISSUE_UNAVAILABLE');
    const targetFields = commentTarget
      ? { commentId: commentTarget.commentId }
      : { issueId: issueTarget!.issueId };
    return await withDeadline(request.signal, storeTimeoutMs, () =>
      add
        ? context.reactions!.add({
            projectId,
            principalId: principal.principalId,
            reaction: value,
            nowMs: Date.now(),
            ...targetFields,
          })
        : context.reactions!.remove({
            projectId,
            principalId: principal.principalId,
            reaction: value,
            ...targetFields,
          }),
    );
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('ISSUE_UNAVAILABLE');
  }
}

/** POST /issues/:issueId/reactions and /issues/:issueId/comments/:commentId/reactions */
export async function addReaction(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  target: { issueId: string } | { commentId: string; issueId: string },
  reaction: unknown,
): Promise<string> {
  return reactionWrite(request, context, projectId, target, reaction, true);
}

/** DELETE reaction endpoints. */
export async function removeReaction(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  target: { issueId: string } | { commentId: string; issueId: string },
  reaction: unknown,
): Promise<string> {
  return reactionWrite(request, context, projectId, target, reaction, false);
}

/** GET reaction count endpoints (bounded grouped counts). */
export async function reactionCounts(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  target: { issueId: string } | { commentId: string; issueId: string },
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  await requireVisibleTarget(request, context, principal, projectId, target);
  await requirePermission(
    request,
    context,
    principal,
    targetTypeOf(target) === 'issue' ? 'issue:read' : 'comment:read',
    projectId,
    targetIdOf(target),
    targetTypeOf(target),
  );
  if (!context.reactions) throw new RequestFailure('ISSUE_UNAVAILABLE');
  const commentTarget = 'commentId' in target ? target : null;
  const issueTarget = commentTarget === null ? target : null;
  const counts = await withDeadline(request.signal, storeTimeoutMs, () =>
    commentTarget
      ? context.reactions!.commentCounts(projectId, [commentTarget.commentId])
      : context.reactions!.issueCounts(projectId, [issueTarget!.issueId]),
  );
  const list = commentTarget
    ? (counts.get(commentTarget.commentId) ?? [])
    : (counts.get(issueTarget!.issueId) ?? []);
  return { reactions: [...list] };
}

/**
 * A reaction target inherits its parent issue's visibility; a comment
 * target must also belong to the addressed issue and be visible to the
 * caller (moderators reach hidden comments).
 */
async function requireVisibleTarget(
  request: Request,
  context: DiscussionContext,
  principal: BearerPrincipal | null,
  projectId: string,
  target: { issueId: string } | { commentId: string; issueId: string },
): Promise<void> {
  const moderator = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    target.issueId,
  );
  if ('commentId' in target)
    await loadComment(
      request,
      context,
      projectId,
      target.issueId,
      target.commentId,
      moderator,
    );
}

function targetTypeOf(
  target: { issueId: string } | { commentId: string; issueId: string },
): 'issue' | 'comment' {
  return 'commentId' in target ? 'comment' : 'issue';
}

function targetIdOf(
  target: { issueId: string } | { commentId: string; issueId: string },
): string {
  return 'commentId' in target ? target.commentId : target.issueId;
}

/** GET /api/v1/projects/:projectId/issues/:issueId/timeline */
export async function issueTimeline(
  request: Request,
  context: DiscussionContext,
  projectId: string,
  issueId: string,
  query: { limit?: unknown; cursor?: unknown },
) {
  await requireVisibleProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  const includeHidden = await requireIssueAccess(
    request,
    context,
    principal,
    projectId,
    issueId,
  );
  await requirePermission(
    request,
    context,
    principal,
    'issue:read',
    projectId,
    issueId,
    'issue',
  );
  if (!context.timeline) throw new RequestFailure('ISSUE_UNAVAILABLE');
  if (
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
      context.timeline!.timeline({
        projectId,
        issueId,
        ...(query.limit === undefined ? {} : { limit: query.limit as number }),
        ...(query.cursor === undefined
          ? {}
          : { after: query.cursor as string }),
        includeHidden,
      }),
    );
    return {
      items: page.items.map((item: TimelineItem) =>
        item.kind === 'event'
          ? {
              kind: 'event' as const,
              id: item.id,
              action: item.action,
              actorId: item.actorId,
              systemActor: item.systemActor,
              revision: item.revision,
              createdAt: new Date(item.createdAtMs).toISOString(),
            }
          : {
              kind: 'comment' as const,
              id: item.id,
              actorId: item.actorId,
              revision: item.revision,
              moderation: item.moderation,
              deleted: item.deleted,
              ...(item.body === null
                ? {}
                : {
                    body: item.body,
                    ...contentRepresentation(item.id, item.revision, item.body),
                  }),
              createdAt: new Date(item.createdAtMs).toISOString(),
            },
      ),
      nextCursor: page.nextCursor,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'invalid cursor')
      throw new RequestFailure('INVALID_CURSOR');
    if (error instanceof Error && error.message === 'stale cursor')
      throw new RequestFailure('INVALID_CURSOR');
    throw new RequestFailure('ISSUE_UNAVAILABLE');
  }
}
