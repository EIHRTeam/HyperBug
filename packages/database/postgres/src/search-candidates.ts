/** Each recursive step is one ordered index probe, never a global candidate-table scan. */
export function postgresSearchCandidates(
  project: string,
  principal: string,
  maximum: number,
) {
  return `candidate_issues AS MATERIALIZED (
    (SELECT id, created_at, 1 AS n FROM issues WHERE project_id = ${project}::uuid
      AND EXISTS (SELECT 1 FROM projects p WHERE p.id = ${project}::uuid AND (p.visibility = 'public' OR EXISTS (
        SELECT 1 FROM project_roles r JOIN principals a ON a.id = r.principal_id WHERE r.project_id = p.id AND r.principal_id = ${principal}::uuid AND a.kind = 'staff' AND a.status = 'active')))
      ORDER BY created_at DESC, id DESC LIMIT 1)
    UNION ALL SELECT next.id, next.created_at, previous.n + 1 FROM candidate_issues previous
      CROSS JOIN LATERAL (SELECT id, created_at FROM issues WHERE project_id = ${project}::uuid
        AND (created_at, id) < (previous.created_at, previous.id) ORDER BY created_at DESC, id DESC LIMIT 1) next
      WHERE previous.n <= ${maximum}
  )`;
}
