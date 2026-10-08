import type { Pool } from 'pg';
import {
  searchBackfillOptions,
  searchTokenText,
  SEARCH_SCAN_LIMITS,
  SearchError,
  type SearchIndexStore,
  type SearchSourceRow,
} from '@hyperbug/application';
import { assertId } from '@hyperbug/domain';

export function createPostgresSearchIndexStore(pool: Pool): SearchIndexStore {
  return {
    async ready(query) {
      assertId(query.projectId);
      if (query.principalId) assertId(query.principalId);
      const maximum = SEARCH_SCAN_LIMITS[query.tier ?? 'standard'];
      const result = (
        await pool.query<{ scanned: string; missing: string }>(
          `SELECT count(*) AS scanned, COALESCE(sum(missing), 0) AS missing FROM (
        SELECT CASE WHEN i.moderation = 'visible' AND i.deleted_at IS NULL AND (i.body_text_version IS NULL OR NOT EXISTS (SELECT 1 FROM search_documents d WHERE d.project_id = i.project_id AND d.issue_id = i.id AND d.active = 1 AND d.revision = i.revision AND d.projection_version = i.body_text_version)) THEN 1 ELSE 0 END AS missing
        FROM issues i WHERE i.project_id = $1
        AND EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id AND (p.visibility = 'public' OR EXISTS (SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id WHERE r.project_id = p.id AND r.principal_id = $2::uuid AND a.kind = 'staff' AND a.status = 'active')))
        ORDER BY i.created_at DESC, i.id DESC LIMIT $3) candidates`,
          [query.projectId, query.principalId ?? null, maximum + 1],
        )
      ).rows[0];
      if (!result || Number(result.scanned) > maximum)
        throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
      return Number(result.missing) === 0;
    },
    async backfill(query) {
      const { projectId, after, limit } = searchBackfillOptions(query);
      const rows = (
        await pool.query<SearchSourceRow>(
          `SELECT id, revision, title, body_text, body_text_version, moderation, deleted_at FROM issues WHERE project_id = $1 ${after ? 'AND id > $3::uuid' : ''} ORDER BY id LIMIT $2`,
          [projectId, limit + 1, ...(after ? [after] : [])],
        )
      ).rows;
      const page = rows.slice(0, limit),
        rejectedIds: string[] = [];
      const documents = [];
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
        documents.push({
          ...row,
          active: active ? 1 : 0,
          title: active ? searchTokenText(row.title) : '',
          body: active ? searchTokenText(row.body_text!) : '',
        });
      }
      query.signal?.throwIfAborted();
      const result = documents.length
        ? await pool.query(
            `INSERT INTO search_documents (issue_id, project_id, revision, projection_version, active, scope, title, body)
        SELECT s.id, $1::uuid, s.revision, s.body_text_version, s.active, $3, s.title, s.body
        FROM jsonb_to_recordset($2::jsonb) AS s(id uuid, revision integer, body_text_version text, active integer, title text, body text, moderation text, deleted_at bigint)
        JOIN issues i ON i.project_id = $1::uuid AND i.id = s.id AND i.revision = s.revision AND i.body_text_version IS NOT DISTINCT FROM s.body_text_version AND i.moderation = s.moderation AND i.deleted_at IS NOT DISTINCT FROM s.deleted_at
        ON CONFLICT(issue_id) DO UPDATE SET revision = excluded.revision, projection_version = excluded.projection_version, active = excluded.active, scope = excluded.scope, title = excluded.title, body = excluded.body WHERE search_documents.revision <= excluded.revision RETURNING issue_id`,
            [
              projectId,
              JSON.stringify(documents),
              `p${projectId.replaceAll('-', '')}`,
            ],
          )
        : null;
      const updated = result?.rowCount ?? 0;
      return {
        processed: page.length,
        updated,
        rejectedIds,
        nextCursor: rows.length > limit ? page.at(-1)!.id : null,
      };
    },
  };
}
