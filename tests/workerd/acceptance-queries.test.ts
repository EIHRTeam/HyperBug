import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  CommentPage,
  CommentQuery,
  IssuePage,
  IssueListQuery,
  TimelinePage,
  TimelineQuery,
} from '@hyperbug/application';

// 06.V4 acceptance (workerd/D1): statement-count bounds for representative
// issue list/detail, large-discussion comment and merged-timeline reads,
// measured through the database-worker RPC harness, plus page bound and
// limit+1 overfetch checks. The same fixtures' indexed plans are compared on
// PostgreSQL in tests/postgres/acceptance-queries.test.ts.
const base = 1789689600000;
const issueCount = 60;
const commentCount = 40;
let mf: Miniflare;
let db: D1Database;
let endpoint: URL;
let projectId: string;
let authorId: string;
let staffIds: [string, string];
let discussionId: string;
let commentIds: string[];
const queries: string[] = [];

type QueryMessage =
  | { method: 'listIssues'; input: IssueListQuery }
  | { method: 'getIssue'; input: { projectId: string; id: string } }
  | { method: 'relations'; input: { projectId: string; issueIds: string[] } }
  | { method: 'commentList'; input: CommentQuery }
  | { method: 'timelineList'; input: TimelineQuery }
  | {
      method: 'reactionIssueCounts';
      input: { projectId: string; issueIds: string[] };
    }
  | {
      method: 'reactionCommentCounts';
      input: { projectId: string; commentIds: string[] };
    };

async function call<T>(
  method: QueryMessage['method'],
  input: unknown,
): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, input }),
  });
  const payload = (await response.json()) as {
    value: T;
    queries: string[];
    error?: { code: string };
  };
  queries.push(...payload.queries);
  if (payload.error)
    throw Object.assign(new Error(payload.error.code), {
      code: payload.error.code,
    });
  return payload.value;
}

async function statementCount(
  run: () => Promise<unknown>,
): Promise<{ count: number; statements: string[] }> {
  const offset = queries.length;
  await run();
  return { count: queries.length - offset, statements: queries.slice(offset) };
}

const query = async (sql: string, values: (string | number | null)[] = []) =>
  (
    await db
      .prepare(sql)
      .bind(...values)
      .all<Record<string, unknown>>()
  ).results;

/**
 * Multi-row inserts stay under D1's 100-parameter statement bound; constant
 * columns travel as SQL literals instead of bind parameters.
 */
