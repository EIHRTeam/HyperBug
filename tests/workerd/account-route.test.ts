import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  Miniflare,
  convertV4MiniflareOptions,
  type V4WorkerOptions,
} from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import {
  activeAbuseSubjects,
  SecretAbuseKeyProvider,
} from '../../packages/security/src/abuse-keys.ts';
import { createD1RateCounterStore } from '@hyperbug/database-d1';

const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
let mf: Miniflare;
let base: URL;

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
          namespace_id: '703397',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
      },
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  base = await mf.ready;
});

afterAll(async () => {
  await mf?.dispose();
});

it('sheds malformed registration before parsing in workerd without a primary counter write', async () => {
  const limitedWorker = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/account-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      ratelimits: {
        ABUSE_VOLUMETRIC: {
          namespace_id: '703398',
          simple: { limit: 2, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
      },
    }),
  );
  try {
    const db = await limitedWorker.getD1Database('DB');
    for (const migration of await migrationStatements('d1'))
      await db.batch(
        migration.statements.map((statement) => db.prepare(statement)),
      );
    const origin = await limitedWorker.ready;
    for (const status of [400, 400, 429]) {
      const denied = await fetch(new URL('/api/v1/accounts/register', origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"handle":',
      });
      expect(denied.status).toBe(status);
      expect(denied.headers.get('cache-control')).toBe('no-store');
      expect(await denied.json()).toMatchObject({
        error: { code: status === 429 ? 'RATE_LIMITED' : 'INVALID_JSON' },
      });
    }
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS rows FROM rate_limit_counters WHERE category = 'registration'",
        )
        .first<{ rows: number }>(),
    ).toEqual({ rows: 0 });
  } finally {
    await limitedWorker.dispose();
  }
});

it('keeps D1 primary account limits authoritative across separate Worker roots', async () => {
  const sharedBindings = {
    HYPERBUG_ENV: 'local',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
  };
  const worker = (name: string, namespaceId: string): V4WorkerOptions => ({
    name,
    modules: workerModules('dist/account-worker', [wasmPath]),
    compatibilityDate: '2026-09-16',
    compatibilityFlags: ['nodejs_compat', 'enable_request_signal'] as string[],
    d1Databases: { DB: 'shared-account-primary' },
    ratelimits: {
      ABUSE_VOLUMETRIC: {
        namespace_id: namespaceId,
        simple: { limit: 1000, period: 60 },
      },
    },
    bindings: sharedBindings,
  });
  const shared = new Miniflare(
    convertV4MiniflareOptions({
      workers: [worker('account-a', '703392'), worker('account-b', '703391')],
    }),
  );
  try {
    const db = await shared.getD1Database('DB', 'account-a');
    for (const migration of await migrationStatements('d1'))
      await db.batch(
        migration.statements.map((statement) => db.prepare(statement)),
      );
    const [first, second] = await Promise.all([
      shared.getWorker('account-a'),
      shared.getWorker('account-b'),
    ]);
    const url = 'https://api.example/api/v1/accounts/register';
    const request = () => ({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'sharedworker',
        password: 'long-functional-password',
      }),
    });
    const accepted = await first.fetch(url, request());
    expect(accepted.status, await accepted.clone().text()).toBe(202);
    const nowMs = Date.now();
    const windowStart = Math.floor(nowMs / 3_600_000) * 3_600_000;
    const subjects = await activeAbuseSubjects(
      new SecretAbuseKeyProvider({ read: async () => abuseKeyFixture() }),
      'registration',
      'account',
      'sharedworker',
      new AbortController().signal,
    );
    const store = createD1RateCounterStore(db);
    for (const subject of subjects)
      for (let hit = 0; hit < 4; hit++)
        await store.increment({
          ...subject,
          windowStart,
          expiresAt: windowStart + 3_600_000 + 86_400_000,
        });
    const denied = await second.fetch(url, request());
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(denied.headers.get('cache-control')).toBe('no-store');
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM identities WHERE subject = 'sharedworker'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 1 });
  } finally {
    await shared.dispose();
  }
});

