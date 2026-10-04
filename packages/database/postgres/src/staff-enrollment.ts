import type { Pool } from 'pg';
import {
  validateStaffEnrollmentInput,
  type StaffEnrollmentStore,
} from '@hyperbug/application';
import { parseAccountPasswordRecord } from '@hyperbug/security';

/** One transaction keeps the single-shot Staff guard and the writes atomic. */
export function createPostgresStaffEnrollmentStore(
  pool: Pool,
): StaffEnrollmentStore {
  return {
    async enrollStaff(input) {
      validateStaffEnrollmentInput(input);
      const record = parseAccountPasswordRecord(input.passwordRecord);
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(1212371531, 1)');
        const principal = await db.query(
          "INSERT INTO principals (id, kind, display_name, status, created_at, revision) SELECT $1, 'staff', $2, 'active', $3, 1 WHERE NOT EXISTS (SELECT 1 FROM principals WHERE kind = 'staff' AND status = 'active')",
          [input.principalId, input.handle, input.nowMs],
        );
        if (principal.rowCount === 0) {
          await db.query('ROLLBACK');
          return { status: 'staff-active' };
        }
        if (principal.rowCount !== 1)
          throw new Error('Principal insert failed');
        const identity = await db.query(
          "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES ($1, $2, 'local-password', 'hyperbug', $3, $4) ON CONFLICT (provider, issuer, subject) DO NOTHING RETURNING id",
          [input.identityId, input.principalId, input.handle, input.nowMs],
        );
        if (identity.rowCount === 0) {
          await db.query('ROLLBACK');
          return { status: 'handle-taken' };
        }
        if (identity.rowCount !== 1) throw new Error('Identity insert failed');
        await db.query(
          'INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES ($1, $2, 1, $3, $3)',
          [input.identityId, JSON.stringify(record), input.nowMs],
        );
        await db.query(
          "INSERT INTO instance_roles (principal_id, role, granted_at, granted_by) VALUES ($1, 'instance-administrator', $2, NULL)",
          [input.principalId, input.nowMs],
        );
        await db.query('COMMIT');
        return { status: 'enrolled', principalId: input.principalId };
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    },
    async countActiveStaff() {
      const result = await pool.query<{ total: string }>(
        "SELECT count(*) AS total FROM principals WHERE kind = 'staff' AND status = 'active'",
      );
      const total = Number(result.rows[0]?.total);
      if (!Number.isSafeInteger(total) || total < 0)
        throw new Error('Invalid staff count');
      return total;
    },
  };
}
