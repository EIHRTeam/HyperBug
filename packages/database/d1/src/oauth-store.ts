import type { D1Database } from '@cloudflare/workers-types';
import { assertId, assertInstant } from '@hyperbug/domain';
import {
  validateOAuthAccessTokenInsert,
  validateOAuthCodeInsert,
  type OAuthAccessTokenStore,
  type OAuthCodeExchange,
  type OAuthCodeStore,
} from '@hyperbug/application';

function changed(count: number): boolean {
  if (count !== 0 && count !== 1)
    throw new Error('Invalid OAuth token mutation');
  return count === 1;
}

function exchanged(row: {
  principal_id: string;
  identity_id: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  code_challenge: string;
}): OAuthCodeExchange {
  if (
    !/^[0-9a-f-]{36}$/.test(row.principal_id) ||
    !/^[0-9a-f-]{36}$/.test(row.identity_id) ||
    typeof row.client_id !== 'string' ||
    row.client_id.length < 1 ||
    row.client_id.length > 128 ||
    typeof row.redirect_uri !== 'string' ||
    row.redirect_uri.length < 1 ||
    row.redirect_uri.length > 2048 ||
    typeof row.scope !== 'string' ||
    row.scope.length < 1 ||
    row.scope.length > 256 ||
    typeof row.code_challenge !== 'string' ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(row.code_challenge)
  )
    throw new Error('Invalid authorization code record');
  return Object.freeze({
    principalId: row.principal_id,
    identityId: row.identity_id,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    codeChallenge: row.code_challenge,
  });
}

/**
 * The conditional UPDATE consumes the code and returns its row in one
 * statement, so a wrong verifier, wrong client or replay can only observe
 * an already-consumed code.
 */
export function createD1OAuthStores(
  db: D1Database,
): OAuthCodeStore & OAuthAccessTokenStore {
  return {
    async insert(input) {
      validateOAuthCodeInsert(input);
      const result = await db
        .prepare(
          'INSERT INTO oauth_codes (id, digest, client_id, redirect_uri, scope, code_challenge, principal_id, identity_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          input.id,
          input.digest,
          input.clientId,
          input.redirectUri,
          input.scope,
          input.codeChallenge,
          input.principalId,
          input.identityId,
          input.nowMs,
          input.expiresAtMs,
        )
        .run();
      if (result.meta.changes !== 1)
        throw new Error('Invalid authorization code insert');
    },
    async consume(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const row = await db
        .prepare(
          'UPDATE oauth_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL AND expires_at > ? RETURNING principal_id, identity_id, client_id, redirect_uri, scope, code_challenge',
        )
        .bind(nowMs, id, nowMs)
        .first<{
          principal_id: string;
          identity_id: string;
          client_id: string;
          redirect_uri: string;
          scope: string;
          code_challenge: string;
        }>();
      return row === null ? null : exchanged(row);
    },
    async insertAccessToken(input) {
      validateOAuthAccessTokenInsert(input);
      const result = await db
        .prepare(
          'INSERT INTO oauth_access_tokens (id, digest, principal_id, identity_id, client_id, scope, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          input.id,
          input.digest,
          input.principalId,
          input.identityId,
          input.clientId,
          input.scope,
          input.nowMs,
          input.expiresAtMs,
        )
        .run();
      if (result.meta.changes !== 1)
        throw new Error('Invalid access token insert');
    },
    async loadActive(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const row = await db
        .prepare(
          'SELECT principal_id, identity_id, client_id, scope, digest FROM oauth_access_tokens WHERE id = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1',
        )
        .bind(id, nowMs)
        .first<{
          principal_id: string;
          identity_id: string;
          client_id: string;
          scope: string;
          digest: string;
        }>();
      if (!row) return null;
      if (
        !/^[0-9a-f-]{36}$/.test(row.principal_id) ||
        !/^[0-9a-f-]{36}$/.test(row.identity_id) ||
        typeof row.client_id !== 'string' ||
        row.client_id.length < 1 ||
        row.client_id.length > 128 ||
        typeof row.scope !== 'string' ||
        row.scope.length < 1 ||
        row.scope.length > 256 ||
        typeof row.digest !== 'string' ||
        row.digest.length < 1 ||
        row.digest.length > 1024
      )
        throw new Error('Invalid access token record');
      return Object.freeze({
        principalId: row.principal_id,
        identityId: row.identity_id,
        clientId: row.client_id,
        scope: row.scope,
        digest: row.digest,
      });
    },
    async revoke(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await db
        .prepare(
          'UPDATE oauth_access_tokens SET revoked_at = max(created_at, ?) WHERE id = ? AND revoked_at IS NULL',
        )
        .bind(nowMs, id)
        .run();
      return changed(result.meta.changes);
    },
    async loadPrincipalKind(principalId) {
      assertId(principalId);
      const row = await db
        .prepare(
          "SELECT kind FROM principals WHERE id = ? AND status = 'active' LIMIT 1",
        )
        .bind(principalId)
        .first<{ kind: string }>();
      if (row === null) return null;
      if (row.kind !== 'user' && row.kind !== 'staff')
        throw new Error('Invalid principal kind');
      return row.kind;
    },
  };
}
