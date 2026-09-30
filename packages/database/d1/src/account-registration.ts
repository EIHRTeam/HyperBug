import type { D1Database } from '@cloudflare/workers-types';
import {
  validateAccountRegistrationInput,
  type AccountRegistrationStore,
  type AccountPasswordStore,
} from '@hyperbug/application';
import { parseStandardPasswordRecord } from '@hyperbug/security';

function duplicateHandle(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /UNIQUE constraint failed: identities\.provider, identities\.issuer, identities\.subject/.test(
    error.message,
  );
}

/** D1 batch rolls all three inserts back if the unique handle loses a race. */
export function createD1AccountRegistrationStore(
  db: D1Database,
): AccountRegistrationStore & AccountPasswordStore {
  return {
    async register(input) {
      validateAccountRegistrationInput(input);
      const record = JSON.stringify(
        parseStandardPasswordRecord(input.passwordRecord),
      );
      try {
        await db.batch([
          db
            .prepare(
              "INSERT INTO principals (id, kind, display_name, status, created_at, revision) VALUES (?, 'user', ?, 'active', ?, 1)",
            )
            .bind(input.principalId, input.handle, input.nowMs),
          db
            .prepare(
              'INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .bind(
              input.identityId,
              input.principalId,
              'local-password',
              'hyperbug',
              input.handle,
              input.nowMs,
            ),
          db
            .prepare(
              'INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
            )
            .bind(input.identityId, record, input.nowMs, input.nowMs),
        ]);
      } catch (error) {
        if (duplicateHandle(error)) return { status: 'existing' };
        throw error;
      }
      return { status: 'created', principalId: input.principalId };
    },
    async loadCredential(handle) {
      if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(handle))
        throw new Error('Invalid account handle');
      // Credential and suspension checks must begin at the primary. A stale
      // replica could otherwise accept a password changed on another request.
      const row = await db
        .withSession('first-primary')
        .prepare(
          "SELECT p.id AS principal_id, i.id AS identity_id, c.record, c.revision FROM identities i JOIN principals p ON p.id = i.principal_id JOIN password_credentials c ON c.identity_id = i.id WHERE i.provider = 'local-password' AND i.issuer = 'hyperbug' AND i.subject = ? AND p.kind IN ('user', 'staff') AND p.status = 'active' LIMIT 1",
        )
        .bind(handle)
        .first<{
          principal_id: string;
          identity_id: string;
          record: string;
          revision: number;
        }>();
      if (!row) return null;
      if (!Number.isSafeInteger(row.revision) || row.revision < 1)
        throw new Error('Invalid credential revision');
      return {
        principalId: row.principal_id,
        identityId: row.identity_id,
        record: parseStandardPasswordRecord(JSON.parse(row.record)),
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
      const result = await db
        .prepare(
          "UPDATE password_credentials SET record = ?, revision = revision + 1, updated_at = max(updated_at, ?) WHERE identity_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM identities i JOIN principals p ON p.id = i.principal_id WHERE i.id = password_credentials.identity_id AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.kind IN ('user', 'staff') AND p.status = 'active')",
        )
        .bind(
          JSON.stringify(record),
          input.nowMs,
          input.identityId,
          input.expectedRevision,
        )
        .run();
      if (result.meta.changes !== 0 && result.meta.changes !== 1)
        throw new Error('Invalid credential replacement result');
      return result.meta.changes === 1;
    },
  };
}
