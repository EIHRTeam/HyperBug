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

const databaseName = 'hyperbug_oauth_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'spa-local',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
  {
    clientId: 'spa-pages',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
];
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
const sessionKeys = cryptoFixture();

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
  if (migrations.at(-1)?.name !== '0013_oauth_codes')
    throw new Error('OAuth migration missing');
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-oauth-route-'));
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
      oauthClients: clients,
      oauthCodeStore: configured.oauthCodeStore,
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

const authorize = (
  body: Record<string, unknown>,
  cookie?: string,
  origin = base,
) =>
  fetch(new URL('/auth/authorize', base), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const token = (fields: Record<string, string>) =>
  fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });

const revoke = (value: string) =>
  fetch(new URL('/auth/token/revoke', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: value }),
  });

const authorizeWithSession = async (
  cookie: string,
  state: string,
  overrides: Partial<{
    clientId: string;
    redirectUri: string;
    scope: string;
  }> = {},
) => {
  const value = verifier();
  const response = await authorize(
    {
      clientId: 'spa-local',
      redirectUri,
      scope: 'public-api',
      state,
      codeChallenge: await challengeOf(value),
      ...overrides,
    },
    cookie,
  );
  return { response, verifier: value };
};

it('runs the authorization-code + PKCE journey end to end', async () => {
  const registered = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'oauthuser',
      password: 'first-password-123',
    }),
  });
  expect(registered.status).toBe(202);
  const firstLogin = await fetch(new URL('/auth/login', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'oauthuser',
      password: 'first-password-123',
    }),
  });
  expect(firstLogin.status).toBe(200);
  const cookie = (firstLogin.headers.getSetCookie?.() ?? [])[0] ?? '';
  const pair = cookie.split(';')[0];
  if (pair === undefined) throw new Error('Missing session cookie');

  const unauthenticated = await authorize({
    clientId: 'spa-local',
    redirectUri,
    scope: 'public-api',
    state: 'st-unauthenticated',
    codeChallenge: await challengeOf(verifier()),
  });
  expect(unauthenticated.status).toBe(401);
  expect(await unauthenticated.json()).toMatchObject({
    error: { code: 'LOGIN_DENIED' },
  });

  const unknownClient = await authorizeWithSession(pair, 'st-unknown-client', {
    clientId: 'not-registered',
  });
  expect(unknownClient.response.status).toBe(400);
  const unknownClientBody = await unknownClient.response.json();
  expect(unknownClientBody).toMatchObject({ error: { code: 'OAUTH_DENIED' } });

  const wrongRedirect = await authorize(
    {
      clientId: 'spa-local',
      redirectUri: 'http://localhost:5173/attacker',
      scope: 'public-api',
      state: 'st-wrong-redirect',
      codeChallenge: await challengeOf(verifier()),
    },
    pair,
  );
  expect(wrongRedirect.status).toBe(400);
  expect(await wrongRedirect.json()).toMatchObject({
    error: { code: unknownClientBody.error?.code },
  });

  const wrongScope = await authorize(
    {
      clientId: 'spa-local',
      redirectUri,
      scope: 'public-api staff-admin',
      state: 'st-wrong-scope',
      codeChallenge: await challengeOf(verifier()),
    },
    pair,
  );
  expect(wrongScope.status).toBe(400);
  expect(await wrongScope.json()).toMatchObject({
    error: { code: unknownClientBody.error?.code },
  });

  const wrongGrant = await token({
    grant_type: 'client_credentials',
    client_id: 'grant-probe',
    code: 'x',
    redirect_uri: redirectUri,
    code_verifier: verifier(),
  });
  expect(wrongGrant.status).toBe(400);
  expect(await wrongGrant.json()).toMatchObject({
    error: { code: unknownClientBody.error?.code },
  });

  const first = await authorizeWithSession(pair, 'st-first');
  expect(first.response.status).toBe(200);
  const { redirectUri: firstRedirect } = (await first.response.json()) as {
    redirectUri: string;
  };
  expect(firstRedirect.startsWith(`${redirectUri}?`)).toBe(true);
  const parsed = new URL(firstRedirect);
  const code = parsed.searchParams.get('code');
  expect(code).toMatch(/^[0-9a-f-]{36}\.hb1_[A-Za-z0-9_-]{43}$/);
  expect(parsed.searchParams.get('state')).toBe('st-first');
  if (!code) throw new Error('Missing authorization code');

  const wrongVerifier = await token({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: 'spa-local',
    code_verifier: verifier(),
  });
  expect(wrongVerifier.status).toBe(400);
  expect(wrongVerifier.headers.get('cache-control')).toBe('no-store');
  expect(await wrongVerifier.json()).toMatchObject({
    error: { code: 'OAUTH_DENIED' },
  });
  const burnedAfterFailure = await token({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: 'spa-local',
    code_verifier: first.verifier,
  });
  expect(burnedAfterFailure.status).toBe(400);

  const second = await authorizeWithSession(pair, 'st-second');
  expect(second.response.status).toBe(200);
  const secondRedirect = (
    (await second.response.json()) as {
      redirectUri: string;
    }
  ).redirectUri;
  const secondCode = new URL(secondRedirect).searchParams.get('code');
  if (!secondCode) throw new Error('Missing authorization code');
  const exchanged = await token({
    grant_type: 'authorization_code',
    code: secondCode,
    redirect_uri: redirectUri,
    client_id: 'spa-local',
    code_verifier: second.verifier,
  });
  expect(exchanged.status).toBe(200);
  expect(exchanged.headers.get('cache-control')).toBe('no-store');
  const issued = (await exchanged.json()) as {
    tokenType: string;
    accessToken: string;
    expiresIn: number;
    scope: string;
  };
  expect(issued).toEqual({
    tokenType: 'Bearer',
    accessToken: issued.accessToken,
    expiresIn: 600,
    scope: 'public-api',
  });
  expect(issued.accessToken).toMatch(
    /^at_[0-9a-f-]{36}\.hb1_[A-Za-z0-9_-]{43}$/,
  );

  const replay = await token({
    grant_type: 'authorization_code',
    code: secondCode,
    redirect_uri: redirectUri,
    client_id: 'spa-local',
    code_verifier: second.verifier,
  });
  expect(replay.status).toBe(400);

  const storedCodes = await pool.query('SELECT consumed_at FROM oauth_codes');
  expect(storedCodes.rowCount).toBe(2);
  for (const row of storedCodes.rows) expect(row.consumed_at).not.toBeNull();
  const storedTokens = await pool.query(
    'SELECT digest FROM oauth_access_tokens',
  );
  expect(storedTokens.rowCount).toBe(1);
  expect(JSON.stringify(storedTokens.rows)).not.toContain(
    issued.accessToken.split('.')[1] ?? '',
  );

  // Bearer-authenticated business read: no token, a malformed token and a
  // session cookie alone all deny; a No-Origin caller stays eligible.
  const accountDenied = await fetch(new URL('/api/v1/account', base));
  expect(accountDenied.status).toBe(401);
  expect(await accountDenied.json()).toMatchObject({
    error: { code: 'AUTHENTICATION_REQUIRED' },
  });
  const accountGarbage = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: 'Bearer at_garbage.hb1_short' },
  });
  expect(accountGarbage.status).toBe(401);
  const accountCookieOnly = await fetch(new URL('/api/v1/account', base), {
    headers: { cookie: pair },
  });
  expect(accountCookieOnly.status).toBe(401);

  const account = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: `Bearer ${issued.accessToken}` },
  });
  expect(account.status).toBe(200);
  expect(account.headers.get('cache-control')).toBe('no-store');
  const tokenRow = await pool.query<{
    principal_id: string;
    identity_id: string;
  }>('SELECT principal_id, identity_id FROM oauth_access_tokens LIMIT 1');
  expect(await account.json()).toEqual({
    principalId: tokenRow.rows[0]?.principal_id,
    identityId: tokenRow.rows[0]?.identity_id,
    kind: 'user',
  });

  const revoked = await revoke(issued.accessToken);
  expect(revoked.status).toBe(204);
  const revokedRow = await pool.query(
    'SELECT revoked_at FROM oauth_access_tokens',
  );
  expect(revokedRow.rows[0]?.revoked_at).not.toBeNull();
  const revokedAgain = await revoke(issued.accessToken);
  expect(revokedAgain.status).toBe(204);
  const revokedUnknown = await revoke(
    'at_00000000-0000-4000-8000-000000000000.hb1_' + 'A'.repeat(43),
  );
  expect(revokedUnknown.status).toBe(204);
  const revokedGarbage = await revoke('not-a-token');
  expect(revokedGarbage.status).toBe(204);

  const accountRevoked = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: `Bearer ${issued.accessToken}` },
  });
  expect(accountRevoked.status).toBe(401);
  expect(await accountRevoked.json()).toMatchObject({
    error: { code: 'AUTHENTICATION_REQUIRED' },
  });
});

