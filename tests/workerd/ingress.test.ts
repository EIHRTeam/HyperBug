import { execFileSync } from 'node:child_process';
import { beforeAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import {
  activeAbuseSubjects,
  SecretAbuseKeyProvider,
} from '../../packages/security/src/abuse-keys.ts';
import { createD1RateCounterStore } from '@hyperbug/database-d1';

beforeAll(() => {
  execFileSync(process.execPath, [
    'tooling/build.ts',
    '--target=cloudflare',
    '--target=cloudflare-ingress',
  ]);
});

it('admits registration only through a signed service-bound Workers ingress', async () => {
  const secret = Buffer.alloc(32, 53).toString('base64url');
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-registration' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703396',
              simple: { limit: 2, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_INGRESS_KEY: secret,
          },
        },
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const [api, ingress] = await Promise.all([
      mf.getWorker('api'),
      mf.getWorker('ingress'),
    ]);
    const url = 'https://api.example/api/v1/accounts/register';
    const body = JSON.stringify({
      handle: 'BoundIngressUser',
      password: 'long-functional-password',
    });
    const direct = await api.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.42',
        'x-hyperbug-ingress-ip': '192.0.2.42',
      },
      body,
    });
    expect(direct.status).toBe(503);
    const directMalformed = await api.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"handle":',
    });
    expect(directMalformed.status).toBe(503);
    const untrusted = await ingress.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.42',
        'x-real-ip': '192.0.2.43',
      },
      body,
    });
    expect(untrusted.status).toBe(503);
    expect(untrusted.headers.get('cache-control')).toBe('no-store');
    const crossZone = await ingress.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '2a06:98c0:3600::103',
      },
      body,
    });
    expect(crossZone.status).toBe(503);
    expect(crossZone.headers.get('cache-control')).toBe('no-store');
    for (const status of [400, 400, 429]) {
      const malformed = await ingress.fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '192.0.2.45',
        },
        body: '{"handle":',
      });
      expect(malformed.status).toBe(status);
      expect(malformed.headers.get('cache-control')).toBe('no-store');
      expect(await malformed.json()).toMatchObject({
        error: { code: status === 429 ? 'RATE_LIMITED' : 'INVALID_JSON' },
      });
    }
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM rate_limit_counters WHERE category = 'registration'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    const accepted = await ingress.fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.42',
        'x-hyperbug-ingress-ip': '192.0.2.99',
      },
      body,
    });
    expect(accepted.status, await accepted.clone().text()).toBe(202);
    expect(await accepted.json()).toEqual({ accepted: true });
    const counters = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM rate_limit_counters WHERE category = 'registration' AND dimension = 'ip'",
      )
      .first<{ n: number }>();
    expect(counters?.n).toBe(2);
    const identity = await db
      .prepare(
        "SELECT subject FROM identities WHERE provider = 'local-password'",
      )
      .first<{ subject: string }>();
    expect(identity?.subject).toBe('boundingressuser');
  } finally {
    await mf.dispose();
  }
});

