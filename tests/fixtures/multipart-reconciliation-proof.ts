import type {
  BlobStore,
  UploadMultipartReconciler,
} from '@hyperbug/application';
import { blobKey, blobTestStream } from './blob-store-proof.ts';

/** Actual provider discovery/abort proof; invokes no modeled discovery callback. */
export async function proveMultipartReconciliation(
  store: BlobStore,
  reconciler: UploadMultipartReconciler,
): Promise<{
  sameKeySessions: 21;
  unrelatedPreserved: true;
  lateReconciled: true;
  absentChecks: 3;
}> {
  const key = blobKey(),
    otherKey = blobKey();
  const sessions: { key: string; uploadId: string }[] = [];
  try {
    const first = await store.createMultipart({
      key,
      contentType: 'application/octet-stream',
    });
    sessions.push(first);
    const duplicate = await store.createMultipart({
      key,
      contentType: 'application/octet-stream',
    });
    sessions.push(duplicate);
    for (let index = 2; index < 21; index++) {
      // Twenty-one same-key sessions force the real provider continuation-marker path.
      // eslint-disable-next-line no-await-in-loop
      sessions.push(
        await store.createMultipart({
          key,
          contentType: 'application/octet-stream',
        }),
      );
    }
    const unrelated = await store.createMultipart({
      key: otherKey,
      contentType: 'application/octet-stream',
    });
    sessions.push(unrelated);
    const signal = new AbortController().signal;
    await proveAbsent(reconciler, key, signal);
    for (const session of [first, duplicate]) {
      // Each provider upload really disappeared; success is not inferred only from the proof DTO.
      // eslint-disable-next-line no-await-in-loop
      await proveAborted(store, session);
    }
    const part = await store.uploadPart(unrelated, 1, blobTestStream(1), 1);
    if ((await store.completeMultipart(unrelated, [part])).size !== 1)
      throw new Error('Unrelated multipart session changed');
    const late = await store.createMultipart({
      key,
      contentType: 'application/octet-stream',
    });
    sessions.push(late);
    await proveAbsent(reconciler, key, signal);
    await proveAborted(store, late);
    await proveAbsent(reconciler, key, signal);
    return {
      sameKeySessions: 21,
      unrelatedPreserved: true,
      lateReconciled: true,
      absentChecks: 3,
    };
  } finally {
    await Promise.all(sessions.map((session) => store.abortMultipart(session)));
    await Promise.all([store.delete(key), store.delete(otherKey)]);
  }
}

async function proveAbsent(
  reconciler: UploadMultipartReconciler,
  key: string,
  signal: AbortSignal,
): Promise<void> {
  const result = await reconciler.reconcile({ key, signal });
  if (result.key !== key || result.remainingUploads !== 0)
    throw new Error('Multipart absence not established');
}
async function proveAborted(
  store: BlobStore,
  session: { key: string; uploadId: string },
): Promise<void> {
  let refused = false;
  try {
    await store.uploadPart(session, 1, blobTestStream(1), 1);
  } catch {
    refused = true;
  }
  if (!refused) throw new Error('Multipart session still writable');
}
