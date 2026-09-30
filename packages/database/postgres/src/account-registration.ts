import type { Pool } from 'pg';
import {
  validateAccountRegistrationInput,
  type AccountRegistrationStore,
  type AccountPasswordStore,
} from '@hyperbug/application';
import { parseStandardPasswordRecord } from '@hyperbug/security';

/** One transaction keeps principal, identity and verifier inseparable. */
export function createPostgresAccountRegistrationStore(
  pool: Pool,
): AccountRegistrationStore & AccountPasswordStore {
  return {
    async register(input) {
      validateAccountRegistrationInput(input);
      const record = parseStandardPasswordRecord(input.passwordRecord);
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query(
          "INSERT INTO principals (id, kind, display_name, status, created_at, revision) VALUES ($1, 'user', $2, 'active', $3, 1)",
          [input.principalId, input.handle, input.nowMs],
        );
        const identity = await db.query(
          "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES ($1, $2, 'local-password', 'hyperbug', $3, $4) ON CONFLICT (provider, issuer, subject) DO NOTHING RETURNING id",
          [input.identityId, input.principalId, input.handle, input.nowMs],
        );
        if (identity.rowCount === 0) {
          await db.query('ROLLBACK');
          return { status: 'existing' };
        }
        if (identity.rowCount !== 1) throw new Error('Identity insert failed');
        await db.query(
          'INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES ($1, $2, 1, $3, $3)',
          [input.identityId, JSON.stringify(record), input.nowMs],
        );
        await db.query('COMMIT');
        return { status: 'created', principalId: input.principalId };
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    },
    async loadCredential(handle) {
      if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(handle))
        throw new Error('Invalid account handle');
      const result = await pool.query<{
        principal_id: string;
        identity_id: string;
        record: unknown;
        revision: number;
      }>(
        "SELECT p.id AS principal_id, i.id AS identity_id, c.record, c.revision FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.provider = 'local-password' AND i.issuer = 'hyperbug' AND i.subject = $1 AND p.kind IN ('user', 'staff') AND p.status = 'active' LIMIT 1",
        [handle],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (!Number.isSafeInteger(row.revision) || row.revision < 1)
        throw new Error('Invalid credential revision');
      return {
        principalId: row.principal_id,
        identityId: row.identity_id,
        record: parseStandardPasswordRecord(row.record),
        revision: row.revision,
      };
    },
    async loadCredentialByIdentity(identityId) {
      if (!/^[0-9a-f-]{36}$/.test(identityId))
        throw new Error('Invalid account identity');
      const result = await pool.query<{
        principal_id: string;
        identity_id: string;
        record: unknown;
        revision: number;
      }>(
        "SELECT p.id AS principal_id, i.id AS identity_id, c.record, c.revision FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.id = $1::uuid AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active' LIMIT 1",
        [identityId],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (!Number.isSafeInteger(row.revision) || row.revision < 1)
        throw new Error('Invalid credential revision');
      return {
        principalId: row.principal_id,
        identityId: row.identity_id,
        record: parseStandardPasswordRecord(row.record),
        revision: row.revision,
      };
    },
    async replaceCredential(input) {
      if (
        !Number.isSafeInteger(input.expectedRevision) ||
        input.expectedRevision < 1 ||
        input.expectedRevision >= 2147483647 ||
        !Number.isSafeInteger(input.nowMs) ||
        input.nowMs < 0 ||
        input.nowMs > 8640000000000000
      )
        throw new Error('Invalid credential replacement');
      const record = parseStandardPasswordRecord(input.record);
      const result = await pool.query(
        "UPDATE password_credentials c SET record = $1, revision = c.revision + 1, updated_at = GREATEST(c.updated_at, $2) WHERE c.identity_id = $3 AND c.revision = $4 AND EXISTS (SELECT 1 FROM identities i JOIN principals p ON p.id = i.principal_id WHERE i.id = c.identity_id AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active')",
        [
          JSON.stringify(record),
          input.nowMs,
          input.identityId,
          input.expectedRevision,
        ],
      );
      if (result.rowCount !== 0 && result.rowCount !== 1)
        throw new Error('Invalid credential replacement result');
      return result.rowCount === 1;
    },
  };
}