it('registers a User through workerd, primary D1 counters and atomic D1 account writes', async () => {
  const live = await fetch(new URL('/health/live', base));
  expect(live.status).toBe(200);
  const response = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'RealWorkerUser',
      password: 'long-functional-password',
    }),
  });
  expect(response.status, await response.clone().text()).toBe(202);
  expect(await response.json()).toEqual({ accepted: true });
  const db = await mf.getD1Database('DB');
  const account = await db
    .prepare(
      "SELECT p.kind, i.subject, c.record FROM principals p JOIN identities i ON i.principal_id = p.id JOIN password_credentials c ON c.identity_id = i.id WHERE i.provider = 'local-password' AND i.issuer = 'hyperbug'",
    )
    .first<{ kind: string; subject: string; record: string }>();
  expect(account?.kind).toBe('user');
  expect(account?.subject).toBe('realworkeruser');
  expect(JSON.parse(account?.record ?? 'null')).toMatchObject({
    alg: 'Argon2id',
  });
  const counters = await db
    .prepare(
      "SELECT dimension, key_version, hits FROM rate_limit_counters WHERE category = 'registration' ORDER BY dimension, key_version",
    )
    .all<{ dimension: string; key_version: number; hits: number }>();
  expect(counters.results).toEqual([
    { dimension: 'account', key_version: 1, hits: 1 },
    { dimension: 'account', key_version: 2, hits: 1 },
    { dimension: 'ip', key_version: 1, hits: 1 },
    { dimension: 'ip', key_version: 2, hits: 1 },
  ]);
  const malformed = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"handle":',
  });
  expect(malformed.status).toBe(400);
  expect(malformed.headers.get('cache-control')).toBe('no-store');
  expect(await malformed.json()).toMatchObject({
    error: { code: 'INVALID_JSON' },
  });
  expect(
    await db
      .prepare(
        "SELECT SUM(hits) AS hits FROM rate_limit_counters WHERE category = 'registration'",
      )
      .first<{ hits: number }>(),
  ).toEqual({ hits: 4 });
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / 3_600_000) * 3_600_000;
  const subjects = await activeAbuseSubjects(
    new SecretAbuseKeyProvider({ read: async () => abuseKeyFixture() }),
    'registration',
    'account',
    'limitedworker',
    new AbortController().signal,
  );
  const store = createD1RateCounterStore(db);
  for (const subject of subjects)
    for (let hit = 0; hit < 5; hit++)
      await store.increment({
        ...subject,
        windowStart,
        expiresAt: windowStart + 3_600_000 + 86_400_000,
      });
  const limited = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'limitedworker',
      password: 'long-functional-password',
    }),
  });
  expect(limited.status).toBe(429);
  expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(limited.headers.get('cache-control')).toBe('no-store');
  expect(await limited.json()).toMatchObject({
    error: { code: 'RATE_LIMITED' },
  });
  expect(
    await db
      .prepare("SELECT 1 FROM identities WHERE subject = 'limitedworker'")
      .first(),
  ).toBeNull();
  await db.prepare('DROP TABLE rate_limit_counters').run();
  const unavailable = await fetch(new URL('/api/v1/accounts/register', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'blockedworker',
      password: 'long-functional-password',
    }),
  });
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toMatchObject({
    error: { code: 'RATE_LIMIT_UNAVAILABLE' },
  });
  expect(
    await db
      .prepare("SELECT 1 FROM identities WHERE subject = 'blockedworker'")
      .first(),
  ).toBeNull();
  const observations = await (
    await fetch(new URL('/_proof/observations', base))
  ).json();
  expect(observations).toContainEqual(
    expect.objectContaining({
      type: 'log',
      event: 'http.request',
      route: 'account.register',
      status: 202,
    }),
  );
  expect(
    (observations as Array<Record<string, unknown>>)
      .filter(
        (item) => item.type === 'log' && item.route === 'account.register',
      )
      .map((item) => item.status),
  ).toEqual([202, 400, 429, 503]);
  expect(observations).toContainEqual(
    expect.objectContaining({ type: 'log', route: 'health.live', status: 200 }),
  );
  expect(observations).toContainEqual(
    expect.objectContaining({
      type: 'security',
      component: 'rate',
      outcome: 'unavailable',
    }),
  );
  expect(observations).toContainEqual(
    expect.objectContaining({
      type: 'security',
      component: 'rate',
      outcome: 'denied',
    }),
  );
  expect(observations).toContainEqual(
    expect.objectContaining({
      type: 'log',
      route: 'account.register',
      status: 503,
    }),
  );
  expect(JSON.stringify(observations)).not.toMatch(
    /realworkeruser|blockedworker|long-functional-password/i,
  );
});
