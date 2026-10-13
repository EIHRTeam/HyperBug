import { it } from 'vitest';
import { Pool } from 'pg';
import { createPostgresRateCounterStore } from '@hyperbug/database-postgres';
import { migrationStatements } from '../fixtures/migrations.ts';
import { contentRateContract } from '../fixtures/content-rate-contract.ts';

it('bounds content admission to one PostgreSQL current principal counter', async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const bootstrap = new Pool({ max: 1 });
  const database = 'hyperbug_content_rate_test';
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
    await contentRateContract(
      createPostgresRateCounterStore(pool),
      async (sql) => {
        let index = 0;
        return (
          await readyPool.query(
            sql.replace(/\?/g, () => `$${++index}`),
            [],
          )
        ).rows;
      },
    );
  } finally {
    await pool?.end();
    await bootstrap.query(`DROP DATABASE IF EXISTS ${database}`);
    await bootstrap.end();
  }
});
