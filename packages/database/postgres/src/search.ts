import {
  normalizeSearchText,
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
              const literal = bind(normalizeSearchText(leaf.value));
              const textQuery = `${leaf.phrase ? 'phraseto_tsquery' : 'plainto_tsquery'}('simple', ${literal})`;
              const scope = bind(`p${query.projectId.replaceAll('-', '')}`);
              expression = `i.id IN (SELECT d.issue_id FROM search_documents d WHERE d.project_id = ${bind(query.projectId)}::uuid AND d.active = 1
        AND d.search_vector @@ (plainto_tsquery('simple', ${scope}) && plainto_tsquery('simple', ${literal}))
        AND (d.title_vector @@ ${textQuery} OR d.body_vector @@ ${textQuery}))`;
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
  const sql = `SELECT * FROM (
    SELECT ${columns
      .split(', ')
      .map((c) => `i.${c}`)
      .join(', ')} FROM issues i
    WHERE (${branches}) AND i.project_id = ${project}::uuid AND i.deleted_at IS NULL AND i.moderation = 'visible'
    AND EXISTS (SELECT 1 FROM projects p WHERE p.id = i.project_id AND (p.visibility = 'public' OR EXISTS (
      SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id
      WHERE r.project_id = p.id AND r.principal_id = ${principal}::uuid AND a.kind = 'staff' AND a.status = 'active')))
    AND EXISTS (SELECT 1 FROM search_documents d WHERE d.project_id = i.project_id AND d.issue_id = i.id AND d.active = 1 AND d.revision = i.revision AND d.projection_version = i.body_text_version)
    ORDER BY i.created_at DESC, i.id DESC LIMIT ${window}
  ) matches ${boundary} ORDER BY created_at DESC, id DESC LIMIT ${limit}`;
  return { sql, values };
}
