import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import {
  createPostgresRepository,
  createPostgresCommentStore,
  createPostgresReactionStore,
  createPostgresTaxonomyStore,
  createPostgresTimelineStore,
} from '@hyperbug/database-postgres';
import { migrationStatements } from '../fixtures/migrations.ts';

// 06.V4 acceptance (Node/PostgreSQL): the same representative list/detail and
// large-discussion fixtures as tests/workerd/acceptance-queries.test.ts. Here
// the statement counts are measured through a counting interceptor on the
// pool's query method, and the served statements are re-run through
// EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) to prove the planner reaches each
// table through its designated index. Filler rows in a second project keep
// every touched table large enough that a sequential scan would lose.
const databaseName = 'hyperbug_acceptance_queries';
const base = 1789689600000;
const issueCount = 60;
const commentCount = 40;
const fillerIssues = 2000;
let bootstrap: Pool;
let pool: Pool;
const spyOnQuery = (target: Pool) => vi.spyOn(target, 'query');
let spy: ReturnType<typeof spyOnQuery>;
const repository = () => createPostgresRepository(pool);
const commentStore = () => createPostgresCommentStore(pool);
const reactionStore = () => createPostgresReactionStore(pool);
const timelineStore = () => createPostgresTimelineStore(pool);
const taxonomyStore = () => createPostgresTaxonomyStore(pool);
let projectId: string;
let fillerProjectId: string;
let authorId: string;
let staffIds: [string, string];
let discussionId: string;
let commentIds: string[];

interface MeasuredCall {
  sql: string;
  values: unknown[];
}
const measuredCalls = () =>
  (spy.mock.calls as unknown as [string, unknown[]?][]).map(
    ([sql, values]) => ({ sql: String(sql), values: values ?? [] }),
  );
async function measured<T>(run: () => Promise<T>): Promise<{
  value: T;
  count: number;
  calls: MeasuredCall[];
}> {
  const before = spy.mock.calls.length;
  const value = await run();
  return {
    value,
    count: spy.mock.calls.length - before,
    calls: measuredCalls().slice(before),
  };
}

interface PlanNode {
  'Node Type'?: string;
  'Relation Name'?: string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}
async function explainPlan(
  sql: string,
  values: unknown[],
): Promise<PlanNode[]> {
  const result = await pool.query<{ 'QUERY PLAN': { Plan?: PlanNode }[] }>(
    'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' + sql,
    values,
  );
  const plan = result.rows[0]?.['QUERY PLAN']?.[0]?.Plan;
  if (!plan) throw new Error('EXPLAIN returned no plan for ' + sql);
  const flatten = (node: PlanNode): PlanNode[] => [
    node,
    ...(node.Plans ?? []).flatMap(flatten),
  ];
  return flatten(plan);
}
function expectIndexed(nodes: PlanNode[], table: string, index: RegExp): void {
  expect(
    nodes.filter(
      (node) =>
        node['Node Type'] === 'Seq Scan' && node['Relation Name'] === table,
    ),
    `sequential scan on ${table}`,
  ).toEqual([]);
  // Bitmap Index Scan nodes carry the index name without the relation name;
  // the index name itself ties the node to the table.

  expect(
    nodes
      .filter((node) => 'Index Name' in node)
      .map((node) => node['Index Name']),
    `index used on ${table}`,
  ).toEqual(expect.arrayContaining([expect.stringMatching(index)]));
}

const insert = async (
  table: string,
  columns: string[],
  rows: (string | number | null)[][],
  literals: Record<string, string> = {},
): Promise<void> => {
  const literalNames = Object.keys(literals);
  const literalSql = literalNames.length
    ? `, ${literalNames.map((name) => literals[name]).join(', ')}`
    : '';
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    const placeholders = batch
      .map(
        (_row, row) =>
          `(${columns
            .map((_column, column) => `$${row * columns.length + column + 1}`)
            .join(', ')}${literalSql})`,
      )
      .join(',');
    await pool.query(
      `INSERT INTO ${table} (${[...columns, ...literalNames].join(', ')}) VALUES ${placeholders}`,
      batch.flat(),
    );
  }
};

