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

// 06.2 lifecycle journey on the Node/PostgreSQL profile: the identical issue
// surface against the PostgreSQL repository — number allocation, taxonomy
// references, idempotent replay, revision conflicts, the triage mutation set
// with atomic timeline/outbox writes, moderation-aware reads and the audit
// suspension.
const databaseName = 'hyperbug_issue_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'issues-cli',
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
    idempotencyKey?: string;
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
      ...(init.idempotencyKey === undefined
        ? {}
        : { 'idempotency-key': init.idempotencyKey }),
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
      clientId: 'issues-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-issue-state',
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
      client_id: 'issues-cli',
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-issue-route-'));
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
      issueRepository: configured.issueRepository,
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

it('delivers the issue lifecycle on Node/PostgreSQL', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  await post('/api/v1/accounts/register', {
    handle: 'issueauthor',
    password: 'long-functional-password',
  });
  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const authorToken = await loginToken(
    'issueauthor',
    'long-functional-password',
  );
  const staffAccount = await call('/api/v1/account', { token: staffToken });
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'pg-lifecycle', name: 'PG Lifecycle' },
    })
  ).json()) as { id: string };
  const label = (await (
    await call(`/api/v1/projects/${project.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'Bug' },
    })
  ).json()) as { id: string };
  const milestone = (await (
    await call(`/api/v1/projects/${project.id}/milestones`, {
      method: 'POST',
      token: staffToken,
      body: { title: 'v1.0' },
    })
  ).json()) as { id: string };

  const created = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: {
      title: 'PG crash',
      body: 'PostgreSQL body',
      milestoneId: milestone.id,
      labelIds: [label.id],
      assigneeIds: [staffPrincipalId],
    },
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as {
    id: string;
    number: number;
    revision: number;
    labelIds: string[];
    assigneeIds: string[];
  };
  expect(issue.number).toBe(1);
  expect(issue.labelIds).toEqual([label.id]);
  expect(issue.assigneeIds).toEqual([staffPrincipalId]);

  const second = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Second', body: 'Another' },
    idempotencyKey: 'pg-idem-key-0001',
  });
  expect(second.status).toBe(201);
  const replay = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Second', body: 'Another' },
    idempotencyKey: 'pg-idem-key-0001',
  });
  expect(replay.status).toBe(201);
  expect((await replay.json()).id).toBe((await second.json()).id);
  const { rows: numbers } = await pool.query(
    'SELECT number FROM issues WHERE project_id = $1 ORDER BY number',
    [project.id],
  );
  expect(numbers.map((row) => row.number)).toEqual([1, 2]);

  // Taxonomy references outside the project never create.
  const foreignLabel = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Bad', body: 'x', labelIds: [crypto.randomUUID()] },
  });
  expect(foreignLabel.status).toBe(400);
  const ineligibleAssignee = await call(
    `/api/v1/projects/${project.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad', body: 'x', assigneeIds: [crypto.randomUUID()] },
    },
  );
  expect(ineligibleAssignee.status).toBe(400);

  // Own-content edit, stranger denial, stale revision conflict.
  const edited = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, title: 'PG crash!', body: 'Updated' },
    },
  );
  expect(edited.status).toBe(200);
  expect(((await edited.json()) as { revision: number }).revision).toBe(2);
  const stale = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, title: 'Stale', body: 'x' },
    },
  );
  expect(stale.status).toBe(409);

  // Triage set with a same-value no-op and a real change.
  const noOpLabels = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 2, labelIds: [label.id] },
    },
  );
  expect(noOpLabels.status).toBe(200);
  expect(((await noOpLabels.json()) as { revision: number }).revision).toBe(2);
  const labelsCleared = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 2, labelIds: [] },
    },
  );
  expect(labelsCleared.status).toBe(200);

  const closed = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/close`,
    {
      method: 'POST',
      token: staffToken,
      body: { expectedRevision: 3, reason: 'completed' },
    },
  );
  expect(closed.status).toBe(200);
  const reopened = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/reopen`,
    { method: 'POST', token: staffToken, body: { expectedRevision: 4 } },
  );
  expect(reopened.status).toBe(200);

  const { rows: events } = await pool.query(
    'SELECT action, aggregate_revision FROM timeline_events WHERE issue_id = $1 ORDER BY aggregate_revision',
    [issue.id],
  );
  expect(events.map((row) => row.action)).toEqual([
    'issue.create',
    'issue.edit',
    'issue.labels',
    'issue.close',
    'issue.reopen',
  ]);
  const { rows: outbox } = await pool.query(
    'SELECT event_type FROM outbox WHERE aggregate_id = $1 ORDER BY created_at, id',
    [issue.id],
  );
  expect(outbox.map((row) => row.event_type)).toEqual([
    'issue.create',
    'issue.edit',
    'issue.labels',
    'issue.close',
    'issue.reopen',
  ]);

  // Moderation-aware reads on PostgreSQL.
  await pool.query('UPDATE issues SET moderation = $1 WHERE id = $2', [
    'hidden',
    issue.id,
  ]);
  const hiddenDetail = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { origin: null },
  );
  expect(hiddenDetail.status).toBe(404);
  const staffHidden = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { token: staffToken },
  );
  expect(staffHidden.status).toBe(200);
  const list = await call(`/api/v1/projects/${project.id}/issues`, {
    origin: null,
  });
  expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(1);
  const staffList = await call(`/api/v1/projects/${project.id}/issues`, {
    token: staffToken,
  });
  expect(((await staffList.json()) as { items: unknown[] }).items).toHaveLength(
    2,
  );

  // 06.2c's audit portion stays suspended: no issue.* audit events.
  const { rows: audited } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE action LIKE 'issue.%'",
  );
  expect(audited[0]!.count).toBe(0);
});
