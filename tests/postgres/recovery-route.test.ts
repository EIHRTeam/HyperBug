import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { node } from '@elysia/node';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { createNodeStandardPasswordService } from '../../apps/api-node/src/standard-password.ts';
import { listenNode } from '../../apps/api-node/src/listen.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { postgresNodeBindings } from '../fixtures/postgres-node-bindings.ts';

const databaseName = 'hyperbug_recovery_route_test';
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
const sessionKeys = cryptoFixture();

beforeAll(async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const socketDirectory = process.env.PGHOST;
  const databaseUser = process.env.PGUSER;
  if (!socketDirectory || !databaseUser)
    throw new Error('Private PostgreSQL socket is required');
  bootstrap = new Pool({ max: 1 });
  await bootstrap.query(`CREATE DATABASE ${databaseName}`);
  pool = new Pool({
    host: socketDirectory,
    user: databaseUser,
    database: databaseName,
    max: 2,
  });
  const migrations = await migrationStatements('postgres');
  if (migrations.at(-1)?.name !== '0011_recovery_codes')
    throw new Error('Recovery migration missing');
  for (const migration of migrations) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      for (const statement of migration.statements) await db.query(statement);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-recovery-route-'));
  const keyFile = join(directory, 'abuse.json');
  const tokenKeyFile = join(directory, 'token.json');
  await writeFile(keyFile, abuseKeyFixture(), { mode: 0o600 });
  await writeFile(tokenKeyFile, await sessionKeys.source.read(), {
    mode: 0o600,
  });
  await pool.query(
    "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', $1)",
    [Date.now()],
  );
  configured = configureNodeAbuseAdmission(
    {
      ...postgresNodeBindings(databaseName),
      keyFile,
      keyProviderFile: tokenKeyFile,
    },
    'local',
  );
  const config = {
    ...loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    allowedOrigins: ['http://localhost:5173'],
  };
  listener = await listenNode(
    createApp({
      adapter: node(),
      config,
      telemetry: jsonTelemetry(() => {}),
      ready: (signal) => configured.ready(signal) as Promise<boolean>,
      abuse: configured.abuse,
      registrationStore: configured.registrationStore,
      passwordStore: configured.passwordStore,
      sessionStore: configured.sessionStore,
      recoveryStore: configured.recoveryStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  base = listener.url;
  config.allowedOrigins.push(base);
});

afterAll(async () => {
  await listener?.close();
  await configured?.close();
  await pool?.end();
  await bootstrap?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await bootstrap?.end();
  if (directory) await rm(directory, { recursive: true, force: true });
});

const login = (handle: string, password: string) =>
  fetch(new URL('/auth/login', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ handle, password }),
  });

it('generates, redeems and rotates single-use recovery codes end to end', async () => {
  const registered = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'recoverable',
      password: 'first-password-123',
    }),
  });
  expect(registered.status).toBe(202);
  const firstLogin = await login('recoverable', 'first-password-123');
  expect(firstLogin.status).toBe(200);
  const cookie = (firstLogin.headers.getSetCookie?.() ?? [])[0] ?? '';
  const pair = cookie.split(';')[0];
  if (pair === undefined) throw new Error('Missing session cookie');

  const unauthenticated = await fetch(new URL('/auth/recovery-codes', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: '{}',
  });
  expect(unauthenticated.status).toBe(401);

  const generated = await fetch(new URL('/auth/recovery-codes', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, cookie: pair },
    body: '{}',
  });
  expect(generated.status).toBe(200);
  const { codes } = (await generated.json()) as { codes: string[] };
  expect(codes).toHaveLength(10);
  for (const code of codes) expect(code).toMatch(/^hb1_[A-Za-z0-9_-]{43}$/);
  const stored = await pool.query('SELECT digest FROM recovery_codes');
  expect(stored.rowCount).toBe(10);
  expect(JSON.stringify(stored.rows)).not.toContain(codes[0]!);

  const wrongCode = await fetch(new URL('/auth/recover', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'recoverable',
      recoveryCode: 'hbbs1_' + 'C'.repeat(43),
      password: 'second-password-456',
    }),
  });
  expect(wrongCode.status).toBe(403);
  expect(wrongCode.headers.get('cache-control')).toBe('no-store');
  const wrongBody = await wrongCode.json();
  expect(wrongBody).toMatchObject({ error: { code: 'RECOVERY_DENIED' } });

  const unknownHandle = await fetch(new URL('/auth/recover', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'nonexistent',
      recoveryCode: codes[0]!,
      password: 'second-password-456',
    }),
  });
  expect(unknownHandle.status).toBe(403);
  expect(await unknownHandle.json()).toMatchObject({
    error: { code: wrongBody.error?.code, message: wrongBody.error?.message },
  });

  const recovered = await fetch(new URL('/auth/recover', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'recoverable',
      recoveryCode: codes[0]!,
      password: 'second-password-456',
    }),
  });
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual({ recovered: true });

  const oldSession = await fetch(new URL('/auth/session', base), {
    headers: { cookie: pair },
  });
  expect(oldSession.status).toBe(401);
  const oldPassword = await login('recoverable', 'first-password-123');
  expect(oldPassword.status).toBe(401);
  const newPassword = await login('recoverable', 'second-password-456');
  expect(newPassword.status).toBe(200);

  const reuse = await fetch(new URL('/auth/recover', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'recoverable',
      recoveryCode: codes[0]!,
      password: 'third-password-789',
    }),
  });
  expect(reuse.status).toBe(403);

  const secondLogin = await login('recoverable', 'second-password-456');
  const secondCookie = (secondLogin.headers.getSetCookie?.() ?? [])[0] ?? '';
  const secondPair = secondCookie.split(';')[0];
  if (secondPair === undefined) throw new Error('Missing session cookie');
  const regenerated = await fetch(new URL('/auth/recovery-codes', base), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: base,
      cookie: secondPair,
    },
    body: '{}',
  });
  expect(regenerated.status).toBe(200);
  const { codes: newCodes } = (await regenerated.json()) as { codes: string[] };
  expect(newCodes).toHaveLength(10);
  const rows = await pool.query(
    'SELECT generation, count(*)::int AS total FROM recovery_codes GROUP BY generation',
  );
  expect(rows.rows).toEqual([{ generation: 2, total: 10 }]);

  const staleCode = await fetch(new URL('/auth/recover', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'recoverable',
      recoveryCode: codes[1]!,
      password: 'third-password-789',
    }),
  });
  expect(staleCode.status).toBe(403);

  const freshRedeem = await fetch(new URL('/auth/recover', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'recoverable',
      recoveryCode: newCodes[0]!,
      password: 'third-password-789',
    }),
  });
  expect(freshRedeem.status).toBe(200);
});
