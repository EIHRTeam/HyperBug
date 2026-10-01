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

const databaseName = 'hyperbug_bootstrap_route_test';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let disarmedListener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
let disarmedBase: string;
const sessionKeys = cryptoFixture();

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
  for (const migration of await migrationStatements('postgres')) {
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-bootstrap-route-'));
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
  const password = createNodeStandardPasswordService(
    config.deployment,
    initialStandardPasswordPolicy,
    1,
    initialStandardPasswordPolicy.maximum.memoryKiB,
  );
  listener = await listenNode(
    createApp({
      adapter: node(),
      config,
      telemetry: jsonTelemetry(() => {}),
      ready: (signal) => configured.ready(signal) as Promise<boolean>,
      abuse: configured.abuse,
      registrationStore: configured.registrationStore,
      passwordStore: configured.passwordStore,
      bootstrapCode: enrollmentCode,
      staffEnrollmentStore: configured.staffEnrollmentStore,
      sessionStore: configured.sessionStore,
      auditAppend: configured.auditAppend,
      keyProvider: sessionKeys.provider,
      bootstrapState: configured.staffEnrollmentStore
        ? async () =>
            (await configured.staffEnrollmentStore?.countActiveStaff()) === 0
        : null,
      standardPassword: password,
    }),
    0,
  );
  base = listener.url;
  config.allowedOrigins.push(base);
  disarmedListener = await listenNode(
    createApp({
      adapter: node(),
      config,
      telemetry: jsonTelemetry(() => {}),
      ready: async () => true,
      abuse: configured.abuse,
      standardPassword: password,
      bootstrapCode: null,
      staffEnrollmentStore: configured.staffEnrollmentStore,
      auditAppend: configured.auditAppend,
    }),
    0,
  );
  disarmedBase = disarmedListener.url;
  config.allowedOrigins.push(disarmedBase);
});

afterAll(async () => {
  await listener?.close();
  await disarmedListener?.close();
  await configured?.close();
  await pool?.end();
  await bootstrap?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await bootstrap?.end();
  if (directory) await rm(directory, { recursive: true, force: true });
});

const enroll = (target: string, body: unknown, origin?: string) =>
  fetch(new URL('/auth/bootstrap/enroll', target), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(origin === undefined ? {} : { origin }),
    },
    body: JSON.stringify(body),
  });

it('enrolls the initial Staff administrator through the operator-channel code', async () => {
  const pending = await (await fetch(new URL('/health/ready', base))).json();
  expect(pending.deployment.bootstrapPending).toBe(true);

  const crossOrigin = await enroll(base, {
    enrollmentCode,
    handle: 'firstadmin',
    password: 'operator-password-1',
  });
  expect(crossOrigin.status).toBe(403);
  expect(await crossOrigin.json()).toMatchObject({
    error: { code: 'ORIGIN_FORBIDDEN' },
  });

  const wrongCode = await enroll(
    base,
    {
      enrollmentCode: 'hbbs1_' + 'A'.repeat(43),
      handle: 'firstadmin',
      password: 'operator-password-1',
    },
    base,
  );
  expect(wrongCode.status).toBe(403);
  expect(wrongCode.headers.get('cache-control')).toBe('no-store');
  expect(await wrongCode.json()).toMatchObject({
    error: { code: 'BOOTSTRAP_FORBIDDEN' },
  });

  const enrolled = await enroll(
    base,
    {
      enrollmentCode,
      handle: 'FirstAdmin',
      password: 'operator-password-1',
    },
    base,
  );
  expect(enrolled.status).toBe(201);
  expect(await enrolled.json()).toEqual({ enrolled: true });
  expect(enrolled.headers.get('set-cookie')).toBeNull();

  const staff = await pool.query(
    "SELECT p.id, p.display_name FROM principals p WHERE p.kind = 'staff' AND p.status = 'active'",
  );
  expect(staff.rowCount).toBe(1);
  expect(staff.rows[0]?.display_name).toBe('firstadmin');
  const identity = await pool.query(
    "SELECT i.subject FROM identities i WHERE i.principal_id = $1 AND i.provider = 'local-password' AND i.issuer = 'hyperbug'",
    [staff.rows[0]?.id],
  );
  expect(identity.rows[0]?.subject).toBe('firstadmin');
  const credential = await pool.query(
    'SELECT c.record FROM password_credentials c JOIN identities i ON i.id = c.identity_id WHERE i.subject = $1',
    ['firstadmin'],
  );
  expect(credential.rowCount).toBe(1);

  const enrollmentAudit = await pool.query(
    "SELECT system_actor, actor_id, result, target_id FROM audit_events WHERE action = 'account.enrolled'",
  );
  expect(enrollmentAudit.rowCount).toBe(1);
  expect(enrollmentAudit.rows[0]).toEqual({
    system_actor: 'core.identity',
    actor_id: null,
    result: 'success',
    target_id: staff.rows[0]?.id,
  });
  const ready = await (await fetch(new URL('/health/ready', base))).json();
  expect(ready.deployment.bootstrapPending).toBe(false);

  const second = await enroll(
    base,
    {
      enrollmentCode,
      handle: 'secondadmin',
      password: 'operator-password-2',
    },
    base,
  );
  expect(second.status).toBe(403);
  expect(await second.json()).toMatchObject({
    error: { code: 'BOOTSTRAP_FORBIDDEN' },
  });
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS total FROM principals WHERE kind = 'staff'",
      )
    ).rows[0]?.total,
  ).toBe(1);
});

