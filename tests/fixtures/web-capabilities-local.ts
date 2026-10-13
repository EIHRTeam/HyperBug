import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { workerModules } from './worker-modules.ts';
import { migrationStatements } from './migrations.ts';
import { cryptoFixture } from './crypto-scenarios.ts';
import { abuseKeyFixture } from './abuse-key-fixture.ts';

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const address = reservation.address();
if (!address || typeof address === 'string')
  throw new Error('Expected static port');
const port = address.port;
await new Promise<void>((done) => reservation.close(() => done()));
const origin = `http://127.0.0.1:${port}`;
const directory = await mkdtemp(join(tmpdir(), 'hyperbug-web-minimum-'));
let server: ReturnType<typeof spawn> | undefined;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: workerModules('dist/minimum-tier-worker'),
    compatibilityDate: '2026-09-16',
    compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    d1Databases: ['DB'],
    ratelimits: {
      ABUSE_VOLUMETRIC: {
        namespace_id: '703415',
        simple: { limit: 1000, period: 60 },
      },
    },
    bindings: {
      HYPERBUG_ENV: 'local',
      ALLOWED_ORIGINS: origin,
      HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-minimum',
      HYPERBUG_DEGRADATION_ACK: 'minimum-v2',
      HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
      HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
    },
  }),
);
try {
  const api = await mf.ready;
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  await db
    .prepare(
      "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?), ('password-pepper', 'password-pepper-test', 1, 'current', ?)",
    )
    .bind(Date.now(), Date.now())
    .run();
  const instanceResponse = await fetch(new URL('/api/v1/instance', api), {
    headers: { origin },
  });
  if (instanceResponse.status !== 200)
    throw new Error(`Minimum instance failed (${instanceResponse.status})`);
  const instance = await instanceResponse.json();
  await cp('apps/web/dist', directory, { recursive: true });
  await writeFile(
    join(directory, 'config.json'),
    JSON.stringify({
      schemaVersion: 1,
      applicationName: 'Local Minimum acceptance',
      apiBaseUrl: api.origin,
      authBaseUrl: api.origin,
      mediaOrigins: [],
    }),
  );
  server = spawn(
    process.execPath,
    [
      'apps/web/scripts/serve-static.ts',
      `--dir=${directory}`,
      `--port=${port}`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await new Promise<void>((done, fail) => {
    server!.once('error', fail);
    server!.stdout!.once('data', () => done());
    server!.once('exit', (code) =>
      fail(new Error(`Static host exited (${code})`)),
    );
  });
  const options = join(directory, 'options.json');
  await writeFile(
    options,
    JSON.stringify({ origin, apiOrigin: api.origin, instance }),
    { mode: 0o600 },
  );
  const check = spawn(
    process.execPath,
    ['tests/fixtures/web-capabilities-browser.mjs', options],
    { stdio: 'inherit' },
  );
  const code = await new Promise<number | null>((done, fail) => {
    check.once('error', fail);
    check.once('exit', done);
  });
  if (code !== 0) throw new Error('Capability browser check failed');
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  await mf.dispose();
  await rm(directory, { recursive: true, force: true });
  await writeFile(
    resolve('docs/plan/evidence/11-minimum-cleanup.json'),
    JSON.stringify({
      localOnly: true,
      staticChildExited: true,
      miniflareDisposed: true,
      temporaryDirectoryRemoved: true,
    }) + '\n',
  );
  console.log('Local Minimum emulator/static fixture cleaned.');
}
