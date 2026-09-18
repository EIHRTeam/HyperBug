import { build } from 'esbuild';
import type { IssueRepository } from '@hyperbug/application';
import { mvpSchemaContract } from '../fixtures/mvp-schema-contract.ts';
import { afterAll, beforeAll, it, expect } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createD1Repository } from '@hyperbug/database-d1';
import type { D1Database } from '@cloudflare/workers-types';
import {
  repositoryContract,
  measureRepositoryQueries,
  type RepositoryHarness,
} from '../fixtures/repository-contract.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import {
  seedPreviousSchema,
  verifyRejectedUpgrade,
} from '../fixtures/migration-contract.ts';
let verifyUpgrade: () => Promise<void>;
let mf: Miniflare;
let harness: RepositoryHarness;
let measuredQueries: () => string[];
beforeAll(async () => {
  await build({
    entryPoints: ['tests/fixtures/database-worker.ts'],
    outfile: 'dist/database-worker.mjs',
    bundle: true,
    platform: 'neutral',
    format: 'esm',
    target: 'es2023',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['cloudflare:*', 'node:*'],
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [{ type: 'ESModule', path: 'dist/database-worker.mjs' }],
      compatibilityDate: '2026-09-16',
      d1Databases: ['DB', 'FRESH', 'INVALID'],
    }),
  );
  const db = await mf.getD1Database('DB');
  const queries: string[] = [];
  measuredQueries = () => queries;
  const base = await mf.ready;
  async function call<T>(
    method: keyof IssueRepository,
    input: unknown,
  ): Promise<T> {
    const response = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method, input }),
    });
    const payload = (await response.json()) as {
      value: T;
      queries: string[];
      error?: { code: string };
    };
    queries.push(...payload.queries);
    if (payload.error)
      throw Object.assign(new Error(payload.error.code), {
        code: payload.error.code,
      });
    return payload.value;
  }
  const repository: IssueRepository = {
    createIssue: (input) => call('createIssue', input),
    editIssue: (input) => call('editIssue', input),
    getIssue: (projectId, id) => call('getIssue', { projectId, id }),
    listIssues: (input) => call('listIssues', input),
  };
  const migrations = await migrationStatements('d1');
  const foundation = migrations[0];
  if (!foundation) throw new Error('Foundation migration is missing');
  await db.batch(foundation.statements.map((sql) => db.prepare(sql)));
  harness = {
    repository,
    query: async (sql, values = []) =>
      (
        await db
          .prepare(sql)
          .bind(...values)
          .all<Record<string, unknown>>()
      ).results,
  };
  verifyUpgrade = await seedPreviousSchema(harness);
  for (const migration of migrations.slice(1))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
});
afterAll(async () => {
  await mf?.dispose();
});
repositoryContract(() => harness);

it('upgrades 0000 with linked aggregates and receipts intact', async () => {
  await verifyUpgrade();
});
it('migrates a fresh database and keeps foreign keys enabled', async () => {
  const db = await mf.getD1Database('FRESH');
  for (const migration of await migrationStatements('d1'))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
  expect(await db.prepare('PRAGMA foreign_key_check').all()).toMatchObject({
    results: [],
  });
  expect(await db.prepare('PRAGMA foreign_keys').first('foreign_keys')).toBe(1);
  expect(
    await db
      .prepare(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger'",
      )
      .first('count'),
  ).toBe(12);
});
it('rejects INSERT OR REPLACE history rewrites', async () => {
  for (const table of ['audit_events', 'timeline_events']) {
    await expect(
      harness.query(
        `INSERT OR REPLACE INTO ${table} SELECT * FROM ${table} LIMIT 1`,
      ),
    ).rejects.toThrow('append-only');
  }
});

it('uses bounded indexed list and detail queries with 4000 issues', async () => {
  await measureRepositoryQueries(harness, 'd1', measuredQueries);
}, 30000);

mvpSchemaContract(() => harness);

it('rolls back a rejected upgrade and permits retry after explicit data repair', async () => {
  const db = await mf.getD1Database('INVALID');
  const migrations = await migrationStatements('d1');
  const first = migrations[0];
  const integrity = migrations[1];
  if (!first || !integrity) throw new Error('Migration history missing');
  const apply = (statements: string[]) =>
    db.batch(statements.map((sql) => db.prepare(sql)));
  await apply(first.statements);
  const isolated: RepositoryHarness = {
    repository: createD1Repository(db as unknown as D1Database),
    query: async (sql, values = []) =>
      (
        await db
          .prepare(sql)
          .bind(...values)
          .all<Record<string, unknown>>()
      ).results,
  };
  const verify = await verifyRejectedUpgrade(isolated, () =>
    apply(integrity.statements),
  );
  for (const migration of migrations.slice(2))
    await apply(migration.statements);
  await verify();
});
