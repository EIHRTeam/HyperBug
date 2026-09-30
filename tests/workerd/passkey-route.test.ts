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
        HYPERBUG_TEST_PASSKEY_RP_ID: 'auth.poc.example',
        HYPERBUG_TEST_PASSKEY_RP_NAME: 'HyperBug PoC',
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

it('registers a passkey and signs in discoverably on workerd/D1', async () => {
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

  const replay = await post('/auth/passkey/login', {
    response: await authenticator.assertion(challenge, 2),
  });
  expect(replay.status).toBe(403);
  expect(await replay.json()).toMatchObject({
    error: { code: 'PASSKEY_DENIED' },
  });
});
