import {
  cleanupUploadPage,
  type UploadCleanupCursor,
} from './upload-cleanup.ts';
import {
  cleanupOrphanUploadPage,
  type UploadOrphanCursor,
} from './upload-orphan-cleanup.ts';
import type { UploadDependencies } from './uploads.ts';
export interface CleanupCheckpoint {
  projectId: string;
  temporary: UploadCleanupCursor | null;
  orphan: UploadOrphanCursor | null;
}
export interface AsyncMaintenanceStore {
  purgeJobs(before: number, limit: number): Promise<number>;
  claimCleanup(token: string, now: number): Promise<CleanupCheckpoint | null>;
  saveCleanup(
    token: string,
    now: number,
    temporary: UploadCleanupCursor | null,
    orphan: UploadOrphanCursor | null,
  ): Promise<void>;
  recoverableJobs(now: number, limit: number): Promise<string[]>;
}
/** One project and one candidate per cleanup category per invocation. Existing cleanup owns all deletion decisions. */
export async function runScheduledUploadCleanup(
  store: AsyncMaintenanceStore,
  uploads: Pick<
    UploadDependencies,
    'intents' | 'blobs' | 'multipartReconciler'
  >,
  retainAfterExpiryMs: number,
  clock: () => number = Date.now,
): Promise<void> {
  const token = crypto.randomUUID(),
    checkpoint = await store.claimCleanup(token, clock());
  if (!checkpoint) return;
  const temporary = await cleanupUploadPage(
    uploads,
    {
      projectId: checkpoint.projectId,
      now: clock(),
      limit: 1,
      ...(checkpoint.temporary ? { after: checkpoint.temporary } : {}),
    },
    clock,
  );
  const orphan = await cleanupOrphanUploadPage(
    uploads,
    {
      projectId: checkpoint.projectId,
      now: clock(),
      limit: 1,
      retainAfterExpiryMs,
      ...(checkpoint.orphan ? { after: checkpoint.orphan } : {}),
    },
    clock,
  );
  await store.saveCleanup(token, clock(), temporary.next, orphan.next);
}
