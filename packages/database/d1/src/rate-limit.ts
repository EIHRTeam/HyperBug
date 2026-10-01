import type { D1Database } from '@cloudflare/workers-types';
import {
  RateLimitFailure,
  validCounterWrite,
  type RateCounterStore,
} from '@hyperbug/security';

function validPurge(nowMs: number, limit: number): boolean {
  return (
    Number.isSafeInteger(nowMs) &&
    nowMs >= 0 &&
    nowMs <= 8640000000000000 &&
    Number.isSafeInteger(limit) &&
    limit >= 1 &&
    limit <= 1000
  );
}

/** The write plus RETURNING executes on D1's primary, never a replica read. */
export function createD1RateCounterStore(db: D1Database): RateCounterStore {
  return {
    async increment(input) {
      if (!validCounterWrite(input)) throw new RateLimitFailure();
      const row = await db
        .prepare(
          'INSERT INTO rate_limit_counters (category, dimension, key_version, subject_digest, window_start, hits, expires_at) VALUES (?, ?, ?, ?, ?, 1, ?) ON CONFLICT (category, dimension, key_version, subject_digest, window_start) DO UPDATE SET hits = min(rate_limit_counters.hits + 1, 2147483647), expires_at = min(rate_limit_counters.expires_at, excluded.expires_at) RETURNING hits',
        )
        .bind(
          input.category,
          input.dimension,
          input.keyVersion,
          input.digest,
          input.windowStart,
          input.expiresAt,
        )
        .first<{ hits: number }>();
      if (
        !row ||
        !Number.isSafeInteger(row.hits) ||
        row.hits < 1 ||
        row.hits > 2147483647
      )
        throw new RateLimitFailure();
      return row.hits;
    },
    async purgeExpired(nowMs, limit) {
      if (!validPurge(nowMs, limit)) throw new RateLimitFailure();
      const result = await db
        .prepare(
          'DELETE FROM rate_limit_counters WHERE rowid IN (SELECT rowid FROM rate_limit_counters WHERE expires_at <= ? ORDER BY expires_at, rowid LIMIT ?)',
        )
        .bind(nowMs, limit)
        .run();
      const changed = result.meta.changes;
      if (!Number.isSafeInteger(changed) || changed < 0 || changed > limit)
        throw new RateLimitFailure();
      return changed;
    },
  };
}
