import { AuditFailure } from '@hyperbug/security';
import { d1AuditInsert } from './audit-write.ts';
import type { D1Database } from '@cloudflare/workers-types';
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

/**
 * The delete-then-insert batch keeps exactly one generation alive; the
 * pre-read maximum only picks the next number and never mixes sets.
 */
export function createD1AccountRecoveryStore(
  db: D1Database,
): AccountRecoveryStore {
  return {
    async replaceCodes(input, audit) {
      validateRecoveryCodeReplacement(
        input.identityId,
        input.digests,
        input.nowMs,
      );
      identityBound(input.identityId);
      const current = await db
        .prepare(
          'SELECT COALESCE(MAX(generation), 0) AS generation FROM recovery_codes WHERE identity_id = ?',
        )
        .bind(input.identityId)
        .first<{ generation: number }>();
      if (
        !current ||
        !Number.isSafeInteger(current.generation) ||
        current.generation < 0 ||
        current.generation >= 2147483647
      )
        throw new Error('Invalid recovery generation');
      const generation = current.generation + 1;
      try {
        await db.batch([
          db
            .prepare('DELETE FROM recovery_codes WHERE identity_id = ?')
            .bind(input.identityId),
          ...input.digests.map((digest) =>
            db
              .prepare(
                'INSERT INTO recovery_codes (id, identity_id, generation, digest, created_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)',
              )
              .bind(
                crypto.randomUUID(),
                input.identityId,
                generation,
                digest,
                input.nowMs,
              ),
          ),
          d1AuditInsert(db, audit),
        ]);
      } catch {
        throw new AuditFailure();
      }
    },
    async listActive(identityId) {
      identityBound(identityId);
      const result = await db
        .prepare(
          'SELECT id, digest FROM recovery_codes WHERE identity_id = ? AND used_at IS NULL AND generation = (SELECT MAX(generation) FROM recovery_codes WHERE identity_id = ?)',
        )
        .bind(identityId, identityId)
        .all<{ id: string; digest: string }>();
      if (!result.success) throw new Error('Recovery code read failed');
      return (result.results ?? []).map((row) =>
        Object.freeze({ id: row.id, digest: row.digest }),
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
      const result = await db
        .prepare(
          'UPDATE recovery_codes SET used_at = ? WHERE id = ? AND used_at IS NULL',
        )
        .bind(nowMs, id)
        .run();
      if (result.meta.changes !== 0 && result.meta.changes !== 1)
        throw new Error('Invalid recovery consumption result');
      return result.meta.changes === 1;
    },
  };
}
