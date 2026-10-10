import type {
  D1Database,
  D1PreparedStatement,
} from '@cloudflare/workers-types';

export function countD1Calls(db: D1Database) {
  let calls = 0,
    statements = 0;
  const originals = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const wrap = (raw: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(raw, {
      get(target, key) {
        if (key === 'bind')
          return (...values: unknown[]) => wrap(target.bind(...values));
        const member = Reflect.get(target, key);
        if (key === 'all' || key === 'run' || key === 'first')
          return (...args: unknown[]) => {
            calls++;
            statements++;
            return member.apply(target, args);
          };
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
    originals.set(proxy, raw);
    return proxy;
  };
  return {
    calls: () => calls,
    statements: () => statements,
    db: {
      prepare: (sql: string) => wrap(db.prepare(sql)),
      batch: (items: D1PreparedStatement[]) => {
        calls++;
        statements += items.length;
        return db.batch(items.map((item) => originals.get(item) ?? item));
      },
    } as D1Database,
  };
}
