import type { Pool } from 'pg';
import {
  validateUploadLegacyInventoryQuery,
  uploadLegacyInventoryPage,
  type UploadLegacyInventoryRow,
  type UploadLegacyInventoryStore,
} from '@hyperbug/application';

export const uploadLegacyInventorySql =
  'SELECT p.id, p.project_id AS "projectId", p.principal_id AS "principalId", p.state, p.revision, p.object_key AS "objectKey", p.media_type AS "contentType", p.max_bytes AS "maxBytes", p.created_at AS "createdAt", p.expires_at AS "expiresAt", p.actual_bytes AS "actualBytes", p.verified_object_version AS "objectVersion", p.verified_checksum AS checksum, d.intent_id IS NOT NULL AS "hasLifecycle", EXISTS(SELECT 1 FROM attachments a WHERE a.upload_intent_id = p.id) AS "hasAttachment" FROM (SELECT * FROM upload_intents WHERE project_id = $1 AND id > $2 ORDER BY id LIMIT $3) p LEFT JOIN upload_intent_details d ON d.intent_id = p.id AND d.project_id = p.project_id ORDER BY p.id';

/** The existing project/ID unique index bounds the base window before lifecycle classification. */
export function createPostgresUploadLegacyInventoryStore(
  pool: Pool,
): UploadLegacyInventoryStore {
  return {
    async inspect(input) {
      validateUploadLegacyInventoryQuery(input);
      const { rows } = await pool.query<UploadLegacyInventoryRow>(
        uploadLegacyInventorySql,
        [
          input.projectId,
          input.after ?? '00000000-0000-0000-0000-000000000000',
          input.limit + 1,
        ],
      );
      return uploadLegacyInventoryPage(
        input,
        rows.map((row) => ({
          ...row,
          maxBytes: Number(row.maxBytes),
          actualBytes:
            row.actualBytes === null ? null : Number(row.actualBytes),
          createdAt: Number(row.createdAt),
          expiresAt: Number(row.expiresAt),
        })),
      );
    },
  };
}
