import type { D1Database } from '@cloudflare/workers-types';
import {
  validateStaffEnrollmentInput,
  type StaffEnrollmentStore,
} from '@hyperbug/application';
import { parseStandardPasswordRecord } from '@hyperbug/security';

function duplicateHandle(error: unknown): boolean {
  return (
    error instanceof Error &&
    /UNIQUE constraint failed: identities\.provider, identities\.issuer, identities\.subject/.test(
      error.message,
    )
  );
}

function missingPrincipal(error: unknown): boolean {
  return (
    error instanceof Error &&
    /FOREIGN KEY constraint failed/.test(error.message)
  );
}

/**
 * The conditional principal insert keeps enrollment single-shot: when an
 * active Staff principal exists it inserts nothing, the identity insert then
 * fails its foreign key, and the D1 batch rolls every statement back.
 */
export function createD1StaffEnrollmentStore(
  db: D1Database,
): StaffEnrollmentStore {
  return {
    async enrollStaff(input) {
      validateStaffEnrollmentInput(input);
      const record = JSON.stringify(
        parseStandardPasswordRecord(input.passwordRecord),
      );
      try {
        await db.batch([
          db
            .prepare(
              "INSERT INTO principals (id, kind, display_name, status, created_at, revision) SELECT ?, 'staff', ?, 'active', ?, 1 WHERE NOT EXISTS (SELECT 1 FROM principals WHERE kind = 'staff' AND status = 'active')",
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
        if (missingPrincipal(error)) return { status: 'staff-active' };
        if (duplicateHandle(error)) return { status: 'handle-taken' };
        throw error;
      }
      return { status: 'enrolled', principalId: input.principalId };
    },
    async countActiveStaff() {
      const row = await db
        .prepare(
          "SELECT count(*) AS total FROM principals WHERE kind = 'staff' AND status = 'active'",
        )
        .first<{ total: number }>();
      if (!row || !Number.isSafeInteger(row.total) || row.total < 0)
        throw new Error('Invalid staff count');
      return row.total;
    },
  };
}
