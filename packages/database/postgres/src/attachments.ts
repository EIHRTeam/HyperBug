import type { Pool } from 'pg';
import { assertId } from '@hyperbug/domain';
import type { AttachmentStore } from '@hyperbug/application';
import { readPostgresUploadIntent } from './upload-intents.ts';

export function createPostgresAttachmentStore(pool: Pool): AttachmentStore {
  return {
    async get(id) {
      assertId(id);
      const { rows } = await pool.query<{
        id: string;
        project_id: string;
        upload_intent_id: string;
        principal_id: string;
        issue_id: string | null;
        comment_id: string | null;
        object_key: string;
        object_version: string;
        checksum: string;
        media_type: string;
        size_bytes: string;
        policy_state: 'pending' | 'ready' | 'quarantined' | 'deleted';
        revision: number;
      }>(
        'SELECT a.*, i.principal_id FROM attachments a JOIN upload_intents i ON i.id = a.upload_intent_id AND i.project_id = a.project_id WHERE a.id = $1',
        [id],
      );
      const row = rows[0];
      if (!row) return null;
      const upload = await readPostgresUploadIntent(pool, {
        id: row.upload_intent_id,
        projectId: row.project_id,
        principalId: row.principal_id,
      });
      return upload
        ? {
            id: row.id,
            projectId: row.project_id,
            uploadIntentId: row.upload_intent_id,
            issueId: row.issue_id,
            commentId: row.comment_id,
            objectKey: row.object_key,
            objectVersion: row.object_version,
            checksum: row.checksum,
            mediaType: row.media_type,
            sizeBytes: Number(row.size_bytes),
            policyState: row.policy_state,
            revision: Number(row.revision),
            upload,
          }
        : null;
    },
  };
}
