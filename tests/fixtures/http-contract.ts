import { describe, it, expect, vi } from 'vitest';

type Fetcher = (
  path: string,
  init?: RequestInit & { duplex?: 'half' },
) => Promise<Response>;
export function httpContract(fetcher: Fetcher) {
  describe('shared HTTP behavior', () => {
    it('provides liveness, readiness and unique server-generated request IDs', async () => {
      const a = await fetcher('/health/live', {
        headers: { 'x-request-id': 'untrusted' },
      });
      const b = await fetcher('/health/ready');
      expect(a.status).toBe(200);
      expect(await a.json()).toEqual({ status: 'ok' });
      expect(b.status).toBe(200);
      expect(await b.json()).toEqual({ status: 'ok' });
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
          expect(await response.json()).toEqual({ status: 'unavailable' });
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
