import type {
  D1Database,
  D1PreparedStatement,
} from '@cloudflare/workers-types';
import {
  MINIMUM_ASYNC_LIMITS,
  taskReference,
  validateTaskReference,
  AsyncError,
  type AsyncStore,
  type SearchIndexStore,
} from '@hyperbug/application';
import { assertId } from '@hyperbug/domain';
import { createD1AsyncStore, asyncBacklogSql } from './async-processing.ts';
import { createD1SearchIndexStore } from './search-index.ts';

type Row = Record<string, unknown>;
const validate = (now: number, token: string) => {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !/^[a-zA-Z0-9-]{1,64}$/.test(token)
  )
    throw new AsyncError('invalid');
};
const reservation = (db: D1Database, now: number, token: string | null) => {
  validate(now, token ?? 'reserve');
  const day = Math.floor(now / 86400000),
    l = MINIMUM_ASYNC_LIMITS;
  return db
    .prepare(`INSERT INTO async_minimum_budget (id,day,reads,writes,reservation_token) VALUES (1,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET day=excluded.day,reservation_token=excluded.reservation_token,
      reads=CASE WHEN async_minimum_budget.day<excluded.day THEN excluded.reads ELSE async_minimum_budget.reads+excluded.reads END,
      writes=CASE WHEN async_minimum_budget.day<excluded.day THEN excluded.writes ELSE async_minimum_budget.writes+excluded.writes END
    WHERE async_minimum_budget.day<=excluded.day AND (async_minimum_budget.day<excluded.day OR
      (async_minimum_budget.reads+excluded.reads<=? AND async_minimum_budget.writes+excluded.writes<=?)) RETURNING id`)
    .bind(
      day,
      l.invocationReads,
      l.invocationWrites,
      token,
      l.dailyReads,
      l.dailyWrites,
    );
};

