import {
  UploadIntentError,
  BlobStoreError,
  reserveUploadIntent,
  issueUploadCapability,
  startMultipartUpload,
  issueMultipartPartCapability,
  recordMultipartPart,
  completeMultipartUpload,
  abortMultipartUpload,
  uploadHasCurrentCleanScan,
  uploadHasBoundScan,
  type UploadDependencies,
  type UploadScope,
  type UploadAssociation,
  type UploadIntentRecord,
  type IssueRepository,
  type CommentStore,
} from '@hyperbug/application';
import type {
  ReserveUploadRequest,
  UploadDocument,
  MultipartDocument,
  MultipartPartRequest,
  MultipartCompleteRequest,
} from '@hyperbug/contracts';
import type { Permission } from '@hyperbug/security';
import { requireAuthorizedAction } from './authorization.ts';
import {
  projectBearer,
  requireVisibleProject,
  type ProjectContext,
} from './projects.ts';
import { RequestFailure } from './errors.ts';
import { withDeadline } from './bounds.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';

export interface UploadContext extends ProjectContext {
  uploads: UploadDependencies | null;
  issues: IssueRepository | null;
  comments: CommentStore | null;
  admission: Pick<BoundSensitiveActionAdmission, 'requireRate'> | null;
}
async function permit(
  request: Request,
  context: UploadContext,
  scope: UploadScope,
  association: UploadAssociation,
) {
  await requireVisibleProject(request, context, scope.projectId);
  const actor = await projectBearer(request, context);
  if (!actor || actor.principalId !== scope.principalId)
    throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  let permission: Permission = 'issue:create';
  let type: 'project' | 'issue' | 'comment' = 'project';
  let id = scope.projectId;
  if (association.kind === 'comment-draft' || association.kind === 'issue') {
    if (!context.issues) throw new RequestFailure('ISSUE_UNAVAILABLE');
    const target = await context.issues.getIssue(
      scope.projectId,
      association.issueId,
      { includeHidden: true },
    );
    if (!target || target.deletedAt !== null)
      throw new RequestFailure('NOT_FOUND');
    type = 'issue';
    id = target.id;
    permission =
      association.kind === 'comment-draft'
        ? target.moderation === 'visible'
          ? 'comment:create'
          : 'issue:moderate'
        : target.authorId === actor.principalId &&
            target.moderation === 'visible'
          ? 'issue:update'
          : 'issue:moderate';
  } else if (association.kind === 'comment') {
    if (!context.comments || !context.issues)
      throw new RequestFailure('ISSUE_UNAVAILABLE');
    const target = await context.comments.getById(
      scope.projectId,
      association.commentId,
      { includeHidden: true },
    );
    if (!target || target.deletedAt !== null)
      throw new RequestFailure('NOT_FOUND');
    const parent = await context.issues.getIssue(
      scope.projectId,
      target.issueId,
      { includeHidden: true },
    );
    if (!parent || parent.deletedAt !== null)
      throw new RequestFailure('NOT_FOUND');
    type = 'comment';
    id = target.id;
    permission =
      target.authorId === actor.principalId &&
      target.moderation === 'visible' &&
      parent.moderation === 'visible'
        ? 'comment:update'
        : 'issue:moderate';
  }
  await requireAuthorizedAction({
    request: {
      actorId: actor.principalId,
      permission,
      target: { projectId: scope.projectId, type, id },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
  });
}
export function uploadView(
  record: UploadIntentRecord,
  now: number,
): UploadDocument {
  if (
    ['clean', 'infected'].includes(record.scanStatus) &&
    !uploadHasBoundScan(record)
  )
    throw new RequestFailure('UPLOAD_UNAVAILABLE');
  if (
    !['unscanned', 'pending', 'clean', 'infected', 'failed'].includes(
      record.scanStatus,
    ) ||
    !['quarantined', 'rejected', 'ready'].includes(record.policyState)
  )
    throw new RequestFailure('UPLOAD_UNAVAILABLE');
  const policy =
    record.policyState === 'ready' && !uploadHasCurrentCleanScan(record)
      ? 'quarantined'
      : record.policyState;
  const state =
    policy === 'rejected'
      ? 'rejected'
      : policy === 'ready'
        ? 'ready'
        : record.state === 'finalized'
          ? record.scanStatus === 'pending'
            ? 'awaiting-scan'
            : 'quarantined'
          : record.state === 'rejected'
            ? 'rejected'
            : record.expiresAt <= now || record.state === 'expired'
              ? 'expired'
              : record.state === 'uploaded'
                ? 'awaiting-processing'
                : 'pending';
  // No object keys, principal identity, provider versions, digests or reusable download URLs.
  return {
    id: record.id,
    projectId: record.projectId,
    filename: record.filename,
    contentType: record.contentType,
    maxBytes: record.maxBytes,
    association: record.association,
    state,
    scanStatus: record.scanStatus,
    policyState:
      policy === 'ready'
        ? 'ready'
        : policy === 'rejected'
          ? 'rejected'
          : 'quarantined',
    revision: record.revision,
    createdAt: new Date(record.now).toISOString(),
    expiresAt: new Date(record.expiresAt).toISOString(),
    transfer: record.multipart
      ? {
          mode: 'multipart',
          partBytes: record.multipart.partBytes,
          maxParts: record.multipart.maxParts,
        }
      : { mode: 'direct' },
    actualBytes: record.verified?.size ?? null,
  };
}
export function multipartView(record: UploadIntentRecord): MultipartDocument {
  const mp = record.multipart;
  if (!mp) throw new UploadIntentError('UPLOAD_CONFLICT');
  return {
    id: record.id,
    projectId: record.projectId,
    state: mp.state,
    partBytes: mp.partBytes,
    maxParts: mp.maxParts,
    revision: mp.revision,
    parts: mp.parts.map((part) => ({
      partNumber: part.partNumber,
      etag: part.etag,
      sizeBytes: part.sizeBytes,
    })),
  };
}
function mapped(error: unknown): never {
  if (error instanceof RequestFailure) throw error;
  if (error instanceof UploadIntentError) throw new RequestFailure(error.code);
  if (error instanceof BlobStoreError)
    throw new RequestFailure(
      error.code === 'BLOB_INVALID' ? 'UPLOAD_INVALID' : 'UPLOAD_UNAVAILABLE',
    );
  throw new RequestFailure('UPLOAD_UNAVAILABLE');
}
export async function uploadOperation(
  request: Request,
  context: UploadContext,
  projectId: string,
  id: string,
  operation:
    | 'reserve'
    | 'read'
    | 'capability'
    | 'finalize'
    | 'multipart-read'
    | 'multipart-create'
    | 'multipart-part'
    | 'multipart-part-capability'
    | 'multipart-complete'
    | 'multipart-abort',
  input?:
    | ReserveUploadRequest
    | MultipartPartRequest
    | MultipartCompleteRequest,
  partNumber?: number,
) {
  await requireVisibleProject(request, context, projectId);
  const actor = await projectBearer(request, context);
  if (!actor) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.uploads) throw new RequestFailure('UPLOAD_UNAVAILABLE');
  if (operation !== 'read' && operation !== 'multipart-read') {
    if (!context.admission) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    await context.admission.requireRate({
      request,
      category: 'attachment-upload',
      checks: [
        {
          dimension: 'principal',
          canonicalSubject: actor.principalId,
          rule: { limit: 120, windowMs: 3600000, retentionMs: 86400000 },
        },
        {
          dimension: 'project',
          canonicalSubject: projectId,
          rule: { limit: 2400, windowMs: 3600000, retentionMs: 86400000 },
        },
      ],
      nowMs: Date.now(),
      signal: request.signal,
      timeoutMs: 1000,
    });
  }
  const scope = { id, projectId, principalId: actor.principalId };
  const deps = context.uploads;
  const authorize = (owner: UploadScope, association: UploadAssociation) =>
    permit(request, context, owner, association);
  try {
    return await withDeadline(request.signal, 5000, async () => {
      const now = Date.now();
      if (operation === 'reserve')
        return uploadView(
          await reserveUploadIntent(
            deps,
            authorize,
            scope,
            input! as ReserveUploadRequest,
            now,
          ),
          now,
        );
      const record = await deps.intents.get(scope);
      if (!record) throw new UploadIntentError('UPLOAD_NOT_FOUND');
      await authorize(scope, record.association);
      if (operation === 'multipart-read') return multipartView(record);
      if (operation === 'multipart-create')
        return multipartView(
          await startMultipartUpload(deps, authorize, scope),
        );
      if (operation === 'multipart-part') {
        const receipt = input as MultipartPartRequest;
        return multipartView(
          await recordMultipartPart(
            deps,
            authorize,
            scope,
            {
              partNumber: partNumber!,
              etag: receipt.etag,
              sizeBytes: receipt.sizeBytes,
            },
            receipt.expectedRevision,
          ),
        );
      }
      if (operation === 'multipart-complete')
        return uploadView(
          await completeMultipartUpload(
            deps,
            authorize,
            scope,
            (input as MultipartCompleteRequest).expectedRevision,
          ),
          Date.now(),
        );
      if (operation === 'multipart-abort')
        return multipartView(
          await abortMultipartUpload(deps, authorize, scope),
        );
      if (operation === 'multipart-part-capability') {
        const capability = await issueMultipartPartCapability(
          deps,
          authorize,
          scope,
          partNumber!,
        );
        return {
          ...capability,
          expiresAt: new Date(capability.expiresAt).toISOString(),
        };
      }
      if (operation === 'capability') {
        const capability = await issueUploadCapability(
          deps,
          authorize,
          scope,
          now,
        );
        return {
          ...capability,
          expiresAt: new Date(capability.expiresAt).toISOString(),
        };
      }
      if (operation === 'finalize')
        return uploadView(await deps.intents.requestFinalize(scope, now), now);
      return uploadView(record, now);
    });
  } catch (error) {
    mapped(error);
  }
}
