import { expect, it } from 'vitest';
import type {
  ContentProjectionStore,
  CommentStore,
} from '@hyperbug/application';
import type { RepositoryHarness } from './repository-contract.ts';
import { nextId } from './repository-contract.ts';
import { projectMarkdownText } from '../../packages/security/src/markdown/index.ts';

export function contentProjectionContract(
  get: () => {
    harness: RepositoryHarness;
    projections: ContentProjectionStore;
    comments: CommentStore;
  },
) {
  it('atomically projects issue/comment writes, serves stored previews, and resumes explicit legacy backfill', async () => {
    const { harness, projections, comments } = get();
    const projectId = nextId();
    const principalId = nextId();
    const now = 1791000000000;
    await harness.query(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [projectId, `content-${projectId}`, 'Content', now, now],
    );
    await harness.query(
      "INSERT INTO principals (id, kind, display_name, created_at) VALUES (?, 'user', 'Content author', ?)",
      [principalId, now],
    );
    const identity = () => ({
      mutationId: nextId(),
      requestId: nextId(),
      principalId,
      projectId,
      keyHash: nextId().replaceAll('-', '').padEnd(64, '0'),
      payloadHash: 'b'.repeat(64),
      now,
      expiresAt: now + 86400000,
    });
    const body =
      '**Hello** <script>hidden-script</script>world ![alt](https://example.com/image)';
    const input = {
      ...identity(),
      id: nextId(),
      title: 'Projected',
      body,
      typeId: null,
      milestoneId: null,
      labelIds: [],
      assigneeIds: [],
    };
    await harness.repository.createIssue(input);
    const expected = projectMarkdownText(body);
    expect(
      (
        await harness.query(
          'SELECT body, body_text, body_text_version FROM issues WHERE id = ?',
          [input.id],
        )
      )[0],
    ).toEqual({
      body,
      body_text: expected.text,
      body_text_version: expected.version,
    });
    const listed = await harness.repository.listIssues({ projectId });
    expect(listed.items[0]).toMatchObject({
      bodyText: expected.text,
      bodyTextVersion: expected.version,
    });
    expect(listed.items[0]).not.toHaveProperty('body');
    const editBody = '**Updated** 🐛';
    await harness.repository.editIssue({
      ...identity(),
      id: input.id,
      expectedRevision: 1,
      title: 'Projected',
      body: editBody,
    });
    expect(
      await harness.repository.getIssue(projectId, input.id),
    ).toMatchObject({ body: editBody, bodyText: 'Updated 🐛', revision: 2 });
    const commentId = nextId();
    await comments.create({
      ...identity(),
      id: commentId,
      issueId: input.id,
      body,
    });
    expect(await comments.get(projectId, input.id, commentId)).toMatchObject({
      body,
      bodyText: expected.text,
      bodyTextVersion: expected.version,
    });
    await comments.edit({
      ...identity(),
      id: commentId,
      issueId: input.id,
      expectedRevision: 1,
      body: editBody,
    });
    expect(await comments.get(projectId, input.id, commentId)).toMatchObject({
      bodyText: 'Updated 🐛',
      revision: 2,
    });
    const before = (
      await harness.query(
        'SELECT next_issue_number FROM projects WHERE id = ?',
        [projectId],
      )
    )[0];
    await expect(
      harness.repository.createIssue({
        ...input,
        ...identity(),
        id: nextId(),
        body: '['.repeat(33),
      }),
    ).rejects.toThrow();
    expect(
      (
        await harness.query(
          'SELECT next_issue_number FROM projects WHERE id = ?',
          [projectId],
        )
      )[0],
    ).toEqual(before);
    // Simulate legacy rows with no projection. Read paths return persisted
    // null; they never parse malformed/over-complex legacy bodies.
    await harness.query(
      'UPDATE issues SET body_text = NULL, body_text_version = NULL WHERE id = ?',
      [input.id],
    );
    expect(
      (await harness.repository.listIssues({ projectId })).items[0]!.bodyText,
    ).toBeNull();
    let cursor: string | undefined;
    let updated = 0;
    do {
      const page = await projections.backfill({
        projectId,
        resource: 'issues',
        limit: 1,
        ...(cursor ? { after: cursor } : {}),
      });
      expect(page.processed).toBeLessThanOrEqual(1);
      updated += page.updated;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(updated).toBeGreaterThanOrEqual(1);
    expect(
      await harness.repository.getIssue(projectId, input.id),
    ).toMatchObject({
      bodyText: 'Updated 🐛',
      bodyTextVersion: expected.version,
      revision: 2,
    });
    await harness.query(
      'UPDATE comments SET body_text = NULL, body_text_version = NULL WHERE id = ?',
      [commentId],
    );
    expect(
      await projections.backfill({
        projectId,
        resource: 'comments',
        limit: 100,
      }),
    ).toMatchObject({ updated: 1 });
    expect(
      await projections.backfill({
        projectId,
        resource: 'comments',
        limit: 100,
      }),
    ).toMatchObject({ updated: 0 });
    await expect(
      projections.backfill({ projectId, resource: 'issues', limit: 101 }),
    ).rejects.toThrow();
    await harness.query(
      'UPDATE issues SET body_text = NULL, body_text_version = NULL WHERE id = ?',
      [input.id],
    );
    await Promise.all([
      projections.backfill({ projectId, resource: 'issues' }),
      projections.backfill({ projectId, resource: 'issues' }),
      harness.repository.editIssue({
        ...identity(),
        id: input.id,
        expectedRevision: 2,
        title: 'Race',
        body: '**Newest**',
      }),
    ]);
    expect(
      await harness.repository.getIssue(projectId, input.id),
    ).toMatchObject({ body: '**Newest**', bodyText: 'Newest', revision: 3 });
    // Invalid legacy content is reported by ID and remains unprojected;
    // retry never invents text or publishes a partially computed artifact.
    const bad = { ...input, ...identity(), id: nextId() };
    await harness.repository.createIssue(bad);
    await harness.query(
      'UPDATE issues SET body = ?, body_text = NULL, body_text_version = NULL WHERE id = ?',
      ['['.repeat(33), bad.id],
    );
    expect(
      (await harness.repository.listIssues({ projectId })).items.find(
        (row) => row.id === bad.id,
      ),
    ).toMatchObject({ bodyText: null });
    expect(
      await projections.backfill({ projectId, resource: 'issues' }),
    ).toMatchObject({ rejectedIds: [bad.id], updated: 0 });

    // Derivations must never enter operational events, receipts or histories.
    for (const table of ['outbox', 'mutation_receipts', 'timeline_events']) {
      const data = JSON.stringify(
        await harness.query(`SELECT * FROM ${table} WHERE project_id = ?`, [
          projectId,
        ]),
      );
      expect(data).not.toMatch(
        /bodyTree|<script\b|<strong\b|hyperbug-content|hidden-script/i,
      );
    }
    expect(
      await harness.query(
        'SELECT body FROM comment_history WHERE comment_id = ? ORDER BY revision',
        [commentId],
      ),
    ).toEqual([{ body }, { body: editBody }]);
  });
}