function chunkedInsert(
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
  literals: Record<string, string> = {},
): Promise<unknown>[] {
  const literalNames = Object.keys(literals);
  const literalSql = literalNames.length
    ? `, ${literalNames.map((name) => literals[name]).join(', ')}`
    : '';
  return rows
    .map((_, index) => (index % 10 === 0 ? rows.slice(index, index + 10) : []))
    .filter((batch) => batch.length > 0)
    .map((batch) =>
      query(
        `INSERT INTO ${table} (${[...columns, ...literalNames].join(', ')}) VALUES ${batch
          .map(() => `(${columns.map(() => '?').join(', ')}${literalSql})`)
          .join(',')}`,
        batch.flat(),
      ),
    );
}

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/database-worker'),
      compatibilityDate: '2026-09-16',
      d1Databases: ['DB'],
    }),
  );
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
  endpoint = await mf.ready;
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  projectId = crypto.randomUUID();
  authorId = crypto.randomUUID();
  staffIds = [crypto.randomUUID(), crypto.randomUUID()];
  await query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [
      projectId,
      `queries-${crypto.randomUUID().slice(0, 8)}`,
      'Queries',
      base,
      base,
    ],
  );
  await query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Query author', ?)",
    [authorId, base],
  );
  for (const staffId of staffIds) {
    await query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Query staff', ?)",
      [staffId, base],
    );
    await query(
      "INSERT INTO project_roles (project_id, principal_id, role, granted_at) VALUES (?, ?, 'maintainer', ?)",
      [projectId, staffId, base],
    );
  }
  const labelIds = [crypto.randomUUID(), crypto.randomUUID()];
  await Promise.all(
    chunkedInsert(
      'labels',
      ['id', 'project_id', 'name', 'name_key'],
      labelIds.map((id, index) => [
        id,
        projectId,
        `Label ${index}`,
        `label-${index}`,
      ]),
    ),
  );
  const issueIds = Array.from({ length: issueCount }, () =>
    crypto.randomUUID(),
  );
  discussionId = issueIds[0]!;
  await Promise.all(
    chunkedInsert(
      'issues',
      [
        'id',
        'project_id',
        'number',
        'author_id',
        'created_at',
        'updated_at',
        'last_mutation_id',
      ],
      issueIds.map((id, index) => [
        id,
        projectId,
        index + 1,
        authorId,
        base + index * 60000,
        base + index * 60000,
        crypto.randomUUID(),
      ]),
      { title: "'Query fixture'", body: "'Query fixture body'" },
    ),
  );
  await Promise.all([
    ...chunkedInsert(
      'issue_labels',
      ['project_id', 'issue_id', 'label_id'],
      issueIds.flatMap((id) =>
        labelIds.map((labelId) => [projectId, id, labelId]),
      ),
    ),
    ...chunkedInsert(
      'issue_assignees',
      ['project_id', 'issue_id', 'principal_id'],
      issueIds.flatMap((id) =>
        staffIds.map((staffId) => [projectId, id, staffId]),
      ),
    ),
  ]);
  commentIds = Array.from({ length: commentCount }, () => crypto.randomUUID());
  await Promise.all(
    chunkedInsert(
      'comments',
      [
        'id',
        'project_id',
        'issue_id',
        'author_id',
        'body',
        'created_at',
        'updated_at',
      ],
      commentIds.map((id, index) => [
        id,
        projectId,
        discussionId,
        authorId,
        `Comment ${index}`,
        base + 1000 + index * 1000,
        base + 1000 + index * 1000,
      ]),
    ),
  );
  await Promise.all(
    chunkedInsert(
      'timeline_events',
      [
        'id',
        'project_id',
        'issue_id',
        'aggregate_revision',
        'actor_id',
        'action',
        'created_at',
        'metadata',
      ],
      [
        [
          crypto.randomUUID(),
          projectId,
          discussionId,
          1,
          authorId,
          'issue.created',
          base,
          '{}',
        ],
        [
          crypto.randomUUID(),
          projectId,
          discussionId,
          2,
          authorId,
          'issue.labeled',
          base + 500,
          '{}',
        ],
      ],
    ),
  );
  await Promise.all(
    chunkedInsert(
      'reactions',
      [
        'id',
        'project_id',
        'issue_id',
        'comment_id',
        'principal_id',
        'reaction',
        'created_at',
      ],
      [
        [
          crypto.randomUUID(),
          projectId,
          discussionId,
          null,
          authorId,
          'heart',
          base,
        ],
        [
          crypto.randomUUID(),
          projectId,
          discussionId,
          null,
          staffIds[0]!,
          'rocket',
          base,
        ],
        [
          crypto.randomUUID(),
          projectId,
          discussionId,
          null,
          staffIds[1]!,
          'eyes',
          base,
        ],
        ...commentIds
          .slice(0, 20)
          .map((id) => [
            crypto.randomUUID(),
            projectId,
            null,
            id,
            authorId,
            'heart',
            base,
          ]),
      ],
    ),
  );
});

afterAll(async () => {
  await mf?.dispose();
});

it('keeps issue list pages and relation hydration at three fixed statements', async () => {
  const small = await statementCount(() =>
    call<IssuePage>('listIssues', { projectId, state: 'open', limit: 5 }),
  );
  const large = await statementCount(() =>
    call<IssuePage>('listIssues', { projectId, state: 'open', limit: 100 }),
  );
  const page = await statementCount(() =>
    call<IssuePage>('listIssues', { projectId, state: 'open', limit: 40 }),
  );
  expect(small.count).toBe(1);
  expect(large.count).toBe(1);
  expect(page.count).toBe(1);
  // The limit travels as a bind parameter: the statement text is identical.
  expect(small.statements[0]).toBe(page.statements[0]);
  expect(large.statements[0]).toBe(page.statements[0]);
  const pageValue = (
    await call<IssuePage>('listIssues', { projectId, state: 'open', limit: 40 })
  ).items;
  const relations = await statementCount(() =>
    call('relations', {
      projectId,
      issueIds: pageValue.map((item) => item.id),
    }),
  );
  const relationsFew = await statementCount(() =>
    call('relations', {
      projectId,
      issueIds: pageValue.slice(0, 5).map((i) => i.id),
    }),
  );
  expect(relations.count).toBe(2);
  expect(relationsFew.count).toBe(2);
  expect(page.count + relations.count).toBeLessThanOrEqual(3);
  expect(page.count + relations.count).toBe(3);
});

it('hydrates issue detail from at most three statements', async () => {
  const detail = await statementCount(async () => {
    const issue = await call<{ id: string; body: string }>('getIssue', {
      projectId,
      id: discussionId,
    });
    const relations = await call('relations', {
      projectId,
      issueIds: [issue.id],
    });
    return { issue, relations };
  });
  expect(detail.count).toBeLessThanOrEqual(3);
  expect(detail.count).toBe(3);
});

