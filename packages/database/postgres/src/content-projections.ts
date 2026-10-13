import type { Pool } from 'pg';
import {
  projectionBackfillOptions,
  type ContentProjectionStore,
  type ProjectionRow,
} from '@hyperbug/application';
import {
  projectMarkdownText,
  textProjectionVersion,
  MarkdownPolicyError,
} from '@hyperbug/security/markdown';

export function createPostgresContentProjectionStore(
  pool: Pool,
): ContentProjectionStore {
  return {
    async backfill(query) {
      const { projectId, resource, limit, after } =
        projectionBackfillOptions(query);
      const rows = (
        await pool.query<ProjectionRow>(
          `SELECT id, revision, body FROM ${resource} WHERE project_id = $1 AND (body_text_version IS NULL OR body_text_version != $2) ${after ? 'AND id > $4' : ''} ORDER BY id LIMIT $3`,
          [
            projectId,
            textProjectionVersion,
            limit + 1,
            ...(after ? [after] : []),
          ],
        )
      ).rows;
      const page = rows.slice(0, limit);
      const rejectedIds: string[] = [];
      let updated = 0;
      // No long transaction or scheduler: bounded CAS updates tolerate a
      // concurrent body write and crash/replay without overwriting its text.
      for (const row of page) {
        let projection;
        try {
          projection = projectMarkdownText(row.body);
        } catch (error) {
          if (!(error instanceof MarkdownPolicyError)) throw error;
          rejectedIds.push(row.id);
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const result = await pool.query(
          `UPDATE ${resource} SET body_text = $1, body_text_version = $2 WHERE id = $3 AND revision = $4 AND (body_text_version IS NULL OR body_text_version != $2)`,
          [projection.text, projection.version, row.id, row.revision],
        );
        updated += result.rowCount ?? 0;
      }
      return {
        processed: page.length,
        updated,
        rejectedIds,
        nextCursor: rows.length > limit ? page.at(-1)!.id : null,
      };
    },
  };
}
