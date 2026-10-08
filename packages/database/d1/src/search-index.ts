import type { D1Database } from '@cloudflare/workers-types';
import {
  searchBackfillOptions,
  searchTokenText,
  SEARCH_SCAN_LIMITS,
  SearchError,
  type SearchIndexStore,
  type SearchSourceRow,
} from '@hyperbug/application';
import { assertId } from '@hyperbug/domain';

export function createD1SearchIndexStore(db: D1Database): SearchIndexStore {
  return {
    async ready(query) {
      assertId(query.projectId);
      if (query.principalId) assertId(query.principalId);
      const maximum = SEARCH_SCAN_LIMITS[query.tier ?? 'standard'];
      const result = await db
        .prepare(`SELECT count(*) AS scanned, COALESCE(sum(missing), 0) AS missing FROM (
        SELECT CASE WHEN i.moderation = 'visible' AND i.deleted_at IS NULL AND (i.body_text_version IS NULL OR NOT EXISTS (SELECT 1 FROM search_documents d WHERE d.project_id = i.project_id AND d.issue_id = i.id AND d.active = 1 AND d.revision = i.revision AND d.projection_version = i.body_text_version)) THEN 1 ELSE 0 END AS missing
        FROM issues i WHERE i.project_id = ?
        AND EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id AND (p.visibility = 'public' OR EXISTS (SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id WHERE r.project_id = p.id AND r.principal_id = ? AND a.kind = 'staff' AND a.status = 'active')))
        ORDER BY i.created_at DESC, i.id DESC LIMIT ?)`)
        .bind(query.projectId, query.principalId ?? null, maximum + 1)
        .first<{ scanned: number; missing: number }>();
      if (!result || result.scanned > maximum)
        throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
      return result.missing === 0;
    },
    async backfill(query) {
      const { projectId, after, limit } = searchBackfillOptions(query);
      const rows = (
        await db
          .prepare(
            `SELECT id, revision, title, body_text, body_text_version, moderation, deleted_at FROM issues WHERE project_id = ? ${after ? 'AND id > ?' : ''} ORDER BY id LIMIT ?`,
          )
          .bind(projectId, ...(after ? [after] : []), limit + 1)
          .all<SearchSourceRow>()
      ).results;
      const page = rows.slice(0, limit),
        rejectedIds: string[] = [],
        statements = [];
      for (const row of page) {
        query.signal?.throwIfAborted();
        const active = row.moderation === 'visible' && row.deleted_at === null;
        if (
          active &&
          (row.body_text === null || row.body_text_version === null)
        ) {
          rejectedIds.push(row.id);
          continue;
        }
        statements.push(
          db
            .prepare(`INSERT INTO search_documents (issue_id, project_id, revision, projection_version, active, scope, title, body)
          SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM issues i WHERE i.project_id = ? AND i.id = ? AND i.revision = ? AND i.body_text_version IS ? AND i.moderation = ? AND i.deleted_at IS ?)
          ON CONFLICT(issue_id) DO UPDATE SET revision = excluded.revision, projection_version = excluded.projection_version, active = excluded.active, scope = excluded.scope, title = excluded.title, body = excluded.body WHERE search_documents.revision <= excluded.revision RETURNING issue_id`)
            .bind(
              row.id,
              projectId,
              row.revision,
              row.body_text_version,
              active ? 1 : 0,
              `p${projectId.replaceAll('-', '')}`,
              active ? searchTokenText(row.title) : '',
              active ? searchTokenText(row.body_text!) : '',
              projectId,
              row.id,
              row.revision,
              row.body_text_version,
              row.moderation,
              row.deleted_at,
            ),
        );
      }
      query.signal?.throwIfAborted();
      const results = statements.length ? await db.batch(statements) : [];
      return {
        processed: page.length,
        updated: results.reduce((n, result) => n + result.results.length, 0),
        rejectedIds,
        nextCursor: rows.length > limit ? page.at(-1)!.id : null,
      };
    },
  };
}
