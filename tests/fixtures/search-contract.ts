import { describe, it, expect } from 'vitest';
import {
  SearchError,
  validateSearchAst,
  parseSearchQuery,
  searchTokenText,
  type SearchIndexStore,
  type SearchBudgetStore,
  handleSearchIndexEvent,
  handleSearchOutboxEvent,
  type SearchAst,
  type SearchStore,
} from '@hyperbug/application';
import {
  searchAcceptedFixtures,
  searchRejectedFixtures,
  searchInvalidAstFixtures,
  searchFuzzCorpus,
} from './search-query-contract.ts';
import type { RepositoryHarness } from './repository-contract.ts';

export function searchParserContract(
  parse: (
    source: string,
    principalId?: string,
  ) => SearchAst | Promise<SearchAst>,
) {
  describe('search parser shared semantics', () => {
    it('resolves the portable quoting/filter/Unicode/injection corpus', async () => {
      for (const fixture of searchAcceptedFixtures)
        expect(
          await parse(fixture.query, fixture.principalId),
          fixture.name,
        ).toEqual(fixture.expected);
    });
    it('rejects unsupported syntax, missing principals and complexity before database work', async () => {
      for (const fixture of searchRejectedFixtures)
        await expect(
          Promise.resolve().then(() => parse(fixture.query)),
          fixture.name,
        ).rejects.toMatchObject({ code: fixture.expected });
      for (const ast of searchInvalidAstFixtures)
        expect(() => validateSearchAst(ast)).toThrow(SearchError);
    });
    it('fuzzes bounded inputs with deterministic termination and validated outcomes', async () => {
      for (const source of searchFuzzCorpus()) {
        try {
          expect(validateSearchAst(await parse(source))).toEqual(
            await parse(source),
          );
        } catch (error) {
          expect(error).toHaveProperty('code');
          expect(String((error as SearchError).code)).toMatch(/^SEARCH_/);
        }
      }
    });
  });
}

