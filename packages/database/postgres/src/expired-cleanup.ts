import type { Pool } from 'pg';
import {
  validateExpiredCleanup,
  type ExpiredCleanupStore,
} from '@hyperbug/application';

const targets = [
  ['authorization_sessions', 'idle_expires_at', true],
  ['authorization_sessions', 'revoked_at', true],
  ['oauth_codes', 'expires_at', true],
  ['oauth_access_tokens', 'expires_at', true],
  ['webauthn_challenges', 'expires_at', true],
  ['mutation_receipts', 'expires_at', false],
  ['rate_limit_counters', 'expires_at', false],
] as const;

/** Static allowlist: no history, audit, recovery codes or blob references. */
export function createPostgresExpiredCleanupStore(
  db: Pool,
): ExpiredCleanupStore {
  return {
    async purgeExpired(nowMs, retentionMs, limit) {
      validateExpiredCleanup(nowMs, retentionMs, limit);
      let total = 0;
      for (const [table, column, retained] of targets) {
        const cutoff = retained ? nowMs - retentionMs : nowMs;
        // Serial maintenance keeps pressure bounded; no parallel delete fan-out.
        // eslint-disable-next-line no-await-in-loop
        const result = await db.query(
          `WITH expired AS MATERIALIZED (SELECT ctid FROM ${table} WHERE ${column} <= $1 ORDER BY ${column} LIMIT $2 FOR UPDATE SKIP LOCKED) DELETE FROM ${table} WHERE ctid IN (SELECT ctid FROM expired)`,
          [cutoff, limit],
        );
        const changed = result.rowCount;
        if (
          changed === null ||
          !Number.isSafeInteger(changed) ||
          changed < 0 ||
          changed > limit
        )
          throw new Error('Expired cleanup unavailable');
        total += changed;
      }
      return total;
    },
  };
}
