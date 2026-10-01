import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { D1Database } from '@cloudflare/workers-types';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';

// 06.V3 acceptance on workerd/D1: concurrent creates allocate unique
// project-local numbers, concurrent edits serialize to one revision bump and
// one timeline event, concurrent reactions stay idempotent per
// actor/target/value, a racing duplicate Idempotency-Key consumes one number,
// a failed timeline-event write rolls the whole aggregate mutation back, and
// equal-millisecond timestamps keep cursor pagination deterministic.
const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let mf: Miniflare;
let db: D1Database;

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
      clientId: 'concurrency-cli',
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
    client_id: 'concurrency-cli',
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
            clientId: 'concurrency-cli',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
      },
    }),
  );
  const raw = await mf.getD1Database('DB');
  db = raw as unknown as D1Database;
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

interface IssueBody {
  id: string;
  number: number;
  revision: number;
}

it('keeps concurrency, idempotency, rollback and pagination correct on workerd/D1', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  await post('/api/v1/accounts/register', {
    handle: 'racer-a',
    password: 'long-functional-password',
  });
  await post('/api/v1/accounts/register', {
    handle: 'racer-b',
    password: 'long-functional-password',
  });
  const staffCookie = ((
    await post('/auth/login', {
      handle: 'rootadmin',
      password: 'operator-password-1',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const cookieA = ((
    await post('/auth/login', {
      handle: 'racer-a',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  const cookieB = ((
    await post('/auth/login', {
      handle: 'racer-b',
      password: 'long-functional-password',
    })
  ).headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (!staffCookie || !cookieA || !cookieB)
    throw new Error('Missing session cookies');
  const staffToken = await tokenFromCookie(staffCookie, 'staff');
  const tokenA = await tokenFromCookie(cookieA, 'racer-a');
  const tokenB = await tokenFromCookie(cookieB, 'racer-b');

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'concurrency', name: 'Concurrency' },
    })
  ).json()) as { id: string };
  const issuesBase = `/api/v1/projects/${project.id}/issues`;

  // 1. Five parallel creations: every request succeeds and the project-local
  // numbers are exactly 1–5 with no duplicates, in bodies and in the list.
  const creations = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      call(issuesBase, {
        method: 'POST',
        token: tokenA,
        body: { title: `Parallel report ${index + 1}`, body: 'Raced create' },
      }),
    ),
  );
  expect(creations.map((response) => response.status)).toEqual([
    201, 201, 201, 201, 201,
  ]);
  const created = (await Promise.all(
    creations.map((response) => response.json()),
  )) as IssueBody[];
  expect([...new Set(created.map((issue) => issue.number))].sort()).toEqual([
    1, 2, 3, 4, 5,
  ]);
  const listed = await call(issuesBase, { origin: null });
  expect(listed.status).toBe(200);
  const listPage = (await listed.json()) as { items: IssueBody[] };
  expect(listPage.items.map((item) => item.number).sort()).toEqual([
    1, 2, 3, 4, 5,
  ]);

  // 2. Two parallel edits at the same expectedRevision: exactly one wins, the
  // aggregate advances exactly one revision, and only one issue.edit event
  // lands. On D1 the loser either fails its pre-read (409 REVISION_CONFLICT)
  // or loses the atomic batch race (503 when the timeline witness insert
  // fails); both prove serialization, and neither may leave a second event.
  const racedIssue = created[0]!;
  const edits = await Promise.all([
    call(`${issuesBase}/${racedIssue.id}`, {
      method: 'PATCH',
      token: tokenA,
      body: { expectedRevision: 1, title: 'Edit wins A', body: 'Winner A' },
    }),
    call(`${issuesBase}/${racedIssue.id}`, {
      method: 'PATCH',
      token: tokenA,
      body: { expectedRevision: 1, title: 'Edit wins B', body: 'Winner B' },
    }),
  ]);
  const editStatuses = edits.map((response) => response.status).sort();
  expect(editStatuses[0]).toBe(200);
  expect([409, 503]).toContain(editStatuses[1]);
  const winningEdit = edits.find((response) => response.status === 200)!;
  const winnerBody = (await winningEdit.json()) as {
    revision: number;
    title: string;
  };
  expect(winnerBody.revision).toBe(2);
  const racedRow = await db
    .prepare('SELECT title, revision FROM issues WHERE id = ?')
    .bind(racedIssue.id)
    .first<{ title: string; revision: number }>();
  expect(racedRow).toEqual({ title: winnerBody.title, revision: 2 });
  const editEvents = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM timeline_events WHERE issue_id = ? AND action = 'issue.edit'",
    )
    .bind(racedIssue.id)
    .first<{ count: number }>();
  expect(editEvents?.count).toBe(1);

  // 3. Concurrent reactions: two principals racing the same value both land
  // (count 2 — one row per actor), the same actor racing itself collapses to
  // one row (added + present, count exactly 1), and a later duplicate stays
  // present with the count unchanged.
  const reactionIssue = created[1]!;
  const reactionBase = `${issuesBase}/${reactionIssue.id}/reactions`;
  const heartRace = await Promise.all([
    call(reactionBase, {
      method: 'POST',
      token: tokenA,
      body: { reaction: 'heart' },
    }),
    call(reactionBase, {
      method: 'POST',
      token: tokenB,
      body: { reaction: 'heart' },
    }),
  ]);
  expect(heartRace.map((response) => response.status)).toEqual([200, 200]);
  const heartOutcomes = (await Promise.all(
    heartRace.map((response) => response.json()),
  )) as { status: string }[];
  expect(heartOutcomes.map((outcome) => outcome.status).sort()).toEqual([
    'added',
    'added',
  ]);
  const rocketRace = await Promise.all([
    call(reactionBase, {
      method: 'POST',
      token: tokenA,
      body: { reaction: 'rocket' },
    }),
    call(reactionBase, {
      method: 'POST',
      token: tokenA,
      body: { reaction: 'rocket' },
    }),
  ]);
  expect(rocketRace.map((response) => response.status)).toEqual([200, 200]);
  const rocketOutcomes = (await Promise.all(
    rocketRace.map((response) => response.json()),
  )) as { status: string }[];
  expect(rocketOutcomes.map((outcome) => outcome.status).sort()).toEqual([
    'added',
    'present',
  ]);
  const duplicateAdd = await call(reactionBase, {
    method: 'POST',
    token: tokenA,
    body: { reaction: 'rocket' },
  });
  expect(await duplicateAdd.json()).toMatchObject({ status: 'present' });
  const counts = await call(reactionBase, { origin: null });
  const countView = (await counts.json()) as {
    reactions: { reaction: string; count: number }[];
  };
  expect(
    [...countView.reactions].sort((left, right) =>
      left.reaction.localeCompare(right.reaction),
    ),
  ).toEqual([
    { reaction: 'heart', count: 2 },
    { reaction: 'rocket', count: 1 },
  ]);

  // 4. A duplicate create racing itself under one Idempotency-Key: both
  // requests answer 201 with the same issue id, and only one number is
  // consumed (the project list still shows a contiguous number set).
  const duplicatePayload = { title: 'Duplicate shield', body: 'One number' };
  const duplicates = await Promise.all([
    call(issuesBase, {
      method: 'POST',
      token: tokenA,
      body: duplicatePayload,
      idempotencyKey: 'concurrency-duplicate-key-0001',
    }),
    call(issuesBase, {
      method: 'POST',
      token: tokenA,
      body: duplicatePayload,
      idempotencyKey: 'concurrency-duplicate-key-0001',
    }),
  ]);
  expect(duplicates.map((response) => response.status)).toEqual([201, 201]);
  const duplicateBodies = (await Promise.all(
    duplicates.map((response) => response.json()),
  )) as IssueBody[];
  expect(duplicateBodies[0]!.id).toBe(duplicateBodies[1]!.id);
  expect(duplicateBodies[0]!.number).toBe(duplicateBodies[1]!.number);
  const afterDuplicates = await call(issuesBase, { origin: null });
  const afterPage = (await afterDuplicates.json()) as { items: IssueBody[] };
  expect(afterPage.items.map((item) => item.number).sort()).toEqual([
    1, 2, 3, 4, 5, 6,
  ]);

  // 5. Rollback after a timeline-event failure: a directly seeded event row
  // occupies the next aggregate revision, so the edit's event insert fails
  // and the entire atomic mutation — aggregate write, receipt and outbox —
  // rolls back with it. Removing the seed frees the revision and the same
  // edit then succeeds.
  const rollbackCreated = await call(issuesBase, {
    method: 'POST',
    token: tokenA,
    body: { title: 'Rollback probe', body: 'Original body' },
  });
  expect(rollbackCreated.status).toBe(201);
  const rollbackIssue = (await rollbackCreated.json()) as IssueBody;
  expect(rollbackIssue.revision).toBe(1);
  const seedId = crypto.randomUUID();
  const editReceiptsBefore = (
    await db
      .prepare(
        "SELECT COUNT(*) AS count FROM mutation_receipts WHERE project_id = ? AND operation = 'issue.edit'",
      )
      .bind(project.id)
      .first<{ count: number }>()
  )?.count;
  await db
    .prepare(
      "INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, system_actor, action, created_at, metadata) VALUES (?, ?, ?, 2, 'seed', 'seed.occupy', ?, '{}')",
    )
    .bind(seedId, project.id, rollbackIssue.id, Date.now())
    .run();
  const blockedEdit = await call(`${issuesBase}/${rollbackIssue.id}`, {
    method: 'PATCH',
    token: tokenA,
    body: {
      expectedRevision: 1,
      title: 'Must not persist',
      body: 'Rolled back',
    },
  });
  expect(blockedEdit.status).not.toBe(200);
  expect([409, 503]).toContain(blockedEdit.status);
  const rollbackRow = await db
    .prepare('SELECT title, body, revision FROM issues WHERE id = ?')
    .bind(rollbackIssue.id)
    .first<{ title: string; body: string; revision: number }>();
  expect(rollbackRow).toEqual({
    title: 'Rollback probe',
    body: 'Original body',
    revision: 1,
  });
  const blockedTrail = await db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM timeline_events WHERE issue_id = ? AND action = 'issue.edit') AS events, (SELECT COUNT(*) FROM outbox WHERE aggregate_id = ? AND event_type = 'issue.edit') AS outbox, (SELECT COUNT(*) FROM mutation_receipts WHERE project_id = ? AND operation = 'issue.edit') AS receipts",
    )
    .bind(rollbackIssue.id, rollbackIssue.id, project.id)
    .first<{ events: number; outbox: number; receipts: number }>();
  expect(blockedTrail).toEqual({
    events: 0,
    outbox: 0,
    receipts: editReceiptsBefore,
  });
  // Removing the seed needs the append-only guard lifted: only a migration
  // owner may deliberately change that policy, so the test drops the DELETE
  // trigger, removes the seeded row and immediately recreates the guard.
  await db.prepare('DROP TRIGGER timeline_events_no_delete').run();
  await db
    .prepare('DELETE FROM timeline_events WHERE id = ?')
    .bind(seedId)
    .run();
  await db
    .prepare(
      "CREATE TRIGGER timeline_events_no_delete BEFORE DELETE ON timeline_events BEGIN SELECT RAISE(ABORT, 'timeline_events is append-only'); END;",
    )
    .run();
  const freedEdit = await call(`${issuesBase}/${rollbackIssue.id}`, {
    method: 'PATCH',
    token: tokenA,
    body: {
      expectedRevision: 1,
      title: 'Persisted after seed removal',
      body: 'Now it lands',
    },
  });
  expect(freedEdit.status).toBe(200);
  expect(((await freedEdit.json()) as IssueBody).revision).toBe(2);

  // 6. Timeline pagination under equal timestamps: six comments forced to one
  // created_at millisecond paginate in a deterministic (created_at, id) order
  // with no duplicates or gaps, and re-reading the same cursors is stable.
  const stampeded = await call(issuesBase, {
    method: 'POST',
    token: tokenA,
    body: { title: 'Equal timestamps', body: 'Pagination probe' },
  });
  expect(stampeded.status).toBe(201);
  const stampedeIssue = (await stampeded.json()) as IssueBody;
  const commentIds: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const comment = await call(`${issuesBase}/${stampedeIssue.id}/comments`, {
      method: 'POST',
      token: tokenA,
      body: { body: `Same millisecond ${index + 1}` },
    });
    expect(comment.status).toBe(201);
    commentIds.push(((await comment.json()) as { id: string }).id);
  }
  const stampedeTime = (
    await db
      .prepare(
        'SELECT MIN(created_at) AS minimum FROM comments WHERE issue_id = ?',
      )
      .bind(stampedeIssue.id)
      .first<{ minimum: number }>()
  )?.minimum;
  expect(stampedeTime).toBeDefined();
  await db
    .prepare('UPDATE comments SET created_at = ? WHERE issue_id = ?')
    .bind(stampedeTime, stampedeIssue.id)
    .run();
  const expectedEvents = (
    await db
      .prepare('SELECT id, created_at FROM timeline_events WHERE issue_id = ?')
      .bind(stampedeIssue.id)
      .all<{ id: string; created_at: number }>()
  ).results;
  const expectedOrder = [
    ...expectedEvents.map((row) => ({ id: row.id, at: row.created_at })),
    ...commentIds.map((id) => ({ id, at: stampedeTime as number })),
  ].sort((left, right) => left.at - right.at || (left.id < right.id ? -1 : 1));
  const timelineBase = `${issuesBase}/${stampedeIssue.id}/timeline`;
  const pages: {
    items: { id: string; kind: string; createdAt: string }[];
    nextCursor: string | null;
  }[] = [];
  let cursor: string | undefined;
  do {
    const page = await call(
      cursor === undefined
        ? `${timelineBase}?limit=2`
        : `${timelineBase}?limit=2&cursor=${cursor}`,
      { token: tokenA },
    );
    expect(page.status).toBe(200);
    const view = (await page.json()) as {
      items: { id: string; kind: string; createdAt: string }[];
      nextCursor: string | null;
    };
    pages.push(view);
    cursor = view.nextCursor ?? undefined;
  } while (cursor !== undefined);
  expect(pages.map((page) => page.items.length)).toEqual([2, 2, 2, 1]);
  const walked = pages.flatMap((page) => page.items);
  expect(new Set(walked.map((item) => item.id)).size).toBe(7);
  expect(walked.map((item) => item.id)).toEqual(
    expectedOrder.map((row) => row.id),
  );
  const commentsWalked = walked.filter((item) => item.kind === 'comment');
  expect(commentsWalked.map((item) => item.id).sort()).toEqual(
    [...commentIds].sort(),
  );
  expect(new Set(commentsWalked.map((item) => item.createdAt)).size).toBe(1);
  expect(commentsWalked[0]!.createdAt).toBe(
    new Date(stampedeTime as number).toISOString(),
  );
  const reread = await Promise.all(
    ['', ...pages.slice(0, -1).map((page) => page.nextCursor as string)].map(
      (pageCursor) =>
        call(
          pageCursor === ''
            ? `${timelineBase}?limit=2`
            : `${timelineBase}?limit=2&cursor=${pageCursor}`,
          { token: tokenA },
        ),
    ),
  );
  for (let index = 0; index < reread.length; index += 1) {
    const view = (await reread[index]!.json()) as {
      items: { id: string }[];
    };
    expect(view.items.map((item) => item.id)).toEqual(
      pages[index]!.items.map((item) => item.id),
    );
  }
});