export function searchStoreContract(
  get: () => {
    harness: RepositoryHarness;
    store: SearchStore;
    index: SearchIndexStore;
    budget: SearchBudgetStore;
    measuredQueries: () => string[];
  },
) {
  describe('search dual-store compiler contract', () => {
    async function seed() {
      const { harness } = get(),
        projectId = crypto.randomUUID(),
        principalId = crypto.randomUUID();
      await harness.query(
        'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [projectId, `search-${projectId}`, 'Search fixture', 1000, 1000],
      );
      await harness.query(
        "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Search staff', ?)",
        [principalId, 1000],
      );
      await harness.query(
        "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES (?, ?, 'staff', 'maintainer', ?)",
        [projectId, principalId, 1000],
      );
      const rows: [string, string][] = [
        ['STARTUP FAILURE CAFÉ 東京', 'crash timeout'],
        ['boundary', 'phrase'],
        ['startup failure', 'safe content'],
        ['literal SQL', "'); DROP TABLE issues; --"],
      ];
      const ids: string[] = [];
      for (let n = 0; n < rows.length; n++) {
        const id = crypto.randomUUID();
        ids.push(id);
        const [title, body] = rows[n]!;
        await harness.query(
          'INSERT INTO issues (id, project_id, number, title, body, body_text, body_text_version, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            projectId,
            n + 1,
            title,
            body,
            body,
            'search-test-v1',
            principalId,
            1000,
            1000,
            crypto.randomUUID(),
          ],
        );
        await harness.query(
          'INSERT INTO search_documents (issue_id, project_id, revision, projection_version, active, scope, title, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            projectId,
            1,
            'search-test-v1',
            1,
            `p${projectId.replaceAll('-', '')}`,
            searchTokenText(title),
            searchTokenText(body),
          ],
        );
      }
      return { projectId, principalId, ids };
    }
    it('executes native text/phrase/Unicode/negation/OR and parameterized injection safely', async () => {
      const { projectId, principalId, ids } = await seed(),
        { store } = get();
      const run = async (q: string) =>
        (
          await store.search({
            projectId,
            ast: parseSearchQuery(q, principalId),
          })
        ).items
          .map((row) => row.id)
          .sort();
      expect(await run('"startup failure" -timeout')).toEqual([ids[2]!]);
      expect(await run('CAFÉ 東京')).toEqual([ids[0]!]);
      expect(await run('cafe')).toEqual([]);
      expect(await run('"boundary phrase"')).toEqual([]);
      expect(await run('"startup failure" OR "literal SQL"')).toEqual(
        [ids[0]!, ids[2]!, ids[3]!].sort(),
      );
      expect(await run('"\u0027); DROP TABLE issues; --"')).toEqual([ids[3]!]);
      expect(await run('author:ffffffff-ffff-4fff-8fff-ffffffffffff')).toEqual(
        [],
      );
      expect(await run('state:open state:closed')).toEqual([]);
    });
    it('uses every MVP relational filter and null-safe exclusions with batched hydration', async () => {
      const { projectId, principalId, ids } = await seed(),
        { harness, store, measuredQueries } = get();
      const labelId = crypto.randomUUID(),
        typeId = crypto.randomUUID(),
        milestoneId = crypto.randomUUID();
      await harness.query(
        'INSERT INTO labels (id, project_id, name, name_key) VALUES (?, ?, ?, ?)',
        [labelId, projectId, 'Search label', 'search label'],
      );
      await harness.query(
        'INSERT INTO issue_types (id, project_id, name, name_key) VALUES (?, ?, ?, ?)',
        [typeId, projectId, 'Search type', 'search type'],
      );
      await harness.query(
        'INSERT INTO milestones (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [milestoneId, projectId, 'Search milestone', 1000, 1000],
      );
      await harness.query(
        'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES (?, ?, ?)',
        [projectId, ids[0]!, labelId],
      );
      await harness.query(
        'INSERT INTO issue_assignees (project_id, issue_id, principal_id) VALUES (?, ?, ?)',
        [projectId, ids[0]!, principalId],
      );
      await harness.query(
        'UPDATE issues SET type_id = ?, milestone_id = ? WHERE id = ?',
        [typeId, milestoneId, ids[0]!],
      );
      const before = measuredQueries().length;
      const page = await store.search({
        projectId,
        ast: parseSearchQuery(
          `state:open project:${projectId} author:me assignee:me label:${labelId} type:${typeId} milestone:${milestoneId}`,
          principalId,
        ),
      });
      expect(page.items.map((row) => row.id)).toEqual([ids[0]!]);
      expect(page.relations.labels.get(ids[0]!)).toEqual([labelId]);
      expect(page.relations.assignees.get(ids[0]!)).toEqual([principalId]);
      expect(measuredQueries().length - before).toBe(4);
      const absent = await store.search({
        projectId,
        ast: parseSearchQuery(
          `-label:${labelId} -type:${typeId} -milestone:${milestoneId} -assignee:${principalId}`,
        ),
      });
      expect(absent.items.map((row) => row.id).sort()).toEqual(
        ids.slice(1).sort(),
      );
    });
    it('traverses equal-timestamp ties and rejects mismatched/corrupt/retired cursors before SQL', async () => {
      const { projectId, ids } = await seed(),
        { store, measuredQueries } = get();
      const ast = parseSearchQuery('state:open');
      const first = await store.search({ projectId, ast, limit: 2 });
      expect(first.nextCursor).toBeTruthy();
      const second = await store.search({
        projectId,
        ast,
        limit: 2,
        after: first.nextCursor!,
      });
      expect([...first.items, ...second.items].map((row) => row.id)).toEqual(
        [...ids].sort().reverse(),
      );
      expect(second.nextCursor).toBeNull();
      const before = measuredQueries().length;
      await expect(
        store.search({
          projectId,
          ast: parseSearchQuery('state:closed'),
          after: first.nextCursor!,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
      await expect(
        store.search({ projectId, ast, after: 'invalid' }),
      ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
      const raw = JSON.parse(
        atob(first.nextCursor!.replaceAll('-', '+').replaceAll('_', '/')),
      );
      raw.policy = 2;
      const after = btoa(JSON.stringify(raw))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/u, '');
      await expect(
        store.search({ projectId, ast, after }),
      ).rejects.toMatchObject({ code: 'CURSOR_STALE' });
      expect(measuredQueries().length).toBe(before);
      const excessive: SearchAst = {
        version: 1,
        branches: [
          Array.from({ length: 16 }, () => ({
            kind: 'text',
            value: '東'.repeat(128),
            phrase: true,
            negated: false,
          })),
        ],
        sort: ['created_desc'],
      };
      await expect(
        store.search({ projectId, ast: excessive }),
      ).rejects.toMatchObject({ code: 'SEARCH_COMPLEXITY' });
      expect(measuredQueries().length).toBe(before);
    });
    it('fails incomplete indexing, reconciles bounded canonical pages and excludes stale visibility and permissions', async () => {
      const { projectId, principalId, ids } = await seed(),
        { harness, store, index } = get();
      await harness.query('DELETE FROM search_documents WHERE issue_id = ?', [
        ids[0]!,
      ]);
      await expect(
        store.search({ projectId, ast: parseSearchQuery('') }),
      ).rejects.toMatchObject({ code: 'SEARCH_INDEX_INCOMPLETE' });
      let after: string | undefined,
        processed = 0;
      do {
        const batch = await index.backfill({
          projectId,
          ...(after === undefined ? {} : { after }),
          limit: 2,
        });
        processed += batch.processed;
        after = batch.nextCursor ?? undefined;
      } while (after);
      expect(processed).toBe(4);
      await harness.query(
        "UPDATE issues SET moderation = 'hidden' WHERE id = ?",
        [ids[0]!],
      );
      await harness.query('UPDATE issues SET deleted_at = ? WHERE id = ?', [
        2000,
        ids[1]!,
      ]);
      expect(
        (await store.search({ projectId, ast: parseSearchQuery('') })).items
          .map((row) => row.id)
          .sort(),
      ).toEqual(ids.slice(2).sort());
      await index.backfill({ projectId });
      expect(
        await harness.query(
          'SELECT title, body, active FROM search_documents WHERE issue_id = ?',
          [ids[0]!],
        ),
      ).toEqual([{ title: '', body: '', active: 0 }]);
      await harness.query(
        "UPDATE projects SET visibility = 'private' WHERE id = ?",
        [projectId],
      );
      expect(
        (await store.search({ projectId, ast: parseSearchQuery('') })).items,
      ).toEqual([]);
      expect(
        (
          await store.search({
            projectId,
            principalId,
            ast: parseSearchQuery(''),
          })
        ).items,
      ).toHaveLength(2);
      await harness.query(
        'DELETE FROM project_roles WHERE project_id = ? AND principal_id = ?',
        [projectId, principalId],
      );
      expect(
        (
          await store.search({
            projectId,
            principalId,
            ast: parseSearchQuery(''),
          })
        ).items,
      ).toEqual([]);
      // Old text cannot select an edited Issue; an unavailable index is explicit.
      await harness.query(
        "UPDATE projects SET visibility = 'public' WHERE id = ?",
        [projectId],
      );
      await harness.query(
        "UPDATE issues SET revision = 2, title = 'replacement', body_text = 'replacement', body_text_version = 'search-test-v2' WHERE id = ?",
        [ids[2]!],
      );
      await expect(
        store.search({ projectId, ast: parseSearchQuery('startup') }),
      ).rejects.toMatchObject({ code: 'SEARCH_INDEX_INCOMPLETE' });
      await index.backfill({ projectId });
      expect(
        (await store.search({ projectId, ast: parseSearchQuery('startup') }))
          .items,
      ).toEqual([]);
    });
    it('replays current outbox revisions, ignores stale and duplicate events and rebuilds deletes/redactions', async () => {
      const { projectId, principalId, ids } = await seed(),
        { harness, index, store } = get(),
        issueId = ids[0]!;
      const event = (revision: number) => ({
        version: 1 as const,
        projectId,
        issueId,
        revision,
      });
      await harness.query(
        "UPDATE issues SET revision = 2, title = 'new text', body_text = 'new text' WHERE id = ?",
        [issueId],
      );
      const mutationId = crypto.randomUUID();
      await harness.query(
        'INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          mutationId,
          projectId,
          issueId,
          2,
          principalId,
          'issue.edit',
          1000,
          '{}',
        ],
      );
      expect(
        (
          await handleSearchOutboxEvent(index, {
            projectId,
            aggregateId: issueId,
            eventType: 'issue.edit',
            payload: { issueId, mutationId },
          })
        ).updated,
      ).toBe(1);
      expect((await handleSearchIndexEvent(index, event(1))).updated).toBe(0);
      expect((await handleSearchIndexEvent(index, event(2))).updated).toBe(0);
      expect((await handleSearchIndexEvent(index, event(3))).processed).toBe(0);
      await harness.query(
        "UPDATE issues SET revision = 3, moderation = 'redacted', body_text = NULL, body_text_version = NULL WHERE id = ?",
        [issueId],
      );
      expect((await handleSearchIndexEvent(index, event(3))).updated).toBe(1);
      await harness.query(
        'UPDATE issues SET revision = 4, deleted_at = ? WHERE id = ?',
        [2000, issueId],
      );
      expect((await handleSearchIndexEvent(index, event(4))).updated).toBe(1);
      expect((await handleSearchIndexEvent(index, event(2))).updated).toBe(0);
      expect(
        await harness.query(
          'SELECT revision, active, title, body FROM search_documents WHERE issue_id = ?',
          [issueId],
        ),
      ).toEqual([{ revision: 4, active: 0, title: '', body: '' }]);
      await harness.query('DELETE FROM search_documents WHERE project_id = ?', [
        projectId,
      ]);
      await index.backfill({ projectId });
      expect(
        (await store.search({ projectId, ast: parseSearchQuery('') })).items,
      ).toHaveLength(3);
      const before = get().measuredQueries().length;
      expect(() =>
        handleSearchIndexEvent(index, { ...event(4), revision: -1 }),
      ).toThrow('SEARCH_VALUE');
      await expect(
        index.backfill({ projectId, limit: 11, tier: 'cloudflare-minimum' }),
      ).rejects.toMatchObject({ code: 'SEARCH_COMPLEXITY' });
      expect(get().measuredQueries().length).toBe(before);
    });
    it('atomically reserves minimum quotas, denies exhaustion before index work and bounds a full-body reindex', async () => {
      const { projectId, principalId, ids } = await seed(),
        { harness, budget, index, store, measuredQueries } = get();
      await harness.query('DELETE FROM search_budget');
      try {
        const nowMs = Date.now();
        const reservations = await Promise.all(
          Array.from({ length: 15 }, () =>
            budget.reserve({ reads: 100000, writes: 1, nowMs }),
          ),
        );
        expect(reservations.filter(Boolean)).toHaveLength(10);
        const before = measuredQueries().length;
        await expect(
          store.search({
            projectId,
            tier: 'cloudflare-minimum',
            ast: parseSearchQuery(''),
          }),
        ).rejects.toMatchObject({ code: 'SEARCH_BUDGET_EXHAUSTED' });
        expect(measuredQueries().length - before).toBe(1);
        await expect(
          index.backfill({ projectId, tier: 'cloudflare-minimum', limit: 1 }),
        ).rejects.toMatchObject({ code: 'SEARCH_BUDGET_EXHAUSTED' });
        expect(
          (
            await harness.query(
              'SELECT revision FROM search_documents WHERE issue_id = ?',
              [ids[0]!],
            )
          )[0],
        ).toEqual({ revision: 1 });
        await harness.query('DELETE FROM search_budget');
        const writeReservations = await Promise.all(
          Array.from({ length: 3 }, () =>
            budget.reserve({ reads: 1, writes: 10000, nowMs }),
          ),
        );
        expect(writeReservations.filter(Boolean)).toHaveLength(2);
        await expect(
          index.backfill({ projectId, tier: 'cloudflare-minimum', limit: 1 }),
        ).rejects.toMatchObject({ code: 'SEARCH_BUDGET_EXHAUSTED' });
        await harness.query('DELETE FROM search_budget');
        const body = Array.from(
          { length: 6000 },
          (_, n) => 'x' + n.toString(36),
        ).join(' ');
        await harness.query(
          'UPDATE issues SET revision = 2, body_text = ?, body = ? WHERE project_id = ?',
          [body, body, projectId],
        );
        for (let number = 5; number <= 10; number++)
          await harness.query(
            'INSERT INTO issues (id, project_id, number, title, body, body_text, body_text_version, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              crypto.randomUUID(),
              projectId,
              number,
              'Quota fixture',
              body,
              body,
              'search-test-v1',
              principalId,
              1000,
              1000,
              crypto.randomUUID(),
            ],
          );
        const start = performance.now();
        const result = await index.backfill({
          projectId,
          tier: 'cloudflare-minimum',
        });
        expect(result.processed).toBe(10);
        expect(result.updated).toBe(10);
        if (result.usage) {
          expect(result.usage.statements).toBe(11);
          expect(result.usage.rowsRead).toBeLessThanOrEqual(2000);
          expect(result.usage.rowsWritten).toBeLessThanOrEqual(5128);
        }
        expect(
          (
            await store.search({
              projectId,
              tier: 'cloudflare-minimum',
              ast: parseSearchQuery('x10'),
            })
          ).items,
        ).toHaveLength(10);
        const { mkdir, writeFile } = await import('node:fs/promises');
        await mkdir('.local/evidence', { recursive: true });
        await writeFile(
          '.local/evidence/08-' +
            (result.usage ? 'd1' : 'postgres') +
            '-minimum-reindex.json',
          JSON.stringify(
            {
              documents: 10,
              bodyCodePoints: body.length,
              uniqueBodyTokens: 6000,
              elapsedMs: performance.now() - start,
              result,
              ledger: await harness.query(
                'SELECT day, reads, writes FROM search_budget',
              ),
            },
            null,
            2,
          ) + '\n',
        );
        expect(
          await budget.reserve({
            reads: 1,
            writes: 1,
            nowMs: nowMs + 86400000,
          }),
        ).toBe(true);
        expect(await budget.reserve({ reads: 1, writes: 1, nowMs })).toBe(
          false,
        );
      } finally {
        await harness.query('DELETE FROM search_budget');
      }
    });
    it('preserves late and repeated phrases beyond native PostgreSQL position limits', async () => {
      const { projectId, ids } = await seed(),
        { harness, store, index } = get();
      const body = 'r '.repeat(16381) + 'a b c';
      await harness.query(
        'UPDATE issues SET body_text = ?, body = ?, revision = 2 WHERE id = ?',
        [body, body, ids[0]!],
      );
      await index.backfill({ projectId });
      expect(
        (
          await store.search({
            projectId,
            ast: parseSearchQuery('"a b c"'),
          })
        ).items.map((row) => row.id),
      ).toEqual([ids[0]!]);
      expect(
        (
          await store.search({ projectId, ast: parseSearchQuery('"r a b c"') })
        ).items.map((row) => row.id),
      ).toEqual([ids[0]!]);
      expect(
        (
          await store.search({
            projectId,
            ast: parseSearchQuery('"boundary phrase"'),
          })
        ).items,
      ).toEqual([]);
    });
  });
}

