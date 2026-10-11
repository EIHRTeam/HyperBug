import { execFileSync } from 'node:child_process';
import { chmod, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { expect } from 'vitest';

/* eslint-disable no-await-in-loop -- Bounded owned-table verification preserves exact per-table result attribution. */
/** Basic current-schema backup drill in the existing private cluster; never restores over the source. */
export async function verifyAcceptanceRestore(
  source: Pool,
  database: string,
  directory: string,
) {
  const bin = process.env.PG_BIN ?? '/opt/homebrew/opt/postgresql@18/bin';
  const dump = join(directory, 'acceptance.dump'),
    target = database + '_restore';
  const admin = new Pool({ max: 1 });
  let restored: Pool | undefined;
  let created = false;
  let report: unknown;
  const t = performance.now();
  try {
    execFileSync(
      join(bin, 'pg_dump'),
      ['--format=custom', '--file', dump, '--dbname', database],
      { stdio: 'pipe' },
    );
    await chmod(dump, 0o600);
    await admin.query(`CREATE DATABASE ${target} TEMPLATE template0`);
    created = true;
    execFileSync(
      join(bin, 'pg_restore'),
      ['--exit-on-error', '--single-transaction', '--dbname', target, dump],
      { stdio: 'pipe' },
    );
    restored = new Pool({
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      database: target,
      max: 1,
    });
    const tables = (
      await source.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
      )
    ).rows as { tablename: string }[];
    const counts: Record<string, number> = {};
    for (const { tablename } of tables) {
      if (!/^[a-z_]+$/.test(tablename)) throw Error('Unexpected fixture table');
      const a = await source.query(
          `SELECT COUNT(*) AS count FROM "${tablename}"`,
        ),
        b = await restored.query(
          `SELECT COUNT(*) AS count FROM "${tablename}"`,
        );
      expect(b.rows).toEqual(a.rows);
      counts[tablename] = Number(a.rows[0].count);
    }
    const snapshot =
      'SELECT id,number,title,body,revision,author_id FROM issues ORDER BY id';
    expect((await restored.query(snapshot)).rows).toEqual(
      (await source.query(snapshot)).rows,
    );
    const constraints =
      "SELECT conname,contype,convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname";
    expect((await restored.query(constraints)).rows).toEqual(
      (await source.query(constraints)).rows,
    );
    const elapsedMs = performance.now() - t;
    report = {
      recordedAt: new Date().toISOString(),
      profile: 'real isolated local PostgreSQL18.6',
      method:
        'pg_dump custom; new template0 database; pg_restore single-transaction exit-on-error; exact counts/all canonical issue columns/constraint states',
      tables: tables.length,
      counts,
      elapsedMs,
      limitations:
        'basic owned fixture database only; no production recovery/RTO/RPO/blob/secret-manager drill',
      cleanup:
        'restored database dropped, dump removed and private cluster teardown owned by orchestrator',
    };
  } finally {
    await restored?.end();
    if (created) await admin.query(`DROP DATABASE ${target}`);
    await admin.end();
    await rm(dump, { force: true });
  }
  await writeFile(
    'docs/plan/evidence/10-postgres-restore.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
