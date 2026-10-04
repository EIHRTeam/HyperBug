import type {
  D1Database,
  D1DatabaseSession,
  D1PreparedStatement,
} from '@cloudflare/workers-types';

/**
 * Cloudflare D1 rejects a statement with more than 100 bound parameters, but
 * the local workerd/Miniflare SQLite accepts far more. Wrapping a test binding
 * with this guard makes every repository and route test fail at the bind call
 * that would fail on the real service.
 */
export const d1MaxBoundParameters = 100;

type Preparer = Pick<D1Database, 'prepare' | 'batch'>;

function guardPreparer<T extends Preparer>(target: T): T {
  const originals = new WeakMap<object, D1PreparedStatement>();
  const guard = (statement: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(object, key) {
        if (key === 'bind')
          return (...values: unknown[]) => {
            if (values.length > d1MaxBoundParameters)
              throw new Error(
                `D1 statement binds ${values.length} parameters (limit ${d1MaxBoundParameters})`,
              );
            return guard(object.bind(...values));
          };
        const value = Reflect.get(object, key, object) as unknown;
        return typeof value === 'function' ? value.bind(object) : value;
      },
    });
    originals.set(proxy, statement);
    return proxy;
  };
  const unwrap = (statements: D1PreparedStatement[]) =>
    statements.map((statement) => originals.get(statement) ?? statement);
  return new Proxy(target, {
    get(object, key) {
      if (key === 'prepare') return (sql: string) => guard(object.prepare(sql));
      if (key === 'batch')
        return (statements: D1PreparedStatement[]) =>
          object.batch(unwrap(statements));
      if (key === 'withSession')
        return (...args: unknown[]) =>
          guardPreparer(
            (
              object as unknown as {
                withSession: (...a: unknown[]) => D1DatabaseSession;
              }
            ).withSession(...args),
          );
      const value = Reflect.get(object, key, object) as unknown;
      return typeof value === 'function' ? value.bind(object) : value;
    },
  });
}

/** Test-only D1 binding that enforces the production bound-parameter limit. */
export function boundedD1(db: D1Database): D1Database {
  return guardPreparer(db);
}
