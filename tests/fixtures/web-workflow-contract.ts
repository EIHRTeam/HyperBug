import { expect } from 'vitest';
import { deriveMarkdownTree } from '../../packages/security/src/markdown/index.ts';
export async function webWorkflowContract(
  call: (
    path: string,
    input?: {
      method?: string;
      token?: string;
      body?: unknown;
      origin?: string | null;
    },
  ) => Promise<{
    status: number;
    json(): Promise<unknown>;
    headers: { get(name: string): string | null };
  }>,
  staff: string,
  author: string,
) {
  const projectResponse = await call('/api/v1/projects', {
    method: 'POST',
    token: staff,
    body: {
      slug: `workflow-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Workflow contract',
    },
  });
  expect(projectResponse.status).toBe(201);
  const project = (await projectResponse.json()) as { id: string };
  const path = `/api/v1/projects/${project.id}`;
  expect(
    (
      await call(`${path}/content/preview`, {
        method: 'POST',
        body: { body: 'hello' },
      })
    ).status,
  ).toBe(401);
  for (const body of [
    '# Heading\n\n**bold** and [link](https://example.com)',
    '<script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(1)">',
    '- [x] task\n\n| A | B |\n| - | - |\n| 1 | 2 |',
  ]) {
    const response = await call(`${path}/content/preview`, {
      method: 'POST',
      token: author,
      body: { body },
    });
    if (response.status !== 200)
      throw new Error(
        `Preview response ${response.status}: ${JSON.stringify(await response.json())}`,
      );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      bodyTree: deriveMarkdownTree(body),
      contentPolicyVersion: 'hyperbug-content-1',
    });
  }
  expect(
    (
      await call(`${path}/content/preview`, {
        method: 'POST',
        token: author,
        body: { body: '['.repeat(33) },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await call(`${path}/content/preview`, {
        method: 'POST',
        token: author,
        body: { body: 'x', html: true },
      })
    ).status,
  ).toBe(400);
  const formResponse = await call(`${path}/forms`, {
    method: 'POST',
    token: staff,
    body: {
      format: 'yaml',
      enabled: true,
      source:
        'name: Preview\ndescription: Preview form\ntitle: Preview issue\nbody:\n- type: input\n  id: summary\n  attributes:\n    label: Summary\n  validations:\n    required: true\n',
    },
  });
  expect(formResponse.status).toBe(201);
  const form = (await formResponse.json()) as { id: string; version: number };
  const formPreview = await call(`${path}/content/preview`, {
    method: 'POST',
    token: author,
    body: {
      formId: form.id,
      formVersion: form.version,
      values: { summary: 'Visible **answer**' },
    },
  });
  expect(formPreview.status).toBe(200);
  expect(JSON.stringify(await formPreview.json())).toContain('Visible');
  expect(
    (
      await call(`${path}/content/preview`, {
        method: 'POST',
        token: author,
        body: {
          formId: form.id,
          formVersion: 999,
          values: { summary: 'stale' },
        },
      })
    ).status,
  ).toBe(409);
  expect((await call(`${path}/audit`)).status).toBe(401);
  expect((await call(`${path}/audit`, { token: author })).status).toBe(403);
  await call(`${path}/labels`, {
    method: 'POST',
    token: staff,
    body: { name: 'Audit page' },
  });
  const first = await call(`${path}/audit?limit=1`, { token: staff });
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('no-store');
  const page = (await first.json()) as {
    items: Record<string, unknown>[];
    nextCursor: string;
  };
  expect(page.items).toHaveLength(1);
  expect(page.nextCursor).toBeTypeOf('string');
  expect(Object.keys(page.items[0]!).sort()).toEqual([
    'action',
    'actorId',
    'createdAt',
    'id',
    'projectId',
    'result',
    'systemActor',
    'targetId',
  ]);
  const next = await call(
    `${path}/audit?limit=1&after=${encodeURIComponent(page.nextCursor)}`,
    { token: staff },
  );
  expect(next.status).toBe(200);
  const second = (await next.json()) as {
    items: { id: string; projectId: string }[];
  };
  expect(second.items[0]!.id).not.toBe(page.items[0]!.id);
  expect(second.items[0]!.projectId).toBe(project.id);
  expect(
    (await call(`${path}/audit?after=invalid`, { token: staff })).status,
  ).toBe(400);
  expect((await call(`${path}/audit?limit=101`, { token: staff })).status).toBe(
    400,
  );
  expect(
    (await call(`${path}/audit?metadata=true`, { token: staff })).status,
  ).toBe(400);
  const other = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staff,
      body: {
        slug: `private-${crypto.randomUUID().slice(0, 8)}`,
        name: 'Private workflow',
        visibility: 'private',
      },
    })
  ).json()) as { id: string };
  expect(
    (
      await call(
        `/api/v1/projects/${other.id}/audit?after=${encodeURIComponent(page.nextCursor)}`,
        { token: staff },
      )
    ).status,
  ).toBe(400);
  expect((await call(`/api/v1/projects/${other.id}/audit`)).status).toBe(404);
  expect(
    (
      await call(`/api/v1/projects/${other.id}/content/preview`, {
        method: 'POST',
        token: author,
        body: { body: 'secret' },
      })
    ).status,
  ).toBe(404);
}
