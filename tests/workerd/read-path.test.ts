import { expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  createD1AccountAdministration,
  createD1ProjectRoleStore,
  createD1ProjectStore,
  createD1Repository,
  createD1OAuthStores,
} from '@hyperbug/database-d1';
import { migrationStatements } from '../fixtures/migrations.ts';
import { boundedD1 } from '../fixtures/d1-bind-guard.ts';
import { readPathContract } from '../fixtures/read-path-contract.ts';

it('reuses D1 authorization facts within a request and reloads revoked facts', async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      script: 'export default { fetch() { return new Response("fixture"); } };',
      modules: true,
      compatibilityDate: '2026-09-16',
      d1Databases: ['DB'],
    }),
  );
  try {
    const db = boundedD1(await mf.getD1Database('DB'));
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const statements: string[] = [];
    const measured = {
      prepare(sql: string) {
        statements.push(sql);
        return db.prepare(sql);
      },
      withSession(mode: 'first-primary') {
        const session = db.withSession(mode);
        return {
          prepare(sql: string) {
            statements.push(sql);
            return session.prepare(sql);
          },
        };
      },
    } as unknown as typeof db;
    const measure = async <T>(run: () => Promise<T>) => {
      const offset = statements.length;
      const value = await run();
      return { value, statements: statements.slice(offset) };
    };
    await readPathContract(
      async (sql, values = []) =>
        (
          await db
            .prepare(sql)
            .bind(...values)
            .all<Record<string, unknown>>()
        ).results,
      {
        administration: createD1AccountAdministration(measured),
        roleStore: createD1ProjectRoleStore(measured),
        projects: createD1ProjectStore(measured),
        issues: createD1Repository(measured),
        tokenStore: createD1OAuthStores(measured),
      },
      measure,
    );
    expect(
      (await db.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
  } finally {
    await mf.dispose();
  }
});
