import { expect } from 'vitest';
import type { CommentStore } from '@hyperbug/application';
import type { RepositoryHarness } from './repository-contract.ts';

export async function oneShotContract(
  h: RepositoryHarness,
  comments: CommentStore,
  measure: <T>(
    run: () => Promise<T>,
  ) => Promise<{ value: T; statements: string[] }>,
) {
  const projectId = crypto.randomUUID(),
    principalId = crypto.randomUUID(),
    now = Date.now();
  await h.query(
    "INSERT INTO projects (id,slug,name,created_at,updated_at) VALUES (?,?,'One shot',?,?)",
    [projectId, projectId, now, now],
  );
  await h.query(
    "INSERT INTO principals (id,kind,display_name,created_at) VALUES (?,'user','One shot',?)",
    [principalId, now],
  );
  const identity = (persistReceipt: boolean) => ({
    projectId,
    principalId,
    persistReceipt,
    mutationId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    keyHash: crypto.randomUUID().replaceAll('-', '').padEnd(64, '0'),
    payloadHash: 'a'.repeat(64),
    now,
    expiresAt: now + 86400000,
  });
  const issue = (persistReceipt: boolean) => ({
    ...identity(persistReceipt),
    id: crypto.randomUUID(),
    title: 'One shot',
    body: 'Body',
    labelIds: [],
    assigneeIds: [],
    typeId: null,
    milestoneId: null,
  });
  const keyed = issue(true),
    unkeyed = issue(false);
  const a = await measure(() => h.repository.createIssue(keyed)),
    b = await measure(() => h.repository.createIssue(unkeyed));
  expect(a.statements.length - b.statements.length).toBe(3);
  expect(b.statements.some((sql) => sql.includes('mutation_receipts'))).toBe(
    false,
  );
  expect((await h.repository.createIssue(keyed)).replayed).toBe(true);
  expect(b.value.result.revision).toBe(1);
  const c1 = {
      ...identity(true),
      id: crypto.randomUUID(),
      issueId: unkeyed.id,
      body: 'Comment',
    },
    c2 = {
      ...identity(false),
      id: crypto.randomUUID(),
      issueId: unkeyed.id,
      body: 'Comment',
    };
  const c = await measure(() => comments.create(c1)),
    d = await measure(() => comments.create(c2));
  expect(c.statements.length - d.statements.length).toBe(3);
  expect(d.statements.some((sql) => sql.includes('mutation_receipts'))).toBe(
    false,
  );
  expect((await comments.create(c1)).replayed).toBe(true);
  const edits = await Promise.allSettled([
    comments.edit({
      ...c2,
      ...identity(false),
      body: 'Edit A',
      expectedRevision: 1,
    }),
    comments.edit({
      ...c2,
      ...identity(false),
      body: 'Edit B',
      expectedRevision: 1,
    }),
  ]);
  expect(edits.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    String(
      (edits.find((r) => r.status === 'rejected') as PromiseRejectedResult)
        .reason,
    ),
  ).toContain('revision-conflict');
  const ie = (text: string) => ({
    ...unkeyed,
    ...identity(false),
    title: text,
    expectedRevision: 1,
  });
  const results = await Promise.allSettled([
    h.repository.editIssue(ie('Edit A')),
    h.repository.editIssue(ie('Edit B')),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(
    (results.find((r) => r.status === 'rejected') as PromiseRejectedResult)
      .reason,
  ).toMatchObject({ code: 'REVISION_CONFLICT' });
  expect(
    Number(
      (
        await h.query(
          'SELECT count(*) AS n FROM mutation_receipts WHERE project_id = ?',
          [projectId],
        )
      )[0]!.n,
    ),
  ).toBe(2);
}