it('denies signed registration when the production Workers limiter binding is unavailable', async () => {
  const secret = Buffer.alloc(32, 56).toString('base64url');
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      upstream: 'https://api.example',
      workers: [
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-limiter-outage' },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example,https://api.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_INGRESS_KEY: secret,
          },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const ingress = await mf.getWorker('ingress');
    const denied = await ingress.fetch(
      'https://api.example/api/v1/accounts/register',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '192.0.2.56',
        },
        body: JSON.stringify({
          handle: 'outagelimiter',
          password: 'long-functional-password',
        }),
      },
    );
    expect(denied.status).toBe(503);
    expect(denied.headers.get('cache-control')).toBe('no-store');
    expect(await denied.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM rate_limit_counters WHERE category = 'registration'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM identities WHERE subject = 'outagelimiter'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    const login = await mf.dispatchFetch('https://api.example/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.56',
        origin: 'https://api.example',
      },
      body: JSON.stringify({
        handle: 'outagelimiter',
        password: 'long-functional-password',
      }),
    });
    expect(login.status, await login.clone().text()).toBe(503);
    expect(login.headers.get('cache-control')).toBe('no-store');
    expect(await login.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM rate_limit_counters WHERE category = 'login'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    const session = await mf.dispatchFetch('https://api.example/auth/session', {
      headers: {
        'cf-connecting-ip': '192.0.2.56',
        origin: 'https://api.example',
        cookie: '__Host-hb_session=invalid',
      },
    });
    expect(session.status, await session.clone().text()).toBe(503);
    expect(session.headers.get('cache-control')).toBe('no-store');
    expect(await session.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    const logout = await mf.dispatchFetch('https://api.example/auth/logout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '192.0.2.56',
        origin: 'https://api.example',
        cookie: '__Host-hb_session=invalid',
      },
      body: '{}',
    });
    expect(logout.status, await logout.clone().text()).toBe(503);
    expect(logout.headers.get('cache-control')).toBe('no-store');
    expect(await logout.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
  } finally {
    await mf.dispose();
  }
});

