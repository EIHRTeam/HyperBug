import { auditEvent } from '../../packages/security/src/index.ts';
import { it } from 'vitest';
import { Pool } from 'pg';
import {
  createPostgresAccountAdministration,
  createPostgresAccountRecoveryStore,
  createPostgresStaffEnrollmentStore,
  createPostgresProjectRoleStore,
  createPostgresPluginRegistryStore,
  createPostgresPluginSettingsStore,
  createPostgresAuditRepository,
  createPostgresAccountSessionStore,
} from '@hyperbug/database-postgres';
import { migrationStatements } from '../fixtures/migrations.ts';
import { atomicAuditContract } from '../fixtures/atomic-audit-contract.ts';

it('rolls back every audited administration mutation on PostgreSQL', async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const bootstrap = new Pool({ max: 1 });
  const database = 'hyperbug_atomic_audit_test';
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
    await atomicAuditContract(
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
        sessions: createPostgresAccountSessionStore(pool),
        administration: createPostgresAccountAdministration(pool),
        recovery: createPostgresAccountRecoveryStore(pool),
        enrollment: createPostgresStaffEnrollmentStore(pool),
        roles: createPostgresProjectRoleStore(pool),
        registry: createPostgresPluginRegistryStore(pool),
        settings: createPostgresPluginSettingsStore(pool),
        append: (event) =>
          createPostgresAuditRepository(readyPool).append(
            auditEvent(event),
            new AbortController().signal,
          ),
      },
    );
  } finally {
    await pool?.end();
    await bootstrap.query(`DROP DATABASE IF EXISTS ${database}`);
    await bootstrap.end();
  }
});
