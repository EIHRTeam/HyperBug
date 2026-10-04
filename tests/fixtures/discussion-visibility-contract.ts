import { expect } from 'vitest';

type Call = (
  path: string,
  init?: {
    method?: string;
    token?: string;
    body?: unknown;
    origin?: string | null;
  },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface DiscussionVisibilityHarness {
  readonly call: Call;
  /** A public project where `staffToken` holds a moderating role. */
  readonly projectId: string;
  /** A User principal that authors the parent issue and its comment. */
  readonly authorToken: string;
  readonly staffToken: string;
  /** Direct storage mutation of the parent's moderation/deletion state. */
  hideIssue(issueId: string): Promise<void>;
  deleteIssue(issueId: string): Promise<void>;
}

/**
 * Shared both-profile matrix for PERF review 3.3: every issue sub-resource
 * (comment list/read/create/edit/delete/moderate/history, issue and comment
 * reactions and their counts, timeline) inherits the parent issue's
 * visibility, and comment-addressed routes reject a comment that belongs to
 * a different issue of the same project.
 */
export async function discussionVisibilityContract(
  h: DiscussionVisibilityHarness,
): Promise<void> {
  const { call, projectId, authorToken, staffToken } = h;
  const issues = `/api/v1/projects/${projectId}/issues`;
  const createIssue = async (title: string) => {
    const response = await call(issues, {
      method: 'POST',
      token: authorToken,
      body: { title, body: `${title} body` },
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const parentId = await createIssue('Parent visibility');
  const siblingId = await createIssue('Sibling visibility');
  const comment = await call(`${issues}/${parentId}/comments`, {
    method: 'POST',
    token: authorToken,
    body: { body: 'Parent comment' },
  });
  expect(comment.status).toBe(201);
  const commentId = ((await comment.json()) as { id: string }).id;
  const parent = `${issues}/${parentId}`;
  const commentPath = `${parent}/comments/${commentId}`;
  const sibling = `${issues}/${siblingId}/comments/${commentId}`;

  // A comment addressed through another issue of the same project is absent
  // for every audience, including moderators.
  for (const [path, init] of [
    [sibling, { token: staffToken }],
    [`${sibling}/history`, { token: staffToken }],
    [`${sibling}/reactions`, { token: staffToken }],
    [
      `${sibling}/reactions`,
      { method: 'POST', token: authorToken, body: { reaction: 'rocket' } },
    ],
    [
      `${sibling}/moderate`,
      { method: 'POST', token: staffToken, body: { moderation: 'hidden' } },
    ],
  ] as const)
    expect(
      (await call(path, init)).status,
      `${init.method ?? 'GET'} ${path}`,
    ).toBe(404);

  await h.hideIssue(parentId);
  const hiddenFor = async (label: string, token?: string) => {
    const auth = token === undefined ? { origin: null } : { token };
    const writes =
      token === undefined
        ? []
        : ([
            [`${parent}/comments`, { method: 'POST', body: { body: 'Late' } }],
            [
              commentPath,
              {
                method: 'PATCH',
                body: { expectedRevision: 1, body: 'Edited' },
              },
            ],
            [commentPath, { method: 'DELETE', body: {} }],
            [
              `${parent}/reactions`,
              { method: 'POST', body: { reaction: 'rocket' } },
            ],
            [
              `${commentPath}/reactions`,
              { method: 'POST', body: { reaction: 'rocket' } },
            ],
            [`${parent}/reactions/rocket`, { method: 'DELETE', body: {} }],
          ] as const);
    for (const path of [
      `${parent}/comments`,
      commentPath,
      `${parent}/reactions`,
      `${commentPath}/reactions`,
      `${parent}/timeline`,
    ])
      expect((await call(path, auth)).status, `${label} GET ${path}`).toBe(404);
    for (const [path, init] of writes)
      expect(
        (await call(path, { ...init, ...auth })).status,
        `${label} ${init.method} ${path}`,
      ).toBe(404);
  };
  await hiddenFor('anonymous');
  await hiddenFor('author', authorToken);

  // Moderators keep reaching the hidden parent's sub-resources.
  const staffComments = await call(`${parent}/comments`, { token: staffToken });
  expect(staffComments.status).toBe(200);
  expect(
    (
      (await staffComments.json()) as { comments: { id: string }[] }
    ).comments.map((item) => item.id),
  ).toEqual([commentId]);
  for (const path of [
    commentPath,
    `${commentPath}/history`,
    `${parent}/reactions`,
    `${commentPath}/reactions`,
    `${parent}/timeline`,
  ])
    expect((await call(path, { token: staffToken })).status, path).toBe(200);

  // A deleted parent is absent for everyone, moderators included.
  await h.deleteIssue(parentId);
  for (const path of [
    `${parent}/comments`,
    commentPath,
    `${commentPath}/history`,
    `${parent}/reactions`,
    `${parent}/timeline`,
  ])
    expect((await call(path, { token: staffToken })).status, path).toBe(404);
  expect(
    (
      await call(`${parent}/comments`, {
        method: 'POST',
        token: staffToken,
        body: { body: 'After deletion' },
      })
    ).status,
  ).toBe(404);
}
