import type { Pool } from 'pg';
import { assertId, assertInstant, authMethods } from '@hyperbug/domain';
import type { Assurance, AuthMethod } from '@hyperbug/domain';
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
  auth_method: string;
  authenticated_at: string;
  assurance: number;
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
    !/^[A-Za-z0-9_-]{43,128}$/.test(row.code_challenge) ||
    !authMethods.includes(row.auth_method as AuthMethod) ||
    !Number.isSafeInteger(Number(row.authenticated_at)) ||
    (row.assurance !== 1 && row.assurance !== 2)
  )
    throw new Error('Invalid authorization code record');
  return Object.freeze({
    principalId: row.principal_id,
    identityId: row.identity_id,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    codeChallenge: row.code_challenge,
    authMethod: row.auth_method as AuthMethod,
    authenticatedAtMs: Number(row.authenticated_at),
    assurance: row.assurance as Assurance,
  });
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
        'INSERT INTO oauth_codes (id, digest, client_id, redirect_uri, scope, code_challenge, principal_id, identity_id, created_at, expires_at, auth_method, authenticated_at, assurance) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)',
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
          input.authMethod,
          input.authenticatedAtMs,
          input.assurance,
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Invalid authorization code insert');
    },
    async consume(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await pool.query<{
        principal_id: string;
        identity_id: string;
        client_id: string;
        redirect_uri: string;
        scope: string;
        code_challenge: string;
        auth_method: string;
        authenticated_at: string;
        assurance: number;
      }>(
        'UPDATE oauth_codes SET consumed_at = $2 WHERE id = $1::uuid AND consumed_at IS NULL AND expires_at > $2 RETURNING principal_id, identity_id, client_id, redirect_uri, scope, code_challenge, auth_method, authenticated_at, assurance',
        [id, nowMs],
      );
      const row = result.rows[0];
      return row === undefined ? null : exchanged(row);
    },
    async insertAccessToken(input) {
      validateOAuthAccessTokenInsert(input);
      const result = await pool.query(
        'INSERT INTO oauth_access_tokens (id, digest, principal_id, identity_id, client_id, scope, created_at, expires_at, auth_method, authenticated_at, assurance) VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [
          input.id,
          input.digest,
          input.principalId,
          input.identityId,
          input.clientId,
          input.scope,
          input.nowMs,
          input.expiresAtMs,
          input.authMethod,
          input.authenticatedAtMs,
          input.assurance,
        ],
      );
      if (result.rowCount !== 1) throw new Error('Invalid access token insert');
    },
    async loadActive(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await pool.query<{
        principal_id: string;
        identity_id: string;
        client_id: string;
        scope: string;
        digest: unknown;
        auth_method: string;
        authenticated_at: string;
        assurance: number;
      }>(
        'SELECT principal_id, identity_id, client_id, scope, digest, auth_method, authenticated_at, assurance FROM oauth_access_tokens WHERE id = $1::uuid AND revoked_at IS NULL AND expires_at > $2 LIMIT 1',
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
        digest.length > 1024 ||
        !authMethods.includes(row.auth_method as AuthMethod) ||
        !Number.isSafeInteger(Number(row.authenticated_at)) ||
        (row.assurance !== 1 && row.assurance !== 2)
      )
        throw new Error('Invalid access token record');
      const record: OAuthAccessTokenRecord = Object.freeze({
        principalId: row.principal_id,
        identityId: row.identity_id,
        clientId: row.client_id,
        scope: row.scope,
        digest,
        authMethod: row.auth_method as AuthMethod,
        authenticatedAtMs: Number(row.authenticated_at),
        assurance: row.assurance as Assurance,
      });
      return record;
    },
    async revoke(id, nowMs) {
      assertId(id);
      assertInstant(nowMs);
      const result = await pool.query(
        'UPDATE oauth_access_tokens SET revoked_at = GREATEST(created_at, $2) WHERE id = $1::uuid AND revoked_at IS NULL',
        [id, nowMs],
      );
      return changed(result.rowCount);
    },
    async loadPrincipalKind(principalId) {
      assertId(principalId);
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