beforeAll(async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error(
      'Use pnpm test:postgres to start an isolated PostgreSQL 18 cluster.',
    );
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
    max: 4,
  });
  spy = spyOnQuery(pool);
  for (const migration of await migrationStatements('postgres')) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const statement of migration.statements)
        await client.query(statement);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  projectId = crypto.randomUUID();
  fillerProjectId = crypto.randomUUID();
  authorId = crypto.randomUUID();
  staffIds = [crypto.randomUUID(), crypto.randomUUID()];
  const fillerStaffId = crypto.randomUUID();
  const fillerAuthorId = crypto.randomUUID();
  await insert(
    'projects',
    ['id', 'slug', 'name', 'created_at', 'updated_at'],
    [
      [
        projectId,
        `queries-${crypto.randomUUID().slice(0, 8)}`,
        'Queries',
        base,
        base,
      ],
      [
        fillerProjectId,
        `filler-${crypto.randomUUID().slice(0, 8)}`,
        'Filler',
        base,
        base,
      ],
    ],
  );
  await insert(
    'principals',
    ['id', 'kind', 'display_name', 'created_at'],
    [
      [authorId, 'user', 'Query author', base],
      [staffIds[0]!, 'staff', 'Query staff', base],
      [staffIds[1]!, 'staff', 'Query staff', base],
      [fillerStaffId, 'staff', 'Filler staff', base],
      [fillerAuthorId, 'user', 'Filler author', base],
    ],
  );
  await insert(
    'project_roles',
    ['project_id', 'principal_id', 'role', 'granted_at'],
    [
      [projectId, staffIds[0]!, 'maintainer', base],
      [projectId, staffIds[1]!, 'maintainer', base],
      [fillerProjectId, fillerStaffId, 'maintainer', base],
    ],
  );
  // More than the taxonomy list's LIMIT 500 so the (project_id, name_key)
  // index's ordered scan is strictly cheaper than any unordered alternative.
  const mainLabelIds = Array.from({ length: 600 }, () => crypto.randomUUID());
  // Filler labels keep the table past the point where a sequential scan would
  // beat the unique (project_id, name_key) index for one project's slice.
  const fillerLabelIds = Array.from({ length: 4000 }, () =>
    crypto.randomUUID(),
  );
  await insert(
    'labels',
    ['id', 'project_id', 'name', 'name_key'],
    // name_key must equal nameKeyOf(name): lower-cased, whitespace to '-'.
    mainLabelIds.map((id, index) => [
      id,
      projectId,
      `Main label ${index}`,
      `main-label-${index}`,
    ]),
  );
  await insert(
    'labels',
    ['id', 'project_id', 'name', 'name_key'],
    fillerLabelIds.map((id, index) => [
      id,
      fillerProjectId,
      `Filler label ${index}`,
      `filler-label-${index}`,
    ]),
  );
  const issueIds = Array.from({ length: issueCount + fillerIssues }, () =>
    crypto.randomUUID(),
  );
  discussionId = issueIds[0]!;
  const fillerIssueIds = issueIds.slice(issueCount);
  // Closed filler issues in the MAIN project give `state` selectivity inside
  // one project, so the (project_id, state, created_at, id) index's ordered
  // LIMIT scan is strictly cheaper than any project-prefix scan plus a sort.
  const closedIssueIds = Array.from({ length: fillerIssues }, () =>
    crypto.randomUUID(),
  );
  await insert(
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
    [
      ...issueIds
        .slice(0, issueCount)
        .map((id, index) => [
          id,
          projectId,
          index + 1,
          authorId,
          base + index * 60000,
          base + index * 60000,
          crypto.randomUUID(),
        ]),
      ...closedIssueIds.map((id, index) => [
        id,
        projectId,
        issueCount + index + 1,
        authorId,
        base + 100000 + index,
        base + 100000 + index,
        crypto.randomUUID(),
      ]),
      ...fillerIssueIds.map((id, index) => [
        id,
        fillerProjectId,
        index + 1,
        fillerAuthorId,
        base + index,
        base + index,
        crypto.randomUUID(),
      ]),
    ],
    { title: "'Query fixture'", body: "'Query fixture body'" },
  );
  await pool.query(
    "UPDATE issues SET state = 'closed', close_reason = 'completed', closed_at = updated_at WHERE project_id = $1 AND number > $2",
    [projectId, issueCount],
  );
  await insert(
    'issue_labels',
    ['project_id', 'issue_id', 'label_id'],
    [
      ...issueIds
        .slice(0, issueCount)
        .flatMap((id) =>
          mainLabelIds.slice(0, 2).map((labelId) => [projectId, id, labelId]),
        ),
      ...fillerIssueIds.flatMap((id) =>
        fillerLabelIds
          .slice(0, 2)
          .map((labelId) => [fillerProjectId, id, labelId]),
      ),
    ],
  );
  await insert(
    'issue_assignees',
    ['project_id', 'issue_id', 'principal_id'],
    [
      ...issueIds
        .slice(0, issueCount)
        .flatMap((id) => staffIds.map((staffId) => [projectId, id, staffId])),
      ...fillerIssueIds.map((id) => [fillerProjectId, id, fillerStaffId]),
    ],
  );
  commentIds = Array.from({ length: commentCount }, () => crypto.randomUUID());
  const fillerCommentIds = Array.from({ length: 1600 }, () =>
    crypto.randomUUID(),
  );
  await insert(
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
    [
      ...commentIds.map((id, index) => [
        id,
        projectId,
        discussionId,
        authorId,
        `Comment ${index}`,
        base + 1000 + index * 1000,
        base + 1000 + index * 1000,
      ]),
      ...fillerCommentIds.map((id, index) => [
        id,
        fillerProjectId,
        fillerIssueIds[index % 400]!,
        fillerAuthorId,
        'Filler comment',
        base + index,
        base + index,
      ]),
    ],
  );
  await insert(
    'timeline_events',
    [
      'id',
      'project_id',
      'issue_id',
      'aggregate_revision',
      'actor_id',
      'action',
      'created_at',
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
      ],
      [
        crypto.randomUUID(),
        projectId,
        discussionId,
        2,
        authorId,
        'issue.labeled',
        base + 500,
      ],
      ...fillerIssueIds.slice(0, 500).flatMap((id, index) => [
        [
          crypto.randomUUID(),
          fillerProjectId,
          id,
          1,
          fillerAuthorId,
          'issue.created',
          base + index,
        ],
        [
          crypto.randomUUID(),
          fillerProjectId,
          id,
          2,
          fillerAuthorId,
          'issue.labeled',
          base + index + 1,
        ],
      ]),
    ],
    { metadata: "'{}'::jsonb" },
  );
  const reactionKinds = [
    'thumbs_up',
    'thumbs_down',
    'laugh',
    'hooray',
    'confused',
    'heart',
    'rocket',
    'eyes',
  ];
  await insert(
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
      ...Array.from({ length: 2000 }, (_, index) => [
        crypto.randomUUID(),
        fillerProjectId,
        fillerIssueIds[index % fillerIssues]!,
        null,
        fillerAuthorId,
        reactionKinds[index % reactionKinds.length]!,
        base + index,
      ]),
    ],
  );
  for (const table of [
    'issues',
    'labels',
    'issue_labels',
    'issue_assignees',
    'comments',
    'timeline_events',
    'reactions',
  ])
    await pool.query(`ANALYZE ${table}`);
});

