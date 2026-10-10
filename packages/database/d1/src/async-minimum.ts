import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '@cloudflare/workers-types';
import {
  MINIMUM_ASYNC_LIMITS,
  taskReference,
  validateTaskReference,
  AsyncError,
  SEARCH_MINIMUM_BUDGET,
  searchBudgetOptions,
  type AsyncStore,
  type SearchIndexStore,
} from '@hyperbug/application';
import { assertId } from '@hyperbug/domain';
import { createD1AsyncStore, asyncBacklogSql } from './async-processing.ts';
import {
  createD1SearchIndexStore,
  type ClaimedSearchAdmission,
} from './search-index.ts';
import { searchMeter } from './search-meter.ts';
import { searchBudgetConflictSql } from './search-budget.ts';

type Row = Record<string, unknown>;
// A conservative subset of the ordinary consumer validator: lowercase UUIDv4
// and the exact compact producer JSON. Other serializations use the usual path.
const sqlUuid = (value: string) => `(length(CAST(${value} AS BLOB))=36
  AND substr(${value},9,1)='-' AND substr(${value},14,1)='-' AND substr(${value},19,1)='-' AND substr(${value},24,1)='-'
  AND substr(${value},15,1)='4' AND substr(${value},20,1) GLOB '[89ab]'
  AND length(replace(${value},'-',''))=32 AND replace(${value},'-','') NOT GLOB '*[^0-9a-f]*')`;
const canonicalSearch = `CASE WHEN json_valid(e.payload) THEN CASE WHEN
  e.event_version=1 AND e.event_type IN ('issue.create','issue.edit','issue.close','issue.reopen','issue.labels','issue.assignees','issue.type','issue.milestone','issue.moderate','issue.redact','issue.delete')
  AND ${sqlUuid('e.id')} AND ${sqlUuid('e.project_id')} AND ${sqlUuid('e.aggregate_id')}
  AND ${sqlUuid("json_extract(e.payload,'$.mutationId')")}
  AND e.payload=json_object('issueId',e.aggregate_id,'mutationId',json_extract(e.payload,'$.mutationId'))
  AND t.aggregate_revision BETWEEN 1 AND 2147483647 THEN 1 ELSE 0 END ELSE 0 END`;
