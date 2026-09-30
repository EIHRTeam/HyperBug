import type { D1Database } from '@cloudflare/workers-types';
import { assertId } from '@hyperbug/domain';
import {
  validateProjectRoleGrant,
  type ProjectRoleStore,
  type ProjectStaffRole,
} from '@hyperbug/application';

const roles: readonly ProjectStaffRole[] = [
  'triage',
  'maintainer',
  'administrator',
];

function validRole(value: unknown): ProjectStaffRole {
  if (
    typeof value !== 'string' ||
    !(roles as readonly string[]).includes(value)
  )
    throw new Error('Invalid project role record');
  return value as ProjectStaffRole;
}

/**
 * The composite project+principal key makes the upsert idempotent, and the
 * stored revision separates outcomes: this port always inserts at revision 1
 * and only ever increments it on conflict, so a fresh grant returns 1 and a
 * replacement returns anything higher.
 */
export function createD1ProjectRoleStore(db: D1Database): ProjectRoleStore {
  return {
    async grant(input) {
      validateProjectRoleGrant(input);
      const row = await db
        .prepare(
          "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at, revision) VALUES (?, ?, 'staff', ?, ?, 1) ON CONFLICT (project_id, principal_id) DO UPDATE SET role = excluded.role, granted_at = excluded.granted_at, revision = project_roles.revision + 1 RETURNING revision",
        )
        .bind(input.projectId, input.principalId, input.role, input.nowMs)
        .first<{ revision: number }>();
      if (!Number.isSafeInteger(row?.revision) || row!.revision < 1)
        throw new Error('Invalid project role grant');
      return row!.revision === 1 ? 'granted' : 'replaced';
    },
    async revoke(projectId, principalId) {
      assertId(projectId);
      assertId(principalId);
      const result = await db
        .prepare(
          'DELETE FROM project_roles WHERE project_id = ? AND principal_id = ?',
        )
        .bind(projectId, principalId)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid project role deletion');
      return result.meta.changes === 1;
    },
    async loadRole(projectId, principalId) {
      assertId(projectId);
      assertId(principalId);
      const row = await db
        .prepare(
          'SELECT role FROM project_roles WHERE project_id = ? AND principal_id = ? LIMIT 1',
        )
        .bind(projectId, principalId)
        .first<{ role: string }>();
      return row === null ? null : { role: validRole(row.role) };
    },
    async listAdministratorProjectIds(principalId) {
      assertId(principalId);
      const rows = await db
        .prepare(
          "SELECT r.project_id FROM project_roles r JOIN projects p ON p.id = r.project_id WHERE r.principal_id = ? AND r.role = 'administrator' AND p.status = 'active' ORDER BY r.project_id LIMIT 5",
        )
        .bind(principalId)
        .all<{ project_id: string }>();
      return rows.results.map((row) => row.project_id);
    },
  };
}
