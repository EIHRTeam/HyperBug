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

// 05.2a non-audit scope on the Node/PostgreSQL profile: the plugin registry
// and its management endpoints run the identical shared route surface against
// the PostgreSQL adapter, with recent-authentication enforcement and no
// module-05 audit events.
const databaseName = 'hyperbug_plugin_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'plugins-cli',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
];
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const projectId = crypto.randomUUID();
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
const sessionKeys = cryptoFixture();
let authenticator: Awaited<ReturnType<typeof createFakeAuthenticator>>;
type PasskeyOptions = NonNullable<Parameters<typeof createApp>[0]['passkey']>;
const passkeyConfig: {
  rpID: string;
  rpName: string;
  origin: string;
  store: PasskeyOptions['store'];
  passwordStore: PasskeyOptions['passwordStore'];
  sessionStore: PasskeyOptions['sessionStore'];
  keyProvider: PasskeyOptions['keyProvider'];
} = {
  rpID: 'localhost',
  rpName: 'HyperBug Plugins PoC',
  origin: 'http://placeholder.invalid',
  store: null!,
  passwordStore: null!,
  sessionStore: null!,
  keyProvider: sessionKeys.provider,
};

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

const verifier = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const challengeOf = async (value: string) =>
  btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
      ),
    ),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'plugins-cli',
      redirectUri,
      scope: 'public-api',
      state,
      codeChallenge: await challengeOf(journeyVerifier),
    },
    { cookie },
  );
  expect(authorized.status).toBe(200);
  const code = new URL(
    ((await authorized.json()) as { redirectUri: string }).redirectUri,
  ).searchParams.get('code');
  const exchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code ?? '',
      redirect_uri: redirectUri,
      client_id: 'plugins-cli',
      code_verifier: journeyVerifier,
    }),
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

const pluginManifest = {
  id: '@hyperbug/sample',
  version: '1.0.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['notifications'],
  extensionPoints: [],
  permissions: [],
  settings: [],
};

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
  for (const migration of await migrationStatements('postgres')) {
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-plugin-route-'));
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
  passkeyConfig.store = configured.passkeyStores!;
  passkeyConfig.passwordStore = configured.passwordStore!;
  passkeyConfig.sessionStore = configured.sessionStore!;
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
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      oauthClients: clients,
      oauthCodeStore: configured.oauthCodeStore,
      projectRoleStore: configured.projectRoleStore,
      pluginRegistry: configured.pluginRegistryStore,
      accountAdministration: configured.accountAdministration,
      auditAppend: configured.auditAppend,
      bootstrapCode: enrollmentCode,
      staffEnrollmentStore: configured.staffEnrollmentStore,
      passkey: passkeyConfig,
    }),
    0,
  );
  base = listener.url;
  config.allowedOrigins.push(base);
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

it('manages the plugin registry with step-up on PostgreSQL and emits no plugin audit events', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  const staffLogin = await post('/auth/login', {
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(staffLogin.status).toBe(200);
  const staffCookie = (staffLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (staffCookie === undefined) throw new Error('Missing session cookie');

  await pool.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [projectId, 'plugins-project', 'Plugins Project', Date.now(), Date.now()],
  );
  const account = await fetch(new URL('/api/v1/account', base), {
    headers: {
      authorization: `Bearer ${await tokenFromCookie(staffCookie!, 'whoami')}`,
    },
  });
  expect(account.status).toBe(200);
  const staffPrincipalId = ((await account.json()) as { principalId: string })
    .principalId;
  await pool.query(
    "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES ($1, $2, 'staff', 'administrator', $3)",
    [projectId, staffPrincipalId, Date.now()],
  );

  const passwordToken = await tokenFromCookie(staffCookie!, 'password-state');
  const passwordAttempt = await post(
    '/api/v1/admin/plugins',
    { manifest: pluginManifest },
    { authorization: `Bearer ${passwordToken}` },
  );
  expect(passwordAttempt.status).toBe(403);
  expect(await passwordAttempt.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });

  const optionsResponse = await post(
    '/auth/passkey/register/options',
    {},
    { cookie: staffCookie! },
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
  const registrationVerify = await post(
    '/auth/passkey/register',
    { response: registration },
    { cookie: staffCookie! },
  );
  expect(registrationVerify.status).toBe(200);
  const loginOptions = await post('/auth/passkey/login/options', {});
  const challenge = ((await loginOptions.json()) as { challenge: string })
    .challenge;
  const passkeyLogin = await post('/auth/passkey/login', {
    response: await authenticator.assertion(challenge, 1),
  });
  expect(passkeyLogin.status).toBe(200);
  const passkeyCookie = (passkeyLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (passkeyCookie === undefined) throw new Error('Missing passkey cookie');
  const token = await tokenFromCookie(passkeyCookie!, 'stepped-state');

  const invalid = await post(
    '/api/v1/admin/plugins',
    { manifest: { ...pluginManifest, version: '1.0' } },
    { authorization: `Bearer ${token}` },
  );
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toMatchObject({
    error: { code: 'PLUGIN_INVALID' },
  });

  const registered = await post(
    '/api/v1/admin/plugins',
    { manifest: pluginManifest },
    { authorization: `Bearer ${token}` },
  );
  expect(registered.status).toBe(201);
  expect(await registered.json()).toMatchObject({
    id: '@hyperbug/sample',
    state: 'registered',
  });
  const duplicate = await post(
    '/api/v1/admin/plugins',
    { manifest: pluginManifest },
    { authorization: `Bearer ${token}` },
  );
  expect(duplicate.status).toBe(409);

  const enabled = await post(
    '/api/v1/admin/plugins/enable',
    { id: '@hyperbug/sample' },
    { authorization: `Bearer ${token}` },
  );
  expect(enabled.status).toBe(200);
  expect(await enabled.json()).toMatchObject({ state: 'enabled' });
  const disabled = await post(
    '/api/v1/admin/plugins/disable',
    { id: '@hyperbug/sample' },
    { authorization: `Bearer ${token}` },
  );
  expect(disabled.status).toBe(200);
  const upgraded = await post(
    '/api/v1/admin/plugins/upgrade',
    {
      id: '@hyperbug/sample',
      manifest: { ...pluginManifest, version: '1.1.0' },
    },
    { authorization: `Bearer ${token}` },
  );
  expect(upgraded.status).toBe(200);
  expect(await upgraded.json()).toMatchObject({ version: '1.1.0' });

  const listed = await fetch(new URL('/api/v1/admin/plugins', base), {
    headers: { origin: base, authorization: `Bearer ${token}` },
  });
  expect(listed.status).toBe(200);
  expect(await listed.json()).toMatchObject({
    plugins: [{ id: '@hyperbug/sample', version: '1.1.0', state: 'disabled' }],
  });

  const uninstalled = await post(
    '/api/v1/admin/plugins/uninstall',
    { id: '@hyperbug/sample', policy: 'delete' },
    { authorization: `Bearer ${token}` },
  );
  expect(uninstalled.status).toBe(204);
  const row = await pool.query(
    'SELECT COUNT(*)::int AS n FROM plugin_registry',
  );
  expect(row.rows[0]).toEqual({ n: 0 });

  const pluginAudits = await pool.query(
    "SELECT COUNT(*)::int AS n FROM audit_events WHERE action LIKE 'plugin.%'",
  );
  expect(pluginAudits.rows[0]).toEqual({ n: 0 });
});
