import type { D1Database } from '@cloudflare/workers-types';
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
  ['account_lockouts', 'expires_at', false],
  ['rate_limit_counters', 'expires_at', false],
] as const;

/** Static allowlist: no history, audit, recovery codes or blob references. */
export function createD1ExpiredCleanupStore(
  db: D1Database,
): ExpiredCleanupStore {
  return {
    async purgeExpired(nowMs, retentionMs, limit) {
      validateExpiredCleanup(nowMs, retentionMs, limit);
      let total = 0;
      for (const [table, column, retained] of targets) {
        const cutoff = retained ? nowMs - retentionMs : nowMs;
        // Serial maintenance keeps pressure bounded; no parallel delete fan-out.
        // eslint-disable-next-line no-await-in-loop
        const result = await db
          .prepare(
            `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${column} <= ? ORDER BY ${column}, rowid LIMIT ?)`,
          )
          .bind(cutoff, limit)
          .run();
        if (!result.success) throw new Error('Expired cleanup unavailable');
        const changed = result.meta.changes;
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
