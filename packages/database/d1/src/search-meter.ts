import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
} from '@cloudflare/workers-types';
import { SearchError } from '@hyperbug/application';
/** Invocation-local accounting; admission is persisted separately before this work. */
export function searchMeter(
  db: D1Database,
  reads: number,
  writes: number,
  statements: number,
) {
  const usage = { rowsRead: 0, rowsWritten: 0, statements: 0 };
  const originals = new WeakMap<object, D1PreparedStatement>();
  const before = (count: number) => {
    if (usage.statements + count > statements)
      throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
    usage.statements += count;
  };
  const account = (result: D1Result) => {
    if (
      !Number.isSafeInteger(result.meta.rows_read) ||
      !Number.isSafeInteger(result.meta.rows_written) ||
      result.meta.rows_read < 0 ||
      result.meta.rows_written < 0
    )
      throw new SearchError('SEARCH_UNAVAILABLE');
    usage.rowsRead += result.meta.rows_read;
    usage.rowsWritten += result.meta.rows_written;
    if (usage.rowsRead > reads || usage.rowsWritten > writes)
      throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
  };
  const wrap = (statement: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = {
      bind: (...values: unknown[]) => wrap(statement.bind(...values)),
      async all<T>() {
        before(1);
        const result = await statement.all<T>();
        account(result);
        return result;
      },
      async run<T>() {
        before(1);
        const result = await statement.run<T>();
        account(result);
        return result;
      },
      async first<T>(column?: string) {
        before(1);
        const result = await statement.all<Record<string, unknown>>();
        account(result);
        const row = result.results[0];
        return (
          row ? (column === undefined ? row : row[column]) : null
        ) as T | null;
      },
    } as D1PreparedStatement;
    originals.set(wrapped, statement);
    return wrapped;
  };
  return {
    usage,
    db: {
      prepare: (sql: string) => wrap(db.prepare(sql)),
      async batch<T>(input: D1PreparedStatement[]) {
        before(input.length);
        const result = await db.batch<T>(
          input.map((statement) => originals.get(statement) ?? statement),
        );
        for (const row of result) account(row);
        return result;
      },
    } as D1Database,
  };
}
