import type { D1Database } from '@cloudflare/workers-types';
import {
  MINIMUM_ASYNC_LIMITS,
  taskReference,
  validateTaskReference,
  AsyncError,
  type AsyncStore,
} from '@hyperbug/application';
import { createD1AsyncStore } from './async-processing.ts';
/** Cursor import avoids repeatedly scanning a long prefix of failed source events. */
export function createD1MinimumAsyncStore(db: D1Database) {
  const shared = createD1AsyncStore(db);
  let cached: Record<string, unknown> | null = null,
    claimedToken: string | null = null;
  return {
    async reserve(now: number): Promise<boolean> {
      if (!Number.isSafeInteger(now) || now < 0)
        throw new AsyncError('invalid');
      const day = Math.floor(now / 86400000),
        l = MINIMUM_ASYNC_LIMITS;
      const result = await db
        .prepare(`INSERT INTO async_minimum_budget (id,day,reads,writes) VALUES (1,?,?,?)
        ON CONFLICT(id) DO UPDATE SET day=excluded.day,
          reads=CASE WHEN async_minimum_budget.day<excluded.day THEN excluded.reads ELSE async_minimum_budget.reads+excluded.reads END,
          writes=CASE WHEN async_minimum_budget.day<excluded.day THEN excluded.writes ELSE async_minimum_budget.writes+excluded.writes END
        WHERE async_minimum_budget.day<=excluded.day AND (async_minimum_budget.day<excluded.day OR
          (async_minimum_budget.reads+excluded.reads<=? AND async_minimum_budget.writes+excluded.writes<=?)) RETURNING id`)
        .bind(
          day,
          l.invocationReads,
          l.invocationWrites,
          l.dailyReads,
          l.dailyWrites,
        )
        .all();
      return result.results.length === 1;
    },
    async claim(now: number, token: string, execute = false) {
      if (
        !Number.isSafeInteger(now) ||
        now < 0 ||
        !/^[a-zA-Z0-9-]{1,64}$/.test(token)
      )
        throw new AsyncError('invalid');
      const statements = [
        db.prepare(
          "INSERT INTO async_minimum_cursors (source,available_at,event_id) VALUES ('core',0,''),('plugin',0,'') ON CONFLICT DO NOTHING",
        ),
      ];
      for (const [source, table, key, prefix] of [
        ['core', 'outbox', 'id', 'search-update:'],
        ['plugin', 'plugin_event_outbox', 'event_id', 'plugin-event:'],
      ] as const) {
        const candidate = `SELECT e.${key} AS id,e.available_at,e.created_at FROM ${table} e WHERE e.delivered_at IS NULL AND e.available_at<=?
          AND (e.available_at,e.${key})>(SELECT available_at,event_id FROM async_minimum_cursors WHERE source=?) ORDER BY e.available_at,e.${key} LIMIT 1`;
        statements.push(
          db
            .prepare(`INSERT INTO async_deliveries (delivery_id,source,event_id,created_at,updated_at,available_at)
          SELECT ?||c.id,?,c.id,c.created_at,?,? FROM (${candidate}) c WHERE true ON CONFLICT DO NOTHING`)
            .bind(prefix, source, now, now, now, source),
        );
        statements.push(
          db
            .prepare(`WITH candidate AS MATERIALIZED (${candidate}) UPDATE async_minimum_cursors SET
          available_at=COALESCE((SELECT available_at FROM candidate),0),event_id=COALESCE((SELECT id FROM candidate),'') WHERE source=?`)
            .bind(now, source, source),
        );
      }
      const head =
        "SELECT delivery_id FROM async_deliveries WHERE state='pending' AND available_at<=? ORDER BY available_at,delivery_id LIMIT 1";
      statements.push(
        db
          .prepare(
            `UPDATE async_deliveries SET state='failed',failure='lease-exhausted',updated_at=? WHERE delivery_id=(${head}) AND attempts>=5 AND work_until<=? AND publish_until<=?`,
          )
          .bind(now, now, now, now),
      );
      // Claim execution and its source snapshot in the same atomic batch; no second lease/read round trip.
      statements.push(
        db
          .prepare(`UPDATE async_deliveries SET publish_token=?,publish_until=?,updated_at=? ${execute ? ',work_token=?,work_until=?,attempts=attempts+1' : ''}
        WHERE delivery_id=(${head}) AND attempts<5 AND work_until<=? AND publish_until<=? RETURNING source,event_id,work_until,
        CASE source WHEN 'core' THEN (SELECT event_version FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE (SELECT payload_version FROM plugin_event_outbox e WHERE e.event_id=async_deliveries.event_id) END AS event_version,
        CASE source WHEN 'core' THEN (SELECT payload FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE (SELECT payload FROM plugin_event_outbox e WHERE e.event_id=async_deliveries.event_id) END AS payload,
        CASE source WHEN 'core' THEN (SELECT event_type FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE (SELECT point FROM plugin_event_outbox e WHERE e.event_id=async_deliveries.event_id) END AS event_type,
        CASE source WHEN 'core' THEN (SELECT project_id FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE NULL END AS project_id,
        CASE source WHEN 'core' THEN (SELECT aggregate_id FROM outbox e WHERE e.id=async_deliveries.event_id) ELSE NULL END AS aggregate_id,created_at`)
          .bind(
            token,
            now + 30000,
            now,
            ...(execute ? [token, now + 30000] : []),
            now,
            now,
            now,
          ),
      );
      const result = await db.batch<Record<string, unknown>>(statements);
      cached = execute ? (result.at(-1)?.results[0] ?? null) : null;
      claimedToken = execute ? token : null;
      return (result.at(-1)?.results ?? []).map((row) =>
        taskReference(row.source as 'core' | 'plugin', String(row.event_id)),
      );
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
          const result = await db.batch([
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
          ]);
          return result.at(-1)?.results.length === 1;
        },
      };
    },
  };
}
