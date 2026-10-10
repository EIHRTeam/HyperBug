import { assertId } from '@hyperbug/domain';
import { BlobStoreError, assertBlobKey } from './blob-store.ts';
import { reconcileUnknownMultipart } from './upload-cleanup.ts';
import {
  createUploadCleanupDeadline,
  UploadCleanupTimeoutError,
} from './upload-cleanup-deadline.ts';
import {
  UploadIntentError,
  uploadCleanupGraceMs,
  assertUploadTime,
  validateUploadLease,
  type UploadIntentRecord,
  type UploadLease,
  type UploadScope,
} from './upload-intents.ts';
import { type UploadDependencies } from './uploads.ts';

/** No default: the trusted caller must select an actual retention duration. */
export interface UploadOrphanPolicy {
  retainAfterExpiryMs: number;
}
export interface UploadOrphanLease extends UploadLease, UploadOrphanPolicy {}
export interface UploadOrphanCursor {
  state: 'expired' | 'finalized';
  expiresAt: number;
  id: string;
}
export interface UploadOrphanQuery extends UploadOrphanPolicy {
  projectId: string;
  now: number;
  limit: number;
  after?: UploadOrphanCursor;
}
export interface UploadOrphanCandidate
  extends UploadScope, UploadOrphanCursor {}
export interface UploadOrphanPage {
  items: UploadOrphanCandidate[];
  next: UploadOrphanCursor | null;
}
export function validateUploadOrphanPolicy(input: UploadOrphanPolicy): void {
  assertUploadTime(input.retainAfterExpiryMs);
  if (input.retainAfterExpiryMs < uploadCleanupGraceMs)
    throw new UploadIntentError('UPLOAD_INVALID');
}
export function validateUploadOrphanQuery(input: UploadOrphanQuery): void {
  validateUploadOrphanPolicy(input);
  assertId(input.projectId);
  assertUploadTime(input.now);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20)
    throw new UploadIntentError('UPLOAD_INVALID');
  if (input.after) {
    assertId(input.after.id);
    assertUploadTime(input.after.expiresAt);
    if (!['expired', 'finalized'].includes(input.after.state))
      throw new UploadIntentError('UPLOAD_INVALID');
  }
}
export function validateUploadOrphanLease(input: UploadOrphanLease): void {
  validateUploadLease(input);
  validateUploadOrphanPolicy(input);
}
/** Attachment absence is checked atomically by each repository, in addition to these rules. */
export function assertUploadOrphanEligible(
  record: UploadIntentRecord,
  input: UploadOrphanLease,
): void {
  validateUploadOrphanLease(input);
  assertBlobKey(record.stagingKey, true);
  assertBlobKey(record.finalKey);
  if (
    !record.finalKey.startsWith('objects/') ||
    input.now - record.expiresAt < input.retainAfterExpiryMs ||
    !(
      (record.state === 'finalized' &&
        record.reservationState === 'used' &&
        record.verified !== null) ||
      (record.state === 'finalized' &&
        record.reservationState === 'released' &&
        record.policyState === 'deleted')
    )
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  if (
    record.leaseId !== null &&
    record.leaseId !== input.leaseId &&
    record.leaseExpiresAt! > input.now
  )
    throw new UploadIntentError('UPLOAD_LEASE_LOST');
}
export function uploadOrphanPage(
  input: UploadOrphanQuery,
  rows: UploadOrphanCandidate[],
): UploadOrphanPage {
  const items = rows.slice(0, input.limit),
    last = items.at(-1);
  return {
    items,
    next:
      rows.length > input.limit && last
        ? { state: last.state, expiresAt: last.expiresAt, id: last.id }
        : null,
  };
}
function live(
  input: UploadOrphanLease,
  clock: () => number,
): UploadOrphanLease {
  const result = { ...input, now: clock() };
  validateUploadOrphanLease(result);
  return result;
}
/** Retire an unlinked used object before I/O; release used quota only after complete physical absence. */
export async function cleanupOrphanUploadIntent(
  deps: Pick<UploadDependencies, 'intents' | 'blobs' | 'multipartReconciler'>,
  input: UploadOrphanLease,
  clock: () => number = Date.now,
): Promise<UploadIntentRecord> {
  const record = await deps.intents.claimOrphanCleanup(live(input, clock));
  const deadline = createUploadCleanupDeadline(input, clock);
  try {
    if (record.multipart) {
      if (!deps.multipartReconciler)
        throw new UploadIntentError('UPLOAD_UNAVAILABLE');
      await reconcileUnknownMultipart(
        deps.multipartReconciler,
        record.stagingKey,
        deadline,
      );
    }
    await deadline.wait(() => deps.blobs.delete(record.stagingKey));
    await deadline.wait(() => deps.blobs.delete(record.finalKey));
    if (
      (await deadline.wait(() => deps.blobs.head(record.stagingKey))) ||
      (await deadline.wait(() => deps.blobs.head(record.finalKey)))
    )
      throw new BlobStoreError('BLOB_UNAVAILABLE');
    deadline.check();
    return deps.intents.releaseUsedAfterCleanup(live(input, clock));
  } finally {
    deadline.close();
  }
}
export async function cleanupOrphanUploadPage(
  deps: Pick<UploadDependencies, 'intents' | 'blobs' | 'multipartReconciler'>,
  input: UploadOrphanQuery,
  clock: () => number = Date.now,
): Promise<{
  next: UploadOrphanCursor | null;
  results: { id: string; outcome: 'released' | 'held' }[];
}> {
  validateUploadOrphanQuery(input);
  const page = await deps.intents.selectOrphanCleanup(input),
    results: { id: string; outcome: 'released' | 'held' }[] = [];
  for (const [index, candidate] of page.items.entries()) {
    const now = clock();
    try {
      // Await one candidate at a time; a timeout stops this page while late I/O may remain.
      // eslint-disable-next-line no-await-in-loop
      await cleanupOrphanUploadIntent(
        deps,
        {
          ...candidate,
          retainAfterExpiryMs: input.retainAfterExpiryMs,
          leaseId: crypto.randomUUID(),
          now,
          leaseExpiresAt: now + 300000,
        },
        clock,
      );
      results.push({ id: candidate.id, outcome: 'released' });
    } catch (error) {
      results.push({ id: candidate.id, outcome: 'held' });
      if (error instanceof UploadCleanupTimeoutError)
        return {
          next:
            index + 1 < page.items.length
              ? {
                  state: candidate.state,
                  expiresAt: candidate.expiresAt,
                  id: candidate.id,
                }
              : page.next,
          results,
        };
    }
  }
  return { next: page.next, results };
}
