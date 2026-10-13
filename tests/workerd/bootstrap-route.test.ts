import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';

const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let armed: Miniflare;
let disarmed: Miniflare;

const authOrigin = 'https://auth.poc.example';

async function bootstrapWorker(
  namespaceId: string,
  code: string | undefined,
): Promise<Miniflare> {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/account-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      ratelimits: {
        ABUSE_VOLUMETRIC: {
          namespace_id: namespaceId,
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: 'https://auth.poc.example',
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        ...(code === undefined ? {} : { HYPERBUG_TEST_BOOTSTRAP_CODE: code }),
      },
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  return mf;
}

const enroll = (mf: Miniflare, body: unknown, withOrigin = true) =>
  mf.dispatchFetch(`${authOrigin}/auth/bootstrap/enroll`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(withOrigin
        ? { origin: authOrigin, 'sec-fetch-site': 'same-origin' }
        : {}),
    },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  armed = await bootstrapWorker('703410', enrollmentCode);
  disarmed = await bootstrapWorker('703411', undefined);
  await armed.ready;
  await disarmed.ready;
});

afterAll(async () => {
  await armed?.dispose();
  await disarmed?.dispose();
});

it('enrolls the initial Staff administrator on workerd/D1 once, then closes', async () => {
  const pending = (await (
    await armed.dispatchFetch(`${authOrigin}/health/ready`)
  ).json()) as { deployment: { bootstrapPending: boolean } };
  expect(pending.deployment.bootstrapPending).toBe(true);

  const wrongCode = await enroll(armed, {
    enrollmentCode: 'hbbs1_' + 'B'.repeat(43),
    handle: 'firstadmin',
    password: 'operator-password-1',
  });
  expect(wrongCode.status).toBe(403);
  expect(wrongCode.headers.get('cache-control')).toBe('no-store');
  expect(await wrongCode.json()).toMatchObject({
    error: { code: 'BOOTSTRAP_FORBIDDEN' },
  });

  const crossOrigin = await enroll(
    armed,
    {
      enrollmentCode,
      handle: 'firstadmin',
      password: 'operator-password-1',
    },
    false,
  );
  expect(crossOrigin.status).toBe(403);

  const enrolled = await enroll(armed, {
    enrollmentCode,
    handle: 'FirstAdmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  expect(await enrolled.json()).toEqual({ enrolled: true });
  expect(enrolled.headers.get('set-cookie')).toBeNull();

  const db = await armed.getD1Database('DB');
  const staff = await db
    .prepare(
      "SELECT id, display_name FROM principals WHERE kind = 'staff' AND status = 'active'",
    )
    .all<{ id: string; display_name: string }>();
  expect(staff.results).toHaveLength(1);
  expect(staff.results[0]?.display_name).toBe('firstadmin');
  const credential = await db
    .prepare(
      'SELECT c.record FROM password_credentials c JOIN identities i ON i.id = c.identity_id WHERE i.subject = ?',
    )
    .bind('firstadmin')
    .first();
  expect(credential).toBeTruthy();

  const enrollmentAudit = await db
    .prepare(
      "SELECT system_actor, actor_id, result FROM audit_events WHERE action = 'account.enrolled'",
    )
    .all<{ system_actor: string; actor_id: null; result: string }>();
  expect(enrollmentAudit.results).toEqual([
    { system_actor: 'core.identity', actor_id: null, result: 'success' },
  ]);
  const ready = (await (
    await armed.dispatchFetch(`${authOrigin}/health/ready`)
  ).json()) as { deployment: { bootstrapPending: boolean } };
  expect(ready.deployment.bootstrapPending).toBe(false);

  const second = await enroll(armed, {
    enrollmentCode,
    handle: 'secondadmin',
    password: 'operator-password-2',
  });
  expect(second.status).toBe(403);
  const total = await db
    .prepare("SELECT count(*) AS total FROM principals WHERE kind = 'staff'")
    .first<{ total: number }>();
  expect(total?.total).toBe(1);
});

it('denies with an unavailable response when no enrollment code is configured', async () => {
  const response = await enroll(disarmed, {
    enrollmentCode,
    handle: 'unarmedadmin',
    password: 'operator-password-3',
  });
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    error: { code: 'BOOTSTRAP_UNAVAILABLE' },
  });
});
