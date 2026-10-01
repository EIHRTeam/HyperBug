import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';

beforeAll(() => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=cloudflare']);
});

function worker(bindings: Record<string, string>) {
  return new Miniflare(
    convertV4MiniflareOptions({
      bindings: {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://issues.example.org',
        ...bindings,
      },
      modules: workerModules('dist/cloudflare'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    }),
  );
}

it('rejects invalid tier settings and partial minimum enablement during real Worker startup', async () => {
  for (const settings of [
    { HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum' },
    {
      HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
      HYPERBUG_DEGRADATION_ACK: 'free-minimum-v0',
    },
    { HYPERBUG_DEPLOYMENT_TIER: 'minimum' },
    { HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1' },
  ]) {
    const mf = worker(settings);
    let startupError: unknown;
    let cleanupError: unknown;
    try {
      await mf.ready;
    } catch (error) {
      startupError = error;
    } finally {
      try {
        await mf.dispose();
      } catch (error) {
        // Miniflare 5 completes cleanup, then rethrows the original startup
        // error. Never discard an independent cleanup failure.
        cleanupError = error;
      }
    }
    if (cleanupError !== undefined && cleanupError !== startupError)
      throw cleanupError;
    expect(startupError).toBeInstanceOf(Error);
    expect(String(startupError)).toContain('docs/FREE-TIER-PROFILE.md');
  }
});

it('starts an acknowledged minimum-tier selection but fails every request without its enablement trail', async () => {
  // The binding-free worker boots (module scope is consistent), but without
  // the database there is no audited enablement trail: the per-isolate
  // activation barrier fails and every request fails closed. The persisted
  // enablement itself is verified by the minimum-tier journey fixture.
  const mf = worker({
    HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
    HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1',
  });
  try {
    const base = await mf.ready;
    const response = await fetch(new URL('/health/live', base));
    expect(response.status).toBe(500);
  } finally {
    await mf.dispose();
  }
});

it('keeps standard tier selection unchanged when provider-plan or quota-like bindings are present', async () => {
  const mf = worker({ WORKERS_PLAN: 'free', QUOTA_EXHAUSTED: 'true' });
  try {
    const base = await mf.ready;
    const response = await fetch(new URL('/health/ready', base));
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
  } finally {
    await mf.dispose();
  }
});

it('keeps Turnstile optional and refuses partial or public-test Worker bindings', async () => {
  for (const bindings of [
    { TURNSTILE_SECRET: 'test-secret' },
    {
      TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_HOSTNAME: 'issues.example.org',
    },
  ]) {
    const invalid = worker(bindings);
    let startupError: unknown;
    let cleanupError: unknown;
    try {
      await invalid.ready;
    } catch (error) {
      startupError = error;
    } finally {
      try {
        await invalid.dispose();
      } catch (error) {
        cleanupError = error;
      }
    }
    if (cleanupError !== undefined && cleanupError !== startupError)
      throw cleanupError;
    expect(String(startupError)).toContain(
      'Invalid Turnstile provider configuration',
    );
    expect(String(startupError)).not.toContain('test-secret');
  }

  const configured = worker({
    TURNSTILE_SECRET: 'test-secret',
    TURNSTILE_SITE_KEY: 'test-site-key',
    TURNSTILE_HOSTNAME: 'issues.example.org',
  });
  try {
    const base = await configured.ready;
    const response = await fetch(new URL('/health/live', base));
    expect(response.status).toBe(200);
    await response.body?.cancel();
  } finally {
    await configured.dispose();
  }
});
