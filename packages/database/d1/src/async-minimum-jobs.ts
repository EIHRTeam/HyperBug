import type { D1Database } from '@cloudflare/workers-types';
import {
  AsyncError,
  validateJob,
  type AsyncJob,
  type JobStore,
} from '@hyperbug/application';
import {
  createD1AsyncStore,
  asyncJobOf,
  jobClaimStatements,
} from './async-processing.ts';
import { minimumReservation } from './async-minimum-budget.ts';

type Row = Record<string, unknown>;

/** Invocation-local selection and claim witnesses; checkpoint commits remain shared and fenced. */
export function createD1MinimumJobStore(db: D1Database) {
  const shared = createD1AsyncStore(db);
  let admitted = false,
    admissionAttempted = false,
    claimAttempted = false;
  let selectedId: string | null = null,
    preflight: AsyncJob | null = null,
    current: AsyncJob | null = null;
  const store: JobStore = {
    ...shared,
    async get(id) {
      validateJob(id, 1);
      if (preflight?.id === id) {
        const snapshot = preflight;
        preflight = null;
        return snapshot;
      }
      if (current?.id === id) {
        const snapshot = current;
        current = null;
        return snapshot;
      }
      return shared.get(id);
    },
    async claim(id, token, now) {
      const statements = jobClaimStatements(id, token, now);
      if (!admitted || selectedId !== id || claimAttempted)
        throw new AsyncError('invalid');
      claimAttempted = true;
      const result = await db.batch<Row>([
        ...statements.map(([sql, values]) => db.prepare(sql).bind(...values)),
        db
          .prepare(
            "SELECT * FROM async_jobs WHERE id=? AND status='running' AND lease_token=? AND lease_until>?",
          )
          .bind(id, token, now),
      ]);
      const row = result[2]!.results[0];
      current = row ? asyncJobOf(row) : null;
      return result[1]!.results.length === 1;
    },
  };
  return {
    store,
    async admit(now: number) {
      if (admissionAttempted) throw new AsyncError('invalid');
      admissionAttempted = true;
      const token = crypto.randomUUID();
      const result = await db.batch<Row>([
        minimumReservation(db, now, token),
        db
          .prepare(
            `SELECT j.* FROM async_jobs j JOIN (
              SELECT id FROM (
                SELECT id,lease_until FROM (SELECT id,lease_until FROM async_jobs WHERE status='pending' AND lease_until<=? ORDER BY lease_until,id LIMIT 1) p
                UNION ALL SELECT id,lease_until FROM (SELECT id,lease_until FROM async_jobs WHERE status='running' AND lease_until<=? ORDER BY lease_until,id LIMIT 1) r
              ) c ORDER BY lease_until,id LIMIT 1
            ) candidate ON candidate.id=j.id
            WHERE EXISTS (SELECT 1 FROM async_minimum_budget WHERE id=1 AND reservation_token=?)`,
          )
          .bind(now, now, token),
      ]);
      admitted = result[0]!.results.length === 1;
      const row = result[1]!.results[0];
      preflight = admitted && row ? asyncJobOf(row) : null;
      selectedId = preflight?.id ?? null;
      return { admitted, job: preflight };
    },
  };
}
