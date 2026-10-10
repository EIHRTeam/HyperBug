import { createPostgresSearchBudgetStore } from './search-budget.ts';
import { postgresSearchCandidates } from './search-candidates.ts';
import type { Pool } from 'pg';
import {
  searchBackfillOptions,
  SEARCH_MINIMUM_BUDGET,
  searchAvailability,
  searchTokenText,
  SEARCH_SCAN_LIMITS,
  SearchError,
  type SearchIndexStore,
  type SearchSourceRow,
} from '@hyperbug/application';
import { assertId } from '@hyperbug/domain';

export function createPostgresSearchIndexStore(pool: Pool): SearchIndexStore {
  return {
    async revisionOf(projectId, issueId, mutationId) {
      assertId(projectId);
      assertId(issueId);
      assertId(mutationId);
      const row = (
        await pool.query<{ aggregate_revision: number }>(
          'SELECT aggregate_revision FROM timeline_events WHERE project_id = $1 AND issue_id = $2 AND id = $3',
          [projectId, issueId, mutationId],
        )
      ).rows[0];
      return row?.aggregate_revision ?? null;
    },
    async ready(query) {
      assertId(query.projectId);
      if (query.principalId) assertId(query.principalId);
      const maximum = SEARCH_SCAN_LIMITS[query.tier ?? 'standard'];
      const result = (
        await pool.query<{ scanned: string; missing: string }>(
          `WITH RECURSIVE ${postgresSearchCandidates('$1', '$2', maximum)}
          SELECT count(*) AS scanned, COALESCE(sum(CASE WHEN i.moderation = 'visible' AND i.deleted_at IS NULL AND (i.body_text IS NULL OR i.body_text_version IS NULL OR NOT EXISTS (SELECT 1 FROM search_documents d WHERE d.project_id = i.project_id AND d.issue_id = i.id AND d.active = 1 AND d.revision = i.revision AND d.projection_version = i.body_text_version)) THEN 1 ELSE 0 END), 0) AS missing
          FROM candidate_issues c CROSS JOIN LATERAL (SELECT id, project_id, revision, moderation, deleted_at, body_text, body_text_version FROM issues WHERE project_id = $1::uuid AND id = c.id LIMIT 1) i`,
          [query.projectId, query.principalId ?? null],
        )
      ).rows[0];
      if (!result || Number(result.scanned) > maximum)
        throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
      return Number(result.missing) === 0;
    },
    async backfill(query) {
      const { projectId, after, limit } = searchBackfillOptions(query);
      try {
        if (
          query.tier === 'cloudflare-minimum' &&
          !(await createPostgresSearchBudgetStore(pool).reserve({
            reads: SEARCH_MINIMUM_BUDGET.indexReads,
            writes: 8 + limit * SEARCH_MINIMUM_BUDGET.indexWritesPerDocument,
            nowMs: Date.now(),
          }))
        )
          throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
        const rows = (
          await pool.query<SearchSourceRow>(
            `SELECT id, revision, title, body_text, body_text_version, moderation, deleted_at FROM issues WHERE project_id = $1 ${query.event ? 'AND id = $3::uuid AND revision = $4' : after ? 'AND id > $3::uuid' : ''} ORDER BY id LIMIT $2`,
            [
              projectId,
              query.event ? 1 : limit + 1,
              ...(query.event
                ? [query.event.issueId, query.event.revision]
                : after
                  ? [after]
                  : []),
            ],
          )
        ).rows;
        const page = rows.slice(0, limit),
          rejectedIds: string[] = [];
        const documents = [];
        for (const row of page) {
          query.signal?.throwIfAborted();
          const active =
            row.moderation === 'visible' && row.deleted_at === null;
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
        ON CONFLICT(issue_id) DO UPDATE SET revision = excluded.revision, projection_version = excluded.projection_version, active = excluded.active, scope = excluded.scope, title = excluded.title, body = excluded.body WHERE search_documents.revision <= excluded.revision AND (search_documents.revision != excluded.revision OR search_documents.active != excluded.active OR search_documents.projection_version IS DISTINCT FROM excluded.projection_version OR search_documents.title != excluded.title OR search_documents.body != excluded.body) RETURNING issue_id`,
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
      } catch (error) {
        throw searchAvailability(error);
      }
    },
  };
}
