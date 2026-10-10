import { assertId } from '@hyperbug/domain';
import {
  UploadIntentError,
  assertUploadTime,
  type UploadScope,
} from './upload-intents.ts';
import { cleanupUploadIntent, type UploadDependencies } from './uploads.ts';
import {
  createUploadCleanupDeadline,
  UploadCleanupTimeoutError,
} from './upload-cleanup-deadline.ts';

export const uploadCleanupStates = [
  'expired',
  'pending',
  'rejected',
  'uploaded',
] as const;
/** Trusted provider adapter: exhaust exact-key discovery, abort all matches and confirm absence. */
export interface UploadMultipartReconciler {
  reconcile(input: {
    key: string;
    signal: AbortSignal;
  }): Promise<{ key: string; remainingUploads: 0 }>;
}
export async function reconcileUnknownMultipart(
  reconciler: UploadMultipartReconciler,
  key: string,
  sharedDeadline?: ReturnType<typeof createUploadCleanupDeadline>,
): Promise<void> {
  const deadline = sharedDeadline ?? createUploadCleanupDeadline();
  try {
    const proof = await deadline.wait((signal) =>
      reconciler.reconcile({ key, signal }),
    );
    if (
      !proof ||
      Object.keys(proof).sort().join(',') !== 'key,remainingUploads' ||
      proof.key !== key ||
      proof.remainingUploads !== 0
    )
      throw new UploadIntentError('UPLOAD_UNAVAILABLE');
  } catch (error) {
    if (error instanceof UploadCleanupTimeoutError) throw error;
    throw new UploadIntentError('UPLOAD_UNAVAILABLE');
  } finally {
    if (!sharedDeadline) deadline.close();
  }
}
export interface UploadCleanupCursor {
  state: (typeof uploadCleanupStates)[number];
  expiresAt: number;
  id: string;
}
export interface UploadCleanupQuery {
  projectId: string;
  now: number;
  limit: number;
  after?: UploadCleanupCursor;
}
export interface UploadCleanupCandidate
  extends UploadScope, UploadCleanupCursor {}
export interface UploadCleanupPage {
  items: UploadCleanupCandidate[];
  next: UploadCleanupCursor | null;
}
export function validateUploadCleanupQuery(input: UploadCleanupQuery): void {
  assertId(input.projectId);
  assertUploadTime(input.now);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20)
    throw new UploadIntentError('UPLOAD_INVALID');
  if (input.after) {
    assertId(input.after.id);
    assertUploadTime(input.after.expiresAt);
    if (!uploadCleanupStates.includes(input.after.state))
      throw new UploadIntentError('UPLOAD_INVALID');
  }
}
export function uploadCleanupPage(
  input: UploadCleanupQuery,
  rows: UploadCleanupCandidate[],
): UploadCleanupPage {
  const items = rows.slice(0, input.limit);
  const last = items.at(-1);
  return {
    items,
    next:
      rows.length > input.limit && last
        ? { state: last.state, expiresAt: last.expiresAt, id: last.id }
        : null,
  };
}
/** At most 20 sequential claims; a storage timeout stops this page. No dispatcher/public enumeration. */
export async function cleanupUploadPage(
  deps: Pick<UploadDependencies, 'intents' | 'blobs' | 'multipartReconciler'>,
  query: UploadCleanupQuery,
  clock: () => number = Date.now,
): Promise<{
  next: UploadCleanupCursor | null;
  results: { id: string; outcome: 'released' | 'held' }[];
}> {
  validateUploadCleanupQuery(query);
  const page = await deps.intents.selectCleanup(query);
  const results: { id: string; outcome: 'released' | 'held' }[] = [];
  for (const [index, candidate] of page.items.entries()) {
    const now = clock();
    try {
      // Await one candidate at a time; stop if noncooperative I/O may still be pending.
      // eslint-disable-next-line no-await-in-loop
      await cleanupUploadIntent(
        deps,
        {
          ...candidate,
          leaseId: crypto.randomUUID(),
          now,
          leaseExpiresAt: now + 300000,
        },
        clock,
      );
      results.push({ id: candidate.id, outcome: 'released' });
    } catch (error) {
      // Retained quota/tombstones support a later sweep; provider details never leave the port.
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
