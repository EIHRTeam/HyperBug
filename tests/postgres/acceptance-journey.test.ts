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

// 06.V1 acceptance journey on the Node/PostgreSQL profile: the identical
// HTTP workflow — project → create → list → comment → react →
// label/assign/type/milestone → close → reopen → merged timeline — with
// leaner field assertions where the workerd journey already pins them.
const databaseName = 'hyperbug_acceptance_v1_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'acceptance-cli',
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
      clientId: 'acceptance-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-acceptance-state',
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
      client_id: 'acceptance-cli',
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-acceptance-v1-'));
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

it('delivers the V1 HTTP workflow on Node/PostgreSQL', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  await post('/api/v1/accounts/register', {
    handle: 'journeyauthor',
    password: 'long-functional-password',
  });
  await post('/api/v1/accounts/register', {
    handle: 'journeypeer',
    password: 'long-functional-password',
  });
  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const authorToken = await loginToken(
    'journeyauthor',
    'long-functional-password',
  );
  const peerToken = await loginToken('journeypeer', 'long-functional-password');
  const staffPrincipalId = (
    (await (await call('/api/v1/account', { token: staffToken })).json()) as {
      principalId: string;
    }
  ).principalId;

  // Staff creates the project, then the taxonomy the triage steps reference.
  const createdProject = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'pg-journey-v1', name: 'PG Journey V1' },
  });
  expect(createdProject.status).toBe(201);
  const project = (await createdProject.json()) as { id: string };
  const createdLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: staffToken,
    body: { name: 'Bug' },
  });
  expect(createdLabel.status).toBe(201);
  const label = (await createdLabel.json()) as { id: string };
  const createdType = await call(`/api/v1/projects/${project.id}/issue-types`, {
    method: 'POST',
    token: staffToken,
    body: { name: 'Bug' },
  });
  expect(createdType.status).toBe(201);
  const type = (await createdType.json()) as { id: string };
  const createdMilestone = await call(
    `/api/v1/projects/${project.id}/milestones`,
    { method: 'POST', token: staffToken, body: { title: 'v1.0' } },
  );
  expect(createdMilestone.status).toBe(201);
  const milestone = (await createdMilestone.json()) as { id: string };

  // A plain user creates the issue; the taxonomy is applied by staff triage.
  const createdIssue = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Crash during the journey', body: 'Full workflow body 🚀' },
  });
  expect(createdIssue.status).toBe(201);
  const issue = (await createdIssue.json()) as {
    id: string;
    number: number;
    revision: number;
  };
  expect(issue.number).toBe(1);
  expect(issue.revision).toBe(1);

  // The list page shape: projections exclude the body, plus the cursor field.
  const list = await call(`/api/v1/projects/${project.id}/issues`, {
    origin: null,
  });
  expect(list.status).toBe(200);
  const page = (await list.json()) as {
    items: { id: string; body: unknown }[];
    nextCursor: string | null;
  };
  expect(page.items).toHaveLength(1);
  expect(page.items[0]!.id).toBe(issue.id);
  expect(page.items[0]!.body).toBeNull();
  expect(page.nextCursor).toBeNull();

  // Both users comment, in order, before any triage happens.
  const createdComment = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { method: 'POST', token: authorToken, body: { body: 'Triage notes 📝' } },
  );
  expect(createdComment.status).toBe(201);
  const comment = (await createdComment.json()) as { id: string };
  const createdPeerComment = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    {
      method: 'POST',
      token: peerToken,
      body: { body: 'Confirmed on my machine' },
    },
  );
  expect(createdPeerComment.status).toBe(201);
  const peerComment = (await createdPeerComment.json()) as { id: string };

  // The author reacts to the issue, the peer to the first comment.
  const issueReaction = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/reactions`,
    { method: 'POST', token: authorToken, body: { reaction: 'heart' } },
  );
  expect(issueReaction.status).toBe(200);
  expect(await issueReaction.json()).toMatchObject({ status: 'added' });
  const commentReaction = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}/reactions`,
    { method: 'POST', token: peerToken, body: { reaction: 'eyes' } },
  );
  expect(commentReaction.status).toBe(200);
  expect(await commentReaction.json()).toMatchObject({ status: 'added' });

  // Staff triage: each set operation bumps and returns the next revision,
  // which the next mutation reuses as its expected revision.
  let revision = issue.revision;
  const triageStep = async (suffix: string, body: Record<string, unknown>) => {
    const applied = await call(
      `/api/v1/projects/${project.id}/issues/${issue.id}/${suffix}`,
      { method: 'PUT', token: staffToken, body },
    );
    expect(applied.status).toBe(200);
    const view = (await applied.json()) as {
      revision: number;
      labelIds: string[];
      assigneeIds: string[];
    };
    expect(view.revision).toBe(revision + 1);
    revision = view.revision;
    return view;
  };
  const labeled = await triageStep('labels', {
    expectedRevision: revision,
    labelIds: [label.id],
  });
  expect(labeled.labelIds).toEqual([label.id]);
  await triageStep('type', { expectedRevision: revision, typeId: type.id });
  await triageStep('milestone', {
    expectedRevision: revision,
    milestoneId: milestone.id,
  });
  const assigned = await triageStep('assignees', {
    expectedRevision: revision,
    assigneeIds: [staffPrincipalId],
  });
  expect(assigned.assigneeIds).toEqual([staffPrincipalId]);

  // Close with a reason, then reopen; both reuse the running revision.
  const closed = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/close`,
    {
      method: 'POST',
      token: staffToken,
      body: { expectedRevision: revision, reason: 'completed' },
    },
  );
  expect(closed.status).toBe(200);
  const closedView = (await closed.json()) as {
    state: string;
    closeReason: string | null;
    revision: number;
  };
  expect(closedView.state).toBe('closed');
  expect(closedView.closeReason).toBe('completed');
  expect(closedView.revision).toBe(revision + 1);
  revision = closedView.revision;
  const reopened = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/reopen`,
    { method: 'POST', token: staffToken, body: { expectedRevision: revision } },
  );
  expect(reopened.status).toBe(200);
  const reopenedView = (await reopened.json()) as {
    state: string;
    closeReason: string | null;
    revision: number;
  };
  expect(reopenedView.state).toBe('open');
  expect(reopenedView.closeReason).toBeNull();
  expect(reopenedView.revision).toBe(revision + 1);

  // The merged timeline: comments interleave at their timestamps between
  // issue.create and the triage events, with strictly increasing revisions.
  const timeline = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline`,
    { token: staffToken },
  );
  expect(timeline.status).toBe(200);
  expect(timeline.headers.get('cache-control')).toBe('no-store');
  const merged = (await timeline.json()) as {
    items: {
      kind: string;
      id: string;
      action?: string;
      revision: number;
      body?: string;
    }[];
    nextCursor: string | null;
  };
  expect(merged.items.map((item) => item.kind)).toEqual([
    'event',
    'comment',
    'comment',
    'event',
    'event',
    'event',
    'event',
    'event',
    'event',
  ]);
  const events = merged.items.filter((item) => item.kind === 'event');
  expect(events.map((event) => event.action)).toEqual([
    'issue.create',
    'issue.labels',
    'issue.type',
    'issue.milestone',
    'issue.assignees',
    'issue.close',
    'issue.reopen',
  ]);
  expect(events.map((event) => event.revision)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  const comments = merged.items.filter((item) => item.kind === 'comment');
  expect(comments.map((item) => item.id)).toEqual([comment.id, peerComment.id]);
  expect(comments.map((item) => item.body)).toEqual([
    'Triage notes 📝',
    'Confirmed on my machine',
  ]);
  expect(merged.nextCursor).toBeNull();
});