const timelineJoin = `JOIN timeline_events t ON t.project_id=e.project_id AND t.issue_id=e.aggregate_id
  AND t.id=CASE WHEN json_valid(e.payload) THEN json_extract(e.payload,'$.mutationId') ELSE NULL END`;
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
  let claimedSearch: ClaimedSearchAdmission | null = null,
    searchDay: number | null = null;
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
        AND (e.available_at,e.${key})>(COALESCE((SELECT available_at FROM async_minimum_cursors WHERE source='${source}'),0),COALESCE((SELECT event_id FROM async_minimum_cursors WHERE source='${source}'),''))
        ORDER BY e.available_at,e.${key} LIMIT 1)`;
    const candidates =
      candidate('core', 'outbox', 'id', 'search-update:') +
      ' UNION ALL ' +
      candidate('plugin', 'plugin_event_outbox', 'event_id', 'plugin-event:');
    const head =
      "SELECT delivery_id FROM async_deliveries WHERE state='pending' AND available_at<=? ORDER BY available_at,delivery_id LIMIT 1";
    return [
      db
        .prepare(`WITH candidates AS MATERIALIZED (${candidates})
        INSERT INTO async_deliveries (delivery_id,source,event_id,created_at,updated_at,available_at)
        SELECT prefix||id,source,id,created_at,?,? FROM candidates WHERE ${gate} ON CONFLICT DO NOTHING`)
        .bind(now, now, now, now, ...gateParams),
      db
        .prepare(`WITH candidates AS MATERIALIZED (${candidates})
        INSERT INTO async_minimum_cursors (source,available_at,event_id)
        SELECT s.source,COALESCE(c.available_at,0),COALESCE(c.id,'')
        FROM (SELECT 'core' AS source UNION ALL SELECT 'plugin') s LEFT JOIN candidates c ON c.source=s.source
        WHERE ${gate} ON CONFLICT(source) DO UPDATE SET available_at=excluded.available_at,event_id=excluded.event_id`)
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
        CASE source WHEN 'core' THEN (SELECT ${canonicalSearch} FROM outbox e ${timelineJoin} WHERE e.id=async_deliveries.event_id) ELSE 0 END AS search_eligible,
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
    claimedSearch = null;
    searchDay = null;
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
      const allocation = {
        reads: SEARCH_MINIMUM_BUDGET.indexReads,
        writes: 8 + SEARCH_MINIMUM_BUDGET.indexWritesPerDocument,
        nowMs: Date.now(),
      };
      const { day } = searchBudgetOptions(allocation);
      const meter = searchMeter(db, allocation.reads, allocation.writes, 2);
      // This source statement has its search slot checked before the whole batch.
      meter.before(1);
      const result = await db.batch<Row>([
        reservation(db, now, admissionToken),
        ...claimStatements(now, token, true, admissionToken),
        db
          .prepare(`WITH candidate AS MATERIALIZED (
          SELECT e.project_id,e.aggregate_id,t.aggregate_revision FROM async_deliveries d
          JOIN outbox e ON e.id=d.event_id AND d.source='core' ${timelineJoin}
          WHERE d.delivery_id=(SELECT delivery_id FROM async_deliveries WHERE state='pending' AND available_at<=? ORDER BY available_at,delivery_id LIMIT 1)
          AND d.work_token=? AND d.work_until>? AND d.publish_token=? AND d.publish_until>?
          AND EXISTS (SELECT 1 FROM async_minimum_budget WHERE id=1 AND reservation_token=?) AND ${canonicalSearch}=1)
          INSERT INTO search_budget(id,day,reads,writes) SELECT 1,?,?,? WHERE changes()=1 AND EXISTS (SELECT 1 FROM candidate)
          ${searchBudgetConflictSql} RETURNING id,
          (SELECT json_object('id',i.id,'revision',i.revision,'title',i.title,'body_text',CASE WHEN i.body_text IS NULL THEN NULL ELSE '' END,'body_text_version',i.body_text_version,'moderation',i.moderation,'deleted_at',i.deleted_at)
            FROM issues i JOIN candidate c ON c.project_id=i.project_id AND c.aggregate_id=i.id AND c.aggregate_revision=i.revision) AS source`)
          .bind(
            now,
            token,
            now,
            token,
            now,
            admissionToken,
            day,
            allocation.reads,
            allocation.writes,
          ),
      ]);
      const rows = result.at(-2)?.results ?? [];
      remember(rows[0] ?? null, token);
      if (cached?.search_eligible === 1) {
        claimedSearch = {
          result: result.at(-1)! as unknown as D1Result<{
            id: number;
            source: string | null;
          }>,
          meter,
        };
        searchDay = day;
      }
      return {
        admitted: result[0]!.results.length === 1,
        references: refsOf(rows),
      };
    },
    /** Only an exact validated source lookup may use the immutable claim witness. */
    searchStore(): SearchIndexStore {
      const search = createD1SearchIndexStore(db, (query) => {
        if (
          !claimedSearch ||
          query.tier !== 'cloudflare-minimum' ||
          !query.event ||
          query.limit !== 1 ||
          query.projectId !== cached?.project_id ||
          query.event.issueId !== cached.aggregate_id ||
          query.event.revision !== Number(cached.aggregate_revision) ||
          searchDay !== Math.floor(Date.now() / 86400000)
        )
          return null;
        const admission = claimedSearch;
        claimedSearch = null;
        return admission;
      });
      return {
        ...search,
        async revisionOf(projectId, issueId, mutationId) {
          assertId(projectId);
          assertId(issueId);
          assertId(mutationId);
          if (
            cached?.source === 'core' &&
            cached.search_eligible === 1 &&
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
