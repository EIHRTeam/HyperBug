import { describe, it, expect } from 'vitest';
import {
  SearchError,
  validateSearchAst,
  parseSearchQuery,
  normalizeSearchText,
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
            normalizeSearchText(title),
            normalizeSearchText(body),
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
      expect(measuredQueries().length - before).toBe(3);
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
      raw.v = 2;
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
  });
}
