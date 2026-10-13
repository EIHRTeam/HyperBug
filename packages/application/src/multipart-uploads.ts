import {
  UploadIntentError,
  type UploadScope,
  type UploadIntentRecord,
} from './upload-intents.ts';
import { multipartTotal, type UploadPartReceipt } from './multipart.ts';
import type { UploadDependencies, AuthorizeUpload } from './uploads.ts';
import type { BlobCapability, BlobInfo } from './blob-store.ts';

async function current(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
) {
  const record = await deps.intents.get(scope);
  if (!record) throw new UploadIntentError('UPLOAD_NOT_FOUND');
  await authorize(scope, record.association);
  if (!record.multipart) throw new UploadIntentError('UPLOAD_CONFLICT');
  return record;
}
const lease = (scope: UploadScope, now: number) => ({
  ...scope,
  now,
  leaseId: crypto.randomUUID(),
  leaseExpiresAt: now + 60000,
});
export async function startMultipartUpload(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  clock: () => number = Date.now,
): Promise<UploadIntentRecord> {
  const before = await current(deps, authorize, scope);
  const token = lease(scope, clock());
  const claimed = await deps.intents.mutateMultipart({
    ...token,
    kind: 'claim-create',
  });
  if (claimed.multipart!.state === 'active') return claimed;
  const upload = await deps.blobs.createMultipart({
    key: before.stagingKey,
    contentType: before.contentType,
    metadata: { 'intent-id': before.id },
  });
  let saved: UploadIntentRecord;
  try {
    saved = await deps.intents.mutateMultipart({
      ...scope,
      kind: 'created',
      leaseId: token.leaseId,
      now: clock(),
      uploadId: upload.uploadId,
    });
  } catch (error) {
    try {
      await deps.blobs.abortMultipart(upload);
      await deps.intents.mutateMultipart({
        ...scope,
        kind: 'creation-aborted',
        leaseId: token.leaseId,
        now: clock(),
        uploadId: upload.uploadId,
      });
    } catch {
      /* Unknown/failed compensation retains reservation and the creating marker. */
    }
    throw error;
  }
  await authorize(scope, saved.association);
  if (saved.expiresAt <= clock()) throw new UploadIntentError('UPLOAD_EXPIRED');
  return saved;
}
export async function issueMultipartPartCapability(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  partNumber: number,
  clock: () => number = Date.now,
): Promise<BlobCapability> {
  const record = await current(deps, authorize, scope);
  const session = record.multipart!;
  const seconds = Math.min(
    300,
    Math.floor((record.expiresAt - clock()) / 1000),
  );
  if (seconds < 1) throw new UploadIntentError('UPLOAD_EXPIRED');
  if (
    record.state !== 'pending' ||
    session.state !== 'active' ||
    !session.uploadId
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  if (
    !Number.isInteger(partNumber) ||
    partNumber < 1 ||
    partNumber > session.maxParts
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  const capability = await deps.capabilities.uploadPart({
    key: record.stagingKey,
    uploadId: session.uploadId,
    partNumber,
    expiresInSeconds: seconds,
  });
  const latest = await current(deps, authorize, scope);
  if (
    latest.state !== 'pending' ||
    latest.multipart!.state !== 'active' ||
    latest.multipart!.uploadId !== session.uploadId
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  if (
    capability.expiresAt > latest.expiresAt ||
    capability.expiresAt <= clock()
  )
    throw new UploadIntentError('UPLOAD_EXPIRED');
  return capability;
}
export async function recordMultipartPart(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  part: UploadPartReceipt,
  expectedRevision: number,
  clock: () => number = Date.now,
) {
  await current(deps, authorize, scope);
  return deps.intents.mutateMultipart({
    ...scope,
    now: clock(),
    kind: 'part',
    part,
    expectedRevision,
  });
}
function completedMatches(
  info: BlobInfo | null,
  record: UploadIntentRecord,
): boolean {
  return (
    info !== null &&
    info.key === record.stagingKey &&
    info.metadata['intent-id'] === record.id &&
    info.contentType === record.contentType &&
    info.size === multipartTotal(record) &&
    info.size <= record.maxBytes
  );
}
export async function completeMultipartUpload(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  expectedRevision: number,
  clock: () => number = Date.now,
): Promise<UploadIntentRecord> {
  await current(deps, authorize, scope);
  const token = lease(scope, clock());
  const record = await deps.intents.mutateMultipart({
    ...token,
    kind: 'claim-complete',
    expectedRevision,
  });
  if (record.multipart!.state === 'completed') return record;
  let completed = await deps.blobs.head(record.stagingKey);
  if (!completed) {
    try {
      await deps.blobs.completeMultipart(
        { key: record.stagingKey, uploadId: record.multipart!.uploadId! },
        record.multipart!.parts,
      );
    } catch (error) {
      // Recover an ambiguous successful provider completion from its owned staging object.
      completed = await deps.blobs.head(record.stagingKey);
      if (!completed) throw error;
    }
    completed ??= await deps.blobs.head(record.stagingKey);
  }
  if (!completed) throw new UploadIntentError('UPLOAD_UNAVAILABLE');
  const valid = completedMatches(completed, record);
  await authorize(scope, record.association);
  const saved = await deps.intents.mutateMultipart({
    ...scope,
    now: clock(),
    kind: 'completed',
    leaseId: token.leaseId,
    valid,
  });
  if (!valid) throw new UploadIntentError('UPLOAD_INVALID');
  return saved;
}
export async function abortMultipartUpload(
  deps: UploadDependencies,
  authorize: AuthorizeUpload,
  scope: UploadScope,
  clock: () => number = Date.now,
): Promise<UploadIntentRecord> {
  await current(deps, authorize, scope);
  const token = lease(scope, clock());
  const record = await deps.intents.mutateMultipart({
    ...token,
    kind: 'claim-abort',
  });
  if (record.multipart!.state === 'aborted') return record;
  if (record.multipart!.uploadId)
    await deps.blobs.abortMultipart({
      key: record.stagingKey,
      uploadId: record.multipart!.uploadId!,
    });
  const saved = await deps.intents.mutateMultipart({
    ...scope,
    now: clock(),
    kind: 'aborted',
    leaseId: token.leaseId,
  });
  await authorize(scope, saved.association);
  return saved;
}
