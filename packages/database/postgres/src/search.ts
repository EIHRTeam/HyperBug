import { postgresSearchCandidates } from './search-candidates.ts';
import {
  searchTokenText,
  SEARCH_SCAN_LIMITS,
  SearchError,
  SEARCH_BOUNDS,
  validateSearchAst,
  type SearchQuery,
  type SearchPageOptions,
} from '@hyperbug/application';

/** PostgreSQL's native query constructors accept literal bound text, never public tsquery. */
export function compilePostgresSearch(
  query: SearchQuery,
  options: SearchPageOptions,
  columns: string,
) {
  const ast = validateSearchAst(query.ast);
  const values: (string | number | null)[] = [];
  const bind = (value: string | number | null) => {
    values.push(value);
    return `$${values.length}`;
  };
  let bytes = 0;
  const textHits: string[] = [];
  const branches = ast.branches
    .map(
      (branch) =>
        branch
          .map((leaf) => {
            let expression: string;
            if (leaf.kind === 'text') {
              if (!/[\p{L}\p{N}\p{M}]/u.test(leaf.value))
                return leaf.negated ? 'TRUE' : 'FALSE';
              bytes += new TextEncoder().encode(
                JSON.stringify({
                  text: leaf.value,
                  phrase: leaf.phrase,
                  scope: query.projectId,
                }),
              ).length;
              if (bytes > SEARCH_BOUNDS.ftsExpressionBytes)
                throw new SearchError('SEARCH_COMPLEXITY');
              const literal = bind(searchTokenText(leaf.value).trim());
              const textQuery = `plainto_tsquery('simple', ${literal})`;
              const fields = leaf.phrase
                ? `(d.title LIKE ${bind('%' + searchTokenText(leaf.value) + '%')} OR d.body LIKE ${bind('%' + searchTokenText(leaf.value) + '%')})`
                : `(d.title_vector @@ ${textQuery} OR d.body_vector @@ ${textQuery})`;
              const scope = bind(`p${query.projectId.replaceAll('-', '')}`);
              const hit = `search_hits_${textHits.length}`;
              textHits.push(`${hit} AS MATERIALIZED (SELECT d.issue_id FROM search_documents d WHERE (SELECT count(*) FROM candidate_issues) BETWEEN 1 AND ${SEARCH_SCAN_LIMITS[options.tier]} AND d.project_id = ${bind(query.projectId)}::uuid AND d.active = 1
        AND d.search_vector @@ (plainto_tsquery('simple', ${scope}) && plainto_tsquery('simple', ${literal}))
        AND ${fields})`);
              expression = `i.id IN (SELECT issue_id FROM ${hit})`;
            } else if (leaf.field === 'label' || leaf.field === 'assignee') {
              const table =
                leaf.field === 'label' ? 'issue_labels' : 'issue_assignees';
              const column =
                leaf.field === 'label' ? 'label_id' : 'principal_id';
              expression = `EXISTS (SELECT 1 FROM ${table} r WHERE r.project_id = i.project_id AND r.issue_id = i.id AND r.${column} = ${bind(leaf.value)}::uuid)`;
            } else {
              const column = {
                state: 'state',
                milestone: 'milestone_id',
                type: 'type_id',
                author: 'author_id',
                project: 'project_id',
              }[leaf.field];
              expression = `COALESCE(i.${column} = ${bind(leaf.value)}${leaf.field === 'state' ? '' : '::uuid'}, FALSE)`;
            }
            return leaf.negated ? `NOT (${expression})` : expression;
          })
          .join(' AND ') || 'TRUE',
    )
    .join(' OR ');
  const project = bind(query.projectId),
    principal = bind(query.principalId ?? null);
  const window = bind(options.window);
  const boundary = options.cursor
    ? `WHERE (created_at, id) < (${bind(options.cursor.time)}, ${bind(options.cursor.id)}::uuid)`
    : '';
  const limit = bind(options.limit + 1);
  const candidateProject = bind(query.projectId),
    candidatePrincipal = bind(query.principalId ?? null);
  const matches = `SELECT * FROM (
    SELECT ${columns
      .split(', ')
      .map((c) => `i.${c}`)
      .join(', ')} FROM canonical_issues i
    WHERE (SELECT count(*) FROM candidate_issues) <= ${SEARCH_SCAN_LIMITS[options.tier]} AND (${branches}) AND i.project_id = ${project}::uuid AND i.deleted_at IS NULL AND i.moderation = 'visible' AND i.body_text IS NOT NULL AND i.body_text_version IS NOT NULL
    AND EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id AND (p.visibility = 'public' OR EXISTS (
      SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id
      WHERE r.project_id = p.id AND r.principal_id = ${principal}::uuid AND a.kind = 'staff' AND a.status = 'active')))
    AND EXISTS (SELECT 1 FROM search_documents d WHERE d.project_id = i.project_id AND d.issue_id = i.id AND d.active = 1 AND d.revision = i.revision AND d.projection_version = i.body_text_version)
    ORDER BY i.created_at DESC, i.id DESC LIMIT ${window}
  ) matches ${boundary} ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  const candidates = postgresSearchCandidates(
    candidateProject,
    candidatePrincipal,
    SEARCH_SCAN_LIMITS[options.tier],
  );
  const canonicalColumns = [
    ...new Set([
      ...columns.split(', '),
      'id',
      'project_id',
      'deleted_at',
      'moderation',
      'body_text',
      'body_text_version',
      'revision',
      'state',
      'milestone_id',
      'type_id',
      'author_id',
    ]),
  ].join(', ');
  const sql = `WITH RECURSIVE ${candidates}, canonical_issues AS MATERIALIZED (
    SELECT i.* FROM candidate_issues c CROSS JOIN LATERAL (SELECT ${canonicalColumns} FROM issues WHERE project_id = ${candidateProject}::uuid AND id = c.id LIMIT 1) i
    WHERE (SELECT count(*) FROM candidate_issues) <= ${SEARCH_SCAN_LIMITS[options.tier]}
  ), ${textHits.length ? textHits.join(', ') + ',' : ''} page AS (${matches})
    SELECT page.*, 0 AS search_overflow FROM page
    UNION ALL SELECT ${columns
      .split(', ')
      .map(() => 'NULL')
      .join(
        ', ',
      )}, 1 AS search_overflow WHERE (SELECT count(*) FROM candidate_issues) > ${SEARCH_SCAN_LIMITS[options.tier]} ORDER BY created_at DESC, id DESC`;
  return { sql, values };
}
