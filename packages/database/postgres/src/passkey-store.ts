import type { Pool } from 'pg';
import {
  validatePasskeyCredentialInsert,
  type PasskeyCredentialRecord,
  type PasskeyStore,
  type WebauthnChallengeStore,
} from '@hyperbug/application';

function parseTransports(value: unknown): readonly string[] | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (transport): transport is string => typeof transport === 'string',
    );
  } catch {
    return null;
  }
}

function storedTransports(transports: readonly string[] | null): string | null {
  return transports === null || transports.length === 0
    ? null
    : JSON.stringify([...transports]);
}

export function createPostgresPasskeyStores(
  pool: Pool,
): PasskeyStore & WebauthnChallengeStore {
  return {
    async insertCredential(input) {
      validatePasskeyCredentialInsert(input);
      const result = await pool.query(
        'INSERT INTO passkey_credentials (id, identity_id, public_key, counter, transports, device_type, backed_up, aaguid, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)',
        [
          input.id,
          input.identityId,
          input.publicKey,
          input.counter,
          storedTransports(input.transports),
          input.deviceType,
          input.backedUp ? 1 : 0,
          input.aaguid,
          input.nowMs,
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Invalid passkey insert result');
      return true;
    },
    async loadCredential(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(id))
        return null;
      const result = await pool.query<{
        id: string;
        identity_id: string;
        public_key: string;
        counter: number;
        transports: unknown;
        device_type: string;
        backed_up: number;
      }>(
        "SELECT c.id, c.identity_id, c.public_key, c.counter, c.transports, c.device_type, c.backed_up FROM passkey_credentials c JOIN identities i ON i.id = c.identity_id JOIN principals p ON p.id = i.principal_id WHERE c.id = $1 AND p.status = 'active' LIMIT 1",
        [id],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (
        !Number.isSafeInteger(row.counter) ||
        row.counter < 0 ||
        (row.device_type !== 'singleDevice' &&
          row.device_type !== 'multiDevice')
      )
        throw new Error('Invalid passkey record');
      return Object.freeze({
        id: row.id,
        identityId: row.identity_id,
        publicKey: row.public_key,
        counter: row.counter,
        transports: parseTransports(row.transports),
        deviceType: row.device_type,
        backedUp: Number(row.backed_up) === 1,
      });
    },
    async updateCounter(id, counter, nowMs) {
      if (
        typeof id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,1024}$/.test(id) ||
        !Number.isSafeInteger(counter) ||
        counter < 0 ||
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > 8640000000000000
      )
        throw new Error('Invalid passkey counter update');
      const result = await pool.query(
        'UPDATE passkey_credentials SET counter = $2, last_used_at = $3 WHERE id = $1 AND counter <= $2',
        [id, counter, nowMs],
      );
      if (result.rowCount !== null && result.rowCount > 1)
        throw new Error('Invalid passkey counter result');
      return result.rowCount === 1;
    },
    async listCredentialIds(identityId) {
      if (!/^[0-9a-f-]{36}$/.test(identityId))
        throw new Error('Invalid passkey identity');
      const result = await pool.query<{ id: string }>(
        'SELECT id FROM passkey_credentials WHERE identity_id = $1::uuid',
        [identityId],
      );
      return result.rows.map((row) => row.id);
    },
    async create(input) {
      if (
        (input.kind !== 'registration' && input.kind !== 'authentication') ||
        typeof input.challenge !== 'string' ||
        input.challenge.length < 16 ||
        input.challenge.length > 256 ||
        !/^[A-Za-z0-9_-]+$/.test(input.challenge) ||
        (input.identityId !== null && !/^[0-9a-f-]{36}$/.test(input.identityId))
      )
        throw new Error('Invalid WebAuthn challenge');
      const result = await pool.query(
        'INSERT INTO webauthn_challenges (id, kind, challenge, identity_id, created_at, expires_at) VALUES (gen_random_uuid(), $1, $2, $3::uuid, $4, $5)',
        [
          input.kind,
          input.challenge,
          input.identityId,
          input.nowMs,
          input.expiresAtMs,
        ],
      );
      if (result.rowCount !== 1)
        throw new Error('Invalid WebAuthn challenge insert');
    },
    async consume(kind, challenge, nowMs) {
      if (
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > 8640000000000000 ||
        typeof challenge !== 'string' ||
        challenge.length < 16 ||
        challenge.length > 256
      )
        throw new Error('Invalid WebAuthn challenge consumption');
      const result = await pool.query<{ identity_id: string | null }>(
        'UPDATE webauthn_challenges SET consumed_at = $3 WHERE kind = $1 AND challenge = $2 AND consumed_at IS NULL AND expires_at > $3 RETURNING identity_id',
        [kind, challenge, nowMs],
      );
      const row = result.rows[0];
      return row === undefined ? null : { identityId: row.identity_id };
    },
  };
}

export type { PasskeyCredentialRecord };
