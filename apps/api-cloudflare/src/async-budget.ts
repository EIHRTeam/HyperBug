import type {
  D1Database,
  D1PreparedStatement,
  R2Bucket,
} from '@cloudflare/workers-types';
import { MINIMUM_ASYNC_LIMITS, AsyncError } from '@hyperbug/application/async';

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
    const wrapped = {
      bind: (...values: unknown[]) => statement(raw.bind(...values)),
      async first<T>(column?: string) {
        take(1);
        const value = await raw.all<Record<string, unknown>>();
        result(value);
        const row = value.results[0];
        return (
          row ? (column === undefined ? row : row[column]) : null
        ) as T | null;
      },
      async run<T>() {
        take(1);
        return result(await raw.run<T>());
      },
      async all<T>() {
        take(1);
        return result(await raw.all<T>());
      },
      raw() {
        throw new AsyncError('unsupported');
      },
    } as D1PreparedStatement;
    originals.set(wrapped, raw);
    return wrapped;
  };
  return {
    db(raw: D1Database): D1Database {
      return {
        prepare: (sql: string) => statement(raw.prepare(sql)),
        async batch<T>(items: D1PreparedStatement[]) {
          take(items.length);
          return result(
            await raw.batch<T>(
              items.map((item) => originals.get(item) ?? item),
            ),
          );
        },
        exec() {
          throw new AsyncError('unsupported');
        },
        withSession() {
          throw new AsyncError('unsupported');
        },
        dump: () => raw.dump(),
      } as D1Database;
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
