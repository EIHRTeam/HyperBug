import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';

const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const projectId = crypto.randomUUID();
let mf: Miniflare;
let authenticator: Awaited<ReturnType<typeof createFakeAuthenticator>>;

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

const call = (
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
      ...(init.token === undefined
        ? {}
        : { authorization: `Bearer ${init.token}` }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      clientId: 'roles-cli',
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
  const exchange = await form('/auth/token', {
    grant_type: 'authorization_code',
    code: code ?? '',
    redirect_uri: redirectUri,
    client_id: 'roles-cli',
    code_verifier: journeyVerifier,
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

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
          namespace_id: '703415',
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
            clientId: 'roles-cli',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
        HYPERBUG_TEST_PASSKEY_RP_ID: 'auth.poc.example',
        HYPERBUG_TEST_PASSKEY_RP_NAME: 'HyperBug Roles PoC',
        HYPERBUG_TEST_PASSKEY_ORIGIN: authOrigin,
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
  authenticator = await createFakeAuthenticator('auth.poc.example', authOrigin);
});

afterAll(async () => {
  await mf?.dispose();
});

it('manages sessions, roles and suspension with step-up on workerd/D1', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  const registered = await post('/api/v1/accounts/register', {
    handle: 'roleuser',
    password: 'long-functional-password',
  });
  expect(registered.status).toBe(202);

  const staffLogin = await post('/auth/login', {
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(staffLogin.status).toBe(200);
  const staffCookie = (staffLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (staffCookie === undefined) throw new Error('Missing session cookie');
  const userLogin = await post('/auth/login', {
    handle: 'roleuser',
    password: 'long-functional-password',
  });
  expect(userLogin.status).toBe(200);
  const userCookie = (userLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (userCookie === undefined) throw new Error('Missing session cookie');

  const staffToken = await tokenFromCookie(staffCookie!, 'staff-state');
  const userToken = await tokenFromCookie(userCookie!, 'user-state');
  const account = await call('/api/v1/account', { token: userToken });
  expect(account.status).toBe(200);
  const userPrincipalId = ((await account.json()) as { principalId: string })
    .principalId;
  const staffAccount = await call('/api/v1/account', { token: staffToken });
  expect(staffAccount.status).toBe(200);
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;

  const sessions = await call('/api/v1/account/sessions', { token: userToken });
  expect(sessions.status).toBe(200);
  const listed = (await sessions.json()) as { sessions: { id: string }[] };
  expect(listed.sessions.length).toBeGreaterThanOrEqual(1);
  const removed = await call(
    `/api/v1/account/sessions/${listed.sessions[0]!.id}`,
    {
      method: 'DELETE',
      token: userToken,
      body: {},
    },
  );
  expect(removed.status).toBe(204);
  const removedAgain = await call(
    `/api/v1/account/sessions/${listed.sessions[0]!.id}`,
    { method: 'DELETE', token: userToken, body: {} },
  );
  expect(removedAgain.status).toBe(404);

  const db = await mf.getD1Database('DB');
  await db
    .prepare(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(projectId, 'roles-project', 'Roles Project', Date.now(), Date.now())
    .run();
  await db
    .prepare(
      "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES (?, ?, 'staff', 'administrator', ?)",
    )
    .bind(projectId, staffPrincipalId, Date.now())
    .run();

  const passwordGrant = await call(
    `/api/v1/projects/${projectId}/members/${userPrincipalId}`,
    { method: 'PUT', token: staffToken, body: { role: 'triage' } },
  );
  expect(passwordGrant.status).toBe(403);
  expect(await passwordGrant.json()).toMatchObject({
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

  const steppedToken = await tokenFromCookie(passkeyCookie!, 'stepped-state');
  const userGrant = await call(
    `/api/v1/projects/${projectId}/members/${userPrincipalId}`,
    { method: 'PUT', token: steppedToken, body: { role: 'triage' } },
  );
  expect(userGrant.status).toBe(403);
  expect(await userGrant.json()).toMatchObject({
    error: { code: 'FORBIDDEN' },
  });
  const selfReplace = await call(
    `/api/v1/projects/${projectId}/members/${staffPrincipalId}`,
    { method: 'PUT', token: steppedToken, body: { role: 'administrator' } },
  );
  expect(selfReplace.status).toBe(200);

  const suspended = await call(
    `/api/v1/admin/principals/${userPrincipalId}/suspend`,
    { method: 'POST', token: steppedToken, body: {} },
  );
  expect(suspended.status).toBe(200);
  const denied = await call('/api/v1/account', { token: userToken });
  expect(denied.status).toBe(401);
  const lastStaff = await call(
    `/api/v1/admin/principals/${staffPrincipalId}/suspend`,
    { method: 'POST', token: steppedToken, body: {} },
  );
  expect(lastStaff.status).toBe(403);
  const activated = await call(
    `/api/v1/admin/principals/${userPrincipalId}/activate`,
    { method: 'POST', token: steppedToken, body: {} },
  );
  expect(activated.status).toBe(200);
  const restored = await call('/api/v1/account', { token: userToken });
  expect(restored.status).toBe(200);

  const memberRemoved = await call(
    `/api/v1/projects/${projectId}/members/${staffPrincipalId}`,
    { method: 'DELETE', token: steppedToken, body: {} },
  );
  expect(memberRemoved.status).toBe(204);
});