/** Cursor import avoids repeatedly scanning a long prefix of failed source events. */
export function createD1MinimumAsyncStore(db: D1Database) {
  const shared = createD1AsyncStore(db);
  let cached: Row | null = null,
    claimedToken: string | null = null;
  let completedBacklog: Awaited<ReturnType<AsyncStore['backlog']>> | null =
    null;
  const backlogOf = (row: Row) => ({
    pending: Number(row.pending),
    failed: Number(row.failed),
    oldestAt: row.oldest_at === null ? null : Number(row.oldest_at),
  });
  const claimStatements = (
    now: number,
    token: string,
    execute: boolean,
    admissionToken: string | null,
  ): D1PreparedStatement[] => {
    validate(now, token);
    const gate = admissionToken
      ? 'EXISTS (SELECT 1 FROM async_minimum_budget WHERE id=1 AND reservation_token=?)'
      : '1';
    const gateParams = admissionToken ? [admissionToken] : [];
    const candidate = (
      source: string,
      table: string,
      key: string,
      prefix: string,
    ) =>
      `SELECT '${source}' AS source,'${prefix}' AS prefix,id,available_at,created_at FROM (
        SELECT e.${key} AS id,e.available_at,e.created_at FROM ${table} e WHERE e.delivered_at IS NULL AND e.available_at<=?
        AND (e.available_at,e.${key})>(SELECT available_at,event_id FROM async_minimum_cursors WHERE source='${source}')
        ORDER BY e.available_at,e.${key} LIMIT 1)`;
    const candidates =
      candidate('core', 'outbox', 'id', 'search-update:') +
      ' UNION ALL ' +
      candidate('plugin', 'plugin_event_outbox', 'event_id', 'plugin-event:');
    const head =
      "SELECT delivery_id FROM async_deliveries WHERE state='pending' AND available_at<=? ORDER BY available_at,delivery_id LIMIT 1";
    return [
      db
        .prepare(`INSERT INTO async_minimum_cursors (source,available_at,event_id)
        SELECT source,0,'' FROM (SELECT 'core' AS source UNION ALL SELECT 'plugin') WHERE ${gate} ON CONFLICT DO NOTHING`)
        .bind(...gateParams),
      db
        .prepare(`WITH candidates AS MATERIALIZED (${candidates})
        INSERT INTO async_deliveries (delivery_id,source,event_id,created_at,updated_at,available_at)
        SELECT prefix||id,source,id,created_at,?,? FROM candidates WHERE ${gate} ON CONFLICT DO NOTHING`)
        .bind(now, now, now, now, ...gateParams),
      db
        .prepare(`WITH candidates AS MATERIALIZED (${candidates}) UPDATE async_minimum_cursors SET
        available_at=COALESCE((SELECT available_at FROM candidates c WHERE c.source=async_minimum_cursors.source),0),
        event_id=COALESCE((SELECT id FROM candidates c WHERE c.source=async_minimum_cursors.source),'') WHERE ${gate}`)
        .bind(now, now, ...gateParams),
      db
        .prepare(`UPDATE async_deliveries SET state='failed',failure='lease-exhausted',updated_at=?
        WHERE delivery_id=(${head}) AND attempts>=5 AND work_until<=? AND publish_until<=? AND ${gate}`)
        .bind(now, now, now, now, ...gateParams),
      // Immutable source references and timeline witness are read with the execution claim.
      // JSON validity guards keep poison payloads consumable by the usual failure classifier.
      db
        .prepare(`UPDATE async_deliveries SET publish_token=?,publish_until=?,updated_at=? ${execute ? ',work_token=?,work_until=?,attempts=attempts+1' : ''}
        WHERE delivery_id=(${head}) AND attempts<5 AND work_until<=? AND publish_until<=? AND ${gate} RETURNING source,event_id,work_until,
        CASE source WHEN 'core' THEN (SELECT event_version FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE (SELECT payload_version FROM plugin_event_outbox e WHERE e.event_id=async_deliveries.event_id) END AS event_version,
        CASE source WHEN 'core' THEN (SELECT payload FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE (SELECT payload FROM plugin_event_outbox e WHERE e.event_id=async_deliveries.event_id) END AS payload,
        CASE source WHEN 'core' THEN (SELECT event_type FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE (SELECT point FROM plugin_event_outbox e WHERE e.event_id=async_deliveries.event_id) END AS event_type,
        CASE source WHEN 'core' THEN (SELECT project_id FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE NULL END AS project_id,
        CASE source WHEN 'core' THEN (SELECT aggregate_id FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE NULL END AS aggregate_id,
        CASE source WHEN 'core' THEN (SELECT t.aggregate_revision FROM outbox e JOIN timeline_events t ON t.project_id=e.project_id AND t.issue_id=e.aggregate_id
          AND t.id=CASE WHEN json_valid(e.payload) THEN json_extract(e.payload,'$.mutationId') ELSE NULL END WHERE e.id=async_deliveries.event_id) ELSE NULL END AS aggregate_revision,
        created_at`)
        .bind(
          token,
          now + 30000,
          now,
          ...(execute ? [token, now + 30000] : []),
          now,
          now,
          now,
          ...gateParams,
        ),
    ];
  };
  const remember = (row: Row | null, token: string | null) => {
    cached = row;
    claimedToken = token;
    completedBacklog = null;
  };
  const refsOf = (rows: Row[]) =>
    rows.map((row) =>
      taskReference(row.source as 'core' | 'plugin', String(row.event_id)),
    );
  return {
    async reserve(now: number): Promise<boolean> {
      return (await reservation(db, now, null).all()).results.length === 1;
    },
    async claim(now: number, token: string, execute = false) {
      const result = await db.batch<Row>(
        claimStatements(now, token, execute, null),
      );
      const rows = result.at(-1)?.results ?? [];
      remember(execute ? (rows[0] ?? null) : null, execute ? token : null);
      return refsOf(rows);
    },
    async admitAndClaim(now: number, token: string) {
      // Admission identities are fresh even when a caller reuses an execution token.
      const admissionToken = crypto.randomUUID();
      const result = await db.batch<Row>([
        reservation(db, now, admissionToken),
        ...claimStatements(now, token, true, admissionToken),
      ]);
      const rows = result.at(-1)?.results ?? [];
      remember(rows[0] ?? null, token);
      return {
        admitted: result[0]!.results.length === 1,
        references: refsOf(rows),
      };
    },
    /** Only an exact validated source lookup may use the immutable claim witness. */
    searchStore(): SearchIndexStore {
      const search = createD1SearchIndexStore(db);
      return {
        ...search,
        async revisionOf(projectId, issueId, mutationId) {
          assertId(projectId);
          assertId(issueId);
          assertId(mutationId);
          if (
            cached?.source === 'core' &&
            cached.project_id === projectId &&
            cached.aggregate_id === issueId
          ) {
            let payload: { mutationId?: unknown };
            try {
              payload = JSON.parse(String(cached.payload));
            } catch {
              return null;
            }
            if (payload?.mutationId === mutationId)
              return cached.aggregate_revision === null
                ? null
                : Number(cached.aggregate_revision);
          }
          return search.revisionOf(projectId, issueId, mutationId);
        },
      };
    },
    async backlog() {
      return completedBacklog ?? shared.backlog();
    },
    executionStore(): AsyncStore {
      let acquired = false;
      const matches = (ref: Parameters<AsyncStore['load']>[0]) => {
        validateTaskReference(ref);
        return (
          cached &&
          cached.source === ref.source &&
          cached.event_id === ref.eventId
        );
      };
      return {
        ...shared,
        async begin(ref, token, now) {
          if (
            !matches(ref) ||
            claimedToken !== token ||
            Number(cached!.work_until) <= now ||
            acquired
          )
            return 'busy';
          acquired = true;
          return 'acquired';
        },
        async load(ref) {
          if (!matches(ref)) throw new AsyncError('invalid');
          let payload: unknown;
          try {
            payload = JSON.parse(String(cached!.payload));
          } catch {
            throw new AsyncError('invalid');
          }
          return {
            reference: ref,
            eventVersion: Number(cached!.event_version),
            projectId:
              cached!.project_id === null ? null : String(cached!.project_id),
            aggregateId:
              cached!.aggregate_id === null
                ? null
                : String(cached!.aggregate_id),
            eventType: String(cached!.event_type),
            payload,
            createdAt: Number(cached!.created_at),
          };
        },
        async complete(ref, token, now) {
          if (!matches(ref) || claimedToken !== token)
            throw new AsyncError('invalid');
          const table =
              ref.source === 'core' ? 'outbox' : 'plugin_event_outbox',
            key = ref.source === 'core' ? 'id' : 'event_id';
          const result = await db.batch<Row>([
            db
              .prepare(
                `UPDATE ${table} SET delivered_at=? WHERE ${key}=? AND delivered_at IS NULL AND EXISTS (SELECT 1 FROM async_deliveries WHERE delivery_id=? AND work_token=? AND work_until>? AND state='pending')`,
              )
              .bind(now, ref.eventId, ref.deliveryId, token, now),
            db
              .prepare(
                "UPDATE async_deliveries SET state='done',work_token=NULL,work_until=0,publish_token=NULL,publish_until=0,failure=NULL,updated_at=? WHERE delivery_id=? AND work_token=? AND work_until>? AND state='pending' RETURNING delivery_id",
              )
              .bind(now, ref.deliveryId, token, now),
            db.prepare(asyncBacklogSql),
          ]);
          completedBacklog = backlogOf(result[2]!.results[0]!);
          return result[1]!.results.length === 1;
        },
      };
    },
  };
}
