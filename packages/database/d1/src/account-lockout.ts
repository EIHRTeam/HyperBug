import type { D1Database } from '@cloudflare/workers-types';
import {
  RateLimitFailure,
  validAccountLockoutPolicy,
  validAccountLockoutSubject,
  type AccountLockoutState,
  type AccountLockoutStore,
} from '@hyperbug/security';

interface LockoutRow {
  failed_attempts: number;
  not_before: number;
  expires_at: number;
}

function state(row: LockoutRow | null): AccountLockoutState {
  if (
    !row ||
    !Number.isSafeInteger(row.failed_attempts) ||
    row.failed_attempts < 1 ||
    row.failed_attempts > 2147483647 ||
    !Number.isSafeInteger(row.not_before) ||
    !Number.isSafeInteger(row.expires_at) ||
    row.not_before < 0 ||
    row.expires_at < row.not_before ||
    row.expires_at > 8640000000000000
  )
    throw new RateLimitFailure();
  return {
    failedAttempts: row.failed_attempts,
    notBeforeMs: row.not_before,
    expiresAtMs: row.expires_at,
  };
}

/** D1 primary-backed failure streak. Read replication must remain disabled. */
export function createD1AccountLockoutStore(
  db: D1Database,
): AccountLockoutStore {
  return {
    async get(subject, nowMs) {
      if (
        !validAccountLockoutSubject(subject) ||
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > 8640000000000000
      )
        throw new RateLimitFailure();
      const row = await db
        .prepare(
          'SELECT failed_attempts, not_before, expires_at FROM account_lockouts WHERE key_version = ? AND subject_digest = ?',
        )
        .bind(subject.keyVersion, subject.digest)
        .first<LockoutRow>();
      if (!row) return null;
      const current = state(row);
      return current.expiresAtMs <= nowMs ? null : current;
    },
    async recordFailure(subject, nowMs, policy) {
      if (
        !validAccountLockoutSubject(subject) ||
        !validAccountLockoutPolicy(policy, nowMs)
      )
        throw new RateLimitFailure();
      // The failure count and next admission time change in one primary write.
      // SQLite integer division selects the completed failure-step count.
      const row = await db
        .prepare(
          'INSERT INTO account_lockouts (key_version, subject_digest, failed_attempts, not_before, expires_at) VALUES (?1, ?2, 1, ?3 + ?4, ?3 + ?5) ON CONFLICT (key_version, subject_digest) DO UPDATE SET failed_attempts = CASE WHEN account_lockouts.expires_at <= ?3 THEN 1 ELSE min(account_lockouts.failed_attempts + 1, 2147483647) END, not_before = CASE WHEN account_lockouts.expires_at <= ?3 THEN ?3 + ?4 ELSE max(account_lockouts.not_before, ?3 + min(?6, ?4 * (1 << min(account_lockouts.failed_attempts / ?7, 27)))) END, expires_at = ?3 + ?5 RETURNING failed_attempts, not_before, expires_at',
        )
        .bind(
          subject.keyVersion,
          subject.digest,
          nowMs,
          policy.initialMs,
          policy.resetAfterMs,
          policy.maximumMs,
          policy.failuresPerStep,
        )
        .first<LockoutRow>();
      return state(row);
    },
    async clear(subject) {
      if (!validAccountLockoutSubject(subject)) throw new RateLimitFailure();
      await db
        .prepare(
          'DELETE FROM account_lockouts WHERE key_version = ? AND subject_digest = ?',
        )
        .bind(subject.keyVersion, subject.digest)
        .run();
    },
    async purgeExpired(nowMs, limit) {
      if (
        !Number.isSafeInteger(nowMs) ||
        nowMs < 0 ||
        nowMs > 8640000000000000 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 1000
      )
        throw new RateLimitFailure();
      const result = await db
        .prepare(
          'DELETE FROM account_lockouts WHERE rowid IN (SELECT rowid FROM account_lockouts WHERE expires_at <= ? ORDER BY expires_at, rowid LIMIT ?)',
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
