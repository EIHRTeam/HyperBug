import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
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
          namespace_id: '703413',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: authOrigin,
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
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

it('runs the recovery-code journey on workerd/D1', async () => {
  const registered = await post('/api/v1/accounts/register', {
    handle: 'recoverable',
    password: 'first-password-123',
  });
  expect(registered.status).toBe(202);

  const firstLogin = await post('/auth/login', {
    handle: 'recoverable',
    password: 'first-password-123',
  });
  expect(firstLogin.status).toBe(200);
  const cookie = (firstLogin.headers.getSetCookie?.() ?? [])[0] ?? '';
  const pair = cookie.split(';')[0];
  if (pair === undefined) throw new Error('Missing session cookie');

  const generated = await post('/auth/recovery-codes', {}, { cookie: pair });
  expect(generated.status).toBe(200);
  const { codes } = (await generated.json()) as { codes: string[] };
  expect(codes).toHaveLength(10);
  const db = await mf.getD1Database('DB');
  const stored = await db
    .prepare('SELECT digest FROM recovery_codes')
    .all<{ digest: string }>();
  expect(stored.results).toHaveLength(10);
  expect(JSON.stringify(stored.results)).not.toContain(codes[0]!);

  const recovered = await post('/auth/recover', {
    handle: 'recoverable',
    recoveryCode: codes[0]!,
    password: 'second-password-456',
  });
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual({ recovered: true });

  const oldSession = await mf.dispatchFetch(`${authOrigin}/auth/session`, {
    headers: { cookie: pair },
  });
  expect(oldSession.status).toBe(401);
  const oldPassword = await post('/auth/login', {
    handle: 'recoverable',
    password: 'first-password-123',
  });
  expect(oldPassword.status).toBe(401);
  const newPassword = await post('/auth/login', {
    handle: 'recoverable',
    password: 'second-password-456',
  });
  expect(newPassword.status).toBe(200);

  const reuse = await post('/auth/recover', {
    handle: 'recoverable',
    recoveryCode: codes[0]!,
    password: 'third-password-789',
  });
  expect(reuse.status).toBe(403);
  expect(await reuse.json()).toMatchObject({
    error: { code: 'RECOVERY_DENIED' },
  });
});
