import type { Pool } from 'pg';
import {
  validateRecoveryCodeReplacement,
  type AccountRecoveryStore,
} from '@hyperbug/application';

function identityBound(identityId: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      identityId,
    )
  )
    throw new Error('Invalid recovery identity');
}

/** One transaction keeps the delete/insert generation swap atomic. */
export function createPostgresAccountRecoveryStore(
  pool: Pool,
): AccountRecoveryStore {
  return {
    async replaceCodes(input) {
      validateRecoveryCodeReplacement(
        input.identityId,
        input.digests,
        input.nowMs,
      );
      identityBound(input.identityId);
      const db = await pool.connect();
      try {
        await db.query('BEGIN');
        const current = await db.query<{ generation: number }>(
          'SELECT COALESCE(MAX(generation), 0) AS generation FROM recovery_codes WHERE identity_id = $1',
          [input.identityId],
        );
        const previous = current.rows[0]?.generation ?? 0;
        if (
          !Number.isSafeInteger(previous) ||
          previous < 0 ||
          previous >= 2147483647
        ) {
          await db.query('ROLLBACK');
          throw new Error('Invalid recovery generation');
        }
        await db.query('DELETE FROM recovery_codes WHERE identity_id = $1', [
          input.identityId,
        ]);
        for (const digest of input.digests) {
          // eslint-disable-next-line no-await-in-loop
          await db.query(
            'INSERT INTO recovery_codes (id, identity_id, generation, digest, created_at) VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4)',
            [input.identityId, previous + 1, digest, input.nowMs],
          );
        }
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    },
    async listActive(identityId) {
      identityBound(identityId);
      const result = await pool.query<{ id: string; digest: unknown }>(
        'SELECT id, digest FROM recovery_codes WHERE identity_id = $1 AND used_at IS NULL AND generation = (SELECT MAX(generation) FROM recovery_codes WHERE identity_id = $1)',
        [identityId],
      );
      return result.rows.map((row) =>
        Object.freeze({
          id: row.id,
          digest:
            typeof row.digest === 'string'
              ? row.digest
              : JSON.stringify(row.digest),
        }),
      );
    },
    async consume(id, nowMs) {
      if (
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > 8640000000000000 ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        )
      )
        throw new Error('Invalid recovery consumption');
      const result = await pool.query(
        'UPDATE recovery_codes SET used_at = $2 WHERE id = $1::uuid AND used_at IS NULL',
        [id, nowMs],
      );
      if (result.rowCount !== null && result.rowCount > 1)
        throw new Error('Invalid recovery consumption result');
      return result.rowCount === 1;
    },
  };
}
