import type { Pool } from 'pg';
import { assertId, assertInstant } from '@hyperbug/domain';
import {
  validateAccountSessionCreate,
  type AccountSessionStore,
} from '@hyperbug/application';

function changed(count: number | null): boolean {
  if (count !== 0 && count !== 1)
    throw new Error('Invalid authorization session mutation');
  return count === 1;
}

export function createPostgresAccountSessionStore(
  pool: Pool,
): AccountSessionStore {
  return {
    async createIfCurrent(input) {
      validateAccountSessionCreate(input);
      const result = await pool.query(
        "INSERT INTO authorization_sessions (id, principal_id, identity_id, credential_revision, digest, created_at, idle_expires_at, absolute_expires_at) SELECT $1, p.id, i.id, $2, $3::jsonb, $4, $5, $6 FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.id = $7 AND p.id = $8 AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind = 'user' AND p.status = 'active' AND c.revision = $2",
        [
          input.id,
          input.credentialRevision,
          input.digest,
          input.nowMs,
          input.idleExpiresAtMs,
          input.absoluteExpiresAtMs,
          input.identityId,
          input.principalId,
        ],
      );
      return changed(result.rowCount);
    },
    async load(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await pool.query<{
        principal_id: string;
        digest: unknown;
        absolute_expires_at: string;
      }>(
        "SELECT s.principal_id, s.digest, s.absolute_expires_at FROM authorization_sessions s JOIN identities i ON i.id = s.identity_id AND i.principal_id = s.principal_id JOIN principals p ON p.id = s.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE s.id = $1 AND s.revoked_at IS NULL AND s.idle_expires_at > $2 AND s.absolute_expires_at > $2 AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind = 'user' AND p.status = 'active' AND c.revision = s.credential_revision LIMIT 1",
        [id, nowMs],
      );
      const row = result.rows[0];
      if (!row) return null;
      const digest = JSON.stringify(row.digest);
      const absoluteExpiresAtMs = Number(row.absolute_expires_at);
      if (
        typeof digest !== 'string' ||
        digest.length > 1024 ||
        !Number.isSafeInteger(absoluteExpiresAtMs) ||
        absoluteExpiresAtMs < 0
      )
        throw new Error('Invalid authorization session record');
      return {
        principalId: row.principal_id,
        digest,
        absoluteExpiresAtMs,
      };
    },
    async touch(input) {
      assertId(input.id);
      assertInstant(input.nowMs);
      assertInstant(input.idleExpiresAtMs);
      if (input.idleExpiresAtMs <= input.nowMs)
        throw new Error('Invalid authorization session idle expiry');
      const result = await pool.query(
        "UPDATE authorization_sessions s SET idle_expires_at = GREATEST(s.idle_expires_at, LEAST(s.absolute_expires_at, $1)) WHERE s.id = $2 AND s.digest = $3::jsonb AND s.revoked_at IS NULL AND s.idle_expires_at > $4 AND s.absolute_expires_at > $4 AND EXISTS (SELECT 1 FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.id = s.identity_id AND p.id = s.principal_id AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind = 'user' AND p.status = 'active' AND c.revision = s.credential_revision)",
        [input.idleExpiresAtMs, input.id, input.digest, input.nowMs],
      );
      return changed(result.rowCount);
    },
    async revoke(id, digest, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await pool.query(
        'UPDATE authorization_sessions SET revoked_at = GREATEST(created_at, $1) WHERE id = $2 AND digest = $3::jsonb AND revoked_at IS NULL',
        [nowMs, id, digest],
      );
      return changed(result.rowCount);
    },
  };
}
