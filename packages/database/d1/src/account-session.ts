import type { D1Database } from '@cloudflare/workers-types';
import { assertId, assertInstant } from '@hyperbug/domain';
import {
  validateAccountSessionCreate,
  type AccountSessionStore,
  type Assurance,
  type AuthMethod,
} from '@hyperbug/application';
import { authMethods } from '@hyperbug/domain';

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
          "INSERT INTO authorization_sessions (id, principal_id, identity_id, credential_revision, digest, created_at, idle_expires_at, absolute_expires_at, auth_method, authenticated_at, assurance) SELECT ?, p.id, i.id, ?, ?, ?, ?, ?, ?, ?, ? FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.id = ? AND p.id = ? AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active' AND c.revision = ?",
        )
        .bind(
          input.id,
          input.credentialRevision,
          input.digest,
          input.nowMs,
          input.idleExpiresAtMs,
          input.absoluteExpiresAtMs,
          input.authMethod,
          input.authenticatedAtMs,
          input.assurance,
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
          "SELECT p.kind AS principal_kind, s.idle_expires_at, s.principal_id, s.identity_id, s.digest, s.absolute_expires_at, s.auth_method, s.authenticated_at, s.assurance FROM authorization_sessions s JOIN identities i ON i.id = s.identity_id AND i.principal_id = s.principal_id JOIN principals p ON p.id = s.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE s.id = ? AND s.revoked_at IS NULL AND s.idle_expires_at > ? AND s.absolute_expires_at > ? AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active' AND c.revision = s.credential_revision LIMIT 1",
        )
        .bind(id, nowMs, nowMs)
        .first<{
          principal_kind: string;
          idle_expires_at: number;
          principal_id: string;
          identity_id: string;
          digest: string;
          absolute_expires_at: number;
          auth_method: string;
          authenticated_at: number;
          assurance: number;
        }>();
      if (!row) return null;
      if (
        (row.principal_kind !== 'user' && row.principal_kind !== 'staff') ||
        !Number.isSafeInteger(Number(row.idle_expires_at)) ||
        Number(row.idle_expires_at) <= nowMs ||
        Number(row.idle_expires_at) > Number(row.absolute_expires_at) ||
        typeof row.identity_id !== 'string' ||
        !/^[0-9a-f-]{36}$/.test(row.identity_id) ||
        typeof row.digest !== 'string' ||
        row.digest.length > 1024 ||
        !Number.isSafeInteger(row.absolute_expires_at) ||
        !authMethods.includes(row.auth_method as AuthMethod) ||
        !Number.isSafeInteger(row.authenticated_at) ||
        (row.assurance !== 1 && row.assurance !== 2)
      )
        throw new Error('Invalid authorization session record');
      return {
        principalId: row.principal_id,
        principalKind: row.principal_kind as 'user' | 'staff',
        idleExpiresAtMs: Number(row.idle_expires_at),
        identityId: row.identity_id,
        digest: row.digest,
        absoluteExpiresAtMs: row.absolute_expires_at,
        authMethod: row.auth_method as AuthMethod,
        authenticatedAtMs: row.authenticated_at,
        assurance: row.assurance as Assurance,
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
    async revokeAllForPrincipal(principalId, nowMs) {
      assertId(principalId);
      assertInstant(nowMs);
      const result = await db
        .prepare(
          'UPDATE authorization_sessions SET revoked_at = max(created_at, ?) WHERE principal_id = ? AND revoked_at IS NULL',
        )
        .bind(nowMs, principalId)
        .run();
      if (!Number.isSafeInteger(result.meta.changes) || result.meta.changes < 0)
        throw new Error('Invalid session revocation result');
      return result.meta.changes;
    },
    async listActiveByPrincipal(principalId, nowMs) {
      assertId(principalId);
      assertInstant(nowMs);
      const rows = await db
        .withSession('first-primary')
        .prepare(
          "SELECT s.id, s.created_at, s.idle_expires_at, s.absolute_expires_at FROM authorization_sessions s JOIN principals p ON p.id = s.principal_id AND p.status = 'active' WHERE s.principal_id = ? AND s.revoked_at IS NULL AND s.idle_expires_at > ? AND s.absolute_expires_at > ? ORDER BY s.created_at DESC, s.id DESC LIMIT 50",
        )
        .bind(principalId, nowMs, nowMs)
        .all<{
          id: string;
          created_at: number;
          idle_expires_at: number;
          absolute_expires_at: number;
        }>();
      return rows.results.map((row) => {
        if (
          !/^[0-9a-f-]{36}$/.test(row.id) ||
          !Number.isSafeInteger(row.created_at) ||
          !Number.isSafeInteger(row.idle_expires_at) ||
          !Number.isSafeInteger(row.absolute_expires_at)
        )
          throw new Error('Invalid authorization session listing');
        return {
          id: row.id,
          createdAtMs: row.created_at,
          idleExpiresAtMs: row.idle_expires_at,
          absoluteExpiresAtMs: row.absolute_expires_at,
        };
      });
    },
    async revokeOwned(id, principalId, nowMs) {
      assertId(id);
      assertId(principalId);
      assertInstant(nowMs);
      const result = await db
        .prepare(
          'UPDATE authorization_sessions SET revoked_at = max(created_at, ?) WHERE id = ? AND principal_id = ? AND revoked_at IS NULL',
        )
        .bind(nowMs, id, principalId)
        .run();
      return changed(result.meta.changes);
    },
  };
}
