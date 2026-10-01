import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

// 06.3 journey on workerd/D1: comments with permalinks, history and
// moderation, idempotent reactions with bounded counts, and the merged
// cursor-paginated timeline.
const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let mf: Miniflare;

const post = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
      ...extra,
    },
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
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(init.origin === null ? {} : { origin: init.origin ?? authOrigin }),
      'sec-fetch-site': 'same-origin',
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

const form = (path: string, fields: Record<string, string>) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'discussion-cli',
      redirectUri,
      scope: 'public-api',
      state,
      codeChallenge: await challengeOf(journeyVerifier),
    },
    { cookie },
  );
  expect(authorized.status).toBe(200);
  const code = new URL(
    ((await authorized.json()) as { redirectUri: string }).redirectUri,
  ).searchParams.get('code');
  const exchange = await form('/auth/token', {
    grant_type: 'authorization_code',
    code: code ?? '',
    redirect_uri: redirectUri,
    client_id: 'discussion-cli',
    code_verifier: journeyVerifier,
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/account-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      ratelimits: {
        ABUSE_VOLUMETRIC: {
          namespace_id: '703415',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: authOrigin,
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_TEST_OAUTH_CLIENTS: JSON.stringify([
          {
            clientId: 'discussion-cli',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
      },
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  await db
    .prepare(
      "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
    )
    .bind(Date.now())
    .run();
});

afterAll(async () => {
  await mf?.dispose();
});

it('delivers discussion and timeline on workerd/D1', async () => {
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
  const staffCookie = ((
    await post('/auth/login', {
      handle: 'rootadmin',
      password: 'operator-password-1',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const authorCookie = ((
    await post('/auth/login', {
      handle: 'commenter',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const strangerCookie = ((
    await post('/auth/login', {
      handle: 'stranger',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (!staffCookie || !authorCookie || !strangerCookie)
    throw new Error('Missing session cookies');
  const staffToken = await tokenFromCookie(staffCookie, 'staff');
  const authorToken = await tokenFromCookie(authorCookie, 'author');
  const strangerToken = await tokenFromCookie(strangerCookie, 'stranger');

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'discussion', name: 'Discussion' },
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
      idempotencyKey: 'comment-idem-0001',
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
      idempotencyKey: 'comment-idem-0001',
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
  expect(((await permalink.json()) as { body: string }).body).toBe(
    'First comment 🎉',
  );
  const list = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { origin: null },
  );
  const page = (await list.json()) as {
    comments: { id: string; body?: string }[];
  };
  expect(page.comments.map((item) => item.id)).toEqual([
    comment.id,
    secondComment.id,
  ]);

  // Editing: the author succeeds, a stranger is forbidden, stale revisions
  // conflict, and every edit lands in the immutable history.
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
