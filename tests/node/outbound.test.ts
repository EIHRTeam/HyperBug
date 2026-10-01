import { expect, it } from 'vitest';
import { createNodeOutboundFetcher } from '../../apps/api-node/src/outbound.ts';

const limits = {
  destinations: [
    {
      id: 'provider',
      origin: 'https://api.example.org',
      operations: [
        { method: 'GET' as const, path: '/' },
        { method: 'GET' as const, path: '/v1/check' },
      ],
    },
  ],
  maxConcurrent: 2,
  timeoutMs: 500,
  maxRequestBytes: 64,
  maxResponseBytes: 1024,
};

it('rejects private, mixed and malformed DNS answers before a Node HTTPS connection', async () => {
  const answers = [
    [{ address: '127.0.0.1', family: 4 }],
    [
      { address: '1.1.1.1', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ],
    [{ address: '::ffff:192.168.1.1', family: 6 }],
    [{ address: '2001:db8::1', family: 6 }],
    [{ address: 'not-an-ip', family: 4 }],
    [],
    Array.from({ length: 33 }, () => ({ address: '1.1.1.1', family: 4 })),
  ];
  for (const records of answers) {
    const seen: string[] = [];
    const outbound = createNodeOutboundFetcher(limits, async (hostname) => {
      seen.push(hostname);
      return records;
    });
    await expect(
      outbound({ destination: 'provider', path: '/v1/check' }),
    ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
    expect(seen).toEqual(['api.example.org']);
  }
});

it('denies resolver failures without leaking their text or retrying a different host', async () => {
  let calls = 0;
  const outbound = createNodeOutboundFetcher(limits, async () => {
    calls++;
    throw new Error('private resolver credential and address');
  });
  await expect(
    outbound({ destination: 'provider', path: '/v1/check' }),
  ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect(calls).toBe(1);
  const poisoned = Object.defineProperty({ family: 4 }, 'address', {
    get() {
      throw new Error('private resolver state');
    },
  }) as { address: string; family: number };
  const malformed = createNodeOutboundFetcher(limits, async () => [poisoned]);
  await expect(
    malformed({ destination: 'provider', path: '/v1/check' }),
  ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
});

it('releases a Node transport slot after aborting a stalled DNS lookup', async () => {
  let lookups = 0;
  const outbound = createNodeOutboundFetcher(
    { ...limits, maxConcurrent: 1, timeoutMs: 50 },
    async () => {
      lookups++;
      if (lookups === 1) return new Promise(() => undefined);
      return [{ address: '127.0.0.1', family: 4 }];
    },
  );
  await expect(
    outbound({ destination: 'provider', path: '/' }),
  ).rejects.toMatchObject({ code: 'TIMEOUT' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await expect(
    outbound({ destination: 'provider', path: '/' }),
  ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  expect(lookups).toBe(2);
});
