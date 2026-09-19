import { mkdtempSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

// Only creates a new private cluster; never connects to or stops an existing database.
const bin =
  process.env.PG_BIN ??
  (existsSync('/opt/homebrew/opt/postgresql@18/bin/postgres')
    ? '/opt/homebrew/opt/postgresql@18/bin'
    : '');
const executable = (name) => (bin ? join(bin, name) : name);
const version = execFileSync(executable('postgres'), ['--version'], {
  encoding: 'utf8',
}).trim();
if (!/PostgreSQL\) 18\./.test(version))
  throw new Error('Tests require PostgreSQL 18.x; set PG_BIN.');
const root = mkdtempSync(join(tmpdir(), 'hyperbug-pg-'));
chmodSync(root, 0o700);
const data = join(root, 'data');
let started = false;
try {
  execFileSync(
    executable('initdb'),
    [
      '-D',
      data,
      '--auth=trust',
      '--no-locale',
      '--encoding=UTF8',
      '--username=hyperbug_test',
    ],
    { stdio: 'pipe' },
  );
  execFileSync(
    executable('pg_ctl'),
    [
      '-D',
      data,
      '-l',
      join(root, 'postgres.log'),
      '-o',
      `-F -k '${root}' -h '' -p 5432`,
      '-w',
      'start',
    ],
    { stdio: 'pipe' },
  );
  started = true;
  console.log(
    `${version}; private Unix socket test cluster owned by ${userInfo().username}`,
  );
  const command = process.argv.slice(2);
  if (!command.length)
    throw new Error(
      'Pass a test command, for example: node tooling/postgres-test-cluster.mjs node node_modules/vitest/vitest.mjs run --project postgres',
    );
  const child = spawn(command[0], command.slice(1), {
    stdio: 'inherit',
    env: {
      ...process.env,
      PGHOST: root,
      PGPORT: '5432',
      PGUSER: 'hyperbug_test',
      PGDATABASE: 'postgres',
      HYPERBUG_TEST_POSTGRES: '1',
    },
  });
  const interrupt = () => child.kill('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (result) => resolve(result ?? 1));
  });
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', interrupt);
  process.exitCode = code;
} finally {
  if (started)
    execFileSync(
      executable('pg_ctl'),
      ['-D', data, '-m', 'fast', '-w', 'stop'],
      { stdio: 'pipe' },
    );
  rmSync(root, { recursive: true, force: true });
}
