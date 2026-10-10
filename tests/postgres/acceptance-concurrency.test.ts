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

// 06.V3 acceptance on Node/PostgreSQL: concurrent creates allocate unique
// project-local numbers, concurrent edits serialize through the row lock to
// one revision bump and one timeline event, concurrent reactions stay
// idempotent per actor/target/value, a racing duplicate Idempotency-Key
// consumes one number, a failed timeline-event insert rolls the whole
// transaction back, and equal-millisecond timestamps keep cursor pagination
// deterministic.
const databaseName = 'hyperbug_acceptance_v3_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'concurrency-cli',
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
      clientId: 'concurrency-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-concurrency-state',
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
      client_id: 'concurrency-cli',
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
    max: 12,
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-acceptance-v3-'));
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

interface IssueBody {
  id: string;
  number: number;
  revision: number;
}

it('keeps concurrency, idempotency, rollback and pagination correct on Node/PostgreSQL', async () => {
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
  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const tokenA = await loginToken('racer-a', 'long-functional-password');
  const tokenB = await loginToken('racer-b', 'long-functional-password');

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'pg-concurrency', name: 'PG Concurrency' },
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

  // 2. Two parallel edits at the same expectedRevision: the SELECT ... FOR
  // UPDATE row lock serializes them, exactly one wins with 200, the other
  // answers 409 REVISION_CONFLICT, the aggregate advances exactly one
  // revision, and only one issue.edit event lands.
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
  expect(editStatuses).toEqual([200, 409]);
  const conflictBody = (await (
    edits.find((response) => response.status === 409) as Response
  ).json()) as { error: { code: string } };
  expect(conflictBody.error.code).toBe('REVISION_CONFLICT');
  const winnerBody = (await (
    edits.find((response) => response.status === 200) as Response
  ).json()) as { revision: number; title: string };
  expect(winnerBody.revision).toBe(2);
  const racedRow = (
    await pool.query<{ title: string; revision: number }>(
      'SELECT title, revision FROM issues WHERE id = $1',
      [racedIssue.id],
    )
  ).rows[0];
  expect(racedRow).toEqual({ title: winnerBody.title, revision: 2 });
  const editEvents = (
    await pool.query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM timeline_events WHERE issue_id = $1 AND action = 'issue.edit'",
      [racedIssue.id],
    )
  ).rows[0];
  expect(Number(editEvents?.count)).toBe(1);

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
  // and the entire transaction — aggregate write, receipt and outbox — rolls
  // back with it. Removing the seed frees the revision and the same edit
  // then succeeds. Removing the seed needs the append-only guard lifted:
  // only a migration owner may deliberately change that policy, so the test
  // drops the DELETE trigger, removes the seeded row and recreates the
  // guard from the migration's own definition.
  const rollbackCreated = await call(issuesBase, {
    method: 'POST',
    token: tokenA,
    body: { title: 'Rollback probe', body: 'Original body' },
  });
  expect(rollbackCreated.status).toBe(201);
  const rollbackIssue = (await rollbackCreated.json()) as IssueBody;
  expect(rollbackIssue.revision).toBe(1);
  const seedId = crypto.randomUUID();
  const editReceiptsBefore = Number(
    (
      await pool.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM mutation_receipts WHERE project_id = $1 AND operation = 'issue.edit'",
        [project.id],
      )
    ).rows[0]?.count,
  );
  await pool.query(
    "INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, system_actor, action, created_at, metadata) VALUES ($1, $2, $3, 2, 'seed', 'seed.occupy', $4, '{}'::jsonb)",
    [seedId, project.id, rollbackIssue.id, Date.now()],
  );
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
  const rollbackRow = (
    await pool.query<{ title: string; body: string; revision: number }>(
      'SELECT title, body, revision FROM issues WHERE id = $1',
      [rollbackIssue.id],
    )
  ).rows[0];
  expect(rollbackRow).toEqual({
    title: 'Rollback probe',
    body: 'Original body',
    revision: 1,
  });
  const blockedTrail = (
    await pool.query<{ events: string; outbox: string; receipts: string }>(
      "SELECT (SELECT COUNT(*) FROM timeline_events WHERE issue_id = $1 AND action = 'issue.edit') AS events, (SELECT COUNT(*) FROM outbox WHERE aggregate_id = $1 AND event_type = 'issue.edit') AS outbox, (SELECT COUNT(*) FROM mutation_receipts WHERE project_id = $2 AND operation = 'issue.edit') AS receipts",
      [rollbackIssue.id, project.id],
    )
  ).rows[0]!;
  expect({
    events: Number(blockedTrail.events),
    outbox: Number(blockedTrail.outbox),
    receipts: Number(blockedTrail.receipts),
  }).toEqual({ events: 0, outbox: 0, receipts: editReceiptsBefore });
  await pool.query(
    'DROP TRIGGER timeline_events_no_mutation ON timeline_events',
  );
  await pool.query('DELETE FROM timeline_events WHERE id = $1', [seedId]);
  await pool.query(
    'CREATE TRIGGER timeline_events_no_mutation BEFORE UPDATE OR DELETE ON timeline_events FOR EACH ROW EXECUTE FUNCTION reject_history_mutation()',
  );
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
  const stampedeTime = Number(
    (
      await pool.query<{ minimum: string }>(
        'SELECT MIN(created_at) AS minimum FROM comments WHERE issue_id = $1',
        [stampedeIssue.id],
      )
    ).rows[0]?.minimum,
  );
  expect(Number.isSafeInteger(stampedeTime)).toBe(true);
  await pool.query('UPDATE comments SET created_at = $1 WHERE issue_id = $2', [
    stampedeTime,
    stampedeIssue.id,
  ]);
  const expectedEvents = (
    await pool.query<{ id: string; created_at: string }>(
      'SELECT id, created_at FROM timeline_events WHERE issue_id = $1',
      [stampedeIssue.id],
    )
  ).rows;
  const expectedOrder = [
    ...expectedEvents.map((row) => ({
      id: row.id,
      at: Number(row.created_at),
    })),
    ...commentIds.map((id) => ({ id, at: stampedeTime })),
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
    new Date(stampedeTime).toISOString(),
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
    const view = (await reread[index]!.json()) as { items: { id: string }[] };
    expect(view.items.map((item) => item.id)).toEqual(
      pages[index]!.items.map((item) => item.id),
    );
  }
});
