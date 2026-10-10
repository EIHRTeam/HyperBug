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

type Request = readonly [
  path: string,
  init: { method?: string; body?: unknown },
];

export interface DiscussionVisibilityHarness {
  readonly call: Call;
  /** A public project where `staffToken` holds a moderating role. */
  readonly projectId: string;
  /** A User principal that authors the parent issue and its comments. */
  readonly authorToken: string;
  /** A second User principal with no role and no authored content. */
  readonly outsiderToken: string;
  readonly staffToken: string;
  /** Direct storage mutation of the parent's moderation/deletion state. */
  hideIssue(issueId: string): Promise<void>;
  deleteIssue(issueId: string): Promise<void>;
}

/**
 * Shared both-profile matrix for PERF review 3.3: every issue sub-resource
 * (comment list/read/create/edit/delete/moderate/history, issue and comment
 * reactions and their counts, timeline) inherits the parent issue's
 * visibility; comment-addressed routes reject a comment that belongs to a
 * different issue of the same project; and a moderated comment is
 * indistinguishable from a missing one for callers who cannot see it.
 */
export async function discussionVisibilityContract(
  h: DiscussionVisibilityHarness,
): Promise<void> {
  const { call, projectId, authorToken, outsiderToken, staffToken } = h;
  const issues = `/api/v1/projects/${projectId}/issues`;
  const created = async (path: string, body: unknown) => {
    const response = await call(path, {
      method: 'POST',
      token: authorToken,
      body,
    });
    expect(response.status, `POST ${path}`).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const expectStatus = async (
    label: string,
    token: string | undefined,
    requests: readonly Request[],
    status: number,
  ) => {
    for (const [path, init] of requests)
      expect(
        (
          await call(path, {
            ...init,
            ...(token === undefined ? { origin: null } : { token }),
          })
        ).status,
        `${label} ${init.method ?? 'GET'} ${path}`,
      ).toBe(status);
  };
  const parentId = await created(issues, {
    title: 'Parent visibility',
    body: 'Parent body',
  });
  const siblingId = await created(issues, {
    title: 'Sibling visibility',
    body: 'Sibling body',
  });
  const parent = `${issues}/${parentId}`;
  const commentId = await created(`${parent}/comments`, {
    body: 'Parent comment',
  });
  const moderatedId = await created(`${parent}/comments`, {
    body: 'Moderated comment',
  });
  const commentPath = `${parent}/comments/${commentId}`;
  const moderatedPath = `${parent}/comments/${moderatedId}`;
  const sibling = `${issues}/${siblingId}/comments/${commentId}`;
  const react = { method: 'POST', body: { reaction: 'rocket' } } as const;
  const unreact = { method: 'DELETE', body: {} } as const;

  // A comment addressed through another issue of the same project is absent
  // for every audience, including moderators.
  const crossIssue: Request[] = [
    [sibling, {}],
    [sibling, { method: 'PATCH', body: { expectedRevision: 1, body: 'X' } }],
    [sibling, { method: 'DELETE', body: {} }],
    [`${sibling}/history`, {}],
    [`${sibling}/reactions`, {}],
    [`${sibling}/reactions`, react],
    [`${sibling}/reactions/rocket`, unreact],
    [`${sibling}/moderate`, { method: 'POST', body: { moderation: 'hidden' } }],
  ];
  await expectStatus('moderator', staffToken, crossIssue, 404);
  await expectStatus('author', authorToken, crossIssue, 404);

  // A moderated comment on a visible issue exists only for moderators and
  // its author; others cannot tell it apart from a missing comment.
  expect(
    (
      await call(`${moderatedPath}/moderate`, {
        method: 'POST',
        token: staffToken,
        body: { moderation: 'hidden' },
      })
    ).status,
  ).toBe(200);
  const moderatedRequests: Request[] = [
    [moderatedPath, {}],
    [
      moderatedPath,
      { method: 'PATCH', body: { expectedRevision: 1, body: 'Edited' } },
    ],
    [moderatedPath, { method: 'DELETE', body: {} }],
    [`${moderatedPath}/reactions`, {}],
    [`${moderatedPath}/reactions`, react],
  ];
  await expectStatus('outsider', outsiderToken, moderatedRequests, 404);
  await expectStatus(
    'anonymous',
    undefined,
    moderatedRequests.slice(0, 1),
    404,
  );
  await expectStatus(
    'author',
    authorToken,
    [
      [
        moderatedPath,
        { method: 'PATCH', body: { expectedRevision: 1, body: 'Edited' } },
      ],
    ],
    403,
  );
  await expectStatus('moderator', staffToken, [[moderatedPath, {}]], 200);

  await h.hideIssue(parentId);
  const reads: Request[] = [
    [`${parent}/comments`, {}],
    [commentPath, {}],
    [`${parent}/reactions`, {}],
    [`${commentPath}/reactions`, {}],
    [`${parent}/timeline`, {}],
  ];
  const writes: Request[] = [
    [`${parent}/comments`, { method: 'POST', body: { body: 'Late' } }],
    [
      commentPath,
      { method: 'PATCH', body: { expectedRevision: 1, body: 'Edited' } },
    ],
    [commentPath, { method: 'DELETE', body: {} }],
    [`${parent}/reactions`, react],
    [`${commentPath}/reactions`, react],
    [`${parent}/reactions/rocket`, unreact],
    [`${commentPath}/reactions/rocket`, unreact],
    [`${commentPath}/history`, {}],
    [
      `${commentPath}/moderate`,
      { method: 'POST', body: { moderation: 'hidden' } },
    ],
  ];
  await expectStatus('anonymous', undefined, reads, 404);
  await expectStatus('anonymous', undefined, writes.slice(0, 7), 401);
  await expectStatus('author', authorToken, [...reads, ...writes], 404);
  await expectStatus('outsider', outsiderToken, [...reads, ...writes], 404);

  // Moderators keep reading and writing the hidden parent's sub-resources.
  const staffComments = await call(`${parent}/comments`, { token: staffToken });
  expect(staffComments.status).toBe(200);
  expect(
    (
      (await staffComments.json()) as { comments: { id: string }[] }
    ).comments.map((item) => item.id),
  ).toEqual([commentId, moderatedId]);
  await expectStatus(
    'moderator',
    staffToken,
    [...reads, [`${commentPath}/history`, {}]],
    200,
  );
  await expectStatus(
    'moderator',
    staffToken,
    [[`${parent}/comments`, { method: 'POST', body: { body: 'Staff note' } }]],
    201,
  );
  for (const path of [`${parent}/reactions`, `${commentPath}/reactions`]) {
    const response = await call(path, { ...react, token: staffToken });
    expect(response.status, `moderator POST ${path}`).toBeLessThan(300);
  }

  // A deleted parent is absent for everyone, moderators included.
  await h.deleteIssue(parentId);
  await expectStatus('moderator', staffToken, [...reads, ...writes], 404);
  await expectStatus('author', authorToken, [...reads, ...writes], 404);
}
