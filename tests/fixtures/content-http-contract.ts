import { expect } from 'vitest';
import {
  contentPolicyVersion,
  deriveMarkdownTree,
  markdownRepresentationEtag,
} from '../../packages/security/src/markdown/index.ts';

export async function contentHttpContract(options: {
  projectId: string;
  token: string;
  call(
    path: string,
    init?: {
      method?: string;
      token?: string;
      body?: unknown;
      origin?: string | null;
    },
  ): Promise<{
    status: number;
    headers: { get(name: string): string | null };
    json(): Promise<unknown>;
  }>;
  query(
    sql: string,
    values: (string | number)[],
  ): Promise<Record<string, unknown>[]>;
}) {
  const { projectId, token, call, query } = options;
  const body =
    '# Safe\n\n**bold** <script>secret-script</script><svg><text>x</text></svg> ![private](https://tracker.example/pixel)';
  const created = await call(`/api/v1/projects/${projectId}/issues`, {
    method: 'POST',
    token,
    body: { title: 'Content policy acceptance', body },
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as {
    id: string;
    revision: number;
    body: string;
    bodyTree: unknown;
    contentPolicyVersion: string;
    representationEtag: string;
  };
  expect(issue.body).toBe(body);
  expect(issue.bodyTree).toEqual(deriveMarkdownTree(body));
  expect(issue.contentPolicyVersion).toBe(contentPolicyVersion);
  expect(issue.representationEtag).toBe(
    markdownRepresentationEtag(issue.id, 1, 'tree'),
  );
  expect(created.headers.get('etag')).toBe(issue.representationEtag);
  expect(JSON.stringify(issue.bodyTree)).not.toMatch(
    /secret-script|<script\b|"tagName":"svg"|"src":/i,
  );
  const path = `/api/v1/projects/${projectId}/issues/${issue.id}`;
  const concurrent = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const response = await call(path, { origin: null });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      return response.json();
    }),
  );
  expect(concurrent).toEqual(Array.from({ length: 5 }, () => issue));
  const stored = (
    await query(
      'SELECT body, body_text, body_text_version FROM issues WHERE id = ?',
      [issue.id],
    )
  )[0]!;
  expect(stored.body).toBe(body);
  expect(stored.body_text).not.toMatch(
    /secret-script|<script\b|bodyTree|tagName/i,
  );
  expect(stored.body_text_version).toBe('hyperbug-text-1');
  for (const table of ['outbox', 'mutation_receipts', 'timeline_events'])
    expect(
      JSON.stringify(
        await query(`SELECT * FROM ${table} WHERE project_id = ?`, [projectId]),
      ),
    ).not.toMatch(/bodyTree|secret-script|<script\b|hyperbug-content-/i);

  // A deliberate persisted projection sentinel proves list reads use the
  // stored text rather than parsing the canonical body again.
  await query('UPDATE issues SET body_text = ? WHERE id = ?', [
    'PRECOMPUTED SENTINEL',
    issue.id,
  ]);
  const listed = await call(`/api/v1/projects/${projectId}/issues?limit=100`, {
    origin: null,
  });
  expect(listed.status).toBe(200);
  const items = (
    (await listed.json()) as {
      items: {
        id: string;
        body: unknown;
        bodyTree?: unknown;
        preview: string;
      }[];
    }
  ).items;
  expect(
    items.every((item) => item.body === null && item.bodyTree === undefined),
  ).toBe(true);
  expect(items.find((item) => item.id === issue.id)!.preview).toBe(
    'PRECOMPUTED SENTINEL',
  );
  const first = await call(`/api/v1/projects/${projectId}/issues?limit=1`, {
    origin: null,
  });
  const page = (await first.json()) as {
    items: { id: string }[];
    nextCursor: string | null;
  };
  expect(page.nextCursor).not.toBeNull();
  // Representation versions are absent from the cursor and cannot move its
  // boundary. no-store responses always derive afresh, never answer a 304.
  const upgradedValidator = markdownRepresentationEtag(
    issue.id,
    1,
    'tree',
    'hyperbug-content-2',
  );
  expect(upgradedValidator).not.toBe(issue.representationEtag);
  const next = await call(
    `/api/v1/projects/${projectId}/issues?limit=1&cursor=${page.nextCursor}`,
    { origin: null },
  );
  expect(next.status).toBe(200);
  const nextItems = ((await next.json()) as { items: { id: string }[] }).items;
  expect(nextItems[0]!.id).not.toBe(page.items[0]!.id);
  await query('UPDATE issues SET moderation = ?, body = ? WHERE id = ?', [
    'hidden',
    '['.repeat(33),
    issue.id,
  ]);
  const hidden = await call(path, { origin: null });
  expect(hidden.status).toBe(404); // hidden malformed content is never derived
  const staffHidden = await call(path, { token });
  expect(staffHidden.status).toBe(200);
  const hiddenData = (await staffHidden.json()) as Record<string, unknown>;
  expect(hiddenData.bodyTree).toBeUndefined();
  expect(hiddenData.preview).toBeNull();
  const invalid = await call(`/api/v1/projects/${projectId}/issues`, {
    method: 'POST',
    token,
    body: { title: 'Too deep', body: '['.repeat(33) },
  });
  expect(invalid.status).toBe(400);
}
