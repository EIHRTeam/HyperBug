import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import {
  BrowserAuth,
  redirectAttemptKey,
  safeReturnRoute,
  takeCallback,
} from '../../apps/web/src/auth.ts';

const config = {
  schemaVersion: 1 as const,
  applicationName: 'Test',
  apiBaseUrl: 'https://api.example.net',
  authBaseUrl: 'https://auth.example.org',
  mediaOrigins: [],
};
const token = 'at_fixture.secret';
let storage: Map<string, string>;
let address: {
  origin: string;
  pathname: string;
  search: string;
  assign: ReturnType<typeof vi.fn>;
};
let requests: Array<{ url: string; init: RequestInit }>;
let status: number;
type QueryCache = ConstructorParameters<typeof BrowserAuth>[1];
const { QueryClient } = createRequire(
  new URL('../../apps/web/package.json', import.meta.url),
)('@tanstack/react-query') as { QueryClient: new () => QueryCache };
let queries: QueryCache;

beforeEach(() => {
  vi.useFakeTimers();
  storage = new Map();
  address = {
    origin: 'https://client.example.com',
    pathname: '/account',
    search: '',
    assign: vi.fn(),
  };
  vi.stubGlobal('location', address);
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal('history', {
    replaceState: (_state: unknown, _title: string, path: string) => {
      const url = new URL(path, address.origin);
      address.pathname = url.pathname;
      address.search = url.search;
    },
  });
  vi.stubGlobal('document', new EventTarget());
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('BroadcastChannel', undefined);
  requests = [];
  status = 200;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      requests.push({ url: url.href, init });
      return new Response(
        url.pathname === '/auth/token/revoke'
          ? null
          : JSON.stringify(
              url.pathname === '/auth/token'
                ? {
                    accessToken: token,
                    tokenType: 'Bearer',
                    expiresIn: 600,
                    scope: 'public-api',
                  }
                : status === 200
                  ? {
                      principalId: 'principal-a',
                      identityId: 'identity-a',
                      kind: 'user',
                    }
                  : { error: { code: 'PERMISSION_DENIED' } },
            ),
        {
          status: url.pathname === '/auth/token/revoke' ? 204 : status,
          headers: { 'content-type': 'application/json' },
        },
      );
    }),
  );
  queries = new QueryClient();
});
afterEach(() => {
  queries.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function attempt(auth: BrowserAuth) {
  await auth.signIn('/instance?section=limits');
  const url = new URL(address.assign.mock.calls.at(-1)![0]);
  address.pathname = '/oauth/callback';
  address.search = new URLSearchParams({
    code: 'code.value',
    state: url.searchParams.get('state')!,
  }).toString();
  return { url, callback: takeCallback()! };
}

it('uses fresh S256, consumes bound transient state once and strips callback URLs before network access', async () => {
  const auth = new BrowserAuth(config, queries);
  const first = await attempt(auth);
  const original = JSON.parse(storage.get(redirectAttemptKey)!);
  expect(first.url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(first.url.searchParams.get('code_challenge')).not.toBe(
    original.verifier,
  );
  expect(original.state).toHaveLength(43);
  expect(address.search).toBe('');
  await auth.completeCallback(first.callback);
  expect(auth.getSnapshot().account?.principalId).toBe('principal-a');
  expect(storage.size).toBe(0);
  expect(JSON.stringify(auth.getSnapshot())).not.toContain(token);
  expect(
    requests.every(
      ({ init, url }) =>
        init.credentials === 'omit' &&
        init.cache === 'no-store' &&
        !url.includes(token),
    ),
  ).toBe(true);
  expect(address.pathname + address.search).toBe('/instance?section=limits');
  const count = requests.length;
  await auth.completeCallback(first.callback);
  expect(requests).toHaveLength(count);
  expect(auth.getSnapshot().account).toBeNull();
  const second = await attempt(auth);
  expect(second.url.searchParams.get('state')).not.toBe(original.state);
  expect(JSON.parse(storage.get(redirectAttemptKey)!).verifier).not.toBe(
    original.verifier,
  );
  await auth.signOut();
});

it('denies mismatched, expired and duplicated state and cross-origin return targets without exchange', async () => {
  expect(safeReturnRoute('//evil.example/account')).toBe('/account');
  expect(safeReturnRoute('/account?token=secret')).toBe('/account');
  const auth = new BrowserAuth(config, queries);
  for (const invalid of ['mismatch', 'expired', 'duplicate', 'origin']) {
    const { callback } = await attempt(auth);
    if (invalid === 'mismatch') callback.set('state', 'wrong');
    if (invalid === 'duplicate')
      callback.append('state', callback.get('state')!);
    if (invalid === 'expired') vi.setSystemTime(Date.now() + 300001);
    if (invalid === 'origin') {
      const data = JSON.parse(storage.get(redirectAttemptKey)!);
      data.authOrigin = 'https://other.example';
      storage.set(redirectAttemptKey, JSON.stringify(data));
    }
    await auth.completeCallback(callback);
    expect(auth.getSnapshot().account).toBeNull();
    expect(storage.size).toBe(0);
  }
  expect(requests).toHaveLength(0);
});

it('clears private query/mutation state on expiry, permission loss and logout, and revokes only the captured memory token', async () => {
  const auth = new BrowserAuth(config, queries);
  const seedPrivate = () => {
    queries.setQueryData(['private', 'principal-a'], { draft: 'private' });
    queries
      .getMutationCache()
      .build(
        queries,
        { mutationKey: ['private-edit'], mutationFn: async () => 'private' },
        {
          status: 'success',
          data: 'private',
          error: null,
          failureCount: 0,
          failureReason: null,
          isPaused: false,
          variables: undefined,
          context: undefined,
          submittedAt: Date.now(),
        },
      );
  };
  let { callback } = await attempt(auth);
  await auth.completeCallback(callback);
  seedPrivate();
  const epoch = auth.getSnapshot().epoch;
  await vi.advanceTimersByTimeAsync(600000);
  expect(auth.getSnapshot().epoch).toBeGreaterThan(epoch);
  expect(queries.getQueryCache().getAll()).toHaveLength(0);
  expect(queries.getMutationCache().getAll()).toHaveLength(0);
  ({ callback } = await attempt(auth));
  await auth.completeCallback(callback);
  seedPrivate();
  status = 403;
  await expect(auth.request('GET /api/v1/account')).rejects.toThrow();
  expect(auth.getSnapshot().account).toBeNull();
  expect(queries.getQueryCache().getAll()).toHaveLength(0);
  status = 200;
  ({ callback } = await attempt(auth));
  await auth.completeCallback(callback);
  seedPrivate();
  await auth.signOut();
  expect(requests.at(-1)?.url).toBe(config.authBaseUrl + '/auth/token/revoke');
  expect(requests.at(-1)?.init.body).toBe(
    new URLSearchParams({ token }).toString(),
  );
  expect(auth.getSnapshot().account).toBeNull();
  expect(storage.size).toBe(0);
  expect(queries.getMutationCache().getAll()).toHaveLength(0);
});
