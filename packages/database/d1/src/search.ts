import {
  searchTokenText,
  SEARCH_SCAN_LIMITS,
  SearchError,
  SEARCH_BOUNDS,
  validateSearchAst,
  type SearchQuery,
  type SearchPageOptions,
} from '@hyperbug/application';

/** Native FTS syntax is generated here only; every user value remains a binding. */
export function compileD1Search(
  query: SearchQuery,
  options: SearchPageOptions,
  columns: string,
) {
  const ast = validateSearchAst(query.ast);
  const values: (string | number | null)[] = [];
  const bind = (value: string | number | null) => {
    values.push(value);
    return '?';
  };
  let bytes = 0;
  const branches = ast.branches
    .map(
      (branch) =>
        branch
          .map((leaf) => {
            let expression: string;
            if (leaf.kind === 'text') {
              const terms =
                searchTokenText(leaf.value)
                  .trim()
                  .match(/[\p{L}\p{N}\p{M}]+/gu) ?? [];
              if (!terms.length) return leaf.negated ? '1' : '0';
              const quote = (term: string) => `"${term.replaceAll('"', '""')}"`;
              const match = `scope : "p${query.projectId.replaceAll('-', '')}" AND {title body} : (${leaf.phrase ? quote(searchTokenText(leaf.value).trim()) : terms.map(quote).join(' AND ')})`;
              bytes += new TextEncoder().encode(match).length;
              if (bytes > SEARCH_BOUNDS.ftsExpressionBytes)
                throw new SearchError('SEARCH_COMPLEXITY');
              expression = `i.id IN (SELECT d.issue_id FROM issue_search_fts JOIN search_documents d ON d.rowid = issue_search_fts.rowid WHERE issue_search_fts MATCH ${bind(match)} AND d.project_id = ${bind(query.projectId)} AND d.active = 1)`;
            } else if (leaf.field === 'label' || leaf.field === 'assignee') {
              const table =
                leaf.field === 'label' ? 'issue_labels' : 'issue_assignees';
              const column =
                leaf.field === 'label' ? 'label_id' : 'principal_id';
              expression = `EXISTS (SELECT 1 FROM ${table} r WHERE r.project_id = i.project_id AND r.issue_id = i.id AND r.${column} = ${bind(leaf.value)})`;
            } else {
              const column = {
                state: 'state',
                milestone: 'milestone_id',
                type: 'type_id',
                author: 'author_id',
                project: 'project_id',
              }[leaf.field];
              expression = `COALESCE(i.${column} = ${bind(leaf.value)}, 0)`;
            }
            return leaf.negated ? `NOT (${expression})` : expression;
          })
          .join(' AND ') || '1',
    )
    .join(' OR ');
  const project = bind(query.projectId),
    principal = bind(query.principalId ?? null);
  const window = bind(options.window);
  const boundary = options.cursor
    ? `WHERE (created_at, id) < (${bind(options.cursor.time)}, ${bind(options.cursor.id)})`
    : '';
  const limit = bind(options.limit + 1);
  const matches = `SELECT * FROM (
    SELECT ${columns
      .split(', ')
      .map((c) => `i.${c}`)
      .join(', ')} FROM issues i
    WHERE (SELECT count(*) FROM candidate_issues) <= ${SEARCH_SCAN_LIMITS[options.tier]} AND i.id IN (SELECT id FROM candidate_issues) AND (${branches}) AND i.project_id = ${project} AND i.deleted_at IS NULL AND i.moderation = 'visible' AND i.body_text IS NOT NULL AND i.body_text_version IS NOT NULL
    AND EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id AND (p.visibility = 'public' OR EXISTS (
      SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id
      WHERE r.project_id = p.id AND r.principal_id = ${principal} AND a.kind = 'staff' AND a.status = 'active')))
    AND EXISTS (SELECT 1 FROM search_documents d WHERE d.project_id = i.project_id AND d.issue_id = i.id AND d.active = 1 AND d.revision = i.revision AND d.projection_version = i.body_text_version)
    ORDER BY i.created_at DESC, i.id DESC LIMIT ${window}
  ) ${boundary} ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  values.unshift(query.projectId, query.projectId, query.principalId ?? null);
  const candidates = `SELECT id FROM issues WHERE project_id = ? AND EXISTS (SELECT 1 FROM projects p WHERE p.id = ? AND (p.visibility = 'public' OR EXISTS (SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id WHERE r.project_id = p.id AND r.principal_id = ? AND a.kind = 'staff' AND a.status = 'active'))) ORDER BY created_at DESC, id DESC LIMIT ${SEARCH_SCAN_LIMITS[options.tier] + 1}`;
  const sql = `WITH candidate_issues AS MATERIALIZED (${candidates}), page AS (${matches})
    SELECT page.*, 0 AS search_overflow FROM page
    UNION ALL SELECT ${columns
      .split(', ')
      .map(() => 'NULL')
      .join(
        ', ',
      )}, 1 AS search_overflow WHERE (SELECT count(*) FROM candidate_issues) > ${SEARCH_SCAN_LIMITS[options.tier]} ORDER BY created_at DESC, id DESC`;
  return { sql, values };
}
