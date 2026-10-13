import type { D1Database } from '@cloudflare/workers-types';
import {
  validateUploadLegacyInventoryQuery,
  uploadLegacyInventoryPage,
  type UploadLegacyInventoryRow,
  type UploadLegacyInventoryStore,
} from '@hyperbug/application';

export const uploadLegacyInventorySql =
  'SELECT p.id, p.project_id AS projectId, p.principal_id AS principalId, p.state, p.revision, p.object_key AS objectKey, p.media_type AS contentType, p.max_bytes AS maxBytes, p.created_at AS createdAt, p.expires_at AS expiresAt, p.actual_bytes AS actualBytes, p.verified_object_version AS objectVersion, p.verified_checksum AS checksum, d.intent_id IS NOT NULL AS hasLifecycle, EXISTS(SELECT 1 FROM attachments a WHERE a.upload_intent_id = p.id) AS hasAttachment FROM (SELECT * FROM upload_intents WHERE project_id = ? AND id > ? ORDER BY id LIMIT ?) p LEFT JOIN upload_intent_details d ON d.intent_id = p.id AND d.project_id = p.project_id ORDER BY p.id';

/** Separate read-only recovery port; deliberately cannot adopt or clean historical records. */
export function createD1UploadLegacyInventoryStore(
  db: D1Database,
): UploadLegacyInventoryStore {
  return {
    async inspect(input) {
      validateUploadLegacyInventoryQuery(input);
      const rows = await db
        .prepare(uploadLegacyInventorySql)
        .bind(
          input.projectId,
          input.after ?? '00000000-0000-0000-0000-000000000000',
          input.limit + 1,
        )
        .all<UploadLegacyInventoryRow>();
      return uploadLegacyInventoryPage(
        input,
        rows.results.map((row) => ({
          ...row,
          hasLifecycle: Boolean(row.hasLifecycle),
          hasAttachment: Boolean(row.hasAttachment),
        })),
      );
    },
  };
}
