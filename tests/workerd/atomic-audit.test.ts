import { auditEvent } from '../../packages/security/src/index.ts';
import { expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  createD1AccountAdministration,
  createD1AccountRecoveryStore,
  createD1StaffEnrollmentStore,
  createD1ProjectRoleStore,
  createD1PluginRegistryStore,
  createD1PluginSettingsStore,
  createD1AuditRepository,
  createD1AccountSessionStore,
} from '@hyperbug/database-d1';
import { migrationStatements } from '../fixtures/migrations.ts';
import { boundedD1 } from '../fixtures/d1-bind-guard.ts';
import { atomicAuditContract } from '../fixtures/atomic-audit-contract.ts';

it('rolls back every audited administration mutation on D1', async () => {
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
    await atomicAuditContract(
      async (sql, values = []) =>
        (
          await db
            .prepare(sql)
            .bind(...values)
            .all<Record<string, unknown>>()
        ).results,
      {
        sessions: createD1AccountSessionStore(db),
        administration: createD1AccountAdministration(db),
        recovery: createD1AccountRecoveryStore(db),
        enrollment: createD1StaffEnrollmentStore(db),
        roles: createD1ProjectRoleStore(db),
        registry: createD1PluginRegistryStore(db),
        settings: createD1PluginSettingsStore(db),
        append: (event) =>
          createD1AuditRepository(db).append(
            auditEvent(event),
            new AbortController().signal,
          ),
      },
    );
    expect(
      (await db.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
  } finally {
    await mf.dispose();
  }
});
