import { expect } from 'vitest';

interface CallOptions {
  method?: string;
  token?: string;
  body?: unknown;
  origin?: string | null;
  ifNoneMatch?: string;
}
interface ResponseLike {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}
interface Page {
  items: { id: string }[];
  nextCursor: string | null;
}
interface Detail {
  id: string;
  body: string;
  revision: number;
  bodyTree: unknown;
  contentPolicyVersion: string;
  representationEtag: string;
}

/** Actual API replacement against the same store; version-string mocks cannot pass. */
export async function contentPolicyUpgradeContract(options: {
  projectId: string;
  token: string;
  call(path: string, init?: CallOptions): Promise<ResponseLike>;
  upgrade(): Promise<void>;
}) {
  const { projectId, token, call, upgrade } = options;
  const createdIds = [];
  for (let index = 0; index < 2; index++) {
    const response = await call(`/api/v1/projects/${projectId}/issues`, {
      method: 'POST',
      token,
      body: {
        title: `Policy reload ${index}`,
        body: '~~removed markup~~ stays readable',
      },
    });
    expect(response.status).toBe(201);
    createdIds.push(((await response.json()) as Detail).id);
  }
  const first = (await (
    await call(`/api/v1/projects/${projectId}/issues?limit=1`, { origin: null })
  ).json()) as Page;
  expect(first.nextCursor).not.toBeNull();
  const cursorPath = `/api/v1/projects/${projectId}/issues?limit=1&cursor=${first.nextCursor}`;
  const second = (await (
    await call(cursorPath, { origin: null })
  ).json()) as Page;
  expect([first.items[0]!.id, second.items[0]!.id].sort()).toEqual(
    createdIds.sort(),
  );
  const id = second.items[0]!.id;
  const detailPath = `/api/v1/projects/${projectId}/issues/${id}`;
  const original = (await (
    await call(detailPath, { origin: null })
  ).json()) as Detail;
  expect(original.contentPolicyVersion).toBe('hyperbug-content-1');
  expect(JSON.stringify(original.bodyTree)).toContain('"tagName":"del"');
  await upgrade();
  const traversed = await call(cursorPath, { origin: null });
  expect(traversed.status).toBe(200);
  expect(traversed.headers.get('cache-control')).toBe('no-store');
  expect(await traversed.json()).toEqual(second);
  const freshResponse = await call(detailPath, {
    origin: null,
    ifNoneMatch: original.representationEtag,
  });
  expect(freshResponse.status).toBe(200);
  expect(freshResponse.headers.get('cache-control')).toBe('no-store');
  const fresh = (await freshResponse.json()) as Detail;
  expect(fresh.id).toBe(original.id);
  expect(fresh.body).toBe(original.body);
  expect(fresh.revision).toBe(original.revision);
  expect(fresh.contentPolicyVersion).toBe('hyperbug-content-test-2');
  expect(fresh.representationEtag).not.toBe(original.representationEtag);
  expect(freshResponse.headers.get('etag')).toBe(fresh.representationEtag);
  expect(fresh.bodyTree).not.toEqual(original.bodyTree);
  expect(JSON.stringify(fresh.bodyTree)).not.toContain('"tagName":"del"');
  expect(JSON.stringify(fresh.bodyTree)).toContain('removed markup');
}
