import { expect, it } from 'vitest';
import {
  runScheduledUploadCleanup,
  validateIssueFormAnswers,
  type AsyncMaintenanceStore,
  type UploadIntentStore,
  type ContentDefinitionStore,
  type BlobStore,
} from '@hyperbug/application';
import type { RepositoryHarness } from './repository-contract.ts';
import {
  seedFormSubmissionFixture,
  seedFormUpload,
} from './form-submission-contract.ts';

/** Real persisted cleanup and quota accounting; provider I/O is deliberately synthetic. */
export function asyncMaintenanceContract(
  get: () => {
    harness: RepositoryHarness;
    store: AsyncMaintenanceStore;
    uploads: UploadIntentStore;
    definitions: ContentDefinitionStore;
  },
) {
  it('scheduled maintenance recovers cursor leases, releases abandoned multipart quota and preserves referenced attachments', async () => {
    const { harness, store, uploads, definitions } = get();
    const f = await seedFormSubmissionFixture(harness, definitions);
    const orphan = await seedFormUpload(uploads, f),
      temporary = await seedFormUpload(uploads, f, { mode: 'pending' }),
      linked = await seedFormUpload(uploads, f);
    const values = { details: 'Referenced', files: [linked.id] };
    await harness.repository.createIssue({
      ...f.intent(),
      body: validateIssueFormAnswers(f.definition, values).markdown,
      formSubmission: {
        formId: f.formId,
        formVersion: 1,
        draftId: linked.association.draftId,
        values,
      },
    });
    await harness.query(
      "INSERT INTO upload_multipart_sessions (intent_id,project_id,state,provider_upload_id,part_bytes,max_parts) VALUES (?,?,'completed','synthetic-session',5242880,1)",
      [orphan.id, f.projectId],
    );
    let now = orphan.expiresAt + 86400000;
    await store.claimCleanup('initial', now);
    await harness.query(
      "UPDATE async_maintenance SET project_id=?,temporary=NULL,orphan=NULL WHERE name='uploads'",
      [f.projectId],
    );
    expect(await store.claimCleanup('competing', now + 1)).toBeNull();
    now += 90001;
    const resumed = await store.claimCleanup('resumed', now);
    expect(resumed?.projectId).toBe(f.projectId);
    await store.saveCleanup('initial', now, null, null);
    expect(
      (
        await harness.query(
          "SELECT lease_token FROM async_maintenance WHERE name='uploads'",
          [],
        )
      )[0]?.lease_token,
    ).toBe('resumed');
    await store.saveCleanup('resumed', now, null, null);
    await harness.query(
      "UPDATE async_maintenance SET project_id=? WHERE name='uploads'",
      [f.projectId],
    );
    const keys = new Set([
      orphan.stagingKey,
      orphan.finalKey,
      temporary.stagingKey,
      linked.finalKey,
    ]);
    const reconciled: string[] = [];
    const blobs = {
      async delete(key: string) {
        keys.delete(key);
      },
      async head(key: string) {
        return keys.has(key) ? {} : null;
      },
    } as unknown as BlobStore;
    await runScheduledUploadCleanup(
      store,
      {
        intents: uploads,
        blobs,
        multipartReconciler: {
          async reconcile({ key }) {
            reconciled.push(key);
            return { key, remainingUploads: 0 };
          },
        },
      },
      86400000,
      () => now,
    );
    expect(reconciled).toEqual([orphan.stagingKey]);
    expect((await uploads.get(orphan))?.reservationState).toBe('released');
    expect((await uploads.get(temporary))?.reservationState).toBe('released');
    expect((await uploads.get(linked))?.reservationState).toBe('used');
    expect(keys).toEqual(new Set([linked.finalKey]));
    expect(
      (
        await harness.query(
          'SELECT used_bytes,reserved_bytes,reserved_count FROM project_upload_usage WHERE project_id=?',
          [f.projectId],
        )
      ).map((row) => [
        Number(row.used_bytes),
        Number(row.reserved_bytes),
        Number(row.reserved_count),
      ]),
    ).toEqual([[3, 0, 0]]);
    expect(
      (
        await harness.query(
          "SELECT project_id FROM async_maintenance WHERE name='uploads'",
          [],
        )
      )[0]?.project_id,
    ).not.toBe(f.projectId);
  });
}
