import type { Pool } from 'pg';
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

/** One row-locking upsert accounts for each sensitive attempt. */
export function createPostgresRateCounterStore(pool: Pool): RateCounterStore {
  return {
    async increment(input) {
      if (!validCounterWrite(input)) throw new RateLimitFailure();
      const result = await pool.query<{ hits: number }>(
        'INSERT INTO rate_limit_counters (category, dimension, key_version, subject_digest, window_start, hits, expires_at) VALUES ($1, $2, $3, $4, $5, 1, $6) ON CONFLICT (category, dimension, key_version, subject_digest, window_start) DO UPDATE SET hits = CASE WHEN rate_limit_counters.hits < 2147483647 THEN rate_limit_counters.hits + 1 ELSE rate_limit_counters.hits END, expires_at = least(rate_limit_counters.expires_at, excluded.expires_at) RETURNING hits',
        [
          input.category,
          input.dimension,
          input.keyVersion,
          input.digest,
          input.windowStart,
          input.expiresAt,
        ],
      );
      const hits = result.rows[0]?.hits;
      if (
        !Number.isSafeInteger(hits) ||
        hits === undefined ||
        hits < 1 ||
        hits > 2147483647
      )
        throw new RateLimitFailure();
      return hits;
    },
    async purgeExpired(nowMs, limit) {
      if (!validPurge(nowMs, limit)) throw new RateLimitFailure();
      const result = await pool.query(
        'DELETE FROM rate_limit_counters WHERE ctid IN (SELECT ctid FROM rate_limit_counters WHERE expires_at <= $1 ORDER BY expires_at, ctid LIMIT $2)',
        [nowMs, limit],
      );
      const changed = result.rowCount;
      if (
        changed === null ||
        !Number.isSafeInteger(changed) ||
        changed < 0 ||
        changed > limit
      )
        throw new RateLimitFailure();
      return changed;
    },
  };
}
