import type {
  D1Database,
  D1PreparedStatement,
  R2Bucket,
} from '@cloudflare/workers-types';
import { MINIMUM_ASYNC_LIMITS, AsyncError } from '@hyperbug/application';

/** Count before I/O, including every SQL statement in an atomic batch. */
export function minimumInvocationBudget() {
  let queries = 0,
    subrequests = 0,
    reads = 0,
    writes = 0,
    reporting = false;
  const take = (sql = 0, external = 0) => {
    if (
      queries + sql >
        (reporting
          ? MINIMUM_ASYNC_LIMITS.queries
          : MINIMUM_ASYNC_LIMITS.queries - 5) ||
      subrequests + sql + external >
        (reporting
          ? MINIMUM_ASYNC_LIMITS.subrequests
          : MINIMUM_ASYNC_LIMITS.subrequests - 5)
    )
      throw new AsyncError('transient');
    queries += sql;
    subrequests += sql + external;
  };
  const result = (value: unknown) => {
    for (const item of Array.isArray(value) ? value : [value]) {
      const meta = (
        item as { meta?: { rows_read?: number; rows_written?: number } }
      )?.meta;
      reads += meta?.rows_read ?? 0;
      writes += meta?.rows_written ?? 0;
    }
    if (
      reads > MINIMUM_ASYNC_LIMITS.invocationReads ||
      writes > MINIMUM_ASYNC_LIMITS.invocationWrites
    )
      throw new AsyncError('transient');
    return value;
  };
  const originals = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const statement = (raw: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = new Proxy(raw, {
      get(target, key) {
        if (key === 'bind')
          return (...values: unknown[]) => statement(target.bind(...values));
        if (key === 'first')
          return async (column?: string) => {
            take(1);
            const value = await target.all<Record<string, unknown>>();
            result(value);
            const row = value.results[0];
            return row ? (column === undefined ? row : row[column]) : null;
          };
        if (key === 'raw')
          return () => {
            throw new AsyncError('unsupported');
          };
        if (['run', 'all'].includes(String(key)))
          return async (...args: unknown[]) => {
            take(1);
            return result(await Reflect.get(target, key).apply(target, args));
          };
        const member = Reflect.get(target, key);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
    originals.set(wrapped, raw);
    return wrapped;
  };
  return {
    db(raw: D1Database): D1Database {
      return new Proxy(raw, {
        get(target, key) {
          if (key === 'prepare')
            return (sql: string) => statement(target.prepare(sql));
          if (key === 'batch')
            return async (items: D1PreparedStatement[]) => {
              take(items.length);
              return result(
                await target.batch(
                  items.map((item) => originals.get(item) ?? item),
                ),
              );
            };
          if (key === 'exec' || key === 'withSession')
            return () => {
              throw new AsyncError('unsupported');
            };
          const member = Reflect.get(target, key);
          return typeof member === 'function' ? member.bind(target) : member;
        },
      });
    },
    bucket(raw: R2Bucket): R2Bucket {
      return new Proxy(raw, {
        get(target, key) {
          const member = Reflect.get(target, key);
          return typeof member === 'function'
            ? (...args: unknown[]) => {
                take(0, 1);
                return member.apply(target, args);
              }
            : member;
        },
      });
    },
    fetch(request: Request) {
      take(0, 1);
      return fetch(request);
    },
    diagnostics() {
      reporting = true;
    },
    snapshot() {
      return { queries, subrequests, reads, writes };
    },
  };
}
