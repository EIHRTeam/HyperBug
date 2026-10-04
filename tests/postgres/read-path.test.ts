import { it, vi } from 'vitest';
import { Pool } from 'pg';
import {
  createPostgresAccountAdministration,
  createPostgresProjectRoleStore,
  createPostgresProjectStore,
  createPostgresRepository,
  createPostgresOAuthStores,
} from '@hyperbug/database-postgres';
import { migrationStatements } from '../fixtures/migrations.ts';
import { readPathContract } from '../fixtures/read-path-contract.ts';

it('reuses PostgreSQL authorization facts within a request and reloads revoked facts', async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const bootstrap = new Pool({ max: 1 });
  const database = 'hyperbug_read_path_test';
  let pool: Pool | undefined;
  try {
    await bootstrap.query(`CREATE DATABASE ${database}`);
    pool = new Pool({ database, max: 4 });
    for (const migration of await migrationStatements('postgres')) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const sql of migration.statements) await client.query(sql);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    const readyPool = pool;
    const spy = vi.spyOn(readyPool, 'query');
    const measure = async <T>(run: () => Promise<T>) => {
      const offset = spy.mock.calls.length;
      const value = await run();
      return {
        value,
        statements: spy.mock.calls.slice(offset).map((args) => String(args[0])),
      };
    };
    await readPathContract(
      async (sql, values = []) => {
        let index = 0;
        return (
          await readyPool.query(
            sql.replace(/\?/g, () => `$${++index}`),
            values,
          )
        ).rows;
      },
      {
        administration: createPostgresAccountAdministration(pool),
        roleStore: createPostgresProjectRoleStore(pool),
        projects: createPostgresProjectStore(pool),
        issues: createPostgresRepository(pool),
        tokenStore: createPostgresOAuthStores(pool),
      },
      measure,
    );
  } finally {
    await pool?.end();
    await bootstrap.query(`DROP DATABASE IF EXISTS ${database}`);
    await bootstrap.end();
  }
});
