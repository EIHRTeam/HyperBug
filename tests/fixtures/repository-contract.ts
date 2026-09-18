import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CreateIssueIntent,
  EditIssueIntent,
  IssueRepository,
} from '@hyperbug/application';

export interface RepositoryHarness {
  repository: IssueRepository;
  query(
    sql: string,
    values?: (string | number)[],
  ): Promise<Record<string, unknown>[]>;
}
let sequence = 0;
export const nextId = () =>
  `00000000-0000-4000-8000-${(++sequence).toString(16).padStart(12, '0')}`;
const digest = () => (++sequence).toString(16).padStart(64, '0');
const now = 1789689600000;
const sideTables = [
  'timeline_events',
  'audit_events',
  'outbox',
  'mutation_receipts',
] as const;

export function repositoryContract(get: () => RepositoryHarness) {
  describe('shared persistence contract', () => {
    let projectId: string;
    let otherProjectId: string;
    let principalId: string;
    let otherPrincipalId: string;
    const intent = (
      overrides: Partial<CreateIssueIntent> = {},
    ): CreateIssueIntent => ({
      id: nextId(),
      mutationId: nextId(),
      requestId: nextId(),
      principalId,
      projectId,
      keyHash: digest(),
      payloadHash: digest(),
      now,
      expiresAt: now + 86400000,
      title: 'A bounded issue',
      body: 'Private body must not enter receipts or events.',
      auditAction: 'issue.created',
      ...overrides,
    });
    const count = async (table: string) =>
      Number(
        (
          await get().query(
            `SELECT count(*) AS count FROM ${table} WHERE project_id = ?`,
            [projectId],
          )
        )[0]?.count,
      );
    const sideCounts = async () => Promise.all(sideTables.map(count));
    beforeEach(async () => {
      projectId = nextId();
      otherProjectId = nextId();
      principalId = nextId();
      otherPrincipalId = nextId();
      for (const id of [projectId, otherProjectId])
        await get().query(
          'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [id, `project-${id}`, 'Contract project', now, now],
        );
      for (const id of [principalId, otherPrincipalId])
        await get().query(
          "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Contract user', ?)",
          [id, now],
        );
    });

    it('commits an aggregate with timeline, required audit, outbox and a safe receipt', async () => {
      const input = intent();
      const { result, replayed } = await get().repository.createIssue(input);
      expect(replayed).toBe(false);
      expect(result).toEqual({
        id: input.id,
        projectId,
        number: 1,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
      expect(
        await get().repository.getIssue(projectId, input.id),
      ).toMatchObject({
        ...result,
        title: input.title,
        body: input.body,
        state: 'open',
        closeReason: null,
        closedAt: null,
      });
      expect(await sideCounts()).toEqual([1, 1, 1, 1]);
      for (const table of sideTables)
        expect(
          JSON.stringify(
            await get().query(`SELECT * FROM ${table} WHERE project_id = ?`, [
              projectId,
            ]),
          ),
        ).not.toContain(input.body);
    });

    it('cannot turn a create into an edit or record a mismatched audit action', async () => {
      const input = intent();
      await get().repository.createIssue(input);
      const edit = {
        ...intent(),
        id: input.id,
        expectedRevision: 1,
        title: 'Must not change',
      };
      await expect(get().repository.createIssue(edit)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(
        get().repository.editIssue(intent() as EditIssueIntent),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      await expect(get().repository.editIssue(edit)).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
      await expect(
        get().repository.createIssue(intent({ auditAction: 'issue.edited' })),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
      expect(
        (await get().repository.getIssue(projectId, input.id))?.title,
      ).toBe(input.title);
      expect(await sideCounts()).toEqual([1, 1, 1, 1]);
    });

    it('allocates distinct consecutive project numbers under concurrent creation', async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          get().repository.createIssue(intent()),
        ),
      );
      expect(
        results.map(({ result }) => result.number).sort((a, b) => a - b),
      ).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
      expect(await sideCounts()).toEqual([12, 12, 12, 12]);
      expect(
        (
          await get().repository.createIssue(
            intent({ projectId: otherProjectId }),
          )
        ).result.number,
      ).toBe(1);
    });

    it('replays simultaneous same-key requests exactly once and rejects payload changes', async () => {
      const input = intent();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          get().repository.createIssue({
            ...input,
            id: nextId(),
            mutationId: nextId(),
          }),
        ),
      );
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      for (const result of results)
        expect(result.result).toEqual(results[0]?.result);
      expect(await sideCounts()).toEqual([1, 1, 1, 1]);
      await expect(
        get().repository.createIssue({ ...input, payloadHash: digest() }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    });

    it('scopes idempotency by principal, project and operation', async () => {
      const input = intent();
      await get().repository.createIssue(input);
      await get().repository.createIssue({
        ...intent({ principalId: otherPrincipalId }),
        keyHash: input.keyHash,
      });
      await get().repository.createIssue({
        ...intent({ projectId: otherProjectId }),
        keyHash: input.keyHash,
      });
      const edit = {
        ...intent(),
        id: input.id,
        keyHash: input.keyHash,
        expectedRevision: 1,
        title: 'Edited',
        auditAction: 'issue.edited' as const,
      };
      expect((await get().repository.editIssue(edit)).result.revision).toBe(2);
      expect(await count('issues')).toBe(2);
    });

    it('retains the original replay result after later revisions and expires it explicitly', async () => {
      const input = intent();
      const initial = await get().repository.createIssue(input);
      await get().repository.editIssue({
        ...intent(),
        id: input.id,
        expectedRevision: 1,
        title: 'Edited',
        now: now + 1,
        auditAction: 'issue.edited',
      });
      expect(await get().repository.createIssue(input)).toEqual({
        result: initial.result,
        replayed: true,
      });
      await expect(
        get().repository.createIssue({
          ...input,
          now: input.expiresAt,
          expiresAt: input.expiresAt + 86400000,
        }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_EXPIRED' });
      expect(await sideCounts()).toEqual([2, 2, 2, 2]);
    });

    it('permits one concurrent edit and rolls stale writes back completely', async () => {
      const input = intent();
      await get().repository.createIssue(input);
      const edits = Array.from({ length: 5 }, (_, i) => ({
        ...intent(),
        id: input.id,
        expectedRevision: 1,
        title: `Edit ${i}`,
        auditAction: 'issue.edited' as const,
      }));
      const results = await Promise.allSettled(
        edits.map((edit) => get().repository.editIssue(edit)),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      for (const result of results)
        if (result.status === 'rejected')
          expect(result.reason).toMatchObject({ code: 'REVISION_CONFLICT' });
      expect(
        (await get().repository.getIssue(projectId, input.id))?.revision,
      ).toBe(2);
      expect(await sideCounts()).toEqual([2, 2, 2, 2]);
    });

    it('rolls back aggregate, counter and side records when outbox insertion fails', async () => {
      const input = intent();
      await get().query(
        "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES (?, ?, ?, 'fixture', '{}', ?, ?)",
        [input.mutationId, projectId, input.id, now, now],
      );
      await expect(get().repository.createIssue(input)).rejects.toThrow();
      expect(await get().repository.getIssue(projectId, input.id)).toBeNull();
      expect(await sideCounts()).toEqual([0, 0, 1, 0]);
      expect((await get().repository.createIssue(intent())).result.number).toBe(
        1,
      );
    });

    it('returns not-found for missing, cross-project and archived targets without side effects', async () => {
      const input = intent();
      await get().repository.createIssue(input);
      expect(
        await get().repository.getIssue(otherProjectId, input.id),
      ).toBeNull();
      await expect(
        get().repository.editIssue({
          ...intent({ projectId: otherProjectId }),
          auditAction: 'issue.edited',
          id: input.id,
          expectedRevision: 1,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        get().repository.editIssue({
          ...intent(),
          expectedRevision: 1,
          auditAction: 'issue.edited',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await get().query(
        "UPDATE projects SET status = 'archived' WHERE id = ?",
        [projectId],
      );
      await expect(
        get().repository.createIssue(intent()),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        get().repository.editIssue({
          ...intent(),
          auditAction: 'issue.edited',
          id: input.id,
          expectedRevision: 1,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(await sideCounts()).toEqual([1, 1, 1, 1]);
    });

    it('keeps update timestamps monotonic when the clock moves backwards', async () => {
      const input = intent();
      await get().repository.createIssue(input);
      const result = await get().repository.editIssue({
        ...intent(),
        id: input.id,
        expectedRevision: 1,
        now: now - 100,
        expiresAt: now + 100,
        auditAction: 'issue.edited',
      });
      expect(result.result).toMatchObject({ revision: 2, updatedAt: now });
    });

    it('paginates equal timestamps without duplicates, omissions or cross-project data', async () => {
      const inputs = Array.from({ length: 7 }, () => intent());
      for (const input of inputs) await get().repository.createIssue(input);
      await get().repository.createIssue(intent({ projectId: otherProjectId }));
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page = await get().repository.listIssues({
          projectId,
          state: 'open',
          limit: 2,
          ...(cursor ? { after: cursor } : {}),
        });
        expect(page.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.items.map((row) => row.id));
        cursor = page.nextCursor;
        if (cursor) {
          await expect(
            get().repository.listIssues({
              projectId: otherProjectId,
              state: 'open',
              after: cursor,
            }),
          ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
          await expect(
            get().repository.listIssues({
              projectId,
              state: 'closed',
              after: cursor,
            }),
          ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
        }
      } while (cursor);
      expect(seen).toEqual(
        inputs
          .map((i) => i.id)
          .sort()
          .reverse(),
      );
      expect(
        (await get().repository.listIssues({ projectId, state: 'closed' }))
          .items,
      ).toEqual([]);
    });

    it('prevents ordinary audit and timeline updates and deletions', async () => {
      await get().repository.createIssue(intent());
      for (const table of ['audit_events', 'timeline_events']) {
        await expect(
          get().query(
            `UPDATE ${table} SET action = 'rewrite' WHERE project_id = ?`,
            [projectId],
          ),
        ).rejects.toThrow('append-only');
        await expect(
          get().query(`DELETE FROM ${table} WHERE project_id = ?`, [projectId]),
        ).rejects.toThrow('append-only');
      }
    });

    it('enforces project-scoped foreign keys and state consistency in the database', async () => {
      const input = intent();
      await get().repository.createIssue(input);
      await expect(
        get().query(
          "INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES (?, ?, ?, 2, ?, 'fixture', ?, '{}')",
          [nextId(), otherProjectId, input.id, principalId, now],
        ),
      ).rejects.toThrow();
      await expect(
        get().query("UPDATE issues SET state = 'closed' WHERE id = ?", [
          input.id,
        ]),
      ).rejects.toThrow();
      await expect(
        get().query(
          "UPDATE issues SET state = 'closed', closed_at = ? WHERE id = ?",
          [now, input.id],
        ),
      ).rejects.toThrow();
      await expect(
        get().query('UPDATE issues SET last_mutation_id = ? WHERE id = ?', [
          '-0000000-0000-4000-8000-000000000000',
          input.id,
        ]),
      ).rejects.toThrow();
      await expect(
        get().query('UPDATE issues SET author_id = ? WHERE id = ?', [
          nextId(),
          input.id,
        ]),
      ).rejects.toThrow();
      expect(
        (await get().repository.getIssue(projectId, input.id))?.state,
      ).toBe('open');
    });
  });
}

export async function measureRepositoryQueries(
  harness: RepositoryHarness,
  profile: 'd1' | 'postgres',
  measuredQueries: () => string[],
) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const project = nextId();
  const otherProject = nextId();
  const principal = nextId();
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Performance fixture', ?)",
    [principal, now],
  );
  for (const id of [project, otherProject]) {
    await harness.query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, `perf-${id}`, 'Performance fixture', now, now],
    );
    // Ten rows / 80 bind parameters keeps each insert under D1's parameter bound.
    for (let start = 0; start < 2000; start += 10) {
      const values = Array.from({ length: 10 }, (_, i) => [
        nextId(),
        id,
        start + i + 1,
        principal,
        now + Math.floor((start + i) / 20),
        now + Math.floor((start + i) / 20),
        nextId(),
        'Fixture body',
      ]).flat();
      await harness.query(
        `INSERT INTO issues (id, project_id, number, author_id, created_at, updated_at, last_mutation_id, body, title) VALUES ${Array.from({ length: 10 }, () => "(?, ?, ?, ?, ?, ?, ?, ?, 'Fixture')").join(',')}`,
        values,
      );
    }
    await harness.query(
      "UPDATE issues SET state = 'closed', close_reason = 'completed', closed_at = updated_at WHERE project_id = ? AND number % 4 != 0",
      [id],
    );
  }
  await harness.query('ANALYZE issues');
  const offset = measuredQueries().length;
  const page = await harness.repository.listIssues({
    projectId: project,
    state: 'open',
  });
  expect(page.items).toHaveLength(40);
  for (const item of page.items) expect(item).not.toHaveProperty('body');
  expect(page.nextCursor).not.toBeNull();
  expect(measuredQueries().length - offset).toBe(1);
  const sql = measuredQueries().at(-1);
  const first = page.items[0];
  const last = page.items.at(-1);
  if (!first || !last || !page.nextCursor)
    throw new Error('Incomplete list fixture');
  const detailOffset = measuredQueries().length;
  const detail = await harness.repository.getIssue(project, first.id);
  expect(detail?.id).toBe(page.items[0]?.id);
  expect(measuredQueries().length - detailOffset).toBe(1);
  const detailSql = measuredQueries().at(-1);
  const cursorOffset = measuredQueries().length;
  const nextPage = await harness.repository.listIssues({
    projectId: project,
    state: 'open',
    after: page.nextCursor,
  });
  expect(nextPage.items).toHaveLength(40);
  expect(measuredQueries().length - cursorOffset).toBe(1);
  const cursorSql = measuredQueries().at(-1);
  if (!sql || !detailSql || !cursorSql) throw new Error('Query capture failed');
  const prefix =
    profile === 'd1'
      ? 'EXPLAIN QUERY PLAN '
      : 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ';
  const listPlan = await harness.query(prefix + sql, [project, 'open', 41]);
  const detailPlan = await harness.query(prefix + detailSql, [
    project,
    first.id,
  ]);
  const cursorPlan = await harness.query(prefix + cursorSql, [
    project,
    'open',
    last.createdAt,
    last.id,
    41,
  ]);
  for (const plan of [listPlan, cursorPlan]) {
    expect(JSON.stringify(plan)).toMatch(/issue_project_(state_)?created/);
    expect(JSON.stringify(plan)).not.toContain('Seq Scan');
  }
  expect(JSON.stringify(detailPlan)).toMatch(
    /issue_project_id|issues_pkey|sqlite_autoindex_issues/,
  );
  await mkdir('.local/evidence', { recursive: true });
  await writeFile(
    `.local/evidence/${profile}-query-plans.json`,
    `${JSON.stringify({ profile, fixture: { projects: 2, issuesPerProject: 2000, equalTimestampGroup: 20, openFraction: 0.25 }, listStatements: 1, detailStatements: 1, cursorStatements: 1, listRows: 40, listPlan, detailPlan, cursorPlan }, null, 2)}\n`,
  );
}
