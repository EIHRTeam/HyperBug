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
  passkey_used_at: string | null;
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
  const passkeyUsedAtMs =
    row.passkey_used_at === null ? null : Number(row.passkey_used_at);
  if (
    passkeyUsedAtMs !== null &&
    (!Number.isSafeInteger(passkeyUsedAtMs) || passkeyUsedAtMs < 0)
  )
    throw new Error('Invalid passkey ceremony record');
  return {
    kind: row.kind,
    status: row.status,
    credentialActive: row.credential_active === true,
    passkeyUsedAtMs,
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
        "SELECT p.kind, p.status, EXISTS (SELECT 1 FROM identities i JOIN password_credentials c ON c.identity_id = i.id WHERE i.principal_id = p.id AND i.provider = 'local-password') AS credential_active, (SELECT max(k.last_used_at) FROM identities i2 JOIN passkey_credentials k ON k.identity_id = i2.id WHERE i2.principal_id = p.id) AS passkey_used_at FROM principals p WHERE p.id = $1 LIMIT 1",
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
    async tokenIssuedAtMs(principalId) {
      assertId(principalId);
      const result = await pool.query<{ issued_at: string | null }>(
        'SELECT max(created_at) AS issued_at FROM oauth_access_tokens WHERE principal_id = $1 AND revoked_at IS NULL',
        [principalId],
      );
      const issuedAtMs = Number(result.rows[0]?.issued_at);
      if (
        result.rows[0]?.issued_at !== null &&
        (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0)
      )
        throw new Error('Invalid token issuance record');
      return result.rows[0]?.issued_at === null ? null : issuedAtMs;
    },
    async suspendPrincipal(principalId) {
      assertId(principalId);
      const result = await pool.query(
        "UPDATE principals SET status = 'suspended' WHERE id = $1 AND status IN ('active', 'suspended')",
        [principalId],
      );
      if (result.rowCount !== null && result.rowCount > 1)
        throw new Error('Invalid principal suspension');
      return result.rowCount === 1;
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
