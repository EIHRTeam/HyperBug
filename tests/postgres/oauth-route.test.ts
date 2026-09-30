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
  {
    clientId: 'spa-negative',
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
    responseType: string;
    codeChallengeMethod: string;
  }> = {},
) => {
  const value = verifier();
  const response = await authorize(
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
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
    responseType: 'code',
    codeChallengeMethod: 'S256',
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
      responseType: 'code',
      codeChallengeMethod: 'S256',
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
      responseType: 'code',
      codeChallengeMethod: 'S256',
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

  // The authorize step is code-flow-only with S256 PKCE: a token
  // response_type or a plain challenge method never reaches code issuance.
  const wrongResponseType = await authorizeWithSession(pair, 'st-token', {
    responseType: 'token',
  });
  expect(wrongResponseType.response.status).toBe(400);
  expect(await wrongResponseType.response.json()).toMatchObject({
    error: { code: 'OAUTH_DENIED' },
  });
  const plainMethod = await authorizeWithSession(pair, 'st-plain', {
    codeChallengeMethod: 'plain',
  });
  expect(plainMethod.response.status).toBe(400);
  expect(await plainMethod.response.json()).toMatchObject({
    error: { code: 'OAUTH_DENIED' },
  });
  const jsonCodesAfterRejections = await pool.query(
    'SELECT count(*)::int AS count FROM oauth_codes',
  );
  expect(jsonCodesAfterRejections.rows[0]?.count).toBe(0);

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

  // Protocol-shape rejections of an already-verified client/redirect are
  // redirected back to the registered redirect URI with the RFC 6749
  // §4.2.2.1 / RFC 7636 §4.4.1 error, never rendered as an error page.
  const tokenType = new URL('/auth/authorize', base);
  for (const [name, value] of Object.entries(oauthQuery))
    tokenType.searchParams.set(name, value);
  tokenType.searchParams.set('response_type', 'token');
  const tokenTypeRejected = await fetch(tokenType, { redirect: 'manual' });
  expect(tokenTypeRejected.status).toBe(302);
  const tokenTypeLocation = new URL(
    tokenTypeRejected.headers.get('location') ?? '',
  );
  expect(tokenTypeLocation.origin + tokenTypeLocation.pathname).toBe(
    redirectUri,
  );
  expect(tokenTypeLocation.searchParams.get('error')).toBe(
    'unsupported_response_type',
  );
  expect(tokenTypeLocation.searchParams.get('state')).toBe('page-state-42');
  expect(tokenTypeRejected.headers.get('set-cookie')).toBeNull();

  const plainChallenge = new URL('/auth/authorize', base);
  for (const [name, value] of Object.entries(oauthQuery))
    plainChallenge.searchParams.set(name, value);
  plainChallenge.searchParams.set('code_challenge_method', 'plain');
  const plainRejected = await fetch(plainChallenge, { redirect: 'manual' });
  expect(plainRejected.status).toBe(302);
  const plainLocation = new URL(plainRejected.headers.get('location') ?? '');
  expect(plainLocation.searchParams.get('error')).toBe('invalid_request');
  expect(plainLocation.searchParams.get('state')).toBe('page-state-42');

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

  // A protocol-shape rejection redirects before any credential work: no
  // login attempt, no session cookie, no code.
  const loginRejected = await fetch(new URL('/auth/authorize/login', base), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: base,
    },
    body: form({ response_type: 'token' }),
    redirect: 'manual',
  });
  expect(loginRejected.status).toBe(302);
  const loginRejectedLocation = new URL(
    loginRejected.headers.get('location') ?? '',
  );
  expect(loginRejectedLocation.searchParams.get('error')).toBe(
    'unsupported_response_type',
  );
  expect(loginRejectedLocation.searchParams.get('code')).toBeNull();
  expect(loginRejected.headers.get('set-cookie')).toBeNull();

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

  // The consent path enforces the same protocol literals: a plain challenge
  // method redirects the RFC error instead of issuing a second code.
  const consentRejected = await fetch(
    new URL('/auth/authorize/consent', base),
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: base,
        cookie,
      },
      body: form({ code_challenge_method: 'plain' }),
      redirect: 'manual',
    },
  );
  expect(consentRejected.status).toBe(302);
  const consentRejectedLocation = new URL(
    consentRejected.headers.get('location') ?? '',
  );
  expect(consentRejectedLocation.searchParams.get('error')).toBe(
    'invalid_request',
  );
  expect(consentRejectedLocation.searchParams.get('code')).toBeNull();
  expect(consentRejectedLocation.searchParams.get('state')).toBe(
    'page-state-42',
  );
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