afterAll(async () => {
  await pool?.end();
  if (bootstrap) {
    await bootstrap.query(`DROP DATABASE ${databaseName}`);
    await bootstrap.end();
  }
});

it('keeps issue list pages and relation hydration at three indexed statements', async () => {
  const small = await measured(() =>
    repository().listIssues({ projectId, state: 'open', limit: 5 }),
  );
  const large = await measured(() =>
    repository().listIssues({ projectId, state: 'open', limit: 100 }),
  );
  const page = await measured(() =>
    repository().listIssues({ projectId, state: 'open', limit: 40 }),
  );
  expect(small.count).toBe(1);
  expect(large.count).toBe(1);
  expect(page.count).toBe(1);
  expect(small.calls[0]?.sql).toBe(page.calls[0]?.sql);
  expect(large.calls[0]?.sql).toBe(page.calls[0]?.sql);
  expectIndexed(
    await explainPlan(page.calls[0]!.sql, page.calls[0]!.values),
    'issues',
    /issue_project_(state_)?created/,
  );
  const cursorPage = await measured(() =>
    repository().listIssues({
      projectId,
      state: 'open',
      limit: 40,
      after: page.value.nextCursor!,
    }),
  );
  expect(cursorPage.value.items).toHaveLength(20);
  expect(cursorPage.value.nextCursor).toBeNull();
  expectIndexed(
    await explainPlan(cursorPage.calls[0]!.sql, cursorPage.calls[0]!.values),
    'issues',
    /issue_project_(state_)?created/,
  );
  const ids = page.value.items.map((item) => item.id);
  const relations = await measured(() =>
    repository().relations(projectId, ids),
  );
  const relationsFew = await measured(() =>
    repository().relations(projectId, ids.slice(0, 5)),
  );
  expect(relations.count).toBe(2);
  expect(relationsFew.count).toBe(2);
  expect(page.count + relations.count).toBeLessThanOrEqual(3);
  expect(page.count + relations.count).toBe(3);
  const labelCall = relations.calls.find((call) =>
    call.sql.includes('FROM issue_labels'),
  );
  const assigneeCall = relations.calls.find((call) =>
    call.sql.includes('FROM issue_assignees'),
  );
  if (!labelCall || !assigneeCall) throw new Error('Relation capture failed');
  expectIndexed(
    await explainPlan(labelCall.sql, labelCall.values),
    'issue_labels',
    /issue_label/, // primary key or the label-filter index both hydrate in one indexed lookup
  );
  expectIndexed(
    await explainPlan(assigneeCall.sql, assigneeCall.values),
    'issue_assignees',
    /issue_assignee/, // primary key or the assignee-filter index both hydrate in one indexed lookup
  );
});

