import type { D1Database } from '@cloudflare/workers-types';
import {
  validatePasskeyCredentialInsert,
  type PasskeyCredentialRecord,
  type PasskeyStore,
  type WebauthnChallengeStore,
} from '@hyperbug/application';

function parseTransports(value: string | null): readonly string[] | null {
  if (value === null) return null;
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

export function createD1PasskeyStores(
  db: D1Database,
): PasskeyStore & WebauthnChallengeStore {
  return {
    async insertCredential(input) {
      validatePasskeyCredentialInsert(input);
      const result = await db
        .prepare(
          'INSERT INTO passkey_credentials (id, identity_id, public_key, counter, transports, device_type, backed_up, aaguid, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          input.id,
          input.identityId,
          input.publicKey,
          input.counter,
          storedTransports(input.transports),
          input.deviceType,
          input.backedUp ? 1 : 0,
          input.aaguid,
          input.nowMs,
        )
        .run();
      if (result.meta.changes !== 1)
        throw new Error('Invalid passkey insert result');
      return true;
    },
    async loadCredential(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(id))
        return null;
      const row = await db
        .prepare(
          "SELECT c.id, c.identity_id, c.public_key, c.counter, c.transports, c.device_type, c.backed_up FROM passkey_credentials c JOIN identities i ON i.id = c.identity_id JOIN principals p ON p.id = i.principal_id WHERE c.id = ? AND p.status = 'active' LIMIT 1",
        )
        .bind(id)
        .first<{
          id: string;
          identity_id: string;
          public_key: string;
          counter: number;
          transports: string | null;
          device_type: string;
          backed_up: number;
        }>();
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
        backedUp: row.backed_up === 1,
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
      const result = await db
        .prepare(
          'UPDATE passkey_credentials SET counter = ?, last_used_at = ? WHERE id = ? AND counter <= ?',
        )
        .bind(counter, nowMs, id, counter)
        .run();
      if (result.meta.changes !== 0 && result.meta.changes !== 1)
        throw new Error('Invalid passkey counter result');
      return result.meta.changes === 1;
    },
    async listCredentialIds(identityId) {
      if (!/^[0-9a-f-]{36}$/.test(identityId))
        throw new Error('Invalid passkey identity');
      const result = await db
        .prepare('SELECT id FROM passkey_credentials WHERE identity_id = ?')
        .bind(identityId)
        .all<{ id: string }>();
      if (!result.success) throw new Error('Passkey list failed');
      return (result.results ?? []).map((row) => row.id);
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
      const result = await db
        .prepare(
          'INSERT INTO webauthn_challenges (id, kind, challenge, identity_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          input.kind,
          input.challenge,
          input.identityId,
          input.nowMs,
          input.expiresAtMs,
        )
        .run();
      if (result.meta.changes !== 1)
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
      const row = await db
        .prepare(
          'UPDATE webauthn_challenges SET consumed_at = ? WHERE kind = ? AND challenge = ? AND consumed_at IS NULL AND expires_at > ? RETURNING identity_id',
        )
        .bind(nowMs, kind, challenge, nowMs)
        .first<{ identity_id: string | null }>();
      return row === null ? null : { identityId: row.identity_id };
    },
  };
}

export type { PasskeyCredentialRecord };
