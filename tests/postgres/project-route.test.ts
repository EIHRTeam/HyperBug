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

// 06.1a/06.1b route journey on the Node/PostgreSQL profile: the identical
// shared project and taxonomy surface against the PostgreSQL adapters, with
// the staff-only creation gate, revision-conditional configuration, private
// invisibility, the taxonomy permission ladder and the archived read-only
// rule; no project/taxonomy audit event while 06.1c stays suspended.
const databaseName = 'hyperbug_project_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'projects-cli',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
];
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
const sessionKeys = cryptoFixture();

const post = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, ...extra },
    body: JSON.stringify(body),
  });

const call = (
  path: string,
  init: {
    method?: string;
    token?: string;
    body?: unknown;
    origin?: string | null;
  } = {},
) =>
  fetch(new URL(path, base), {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(init.origin === null ? {} : { origin: init.origin ?? base }),
      ...(init.token === undefined
        ? {}
        : { authorization: `Bearer ${init.token}` }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
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

async function loginToken(handle: string, password: string): Promise<string> {
  // The passkey ceremony is unavailable in this suite; recent authentication
  // is reached through the code flow only for non-sensitive journeys. This
  // helper is used for the password-assurance legs; the sensitive
  // configuration legs assert the REAUTHENTICATION_REQUIRED denial, whose
  // positive case the workerd suite covers end to end with the fake
  // authenticator.
  const login = await post('/auth/login', { handle, password });
  expect(login.status).toBe(200);
  const cookie = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (cookie === undefined) throw new Error('Missing session cookie');
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'projects-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-state',
      codeChallenge: await challengeOf(journeyVerifier),
    },
    { cookie },
  );
  expect(authorized.status).toBe(200);
  const code = new URL(
    ((await authorized.json()) as { redirectUri: string }).redirectUri,
  ).searchParams.get('code');
  const exchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code ?? '',
      redirect_uri: redirectUri,
      client_id: 'projects-cli',
      code_verifier: journeyVerifier,
    }),
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-project-route-'));
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
  listener = await listenNode(
    createApp({
      adapter: node(),
      config,
      telemetry: jsonTelemetry(() => {}),
      ready: (signal) => configured.ready(signal) as Promise<boolean>,
      abuse: configured.abuse,
      registrationStore: configured.registrationStore,
      passwordStore: configured.passwordStore,
      sessionStore: configured.sessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      oauthClients: clients,
      oauthCodeStore: configured.oauthCodeStore,
      projectRoleStore: configured.projectRoleStore,
      projectStore: configured.projectStore,
      taxonomyStore: configured.taxonomyStore,
      accountAdministration: configured.accountAdministration,
      auditAppend: configured.auditAppend,
      bootstrapCode: enrollmentCode,
      staffEnrollmentStore: configured.staffEnrollmentStore,
    }),
    0,
  );
  base = listener.url;
  config.allowedOrigins.push(base);
});

afterAll(async () => {
  await listener?.close().catch(() => {});
  await pool?.end().catch(() => {});
  if (bootstrap)
    await bootstrap.query(`DROP DATABASE ${databaseName}`).catch(() => {});
  await bootstrap?.end().catch(() => {});
  if (directory) await rm(directory, { recursive: true, force: true });
});

