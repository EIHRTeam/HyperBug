import type { D1Database } from '@cloudflare/workers-types';
import { assertId } from '@hyperbug/domain';
import type {
  AccountAdministrationStore,
  PrincipalAccountFacts,
  ProjectVisibilityFacts,
} from '@hyperbug/application';

interface PrincipalRow {
  kind: string;
  status: string;
  credential_active: number | boolean;
  passkey_used_at: number | null;
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
  const passkeyUsedAtMs = row.passkey_used_at;
  if (
    passkeyUsedAtMs !== null &&
    (!Number.isSafeInteger(passkeyUsedAtMs) || passkeyUsedAtMs < 0)
  )
    throw new Error('Invalid passkey ceremony record');
  return {
    kind: row.kind,
    status: row.status,
    credentialActive:
      row.credential_active === true || row.credential_active === 1,
    passkeyUsedAtMs,
  };
}

/**
 * Primary-backed principal and project directory plus the two staff
 * account-state transitions. All values are validated before they become
 * authorization facts; a deleted principal never reactivates.
 */
export function createD1AccountAdministration(
  db: D1Database,
): AccountAdministrationStore {
  return {
    async loadPrincipal(principalId) {
      assertId(principalId);
      const row = await db
        .withSession('first-primary')
        .prepare(
          "SELECT p.kind, p.status, EXISTS (SELECT 1 FROM identities i JOIN password_credentials c ON c.identity_id = i.id WHERE i.principal_id = p.id AND i.provider = 'local-password') AS credential_active, (SELECT max(k.last_used_at) FROM identities i2 JOIN passkey_credentials k ON k.identity_id = i2.id WHERE i2.principal_id = p.id) AS passkey_used_at FROM principals p WHERE p.id = ? LIMIT 1",
        )
        .bind(principalId)
        .first<PrincipalRow>();
      return principalFacts(row ?? undefined);
    },
    async loadProject(projectId) {
      assertId(projectId);
      const row = await db
        .withSession('first-primary')
        .prepare('SELECT visibility, status FROM projects WHERE id = ? LIMIT 1')
        .bind(projectId)
        .first<{ visibility: string; status: string }>();
      if (row === null) return null;
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
      const row = await db
        .prepare(
          'SELECT max(created_at) AS issued_at FROM oauth_access_tokens WHERE principal_id = ? AND revoked_at IS NULL',
        )
        .bind(principalId)
        .first<{ issued_at: number | null }>();
      const issuedAtMs = row?.issued_at ?? null;
      if (
        issuedAtMs !== null &&
        (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0)
      )
        throw new Error('Invalid token issuance record');
      return issuedAtMs;
    },
    async suspendPrincipal(principalId) {
      assertId(principalId);
      const result = await db
        .prepare(
          "UPDATE principals SET status = 'suspended' WHERE id = ? AND status IN ('active', 'suspended')",
        )
        .bind(principalId)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid principal suspension');
      return result.meta.changes === 1;
    },
    async activatePrincipal(principalId) {
      assertId(principalId);
      const result = await db
        .prepare(
          "UPDATE principals SET status = 'active' WHERE id = ? AND status IN ('active', 'suspended')",
        )
        .bind(principalId)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes > 1)
        throw new Error('Invalid principal activation');
      return result.meta.changes === 1;
    },
  };
}
