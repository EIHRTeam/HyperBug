import { describe, it, expect, vi } from 'vitest';
import { expectedSecurityScenarios } from './security-scenarios.ts';

type Fetcher = (
  path: string,
  init?: RequestInit & { duplex?: 'half' },
) => Promise<Response>;
export function httpContract(fetcher: Fetcher) {
  describe('shared HTTP behavior', () => {
    it('publishes the registration challenge action while no-provider setup requires no token', async () => {
      const response = await fetcher('/api/v1/accounts/register');
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({
        captchaRequired: false,
        captchaSiteKey: null,
        captchaAction: 'register',
      });
    });
    it('registers a User only after account and trusted-IP admission, with generic duplicate response', async () => {
      const beforeResponse = await fetcher('/_proof/registration/state');
      const before = (await beforeResponse.json()) as {
        hashes: number;
        creates: number;
      };
      const body = JSON.stringify({
        handle: 'SharedFixtureUser',
        password: 'a-long-test-password',
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await fetcher('/api/v1/accounts/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        expect(response.status).toBe(202);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(await response.json()).toEqual({ accepted: true });
      }
      const afterResponse = await fetcher('/_proof/registration/state');
      expect(await afterResponse.json()).toEqual({
        hashes: before.hashes + 2,
        creates: before.creates + 1,
      });
    });
    it('denies over-budget registration before password work and persistence', async () => {
      const body = JSON.stringify({
        handle: 'budgetfixture',
        password: 'a-long-test-password',
      });
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetcher('/api/v1/accounts/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        expect(response.status).toBe(202);
        await response.text();
      }
      const beforeResponse = await fetcher('/_proof/registration/state');
      const before = await beforeResponse.json();
      const denied = await fetcher('/api/v1/accounts/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
      expect(denied.status).toBe(429);
      expect(denied.headers.get('retry-after')).toMatch(/^\d+$/);
      expect(await denied.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });
      const afterResponse = await fetcher('/_proof/registration/state');
      expect(await afterResponse.json()).toEqual(before);
    });
    it('runs known-answer and credential/envelope tamper/rotation cases inside this runtime', async () => {
      const response = await fetcher('/_proof/crypto');
      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        vectors: Record<string, boolean>;
        scenarios: Record<string, boolean>;
      };
      expect(result.vectors).toEqual({
        aesGcm: true,
        aesKw: true,
        hmacSign: true,
        hmacVerify: true,
      });
      expect(Object.keys(result.scenarios).length).toBeGreaterThan(30);
      for (const [name, passed] of Object.entries(result.scenarios))
        expect(passed, name).toBe(true);
    });
    it('runs the minimum-tier verifier mechanics inside this runtime', async () => {
      const response = await fetcher('/_proof/minimum-password');
      expect(response.status).toBe(200);
      const result = (await response.json()) as Record<string, boolean>;
      expect(Object.keys(result).length).toBeGreaterThan(10);
      for (const [name, passed] of Object.entries(result))
        expect(passed, name).toBe(true);
    });
    it('leaves the shared CAPTCHA gate disabled without a provider', async () => {
      const response = await fetcher('/_proof/captcha');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ enabled: false, siteKey: null });
    });
    it('denies a route that needs keys when the root has no provider', async () => {
      const response = await fetcher('/_proof/key-provider');
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An internal error occurred.',
          requestId: response.headers.get('x-request-id'),
        },
      });
    });
    it('keeps minimum-tier login admission closed without root dependencies', async () => {
      const response = await fetcher('/_proof/minimum-login-admission');
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        error: { code: 'RATE_LIMIT_UNAVAILABLE' },
      });
    });
    it('enforces object-bound permissions and denies provider failure in this runtime', async () => {
      const response = await fetcher('/_proof/authorization');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(expectedSecurityScenarios);
    });
    it('enforces exact browser origins while allowing no-Origin protocol clients', async () => {
      const origin = 'http://localhost:5173';
      for (const path of ['/health/live', '/missing']) {
        const response = await fetcher(path, { headers: { origin } });
        expect(response.headers.get('access-control-allow-origin')).toBe(
          origin,
        );
        expect(response.headers.get('vary')).toContain('Origin');
        expect(
          response.headers.get('access-control-allow-credentials'),
        ).toBeNull();
        expect(response.headers.get('cache-control')).toBe('no-store');
        await response.text();
      }
      for (const forbiddenOrigin of [
        'null',
        'http://localhost:5173.evil.test',
        'https://evil.test',
        'http://localhost:5173/',
      ]) {
        const response = await fetcher('/health/live', {
          headers: { origin: forbiddenOrigin },
        });
        expect(response.status).toBe(403);
        expect(response.headers.get('access-control-allow-origin')).toBeNull();
        expect(await response.json()).toMatchObject({
          error: {
            code: 'ORIGIN_FORBIDDEN',
            requestId: response.headers.get('x-request-id'),
          },
        });
      }
      const noOrigin = await fetcher('/health/live', {
        headers: { authorization: 'Bearer SEEDED_SECRET' },
      });
      expect(noOrigin.status).toBe(200);
      expect(noOrigin.headers.get('access-control-allow-origin')).toBeNull();
      await noOrigin.text();
    });
    it('bounds preflight caching, methods and headers without enabling cookies', async () => {
      const headers = {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'Authorization, Content-Type',
      };
      const accepted = await fetcher('/_proof/echo', {
        method: 'OPTIONS',
        headers,
      });
      expect(accepted.status).toBe(204);
      expect(await accepted.text()).toBe('');
      expect(accepted.headers.get('access-control-allow-origin')).toBe(
        headers.origin,
      );
      expect(accepted.headers.get('access-control-max-age')).toBe('300');
      expect(accepted.headers.get('vary')).toBe(
        'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
      );
      expect(
        accepted.headers.get('access-control-allow-credentials'),
      ).toBeNull();
      for (const override of [
        { 'access-control-request-method': 'TRACE' },
        { 'access-control-request-method': 'post' },
        { 'access-control-request-headers': 'Cookie' },
        { 'access-control-request-headers': 'Authorization, Authorization' },
        { 'access-control-request-headers': 'x-unknown' },
        { 'access-control-request-headers': 'x'.repeat(257) },
      ]) {
        const rejected = await fetcher('/_proof/echo', {
          method: 'OPTIONS',
          headers: { ...headers, ...override },
        });
        expect(rejected.status).toBe(400);
        expect(rejected.headers.get('access-control-max-age')).toBeNull();
        await rejected.text();
      }
      const noOrigin = await fetcher('/_proof/echo', {
        method: 'OPTIONS',
        headers: { 'access-control-request-method': 'POST' },
      });
      expect(noOrigin.status).toBe(400);
      await noOrigin.text();
    });
    it('rejects bounded-size JSON with excessive structure and unsafe numeric/key values', async () => {
      const cases = [
        '['.repeat(9) + '0' + ']'.repeat(9),
        JSON.stringify(
          Object.fromEntries(
            Array.from({ length: 33 }, (_, i) => ['k' + i, 0]),
          ),
        ),
        JSON.stringify(Array(65).fill(0)),
        JSON.stringify(Array.from({ length: 32 }, () => [0, 0, 0, 0])),
        JSON.stringify('s'.repeat(513)),
        '{"nested":{"__proto__":{"polluted":true}}}',
        '{"value":1e999}',
      ];
      for (const body of cases) {
        const response = await fetcher('/_proof/input', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        expect(response.status).toBe(400);
        expect((await response.text()).length).toBeLessThan(300);
      }
      for (const body of [
        JSON.stringify('escaped \\" [[[ {{{'),
        '['.repeat(8) + '0' + ']'.repeat(8),
        JSON.stringify(Array(64).fill(0)),
      ]) {
        const response = await fetcher('/_proof/input', {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ accepted: true });
      }
    });
    it('bounds URL length, duplicate query cardinality and decoded values', async () => {
      for (const query of [
        'a='.repeat(1100),
        Array(17).fill('a=1').join('&'),
        'a=' + '%E4%B8%AD'.repeat(129),
      ]) {
        const response = await fetcher('/health/live?' + query);
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          error: { code: 'INPUT_LIMIT_EXCEEDED' },
        });
      }
      const valid = await fetcher(
        '/health/live?' + Array(16).fill('a=1').join('&'),
      );
      expect(valid.status).toBe(200);
      await valid.text();
    });
    it('uses catalogued safe text even if an expected error message is replaced', async () => {
      const response = await fetcher('/_proof/safe-failure');
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied.',
          requestId: response.headers.get('x-request-id'),
        },
      });
    });
    it('provides liveness, readiness and unique server-generated request IDs', async () => {
      const a = await fetcher('/health/live', {
        headers: { 'x-request-id': 'untrusted' },
      });
      const b = await fetcher('/health/ready');
      expect(a.status).toBe(200);
      expect(await a.json()).toEqual({ status: 'ok' });
      expect(b.status).toBe(200);
      expect(await b.json()).toEqual({
        status: 'ok',
        deployment: {
          tier: 'standard',
          degradationIds: [],
          passwordHashPolicy: 'argon2id',
        },
      });
      expect(a.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(a.headers.get('x-request-id')).not.toEqual(
        b.headers.get('x-request-id'),
      );
      expect(a.headers.get('cache-control')).toBe('no-store');
    });
    it('returns safe unavailable readiness for false, failed and timed-out dependencies', async () => {
      try {
        for (const mode of ['unavailable', 'error', 'timeout']) {
          await (await fetcher(`/_proof/readiness/${mode}`)).text();
          const response = await fetcher('/health/ready');
          expect(response.status).toBe(503);
          expect(await response.json()).toEqual({
            status: 'unavailable',
            deployment: {
              tier: 'standard',
              degradationIds: [],
              passwordHashPolicy: 'argon2id',
            },
          });
          expect(response.headers.get('cache-control')).toBe('no-store');
        }
      } finally {
        await (await fetcher('/_proof/readiness/healthy')).text();
      }
    });
    it('validates the same framework-independent contract', async () => {
      const valid = await fetcher('/_proof/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'hello' }),
      });
      expect(valid.status).toBe(200);
      expect(await valid.json()).toEqual({ message: 'hello' });
      for (const value of [
        { message: '' },
        { message: 1 },
        { message: 'a', extra: true },
      ]) {
        const invalid = await fetcher('/_proof/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(value),
        });
        expect(invalid.status).toBe(400);
        expect(await invalid.json()).toMatchObject({
          error: {
            code: 'INVALID_REQUEST',
            requestId: invalid.headers.get('x-request-id'),
          },
        });
      }
    });
    it('rejects malformed and oversized bodies without leaking content', async () => {
      for (const [body, status] of [
        ['{invalid', 400],
        [JSON.stringify({ message: 'x'.repeat(2048) }), 413],
      ] as const) {
        const response = await fetcher('/_proof/echo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        });
        expect(response.status).toBe(status);
        expect((await response.text()).length).toBeLessThan(300);
      }
    });
    it('bounds actual chunked bytes, not only Content-Length', async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"message":"'));
          controller.enqueue(new TextEncoder().encode('x'.repeat(2048)));
          controller.enqueue(new TextEncoder().encode('"}'));
          controller.close();
        },
      });
      const response = await fetcher('/_proof/echo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        duplex: 'half',
      });
      expect(response.status).toBe(413);
      await response.arrayBuffer();
    });
    it('cancels cooperative work when the client disconnects', async () => {
      const before = (await (
        await fetcher('/_proof/cancellations')
      ).json()) as { count: number; requestAborts: number };
      const controller = new AbortController();
      const response = await fetcher('/_proof/cancel', {
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      expect(new TextDecoder().decode((await reader?.read())?.value)).toBe(
        'ready\n',
      );
      controller.abort();
      await expect(reader?.read()).rejects.toThrow();
      await vi.waitFor(
        async () => {
          const after = (await (
            await fetcher('/_proof/cancellations')
          ).json()) as { count: number; requestAborts: number };
          expect(after.count).toBe(before.count + 1);
          expect(after.requestAborts).toBe(before.requestAborts + 1);
        },
        { timeout: 1000, interval: 20 },
      );
    });
    it('maps missing routes and internal errors safely', async () => {
      for (const [path, status, code] of [
        ['/missing', 404, 'NOT_FOUND'],
        ['/_proof/error', 500, 'INTERNAL_ERROR'],
      ] as const) {
        const response = await fetcher(path);
        expect(response.status).toBe(status);
        const text = await response.text();
        expect(text).not.toMatch(/password|private|sql|stack/i);
        expect(JSON.parse(text)).toMatchObject({
          error: { code, requestId: response.headers.get('x-request-id') },
        });
      }
    });
    it('returns safe rate-limit and outage errors with bounded retry hints', async () => {
      const limited = await fetcher('/_proof/rate-limited');
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBe('37');
      expect(limited.headers.get('cache-control')).toBe('no-store');
      expect(await limited.json()).toMatchObject({
        error: {
          code: 'RATE_LIMITED',
          requestId: limited.headers.get('x-request-id'),
        },
      });
      const unavailable = await fetcher('/_proof/rate-unavailable');
      expect(unavailable.status).toBe(503);
      expect(unavailable.headers.has('retry-after')).toBe(false);
      expect(await unavailable.json()).toMatchObject({
        error: {
          code: 'RATE_LIMIT_UNAVAILABLE',
          requestId: unavailable.headers.get('x-request-id'),
        },
      });
    });
    it('guards a sensitive route before side effects with authoritative admission', async () => {
      const before = (await (
        await fetcher('/_proof/sensitive-admission/state')
      ).json()) as { actions: number; writes: number };
      for (let attempt = 0; attempt < 2; attempt++) {
        const allowed = await fetcher('/_proof/sensitive-admission/normal');
        expect(allowed.status).toBe(200);
        expect(await allowed.json()).toEqual({ completed: true });
      }
      const limited = await fetcher('/_proof/sensitive-admission/normal');
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBe('40');
      expect(limited.headers.get('cache-control')).toBe('no-store');
      expect(await limited.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });
      const afterLimited = (await (
        await fetcher('/_proof/sensitive-admission/state')
      ).json()) as { actions: number; writes: number };
      expect(afterLimited).toEqual({
        actions: before.actions + 2,
        writes: before.writes + 12,
      });
      const volumeLimited = await fetcher(
        '/_proof/sensitive-admission/volume-limit',
      );
      expect(volumeLimited.status).toBe(429);
      expect(volumeLimited.headers.has('retry-after')).toBe(false);
      expect(await volumeLimited.json()).toMatchObject({
        error: { code: 'RATE_LIMITED' },
      });
      for (const mode of [
        'key-outage',
        'store-outage',
        'key-stall',
        'store-stall',
        'volume-outage',
        'invalid',
        'invalid-timeout',
      ]) {
        const denied = await fetcher(`/_proof/sensitive-admission/${mode}`);
        expect(denied.status, mode).toBe(503);
        expect(denied.headers.has('retry-after'), mode).toBe(false);
        expect(denied.headers.get('cache-control'), mode).toBe('no-store');
        const body = await denied.text();
        expect(body).not.toMatch(/private|counter|abuse-key/i);
        expect(JSON.parse(body)).toMatchObject({
          error: { code: 'RATE_LIMIT_UNAVAILABLE' },
        });
      }
      const afterDenied = (await (
        await fetcher('/_proof/sensitive-admission/state')
      ).json()) as { actions: number; writes: number };
      expect(afterDenied.actions).toBe(afterLimited.actions);
      expect(afterDenied.writes).toBe(afterLimited.writes);
    });
    it('stops protected work on authorization denial, stale assurance and resolver failure', async () => {
      const before = (await (
        await fetcher('/_proof/authorization-admission/state')
      ).json()) as { actions: number };
      const allowed = await fetcher('/_proof/authorization-admission/allow');
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toEqual({ completed: true });
      for (const [mode, status, code] of [
        ['forbidden', 403, 'FORBIDDEN'],
        ['reauth', 403, 'REAUTHENTICATION_REQUIRED'],
        ['outage', 503, 'AUTHORIZATION_UNAVAILABLE'],
        ['timeout', 503, 'AUTHORIZATION_UNAVAILABLE'],
      ] as const) {
        const denied = await fetcher(`/_proof/authorization-admission/${mode}`);
        expect(denied.status).toBe(status);
        expect(denied.headers.get('cache-control')).toBe('no-store');
        const body = await denied.text();
        expect(body).not.toContain('private authorization provider detail');
        expect(JSON.parse(body)).toMatchObject({ error: { code } });
      }
      const after = (await (
        await fetcher('/_proof/authorization-admission/state')
      ).json()) as { actions: number };
      expect(after.actions).toBe(before.actions + 1);
    });
    it('prevents a handler Response from enabling a shared cache', async () => {
      const response = await fetcher('/_proof/cache-override', {
        headers: { authorization: 'Bearer SEEDED_SECRET' },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.text()).toBe('private');
      const setOverride = await fetcher('/_proof/cache-set-override');
      expect(setOverride.headers.get('cache-control')).toBe('no-store');
      expect(await setOverride.json()).toEqual({ private: true });
      const immutable = await fetcher('/_proof/cache-immutable', {
        redirect: 'manual',
      });
      expect(immutable.status).toBe(302);
      expect(immutable.headers.get('cache-control')).toBe('no-store');
    });
    it('retains exact-origin and security headers when a handler returns hostile native headers', async () => {
      for (const [path, status] of [
        ['/_proof/boundary-override', 200],
        ['/_proof/boundary-set-override', 200],
        ['/_proof/boundary-error-override', 403],
        ['/_proof/cache-immutable', 302],
      ] as const) {
        const response = await fetcher(path, {
          headers: { origin: 'http://localhost:5173' },
          redirect: 'manual',
        });
        expect(response.status, path).toBe(status);
        expect(response.headers.get('access-control-allow-origin'), path).toBe(
          'http://localhost:5173',
        );
        expect(
          response.headers.get('access-control-allow-credentials'),
          path,
        ).toBeNull();
        expect(response.headers.get('vary'), path).toContain('Origin');
        expect(response.headers.get('x-request-id'), path).toMatch(
          /^[0-9a-f-]{36}$/,
        );
        expect(response.headers.get('x-content-type-options'), path).toBe(
          'nosniff',
        );
        expect(response.headers.get('cache-control'), path).toBe('no-store');
        await response.text();
      }
      const noOrigin = await fetcher('/_proof/boundary-override');
      expect(noOrigin.headers.get('access-control-allow-origin')).toBeNull();
      expect(
        noOrigin.headers.get('access-control-allow-credentials'),
      ).toBeNull();
      await noOrigin.text();
    });
    it('preserves plugin encapsulation with AOT', async () => {
      expect((await fetcher('/_proof/scoped')).headers.get('x-scoped')).toBe(
        'yes',
      );
      expect((await fetcher('/_proof/unscoped')).headers.has('x-scoped')).toBe(
        false,
      );
    });
    it('streams responses and times out bounded work', async () => {
      const response = await fetcher('/_proof/stream');
      expect(response.headers.get('content-type')).toContain('text/plain');
      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
      expect(new TextDecoder().decode((await reader?.read())?.value)).toBe(
        'first\n',
      );
      expect(new TextDecoder().decode((await reader?.read())?.value)).toBe(
        'second\n',
      );
      expect((await reader?.read())?.done).toBe(true);
      const timeout = await fetcher('/_proof/timeout');
      expect(timeout.status).toBe(408);
    });
  });
}