export function searchHttpContract(
  get: () => {
    query: RepositoryHarness['query'];
    index: SearchIndexStore;
    fetch: (path: string) => Promise<{
      status: number;
      headers: { get(name: string): string | null };
      json(): Promise<unknown>;
    }>;
  },
) {
  it('search HTTP enforces visibility before readiness and serves bounded suggestions with safe failures', async () => {
    const { query, index, fetch } = get(),
      projectId = crypto.randomUUID(),
      privateId = crypto.randomUUID(),
      principalId = crypto.randomUUID(),
      issueId = crypto.randomUUID();
    for (const id of [projectId, privateId])
      await query(
        'INSERT INTO projects (id, slug, name, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          id,
          'http-search-' + id,
          'Search HTTP fixture',
          id === projectId ? 'public' : 'private',
          1000,
          1000,
        ],
      );
    await query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Search HTTP author', ?)",
      [principalId, 1000],
    );
    await query(
      'INSERT INTO issues (id, project_id, number, title, body, body_text, body_text_version, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        issueId,
        projectId,
        1,
        'Search HTTP',
        'safe text',
        'safe text',
        'search-v1',
        principalId,
        1000,
        1000,
        crypto.randomUUID(),
      ],
    );
    const path = '/api/v1/projects/' + projectId + '/search';
    expect(
      (await fetch('/api/v1/projects/' + privateId + '/search')).status,
    ).toBe(404);
    let response = await fetch(path);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'SEARCH_INDEX_INCOMPLETE' },
    });
    expect(
      (await fetch('/api/v1/projects/' + projectId + '/issues/' + issueId))
        .status,
    ).toBe(200);
    await index.backfill({ projectId });
    response = await fetch(path + '?q=search');
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({
      items: [{ id: issueId }],
      nextCursor: null,
    });
    response = await fetch(path + '/suggestions?field=author');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [{ field: 'author', value: principalId }],
    });
    response = await fetch(path + '?q=author%3Ame');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: 'SEARCH_PRINCIPAL_REQUIRED' },
    });
    expect((await fetch(path + '?unsupported=true')).status).toBe(400);
    await query("UPDATE issues SET moderation = 'redacted' WHERE id = ?", [
      issueId,
    ]);
    expect(
      await (await fetch(path + '/suggestions?field=author')).json(),
    ).toEqual({ items: [] });
    expect(await (await fetch(path)).json()).toEqual({
      items: [],
      nextCursor: null,
    });
  });
}

