import { deriveMarkdownTree } from '../../packages/security/src/markdown/index.ts';
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

// 06.3 discussion journey on the Node/PostgreSQL profile: comments with
// permalinks, history and moderation, idempotent reactions with bounded
// grouped counts, and the merged cursor-paginated timeline.
const databaseName = 'hyperbug_discussion_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'discussion-cli',
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
      clientId: 'discussion-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-discussion-state',
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
      client_id: 'discussion-cli',
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-discussion-route-'));
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

it('delivers discussion and timeline on Node/PostgreSQL', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  await post('/api/v1/accounts/register', {
    handle: 'commenter',
    password: 'long-functional-password',
  });
  await post('/api/v1/accounts/register', {
    handle: 'stranger',
    password: 'long-functional-password',
  });
  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const authorToken = await loginToken('commenter', 'long-functional-password');
  const strangerToken = await loginToken(
    'stranger',
    'long-functional-password',
  );

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'pg-discussion', name: 'PG Discussion' },
    })
  ).json()) as { id: string };
  const issue = (await (
    await call(`/api/v1/projects/${project.id}/issues`, {
      method: 'POST',
      token: authorToken,
      body: { title: 'Discuss here', body: 'Open thread' },
    })
  ).json()) as { id: string };

  // Comment creation with idempotent replay.
  const commentBody = { body: 'First comment 🎉' };
  const created = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    {
      method: 'POST',
      token: authorToken,
      body: commentBody,
      idempotencyKey: 'pg-comment-idem-0001',
    },
  );
  expect(created.status).toBe(201);
  const comment = (await created.json()) as {
    id: string;
    revision: number;
    moderation: string;
    deleted: boolean;
  };
  expect(comment.revision).toBe(1);
  expect(comment.moderation).toBe('visible');
  const replayed = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    {
      method: 'POST',
      token: authorToken,
      body: commentBody,
      idempotencyKey: 'pg-comment-idem-0001',
    },
  );
  expect(replayed.status).toBe(201);
  expect(((await replayed.json()) as { id: string }).id).toBe(comment.id);

  const second = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { method: 'POST', token: strangerToken, body: { body: 'Second!' } },
  );
  expect(second.status).toBe(201);
  const secondComment = (await second.json()) as { id: string };

  // Permalink read works anonymously; the list is ascending.
  const permalink = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    { origin: null },
  );
  expect(permalink.status).toBe(200);
  const permalinkData = (await permalink.json()) as {
    body: string;
    bodyTree: unknown;
    preview: string;
    contentPolicyVersion: string;
    representationEtag: string;
  };
  expect(permalinkData.body).toBe('First comment 🎉');
  expect(permalinkData.bodyTree).toEqual(
    deriveMarkdownTree('First comment 🎉'),
  );
  expect(permalinkData.preview).toBe('First comment 🎉');
  expect(permalinkData.contentPolicyVersion).toBe('hyperbug-content-1');
  expect(permalink.headers.get('etag')).toBe(permalinkData.representationEtag);
  const repeated = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    { origin: null },
  );
  expect(await repeated.json()).toEqual(permalinkData);
  const list = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { origin: null },
  );
  const page = (await list.json()) as {
    comments: {
      id: string;
      body?: string;
      bodyTree?: unknown;
      preview: string;
      textProjectionVersion: string;
    }[];
  };
  expect(page.comments.map((item) => item.id)).toEqual([
    comment.id,
    secondComment.id,
  ]);

  expect(
    page.comments.every(
      (item) => item.body === undefined && item.bodyTree === undefined,
    ),
  ).toBe(true);
  expect(page.comments[0]!.preview).toBe('First comment 🎉');
  expect(page.comments[0]!.textProjectionVersion).toBe('hyperbug-text-1');
  const tooDeep = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { method: 'POST', token: authorToken, body: { body: '['.repeat(33) } },
  );
  expect(tooDeep.status).toBe(400);

  // Editing: the author succeeds, a stranger is forbidden, stale revisions
  // conflict, and the immutable history stays staff-only.
  const edited = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, body: 'First comment, edited' },
    },
  );
  expect(edited.status).toBe(200);
  expect(((await edited.json()) as { revision: number }).revision).toBe(2);
  const strangerEdit = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    {
      method: 'PATCH',
      token: strangerToken,
      body: { expectedRevision: 2, body: 'Hijack' },
    },
  );
  expect(strangerEdit.status).toBe(403);
  const stale = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, body: 'Stale' },
    },
  );
  expect(stale.status).toBe(409);
  const authorHistory = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}/history`,
    { token: authorToken },
  );
  expect(authorHistory.status).toBe(403);
  const history = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}/history`,
    { token: staffToken },
  );
  expect(history.status).toBe(200);
  const historyPage = (await history.json()) as {
    entries: { revision: number; body: string }[];
  };
  expect(historyPage.entries.map((entry) => entry.revision)).toEqual([1, 2]);
  expect(historyPage.entries[1]!.body).toBe('First comment, edited');

  // Reactions: idempotent add/remove with bounded grouped counts.
  const reactionBase = `/api/v1/projects/${project.id}/issues/${issue.id}/reactions`;
  const added = await call(reactionBase, {
    method: 'POST',
    token: authorToken,
    body: { reaction: 'heart' },
  });
  expect(added.status).toBe(200);
  expect(await added.json()).toMatchObject({ status: 'added' });
  const present = await call(reactionBase, {
    method: 'POST',
    token: authorToken,
    body: { reaction: 'heart' },
  });
  expect(await present.json()).toMatchObject({ status: 'present' });
  const invalid = await call(reactionBase, {
    method: 'POST',
    token: authorToken,
    body: { reaction: 'sparkles' },
  });
  expect(invalid.status).toBe(400);
  await call(reactionBase, {
    method: 'POST',
    token: strangerToken,
    body: { reaction: 'heart' },
  });
  const counts = await call(reactionBase, { origin: null });
  expect(await counts.json()).toMatchObject({
    reactions: [{ reaction: 'heart', count: 2 }],
  });
  const removed = await call(`${reactionBase}/heart`, {
    method: 'DELETE',
    token: authorToken,
    body: {},
  });
  expect(await removed.json()).toMatchObject({ status: 'removed' });
  const absent = await call(`${reactionBase}/heart`, {
    method: 'DELETE',
    token: authorToken,
    body: {},
  });
  expect(await absent.json()).toMatchObject({ status: 'absent' });
  const commentReaction = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}/reactions`,
    { method: 'POST', token: strangerToken, body: { reaction: 'rocket' } },
  );
  expect(await commentReaction.json()).toMatchObject({ status: 'added' });
  const commentCounts = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}/reactions`,
    { origin: null },
  );
  expect(await commentCounts.json()).toMatchObject({
    reactions: [{ reaction: 'rocket', count: 1 }],
  });

  // Moderation: hidden comments vanish publicly but stay staff-visible.
  const moderated = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${secondComment.id}/moderate`,
    { method: 'POST', token: staffToken, body: { moderation: 'hidden' } },
  );
  expect(moderated.status).toBe(200);
  expect(((await moderated.json()) as { moderation: string }).moderation).toBe(
    'hidden',
  );
  const hiddenPermalink = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${secondComment.id}`,
    { origin: null },
  );
  expect(hiddenPermalink.status).toBe(404);
  const staffSees = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${secondComment.id}`,
    { token: staffToken },
  );
  expect(staffSees.status).toBe(200);
  const publicList = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { origin: null },
  );
  expect(
    ((await publicList.json()) as { comments: unknown[] }).comments,
  ).toHaveLength(1);

  // Own-comment tombstone deletion.
  const deleted = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    { method: 'DELETE', token: authorToken, body: {} },
  );
  expect(deleted.status).toBe(204);
  const deletedAgain = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    { method: 'DELETE', token: authorToken, body: {} },
  );
  expect(deletedAgain.status).toBe(404);
  const staffDeleted = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments/${comment.id}`,
    { token: staffToken },
  );
  expect(staffDeleted.status).toBe(200);
  expect(((await staffDeleted.json()) as { deleted: boolean }).deleted).toBe(
    true,
  );

  // The merged timeline: events and comments in stable ascending order, with
  // hidden/deleted rows filtered by audience.
  const timeline = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline`,
    { origin: null },
  );
  expect(timeline.status).toBe(200);
  const merged = (await timeline.json()) as {
    items: { kind: string; action?: string; deleted?: boolean }[];
  };
  expect(merged.items.map((item) => item.kind)).toEqual(['event']);
  expect((merged.items[0] as { action: string }).action).toBe('issue.create');
  const staffTimeline = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline`,
    { token: staffToken },
  );
  const staffMerged = (await staffTimeline.json()) as {
    items: { kind: string; deleted?: boolean; body?: string }[];
  };
  expect(staffMerged.items.map((item) => item.kind)).toEqual([
    'event',
    'comment',
    'comment',
  ]);
  const staffComments = staffMerged.items.filter(
    (item) => item.kind === 'comment',
  );
  expect(staffComments[0]!.deleted).toBe(true);
  expect(staffComments[0]!.body).toBeUndefined();
  expect(staffComments[1]!.deleted).toBe(false);

  // Timeline pagination: one item per page walks the full order.
  const firstPage = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline?limit=1`,
    { token: staffToken },
  );
  const pageOne = (await firstPage.json()) as {
    items: { kind: string }[];
    nextCursor: string | null;
  };
  expect(pageOne.items).toHaveLength(1);
  expect(pageOne.nextCursor).not.toBeNull();
  const secondPage = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline?limit=1&cursor=${pageOne.nextCursor}`,
    { token: staffToken },
  );
  const pageTwo = (await secondPage.json()) as {
    items: { kind: string }[];
    nextCursor: string | null;
  };
  expect(pageTwo.items).toHaveLength(1);
  expect(pageTwo.items[0]!.kind).toBe('comment');
});