it('binds signed production login to a D1 session, revocation and credential revision', async () => {
  const secret = Buffer.alloc(32, 57).toString('base64url');
  const keyRing = await cryptoFixture().source.read();
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      upstream: 'https://api.example',
      workers: [
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-login-session' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703394',
              simple: { limit: 1000, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example,https://api.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_KEY_RING: keyRing,
            HYPERBUG_INGRESS_KEY: secret,
          },
        },
        {
          name: 'ingress-bad-token-key',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api-bad-token-key' },
        },
        {
          name: 'api-bad-token-key',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-login-session' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703388',
              simple: { limit: 1000, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example,https://api.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_KEY_RING: '{',
            HYPERBUG_INGRESS_KEY: secret,
          },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    await db
      .prepare(
        "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
      )
      .bind(Date.now())
      .run();
    const ingress = await mf.getWorker('ingress');
    const ip = '192.0.2.57';
    const origin = 'https://api.example';
    const loginUrl = `${origin}/auth/login`;
    const accountBody = JSON.stringify({
      handle: 'IngressLoginUser',
      password: 'long-functional-password',
    });
    const headers = {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
      origin,
      'sec-fetch-site': 'same-origin',
    };
    const registered = await ingress.fetch(
      `${origin}/api/v1/accounts/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: accountBody,
      },
    );
    expect(registered.status, await registered.clone().text()).toBe(202);
    const keyFailureBody = JSON.stringify({
      handle: 'KeyFailureUser',
      password: 'long-functional-password',
    });
    const keyFailureRegistered = await ingress.fetch(
      `${origin}/api/v1/accounts/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: keyFailureBody,
      },
    );
    expect(
      keyFailureRegistered.status,
      await keyFailureRegistered.clone().text(),
    ).toBe(202);

    const badOrigin = await mf.dispatchFetch(loginUrl, {
      method: 'POST',
      headers: { ...headers, origin: 'https://evil.example' },
      body: accountBody,
    });
    expect(badOrigin.status).toBe(403);
    expect(await badOrigin.json()).toMatchObject({
      error: { code: 'ORIGIN_FORBIDDEN' },
    });
    const postLogin = (body: string) =>
      mf.dispatchFetch(loginUrl, { method: 'POST', headers, body });
    for (const body of [
      JSON.stringify({
        handle: 'IngressLoginUser',
        password: 'wrong-functional-password',
      }),
      JSON.stringify({
        handle: 'unknownloginuser',
        password: 'long-functional-password',
      }),
    ]) {
      const denied = await postLogin(body);
      expect(denied.status).toBe(401);
      expect(denied.headers.get('set-cookie')).toBeNull();
      expect(denied.headers.get('cache-control')).toBe('no-store');
      expect(await denied.json()).toMatchObject({
        error: { code: 'LOGIN_DENIED' },
      });
    }
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });

    const first = await postLogin(accountBody);
    expect(first.status, await first.clone().text()).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.json()).toEqual({ authenticated: true });
    const firstCookie = first.headers.get('set-cookie');
    expect(firstCookie).toMatch(
      /^__Host-hb_session=[^;]+; Max-Age=604800; Path=\/; Secure; HttpOnly; SameSite=Lax$/,
    );
    const firstPair = firstCookie!.split(';', 1)[0]!;
    const session = (cookie: string) =>
      mf.dispatchFetch(`${origin}/auth/session`, {
        headers: {
          'cf-connecting-ip': ip,
          cookie,
          origin,
          'sec-fetch-site': 'same-origin',
        },
      });
    const tamperedPair = `${firstPair.slice(0, -1)}${firstPair.endsWith('A') ? 'B' : 'A'}`;
    const tampered = await session(tamperedPair);
    expect(tampered.status).toBe(401);
    expect(tampered.headers.get('cache-control')).toBe('no-store');
    expect(await tampered.json()).toMatchObject({
      error: { code: 'LOGIN_DENIED' },
    });
    const badIngress = await mf.getWorker('ingress-bad-token-key');
    const keyUnavailable = await badIngress.fetch(`${origin}/auth/session`, {
      headers: { 'cf-connecting-ip': ip, cookie: firstPair },
    });
    expect(keyUnavailable.status, await keyUnavailable.clone().text()).toBe(
      503,
    );
    expect(keyUnavailable.headers.get('cache-control')).toBe('no-store');
    expect(await keyUnavailable.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    const unavailableLogout = await badIngress.fetch(`${origin}/auth/logout`, {
      method: 'POST',
      headers: {
        'cf-connecting-ip': ip,
        origin,
        'content-type': 'application/json',
        cookie: firstPair,
      },
      body: '{}',
    });
    expect(unavailableLogout.status).toBe(503);
    expect(unavailableLogout.headers.get('cache-control')).toBe('no-store');
    expect(unavailableLogout.headers.get('set-cookie')).toBeNull();
    expect(await unavailableLogout.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    const wrongPasswordWithBadKey = await badIngress.fetch(loginUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        handle: 'KeyFailureUser',
        password: 'wrong-functional-password',
      }),
    });
    expect(wrongPasswordWithBadKey.status).toBe(401);
    expect(await wrongPasswordWithBadKey.json()).toMatchObject({
      error: { code: 'LOGIN_DENIED' },
    });
    const unavailableKeyLogin = await badIngress.fetch(loginUrl, {
      method: 'POST',
      headers,
      body: keyFailureBody,
    });
    expect(unavailableKeyLogin.status).toBe(503);
    expect(unavailableKeyLogin.headers.get('cache-control')).toBe('no-store');
    expect(unavailableKeyLogin.headers.get('set-cookie')).toBeNull();
    expect(await unavailableKeyLogin.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
        .first<{ n: number }>(),
    ).toEqual({ n: 1 });
    const active = await session(firstPair);
    expect(active.status).toBe(200);
    expect(await active.json()).toEqual({ authenticated: true });
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS n FROM authorization_sessions WHERE revoked_at IS NULL',
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 1 });
    const loggedOut = await mf.dispatchFetch(`${origin}/auth/logout`, {
      method: 'POST',
      headers: { ...headers, cookie: firstPair },
      body: '{}',
    });
    expect(loggedOut.status).toBe(204);
    expect(loggedOut.headers.get('set-cookie')).toMatch(
      /^__Host-hb_session=; Max-Age=0; Path=\/; Secure; HttpOnly; SameSite=Lax$/,
    );
    const revoked = await session(firstPair);
    expect(revoked.status).toBe(401);
    expect(await revoked.json()).toMatchObject({
      error: { code: 'LOGIN_DENIED' },
    });

    const second = await postLogin(accountBody);
    expect(second.status, await second.clone().text()).toBe(200);
    const secondPair = second.headers.get('set-cookie')!.split(';', 1)[0]!;
    expect(secondPair).not.toBe(firstPair);
    await db
      .prepare(
        'UPDATE password_credentials SET revision = revision + 1 WHERE identity_id = (SELECT id FROM identities WHERE subject = ?)',
      )
      .bind('ingressloginuser')
      .run();
    const stale = await session(secondPair);
    expect(stale.status).toBe(401);
    expect(await stale.json()).toMatchObject({
      error: { code: 'LOGIN_DENIED' },
    });
    expect(
      await db
        .prepare(
          'SELECT COUNT(*) AS n FROM authorization_sessions WHERE revoked_at IS NOT NULL',
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 1 });

    const nowMs = Date.now();
    const windowStart = Math.floor(nowMs / 3_600_000) * 3_600_000;
    const subjects = await activeAbuseSubjects(
      new SecretAbuseKeyProvider({ read: async () => abuseKeyFixture() }),
      'login',
      'account',
      'primarylocked',
      new AbortController().signal,
    );
    expect(subjects.map((subject) => subject.keyVersion)).toEqual([2, 1]);
    const store = createD1RateCounterStore(db);
    for (let hit = 0; hit < 5; hit++)
      await store.increment({
        ...subjects[1]!,
        windowStart,
        expiresAt: windowStart + 3_600_000 + 86_400_000,
      });
    const limited = await postLogin(
      JSON.stringify({
        handle: 'primarylocked',
        password: 'long-functional-password',
      }),
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get('cache-control')).toBe('no-store');
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await limited.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    expect(
      (
        await db
          .prepare(
            "SELECT key_version, hits FROM rate_limit_counters WHERE category = 'login' AND dimension = 'account' AND subject_digest IN (?, ?) ORDER BY key_version",
          )
          .bind(subjects[0]!.digest, subjects[1]!.digest)
          .all<{ key_version: number; hits: number }>()
      ).results,
    ).toEqual([
      { key_version: 1, hits: 6 },
      { key_version: 2, hits: 1 },
    ]);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
        .first<{ n: number }>(),
    ).toEqual({ n: 2 });
    const current = await postLogin(accountBody);
    expect(current.status).toBe(200);
    const currentPair = current.headers.get('set-cookie')!.split(';', 1)[0]!;
    expect((await session(currentPair)).status).toBe(200);
    await db
      .prepare(
        "CREATE TRIGGER deny_session_insert BEFORE INSERT ON authorization_sessions BEGIN SELECT RAISE(ABORT, 'private session write outage'); END",
      )
      .run();
    try {
      const writeUnavailable = await postLogin(accountBody);
      expect(writeUnavailable.status).toBe(503);
      expect(writeUnavailable.headers.get('cache-control')).toBe('no-store');
      expect(writeUnavailable.headers.get('set-cookie')).toBeNull();
      expect(await writeUnavailable.json()).toMatchObject({
        error: { code: 'AUTHORIZATION_UNAVAILABLE' },
      });
      expect(
        await db
          .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
          .first<{ n: number }>(),
      ).toEqual({ n: 3 });
    } finally {
      await db.prepare('DROP TRIGGER deny_session_insert').run();
    }
    await db.prepare('DROP TABLE rate_limit_counters').run();
    const primaryUnavailable = await postLogin(accountBody);
    expect(primaryUnavailable.status).toBe(503);
    expect(primaryUnavailable.headers.get('cache-control')).toBe('no-store');
    expect(primaryUnavailable.headers.get('set-cookie')).toBeNull();
    expect(await primaryUnavailable.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
        .first<{ n: number }>(),
    ).toEqual({ n: 3 });
    await db.prepare('DROP TABLE authorization_sessions').run();
    const sessionUnavailable = await session(currentPair);
    expect(sessionUnavailable.status).toBe(503);
    expect(sessionUnavailable.headers.get('cache-control')).toBe('no-store');
    expect(await sessionUnavailable.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    const logoutUnavailable = await mf.dispatchFetch(`${origin}/auth/logout`, {
      method: 'POST',
      headers: { ...headers, cookie: currentPair },
      body: '{}',
    });
    expect(logoutUnavailable.status).toBe(503);
    expect(logoutUnavailable.headers.get('cache-control')).toBe('no-store');
    expect(logoutUnavailable.headers.get('set-cookie')).toBeNull();
    expect(await logoutUnavailable.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
  } finally {
    await mf.dispose();
  }
});

