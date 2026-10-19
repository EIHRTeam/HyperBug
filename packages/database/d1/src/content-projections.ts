import type { D1Database } from '@cloudflare/workers-types';
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

export function createD1ContentProjectionStore(
  db: D1Database,
): ContentProjectionStore {
  return {
    async backfill(query) {
      const { projectId, resource, limit, after } =
        projectionBackfillOptions(query);
      const rows = (
        await db
          .prepare(
            `SELECT id, revision, body FROM ${resource} WHERE project_id = ? AND (body_text_version IS NULL OR body_text_version != ?) ${after ? 'AND id > ?' : ''} ORDER BY id LIMIT ?`,
          )
          .bind(
            ...[
              projectId,
              textProjectionVersion,
              ...(after ? [after] : []),
              limit + 1,
            ],
          )
          .all<ProjectionRow>()
      ).results;
      const page = rows.slice(0, limit);
      const rejectedIds: string[] = [];
      const statements = [];
      for (const row of page) {
        try {
          const projection = projectMarkdownText(row.body);
          statements.push(
            db
              .prepare(
                `UPDATE ${resource} SET body_text = ?, body_text_version = ? WHERE id = ? AND revision = ? AND (body_text_version IS NULL OR body_text_version != ?)`,
              )
              .bind(
                projection.text,
                projection.version,
                row.id,
                row.revision,
                projection.version,
              ),
          );
        } catch (error) {
          if (!(error instanceof MarkdownPolicyError)) throw error;
          rejectedIds.push(row.id);
        }
      }
      const results = statements.length ? await db.batch(statements) : [];
      return {
        processed: page.length,
        updated: results.reduce(
          (total, result) => total + result.meta.changes,
          0,
        ),
        rejectedIds,
        nextCursor: rows.length > limit ? page.at(-1)!.id : null,
      };
    },
  };
}