it('answers the generic denial for an already-used handle without a second Staff row', async () => {
  const taken = await enroll(
    base,
    {
      enrollmentCode,
      handle: 'firstadmin',
      password: 'operator-password-3',
    },
    base,
  );
  expect(taken.status).toBe(403);
  expect(
    (
      await pool.query(
        "SELECT count(*)::int AS total FROM principals WHERE kind = 'staff'",
      )
    ).rows[0]?.total,
  ).toBe(1);
});

it('denies with an unavailable response when no enrollment code is configured', async () => {
  const disarmed = await enroll(
    disarmedBase,
    {
      enrollmentCode,
      handle: 'unarmedadmin',
      password: 'operator-password-4',
    },
    disarmedBase,
  );
  expect(disarmed.status).toBe(503);
  expect(await disarmed.json()).toMatchObject({
    error: { code: 'BOOTSTRAP_UNAVAILABLE' },
  });
});

it('lets the enrolled Staff administrator sign in through the shared login route', async () => {
  const login = await fetch(new URL('/auth/login', base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({
      handle: 'firstadmin',
      password: 'operator-password-1',
    }),
  });
  expect(login.status).toBe(200);
  const cookie = (login.headers.getSetCookie?.() ?? [])[0] ?? '';
  expect(cookie).toMatch(/^__Host-hb_session=/);
  const sessionPair = cookie.split(';')[0];
  if (sessionPair === undefined) throw new Error('Missing session cookie');
  const session = await fetch(new URL('/auth/session', base), {
    headers: { cookie: sessionPair },
  });
  expect(session.status).toBe(200);
  expect(await session.json()).toEqual({ authenticated: true });
});

it('publishes the unauthenticated instance capability document', async () => {
  const response = await fetch(new URL('/api/v1/instance', base));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    tier: 'standard',
    degradationIds: [],
    passwordHashPolicy: { algorithm: 'argon2id', downgraded: false },
    authentication: {
      passwordRegistration: true,
      passwordLogin: true,
      passkeys: false,
      // No recovery store is wired in this composition, so the recommended
      // tier path reports truthfully as unavailable.
      recoveryCodes: false,
      administratorAssistedRecovery: true,
    },
    limits: {
      documented: 'docs/FREE-TIER-PROFILE.md#capacity-ceilings-and-quotas',
    },
  });
});
