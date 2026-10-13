/* eslint-disable no-await-in-loop -- One transaction client; lock and consume at most 32 files sequentially. */
import type { PoolClient } from 'pg';
import {
  assertIssueFormUpload,
  IssueFormError,
  type CreateIssueIntent,
  type IssueFormDefinition,
} from '@hyperbug/application';
import { readPostgresUploadIntent } from './upload-intents.ts';

/** Caller already holds the project/principal/form/default locks. */
export async function consumeFormAttachments(
  db: PoolClient,
  create: CreateIssueIntent,
  definition: IssueFormDefinition,
  ids: readonly string[],
) {
  for (const id of ids) {
    const scope = {
      id,
      projectId: create.projectId,
      principalId: create.principalId,
    };
    await readPostgresUploadIntent(db, scope, true);
    await db.query(
      'SELECT intent_id FROM upload_scan_results WHERE project_id = $1 AND intent_id = $2 FOR SHARE',
      [create.projectId, id],
    );
    const upload = await readPostgresUploadIntent(db, scope);
    assertIssueFormUpload(definition, create.formSubmission!, upload);
    if (
      (
        await db.query(
          'SELECT 1 FROM attachments WHERE upload_intent_id = $1',
          [id],
        )
      ).rowCount
    )
      throw new IssueFormError('FORM_ATTACHMENTS_INVALID', 'attachments');
    await db.query(
      "INSERT INTO attachments (id, project_id, upload_intent_id, issue_id, object_key, object_version, checksum, media_type, size_bytes, policy_state, created_at) VALUES ($1, $2, $1, $3, $4, $5, $6, $7, $8, 'ready', $9)",
      [
        id,
        create.projectId,
        create.id,
        upload.finalKey,
        `sha256:${upload.verified.sha256}`,
        upload.verified.sha256,
        upload.contentType,
        upload.verified.size,
        create.now,
      ],
    );
    await db.query(
      "UPDATE upload_intent_details SET association_kind = 'issue', draft_id = NULL, issue_id = $1 WHERE intent_id = $2 AND project_id = $3",
      [create.id, id, create.projectId],
    );
    await db.query(
      'UPDATE upload_intents SET revision = revision + 1 WHERE id = $1 AND project_id = $2',
      [id, create.projectId],
    );
  }
}
