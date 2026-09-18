import { describe, it, expect } from 'vitest';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { withDeadline } from '@hyperbug/server';

describe('runtime security foundation', () => {
  it('fails closed for missing and invalid production settings', () => {
    for (const env of [
      {},
      { HYPERBUG_ENV: 'production', ALLOWED_ORIGINS: '*' },
      { HYPERBUG_ENV: 'production', ALLOWED_ORIGINS: 'http://localhost:5173' },
      {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://example.com/path',
      },
      {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://example.com',
        MAX_BODY_BYTES: 'Infinity',
      },
    ])
      expect(() => loadConfig(env)).toThrow();
    expect(
      loadConfig({
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://example.com',
      }).environment,
    ).toBe('production');
  });
  it('serializes only safe telemetry fields and bounded dimensions', () => {
    const output: string[] = [];
    const record = {
      requestId: crypto.randomUUID(),
      route: 'health.live' as const,
      status: 200,
      durationMs: 5,
      password: 'DO_NOT_LEAK',
      authorization: 'secret',
    };
    jsonTelemetry((line) => output.push(line)).request(record);
    expect(output).toHaveLength(3);
    expect(output.join('')).not.toMatch(/DO_NOT_LEAK|authorization|secret/);
    expect(JSON.parse(output[1] ?? '{}').attributes).toEqual({
      route: 'health.live',
      statusClass: '2xx',
    });
  });
  it('propagates caller abort to cooperative work and rejects', async () => {
    const controller = new AbortController();
    let propagated = false;
    const pending = withDeadline(
      controller.signal,
      1000,
      (signal) =>
        new Promise(() => {
          signal.addEventListener('abort', () => {
            propagated = true;
          });
        }),
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'REQUEST_TIMEOUT' });
    expect(propagated).toBe(true);
  });
});
