import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
let mf: Miniflare;

const post = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
      ...extra,
    },
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

const form = (path: string, fields: Record<string, string>) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });

const sameOriginForm = (path: string, fields: Record<string, string>) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    redirect: 'manual',
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
    },
    body: new URLSearchParams(fields),
  });

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/account-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      ratelimits: {
        ABUSE_VOLUMETRIC: {
          namespace_id: '703414',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: authOrigin,
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_TEST_OAUTH_CLIENTS: JSON.stringify([
          {
            clientId: 'spa-poc',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
          {
            clientId: 'spa-pages',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
      },
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  await db
    .prepare(
      "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
    )
    .bind(Date.now())
    .run();
});

afterAll(async () => {
  await mf?.dispose();
});

it('runs the authorization-code + PKCE journey on workerd/D1', async () => {
  const registered = await post('/api/v1/accounts/register', {
    handle: 'oauthuser',
    password: 'first-password-123',
  });
  expect(registered.status).toBe(202);

  const firstLogin = await post('/auth/login', {
    handle: 'oauthuser',
    password: 'first-password-123',
  });
  expect(firstLogin.status).toBe(200);
  const cookie = (firstLogin.headers.getSetCookie?.() ?? [])[0] ?? '';
  const pair = cookie.split(';')[0];
  if (pair === undefined) throw new Error('Missing session cookie');

  const unauthenticated = await post('/auth/authorize', {
    clientId: 'spa-poc',
    redirectUri,
    scope: 'public-api',
    state: 'st-unauthenticated',
    codeChallenge: await challengeOf(verifier()),
  });
  expect(unauthenticated.status).toBe(401);
  expect(await unauthenticated.json()).toMatchObject({
    error: { code: 'LOGIN_DENIED' },
  });

  const firstVerifier = verifier();
  const first = await post(
    '/auth/authorize',
    {
      clientId: 'spa-poc',
      redirectUri,
      scope: 'public-api',
      state: 'st-first',
      codeChallenge: await challengeOf(firstVerifier),
    },
    { cookie: pair },
  );
  expect(first.status).toBe(200);
  const { redirectUri: firstRedirect } = (await first.json()) as {
    redirectUri: string;
  };
  expect(firstRedirect.startsWith(`${redirectUri}?`)).toBe(true);
  const parsed = new URL(firstRedirect);
  const code = parsed.searchParams.get('code');
  expect(code).toMatch(/^[0-9a-f-]{36}\.hb1_[A-Za-z0-9_-]{43}$/);
  expect(parsed.searchParams.get('state')).toBe('st-first');
  if (!code) throw new Error('Missing authorization code');

  const wrongVerifier = await form('/auth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: 'spa-poc',
    code_verifier: verifier(),
  });
  expect(wrongVerifier.status).toBe(400);
  expect(wrongVerifier.headers.get('cache-control')).toBe('no-store');
  expect(await wrongVerifier.json()).toMatchObject({
    error: { code: 'OAUTH_DENIED' },
  });
  const burnedAfterFailure = await form('/auth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: 'spa-poc',
    code_verifier: firstVerifier,
  });
  expect(burnedAfterFailure.status).toBe(400);

  const secondVerifier = verifier();
  const second = await post(
    '/auth/authorize',
    {
      clientId: 'spa-poc',
      redirectUri,
      scope: 'public-api',
      state: 'st-second',
      codeChallenge: await challengeOf(secondVerifier),
    },
    { cookie: pair },
  );
  expect(second.status).toBe(200);
  const secondRedirect = ((await second.json()) as { redirectUri: string })
    .redirectUri;
  const secondCode = new URL(secondRedirect).searchParams.get('code');
  if (!secondCode) throw new Error('Missing authorization code');
  const exchanged = await form('/auth/token', {
    grant_type: 'authorization_code',
    code: secondCode,
    redirect_uri: redirectUri,
    client_id: 'spa-poc',
    code_verifier: secondVerifier,
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

  const replay = await form('/auth/token', {
    grant_type: 'authorization_code',
    code: secondCode,
    redirect_uri: redirectUri,
    client_id: 'spa-poc',
    code_verifier: secondVerifier,
  });
  expect(replay.status).toBe(400);

  const db = await mf.getD1Database('DB');
  const storedCodes = await db
    .prepare('SELECT consumed_at FROM oauth_codes')
    .all<{ consumed_at: number }>();
  expect(storedCodes.results).toHaveLength(2);
  for (const row of storedCodes.results) expect(row.consumed_at).not.toBeNull();
  const storedTokens = await db
    .prepare('SELECT digest FROM oauth_access_tokens')
    .all<{ digest: string }>();
  expect(storedTokens.results).toHaveLength(1);
  expect(JSON.stringify(storedTokens.results)).not.toContain(
    issued.accessToken.split('.')[1] ?? '',
  );

  const revoked = await form('/auth/token/revoke', {
    token: issued.accessToken,
  });
  expect(revoked.status).toBe(204);
  const revokedRow = await db
    .prepare('SELECT revoked_at FROM oauth_access_tokens')
    .first<{ revoked_at: number }>();
  expect(revokedRow?.revoked_at).not.toBeNull();
  const revokedAgain = await form('/auth/token/revoke', {
    token: issued.accessToken,
  });
  expect(revokedAgain.status).toBe(204);
});

it('renders the backend-owned authorize pages and completes the browser flow', async () => {
  const registered = await post('/api/v1/accounts/register', {
    handle: 'pageuser',
    password: 'first-password-123',
  });
  expect(registered.status).toBe(202);
  const journeyVerifier = verifier();
  const challenge = await challengeOf(journeyVerifier);
  const oauthQuery: Record<string, string> = {
    response_type: 'code',
    client_id: 'spa-pages',
    redirect_uri: redirectUri,
    scope: 'public-api',
    state: 'page-state-42',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  };
  const pageUrl = `${authOrigin}/auth/authorize?${new URLSearchParams(oauthQuery)}`;
  const loginPage = await mf.dispatchFetch(pageUrl);
  expect(loginPage.status).toBe(200);
  expect(loginPage.headers.get('content-type')).toBe(
    'text/html; charset=utf-8',
  );
  expect(loginPage.headers.get('content-security-policy')).toContain(
    "form-action 'self'",
  );
  const html = await loginPage.text();
  expect(html).toContain('lang="en"');
  expect(html).toContain('<label for="handle">Handle</label>');
  expect(html).toContain('aria-live');

  const login = await sameOriginForm('/auth/authorize/login', {
    ...oauthQuery,
    handle: 'pageuser',
    password: 'first-password-123',
  });
  expect(login.status).toBe(302);
  const location = login.headers.get('location') ?? '';
  expect(location).toContain('code=');
  expect(location).toContain('state=page-state-42');
  const cookie = (login.headers.getSetCookie?.() ?? [])[0] ?? '';

  expect(cookie).toMatch(/^__Host-hb_session=/);
  const pair = cookie.split(';')[0];
  if (pair === undefined) throw new Error('Missing session cookie');

  const code = new URL(location).searchParams.get('code') ?? '';
  const exchange = await form('/auth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: 'spa-pages',
    code_verifier: journeyVerifier,
  });
  expect(exchange.status).toBe(200);
  const exchanged = (await exchange.json()) as { accessToken: string };
  expect(exchanged.accessToken).toMatch(/^at_/);

  const consentPage = await mf.dispatchFetch(pageUrl, {
    headers: { cookie: pair },
  });
  expect(consentPage.status).toBe(200);
  expect(await consentPage.text()).toContain('Authorize access');

  const consent = await mf.dispatchFetch(
    `${authOrigin}/auth/authorize/consent`,
    {
      redirect: 'manual',
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: authOrigin,
        'sec-fetch-site': 'same-origin',
        cookie: pair,
      },
      body: new URLSearchParams(oauthQuery),
    },
  );
  expect(consent.status).toBe(302);
  const secondCode = new URL(
    consent.headers.get('location') ?? '',
  ).searchParams.get('code');
  expect(secondCode).toBeTruthy();
  const secondExchange = await form('/auth/token', {
    grant_type: 'authorization_code',
    code: secondCode ?? '',
    redirect_uri: redirectUri,
    client_id: 'spa-pages',
    code_verifier: journeyVerifier,
  });
  expect(secondExchange.status).toBe(200);
  const secondBody = (await secondExchange.json()) as { accessToken: string };
  expect(secondBody.accessToken).toMatch(/^at_/);
});
