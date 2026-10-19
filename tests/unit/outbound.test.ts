import { describe, expect, it } from 'vitest';
import {
  createOutboundFetcher,
  OutboundFailure,
  type OutboundLimits,
} from '../../packages/security/src/outbound.ts';

const limits: OutboundLimits = {
  destinations: [
    {
      id: 'provider',
      origin: 'https://api.example.org',
      operations: [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/v1/check?kind=ok' },
        { method: 'POST', path: '/v1/submit' },
      ],
    },
  ],
  maxConcurrent: 1,
  timeoutMs: 200,
  maxRequestBytes: 16,
  maxResponseBytes: 8,
};
const unusedTransport = (async () => new Response('ok')) as typeof fetch;

function failure(code: string) {
  return { code };
}

describe('bounded outbound fetch', () => {
  it('rejects unsafe or ambiguous destination policy before dispatch', () => {
    for (const origin of [
      'http://api.example.org',
      'https://127.0.0.1',
      'https://[::1]',
      'https://localhost',
      'https://metadata.local',
      'https://api.example.org/path',
      'https://user:pass@api.example.org',
      'https://api.example.org:443',
    ])
      expect(() =>
        createOutboundFetcher(
          {
            ...limits,
            destinations: [
              {
                id: 'provider',
                origin,
                operations: limits.destinations[0]!.operations,
              },
            ],
          },
          unusedTransport,
        ),
      ).toThrowError(OutboundFailure);
    expect(() =>
      createOutboundFetcher({ ...limits, maxConcurrent: 0 }, unusedTransport),
    ).toThrowError(OutboundFailure);
    expect(() =>
      createOutboundFetcher(limits, undefined as unknown as typeof fetch),
    ).toThrowError(OutboundFailure);
    for (const operations of [
      [],
      [{ method: 'GET', path: '/safe/../admin' }],
      [{ method: 'GET', path: '/safe%2fadmin' }],
      [{ method: 'GET', path: '/safe#fragment' }],
      [{ method: 'DELETE', path: '/' }],
      [
        { method: 'GET', path: '/' },
        { method: 'GET', path: '/' },
      ],
    ])
      expect(() =>
        createOutboundFetcher(
          {
            ...limits,
            destinations: [
              {
                id: 'provider',
                origin: 'https://api.example.org',
                operations,
              },
            ],
          } as OutboundLimits,
          unusedTransport,
        ),
      ).toThrowError(OutboundFailure);
  });

  it('permits only a catalogued HTTPS origin and bounded path/headers/body', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const transport = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response('ok');
    }) as typeof fetch;
    const outbound = createOutboundFetcher(limits, transport);
    for (const path of [
      '//metadata.local/latest',
      '/\\metadata.local',
      '/safe#fragment',
      'https://api.example.org/safe',
      '/v1/check',
      '/v1/check?kind=other',
      '/v1/check?kind=ok&extra=1',
      '/v1/check/../submit',
    ])
      await expect(
        outbound({ destination: 'provider', path }),
      ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    await expect(
      outbound({ destination: 'other', path: '/' }),
    ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    await expect(
      outbound({
        destination: 'provider',
        path: '/',
        headers: { host: 'metadata.local' },
      }),
    ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    await expect(
      outbound({
        destination: 'provider',
        path: '/v1/submit',
        method: 'POST',
        body: new Uint8Array(17),
      }),
    ).rejects.toMatchObject(failure('REQUEST_TOO_LARGE'));
    await expect(
      outbound({ destination: 'provider', path: '/', method: 'POST' }),
    ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    await expect(
      outbound({ destination: 'provider', path: '/v1/submit' }),
    ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    expect(calls).toHaveLength(0);

    const result = await outbound({
      destination: 'provider',
      path: '/v1/check?kind=ok',
      headers: { accept: 'text/plain' },
    });
    expect(result.status).toBe(200);
    expect(new TextDecoder().decode(result.body)).toBe('ok');
    expect(calls).toEqual([
      {
        url: 'https://api.example.org/v1/check?kind=ok',
        init: expect.objectContaining({
          method: 'GET',
          cache: 'no-store',
          redirect: 'manual',
          signal: expect.any(AbortSignal),
        }),
      },
    ]);
    await outbound({
      destination: 'provider',
      path: '/v1/submit',
      method: 'POST',
      body: new Uint8Array([1]),
    });
    expect(calls[1]).toMatchObject({
      url: 'https://api.example.org/v1/submit',
      init: { method: 'POST' },
    });
  });

  it('captures reviewed limits and destinations before later caller mutation', async () => {
    const operations: Array<{ method: 'GET' | 'POST'; path: string }> = [
      { method: 'GET', path: '/' },
    ];
    const mutable = {
      ...limits,
      destinations: [
        {
          id: 'provider',
          origin: 'https://api.example.org',
          operations,
        },
      ],
    };
    const calls: string[] = [];
    const outbound = createOutboundFetcher(mutable, (async (
      url: RequestInfo | URL,
    ) => {
      calls.push(String(url));
      return new Response(new Uint8Array(9));
    }) as typeof fetch);
    mutable.destinations[0]!.origin = 'https://metadata.example.org';
    mutable.destinations[0]!.operations[0]!.path = '/changed';
    mutable.destinations[0]!.operations.push({ method: 'POST', path: '/' });
    mutable.maxResponseBytes = 1000;
    await expect(
      outbound({ destination: 'provider', path: '/changed' }),
    ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    await expect(
      outbound({ destination: 'provider', path: '/', method: 'POST' }),
    ).rejects.toMatchObject(failure('DESTINATION_FORBIDDEN'));
    await expect(
      outbound({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('RESPONSE_TOO_LARGE'));
    expect(calls).toEqual(['https://api.example.org/']);
  });

  it('does not follow redirects or accept oversized or failed provider responses', async () => {
    const redirect = createOutboundFetcher(
      limits,
      (async () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://metadata.local/' },
        })) as typeof fetch,
    );
    await expect(
      redirect({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('UPSTREAM_REJECTED'));

    const declared = createOutboundFetcher(
      limits,
      (async () =>
        new Response('x', {
          headers: { 'content-length': '999' },
        })) as typeof fetch,
    );
    await expect(
      declared({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('RESPONSE_TOO_LARGE'));

    const streamed = createOutboundFetcher(
      limits,
      (async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(6));
              controller.enqueue(new Uint8Array(6));
              controller.close();
            },
          }),
        )) as typeof fetch,
    );
    await expect(
      streamed({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('RESPONSE_TOO_LARGE'));

    const failed = createOutboundFetcher(limits, (async () => {
      throw new Error('secret provider failure');
    }) as typeof fetch);
    await expect(
      failed({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('UNAVAILABLE'));
  });

  it('snapshots each streamed chunk before the transport reuses its buffer', async () => {
    const reused = new Uint8Array([97, 98, 99]);
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++;
          if (pulls === 1) controller.enqueue(reused);
          else if (pulls === 2) {
            reused.set([120, 121, 122]);
            controller.enqueue(new Uint8Array([100]));
          } else controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const outbound = createOutboundFetcher(
      limits,
      (async () => new Response(stream)) as typeof fetch,
    );
    const result = await outbound({ destination: 'provider', path: '/' });
    expect(new TextDecoder().decode(result.body)).toBe('abcd');
  });

  it('bounds concurrency and aborts a stalled request without leaking provider errors', async () => {
    let release!: (response: Response) => void;
    const transport = (async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      })) as typeof fetch;
    const outbound = createOutboundFetcher(limits, transport);
    const first = outbound({ destination: 'provider', path: '/' });
    await expect(
      outbound({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('OVERLOADED'));
    release(new Response('ok'));
    await first;
    await expect(
      outbound({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('TIMEOUT'));
    await expect(
      outbound({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('OVERLOADED'));
    release(new Response('late'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const afterCleanup = outbound({ destination: 'provider', path: '/' });
    release(new Response('ok'));
    await expect(afterCleanup).resolves.toMatchObject({ status: 200 });
  });

  it('denies caller cancellation promptly while retaining the transport slot until cleanup', async () => {
    let release!: (response: Response) => void;
    const transport = (async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      })) as typeof fetch;
    const outbound = createOutboundFetcher(
      { ...limits, timeoutMs: 1000 },
      transport,
    );
    const controller = new AbortController();
    const pending = outbound({
      destination: 'provider',
      path: '/',
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject(failure('UNAVAILABLE'));
    await expect(
      outbound({ destination: 'provider', path: '/' }),
    ).rejects.toMatchObject(failure('OVERLOADED'));
    release(new Response('late'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const next = outbound({ destination: 'provider', path: '/' });
    release(new Response('ok'));
    await expect(next).resolves.toMatchObject({ status: 200 });
  });
});