it('serves a large discussion timeline from one UNION statement', async () => {
  const timelineQuery = (limit: number, after?: string) =>
    statementCount(() =>
      call<TimelinePage>('timelineList', {
        projectId,
        issueId: discussionId,
        limit,
        ...(after ? { after } : {}),
      }),
    );
  const small = await timelineQuery(5);
  const exact = await timelineQuery(commentCount + 2);
  const large = await timelineQuery(100);
  expect(small.count).toBe(1);
  expect(exact.count).toBe(1);
  expect(large.count).toBe(1);
  expect(small.statements[0]).toContain('UNION ALL');
  expect(small.statements[0]).toBe(large.statements[0]);
  const page = await call<TimelinePage>('timelineList', {
    projectId,
    issueId: discussionId,
    limit: 40,
  });
  expect(page.items).toHaveLength(40);
  expect(page.nextCursor).not.toBeNull();
  expect(page.items[0]).toMatchObject({
    kind: 'event',
    action: 'issue.created',
  });
  expect(page.items.filter((item) => item.kind === 'comment')).toHaveLength(38);
  const tail = await call<TimelinePage>('timelineList', {
    projectId,
    issueId: discussionId,
    limit: 40,
    after: page.nextCursor!,
  });
  expect(tail.items).toHaveLength(2);
  expect(tail.nextCursor).toBeNull();
  expect(tail.items.at(-1)).toMatchObject({ kind: 'comment' });
});

it('keeps comment pages to one statement and groups reactions in one query', async () => {
  const small = await statementCount(() =>
    call<CommentPage>('commentList', {
      projectId,
      issueId: discussionId,
      limit: 5,
    }),
  );
  const exact = await statementCount(() =>
    call<CommentPage>('commentList', {
      projectId,
      issueId: discussionId,
      limit: commentCount,
    }),
  );
  const large = await statementCount(() =>
    call<CommentPage>('commentList', {
      projectId,
      issueId: discussionId,
      limit: 100,
    }),
  );
  expect(small.count).toBe(1);
  expect(exact.count).toBe(1);
  expect(large.count).toBe(1);
  expect(small.statements[0]).toBe(large.statements[0]);
  const issueCounts = await statementCount(() =>
    call<Record<string, { reaction: string; count: number }[]>>(
      'reactionIssueCounts',
      { projectId, issueIds: [discussionId] },
    ),
  );
  const commentCounts = await statementCount(() =>
    call<Record<string, { reaction: string; count: number }[]>>(
      'reactionCommentCounts',
      { projectId, commentIds: commentIds.slice(0, 20) },
    ),
  );
  expect(issueCounts.count).toBe(1);
  expect(commentCounts.count).toBe(1);
  const counts = await call<
    Record<string, { reaction: string; count: number }[]>
  >('reactionIssueCounts', { projectId, issueIds: [discussionId] });
  expect(
    [...(counts[discussionId] ?? [])].sort((a, b) =>
      a.reaction.localeCompare(b.reaction),
    ),
  ).toEqual([
    { reaction: 'eyes', count: 1 },
    { reaction: 'heart', count: 1 },
    { reaction: 'rocket', count: 1 },
  ]);
});

it('never leaks the limit+1 overfetch row or an out-of-bound page size', async () => {
  const first = await call<IssuePage>('listIssues', {
    projectId,
    state: 'open',
    limit: 40,
  });
  expect(first.items).toHaveLength(40);
  expect(first.nextCursor).not.toBeNull();
  expect(first.items[0]).toMatchObject({ number: issueCount });
  expect(first.items.at(-1)).toMatchObject({ number: 21 });
  for (const item of first.items) expect(item).not.toHaveProperty('body');
  const second = await call<IssuePage>('listIssues', {
    projectId,
    state: 'open',
    limit: 40,
    after: first.nextCursor!,
  });
  expect(second.items).toHaveLength(20);
  expect(second.nextCursor).toBeNull();
  const exact = await call<IssuePage>('listIssues', {
    projectId,
    state: 'open',
    limit: issueCount,
  });
  expect(exact.items).toHaveLength(issueCount);
  expect(exact.nextCursor).toBeNull();
  const capped = await call<IssuePage>('listIssues', {
    projectId,
    state: 'open',
    limit: 100,
  });
  expect(capped.items).toHaveLength(issueCount);
  expect(capped.nextCursor).toBeNull();
  const commentPage = await call<CommentPage>('commentList', {
    projectId,
    issueId: discussionId,
    limit: commentCount,
  });
  expect(commentPage.items).toHaveLength(commentCount);
  expect(commentPage.nextCursor).toBeNull();
  await expect(
    call('listIssues', { projectId, state: 'open', limit: 101 }),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(
    call('listIssues', { projectId, state: 'open', limit: 0 }),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(
    call('commentList', {
      projectId,
      issueId: discussionId,
      limit: 101,
    }),
  ).rejects.toThrow();
  await expect(
    call('timelineList', {
      projectId,
      issueId: discussionId,
      limit: 101,
    }),
  ).rejects.toThrow();
  await expect(
    call('relations', {
      projectId,
      issueIds: Array.from({ length: 102 }, () => crypto.randomUUID()),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});
