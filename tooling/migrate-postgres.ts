import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { migrationStatements } from './migrations.ts';

export async function migratePostgres(pool: Pool, apply = false) {
  const migrations = await migrationStatements('postgres');
  const db = await pool.connect();
  let locked = false;
  try {
    const version = Number(
      (await db.query('SHOW server_version_num')).rows[0]?.server_version_num,
    );
    if (Math.floor(version / 10000) !== 18)
      throw new Error('Migrations require PostgreSQL 18.x');
    if (apply) {
      await db.query('SELECT pg_advisory_lock(815372614)');
      locked = true;
      await db.query(
        'CREATE TABLE IF NOT EXISTS hyperbug_schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
      );
    }
    const exists = (
      await db.query(
        "SELECT to_regclass('public.hyperbug_schema_migrations') IS NOT NULL AS exists",
      )
    ).rows[0]?.exists;
    const history: { name: string; checksum: string }[] = exists
      ? (
          await db.query(
            'SELECT name, checksum FROM hyperbug_schema_migrations ORDER BY name',
          )
        ).rows
      : [];
    for (const [index, entry] of history.entries()) {
      if (
        migrations[index]?.name !== entry.name ||
        migrations[index]?.checksum !== entry.checksum
      )
        throw new Error(
          'Migration history is not the immutable expected prefix; investigate before continuing',
        );
    }
    const pending = migrations.slice(history.length);
    if (apply)
      for (const migration of pending) {
        try {
          await db.query('BEGIN');
          for (const statement of migration.statements)
            await db.query(statement);
          await db.query(
            'INSERT INTO hyperbug_schema_migrations (name, checksum) VALUES ($1, $2)',
            [migration.name, migration.checksum],
          );
          await db.query('COMMIT');
        } catch (error) {
          await db.query('ROLLBACK');
          throw error;
        }
      }
    return {
      applied: apply ? pending.map((m) => m.name) : [],
      pending: apply ? [] : pending.map((m) => m.name),
    };
  } finally {
    try {
      if (locked) await db.query('SELECT pg_advisory_unlock(815372614)');
    } finally {
      db.release();
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (
    process.argv.slice(2).some((arg) => !['--apply', '--status'].includes(arg))
  )
    throw new Error('Use --status (read-only default) or --apply');
  const connectionString = process.env.HYPERBUG_MIGRATION_DATABASE_URL;
  if (!connectionString && process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error(
      'Set HYPERBUG_MIGRATION_DATABASE_URL explicitly; test clusters use their isolated PG environment',
    );
  const pool = new Pool(connectionString ? { connectionString } : {});
  try {
    console.log(
      JSON.stringify(
        await migratePostgres(pool, process.argv.includes('--apply')),
      ),
    );
  } finally {
    await pool.end();
  }
}
