import { it } from 'vitest';
import { Pool } from 'pg';
import { createPostgresKeyRegistry } from '@hyperbug/database-postgres';
import { migrationStatements } from '../fixtures/migrations.ts';
import { keyMaterialContract } from '../fixtures/key-material-contract.ts';

it('reuses key material across PostgreSQL requests and applies fresh purpose revocation', async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const bootstrap = new Pool({ max: 1 });
  const database = 'hyperbug_key_material_test';
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
    await keyMaterialContract(async (sql, values = []) => {
      let index = 0;
      return (
        await readyPool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    }, createPostgresKeyRegistry(pool));
  } finally {
    await pool?.end();
    await bootstrap.query(`DROP DATABASE IF EXISTS ${database}`);
    await bootstrap.end();
  }
});
