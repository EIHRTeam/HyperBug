import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

// 06.2 lifecycle journey on workerd/D1: number allocation, taxonomy-bearing
// creation, idempotent retries, ownership editing, the triage mutation set
// with timeline/outbox atomicity, moderation-aware reads and the audit
// suspension (no issue.* audit events).
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
      clientId: 'issues-cli',
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
    client_id: 'issues-cli',
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
            clientId: 'issues-cli',
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

it('delivers the issue lifecycle on workerd/D1', async () => {
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
  await post('/api/v1/accounts/register', {
    handle: 'otheruser',
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
      handle: 'issueauthor',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const otherCookie = ((
    await post('/auth/login', {
      handle: 'otheruser',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (!staffCookie || !authorCookie || !otherCookie)
    throw new Error('Missing session cookies');
  const staffToken = await tokenFromCookie(staffCookie, 'staff');
  const authorToken = await tokenFromCookie(authorCookie, 'author');
  const otherToken = await tokenFromCookie(otherCookie, 'other');
  const staffAccount = await call('/api/v1/account', { token: staffToken });
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'lifecycle', name: 'Lifecycle' },
    })
  ).json()) as { id: string };
  const label = (await (
    await call(`/api/v1/projects/${project.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'Bug', color: '#ff0000' },
    })
  ).json()) as { id: string };
  const type = (await (
    await call(`/api/v1/projects/${project.id}/issue-types`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'Bug', icon: '🐛' },
    })
  ).json()) as { id: string };
  const milestone = (await (
    await call(`/api/v1/projects/${project.id}/milestones`, {
      method: 'POST',
      token: staffToken,
      body: { title: 'v1.0' },
    })
  ).json()) as { id: string };

  const db = await mf.getD1Database('DB');

  // Taxonomy-bearing creation by a plain User principal in a public project.
  const created = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: {
      title: 'Crash on launch',
      body: 'Steps to reproduce 🌱',
      typeId: type.id,
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
    state: string;
    typeId: string | null;
    milestoneId: string | null;
    labelIds: string[];
    assigneeIds: string[];
    body: string;
  };
  expect(issue.number).toBe(1);
  expect(issue.revision).toBe(1);
  expect(issue.typeId).toBe(type.id);
  expect(issue.milestoneId).toBe(milestone.id);
  expect(issue.labelIds).toEqual([label.id]);
  expect(issue.assigneeIds).toEqual([staffPrincipalId]);

  const grant = await db
    .prepare('SELECT label_id FROM issue_labels WHERE issue_id = ?')
    .bind(issue.id)
    .first<{ label_id: string }>();
  expect(grant).toEqual({ label_id: label.id });
  const timeline = await db
    .prepare(
      'SELECT action, aggregate_revision FROM timeline_events WHERE issue_id = ? ORDER BY aggregate_revision',
    )
    .bind(issue.id)
    .all<{ action: string; aggregate_revision: number }>();
  expect(timeline.results.map((row) => row.action)).toEqual(['issue.create']);
  const outbox = await db
    .prepare('SELECT event_type FROM outbox WHERE aggregate_id = ?')
    .bind(issue.id)
    .all<{ event_type: string }>();
  expect(outbox.results.map((row) => row.event_type)).toEqual(['issue.create']);

  const second = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: otherToken,
    body: { title: 'Second report', body: 'Another body' },
  });
  expect(((await second.json()) as { number: number }).number).toBe(2);

  // Idempotent create: same key and payload replays the original result.
  const idempotentBody = {
    title: 'Idempotent report',
    body: 'Same payload twice',
  };
  const first = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: idempotentBody,
    idempotencyKey: 'idem-key-0000001',
  });
  expect(first.status).toBe(201);
  const replay = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: idempotentBody,
    idempotencyKey: 'idem-key-0000001',
  });
  expect(replay.status).toBe(201);
  expect(((await replay.json()) as { id: string }).id).toBe(
    ((await first.json()) as { id: string }).id,
  );
  const conflictReplay = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { ...idempotentBody, title: 'Different payload' },
    idempotencyKey: 'idem-key-0000001',
  });
  expect(conflictReplay.status).toBe(409);
  expect(await conflictReplay.json()).toMatchObject({
    error: { code: 'IDEMPOTENCY_CONFLICT' },
  });

  // Anonymous reads of public issues; list projections exclude the body.
  const list = await call(`/api/v1/projects/${project.id}/issues`, {
    origin: null,
  });
  expect(list.status).toBe(200);
  const page = (await list.json()) as {
    items: { id: string; number: number; body: unknown }[];
  };
  expect(page.items).toHaveLength(3);
  expect(page.items.every((item) => item.body === null)).toBe(true);
  const openList = await call(
    `/api/v1/projects/${project.id}/issues?state=open`,
    { origin: null },
  );
  expect(((await openList.json()) as { items: unknown[] }).items).toHaveLength(
    3,
  );
  const detail = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { origin: null },
  );
  expect(detail.status).toBe(200);
  expect(((await detail.json()) as { body: string }).body).toBe(
    'Steps to reproduce 🌱',
  );

  // Anonymous creation is denied; cross-project labels are refused.
  const anonymousCreate = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    origin: null,
    body: { title: 'Nope', body: 'x' },
  });
  expect(anonymousCreate.status).toBe(401);
  const foreignLabel = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Bad refs', body: 'x', labelIds: [crypto.randomUUID()] },
  });
  expect(foreignLabel.status).toBe(400);
  const ineligibleAssignee = await call(
    `/api/v1/projects/${project.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: {
        title: 'Bad assignee',
        body: 'x',
        assigneeIds: [crypto.randomUUID()],
      },
    },
  );
  expect(ineligibleAssignee.status).toBe(400);

  // Ownership editing: the author edits own content, a stranger cannot.
  const edited = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, title: 'Crash on launch!', body: 'Updated' },
    },
  );
  expect(edited.status).toBe(200);
  expect(((await edited.json()) as { revision: number }).revision).toBe(2);
  const strangerEdit = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: otherToken,
      body: { expectedRevision: 2, title: 'Hijack', body: 'No' },
    },
  );
  expect(strangerEdit.status).toBe(403);
  const staffEdit = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: staffToken,
      body: { expectedRevision: 2, title: 'Crash on launch!!', body: 'Staff' },
    },
  );
  expect(staffEdit.status).toBe(200);
  const staleEdit = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 2, title: 'Stale', body: 'No' },
    },
  );
  expect(staleEdit.status).toBe(409);
  expect(await staleEdit.json()).toMatchObject({
    error: { code: 'REVISION_CONFLICT' },
  });

  // Triage mutations stay with the staff ladder; each writes its event.
  const userLabels = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: authorToken,
      body: { expectedRevision: 3, labelIds: [label.id] },
    },
  );
  expect(userLabels.status).toBe(403);
  // Same-value set operations are idempotent no-ops: no event, no bump.
  const noOpLabels = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 3, labelIds: [label.id] },
    },
  );
  expect(noOpLabels.status).toBe(200);
  expect(((await noOpLabels.json()) as { revision: number }).revision).toBe(3);
  const labelsCleared = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 3, labelIds: [] },
    },
  );
  expect(labelsCleared.status).toBe(200);
  expect(((await labelsCleared.json()) as { revision: number }).revision).toBe(
    4,
  );
  const labelsRestored = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 4, labelIds: [label.id] },
    },
  );
  expect(labelsRestored.status).toBe(200);

  const typeCleared = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 5, typeId: null },
    },
  );
  expect(typeCleared.status).toBe(200);
  const typed = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 6, typeId: type.id },
    },
  );
  expect(typed.status).toBe(200);
  const disabledType = await call(
    `/api/v1/projects/${project.id}/issue-types/${type.id}`,
    {
      method: 'PATCH',
      token: staffToken,
      body: { expectedRevision: 1, enabled: false },
    },
  );
  expect(disabledType.status).toBe(200);
  const disabledAssignment = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 7, typeId: type.id },
    },
  );
  expect(disabledAssignment.status).toBe(400);

  const milestoneCleared = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 7, milestoneId: null },
    },
  );
  expect(milestoneCleared.status).toBe(200);
  const milestoned = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 8, milestoneId: milestone.id },
    },
  );
  expect(milestoned.status).toBe(200);
  const milestones = await call(`/api/v1/projects/${project.id}/milestones`, {
    token: staffToken,
  });
  // Only the journey issue carries the milestone at this point.
  expect(
    (
      (await milestones.json()) as {
        milestones: { progress: { open: number } }[];
      }
    ).milestones[0]!.progress,
  ).toMatchObject({ open: 1 });

  const assigneesCleared = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 9, assigneeIds: [] },
    },
  );
  expect(assigneesCleared.status).toBe(200);
  const assigned = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 10, assigneeIds: [staffPrincipalId] },
    },
  );
  expect(assigned.status).toBe(200);

  const userClose = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/close`,
    {
      method: 'POST',
      token: authorToken,
      body: { expectedRevision: 11, reason: 'completed' },
    },
  );
  expect(userClose.status).toBe(403);
  const closed = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/close`,
    {
      method: 'POST',
      token: staffToken,
      body: { expectedRevision: 11, reason: 'not_planned' },
    },
  );
  expect(closed.status).toBe(200);
  expect(((await closed.json()) as { state: string }).state).toBe('closed');
  const closedList = await call(
    `/api/v1/projects/${project.id}/issues?state=closed`,
    { origin: null },
  );
  expect(
    ((await closedList.json()) as { items: unknown[] }).items,
  ).toHaveLength(1);
  const reopened = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/reopen`,
    { method: 'POST', token: staffToken, body: { expectedRevision: 12 } },
  );
  expect(reopened.status).toBe(200);
  expect(((await reopened.json()) as { state: string }).state).toBe('open');

  const actions = await db
    .prepare(
      'SELECT action, aggregate_revision, metadata FROM timeline_events WHERE issue_id = ? ORDER BY aggregate_revision',
    )
    .bind(issue.id)
    .all<{
      action: string;
      aggregate_revision: number;
      metadata: string;
    }>();
  expect(actions.results.map((row) => row.action)).toEqual([
    'issue.create',
    'issue.edit',
    'issue.edit',
    'issue.labels',
    'issue.labels',
    'issue.type',
    'issue.type',
    'issue.milestone',
    'issue.milestone',
    'issue.assignees',
    'issue.assignees',
    'issue.close',
    'issue.reopen',
  ]);
  expect(actions.results.map((row) => row.aggregate_revision)).toEqual([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
  ]);
  const closeEvent = actions.results.find(
    (row) => row.action === 'issue.close',
  );
  expect(JSON.parse(closeEvent!.metadata)).toEqual({
    v: 1,
    reason: 'not_planned',
  });
  const outboxEvents = await db
    .prepare('SELECT event_type FROM outbox WHERE aggregate_id = ?')
    .bind(issue.id)
    .all<{ event_type: string }>();
  expect(outboxEvents.results.length).toBe(13);

  // Moderation-aware reads: hidden rows vanish for the public, not staff.
  await db
    .prepare("UPDATE issues SET moderation = 'hidden' WHERE id = ?")
    .bind(issue.id)
    .run();
  const hiddenDetail = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { origin: null },
  );
  expect(hiddenDetail.status).toBe(404);
  const hiddenList = await call(`/api/v1/projects/${project.id}/issues`, {
    origin: null,
  });
  expect(
    ((await hiddenList.json()) as { items: unknown[] }).items,
  ).toHaveLength(2);
  const staffHidden = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { token: staffToken },
  );
  expect(staffHidden.status).toBe(200);
  const staffHiddenList = await call(`/api/v1/projects/${project.id}/issues`, {
    token: staffToken,
  });
  expect(
    ((await staffHiddenList.json()) as { items: unknown[] }).items,
  ).toHaveLength(3);
  const authorHiddenEdit = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 13, title: 'Locked', body: 'No' },
    },
  );
  expect(authorHiddenEdit.status).toBe(403);

  // 06.2c's audit portion stays suspended: no issue.* audit events exist.
  const audited = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'issue.%'",
    )
    .first<{ count: number }>();
  expect(audited?.count).toBe(0);
});
