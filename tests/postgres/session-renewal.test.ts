import { it } from 'vitest';
import { Pool } from 'pg';
import { createPostgresAccountSessionStore } from '@hyperbug/database-postgres';
import { migrationStatements } from '../fixtures/migrations.ts';
import { sessionRenewalContract } from '../fixtures/session-renewal-contract.ts';

it('renews PostgreSQL sessions conditionally and validates revocation on every request', async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const bootstrap = new Pool({ max: 1 });
  const database = 'hyperbug_session_renewal_test';
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
    await sessionRenewalContract(async (sql, values = []) => {
      let index = 0;
      return (
        await readyPool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    }, createPostgresAccountSessionStore(pool));
  } finally {
    await pool?.end();
    await bootstrap.query(`DROP DATABASE IF EXISTS ${database}`);
    await bootstrap.end();
  }
});
