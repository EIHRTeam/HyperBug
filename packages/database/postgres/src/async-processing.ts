import type { Pool } from 'pg';
import {
  ASYNC_LIMITS,
  AsyncError,
  taskReference,
  validateTaskReference,
  validateJob,
  type TaskReference,
  type AsyncStore,
  type JobStore,
  type AsyncJob,
} from '@hyperbug/application';

type Row = Record<string, unknown>;
type Statement = [string, unknown[]];
const number = (row: Row, key: string) => Number(row[key]);
const refOf = (row: Row) =>
  taskReference(row.source as TaskReference['source'], String(row.event_id));
const identity = (ref: TaskReference) => validateTaskReference(ref).deliveryId;
const time = (now: number) => {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > 8640000000000000 - ASYNC_LIMITS.maxDelayMs
  )
    throw new AsyncError('invalid');
};
const tokenCheck = (token: string) => {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(token)) throw new AsyncError('invalid');
};
const limitCheck = (limit: number, max: number = ASYNC_LIMITS.batch) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > max)
    throw new AsyncError('invalid');
};
export function createPostgresAsyncStore(
  pool: Pool,
): AsyncStore & Omit<JobStore, 'claim'> & { claimJob: JobStore['claim'] } {
  const pgSql = (sql: string) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  };
  const query = async (sql: string, values: unknown[]): Promise<Row[]> =>
    (await pool.query<Row>(pgSql(sql), values)).rows;
  const mutate = async (statements: Statement[]) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await statements.reduce(async (previous, [sql, values]) => {
        await previous;
        await client.query(pgSql(sql), values);
      }, Promise.resolve());
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  const guard = (ref: TaskReference, token: string, now: number) => {
    identity(ref);
    tokenCheck(token);
    time(now);
  };
  return {
    async claim(now, token, limit) {
      time(now);
      tokenCheck(token);
      limitCheck(limit);
      const statements: Statement[] = [];
      for (const [source, table, key, prefix] of [
        ['core', 'outbox', 'id', 'search-update:'],
        ['plugin', 'plugin_event_outbox', 'event_id', 'plugin-event:'],
      ] as const) {
        statements.push([
          `INSERT INTO async_deliveries (delivery_id,source,event_id,created_at,updated_at,available_at,publish_token,publish_until)
          SELECT ? || e.${key}, ?, e.${key}, e.created_at, ?, ?, ?, ? FROM ${table} e
          WHERE e.delivered_at IS NULL AND e.available_at <= ?
            AND NOT EXISTS (SELECT 1 FROM async_deliveries d WHERE d.source = ? AND d.event_id = e.${key} AND (d.state <> 'pending' OR d.available_at > ? OR d.publish_until > ? OR d.work_until > ?))
          ORDER BY e.available_at,e.${key} LIMIT ?
          ON CONFLICT (delivery_id) DO UPDATE SET publish_token=excluded.publish_token,publish_until=excluded.publish_until,updated_at=excluded.updated_at
          WHERE async_deliveries.state='pending' AND async_deliveries.available_at <= ? AND async_deliveries.publish_until <= ? AND async_deliveries.work_until <= ?`,
          [
            prefix,
            source,
            now,
            now,
            token,
            now + ASYNC_LIMITS.leaseMs,
            now,
            source,
            now,
            now,
            now,
            limit,
            now,
            now,
            now,
          ],
        ]);
      }
      // Both sources share the total bound. Extra claimed rows are released atomically below.
      statements.push([
        'UPDATE async_deliveries SET publish_token=NULL,publish_until=0 WHERE publish_token=? AND delivery_id NOT IN (SELECT delivery_id FROM async_deliveries WHERE publish_token=? ORDER BY created_at,delivery_id LIMIT ?)',
        [token, token, limit],
      ]);
      await mutate(statements);
      return (
        await query(
          'SELECT source,event_id FROM async_deliveries WHERE publish_token=? ORDER BY created_at,delivery_id LIMIT ?',
          [token, limit],
        )
      ).map(refOf);
    },
    async published(ref, token, now) {
      guard(ref, token, now);
      await mutate([
        [
          "UPDATE async_deliveries SET publish_token=NULL,publish_until=0,available_at=?,updated_at=? WHERE delivery_id=? AND publish_token=? AND publish_until>? AND state='pending'",
          [now + ASYNC_LIMITS.reconcileMs, now, identity(ref), token, now],
        ],
      ]);
    },
    async publicationFailed(ref, token, now, reason) {
      guard(ref, token, now);
      await mutate([
        [
          "UPDATE async_deliveries SET publication_attempts=publication_attempts+1,state=CASE WHEN publication_attempts+1>=5 THEN 'failed' ELSE 'pending' END,failure=?,publish_token=NULL,publish_until=0,available_at=?,updated_at=? WHERE delivery_id=? AND publish_token=? AND publish_until>? AND state='pending'",
          [reason, now + 60_000, now, identity(ref), token, now],
        ],
      ]);
    },
    async load(ref) {
      identity(ref);
      const sql =
        ref.source === 'core'
          ? 'SELECT event_version,project_id,aggregate_id,event_type,payload::text AS payload,created_at FROM outbox WHERE id=?'
          : 'SELECT payload_version AS event_version,point AS event_type,payload::text AS payload,created_at FROM plugin_event_outbox WHERE event_id=?';
      const row = (await query(sql, [ref.eventId]))[0];
      if (!row) return null;
      let payload: unknown;
      try {
        payload = JSON.parse(String(row.payload));
      } catch {
        throw new AsyncError('invalid');
      }
      return {
        reference: ref,
        eventVersion: number(row, 'event_version'),
        projectId: row.project_id === undefined ? null : String(row.project_id),
        aggregateId:
          row.aggregate_id === undefined ? null : String(row.aggregate_id),
        eventType: String(row.event_type),
        payload,
        createdAt: number(row, 'created_at'),
      };
    },
    async begin(ref, token, now) {
      guard(ref, token, now);
      await mutate([
        [
          "UPDATE async_deliveries SET state='failed',failure='lease-exhausted',updated_at=? WHERE delivery_id=? AND state='pending' AND attempts>=5 AND work_until<=?",
          [now, identity(ref), now],
        ],
        [
          "UPDATE async_deliveries SET work_token=?,work_until=?,attempts=attempts+1,updated_at=? WHERE delivery_id=? AND state='pending' AND attempts<5 AND work_until<=?",
          [token, now + ASYNC_LIMITS.leaseMs, now, identity(ref), now],
        ],
      ]);
      const row = (
        await query(
          'SELECT state,work_token FROM async_deliveries WHERE delivery_id=?',
          [identity(ref)],
        )
      )[0];
      return row?.state === 'done'
        ? 'done'
        : row?.state === 'failed'
          ? 'failed'
          : row?.work_token === token
            ? 'acquired'
            : 'busy';
    },
    async complete(ref, token, now) {
      guard(ref, token, now);
      const table = ref.source === 'core' ? 'outbox' : 'plugin_event_outbox';
      const key = ref.source === 'core' ? 'id' : 'event_id';
      await mutate([
        [
          `UPDATE ${table} SET delivered_at=? WHERE ${key}=? AND delivered_at IS NULL AND EXISTS (SELECT 1 FROM async_deliveries WHERE delivery_id=? AND work_token=? AND work_until>? AND state='pending')`,
          [now, ref.eventId, identity(ref), token, now],
        ],
        [
          "UPDATE async_deliveries SET state='done',work_token=NULL,work_until=0,publish_token=NULL,publish_until=0,failure=NULL,updated_at=? WHERE delivery_id=? AND work_token=? AND work_until>? AND state='pending'",
          [now, identity(ref), token, now],
        ],
      ]);
      return (
        (
          await query(
            'SELECT state FROM async_deliveries WHERE delivery_id=?',
            [identity(ref)],
          )
        )[0]?.state === 'done'
      );
    },
    async fail(ref, token, now, reason) {
      guard(ref, token, now);
      const permanent =
        reason === 'invalid' ||
        reason === 'unsupported' ||
        reason === 'permanent';
      await mutate([
        [
          "UPDATE async_deliveries SET state=CASE WHEN attempts>=5 OR ?=1 THEN 'failed' ELSE 'pending' END,failure=?,available_at=CAST(? AS bigint) + CASE attempts WHEN 1 THEN 1000 WHEN 2 THEN 2000 WHEN 3 THEN 4000 WHEN 4 THEN 8000 ELSE 16000 END,work_token=NULL,work_until=0,publish_token=NULL,publish_until=0,updated_at=? WHERE delivery_id=? AND work_token=? AND work_until>? AND state='pending'",
          [permanent ? 1 : 0, reason, now, now, identity(ref), token, now],
        ],
      ]);
    },
    async replay(ref, now) {
      identity(ref);
      time(now);
      const rows = await query(
        "UPDATE async_deliveries SET state='pending',attempts=0,publication_attempts=0,failure=NULL,available_at=?,updated_at=?,work_token=NULL,work_until=0,publish_token=NULL,publish_until=0 WHERE delivery_id=? AND state='failed' RETURNING delivery_id",
        [now, now, identity(ref)],
      );
      return rows.length === 1;
    },
    async backlog() {
      const row = (
        await query(
          `SELECT
        (SELECT count(*) FROM (SELECT id FROM outbox WHERE delivered_at IS NULL LIMIT 1001) core_count)+(SELECT count(*) FROM (SELECT event_id FROM plugin_event_outbox WHERE delivered_at IS NULL LIMIT 1001) plugin_count) AS pending,
        (SELECT count(*) FROM (SELECT delivery_id FROM async_deliveries WHERE state='failed' LIMIT 1001) failed_count) AS failed,
        (SELECT min(created_at) FROM (SELECT created_at FROM (SELECT created_at FROM outbox WHERE delivered_at IS NULL ORDER BY created_at,id LIMIT 1) core_age UNION ALL SELECT created_at FROM (SELECT created_at FROM plugin_event_outbox WHERE delivered_at IS NULL ORDER BY created_at,event_id LIMIT 1) plugin_age) age) AS oldest_at`,
          [],
        )
      )[0]!;
      return {
        pending: number(row, 'pending'),
        failed: number(row, 'failed'),
        oldestAt: row.oldest_at === null ? null : number(row, 'oldest_at'),
      };
    },
    async purgeTerminal(before, limit) {
      time(before);
      limitCheck(limit, 100);
      // Failed entries remain replayable until source removal by an independently authorized retention policy.
      const rows = await query(
        "DELETE FROM async_deliveries WHERE delivery_id IN (SELECT delivery_id FROM async_deliveries WHERE state='done' AND updated_at<? ORDER BY updated_at,delivery_id LIMIT ?) RETURNING delivery_id",
        [before, limit],
      );
      return rows.length;
    },
    async create(id, maxSteps, now) {
      validateJob(id, maxSteps);
      time(now);
      await mutate([
        [
          'INSERT INTO async_jobs (id,max_steps,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT (id) DO NOTHING',
          [id, maxSteps, now, now],
        ],
      ]);
    },
    async get(id) {
      validateJob(id, 1);
      const r = (await query('SELECT * FROM async_jobs WHERE id=?', [id]))[0];
      return r
        ? {
            id: String(r.id),
            kind: 'conformance',
            status: r.status as AsyncJob['status'],
            checkpoint: number(r, 'checkpoint'),
            progress: number(r, 'progress'),
            attempts: number(r, 'attempts'),
            resultReference:
              r.result_reference === null ? null : String(r.result_reference),
            maxSteps: number(r, 'max_steps'),
            updatedAt: number(r, 'updated_at'),
          }
        : null;
    },
    async claimJob(id, token, now) {
      validateJob(id, 1);
      tokenCheck(token);
      time(now);
      await mutate([
        [
          "UPDATE async_jobs SET status='failed',updated_at=? WHERE id=? AND status='running' AND attempts>=5 AND lease_until<=?",
          [now, id, now],
        ],
      ]);
      return (
        (
          await query(
            "UPDATE async_jobs SET status='running',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=? WHERE id=? AND status IN ('pending','running') AND attempts<5 AND lease_until<=? RETURNING id",
            [token, now + ASYNC_LIMITS.leaseMs, now, id, now],
          )
        ).length === 1
      );
    },
    async cancel(id, now) {
      validateJob(id, 1);
      time(now);
      return (
        (
          await query(
            "UPDATE async_jobs SET status='cancelled',lease_token=NULL,lease_until=0,updated_at=? WHERE id=? AND status IN ('pending','running') RETURNING id",
            [now, id],
          )
        ).length === 1
      );
    },
    async commitStep(id, token, checkpoint, now, resultReference) {
      validateJob(id, 1, resultReference);
      tokenCheck(token);
      time(now);
      if (
        !Number.isInteger(checkpoint) ||
        checkpoint < 0 ||
        checkpoint >= ASYNC_LIMITS.steps
      )
        throw new AsyncError('invalid');
      await mutate([
        [
          "INSERT INTO async_job_steps (job_id,step,committed_at) SELECT id,checkpoint,? FROM async_jobs WHERE id=? AND checkpoint=? AND status='running' AND lease_token=? AND lease_until>? ON CONFLICT (job_id,step) DO NOTHING",
          [now, id, checkpoint, token, now],
        ],
        [
          "UPDATE async_jobs SET checkpoint=checkpoint+1,progress=((checkpoint+1)*100)/max_steps,status=CASE WHEN checkpoint+1=max_steps THEN 'completed' ELSE 'pending' END,attempts=0,result_reference=?,lease_token=NULL,lease_until=0,updated_at=? WHERE id=? AND checkpoint=? AND status='running' AND lease_token=? AND lease_until>?",
          [resultReference ?? null, now, id, checkpoint, token, now],
        ],
      ]);
      return (await this.get(id))?.checkpoint === checkpoint + 1;
    },
  };
}
