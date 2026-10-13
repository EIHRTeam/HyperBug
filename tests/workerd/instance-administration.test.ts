import { expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createD1AccountAdministration } from '@hyperbug/database-d1';
import { migrationStatements } from '../fixtures/migrations.ts';
import { boundedD1 } from '../fixtures/d1-bind-guard.ts';
import { instanceAdministrationContract } from '../fixtures/instance-administration-contract.ts';

it('keeps one active instance administrator during concurrent D1 suspensions', async () => {
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
    await instanceAdministrationContract(
      async (sql, values = []) =>
        (
          await db
            .prepare(sql)
            .bind(...values)
            .all<Record<string, unknown>>()
        ).results,
      createD1AccountAdministration(db),
    );
    expect(
      (await db.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
  } finally {
    await mf.dispose();
  }
});
