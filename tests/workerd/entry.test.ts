import { afterAll, beforeAll, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
let mf: Miniflare;
beforeAll(async () => {
  // This lane runs the deployed Cloudflare artifact, not a fixture, so it also
  // proves that the production Worker starts from its chunked output.
  execFileSync(process.execPath, ['tooling/build.ts', '--target=cloudflare']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/cloudflare'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      bindings: {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://frontend.example',
      },
    }),
  );
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
});
it('serves the production Worker with module-initialized AOT and no fixture routes', async () => {
  const base = await mf.ready;
  const health = await fetch(new URL('/health/ready', base));
  expect(health.status).toBe(503);
  expect(await health.json()).toEqual({
    status: 'unavailable',
    deployment: {
      tier: 'standard',
      degradationIds: [],
      passwordHashPolicy: 'argon2id',
    },
  });
  const proof = await fetch(new URL('/_proof/error', base));
  expect(proof.status).toBe(404);
  await proof.text();
  const missingDbCleanup = await (
    await mf.getWorker()
  ).scheduled({
    cron: '*/5 * * * *',
    scheduledTime: new Date(),
  });
  expect(missingDbCleanup.outcome).not.toBe('ok');
});

it('reports configured abuse dependencies ready only while the D1 schema is usable', async () => {
  const tokenKeys = cryptoFixture();
  const configured = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/cloudflare'),
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
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://frontend.example',
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        HYPERBUG_KEY_RING: await tokenKeys.source.read(),
      },
    }),
  );
  try {
    const db = await configured.getD1Database('DB');
    const migrations = await migrationStatements('d1');
    const accountMigration = migrations.at(-8);
    if (accountMigration?.name !== '0010_password_credentials')
      throw new Error('Registration migration missing');
    const sessionMigration = migrations.at(-7);
    if (sessionMigration?.name !== '0011_authorization_sessions')
      throw new Error('Session migration missing');
    const recoveryMigration = migrations.at(-6);
    if (recoveryMigration?.name !== '0012_recovery_codes')
      throw new Error('Recovery migration missing');
    const webauthnMigration = migrations.at(-5);
    if (webauthnMigration?.name !== '0013_webauthn')
      throw new Error('WebAuthn migration missing');
    const oauthMigration = migrations.at(-4);
    if (oauthMigration?.name !== '0014_oauth_codes')
      throw new Error('OAuth migration missing');
    const pluginMigration = migrations.at(-3);
    if (pluginMigration?.name !== '0015_plugin_registry')
      throw new Error('Plugin registry migration missing');
    for (const migration of migrations.slice(0, -8))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const base = await configured.ready;
    const missingCredentials = await fetch(new URL('/health/ready', base));
    expect(missingCredentials.status).toBe(503);
    await db.batch(accountMigration.statements.map((sql) => db.prepare(sql)));
    await db.batch(sessionMigration.statements.map((sql) => db.prepare(sql)));
    await db.batch(recoveryMigration.statements.map((sql) => db.prepare(sql)));
    await db.batch(webauthnMigration.statements.map((sql) => db.prepare(sql)));
    await db.batch(oauthMigration.statements.map((sql) => db.prepare(sql)));
    const missingTokenKey = await fetch(new URL('/health/ready', base));
    expect(missingTokenKey.status).toBe(503);
    expect(missingTokenKey.headers.get('cache-control')).toBe('no-store');
    await db
      .prepare(
        "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
      )
      .bind(Date.now())
      .run();
    const healthy = await fetch(new URL('/health/ready', base));
    expect(healthy.status).toBe(200);
    expect((await healthy.json()).status).toBe('ok');
    await db
      .prepare(
        "INSERT INTO rate_limit_counters (category, dimension, key_version, subject_digest, window_start, hits, expires_at) VALUES ('search', 'route', 1, ?, 0, 1, 1)",
      )
      .bind('e'.repeat(64))
      .run();
    const nowMs = Date.now();
    await db
      .prepare(
        "INSERT INTO rate_limit_counters (category, dimension, key_version, subject_digest, window_start, hits, expires_at) VALUES ('search', 'route', 1, ?, ?, 1, ?)",
      )
      .bind('f'.repeat(64), nowMs, nowMs + 3600000)
      .run();
    const scheduled = await (
      await configured.getWorker()
    ).scheduled({
      cron: '*/5 * * * *',
      scheduledTime: new Date(),
    });
    expect(scheduled.outcome).toBe('ok');
    expect(
      await db
        .prepare(
          "SELECT COUNT(*) AS n FROM rate_limit_counters WHERE category = 'search'",
        )
        .first<{ n: number }>(),
    ).toEqual({ n: 1 });
    expect(
      await db
        .prepare(
          "SELECT subject_digest FROM rate_limit_counters WHERE category = 'search'",
        )
        .first<{ subject_digest: string }>(),
    ).toEqual({ subject_digest: 'f'.repeat(64) });
    const registration = await fetch(
      new URL('/api/v1/accounts/register', base),
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle: 'closedworker',
          password: 'long-test-password',
        }),
      },
    );
    expect(registration.status).toBe(503);
    expect(await registration.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    await db
      .prepare(
        "UPDATE key_versions SET state = 'revoked' WHERE purpose = 'token-hmac' AND key_id = 'token-hmac-test'",
      )
      .run();
    const revokedTokenKey = await fetch(new URL('/health/ready', base));
    expect(revokedTokenKey.status).toBe(503);
    expect(revokedTokenKey.headers.get('cache-control')).toBe('no-store');
    await db.prepare('DROP TABLE rate_limit_counters').run();
    const unavailable = await fetch(new URL('/health/ready', base));
    expect(unavailable.status).toBe(503);
    expect((await unavailable.json()).status).toBe('unavailable');
  } finally {
    await configured.dispose();
  }
});
