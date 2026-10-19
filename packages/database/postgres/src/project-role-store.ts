import { postgresAuditedMutation } from './audit-write.ts';
import type { Pool } from 'pg';
import { assertId } from '@hyperbug/domain';
import {
  isProjectStaffRole,
  validateProjectRoleGrant,
  type ProjectRoleStore,
  type ProjectStaffRole,
} from '@hyperbug/application';

function validRole(value: unknown): ProjectStaffRole {
  if (!isProjectStaffRole(value))
    throw new Error('Invalid project role record');
  return value;
}

/**
 * The composite project+principal key makes the upsert idempotent, and the
 * stored revision separates outcomes: this port always inserts at revision 1
 * and only ever increments it on conflict, so a fresh grant returns 1 and a
 * replacement returns anything higher.
 */
export function createPostgresProjectRoleStore(pool: Pool): ProjectRoleStore {
  return {
    async grant(input, audit) {
      validateProjectRoleGrant(input);
      return postgresAuditedMutation(pool, audit, async (db) => {
        const result = await db.query<{ revision: number }>(
          "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at, revision) VALUES ($1, $2, 'staff', $3, $4, 1) ON CONFLICT (project_id, principal_id) DO UPDATE SET role = excluded.role, granted_at = excluded.granted_at, revision = project_roles.revision + 1 RETURNING revision",
          [input.projectId, input.principalId, input.role, input.nowMs],
        );
        const revision = result.rows[0]?.revision ?? Number.NaN;
        if (
          !Number.isSafeInteger(revision) ||
          revision < 1 ||
          revision > 2147483647
        )
          throw new Error('Invalid project role grant');
        return {
          value: revision === 1 ? ('granted' as const) : ('replaced' as const),
          changed: true,
        };
      });
    },
    async revoke(projectId, principalId, audit) {
      assertId(projectId);
      assertId(principalId);
      return postgresAuditedMutation(pool, audit, async (db) => {
        const result = await db.query(
          'DELETE FROM project_roles WHERE project_id = $1 AND principal_id = $2',
          [projectId, principalId],
        );
        if (result.rowCount !== null && result.rowCount > 1)
          throw new Error('Invalid project role deletion');
        return { value: result.rowCount === 1, changed: result.rowCount === 1 };
      });
    },
    async loadRole(projectId, principalId) {
      assertId(projectId);
      assertId(principalId);
      const result = await pool.query<{ role: string }>(
        'SELECT role FROM project_roles WHERE project_id = $1 AND principal_id = $2 LIMIT 1',
        [projectId, principalId],
      );
      const row = result.rows[0];
      return row === undefined ? null : { role: validRole(row.role) };
    },
    async listAdministratorProjectIds(principalId) {
      assertId(principalId);
      const result = await pool.query<{ project_id: string }>(
        "SELECT r.project_id FROM project_roles r JOIN projects p ON p.id = r.project_id WHERE r.principal_id = $1 AND r.role = 'administrator' AND p.status = 'active' ORDER BY r.project_id LIMIT 5",
        [principalId],
      );
      return result.rows.map((row) => row.project_id);
    },
  };
}
