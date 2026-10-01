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

// 06.V2 negatives spot-check on the Node/PostgreSQL profile: cross-project
// taxonomy/issue ids and removed assignees plus deleted/disabled taxonomy —
// the cheapest high-value parity rows of the full workerd matrix. The
// removed-assignee principal is seeded out of band (bootstrap is
// single-shot) and its project role is granted and removed directly, since
// the membership-route journey is owned by the workerd matrix.
const databaseName = 'hyperbug_acceptance_v2_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'negatives-cli',
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
      clientId: 'negatives-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-negatives-state',
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
      client_id: 'negatives-cli',
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-acceptance-negatives-'));
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
      commentStore: configured.commentStore,
      reactionStore: configured.reactionStore,
      timelineStore: configured.timelineStore,
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

it('enforces the cross-project and removed-reference negatives on Node/PostgreSQL', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  expect(
    (
      await post('/api/v1/accounts/register', {
        handle: 'pgauthor',
        password: 'long-functional-password',
      })
    ).status,
  ).toBe(202);
  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const authorToken = await loginToken('pgauthor', 'long-functional-password');
  const staffPrincipalId = (
    (await (await call('/api/v1/account', { token: staffToken })).json()) as {
      principalId: string;
    }
  ).principalId;

  const projectA = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'pg-negatives-a', name: 'PG Negatives A' },
    })
  ).json()) as { id: string };
  const projectB = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'pg-negatives-b', name: 'PG Negatives B' },
    })
  ).json()) as { id: string };

  const labelKeep = (await (
    await call(`/api/v1/projects/${projectA.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'keep' },
    })
  ).json()) as { id: string };
  const labelDoomed = (await (
    await call(`/api/v1/projects/${projectA.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'doomed' },
    })
  ).json()) as { id: string };
  const typeFrozen = (await (
    await call(`/api/v1/projects/${projectA.id}/issue-types`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'frozen', icon: '🧊' },
    })
  ).json()) as { id: string };
  const typeRetired = (await (
    await call(`/api/v1/projects/${projectA.id}/issue-types`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'retired', icon: '🗄️' },
    })
  ).json()) as { id: string };
  const milestoneOne = (await (
    await call(`/api/v1/projects/${projectA.id}/milestones`, {
      method: 'POST',
      token: staffToken,
      body: { title: 'v0.1' },
    })
  ).json()) as { id: string };
  const labelForeign = (await (
    await call(`/api/v1/projects/${projectB.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'b-only' },
    })
  ).json()) as { id: string };

  const created = await call(`/api/v1/projects/${projectA.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Flaky migration', body: 'Fails on rerun' },
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as { id: string; revision: number };
  let revision = issue.revision;
  expect(revision).toBe(1);

  // Cross-project ids: project A taxonomy cannot build an issue in project
  // B, and project B's issue id does not exist under project A's path.
  const foreignLabelCreate = await call(
    `/api/v1/projects/${projectB.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad label', body: 'x', labelIds: [labelKeep.id] },
    },
  );
  expect(foreignLabelCreate.status).toBe(400);
  expect(await foreignLabelCreate.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const foreignTypeCreate = await call(
    `/api/v1/projects/${projectB.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad type', body: 'x', typeId: typeFrozen.id },
    },
  );
  expect(foreignTypeCreate.status).toBe(400);
  expect(await foreignTypeCreate.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const foreignMilestoneCreate = await call(
    `/api/v1/projects/${projectB.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad milestone', body: 'x', milestoneId: milestoneOne.id },
    },
  );
  expect(foreignMilestoneCreate.status).toBe(400);
  expect(await foreignMilestoneCreate.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const localCreate = await call(`/api/v1/projects/${projectB.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'B-side report', body: 'x', labelIds: [labelForeign.id] },
  });
  expect(localCreate.status).toBe(201);
  const bIssue = (await localCreate.json()) as { id: string };
  const crossProjectRead = await call(
    `/api/v1/projects/${projectA.id}/issues/${bIssue.id}`,
    { token: authorToken },
  );
  expect(crossProjectRead.status).toBe(404);

  // Removed assignee: a staff principal whose project role was removed is
  // no longer assignable, while a current member still is.
  const triagerPrincipalId = crypto.randomUUID();
  await pool.query(
    "INSERT INTO principals (id, kind, display_name, status, created_at, revision) VALUES ($1, 'staff', 'negassignee', 'active', $2, 1)",
    [triagerPrincipalId, Date.now()],
  );
  await pool.query(
    "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES ($1, $2, 'staff', 'triage', $3)",
    [projectA.id, triagerPrincipalId, Date.now()],
  );
  const memberAssignee = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [triagerPrincipalId] },
    },
  );
  expect(memberAssignee.status).toBe(200);
  revision = ((await memberAssignee.json()) as { revision: number }).revision;
  // The schema's assignee-membership foreign key holds the reference, so
  // the assignment is detached before the role row disappears.
  const detachedAssignee = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [] },
    },
  );
  expect(detachedAssignee.status).toBe(200);
  revision = ((await detachedAssignee.json()) as { revision: number }).revision;
  await pool.query(
    'DELETE FROM project_roles WHERE project_id = $1 AND principal_id = $2',
    [projectA.id, triagerPrincipalId],
  );
  const removedAssignee = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [triagerPrincipalId] },
    },
  );
  expect(removedAssignee.status).toBe(400);
  expect(await removedAssignee.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });

  // Deleted label: unreferenced entries delete through the taxonomy route
  // and the dead id is refused afterwards on triage and creation alike.
  const droppedLabel = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, labelIds: [labelKeep.id] },
    },
  );
  expect(droppedLabel.status).toBe(200);
  revision = ((await droppedLabel.json()) as { revision: number }).revision;
  const labelDeleted = await call(
    `/api/v1/projects/${projectA.id}/labels/${labelDoomed.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(labelDeleted.status).toBe(204);
  const deletedLabelTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, labelIds: [labelDoomed.id] },
    },
  );
  expect(deletedLabelTriage.status).toBe(400);
  expect(await deletedLabelTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const deletedLabelCreate = await call(
    `/api/v1/projects/${projectA.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Dead label', body: 'x', labelIds: [labelDoomed.id] },
    },
  );
  expect(deletedLabelCreate.status).toBe(400);

  // Deleted milestone: same pattern — attach, detach, delete, refuse.
  const attachedMilestone = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, milestoneId: milestoneOne.id },
    },
  );
  expect(attachedMilestone.status).toBe(200);
  revision = ((await attachedMilestone.json()) as { revision: number })
    .revision;
  const clearedMilestone = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, milestoneId: null },
    },
  );
  expect(clearedMilestone.status).toBe(200);
  revision = ((await clearedMilestone.json()) as { revision: number }).revision;
  const milestoneDeleted = await call(
    `/api/v1/projects/${projectA.id}/milestones/${milestoneOne.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(milestoneDeleted.status).toBe(204);
  const deletedMilestoneTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, milestoneId: milestoneOne.id },
    },
  );
  expect(deletedMilestoneTriage.status).toBe(400);
  expect(await deletedMilestoneTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });

  // Deleted issue type: never referenced, so it deletes directly.
  const typeDeleted = await call(
    `/api/v1/projects/${projectA.id}/issue-types/${typeRetired.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(typeDeleted.status).toBe(204);
  const deletedTypeTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, typeId: typeRetired.id },
    },
  );
  expect(deletedTypeTriage.status).toBe(400);
  expect(await deletedTypeTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });

  // Disabled issue type: new assignments refuse it while an issue that
  // already carries it keeps the reference.
  const frozenCreated = await call(`/api/v1/projects/${projectA.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Frozen reference', body: 'x', typeId: typeFrozen.id },
  });
  expect(frozenCreated.status).toBe(201);
  const frozenIssue = (await frozenCreated.json()) as { id: string };
  const typeDisabled = await call(
    `/api/v1/projects/${projectA.id}/issue-types/${typeFrozen.id}`,
    {
      method: 'PATCH',
      token: staffToken,
      body: { expectedRevision: 1, enabled: false },
    },
  );
  expect(typeDisabled.status).toBe(200);
  const disabledTypeTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, typeId: typeFrozen.id },
    },
  );
  expect(disabledTypeTriage.status).toBe(400);
  expect(await disabledTypeTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const frozenRead = await call(
    `/api/v1/projects/${projectA.id}/issues/${frozenIssue.id}`,
    { token: authorToken },
  );
  expect(frozenRead.status).toBe(200);
  expect(((await frozenRead.json()) as { typeId: string | null }).typeId).toBe(
    typeFrozen.id,
  );
  const memberStillAssignable = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [staffPrincipalId] },
    },
  );
  expect(memberStillAssignable.status).toBe(200);
});
