import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

// 06.V1 acceptance journey on workerd/D1: the complete HTTP workflow —
// project → create → list → comment → react → label/assign/type/milestone →
// close → reopen → merged timeline — through the real API surface, asserting
// every step's status and the full ordered timeline sequence.
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
      clientId: 'acceptance-cli',
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
    client_id: 'acceptance-cli',
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
            clientId: 'acceptance-cli',
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

it('delivers the V1 HTTP workflow on workerd/D1', async () => {
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
  const staffCookie = ((
    await post('/auth/login', {
      handle: 'rootadmin',
      password: 'operator-password-1',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const authorCookie = ((
    await post('/auth/login', {
      handle: 'journeyauthor',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const peerCookie = ((
    await post('/auth/login', {
      handle: 'journeypeer',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (!staffCookie || !authorCookie || !peerCookie)
    throw new Error('Missing session cookies');
  const staffToken = await tokenFromCookie(staffCookie, 'staff');
  const authorToken = await tokenFromCookie(authorCookie, 'author');
  const peerToken = await tokenFromCookie(peerCookie, 'peer');
  const principalOf = async (token: string): Promise<string> =>
    (
      (await (await call('/api/v1/account', { token })).json()) as {
        principalId: string;
      }
    ).principalId;
  const staffPrincipalId = await principalOf(staffToken);
  const authorPrincipalId = await principalOf(authorToken);
  const peerPrincipalId = await principalOf(peerToken);

  // Staff creates the project, then the taxonomy the triage steps reference.
  const createdProject = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'journey-v1', name: 'Journey V1' },
  });
  expect(createdProject.status).toBe(201);
  const project = (await createdProject.json()) as {
    id: string;
    slug: string;
    visibility: string;
  };
  expect(project.slug).toBe('journey-v1');
  expect(project.visibility).toBe('public');
  const createdLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: staffToken,
    body: { name: 'Bug', color: '#ff0000' },
  });
  expect(createdLabel.status).toBe(201);
  const label = (await createdLabel.json()) as { id: string };
  const createdType = await call(`/api/v1/projects/${project.id}/issue-types`, {
    method: 'POST',
    token: staffToken,
    body: { name: 'Bug', icon: '🐛' },
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
    state: string;
    authorId: string;
    body: string;
  };
  expect(issue.number).toBe(1);
  expect(issue.revision).toBe(1);
  expect(issue.state).toBe('open');
  expect(issue.authorId).toBe(authorPrincipalId);
  expect(issue.body).toBe('Full workflow body 🚀');

  // The list page shape: items with projections that exclude the body, plus
  // the cursor field; the boundary keeps the response uncacheable.
  const list = await call(`/api/v1/projects/${project.id}/issues`, {
    origin: null,
  });
  expect(list.status).toBe(200);
  expect(list.headers.get('cache-control')).toBe('no-store');
  const page = (await list.json()) as {
    items: { id: string; number: number; body: unknown }[];
    nextCursor: string | null;
  };
  expect(page.items).toHaveLength(1);
  expect(page.items[0]!.id).toBe(issue.id);
  expect(page.items[0]!.number).toBe(1);
  expect(page.items[0]!.body).toBeNull();
  expect(page.nextCursor).toBeNull();

  // Both users comment, in order, before any triage happens.
  const createdComment = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/comments`,
    { method: 'POST', token: authorToken, body: { body: 'Triage notes 📝' } },
  );
  expect(createdComment.status).toBe(201);
  const comment = (await createdComment.json()) as {
    id: string;
    revision: number;
    body: string;
    moderation: string;
  };
  expect(comment.revision).toBe(1);
  expect(comment.body).toBe('Triage notes 📝');
  expect(comment.moderation).toBe('visible');
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
  const counts = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/reactions`,
    { origin: null },
  );
  expect(await counts.json()).toMatchObject({
    reactions: [{ reaction: 'heart', count: 1 }],
  });

  // Staff triage: each set operation bumps and returns the next revision,
  // which the next mutation reuses as its expected revision.
  let revision = issue.revision;
  const triageStep = async (
    suffix: string,
    body: Record<string, unknown>,
  ): Promise<{
    revision: number;
    labelIds: string[];
    typeId: string | null;
    milestoneId: string | null;
    assigneeIds: string[];
  }> => {
    const applied = await call(
      `/api/v1/projects/${project.id}/issues/${issue.id}/${suffix}`,
      { method: 'PUT', token: staffToken, body },
    );
    expect(applied.status).toBe(200);
    const view = (await applied.json()) as {
      revision: number;
      labelIds: string[];
      typeId: string | null;
      milestoneId: string | null;
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
  const typed = await triageStep('type', {
    expectedRevision: revision,
    typeId: type.id,
  });
  expect(typed.typeId).toBe(type.id);
  const milestoned = await triageStep('milestone', {
    expectedRevision: revision,
    milestoneId: milestone.id,
  });
  expect(milestoned.milestoneId).toBe(milestone.id);
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
  // Visible comments carry their bodies to every audience, matching the
  // comments list; only hidden/deleted rows withhold bodies (moderator
  // views see those as metadata only).
  const timeline = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline`,
    { origin: null },
  );
  expect(timeline.status).toBe(200);
  expect(timeline.headers.get('cache-control')).toBe('no-store');
  const merged = (await timeline.json()) as {
    items: {
      kind: string;
      id: string;
      action?: string;
      actorId: string;
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
  expect(events[0]!.actorId).toBe(authorPrincipalId);
  expect(events[1]!.actorId).toBe(staffPrincipalId);
  expect(events[6]!.actorId).toBe(staffPrincipalId);
  const comments = merged.items.filter((item) => item.kind === 'comment');
  expect(comments.map((item) => item.id)).toEqual([comment.id, peerComment.id]);
  expect(comments.map((item) => item.actorId)).toEqual([
    authorPrincipalId,
    peerPrincipalId,
  ]);
  expect(comments.map((item) => item.body)).toEqual([
    'Triage notes 📝',
    'Confirmed on my machine',
  ]);
  expect(merged.nextCursor).toBeNull();

  // The staff timeline adds the comment bodies for visible rows.
  const staffTimeline = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/timeline`,
    { token: staffToken },
  );
  expect(staffTimeline.status).toBe(200);
  const staffMerged = (await staffTimeline.json()) as {
    items: {
      kind: string;
      id: string;
      body?: string;
      moderation?: string;
      deleted?: boolean;
    }[];
  };
  expect(staffMerged.items.map((item) => item.kind)).toEqual([
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
  const staffComments = staffMerged.items.filter(
    (item) => item.kind === 'comment',
  );
  expect(staffComments.map((item) => item.body)).toEqual([
    'Triage notes 📝',
    'Confirmed on my machine',
  ]);
  expect(
    staffComments.every(
      (item) => item.moderation === 'visible' && item.deleted === false,
    ),
  ).toBe(true);
});