export async function measureSearchQueries(get: {
  harness: RepositoryHarness;
  store: SearchStore;
  measuredQueries: () => string[];
  profile: 'd1' | 'postgres';
  compile: (
    query: import('@hyperbug/application').SearchQuery,
    options: import('@hyperbug/application').SearchPageOptions,
    columns: string,
  ) => { sql: string; values: (string | number | null)[] };
  execute?: (
    sql: string,
    values: (string | number | null)[],
  ) => Promise<Record<string, unknown>[]>;
  explain?: (
    sql: string,
    values: (string | number | null)[],
  ) => Promise<unknown>;
  metadata?: (
    sql: string,
    values: (string | number | null)[],
  ) => Promise<unknown>;
}) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { searchPageOptions } = await import('@hyperbug/application');
  const { harness, store, profile, measuredQueries } = get;
  const projectId = crypto.randomUUID(),
    otherId = crypto.randomUUID(),
    principalId = crypto.randomUUID();
  await harness.query(
    "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'staff', 'Search measurement', ?)",
    [principalId, 1000],
  );
  for (const project of [projectId, otherId]) {
    await harness.query(
      'INSERT INTO projects (id, slug, name, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        project,
        'search-measure-' + project,
        'Measurement fixture',
        project === projectId ? 'public' : 'private',
        1000,
        1000,
      ],
    );
    for (let start = 0; start < 4000; start += 10) {
      const values = Array.from({ length: 10 }, (_, offset) => {
        const number = start + offset + 1;
        return [
          crypto.randomUUID(),
          project,
          number,
          number % 100 === 0 ? 'needle phrase' : 'ordinary report',
          principalId,
          1000 + Math.floor(number / 20),
          crypto.randomUUID(),
        ];
      }).flat();
      await harness.query(
        `INSERT INTO issues (id, project_id, number, title, author_id, created_at, last_mutation_id, updated_at, body, body_text, body_text_version) VALUES ${Array.from({ length: 10 }, () => "(?, ?, ?, ?, ?, ?, ?, 2000, 'fixture body', 'fixture body', 'measure-v1')").join(',')}`,
        values,
      );
    }
  }
  await harness.query(
    "UPDATE issues SET moderation = 'hidden' WHERE project_id = ? AND number > 2000",
    [projectId],
  );
  // Deliberately stale active index hits include hidden/private distractors.
  await harness.query(
    `INSERT INTO search_documents (issue_id, project_id, revision, projection_version, active, scope, title, body) SELECT id, project_id, revision, body_text_version, 1, ?, ' ' || title || ' ', ' ' || body_text || ' ' FROM issues WHERE project_id = ?`,
    ['p' + projectId.replaceAll('-', ''), projectId],
  );
  await harness.query(
    `INSERT INTO search_documents (issue_id, project_id, revision, projection_version, active, scope, title, body) SELECT id, project_id, revision, body_text_version, 1, ?, ' ' || title || ' ', ' ' || body_text || ' ' FROM issues WHERE project_id = ?`,
    ['p' + otherId.replaceAll('-', ''), otherId],
  );
  await harness.query('ANALYZE issues');
  await harness.query(
    profile === 'postgres'
      ? 'VACUUM ANALYZE search_documents'
      : 'ANALYZE search_documents',
  );
  const observations = [];
  for (const source of ['"needle phrase"', '-needle state:open', '']) {
    const query = {
      projectId,
      principalId,
      ast: parseSearchQuery(source),
      limit: 25,
    };
    const start = performance.now(),
      before = measuredQueries().length;
    const page = await store.search(query);
    const elapsedMs = performance.now() - start;
    const statements = measuredQueries().slice(before);
    expect(statements).toHaveLength(4);
    expect(page.items.length).toBe(source.startsWith('"') ? 20 : 25);
    expect(
      page.items.every(
        (row) => row.projectId === projectId && row.moderation === 'visible',
      ),
    ).toBe(true);
    const compiled = get.compile(
      query,
      await searchPageOptions(query),
      'id, project_id, number, title, body_text, body_text_version, state, close_reason, moderation, author_id, revision, type_id, milestone_id, created_at, updated_at, closed_at, deleted_at',
    );
    const plan = get.explain
      ? await get.explain(compiled.sql, compiled.values)
      : await harness.query(
          'EXPLAIN QUERY PLAN ' + compiled.sql,
          compiled.values as (string | number)[],
        );
    expect(JSON.stringify(plan)).toMatch(
      /issue_project_|issues_pkey|sqlite_autoindex_issues/,
    );
    if (source.startsWith('"'))
      expect(JSON.stringify(plan)).toMatch(
        /VIRTUAL TABLE INDEX|search_vector_gin/,
      );
    if (profile === 'postgres') {
      expect(JSON.stringify(plan)).not.toMatch(
        /"Node Type":"Seq Scan"[^}]*"Relation Name":"issues"/u,
      );
      // Text membership must not multiply canonical fetches by the posting-list size.
      const inspect = (value: unknown): void => {
        if (Array.isArray(value)) {
          for (const entry of value) inspect(entry);
        } else if (value && typeof value === 'object') {
          const node = value as Record<string, unknown>;
          if (node['Relation Name'] === 'issues') {
            expect(Number(node['Actual Loops'])).toBeLessThanOrEqual(4097);
            expect(
              Number(node['Actual Rows']) * Number(node['Actual Loops']),
            ).toBeLessThanOrEqual(4097);
          }
          for (const entry of Object.values(node)) inspect(entry);
        }
      };
      inspect(plan);
    }
    const metadata = get.metadata
      ? await get.metadata(compiled.sql, compiled.values)
      : null;
    const readinessMetadata = get.metadata
      ? await get.metadata(statements[0]!, [projectId, principalId, 4097])
      : null;
    const relationMetadata = get.metadata
      ? await Promise.all(
          statements
            .slice(2)
            .map((sql) =>
              get.metadata!(sql, [
                projectId,
                JSON.stringify(page.items.map((row) => row.id)),
              ]),
            ),
        )
      : null;
    observations.push({
      source,
      elapsedMs,
      statements: statements.length,
      returned: page.items.length,
      plan,
      metadata,
      readinessMetadata,
      relationMetadata,
    });
  }
  let unauthorizedPlan: unknown = null;
  if (get.explain) {
    const denied = {
      projectId: otherId,
      principalId,
      ast: parseSearchQuery('needle'),
    };
    const compiled = get.compile(
      denied,
      await searchPageOptions(denied),
      'id, created_at',
    );
    unauthorizedPlan = await get.explain(compiled.sql, compiled.values);
    const inspect = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const entry of value) inspect(entry);
      } else if (value && typeof value === 'object') {
        const node = value as Record<string, unknown>;
        if (
          node['Relation Name'] === 'issues' ||
          node['Relation Name'] === 'search_documents'
        )
          expect(node['Actual Loops']).toBe(0);
        for (const entry of Object.values(node)) inspect(entry);
      }
    };
    inspect(unauthorizedPlan);
  }
  const raced = {
    projectId,
    principalId,
    ast: parseSearchQuery('needle'),
    tier: 'cloudflare-minimum' as const,
  };
  const fenced = get.compile(
    raced,
    await searchPageOptions(raced),
    'id, created_at',
  );
  const fencedRows = get.execute
    ? await get.execute(fenced.sql, fenced.values)
    : await harness.query(fenced.sql, fenced.values as (string | number)[]);
  expect(fencedRows).toEqual([
    { id: null, created_at: null, search_overflow: 1 },
  ]);
  const before = measuredQueries().length;
  await expect(
    store.search({
      projectId,
      ast: parseSearchQuery(''),
      tier: 'cloudflare-minimum',
    }),
  ).rejects.toMatchObject({ code: 'SEARCH_BUDGET_EXHAUSTED' });
  expect(measuredQueries().length - before).toBe(2);
  await mkdir('.local/evidence', { recursive: true });
  await writeFile(
    `.local/evidence/08-${profile}-search-query.json`,
    JSON.stringify(
      {
        profile,
        unauthorizedPlan,
        fixture: {
          issues: 8000,
          publicVisible: 2000,
          publicHidden: 2000,
          private: 4000,
          tieGroup: 20,
        },
        observations,
      },
      null,
      2,
    ) + '\n',
  );
}
