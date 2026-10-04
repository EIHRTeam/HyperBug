import type { UploadAssociation, UploadScope } from '@hyperbug/application';
/** SQL transaction guard mirroring the existing content ownership/moderation boundary. */
export function uploadAssociationGuard(
  scope: UploadScope,
  association: UploadAssociation,
) {
  const moderator =
    "(p.kind = 'staff' AND EXISTS (SELECT 1 FROM project_roles mr WHERE mr.project_id = x.id AND mr.principal_id = p.id AND mr.role IN ('maintainer','administrator')))";
  const values: (string | number)[] = [scope.principalId, scope.projectId];
  let target = '1 = 1';
  if (association.kind === 'issue' || association.kind === 'comment-draft') {
    values.push(association.issueId);
    target = `EXISTS (SELECT 1 FROM issues target WHERE target.id = ? AND target.project_id = x.id AND target.deleted_at IS NULL AND (${association.kind === 'issue' ? "(target.author_id = p.id AND target.moderation = 'visible')" : "target.moderation = 'visible'"} OR ${moderator}))`;
  } else if (association.kind === 'comment') {
    values.push(association.commentId);
    target = `EXISTS (SELECT 1 FROM comments c JOIN issues parent ON parent.id = c.issue_id AND parent.project_id = c.project_id WHERE c.id = ? AND c.project_id = x.id AND c.deleted_at IS NULL AND parent.deleted_at IS NULL AND ((c.author_id = p.id AND c.moderation = 'visible' AND parent.moderation = 'visible') OR ${moderator}))`;
  }
  const guard = {
    sql: `EXISTS (SELECT 1 FROM projects x JOIN principals p ON p.id = ? WHERE x.id = ? AND x.status = 'active' AND p.status = 'active' AND ((p.kind = 'user' AND x.visibility = 'public') OR (p.kind = 'staff' AND EXISTS (SELECT 1 FROM project_roles r WHERE r.project_id = x.id AND r.principal_id = p.id))) AND ${target})`,
    values,
  };
  let parameter = 0;
  return { sql: guard.sql.replace(/\?/g, () => `$${++parameter}`), values };
}
