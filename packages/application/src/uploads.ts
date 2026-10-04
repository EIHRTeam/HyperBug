import {
  UploadIntentError,
  type UploadIntentStore,
  type UploadScope,
  type UploadAssociation,
  type UploadIntentRecord,
  type UploadLease,
} from './upload-intents.ts';
import { promoteStagingBlob, type BlobDigest } from './blob-promotion.ts';
import {
  BlobStoreError,
  type BlobStore,
  type BlobAuthorization,
  type BlobCapability,
} from './blob-store.ts';
import {
  reconcileUnknownMultipart,
  type UploadMultipartReconciler,
} from './upload-cleanup.ts';
import { createUploadCleanupDeadline } from './upload-cleanup-deadline.ts';

export const defaultUploadQuota = Object.freeze({
  maxFileBytes: 32 * 1024 ** 2,
  projectBytes: 10 * 1024 ** 3,
  principalBytes: 1024 ** 3,
  projectPending: 1000,
  principalPending: 16,
});
export const defaultUploadMultipart = Object.freeze({
  thresholdBytes: 8 * 1024 ** 2,
  minPartBytes: 5 * 1024 ** 2,
  maxPartBytes: 64 * 1024 ** 2,
  maxParts: 100,
});
export interface UploadDependencies {
  intents: UploadIntentStore;
  blobs: BlobStore;
  capabilities: BlobAuthorization;
  createDigest: () => BlobDigest;
  multipartReconciler?: UploadMultipartReconciler;
}
export type AuthorizeUpload = (
  scope: UploadScope,
  association: UploadAssociation,
) => Promise<void>;
export interface UploadRequest {
  filename: string;
  contentType: string;
  maxBytes: number;
  association: UploadAssociation;
}
function liveLease(lease: UploadLease, clock: () => number): UploadLease {
  const now = clock();
  if (now >= lease.leaseExpiresAt)
    throw new UploadIntentError('UPLOAD_LEASE_LOST');
  return { ...lease, now };
}
const opaqueKey = (prefix: string) =>
  `${prefix}/${Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
function sameRequest(
  record: UploadIntentRecord,
  input: UploadRequest,
): boolean {
  const a = record.association;
  const b = input.association;
  return (
    record.filename === input.filename &&
    record.contentType === input.contentType &&
    record.maxBytes === input.maxBytes &&
    a.kind === b.kind &&
    ('draftId' in a
      ? a.draftId === ('draftId' in b ? b.draftId : null)
      : true) &&
    ('issueId' in a
      ? a.issueId === ('issueId' in b ? b.issueId : null)
      : true) &&
    ('commentId' in a
      ? a.commentId === ('commentId' in b ? b.commentId : null)
      : true)
  );
}
export async function reserveUploadIntent(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  input: UploadRequest,
  now: number,
): Promise<UploadIntentRecord> {
  await authorize(scope, input.association);
  const multipartPlan =
    input.maxBytes >= deps.blobs.multipart.thresholdBytes
      ? {
          partBytes: deps.blobs.multipart.minPartBytes,
          maxParts: Math.ceil(
            input.maxBytes / deps.blobs.multipart.minPartBytes,
          ),
        }
      : undefined;
  if (multipartPlan && multipartPlan.maxParts > deps.blobs.multipart.maxParts)
    throw new UploadIntentError('UPLOAD_INVALID');
  let record = await deps.intents.get(scope);
  if (!record) {
    try {
      record = await deps.intents.reserve({
        ...scope,
        ...input,
        ...(multipartPlan ? { multipartPlan } : {}),
        stagingKey: opaqueKey('staging'),
        finalKey: opaqueKey('objects'),
        now,
        expiresAt: now + 900000,
      });
    } catch (error) {
      if (
        !(error instanceof UploadIntentError) ||
        error.code !== 'UPLOAD_CONFLICT'
      )
        throw error;
      record = await deps.intents.get(scope);
      if (!record) throw error;
    }
  }
  if (!sameRequest(record, input))
    throw new UploadIntentError('UPLOAD_CONFLICT');
  if (record.expiresAt <= now && record.state !== 'finalized')
    throw new UploadIntentError('UPLOAD_EXPIRED');
  return record;
}
export async function issueUploadCapability(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  now: number,
  clock: () => number = Date.now,
): Promise<BlobCapability> {
  const record = await deps.intents.get(scope);
  if (!record) throw new UploadIntentError('UPLOAD_NOT_FOUND');
  await authorize(scope, record.association);
  const seconds = Math.min(
    300,
    Math.floor((record.expiresAt - Math.max(now, clock())) / 1000),
  );
  if (seconds < 1) throw new UploadIntentError('UPLOAD_EXPIRED');
  if (record.multipart || record.state !== 'pending')
    throw new UploadIntentError('UPLOAD_CONFLICT');
  const capability = await deps.capabilities.upload({
    key: record.stagingKey,
    contentType: record.contentType,
    expiresInSeconds: seconds,
  });
  const current = await deps.intents.get(scope);
  if (!current) throw new UploadIntentError('UPLOAD_NOT_FOUND');
  await authorize(scope, current.association);
  const returnedAt = Math.max(now, clock());
  if (
    current.expiresAt <= returnedAt ||
    capability.expiresAt <= returnedAt ||
    capability.expiresAt > current.expiresAt ||
    capability.expiresAt > returnedAt + 300000
  )
    throw new UploadIntentError('UPLOAD_EXPIRED');
  if (
    current.multipart ||
    current.state !== 'pending' ||
    current.revision !== record.revision ||
    current.stagingKey !== record.stagingKey
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  return capability;
}
/** Independent background handler. Module 09 dispatch is deliberately not composed here. */
export async function processUploadIntent(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  lease: UploadLease,
  clock: () => number = Date.now,
): Promise<UploadIntentRecord> {
  const before = await deps.intents.get(lease);
  if (!before) throw new UploadIntentError('UPLOAD_NOT_FOUND');
  await authorize(lease, before.association);
  if (before.state === 'finalized') return before;
  const record = await deps.intents.claim(liveLease(lease, clock));
  try {
    const verified = await promoteStagingBlob(deps.blobs, deps.createDigest, {
      intentId: record.id,
      stagingKey: record.stagingKey,
      finalKey: record.finalKey,
      maxBytes: record.maxBytes,
      contentType: record.contentType,
      filename: record.filename,
    });
    await authorize(lease, record.association);
    return deps.intents.commitVerified({
      ...liveLease(lease, clock),
      verified,
    });
  } catch (error) {
    if (
      error instanceof BlobStoreError &&
      [
        'BLOB_CONTENT_INVALID',
        'BLOB_SIZE_MISMATCH',
        'BLOB_CHECKSUM_MISMATCH',
      ].includes(error.code)
    )
      return deps.intents.rejectVerification(liveLease(lease, clock));
    throw error;
  }
}
/** System cleanup of one persisted expired intent; quota release follows successful deletes. */
export async function cleanupUploadIntent(
  deps: Pick<UploadDependencies, 'intents' | 'blobs' | 'multipartReconciler'>,
  lease: UploadLease,
  clock: () => number = Date.now,
): Promise<UploadIntentRecord> {
  const record = await deps.intents.claimCleanup(liveLease(lease, clock));
  const deadline = createUploadCleanupDeadline(lease, clock);
  try {
    if (record.multipart) {
      const unknown =
        record.multipart.state === 'creating' && !record.multipart.uploadId;
      if (unknown) {
        if (!deps.multipartReconciler)
          throw new UploadIntentError('UPLOAD_UNAVAILABLE');
        await reconcileUnknownMultipart(
          deps.multipartReconciler,
          record.stagingKey,
          deadline,
        );
      }
      const uploadId = record.multipart.uploadId;
      if (uploadId)
        await deadline.wait(() =>
          deps.blobs.abortMultipart({
            key: record.stagingKey,
            uploadId,
          }),
        );
      deadline.check();
      await deps.intents.mutateMultipart({
        ...liveLease(lease, clock),
        kind: unknown ? 'cleanup-reconciled' : 'cleanup-aborted',
      });
    }
    await deadline.wait(() => deps.blobs.delete(record.stagingKey));
    await deadline.wait(() => deps.blobs.delete(record.finalKey));
    if (
      (await deadline.wait(() => deps.blobs.head(record.stagingKey))) ||
      (await deadline.wait(() => deps.blobs.head(record.finalKey)))
    )
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    deadline.check();
    // Tombstones/owned keys are retained so a late PUT can be deleted on another sweep.
    return deps.intents.releaseQuotaAfterCleanup(liveLease(lease, clock));
  } finally {
    deadline.close();
  }
}