it('sheds the third signed session read and logout before touching D1 session state', async () => {
  const secret = Buffer.alloc(32, 60).toString('base64url');
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      upstream: 'https://api.example',
      workers: [
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-session-preparse-limit' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703389',
              simple: { limit: 2, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example,https://api.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
            HYPERBUG_INGRESS_KEY: secret,
          },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    await db
      .prepare(
        "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
      )
      .bind(Date.now())
      .run();
    const origin = 'https://api.example';
    const ip = '192.0.2.60';
    const body = JSON.stringify({
      handle: 'SessionPreparseUser',
      password: 'long-functional-password',
    });
    const registered = await mf.dispatchFetch(
      `${origin}/api/v1/accounts/register`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': ip,
        },
        body,
      },
    );
    expect(registered.status, await registered.clone().text()).toBe(202);
    const login = await mf.dispatchFetch(`${origin}/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': ip,
        origin,
        'sec-fetch-site': 'same-origin',
      },
      body,
    });
    expect(login.status, await login.clone().text()).toBe(200);
    const cookie = login.headers.get('set-cookie')!.split(';', 1)[0]!;
    const session = () =>
      mf.dispatchFetch(`${origin}/auth/session`, {
        headers: {
          'cf-connecting-ip': ip,
          origin,
          'sec-fetch-site': 'same-origin',
          cookie,
        },
      });
    for (let hit = 0; hit < 2; hit++) {
      const allowed = await session();
      expect(allowed.status, await allowed.clone().text()).toBe(200);
      expect(await allowed.json()).toEqual({ authenticated: true });
    }
    // A storage read would now deny the cookie; 429 proves route shedding wins.
    await db
      .prepare('UPDATE authorization_sessions SET revoked_at = created_at')
      .run();
    const beforeShed = await db
      .prepare('SELECT idle_expires_at, revoked_at FROM authorization_sessions')
      .first<{ idle_expires_at: number; revoked_at: number | null }>();
    expect(beforeShed?.revoked_at).toBeTypeOf('number');
    const shedSession = await session();
    expect(shedSession.status).toBe(429);
    expect(shedSession.headers.get('cache-control')).toBe('no-store');
    expect(await shedSession.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    expect(
      await db
        .prepare(
          'SELECT idle_expires_at, revoked_at FROM authorization_sessions',
        )
        .first<{ idle_expires_at: number; revoked_at: number | null }>(),
    ).toEqual(beforeShed);
    await db
      .prepare('UPDATE authorization_sessions SET revoked_at = NULL')
      .run();

    const logout = () =>
      mf.dispatchFetch(`${origin}/auth/logout`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': ip,
          origin,
          'sec-fetch-site': 'same-origin',
          cookie,
        },
        body: '{}',
      });
    const firstLogout = await logout();
    expect(firstLogout.status).toBe(204);
    expect(firstLogout.headers.get('set-cookie')).toMatch(
      /^__Host-hb_session=; Max-Age=0; Path=\/; Secure; HttpOnly; SameSite=Lax$/,
    );
    const secondLogout = await logout();
    expect(secondLogout.status).toBe(204);
    const beforeLogoutShed = await db
      .prepare('SELECT idle_expires_at, revoked_at FROM authorization_sessions')
      .first<{ idle_expires_at: number; revoked_at: number | null }>();
    expect(beforeLogoutShed?.revoked_at).toBeTypeOf('number');
    const shedLogout = await logout();
    expect(shedLogout.status).toBe(429);
    expect(shedLogout.headers.get('cache-control')).toBe('no-store');
    expect(await shedLogout.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    expect(
      await db
        .prepare(
          'SELECT idle_expires_at, revoked_at FROM authorization_sessions',
        )
        .first<{ idle_expires_at: number; revoked_at: number | null }>(),
    ).toEqual(beforeLogoutShed);
  } finally {
    await mf.dispose();
  }
});

it('requires configured login CAPTCHA through signed ingress and denies provider failure', async () => {
  const secret = Buffer.alloc(32, 58).toString('base64url');
  let providerMode: 'accept' | 'wrong-action' | 'outage' = 'accept';
  let providerCalls = 0;
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      upstream: 'https://api.example',
      workers: [
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-login-captcha' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703393',
              simple: { limit: 1000, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example,https://api.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
            HYPERBUG_INGRESS_KEY: secret,
            TURNSTILE_SECRET: 'private-fixture-secret',
            TURNSTILE_SITE_KEY: 'public-fixture-key',
            TURNSTILE_HOSTNAME: 'frontend.example',
          },
          outboundService: async (request) => {
            providerCalls++;
            expect(request.url).toBe(
              'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            );
            expect(request.method).toBe('POST');
            if (providerMode === 'outage')
              throw new Error('fixture provider offline');
            return new Response(
              JSON.stringify({
                success: true,
                hostname: 'frontend.example',
                action:
                  providerMode === 'wrong-action'
                    ? 'register'
                    : new URLSearchParams(await request.text()).get(
                          'response',
                        ) === 'register-token'
                      ? 'register'
                      : 'login',
                challenge_ts: new Date().toISOString(),
              }),
              { headers: { 'content-type': 'application/json' } },
            );
          },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    await db
      .prepare(
        "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
      )
      .bind(Date.now())
      .run();
    const origin = 'https://api.example';
    const ip = '192.0.2.58';
    const body = {
      handle: 'CaptchaLoginUser',
      password: 'long-functional-password',
    };
    const registered = await mf.dispatchFetch(
      `${origin}/api/v1/accounts/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
        body: JSON.stringify({ ...body, captchaToken: 'register-token' }),
      },
    );
    expect(registered.status, await registered.clone().text()).toBe(202);
    const challenge = await mf.dispatchFetch(`${origin}/auth/login`, {
      headers: { 'cf-connecting-ip': ip },
    });
    expect(await challenge.json()).toEqual({
      captchaRequired: true,
      captchaSiteKey: 'public-fixture-key',
      captchaAction: 'login',
    });
    const post = (captchaToken?: string) =>
      mf.dispatchFetch(`${origin}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': ip,
          origin,
          'sec-fetch-site': 'same-origin',
        },
        body: JSON.stringify({
          ...body,
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });
    const missing = await post();
    expect(missing.status).toBe(403);
    expect(await missing.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    expect(providerCalls).toBe(1);
    providerMode = 'wrong-action';
    const wrongAction = await post('wrong-action-token');
    expect(wrongAction.status).toBe(403);
    expect(await wrongAction.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    providerMode = 'outage';
    const unavailable = await post('outage-token');
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM authorization_sessions')
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    providerMode = 'accept';
    const accepted = await post('login-token');
    expect(accepted.status, await accepted.clone().text()).toBe(200);
    expect(accepted.headers.get('set-cookie')).toMatch(/^__Host-hb_session=/);
    expect(await accepted.json()).toEqual({ authenticated: true });
    expect(providerCalls).toBe(4);
  } finally {
    await mf.dispose();
  }
});

it('requires configured CAPTCHA through signed Workers ingress and closes on unsafe provider responses', async () => {
  const secret = Buffer.alloc(32, 54).toString('base64url');
  let providerCalls = 0;
  let providerMode: 'accept' | 'outage' | 'redirect' | 'oversized' | 'timeout' =
    'accept';
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-captcha' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703395',
              simple: { limit: 1000, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_INGRESS_KEY: secret,
            TURNSTILE_SECRET: 'private-fixture-secret',
            TURNSTILE_SITE_KEY: 'public-fixture-key',
            TURNSTILE_HOSTNAME: 'frontend.example',
          },
          outboundService: async (request) => {
            providerCalls++;
            expect(request.url).toBe(
              'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            );
            expect(request.method).toBe('POST');
            const body = await request.text();
            expect(body).toContain('secret=private-fixture-secret');
            if (providerMode === 'outage')
              throw new Error('fixture provider offline');
            if (providerMode === 'timeout')
              await new Promise((resolve) => setTimeout(resolve, 3300));
            if (providerMode === 'redirect')
              return new Response(null, {
                status: 302,
                headers: { location: 'http://169.254.169.254/' },
              });
            if (providerMode === 'oversized')
              return new Response('x'.repeat(8193), {
                headers: { 'content-type': 'application/json' },
              });
            return new Response(
              JSON.stringify({
                success: true,
                hostname: 'frontend.example',
                action: 'register',
                challenge_ts: new Date().toISOString(),
              }),
              { headers: { 'content-type': 'application/json' } },
            );
          },
        },
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const ingress = await mf.getWorker('ingress');
    const url = 'https://api.example/api/v1/accounts/register';
    const challenge = await ingress.fetch(url, {
      headers: { 'cf-connecting-ip': '192.0.2.44' },
    });
    expect(await challenge.json()).toEqual({
      captchaRequired: true,
      captchaSiteKey: 'public-fixture-key',
      captchaAction: 'register',
    });
    const post = (handle: string, captchaToken?: string) =>
      ingress.fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '192.0.2.44',
        },
        body: JSON.stringify({
          handle,
          password: 'long-functional-password',
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });
    const missing = await post('missingchallenge');
    expect(missing.status).toBe(403);
    expect(providerCalls).toBe(0);
    const accepted = await post('acceptedchallenge', 'fixture-challenge');
    expect(accepted.status, await accepted.clone().text()).toBe(202);
    expect(providerCalls).toBe(1);
    providerMode = 'outage';
    const outage = await post('outagechallenge', 'fixture-challenge-2');
    expect(outage.status).toBe(503);
    expect(providerCalls).toBe(2);
    providerMode = 'redirect';
    const redirected = await post('redirectchallenge', 'fixture-challenge-3');
    expect(redirected.status).toBe(503);
    expect(await redirected.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    providerMode = 'oversized';
    const oversized = await post('oversizechallenge', 'fixture-challenge-4');
    expect(oversized.status).toBe(503);
    expect(await oversized.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    providerMode = 'timeout';
    const stalledAt = performance.now();
    const timedOut = await post('timeoutchallenge', 'fixture-challenge-5');
    expect(timedOut.status).toBe(503);
    expect(performance.now() - stalledAt).toBeLessThan(4500);
    expect(await timedOut.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    expect(providerCalls).toBe(5);
    const stored = await db
      .prepare(
        "SELECT subject FROM identities WHERE provider = 'local-password' ORDER BY subject",
      )
      .all<{ subject: string }>();
    expect(stored.results.map((row) => row.subject)).toEqual([
      'acceptedchallenge',
    ]);
  } finally {
    await mf.dispose();
  }
});

it('rejects a ninth signed registration while eight Siteverify calls are in flight and recovers', async () => {
  const secret = Buffer.alloc(32, 59).toString('base64url');
  const blockedProviders: Array<(response: Response) => void> = [];
  let providerCalls = 0;
  let holdProviders = true;
  let eightEntered!: () => void;
  const eightEnteredProvider = new Promise<void>((resolve) => {
    eightEntered = resolve;
  });
  const providerDenial = () =>
    new Response(
      JSON.stringify({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'api',
          modules: workerModules('dist/cloudflare'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          d1Databases: { DB: 'ingress-provider-concurrency' },
          ratelimits: {
            ABUSE_VOLUMETRIC: {
              namespace_id: '703390',
              simple: { limit: 1000, period: 60 },
            },
          },
          bindings: {
            HYPERBUG_ENV: 'production',
            ALLOWED_ORIGINS: 'https://frontend.example',
            HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
            HYPERBUG_INGRESS_KEY: secret,
            TURNSTILE_SECRET: 'private-fixture-secret',
            TURNSTILE_SITE_KEY: 'public-fixture-key',
            TURNSTILE_HOSTNAME: 'frontend.example',
          },
          outboundService: async (request) => {
            providerCalls++;
            expect(request.url).toBe(
              'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            );
            expect(request.method).toBe('POST');
            expect(await request.text()).toContain(
              'secret=private-fixture-secret',
            );
            if (holdProviders) {
              return new Promise<Response>((resolve) => {
                blockedProviders.push(resolve);
                if (blockedProviders.length === 8) eightEntered();
              });
            }
            return new Response(
              JSON.stringify({
                success: true,
                hostname: 'frontend.example',
                action: 'register',
                challenge_ts: new Date().toISOString(),
              }),
              { headers: { 'content-type': 'application/json' } },
            );
          },
        },
        {
          name: 'ingress',
          modules: workerModules('dist/cloudflare-ingress'),
          compatibilityDate: '2026-09-16',
          compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
          bindings: { HYPERBUG_INGRESS_KEY: secret },
          serviceBindings: { API: 'api' },
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database('DB', 'api');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const ingress = await mf.getWorker('ingress');
    const post = (handle: string) =>
      ingress.fetch('https://api.example/api/v1/accounts/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'cf-connecting-ip': '192.0.2.59',
        },
        body: JSON.stringify({
          handle,
          password: 'long-functional-password',
          captchaToken: `token-${handle}`,
        }),
      });
    const held = Array.from({ length: 8 }, (_, index) =>
      post(`providerheld${index}`),
    );
    let enteredTimer: ReturnType<typeof setTimeout> | undefined;
    const enteredTimeout = new Promise<never>((_, reject) => {
      enteredTimer = setTimeout(
        () => reject(new Error('Eight Siteverify calls did not enter')),
        2000,
      );
    });
    try {
      await Promise.race([eightEnteredProvider, enteredTimeout]);
    } finally {
      clearTimeout(enteredTimer);
    }
    expect(providerCalls).toBe(8);
    const saturated = await post('providersaturated');
    expect(saturated.status, await saturated.clone().text()).toBe(503);
    expect(saturated.headers.get('cache-control')).toBe('no-store');
    expect(await saturated.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    expect(providerCalls).toBe(8);
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n, MIN(hits) AS minHits, MAX(hits) AS maxHits FROM rate_limit_counters WHERE category = 'registration' AND dimension = 'ip'",
        )
        .first<{ n: number; minHits: number; maxHits: number }>(),
    ).toEqual({ n: 2, minHits: 9, maxHits: 9 });
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM identities WHERE provider = 'local-password'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    holdProviders = false;
    for (const release of blockedProviders) release(providerDenial());
    const denied = await Promise.all(held);
    for (const response of denied) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        error: { code: 'CAPTCHA_DENIED' },
      });
    }
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM identities WHERE provider = 'local-password'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    const recovered = await post('providerrecovered');
    expect(recovered.status, await recovered.clone().text()).toBe(202);
    expect(providerCalls).toBe(9);
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n, MIN(hits) AS minHits, MAX(hits) AS maxHits FROM rate_limit_counters WHERE category = 'registration' AND dimension = 'ip'",
        )
        .first<{ n: number; minHits: number; maxHits: number }>(),
    ).toEqual({ n: 2, minHits: 10, maxHits: 10 });
    const stored = await db
      .prepare(
        "SELECT subject FROM identities WHERE provider = 'local-password'",
      )
      .all<{ subject: string }>();
    expect(stored.results.map((row) => row.subject)).toEqual([
      'providerrecovered',
    ]);
  } finally {
    holdProviders = false;
    for (const release of blockedProviders) release(providerDenial());
    await mf.dispose();
  }
});