it(
  'closes the 04.V2 negative protocol cases',
  { timeout: 120_000 },
  async () => {
    const registered = await fetch(new URL('/api/v1/accounts/register', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'negativeuser',
        password: 'first-password-123',
      }),
    });
    expect(registered.status).toBe(202);
    const login = await fetch(new URL('/auth/login', base), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({
        handle: 'negativeuser',
        password: 'first-password-123',
      }),
    });
    expect(login.status).toBe(200);
    const cookie = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
    if (cookie === undefined) throw new Error('Missing session cookie');

    const issue = async () => {
      const journeyVerifier = verifier();
      const authorized = await fetch(new URL('/auth/authorize', base), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: base,
          cookie,
        },
        body: JSON.stringify({
          responseType: 'code',
          codeChallengeMethod: 'S256',
          clientId: 'spa-negative',
          redirectUri,
          scope: 'public-api',
          state: 'negative-state',
          codeChallenge: await challengeOf(journeyVerifier),
        }),
      });
      expect(authorized.status).toBe(200);
      const code = new URL(
        ((await authorized.json()) as { redirectUri: string }).redirectUri,
      ).searchParams.get('code');
      return { code: code ?? '', journeyVerifier };
    };

    const { code, journeyVerifier } = await issue();
    const wrongRedirect = await fetch(new URL('/auth/token', base), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:5173/attacker',
        client_id: 'spa-negative',
        code_verifier: journeyVerifier,
      }),
    });
    expect(wrongRedirect.status).toBe(400);

    // A code older than the 60-second bound is expired: a real wait, no clock
    // injection, so this case costs a minute and proves the bound honestly.
    const aged = await issue();
    await new Promise((resolve) => setTimeout(resolve, 61_000));
    const expired = await fetch(new URL('/auth/token', base), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: aged.code,
        redirect_uri: 'http://localhost:5173/oauth/callback',
        client_id: 'spa-negative',
        code_verifier: aged.journeyVerifier,
      }),
    });
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({
      error: { code: 'OAUTH_DENIED' },
    });

    // 04.V4: a browser Origin outside the allowlist is rejected on the account
    // API even with a valid bearer token, while the no-Origin client works.
    const fresh = await issue();
    const exchange = await fetch(new URL('/auth/token', base), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: fresh.code,
        redirect_uri: 'http://localhost:5173/oauth/callback',
        client_id: 'spa-negative',
        code_verifier: fresh.journeyVerifier,
      }),
    });
    expect(exchange.status).toBe(200);
    const negativeToken = ((await exchange.json()) as { accessToken: string })
      .accessToken;
    const disallowedOrigin = await fetch(new URL('/api/v1/account', base), {
      headers: {
        authorization: `Bearer ${negativeToken}`,
        origin: 'https://evil.example',
      },
    });
    expect(disallowedOrigin.status).toBe(403);
    expect(await disallowedOrigin.json()).toMatchObject({
      error: { code: 'ORIGIN_FORBIDDEN' },
    });
    const noOrigin = await fetch(new URL('/api/v1/account', base), {
      headers: { authorization: `Bearer ${negativeToken}` },
    });
    expect(noOrigin.status).toBe(200);
  },
);