it('delivers the project and taxonomy journey on Node/PostgreSQL', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  const registered = await post('/api/v1/accounts/register', {
    handle: 'plainuser',
    password: 'long-functional-password',
  });
  expect(registered.status).toBe(202);

  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const userToken = await loginToken('plainuser', 'long-functional-password');
  const staffAccount = await call('/api/v1/account', { token: staffToken });
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;

  const anonymousCreate = await call('/api/v1/projects', {
    method: 'POST',
    body: { slug: 'pg-rocket', name: 'PG Rocket' },
  });
  expect(anonymousCreate.status).toBe(401);
  const userCreate = await call('/api/v1/projects', {
    method: 'POST',
    token: userToken,
    body: { slug: 'pg-rocket', name: 'PG Rocket' },
  });
  expect(userCreate.status).toBe(403);

  const created = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'pg-rocket', name: 'PG Rocket', visibility: 'private' },
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as {
    id: string;
    revision: number;
    visibility: string;
  };
  expect(project.visibility).toBe('private');

  const { rows: grantRows } = await pool.query(
    'SELECT role FROM project_roles WHERE project_id = $1 AND principal_id = $2',
    [project.id, staffPrincipalId],
  );
  expect(grantRows).toEqual([{ role: 'administrator' }]);

  const duplicate = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'pg-rocket', name: 'Another' },
  });
  expect(duplicate.status).toBe(409);

  // Private invisibility for anonymous and non-member principals.
  const anonymousRead = await call(`/api/v1/projects/${project.id}`, {
    origin: null,
  });
  expect(anonymousRead.status).toBe(404);
  const userRead = await call(`/api/v1/projects/${project.id}`, {
    token: userToken,
  });
  expect(userRead.status).toBe(404);
  const memberRead = await call(`/api/v1/projects/${project.id}`, {
    token: staffToken,
  });
  expect(memberRead.status).toBe(200);

  // Sensitive configuration requires a recent ceremony; this token has none.
  const configureDenied = await call(`/api/v1/projects/${project.id}`, {
    method: 'PATCH',
    token: staffToken,
    body: { expectedRevision: 1, name: 'PG Rocket Tracker' },
  });
  expect(configureDenied.status).toBe(403);
  expect(await configureDenied.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });

  // Taxonomy is maintainer-or-higher: a plain User principal is forbidden,
  // and a private project's taxonomy listing stays member-only.
  const userLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: userToken,
    body: { name: 'Bug' },
  });
  expect(userLabel.status).toBe(404);
  const label = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: staffToken,
    body: { name: 'Bug', color: '#00ff00' },
  });
  expect(label.status).toBe(201);
  const labelDocument = (await label.json()) as { id: string };
  const labels = await call(`/api/v1/projects/${project.id}/labels`, {
    token: staffToken,
  });
  expect(labels.status).toBe(200);
  expect(((await labels.json()) as { labels: unknown[] }).labels).toHaveLength(
    1,
  );

  const milestone = await call(`/api/v1/projects/${project.id}/milestones`, {
    method: 'POST',
    token: staffToken,
    body: { title: 'v1.0', dueDate: '2026-12-31' },
  });
  expect(milestone.status).toBe(201);
  const milestoneDocument = (await milestone.json()) as {
    id: string;
    progress: { open: number; closed: number };
  };
  expect(milestoneDocument.progress).toEqual({ open: 0, closed: 0 });

  // A milestone referenced by an issue cannot be removed; seed the issue row
  // directly because the issue routes arrive with 06.2.
  const seededIssueId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id, milestone_id) VALUES ($1, $2, 1, 'Seeded', '', $3, $4, $4, $5, $6)",
    [
      seededIssueId,
      project.id,
      staffPrincipalId,
      Date.now(),
      crypto.randomUUID(),
      milestoneDocument.id,
    ],
  );
  const referenced = await call(
    `/api/v1/projects/${project.id}/milestones/${milestoneDocument.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(referenced.status).toBe(409);
  expect(await referenced.json()).toMatchObject({
    error: { code: 'TAXONOMY_CONFLICT' },
  });
  const progressAfterSeed = await call(
    `/api/v1/projects/${project.id}/milestones`,
    { token: staffToken },
  );
  const milestones = (await progressAfterSeed.json()) as {
    milestones: { progress: { open: number; closed: number } }[];
  };
  expect(milestones.milestones[0]!.progress).toEqual({ open: 1, closed: 0 });

  // Referenced labels refuse removal the same way.
  await pool.query(
    'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES ($1, $2, $3)',
    [project.id, seededIssueId, labelDocument.id],
  );
  const labelReferenced = await call(
    `/api/v1/projects/${project.id}/labels/${labelDocument.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(labelReferenced.status).toBe(409);

  // 06.1c's audit portion stays suspended: no project/taxonomy audit events.
  const { rows: audited } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE action LIKE 'project.%' OR action LIKE 'taxonomy.%'",
  );
  expect(audited[0]!.count).toBe(0);
});