it('drives the browser flow through the backend-owned authorize pages', async () => {
  const registered = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'pageuser',
      password: 'first-password-123',
    }),
  });
  expect(registered.status).toBe(202);

  const journeyVerifier = verifier();
  const challenge = await challengeOf(journeyVerifier);
  const authorizeUrl = new URL('/auth/authorize', base);
  const oauthQuery = {
    response_type: 'code',
    client_id: 'spa-pages',
    redirect_uri: redirectUri,
    scope: 'public-api',
    state: 'page-state-42',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  };
  for (const [name, value] of Object.entries(oauthQuery))
    authorizeUrl.searchParams.set(name, value);

  const badClient = new URL('/auth/authorize', base);
  badClient.searchParams.set('response_type', 'code');
  badClient.searchParams.set('client_id', 'unknown-client');
  badClient.searchParams.set('redirect_uri', redirectUri);
  badClient.searchParams.set('scope', 'public-api');
  badClient.searchParams.set('state', 's');
  badClient.searchParams.set('code_challenge', challenge);
  badClient.searchParams.set('code_challenge_method', 'S256');
  const rejected = await fetch(badClient);
  expect(rejected.status).toBe(400);
  expect(rejected.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(rejected.headers.get('content-security-policy')).toContain(
    "form-action 'self'",
  );
  expect(await rejected.text()).toContain('not permitted');

  const loginPage = await fetch(authorizeUrl);
  expect(loginPage.status).toBe(200);
  expect(loginPage.headers.get('content-type')).toBe(
    'text/html; charset=utf-8',
  );
  const loginHtml = await loginPage.text();
  expect(loginHtml).toContain('lang="en"');
  expect(loginHtml).toContain('<label for="handle">Handle</label>');
  expect(loginHtml).toContain('aria-live');
  expect(loginHtml).toContain('action="/auth/authorize/login"');
  expect(loginHtml).toContain('name="code_challenge_method"');
  expect(loginHtml).not.toContain('first-password');

  const form = (over: Record<string, string>) =>
    new URLSearchParams({ ...oauthQuery, ...over });
  const wrong = await fetch(new URL('/auth/authorize/login', base), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: base,
    },
    body: form({ handle: 'pageuser', password: 'wrong-password-999' }),
  });
  expect(wrong.status).toBe(401);
  expect(wrong.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(await wrong.text()).toContain('role="alert"');

  const login = await fetch(new URL('/auth/authorize/login', base), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: base,
    },
    body: form({ handle: 'pageuser', password: 'first-password-123' }),
    redirect: 'manual',
  });
  console.log(
    'page login:',
    login.status,
    (await login.text()).slice(0, 300),
    login.headers.get('set-cookie'),
  );
  expect(login.status).toBe(302);
  const location = login.headers.get('location') ?? '';
  expect(location).toContain(
    `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=`,
  );
  expect(location).toContain('state=page-state-42');
  const cookie = (login.headers.getSetCookie?.() ?? [])[0] ?? '';
  expect(cookie).toMatch(/^__Host-hb_session=/);

  const callback = new URL(location);
  const firstCode = callback.searchParams.get('code') ?? '';
  expect(firstCode).toMatch(/^at_|^[0-9a-f-]{36}\./);
  const exchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: firstCode,
      redirect_uri: redirectUri,
      client_id: 'spa-pages',
      code_verifier: journeyVerifier,
    }),
  });
  expect(exchange.status).toBe(200);
  expect(await exchange.json()).toMatchObject({ tokenType: 'Bearer' });

  const consentPage = await fetch(authorizeUrl, { headers: { cookie } });
  expect(consentPage.status).toBe(200);
  const consentHtml = await consentPage.text();
  expect(consentHtml).toContain('Authorize access');
  expect(consentHtml).toContain('<code>public-api</code>');
  expect(consentHtml).toContain('action="/auth/authorize/consent"');

  const consent = await fetch(new URL('/auth/authorize/consent', base), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: base,
      cookie,
    },
    body: form({}),
    redirect: 'manual',
  });
  expect(consent.status).toBe(302);
  const secondCode = new URL(
    consent.headers.get('location') ?? '',
  ).searchParams.get('code');
  expect(secondCode).toBeTruthy();
  const secondExchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: secondCode ?? '',
      redirect_uri: redirectUri,
      client_id: 'spa-pages',
      code_verifier: journeyVerifier,
    }),
  });
  expect(secondExchange.status).toBe(200);
  expect((await secondExchange.json()).accessToken).toMatch(/^at_/);
});
