import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, createApiClient } from '@hyperbug/api-client';

const projectId = '10000000-0000-4000-8000-000000000001';
const issueId = '10000000-0000-4000-8000-000000000002';
const baseUrl = 'https://api.example.com';
const document = { id: issueId, revision: 1 };
const json = (body: unknown, status = 200) => Response.json(body, { status });
describe('public API client transport invariants', () => {
  it('omits cookies, uses a fresh bearer, encodes query and freezes the submitted payload', async () => {
    let token = 'at_one.secret';
    const seen: RequestInit[] = [];
    const urls: string[] = [];
    const fetcher: typeof fetch = async (url, init) => {
      urls.push(String(url));
      seen.push(init!);
      return json(document);
    };
    const client = createApiClient({
      baseUrl,
      getToken: () => token,
      fetch: fetcher,
    });
    await client.request('GET /api/v1/projects/{projectId}/issues', {
      params: { projectId },
      query: { limit: 2 },
    });
    token = 'at_two.secret';
    await client.request('POST /api/v1/projects/{projectId}/issues', {
      params: { projectId },
      body: { title: 'new', body: 'safe' },
    });
    expect(urls[0]).toBe(
      `${baseUrl}/api/v1/projects/${projectId}/issues?limit=2`,
    );
    expect(seen.map((init) => init.credentials)).toEqual(['omit', 'omit']);
    expect(
      seen.map((init) => new Headers(init.headers).get('authorization')),
    ).toEqual(['Bearer at_one.secret', 'Bearer at_two.secret']);
    expect(seen[1]?.body).toBe('{"title":"new","body":"safe"}');
    expect(seen[1]?.redirect).toBe('error');
    expect(new Headers(seen[0]?.headers).get('content-type')).toBeNull();
  });
  it('never retries an unkeyed issue or an unsupported mutation after ambiguous network failure', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error('private provider message');
    });
    const client = createApiClient({ baseUrl, fetch: fetcher });
    await expect(
      client.request('POST /api/v1/projects/{projectId}/issues', {
        params: { projectId },
        body: { title: 'new', body: 'safe' },
        retryMutation: true,
      }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', ambiguous: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(
      client.request('POST /api/v1/projects', {
        body: { slug: 'new', name: 'new' },
        idempotencyKey: '1234567890123456',
        retryMutation: true,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_IDEMPOTENCY_KEY' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('replays only an opted-in documented receipt with identical body/key and bounded attempts', async () => {
    const seen: RequestInit[] = [];
    const fetcher: typeof fetch = async (_, init) => {
      seen.push(init!);
      if (seen.length < 3) throw new Error('lost response');
      return json(document, 201);
    };
    const client = createApiClient({ baseUrl, fetch: fetcher });
    await client.request('POST /api/v1/projects/{projectId}/issues', {
      params: { projectId },
      body: { title: 'new', body: 'safe' },
      idempotencyKey: '1234567890123456',
      retryMutation: true,
    });
    expect(seen).toHaveLength(3);
    expect(new Set(seen.map((init) => init.body)).size).toBe(1);
    expect(
      seen.map((init) => new Headers(init.headers).get('idempotency-key')),
    ).toEqual(Array(3).fill('1234567890123456'));
  });
  it('bounds safe-read retry and refuses a long Retry-After without retrying early', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(null, {
          status: 503,
          headers: { 'retry-after': '86400' },
        }),
    );
    const client = createApiClient({ baseUrl, fetch: fetcher });
    await expect(client.request('GET /api/v1/instance')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockImplementation(async () => json({}, 503));
    await expect(client.request('GET /api/v1/instance')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('never exposes raw exception, URL, token or provider messages', async () => {
    const client = createApiClient({
      baseUrl,
      fetch: async () =>
        json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'private SQL token at_one.secret',
              requestId: issueId,
            },
          },
          403,
        ),
    });
    let error: unknown;
    try {
      await client.request('GET /api/v1/account');
    } catch (cause) {
      error = cause;
    }
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
      requestId: issueId,
    });
    expect(String(error)).not.toMatch(/private|SQL|secret|example/);
    expect(JSON.stringify(error)).not.toMatch(/private|SQL|secret|example/);
  });
  it('cancels before sending, cancels retry sleep and times out stalled fetch/body/token work', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>(async () => json({}));
    const client = createApiClient({ baseUrl, fetch: fetcher });
    await expect(
      client.request('GET /api/v1/instance', { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(fetcher).not.toHaveBeenCalled();
    const stalled = createApiClient({
      baseUrl,
      timeoutMs: 10,
      fetch: async () => new Promise(() => {}),
    });
    await expect(stalled.request('GET /api/v1/instance')).rejects.toMatchObject(
      { code: 'TIMEOUT' },
    );
    const stalledToken = createApiClient({
      baseUrl,
      timeoutMs: 10,
      fetch: fetcher,
      getToken: () => new Promise(() => {}),
    });
    await expect(
      stalledToken.request('GET /api/v1/account'),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    const stalledBody = createApiClient({
      baseUrl,
      timeoutMs: 10,
      fetch: async () =>
        new Response(new ReadableStream({ start() {} }), {
          headers: { 'content-type': 'application/json' },
        }),
    });
    await expect(
      stalledBody.request('GET /api/v1/instance'),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    const retryController = new AbortController();
    const failing = createApiClient({
      baseUrl,
      fetch: async () => {
        queueMicrotask(() => retryController.abort());
        throw new Error('private');
      },
    });
    await expect(
      failing.request('GET /api/v1/instance', {
        signal: retryController.signal,
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });
  it('rejects redirects, oversized/non-JSON responses and unsafe base URLs', async () => {
    expect(() =>
      createApiClient({ baseUrl: 'https://name:private@example.com' }),
    ).toThrow(ApiClientError);
    expect(() => createApiClient({ baseUrl: 'http://example.com' })).toThrow(
      ApiClientError,
    );
    const oversized = createApiClient({
      baseUrl,
      maxResponseBytes: 1024,
      fetch: async () => json({ text: 'x'.repeat(2048) }),
    });
    await expect(
      oversized.request('GET /api/v1/instance'),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    const html = createApiClient({
      baseUrl,
      fetch: async () => new Response('<html>private</html>'),
    });
    await expect(html.request('GET /api/v1/instance')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it('returns no body for 204 and form-encodes the token protocol without a bearer', async () => {
    const seen: RequestInit[] = [];
    const client = createApiClient({
      baseUrl,
      getToken: () => 'at_one.secret',
      fetch: async (_, init) => {
        seen.push(init!);
        return new Response(null, { status: 204 });
      },
    });
    expect(
      await client.request(
        'DELETE /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}',
        { params: { projectId, issueId, commentId: issueId }, body: {} },
      ),
    ).toBeUndefined();
    await client.request('POST /auth/token/revoke', {
      body: { token: 'at_one.secret' },
    });
    expect(new Headers(seen[1]?.headers).get('authorization')).toBeNull();
    expect(new Headers(seen[1]?.headers).get('content-type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(seen[1]?.body).toBe('token=at_one.secret');
  });
});
