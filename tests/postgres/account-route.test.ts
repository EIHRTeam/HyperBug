import {
  adaptMinimumPasswordService,
  createMinimumPasswordService,
  minimumTierPasswordPolicy,
  withMinimumPasswordUpgrade,
} from '../../packages/security/src/index.ts';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { node } from '@elysia/node';
import {
  configureOptionalTurnstile,
  createApp,
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { activeAbuseSubjects } from '../../packages/security/src/abuse-keys.ts';
import { createOutboundFetcher } from '../../packages/security/src/outbound.ts';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { createNodeVolumetricLimiter } from '../../apps/api-node/src/rate-limit.ts';
import { createNodeStandardPasswordService } from '../../apps/api-node/src/standard-password.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { createNodeOutboundFetcher } from '../../apps/api-node/src/outbound.ts';
import { listenNode } from '../../apps/api-node/src/listen.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { postgresNodeBindings } from '../fixtures/postgres-node-bindings.ts';

const databaseName = 'hyperbug_registration_route_test';
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let keyFile: string;
let tokenKeyFile: string;
let base: string;
let registrationStatements: string[];
let sessionStatements: string[];
let recoveryStatements: string[];
let webauthnStatements: string[];
let oauthStatements: string[];
const sessionKeys = cryptoFixture();
const observations: string[] = [];

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
  const registrationMigration = migrations.find(
    (entry) => entry.name === '0009_password_credentials',
  );
  if (!registrationMigration) throw new Error('Registration migration missing');
  registrationStatements = registrationMigration.statements;
  const sessionMigration = migrations.find(
    (migration) => migration.name === '0010_authorization_sessions',
  );
  if (!sessionMigration)
    throw new Error('Authorization session migration missing');
  sessionStatements = sessionMigration.statements;
  const recoveryMigration = migrations.find(
    (migration) => migration.name === '0011_recovery_codes',
  );
  if (!recoveryMigration) throw new Error('Recovery migration missing');
  recoveryStatements = recoveryMigration.statements;
  const webauthnMigration = migrations.find(
    (migration) => migration.name === '0012_webauthn',
  );
  if (!webauthnMigration) throw new Error('WebAuthn migration missing');
  webauthnStatements = webauthnMigration.statements;
  const oauthMigration = migrations.find(
    (migration) => migration.name === '0013_oauth_codes',
  );
  if (!oauthMigration) throw new Error('OAuth migration missing');
  oauthStatements = [
    ...oauthMigration.statements,
    ...migrations.find((m) => m.name === '0024_token_assurance')!.statements,
  ];
  for (const migration of migrations.slice(
    0,
    migrations.findIndex((entry) => entry.name === '0009_password_credentials'),
  )) {
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-account-route-'));
  keyFile = join(directory, 'abuse.json');
  tokenKeyFile = join(directory, 'token.json');
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
      telemetry: jsonTelemetry((line) => observations.push(line)),
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      registrationStore: configured.registrationStore,
      passwordStore: configured.passwordStore,
      sessionStore: configured.sessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: withMinimumPasswordUpgrade(
        createNodeStandardPasswordService(
          config.deployment,
          initialStandardPasswordPolicy,
          1,
          initialStandardPasswordPolicy.maximum.memoryKiB,
        ),
        adaptMinimumPasswordService(() =>
          createMinimumPasswordService(
            sessionKeys.provider,
            minimumTierPasswordPolicy,
          ),
        ),
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

it('registers a real User through Node, primary counters and PostgreSQL atomically', async () => {
  const missingCredentials = await fetch(base + '/health/ready');
  expect(missingCredentials.status).toBe(503);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    for (const statement of [
      ...registrationStatements,
      ...sessionStatements,
      ...recoveryStatements,
      ...webauthnStatements,
      ...oauthStatements,
    ])
      await db.query(statement);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
  const ready = await fetch(base + '/health/ready');
  expect(ready.status).toBe(200);
  await pool.query(
    "INSERT INTO rate_limit_counters (category, dimension, key_version, subject_digest, window_start, hits, expires_at) VALUES ('search', 'route', 1, $1, 0, 1, 1)",
    ['e'.repeat(64)],
  );
  expect(await configured.purgeExpiredRateCounters(Date.now())).toBe(1);
  expect(
    (
      await pool.query(
        "SELECT 1 FROM rate_limit_counters WHERE category = 'search'",
      )
    ).rowCount,
  ).toBe(0);
  await writeFile(tokenKeyFile, '{', { mode: 0o600 });
  const unavailableTokenKey = await fetch(base + '/health/ready');
  expect(unavailableTokenKey.status).toBe(503);
  expect(unavailableTokenKey.headers.get('cache-control')).toBe('no-store');
  await writeFile(tokenKeyFile, await sessionKeys.source.read(), {
    mode: 0o600,
  });
  expect((await fetch(base + '/health/ready')).status).toBe(200);
  expect(
    observations
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((item) => item.type === 'log' && item.route === 'health.ready')
      .map((item) => item.status),
  ).toEqual([503, 200, 503, 200]);
  const response = await fetch(base + '/api/v1/accounts/register', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.89',
    },
    body: JSON.stringify({
      handle: 'RealNodeUser',
      password: 'long-functional-password',
    }),
  });
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: true });
  expect(
    observations.map((line) => JSON.parse(line) as Record<string, unknown>),
  ).toContainEqual(
    expect.objectContaining({
      type: 'log',
      event: 'http.request',
      route: 'account.register',
      status: 202,
    }),
  );
  const rows = await pool.query<{
    kind: string;
    subject: string;
    record: { alg: string };
  }>(
    "SELECT p.kind, i.subject, c.record FROM principals p JOIN identities i ON i.principal_id = p.id JOIN password_credentials c ON c.identity_id = i.id WHERE i.provider = 'local-password' AND i.issuer = 'hyperbug'",
  );
  expect(rows.rows).toEqual([
    {
      kind: 'user',
      subject: 'realnodeuser',
      record: expect.objectContaining({ alg: 'Argon2id' }),
    },
  ]);
  const counts = await pool.query<{
    dimension: string;
    key_version: number;
    hits: number;
  }>(
    "SELECT dimension, key_version, hits FROM rate_limit_counters WHERE category = 'registration' ORDER BY dimension, key_version",
  );
  expect(counts.rows).toEqual([
    { dimension: 'account', key_version: 1, hits: 1 },
    { dimension: 'account', key_version: 2, hits: 1 },
    { dimension: 'ip', key_version: 1, hits: 1 },
    { dimension: 'ip', key_version: 2, hits: 1 },
  ]);
  const malformed = await fetch(base + '/api/v1/accounts/register', {
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
    (
      await pool.query(
        "SELECT SUM(hits)::int AS hits FROM rate_limit_counters WHERE category = 'registration'",
      )
    ).rows[0]?.hits,
  ).toBe(4);
  if (!configured.abuse) throw new Error('Authoritative abuse store missing');
  const shedConfig = loadConfig(
    { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
    'node',
  );
  const shedListener = await listenNode(
    createApp({
      adapter: node(),
      config: shedConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: {
        ...configured.abuse,
        limiter: createNodeVolumetricLimiter({
          limit: 2,
          windowMs: 60000,
          maxKeys: 100,
        }),
      },
      registrationStore: configured.registrationStore,
      standardPassword: createNodeStandardPasswordService(
        shedConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    for (const status of [400, 400, 429]) {
      const denied = await fetch(
        shedListener.url + '/api/v1/accounts/register',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{"handle":',
        },
      );
      expect(denied.status).toBe(status);
      expect(denied.headers.get('cache-control')).toBe('no-store');
      expect(await denied.json()).toMatchObject({
        error: { code: status === 429 ? 'RATE_LIMITED' : 'INVALID_JSON' },
      });
    }
  } finally {
    await shedListener.close();
  }
  const beforeLimiterOutage = await pool.query<{ hits: number }>(
    "SELECT COALESCE(SUM(hits), 0)::int AS hits FROM rate_limit_counters WHERE category = 'registration'",
  );
  const unavailableLimiter = await listenNode(
    createApp({
      adapter: node(),
      config: shedConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: {
        ...configured.abuse,
        limiter: {
          consume: async () => ({ allowed: false, reason: 'unavailable' }),
        },
      },
      registrationStore: configured.registrationStore,
      standardPassword: createNodeStandardPasswordService(
        shedConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    const denied = await fetch(
      unavailableLimiter.url + '/api/v1/accounts/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
  } finally {
    await unavailableLimiter.close();
  }
  expect(
    await pool.query<{ hits: number }>(
      "SELECT COALESCE(SUM(hits), 0)::int AS hits FROM rate_limit_counters WHERE category = 'registration'",
    ),
  ).toMatchObject({ rows: beforeLimiterOutage.rows });
  expect(
    await pool.query(
      "SELECT 1 FROM identities WHERE subject = 'outagelimiter'",
    ),
  ).toMatchObject({ rowCount: 0 });
  expect(
    (
      await pool.query(
        "SELECT SUM(hits)::int AS hits FROM rate_limit_counters WHERE category = 'registration'",
      )
    ).rows[0]?.hits,
  ).toBe(4);
  const nowMs = Date.now();
  const windowStart = Math.floor(nowMs / 3_600_000) * 3_600_000;
  const subjects = await activeAbuseSubjects(
    configured.abuse.provider,
    'registration',
    'account',
    'limitednode',
    new AbortController().signal,
  );
  for (const subject of subjects)
    for (let hit = 0; hit < 5; hit++)
      await configured.abuse.store.increment({
        ...subject,
        windowStart,
        expiresAt: windowStart + 3_600_000 + 86_400_000,
      });
  const limited = await fetch(base + '/api/v1/accounts/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'limitednode',
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
    await pool.query("SELECT 1 FROM identities WHERE subject = 'limitednode'"),
  ).toMatchObject({ rowCount: 0 });
  const sharedSubjects = await activeAbuseSubjects(
    configured.abuse.provider,
    'registration',
    'account',
    'realnodeuser',
    new AbortController().signal,
  );
  for (const subject of sharedSubjects)
    for (let hit = 0; hit < 4; hit++)
      await configured.abuse.store.increment({
        ...subject,
        windowStart,
        expiresAt: windowStart + 3_600_000 + 86_400_000,
      });
  const secondRoot = configureNodeAbuseAdmission(
    {
      ...postgresNodeBindings(databaseName),
      keyFile,
    },
    'local',
  );
  const secondConfig = loadConfig(
    { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
    'node',
  );
  let secondListener: Awaited<ReturnType<typeof listenNode>> | undefined;
  try {
    secondListener = await listenNode(
      createApp({
        adapter: node(),
        config: secondConfig,
        telemetry: { request() {} },
        ready: (signal) => secondRoot.ready(signal),
        abuse: secondRoot.abuse,
        registrationStore: secondRoot.registrationStore,
        standardPassword: createNodeStandardPasswordService(
          secondConfig.deployment,
          initialStandardPasswordPolicy,
          1,
          initialStandardPasswordPolicy.maximum.memoryKiB,
        ),
      }),
      0,
    );
    const secondDenied = await fetch(
      secondListener.url + '/api/v1/accounts/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle: 'realnodeuser',
          password: 'long-functional-password',
        }),
      },
    );
    expect(secondDenied.status).toBe(429);
    expect(Number(secondDenied.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(secondDenied.headers.get('cache-control')).toBe('no-store');
  } finally {
    await secondListener?.close();
    await secondRoot.close();
  }
  const captcha = configureOptionalTurnstile(
    {
      secret: 'private-test-secret',
      siteKey: 'public-test-site-key',
      hostname: 'localhost',
      environment: 'local',
    },
    (secret) =>
      createTurnstileVerifier(
        secret,
        createNodeOutboundFetcher(turnstileOutboundLimits, async () => [
          { address: '127.0.0.1', family: 4 },
        ]),
      ),
  );
  const configuredObservations: string[] = [];
  const configuredConfig = {
    ...loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    allowedOrigins: ['http://localhost:5173'],
  };
  const configuredListener = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: jsonTelemetry((line) => configuredObservations.push(line)),
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      captcha: captcha.gate,
      captchaSiteKey: captcha.siteKey,
      registrationStore: configured.registrationStore,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    const challenge = await fetch(
      configuredListener.url + '/api/v1/accounts/register',
    );
    expect(await challenge.json()).toEqual({
      captchaRequired: true,
      captchaSiteKey: 'public-test-site-key',
      captchaAction: 'register',
    });
    const post = (handle: string, captchaToken?: string) =>
      fetch(configuredListener.url + '/api/v1/accounts/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          password: 'long-functional-password',
          ...(captchaToken ? { captchaToken } : {}),
        }),
      });
    const missing = await post('missingnodecaptcha');
    expect(missing.status).toBe(403);
    expect(await missing.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    const unavailableCaptcha = await post('outagenodecaptcha', 'test-token');
    expect(unavailableCaptcha.status).toBe(503);
    expect(await unavailableCaptcha.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    const outageAudit = await pool.query(
      "SELECT action, system_actor, target_id FROM audit_events WHERE system_actor = 'core.admission'",
    );
    expect(outageAudit.rowCount).toBe(1);
    expect(outageAudit.rows[0]).toMatchObject({
      action: 'provider.outage',
      system_actor: 'core.admission',
      target_id: '["turnstile","register"]',
    });
    const unstored = await pool.query(
      "SELECT 1 FROM identities WHERE subject IN ('missingnodecaptcha', 'outagenodecaptcha')",
    );
    expect(unstored.rowCount).toBe(0);
    const emitted = configuredObservations.map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: 'security',
        component: 'captcha',
        outcome: 'denied',
      }),
    );
    expect(emitted).toContainEqual(
      expect.objectContaining({
        type: 'security',
        component: 'captcha',
        outcome: 'unavailable',
      }),
    );
    expect(configuredObservations.join('')).not.toMatch(
      /missingnodecaptcha|outagenodecaptcha|long-functional-password|test-token|private-test-secret/,
    );
  } finally {
    await configuredListener.close();
  }
  let providerMode:
    | 'accept'
    | 'wrong-action'
    | 'malformed'
    | 'outage'
    | 'redirect'
    | 'oversized'
    | 'timeout' = 'accept';
  let providerCalls = 0;
  const validCaptcha = configureOptionalTurnstile(
    {
      secret: 'private-test-secret',
      siteKey: 'public-test-site-key',
      hostname: 'localhost',
      environment: 'local',
    },
    (secret) =>
      createTurnstileVerifier(
        secret,
        createOutboundFetcher(turnstileOutboundLimits, async (url, init) => {
          providerCalls++;
          expect(url).toBe(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          );
          expect(init?.method).toBe('POST');
          expect(init?.redirect).toBe('manual');
          const form = new URLSearchParams(
            new TextDecoder().decode(init?.body as ArrayBuffer),
          );
          expect(form.get('secret')).toBe('private-test-secret');
          expect(form.get('response')).toBe('fixture-challenge');
          if (providerMode === 'outage')
            throw new Error('fixture provider down');
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
            providerMode === 'malformed'
              ? '{'
              : JSON.stringify({
                  success: true,
                  hostname: 'localhost',
                  action:
                    providerMode === 'wrong-action' ? 'login' : 'register',
                  challenge_ts: new Date().toISOString(),
                  'error-codes': [],
                }),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      ),
  );
  const validListener = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      captcha: validCaptcha.gate,
      captchaSiteKey: validCaptcha.siteKey,
      registrationStore: configured.registrationStore,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    const post = (handle: string) =>
      fetch(validListener.url + '/api/v1/accounts/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          password: 'long-functional-password',
          captchaToken: 'fixture-challenge',
        }),
      });
    const accepted = await post('validnodecaptcha');
    expect(accepted.status, await accepted.clone().text()).toBe(202);
    expect(providerCalls).toBe(1);
    providerMode = 'wrong-action';
    const wrongAction = await post('wrongactionnode');
    expect(wrongAction.status).toBe(403);
    expect(await wrongAction.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    providerMode = 'malformed';
    const malformedProvider = await post('malformednode');
    expect(malformedProvider.status).toBe(503);
    expect(await malformedProvider.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    providerMode = 'outage';
    const outage = await post('outagenode');
    expect(outage.status).toBe(503);
    expect(await outage.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    providerMode = 'redirect';
    const redirected = await post('redirectednode');
    expect(redirected.status).toBe(503);
    expect(await redirected.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    providerMode = 'oversized';
    const oversized = await post('oversizednode');
    expect(oversized.status).toBe(503);
    expect(await oversized.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    providerMode = 'timeout';
    const stalledAt = performance.now();
    const timedOut = await post('timeoutnode');
    expect(timedOut.status).toBe(503);
    expect(performance.now() - stalledAt).toBeLessThan(4000);
    expect(await timedOut.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    expect(providerCalls).toBe(7);
    const limitedBeforeProvider = await post('limitednode');
    expect(limitedBeforeProvider.status).toBe(429);
    expect(providerCalls).toBe(7);
    const identities = await pool.query<{ subject: string; alg: string }>(
      "SELECT i.subject, c.record->>'alg' AS alg FROM identities i JOIN password_credentials c ON c.identity_id = i.id WHERE i.subject IN ('validnodecaptcha', 'wrongactionnode', 'malformednode', 'outagenode', 'redirectednode', 'oversizednode', 'timeoutnode') ORDER BY i.subject",
    );
    expect(identities.rows).toEqual([
      { subject: 'validnodecaptcha', alg: 'Argon2id' },
    ]);
  } finally {
    await validListener.close();
  }
  let releaseProvider!: () => void;
  const providerRelease = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  let reportSaturation!: () => void;
  const saturated = new Promise<void>((resolve) => {
    reportSaturation = resolve;
  });
  let inFlightProviderCalls = 0;
  let saturatedProviderMode: 'deny' | 'accept' = 'deny';
  const saturatedCaptcha = configureOptionalTurnstile(
    {
      secret: 'private-test-secret',
      siteKey: 'public-test-site-key',
      hostname: 'localhost',
      environment: 'local',
    },
    (secret) =>
      createTurnstileVerifier(
        secret,
        createOutboundFetcher(turnstileOutboundLimits, async () => {
          if (saturatedProviderMode === 'deny') {
            inFlightProviderCalls++;
            if (inFlightProviderCalls === 8) reportSaturation();
            await providerRelease;
            return new Response(
              JSON.stringify({
                success: false,
                'error-codes': ['invalid-input-response'],
              }),
              {
                headers: { 'content-type': 'application/json' },
              },
            );
          }
          return new Response(
            JSON.stringify({
              success: true,
              hostname: 'localhost',
              action: 'register',
              challenge_ts: new Date().toISOString(),
              'error-codes': [],
            }),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      ),
  );
  const saturatedListener = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: {
        ...configured.abuse!,
        clientAddress: () => '203.0.113.200',
      },
      captcha: saturatedCaptcha.gate,
      captchaSiteKey: saturatedCaptcha.siteKey,
      registrationStore: configured.registrationStore,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    const register = (handle: string) =>
      fetch(saturatedListener.url + '/api/v1/accounts/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          password: 'long-functional-password',
          captchaToken: 'fixture-challenge',
        }),
      });
    const blockedHandles = Array.from(
      { length: 8 },
      (_, index) => `saturatednode${index}`,
    );
    const blocked = blockedHandles.map(register);
    await saturated;
    expect(inFlightProviderCalls).toBe(8);
    const overloaded = await register('overloadednode');
    expect(overloaded.status).toBe(503);
    expect(overloaded.headers.get('cache-control')).toBe('no-store');
    expect(await overloaded.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    expect(inFlightProviderCalls).toBe(8);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM identities WHERE subject = 'overloadednode'",
        )
      ).rowCount,
    ).toBe(0);
    const overloadedSubjects = await activeAbuseSubjects(
      configured.abuse!.provider,
      'registration',
      'account',
      'overloadednode',
      new AbortController().signal,
    );
    for (const subject of overloadedSubjects) {
      const primary = await pool.query<{ hits: number }>(
        'SELECT hits FROM rate_limit_counters WHERE category = $1 AND dimension = $2 AND key_version = $3 AND subject_digest = $4',
        [
          subject.category,
          subject.dimension,
          subject.keyVersion,
          subject.digest,
        ],
      );
      expect(primary.rows).toEqual([{ hits: 1 }]);
    }
    releaseProvider();
    const denied = await Promise.all(blocked);
    expect(denied.map((result) => result.status)).toEqual(Array(8).fill(403));
    for (const result of denied)
      expect(await result.json()).toMatchObject({
        error: { code: 'CAPTCHA_DENIED' },
      });
    expect(
      (
        await pool.query('SELECT 1 FROM identities WHERE subject = ANY($1)', [
          blockedHandles,
        ])
      ).rowCount,
    ).toBe(0);
    saturatedProviderMode = 'accept';
    const recovered = await register('recoverednode');
    expect(recovered.status, await recovered.clone().text()).toBe(202);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM identities WHERE subject = 'recoverednode'",
        )
      ).rowCount,
    ).toBe(1);
  } finally {
    releaseProvider();
    await saturatedListener.close();
  }
  const login = (
    url: string,
    handle: string,
    password: string,
    extras?: Record<string, string>,
  ) =>
    fetch(url + '/auth/login', {
      method: 'POST',
      headers: {
        origin: url,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ handle, password, ...extras }),
    });
  for (const [handle, password] of [
    ['realnodeuser', 'wrong-functional-password'],
    ['unknownnodeuser', 'long-functional-password'],
  ]) {
    const denied = await login(base, handle!, password!);
    expect(denied.status).toBe(401);
    expect(denied.headers.get('set-cookie')).toBeNull();
    expect(denied.headers.get('cache-control')).toBe('no-store');
    expect(await denied.json()).toMatchObject({
      error: { code: 'LOGIN_DENIED' },
    });
  }
  expect(
    (await pool.query('SELECT 1 FROM authorization_sessions')).rowCount,
  ).toBe(0);
  const badOrigin = await fetch(base + '/auth/login', {
    method: 'POST',
    headers: {
      origin: 'https://other.example',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      handle: 'realnodeuser',
      password: 'long-functional-password',
    }),
  });
  expect(badOrigin.status).toBe(403);
  expect(await badOrigin.json()).toMatchObject({
    error: { code: 'ORIGIN_FORBIDDEN' },
  });
  const withoutSessions = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      passwordStore: configured.passwordStore,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      keyProvider: sessionKeys.provider,
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(withoutSessions.url);
    const missingDependency = await login(
      withoutSessions.url,
      'realnodeuser',
      'long-functional-password',
    );
    expect(missingDependency.status).toBe(503);
    expect(await missingDependency.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
  } finally {
    await withoutSessions.close();
  }
  let passwordReadsAfterPrimaryFailure = 0;
  const primaryOutage = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: {
        ...configured.abuse!,
        store: {
          increment: async () => {
            throw new Error('test primary counter outage');
          },
          purgeExpired: (purgeAtMs, limit) =>
            configured.abuse!.store.purgeExpired(purgeAtMs, limit),
        },
      },
      passwordStore: {
        loadCredential: (handle) => {
          passwordReadsAfterPrimaryFailure++;
          return configured.passwordStore!.loadCredential(handle);
        },
        loadCredentialByIdentity: (identityId) =>
          configured.passwordStore!.loadCredentialByIdentity(identityId),
        replaceCredential: (input) =>
          configured.passwordStore!.replaceCredential(input),
      },
      sessionStore: configured.sessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(primaryOutage.url);
    const deniedByPrimary = await login(
      primaryOutage.url,
      'realnodeuser',
      'long-functional-password',
    );
    expect(deniedByPrimary.status).toBe(503);
    expect(deniedByPrimary.headers.get('cache-control')).toBe('no-store');
    expect(deniedByPrimary.headers.get('set-cookie')).toBeNull();
    expect(await deniedByPrimary.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    expect(passwordReadsAfterPrimaryFailure).toBe(0);
    expect(
      (await pool.query('SELECT 1 FROM authorization_sessions')).rowCount,
    ).toBe(0);
  } finally {
    await primaryOutage.close();
  }
  let failedSessionCreates = 0;
  const sessionWriteOutage = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      passwordStore: configured.passwordStore,
      sessionStore: {
        ...configured.sessionStore!,
        createIfCurrent: async () => {
          failedSessionCreates++;
          throw new Error('test session write outage');
        },
      },
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(sessionWriteOutage.url);
    const deniedBySessionWrite = await login(
      sessionWriteOutage.url,
      'realnodeuser',
      'long-functional-password',
    );
    expect(deniedBySessionWrite.status).toBe(503);
    expect(deniedBySessionWrite.headers.get('cache-control')).toBe('no-store');
    expect(deniedBySessionWrite.headers.get('set-cookie')).toBeNull();
    expect(await deniedBySessionWrite.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    expect(failedSessionCreates).toBe(1);
    expect(
      (await pool.query('SELECT 1 FROM authorization_sessions')).rowCount,
    ).toBe(0);
  } finally {
    await sessionWriteOutage.close();
  }
  let passwordReadsBeforeTokenKeyFailure = 0;
  let sessionCreatesAfterTokenKeyFailure = 0;
  const tokenKeyOutage = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      passwordStore: {
        loadCredential: (handle) => {
          passwordReadsBeforeTokenKeyFailure++;
          return configured.passwordStore!.loadCredential(handle);
        },
        loadCredentialByIdentity: (identityId) =>
          configured.passwordStore!.loadCredentialByIdentity(identityId),
        replaceCredential: (input) =>
          configured.passwordStore!.replaceCredential(input),
      },
      sessionStore: {
        ...configured.sessionStore!,
        createIfCurrent: (input) => {
          sessionCreatesAfterTokenKeyFailure++;
          return configured.sessionStore!.createIfCurrent(input);
        },
      },
      keyProvider: {
        current: async () => {
          throw new Error('private token key unavailable');
        },
        get: sessionKeys.provider.get.bind(sessionKeys.provider),
        readable: sessionKeys.provider.readable.bind(sessionKeys.provider),
      },
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(tokenKeyOutage.url);
    const unavailableTokenKeyLogin = await login(
      tokenKeyOutage.url,
      'realnodeuser',
      'long-functional-password',
    );
    expect(unavailableTokenKeyLogin.status).toBe(503);
    expect(unavailableTokenKeyLogin.headers.get('cache-control')).toBe(
      'no-store',
    );
    expect(unavailableTokenKeyLogin.headers.get('set-cookie')).toBeNull();
    expect(await unavailableTokenKeyLogin.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    expect(passwordReadsBeforeTokenKeyFailure).toBe(2);
    expect(sessionCreatesAfterTokenKeyFailure).toBe(0);
    expect(
      (await pool.query('SELECT 1 FROM authorization_sessions')).rowCount,
    ).toBe(0);
  } finally {
    await tokenKeyOutage.close();
  }
  const acceptedLogin = await login(
    base,
    'realnodeuser',
    'long-functional-password',
  );
  expect(acceptedLogin.status, await acceptedLogin.clone().text()).toBe(200);
  expect(await acceptedLogin.json()).toEqual({ authenticated: true });
  const cookie = acceptedLogin.headers.get('set-cookie');
  expect(cookie).toMatch(
    /^__Host-hb_session=[^;]+; Max-Age=604800; Path=\/; Secure; HttpOnly; SameSite=Lax$/,
  );
  const cookieHeader = cookie!.split(';', 1)[0]!;
  const stored = await pool.query<{
    digest: unknown;
    revoked_at: string | null;
  }>('SELECT digest, revoked_at FROM authorization_sessions');
  expect(stored.rowCount).toBe(1);
  expect(stored.rows[0]?.revoked_at).toBeNull();
  expect(JSON.stringify(stored.rows[0]?.digest)).not.toContain(
    cookieHeader.split('.')[1]!,
  );
  const session = () =>
    fetch(base + '/auth/session', { headers: { cookie: cookieHeader } });
  expect((await session()).status).toBe(200);
  const tamperedCookie = cookieHeader.replace(
    /(hb1_)([A-Za-z0-9_-])/,
    (_match, prefix: string, character: string) =>
      prefix + (character === 'A' ? 'B' : 'A'),
  );
  expect(tamperedCookie).not.toBe(cookieHeader);
  const tamperedSession = await fetch(base + '/auth/session', {
    headers: { cookie: tamperedCookie },
  });
  expect(tamperedSession.status).toBe(401);
  expect(tamperedSession.headers.get('cache-control')).toBe('no-store');
  expect(await tamperedSession.json()).toMatchObject({
    error: { code: 'LOGIN_DENIED' },
  });
  expect(
    (
      await pool.query(
        'SELECT 1 FROM authorization_sessions WHERE revoked_at IS NOT NULL',
      )
    ).rowCount,
  ).toBe(0);
  expect((await session()).status).toBe(200);
  const missingTokenKeyListener = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      sessionStore: configured.sessionStore,
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(missingTokenKeyListener.url);
    const unavailableSession = await fetch(
      missingTokenKeyListener.url + '/auth/session',
      { headers: { cookie: cookieHeader } },
    );
    expect(unavailableSession.status).toBe(503);
    expect(unavailableSession.headers.get('cache-control')).toBe('no-store');
    expect(await unavailableSession.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    const unavailableLogout = await fetch(
      missingTokenKeyListener.url + '/auth/logout',
      {
        method: 'POST',
        headers: {
          origin: missingTokenKeyListener.url,
          cookie: cookieHeader,
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    expect(unavailableLogout.status).toBe(503);
    expect(unavailableLogout.headers.get('cache-control')).toBe('no-store');
    expect(unavailableLogout.headers.get('set-cookie')).toBeNull();
    expect(await unavailableLogout.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
  } finally {
    await missingTokenKeyListener.close();
  }
  expect((await session()).status).toBe(200);
  let failedSessionLoads = 0;
  const unavailableSessionStore = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      keyProvider: sessionKeys.provider,
      sessionStore: {
        ...configured.sessionStore!,
        load: async () => {
          failedSessionLoads++;
          throw new Error('test session store outage');
        },
      },
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(unavailableSessionStore.url);
    const unavailableRead = await fetch(
      unavailableSessionStore.url + '/auth/session',
      { headers: { cookie: cookieHeader } },
    );
    expect(unavailableRead.status).toBe(503);
    expect(unavailableRead.headers.get('cache-control')).toBe('no-store');
    expect(await unavailableRead.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    const unavailableRevoke = await fetch(
      unavailableSessionStore.url + '/auth/logout',
      {
        method: 'POST',
        headers: {
          origin: unavailableSessionStore.url,
          cookie: cookieHeader,
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    expect(unavailableRevoke.status).toBe(503);
    expect(unavailableRevoke.headers.get('cache-control')).toBe('no-store');
    expect(unavailableRevoke.headers.get('set-cookie')).toBeNull();
    expect(await unavailableRevoke.json()).toMatchObject({
      error: { code: 'AUTHORIZATION_UNAVAILABLE' },
    });
    expect(failedSessionLoads).toBe(2);
  } finally {
    await unavailableSessionStore.close();
  }
  expect((await session()).status).toBe(200);
  const rejectedLogout = await fetch(base + '/auth/logout', {
    method: 'POST',
    headers: {
      origin: 'https://other.example',
      cookie: cookieHeader,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  expect(rejectedLogout.status).toBe(403);
  expect((await session()).status).toBe(200);
  const logout = await fetch(base + '/auth/logout', {
    method: 'POST',
    headers: {
      origin: base,
      cookie: cookieHeader,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  expect(logout.status).toBe(204);
  expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
  expect((await session()).status).toBe(401);
  expect(
    (
      await pool.query(
        'SELECT revoked_at FROM authorization_sessions WHERE revoked_at IS NOT NULL',
      )
    ).rowCount,
  ).toBe(1);
  const renewed = await login(base, 'realnodeuser', 'long-functional-password');
  expect(renewed.status).toBe(200);
  const renewedCookie = renewed.headers.get('set-cookie')!.split(';', 1)[0]!;
  expect(renewedCookie).not.toBe(cookieHeader);
  expect(
    (
      await fetch(base + '/auth/session', {
        headers: { cookie: renewedCookie },
      })
    ).status,
  ).toBe(200);
  await pool.query(
    "UPDATE password_credentials SET revision = revision + 1 WHERE identity_id = (SELECT id FROM identities WHERE subject = 'realnodeuser')",
  );
  expect(
    (
      await fetch(base + '/auth/session', {
        headers: { cookie: renewedCookie },
      })
    ).status,
  ).toBe(401);
  const loginSubjects = await activeAbuseSubjects(
    configured.abuse!.provider,
    'login',
    'account',
    'limitedlogin',
    new AbortController().signal,
  );
  expect(loginSubjects.map((subject) => subject.keyVersion)).toEqual([2, 1]);
  for (let hit = 0; hit < 5; hit++)
    await configured.abuse!.store.increment({
      ...loginSubjects[1]!,
      windowStart,
      expiresAt: windowStart + 3_600_000 + 86_400_000,
    });
  const limitedLogin = await login(
    base,
    'limitedlogin',
    'long-functional-password',
  );
  expect(limitedLogin.status).toBe(429);
  expect(Number(limitedLogin.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(await limitedLogin.json()).toMatchObject({
    error: { code: 'RATE_LIMITED' },
  });
  expect(
    (
      await pool.query<{ key_version: number; hits: number }>(
        "SELECT key_version, hits FROM rate_limit_counters WHERE category = 'login' AND dimension = 'account' AND subject_digest = ANY($1) ORDER BY key_version",
        [loginSubjects.map((subject) => subject.digest)],
      )
    ).rows,
  ).toEqual([
    { key_version: 1, hits: 6 },
    { key_version: 2, hits: 1 },
  ]);
  let loginProviderMode: 'accept' | 'wrong-action' | 'outage' = 'accept';
  let loginProviderCalls = 0;
  const loginCaptcha = configureOptionalTurnstile(
    {
      secret: 'private-test-secret',
      siteKey: 'public-test-site-key',
      hostname: 'localhost',
      environment: 'local',
    },
    (secret) =>
      createTurnstileVerifier(
        secret,
        createOutboundFetcher(turnstileOutboundLimits, async () => {
          loginProviderCalls++;
          if (loginProviderMode === 'outage')
            throw new Error('fixture provider unavailable');
          return new Response(
            JSON.stringify({
              success: true,
              hostname: 'localhost',
              action:
                loginProviderMode === 'wrong-action' ? 'register' : 'login',
              challenge_ts: new Date().toISOString(),
              'error-codes': [],
            }),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      ),
  );
  const captchaListener = await listenNode(
    createApp({
      adapter: node(),
      config: configuredConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: configured.abuse,
      captcha: loginCaptcha.gate,
      captchaSiteKey: loginCaptcha.siteKey,
      passwordStore: configured.passwordStore,
      sessionStore: configured.sessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        configuredConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  try {
    configuredConfig.allowedOrigins.push(captchaListener.url);
    expect(
      await (await fetch(captchaListener.url + '/auth/login')).json(),
    ).toEqual({
      captchaRequired: true,
      captchaSiteKey: 'public-test-site-key',
      captchaAction: 'login',
    });
    const missingChallenge = await login(
      captchaListener.url,
      'validnodecaptcha',
      'long-functional-password',
    );
    expect(missingChallenge.status).toBe(403);
    expect(await missingChallenge.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    expect(loginProviderCalls).toBe(0);
    const validChallenge = await login(
      captchaListener.url,
      'validnodecaptcha',
      'long-functional-password',
      { captchaToken: 'fixture-challenge' },
    );
    expect(validChallenge.status).toBe(200);
    loginProviderMode = 'wrong-action';
    const wrongAction = await login(
      captchaListener.url,
      'validnodecaptcha',
      'long-functional-password',
      { captchaToken: 'fixture-challenge' },
    );
    expect(wrongAction.status).toBe(403);
    expect(await wrongAction.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    loginProviderMode = 'outage';
    const unavailableProvider = await login(
      captchaListener.url,
      'validnodecaptcha',
      'long-functional-password',
      { captchaToken: 'fixture-challenge' },
    );
    expect(unavailableProvider.status).toBe(503);
    expect(await unavailableProvider.json()).toMatchObject({
      error: { code: 'CAPTCHA_UNAVAILABLE' },
    });
    expect(loginProviderCalls).toBe(3);
    expect(
      (
        await pool.query(
          "SELECT 1 FROM authorization_sessions s JOIN identities i ON i.id = s.identity_id WHERE i.subject = 'validnodecaptcha'",
        )
      ).rowCount,
    ).toBe(1);
  } finally {
    await captchaListener.close();
  }
  const realSessionStore = configured.sessionStore!;
  const sessionCalls = { load: 0, revoke: 0 };
  const countedSessionStore = {
    ...realSessionStore,
    load: async (...args: Parameters<typeof realSessionStore.load>) => {
      sessionCalls.load++;
      return realSessionStore.load(...args);
    },
    revoke: async (...args: Parameters<typeof realSessionStore.revoke>) => {
      sessionCalls.revoke++;
      return realSessionStore.revoke(...args);
    },
  };
  const sessionLimitConfig = {
    ...loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    allowedOrigins: ['http://localhost:5173'],
  };
  const sessionLimitListener = await listenNode(
    createApp({
      adapter: node(),
      config: sessionLimitConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: {
        ...configured.abuse!,
        limiter: createNodeVolumetricLimiter({
          limit: 2,
          windowMs: 60_000,
          maxKeys: 100,
        }),
      },
      passwordStore: configured.passwordStore,
      sessionStore: countedSessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        sessionLimitConfig.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
    }),
    0,
  );
  let limitedCookie = '';
  try {
    sessionLimitConfig.allowedOrigins.push(sessionLimitListener.url);
    const admittedLogin = await login(
      sessionLimitListener.url,
      'validnodecaptcha',
      'long-functional-password',
    );
    expect(admittedLogin.status).toBe(200);
    limitedCookie = admittedLogin.headers.get('set-cookie')!.split(';', 1)[0]!;
    const read = () =>
      fetch(sessionLimitListener.url + '/auth/session', {
        headers: { cookie: limitedCookie },
      });
    expect((await read()).status).toBe(200);
    expect((await read()).status).toBe(200);
    expect(sessionCalls.load).toBe(2);
    const shedRead = await read();
    expect(shedRead.status).toBe(429);
    expect(shedRead.headers.get('cache-control')).toBe('no-store');
    expect(await shedRead.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    expect(sessionCalls.load).toBe(2);
    const logoutRequest = () =>
      fetch(sessionLimitListener.url + '/auth/logout', {
        method: 'POST',
        headers: {
          origin: sessionLimitListener.url,
          cookie: limitedCookie,
          'content-type': 'application/json',
        },
        body: '{}',
      });
    expect((await logoutRequest()).status).toBe(204);
    expect((await logoutRequest()).status).toBe(204);
    expect(sessionCalls.load).toBe(4);
    expect(sessionCalls.revoke).toBe(1);
    const shedLogout = await logoutRequest();
    expect(shedLogout.status).toBe(429);
    expect(shedLogout.headers.get('cache-control')).toBe('no-store');
    expect(await shedLogout.json()).toMatchObject({
      error: { code: 'RATE_LIMITED' },
    });
    expect(sessionCalls).toEqual({ load: 4, revoke: 1 });
  } finally {
    await sessionLimitListener.close();
  }
  const missingSessionLimiter = await listenNode(
    createApp({
      adapter: node(),
      config: sessionLimitConfig,
      telemetry: { request() {} },
      ready: (signal) => configured.ready(signal),
      abuse: {
        provider: configured.abuse!.provider,
        store: configured.abuse!.store,
        clientAddress: configured.abuse!.clientAddress!,
      },
      sessionStore: countedSessionStore,
      keyProvider: sessionKeys.provider,
    }),
    0,
  );
  try {
    sessionLimitConfig.allowedOrigins.push(missingSessionLimiter.url);
    const unavailableRead = await fetch(
      missingSessionLimiter.url + '/auth/session',
      { headers: { cookie: limitedCookie } },
    );
    expect(unavailableRead.status).toBe(503);
    expect(await unavailableRead.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    const unavailableLogout = await fetch(
      missingSessionLimiter.url + '/auth/logout',
      {
        method: 'POST',
        headers: {
          origin: missingSessionLimiter.url,
          cookie: limitedCookie,
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    expect(unavailableLogout.status).toBe(503);
    expect(await unavailableLogout.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_UNAVAILABLE' },
    });
    expect(sessionCalls).toEqual({ load: 4, revoke: 1 });
  } finally {
    await missingSessionLimiter.close();
  }
  {
    const min = adaptMinimumPasswordService(
      await createMinimumPasswordService(
        sessionKeys.provider,
        minimumTierPasswordPolicy,
      ),
    );
    const principalId = crypto.randomUUID(),
      identityId = crypto.randomUUID();
    await configured.registrationStore!.register({
      principalId,
      identityId,
      handle: 'upgradetier',
      passwordRecord: await min.hash('upgrade-to-strong-password'),
      nowMs: Date.now(),
    });
    const upgradeResponse = await fetch(new URL('/auth/login', base), {
      method: 'POST',
      headers: { origin: base, 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'upgradetier',
        password: 'upgrade-to-strong-password',
      }),
    });
    expect(upgradeResponse.status).toBe(200);
    const saved = await configured.passwordStore!.loadCredential('upgradetier');
    expect(saved?.record.alg).toBe('Argon2id');
    expect(saved?.revision).toBe(2);
  }
  await pool.query('DROP TABLE rate_limit_counters');
  const unavailable = await fetch(base + '/api/v1/accounts/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: 'blockeduser',
      password: 'long-functional-password',
    }),
  });
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toMatchObject({
    error: { code: 'RATE_LIMIT_UNAVAILABLE' },
  });
  const blocked = await pool.query(
    "SELECT 1 FROM identities WHERE subject = 'blockeduser'",
  );
  expect(blocked.rowCount).toBe(0);
  const emitted = observations.map(
    (line) => JSON.parse(line) as Record<string, unknown>,
  );
  expect(emitted).toContainEqual(
    expect.objectContaining({
      type: 'security',
      component: 'rate',
      outcome: 'unavailable',
    }),
  );
  expect(emitted).toContainEqual(
    expect.objectContaining({
      type: 'security',
      component: 'rate',
      outcome: 'denied',
    }),
  );
  expect(emitted).toContainEqual(
    expect.objectContaining({
      type: 'log',
      route: 'account.register',
      status: 503,
    }),
  );
  expect(
    emitted
      .filter(
        (item) => item.type === 'log' && item.route === 'account.register',
      )
      .map((item) => item.status),
  ).toEqual([202, 400, 429, 503]);
  expect(observations.join('')).not.toMatch(
    /realnodeuser|blockeduser|long-functional-password|203\.0\.113\.89/i,
  );
});
