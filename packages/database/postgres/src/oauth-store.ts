import type { Pool } from 'pg';
import {
  validateOAuthAccessTokenInsert,
  validateOAuthCodeInsert,
  type OAuthAccessTokenRecord,
  type OAuthAccessTokenStore,
  type OAuthCodeExchange,
  type OAuthCodeStore,
} from '@hyperbug/application';

function changed(count: number | null): boolean {
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

function assertUuid(id: string): void {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      id,
    )
  )
    throw new Error('Invalid OAuth identifier');
}

function assertInstant(nowMs: number): void {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0 || nowMs > 8640000000000000)
    throw new Error('Invalid OAuth instant');
}

/**
 * The conditional UPDATE consumes the code and returns its row in one
 * statement, so a wrong verifier, wrong client or replay can only observe
 * an already-consumed code.
 */
export function createPostgresOAuthStores(
  pool: Pool,
): OAuthCodeStore & OAuthAccessTokenStore {
  return {
    async insert(input) {
      validateOAuthCodeInsert(input);
      const result = await pool.query(
        'INSERT INTO oauth_codes (id, digest, client_id, redirect_uri, scope, code_challenge, principal_id, identity_id, created_at, expires_at) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10)',
        [
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
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Invalid authorization code insert');
    },
    async consume(id, nowMs) {
      assertUuid(id);
      assertInstant(nowMs);
      const result = await pool.query<{
        principal_id: string;
        identity_id: string;
        client_id: string;
        redirect_uri: string;
        scope: string;
        code_challenge: string;
      }>(
        'UPDATE oauth_codes SET consumed_at = $2 WHERE id = $1::uuid AND consumed_at IS NULL AND expires_at > $2 RETURNING principal_id, identity_id, client_id, redirect_uri, scope, code_challenge',
        [id, nowMs],
      );
      const row = result.rows[0];
      return row === undefined ? null : exchanged(row);
    },
    async insertAccessToken(input) {
      validateOAuthAccessTokenInsert(input);
      const result = await pool.query(
        'INSERT INTO oauth_access_tokens (id, digest, principal_id, identity_id, client_id, scope, created_at, expires_at) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8)',
        [
          input.id,
          input.digest,
          input.principalId,
          input.identityId,
          input.clientId,
          input.scope,
          input.nowMs,
          input.expiresAtMs,
        ],
      );
      if (result.rowCount !== 1) throw new Error('Invalid access token insert');
    },
    async loadActive(id, nowMs) {
      assertUuid(id);
      assertInstant(nowMs);
      const result = await pool.query<{
        principal_id: string;
        identity_id: string;
        client_id: string;
        scope: string;
        digest: unknown;
      }>(
        'SELECT principal_id, identity_id, client_id, scope, digest FROM oauth_access_tokens WHERE id = $1::uuid AND revoked_at IS NULL AND expires_at > $2 LIMIT 1',
        [id, nowMs],
      );
      const row = result.rows[0];
      if (!row) return null;
      const digest = JSON.stringify(row.digest);
      if (
        !/^[0-9a-f-]{36}$/.test(row.principal_id) ||
        !/^[0-9a-f-]{36}$/.test(row.identity_id) ||
        typeof row.client_id !== 'string' ||
        row.client_id.length < 1 ||
        row.client_id.length > 128 ||
        typeof row.scope !== 'string' ||
        row.scope.length < 1 ||
        row.scope.length > 256 ||
        digest.length < 1 ||
        digest.length > 1024
      )
        throw new Error('Invalid access token record');
      const record: OAuthAccessTokenRecord = Object.freeze({
        principalId: row.principal_id,
        identityId: row.identity_id,
        clientId: row.client_id,
        scope: row.scope,
        digest,
      });
      return record;
    },
    async revoke(id, nowMs) {
      assertUuid(id);
      assertInstant(nowMs);
      const result = await pool.query(
        'UPDATE oauth_access_tokens SET revoked_at = GREATEST(created_at, $2) WHERE id = $1::uuid AND revoked_at IS NULL',
        [id, nowMs],
      );
      return changed(result.rowCount);
    },
    async loadPrincipalKind(principalId) {
      assertUuid(principalId);
      const result = await pool.query<{ kind: string }>(
        "SELECT kind FROM principals WHERE id = $1::uuid AND status = 'active' LIMIT 1",
        [principalId],
      );
      const row = result.rows[0];
      if (row === undefined) return null;
      if (row.kind !== 'user' && row.kind !== 'staff')
        throw new Error('Invalid principal kind');
      return row.kind;
    },
  };
}