it('hydrates issue detail from three statements with indexed lookups', async () => {
  const detail = await measured(async () => {
    const issue = await repository().getIssue(projectId, discussionId);
    await repository().relations(projectId, [discussionId]);
    return issue;
  });
  expect(detail.count).toBeLessThanOrEqual(3);
  expect(detail.count).toBe(3);
  const detailCall = detail.calls[0]!;
  expectIndexed(
    await explainPlan(detailCall.sql, detailCall.values),
    'issues',
    /issue_project_id|issues_pkey/,
  );
  expectIndexed(
    await explainPlan(
      'SELECT 1 FROM issues WHERE project_id = $1 AND number = $2',
      [projectId, 7],
    ),
    'issues',
    /issue_project_number/,
  );
  expect(detail.value).toMatchObject({ id: discussionId, number: 1 });
});

it('serves a large discussion timeline from one indexed UNION statement', async () => {
  const timelineQuery = (limit: number, after?: string) =>
    measured(() =>
      timelineStore().timeline({
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
  expect(small.calls[0]?.sql).toContain('UNION ALL');
  expect(small.calls[0]?.sql).toBe(large.calls[0]?.sql);
  const nodes = await explainPlan(small.calls[0]!.sql, small.calls[0]!.values);
  expectIndexed(nodes, 'timeline_events', /timeline_issue_order/);
  expectIndexed(nodes, 'comments', /comment_issue_order/);
  const page = await timelineQuery(40);
  expect(page.value.items).toHaveLength(40);
  expect(page.value.nextCursor).not.toBeNull();
  expect(page.value.items[0]).toMatchObject({
    kind: 'event',
    action: 'issue.created',
  });
  const tail = await timelineQuery(40, page.value.nextCursor!);
  expect(tail.value.items).toHaveLength(2);
  expect(tail.value.nextCursor).toBeNull();
  expect(exact.value.items).toHaveLength(commentCount + 2);
  expect(exact.value.nextCursor).toBeNull();
});

it('keeps comment pages and grouped reactions to one indexed statement each', async () => {
  const small = await measured(() =>
    commentStore().listByIssue({
      projectId,
      issueId: discussionId,
      limit: 5,
    }),
  );
  const exact = await measured(() =>
    commentStore().listByIssue({
      projectId,
      issueId: discussionId,
      limit: commentCount,
    }),
  );
  const large = await measured(() =>
    commentStore().listByIssue({
      projectId,
      issueId: discussionId,
      limit: 100,
    }),
  );
  expect(small.count).toBe(1);
  expect(exact.count).toBe(1);
  expect(large.count).toBe(1);
  expect(small.calls[0]?.sql).toBe(large.calls[0]?.sql);
  expectIndexed(
    await explainPlan(small.calls[0]!.sql, small.calls[0]!.values),
    'comments',
    /comment_issue_order/,
  );
  expect(exact.value.items).toHaveLength(commentCount);
  expect(exact.value.nextCursor).toBeNull();
  const issueCounts = await measured(() =>
    reactionStore().issueCounts(projectId, [discussionId]),
  );
  const commentCounts = await measured(() =>
    reactionStore().commentCounts(projectId, commentIds.slice(0, 20)),
  );
  expect(issueCounts.count).toBe(1);
  expect(commentCounts.count).toBe(1);
  expectIndexed(
    await explainPlan(issueCounts.calls[0]!.sql, issueCounts.calls[0]!.values),
    'reactions',
    /reaction_issue_group/,
  );
  expectIndexed(
    await explainPlan(
      commentCounts.calls[0]!.sql,
      commentCounts.calls[0]!.values,
    ),
    'reactions',
    /reaction_comment_group/,
  );
  expect(
    [...(issueCounts.value.get(discussionId) ?? [])].sort((a, b) =>
      a.reaction.localeCompare(b.reaction),
    ),
  ).toEqual([
    { reaction: 'eyes', count: 1 },
    { reaction: 'heart', count: 1 },
    { reaction: 'rocket', count: 1 },
  ]);
});

it('serves the project label list through a project-prefixed label index', async () => {
  const labels = await measured(() => taxonomyStore().listLabels(projectId));
  expect(labels.count).toBe(1);
  expect(labels.value).toHaveLength(500);
  expectIndexed(
    await explainPlan(labels.calls[0]!.sql, labels.calls[0]!.values),
    'labels',
    // At this fixture scale the planner is cost-indifferent between the two
    // unique project-prefixed indexes: (project_id, name_key) serves the
    // ORDER BY directly, (project_id, id) adds a bounded top-N sort. Both
    // keep the page off a sequential scan; neither reads other projects.
    /label_project_(name|id)/,
  );
});

it('never leaks the limit+1 overfetch row or an out-of-bound page size', async () => {
  const first = await repository().listIssues({
    projectId,
    state: 'open',
    limit: 40,
  });
  expect(first.items).toHaveLength(40);
  expect(first.nextCursor).not.toBeNull();
  expect(first.items[0]).toMatchObject({ number: issueCount });
  expect(first.items.at(-1)).toMatchObject({ number: 21 });
  for (const item of first.items) expect(item).not.toHaveProperty('body');
  const second = await repository().listIssues({
    projectId,
    state: 'open',
    limit: 40,
    after: first.nextCursor!,
  });
  expect(second.items).toHaveLength(20);
  expect(second.nextCursor).toBeNull();
  const exact = await repository().listIssues({
    projectId,
    state: 'open',
    limit: issueCount,
  });
  expect(exact.items).toHaveLength(issueCount);
  expect(exact.nextCursor).toBeNull();
  const capped = await repository().listIssues({
    projectId,
    state: 'open',
    limit: 100,
  });
  expect(capped.items).toHaveLength(issueCount);
  expect(capped.nextCursor).toBeNull();
  await expect(
    repository().listIssues({ projectId, state: 'open', limit: 101 }),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(
    repository().relations(
      projectId,
      Array.from({ length: 102 }, () => crypto.randomUUID()),
    ),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(
    commentStore().listByIssue({
      projectId,
      issueId: discussionId,
      limit: 101,
    }),
  ).rejects.toThrow();
  await expect(
    timelineStore().timeline({
      projectId,
      issueId: discussionId,
      limit: 101,
    }),
  ).rejects.toThrow();
});
