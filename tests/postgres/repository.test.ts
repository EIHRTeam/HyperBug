import { migratePostgres } from '../../tooling/migrate-postgres.ts';
import { mvpSchemaContract } from '../fixtures/mvp-schema-contract.ts';
import { afterAll, beforeAll, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { createPostgresRepository } from '@hyperbug/database-postgres';
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
let pool: Pool;
let harness: RepositoryHarness;
let measuredQueries: () => string[];
beforeAll(async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error(
      'Use pnpm test:postgres to start an isolated PostgreSQL 18 cluster.',
    );
  pool = new Pool({ max: 12 });
  const queries = vi.spyOn(pool, 'query');
  measuredQueries = () => queries.mock.calls.map(([sql]) => String(sql));
  const migrations = await migrationStatements('postgres');
  const apply = async (statements: string[]) => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      for (const sql of statements) await db.query(sql);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  };
  const foundation = migrations[0];
  if (!foundation) throw new Error('Foundation migration is missing');
  await apply(foundation.statements);
  harness = {
    repository: createPostgresRepository(pool),
    query: async (sql, values = []) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    },
  };
  verifyUpgrade = await seedPreviousSchema(harness);
  for (const migration of migrations.slice(1))
    await apply(migration.statements);
});
afterAll(async () => {
  await pool?.end();
});
repositoryContract(() => harness);

it('upgrades 0000 with linked aggregates and receipts intact', async () => {
  await verifyUpgrade();
});
it('migrates a fresh database and protects history from truncation', async () => {
  await pool.query('CREATE DATABASE hyperbug_fresh');
  const fresh = new Pool({ database: 'hyperbug_fresh' });
  try {
    expect((await migratePostgres(fresh)).pending).toHaveLength(5);
    expect((await migratePostgres(fresh, true)).applied).toHaveLength(5);
    expect(await migratePostgres(fresh, true)).toEqual({
      applied: [],
      pending: [],
    });
    expect(
      (
        await fresh.query(
          "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name != 'hyperbug_schema_migrations'",
        )
      ).rows[0].count,
    ).toBe(25);
    await expect(fresh.query('TRUNCATE audit_events')).rejects.toThrow(
      'append-only',
    );
    await expect(
      fresh.query(
        "INSERT INTO issue_forms (id, project_id, name) VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'Missing project')",
      ),
    ).rejects.toThrow();
    await fresh.query(
      "UPDATE hyperbug_schema_migrations SET checksum = 'invalid' WHERE name = '0000_foundation'",
    );
    await expect(migratePostgres(fresh, true)).rejects.toThrow(
      'immutable expected prefix',
    );
  } finally {
    await fresh.end();
    await pool.query('DROP DATABASE hyperbug_fresh');
  }
});

it('uses bounded indexed list and detail queries with 4000 issues', async () => {
  await measureRepositoryQueries(harness, 'postgres', measuredQueries);
}, 30000);

mvpSchemaContract(() => harness);

it('rolls back a rejected upgrade and permits retry after explicit data repair', async () => {
  await pool.query('CREATE DATABASE hyperbug_invalid');
  const isolatedPool = new Pool({ database: 'hyperbug_invalid' });
  try {
    const migrations = await migrationStatements('postgres');
    const first = migrations[0];
    const integrity = migrations[1];
    if (!first || !integrity) throw new Error('Migration history missing');
    const apply = async (statements: string[]) => {
      const db = await isolatedPool.connect();
      try {
        await db.query('BEGIN');
        for (const sql of statements) await db.query(sql);
        await db.query('COMMIT');
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      } finally {
        db.release();
      }
    };
    await apply(first.statements);
    const isolated: RepositoryHarness = {
      repository: createPostgresRepository(isolatedPool),
      query: async (sql, values = []) => {
        let index = 0;
        return (
          await isolatedPool.query(
            sql.replace(/\?/g, () => `$${++index}`),
            values,
          )
        ).rows;
      },
    };
    const verify = await verifyRejectedUpgrade(isolated, () =>
      apply(integrity.statements),
    );
    for (const migration of migrations.slice(2))
      await apply(migration.statements);
    await verify();
  } finally {
    await isolatedPool.end();
    await pool.query('DROP DATABASE hyperbug_invalid');
  }
});
