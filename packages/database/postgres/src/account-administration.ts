import type { Pool } from 'pg';
import { assertId } from '@hyperbug/domain';
import type {
  AccountAdministrationStore,
  PrincipalAccountFacts,
  ProjectVisibilityFacts,
} from '@hyperbug/application';

interface PrincipalRow {
  kind: string;
  status: string;
  credential_active: boolean;
}

function principalFacts(
  row: PrincipalRow | undefined,
): PrincipalAccountFacts | null {
  if (row === undefined) return null;
  if (row.kind !== 'user' && row.kind !== 'staff')
    throw new Error('Invalid principal kind');
  if (
    row.status !== 'active' &&
    row.status !== 'suspended' &&
    row.status !== 'deleted'
  )
    throw new Error('Invalid principal status');
  return {
    kind: row.kind,
    status: row.status,
    credentialActive: row.credential_active === true,
  };
}

/**
 * Primary-backed principal and project directory plus the two staff
 * account-state transitions. All values are validated before they become
 * authorization facts; a deleted principal never reactivates.
 */
export function createPostgresAccountAdministration(
  pool: Pool,
): AccountAdministrationStore {
  return {
    async loadPrincipal(principalId) {
      assertId(principalId);
      const result = await pool.query<PrincipalRow>(
        "SELECT p.kind, p.status, EXISTS (SELECT 1 FROM identities i JOIN password_credentials c ON c.identity_id = i.id WHERE i.principal_id = p.id AND i.provider = 'local-password') AS credential_active FROM principals p WHERE p.id = $1 LIMIT 1",
        [principalId],
      );
      return principalFacts(result.rows[0]);
    },
    async loadProject(projectId) {
      assertId(projectId);
      const result = await pool.query<{
        visibility: string;
        status: string;
      }>('SELECT visibility, status FROM projects WHERE id = $1 LIMIT 1', [
        projectId,
      ]);
      const row = result.rows[0];
      if (row === undefined) return null;
      if (row.visibility !== 'public' && row.visibility !== 'private')
        throw new Error('Invalid project visibility');
      if (row.status !== 'active' && row.status !== 'archived')
        throw new Error('Invalid project state');
      const facts: ProjectVisibilityFacts = {
        visibility: row.visibility,
        state: row.status,
      };
      return facts;
    },
    async loadInstanceRole(principalId) {
      assertId(principalId);
      const result = await pool.query<{ role: string }>(
        'SELECT role FROM instance_roles WHERE principal_id = $1 LIMIT 1',
        [principalId],
      );
      const role = result.rows[0]?.role;
      if (role === undefined) return null;
      if (role !== 'instance-administrator')
        throw new Error('Invalid instance role record');
      return { principalId, role };
    },
    async suspendPrincipal(principalId) {
      assertId(principalId);
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        // Serialize suspensions before the UPDATE takes its READ COMMITTED
        // snapshot; a COUNT subquery alone would allow cross-row write skew.
        await db.query('SELECT pg_advisory_xact_lock(1212371531, 1)');
        const result = await db.query(
          "UPDATE principals SET status = 'suspended' WHERE id = $1 AND status IN ('active', 'suspended') AND (status = 'suspended' OR NOT EXISTS (SELECT 1 FROM instance_roles r WHERE r.principal_id = principals.id) OR (SELECT count(*) FROM instance_roles r JOIN principals p ON p.id = r.principal_id WHERE p.kind = 'staff' AND p.status = 'active') > 1)",
          [principalId],
        );
        if (result.rowCount !== null && result.rowCount > 1)
          throw new Error('Invalid principal suspension');
        await db.query('COMMIT');
        return result.rowCount === 1;
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    },
    async activatePrincipal(principalId) {
      assertId(principalId);
      const result = await pool.query(
        "UPDATE principals SET status = 'active' WHERE id = $1 AND status IN ('active', 'suspended')",
        [principalId],
      );
      if (result.rowCount !== null && result.rowCount > 1)
        throw new Error('Invalid principal activation');
      return result.rowCount === 1;
    },
  };
}
