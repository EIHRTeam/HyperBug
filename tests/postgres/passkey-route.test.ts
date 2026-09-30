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
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';

const databaseName = 'hyperbug_passkey_route_test';
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
const sessionKeys = cryptoFixture();
let authenticator: Awaited<ReturnType<typeof createFakeAuthenticator>>;

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
  if (migrations.at(-2)?.name !== '0012_webauthn')
    throw new Error('WebAuthn migration missing');
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-passkey-route-'));
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
  const passkeyConfig = {
    rpID: 'localhost',
    rpName: 'HyperBug PoC',
    origin: 'http://placeholder.invalid',
    store: configured.passkeyStores!,
    passwordStore: configured.passwordStore!,
    sessionStore: configured.sessionStore!,
    keyProvider: sessionKeys.provider,
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
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      passkey: passkeyConfig,
    }),
    0,
  );
  base = listener.url;
  config.allowedOrigins.push(base);
  // The relying-party origin must equal the listener origin for ceremonies.
  passkeyConfig.origin = base;
  authenticator = await createFakeAuthenticator('localhost', base);
});

afterAll(async () => {
  await listener?.close();
  await configured?.close();
  await pool?.end();
  await bootstrap?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await bootstrap?.end();
  if (directory) await rm(directory, { recursive: true, force: true });
});

const post = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, ...extra },
    body: JSON.stringify(body),
  });

it('registers a passkey and completes discoverable passkey login', async () => {
  const registered = await post('/api/v1/accounts/register', {
    handle: 'passkeyuser',
    password: 'long-functional-password',
  });
  expect(registered.status).toBe(202);
  const login = await post('/auth/login', {
    handle: 'passkeyuser',
    password: 'long-functional-password',
  });
  expect(login.status).toBe(200);
  const pair = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (pair === undefined) throw new Error('Missing session cookie');

  const optionsResponse = await post(
    '/auth/passkey/register/options',
    {},
    { cookie: pair },
  );
  expect(optionsResponse.status).toBe(200);
  const options = (await optionsResponse.json()) as {
    challenge: string;
    user: { id: string };
  };
  const registration = await authenticator.registration(
    options.challenge,
    Uint8Array.from(Buffer.from(options.user.id.replaceAll('-', ''), 'hex')),
  );
  const verify = await post(
    '/auth/passkey/register',
    { response: registration },
    { cookie: pair },
  );
  expect(verify.status).toBe(200);
  expect(await verify.json()).toEqual({ registered: true });
  const stored = await pool.query(
    'SELECT public_key, counter FROM passkey_credentials',
  );
  expect(stored.rowCount).toBe(1);
  expect((stored.rows[0] as { counter: number }).counter).toBe(0);

  const loginOptions = await post('/auth/passkey/login/options', {});
  expect(loginOptions.status).toBe(200);
  const challenge = ((await loginOptions.json()) as { challenge: string })
    .challenge;
  const assertion = await authenticator.assertion(challenge, 1);
  const passkeyLogin = await post('/auth/passkey/login', {
    response: assertion,
  });
  expect(passkeyLogin.status).toBe(200);
  expect(await passkeyLogin.json()).toEqual({ authenticated: true });
  const cookie = (passkeyLogin.headers.getSetCookie?.() ?? [])[0] ?? '';
  expect(cookie).toMatch(/^__Host-hb_session=/);
  const sessionPair = cookie.split(';')[0];
  if (sessionPair === undefined) throw new Error('Missing session cookie');
  const session = await fetch(new URL('/auth/session', base), {
    headers: { cookie: sessionPair },
  });
  expect(session.status).toBe(200);
  const counter = await pool.query('SELECT counter FROM passkey_credentials');
  expect((counter.rows[0] as { counter: number }).counter).toBe(1);

  const replay = await post('/auth/passkey/login', {
    response: await authenticator.assertion(challenge, 2),
  });
  expect(replay.status).toBe(403);
  expect(await replay.json()).toMatchObject({
    error: { code: 'PASSKEY_DENIED' },
  });
});
