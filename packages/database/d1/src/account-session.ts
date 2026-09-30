import type { D1Database } from '@cloudflare/workers-types';
import { assertId, assertInstant } from '@hyperbug/domain';
import {
  validateAccountSessionCreate,
  type AccountSessionStore,
} from '@hyperbug/application';

function changed(count: number): boolean {
  if (count !== 0 && count !== 1)
    throw new Error('Invalid authorization session mutation');
  return count === 1;
}

export function createD1AccountSessionStore(
  db: D1Database,
): AccountSessionStore {
  return {
    async createIfCurrent(input) {
      validateAccountSessionCreate(input);
      const result = await db
        .prepare(
          "INSERT INTO authorization_sessions (id, principal_id, identity_id, credential_revision, digest, created_at, idle_expires_at, absolute_expires_at) SELECT ?, p.id, i.id, ?, ?, ?, ?, ? FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.id = ? AND p.id = ? AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active' AND c.revision = ?",
        )
        .bind(
          input.id,
          input.credentialRevision,
          input.digest,
          input.nowMs,
          input.idleExpiresAtMs,
          input.absoluteExpiresAtMs,
          input.identityId,
          input.principalId,
          input.credentialRevision,
        )
        .run();
      return changed(result.meta.changes);
    },
    async load(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const row = await db
        .withSession('first-primary')
        .prepare(
          "SELECT s.principal_id, s.digest, s.absolute_expires_at FROM authorization_sessions s JOIN identities i ON i.id = s.identity_id AND i.principal_id = s.principal_id JOIN principals p ON p.id = s.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE s.id = ? AND s.revoked_at IS NULL AND s.idle_expires_at > ? AND s.absolute_expires_at > ? AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active' AND c.revision = s.credential_revision LIMIT 1",
        )
        .bind(id, nowMs, nowMs)
        .first<{
          principal_id: string;
          digest: string;
          absolute_expires_at: number;
        }>();
      if (!row) return null;
      if (
        typeof row.digest !== 'string' ||
        row.digest.length > 1024 ||
        !Number.isSafeInteger(row.absolute_expires_at)
      )
        throw new Error('Invalid authorization session record');
      return {
        principalId: row.principal_id,
        digest: row.digest,
        absoluteExpiresAtMs: row.absolute_expires_at,
      };
    },
    async touch(input) {
      assertId(input.id);
      assertInstant(input.nowMs);
      assertInstant(input.idleExpiresAtMs);
      if (input.idleExpiresAtMs <= input.nowMs)
        throw new Error('Invalid authorization session idle expiry');
      const result = await db
        .prepare(
          "UPDATE authorization_sessions SET idle_expires_at = max(idle_expires_at, min(absolute_expires_at, ?)) WHERE id = ? AND digest = ? AND revoked_at IS NULL AND idle_expires_at > ? AND absolute_expires_at > ? AND EXISTS (SELECT 1 FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.id = authorization_sessions.identity_id AND p.id = authorization_sessions.principal_id AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active' AND c.revision = authorization_sessions.credential_revision)",
        )
        .bind(
          input.idleExpiresAtMs,
          input.id,
          input.digest,
          input.nowMs,
          input.nowMs,
        )
        .run();
      return changed(result.meta.changes);
    },
    async revoke(id, digest, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await db
        .prepare(
          'UPDATE authorization_sessions SET revoked_at = max(created_at, ?) WHERE id = ? AND digest = ? AND revoked_at IS NULL',
        )
        .bind(nowMs, id, digest)
        .run();
      return changed(result.meta.changes);
    },
  };
}
