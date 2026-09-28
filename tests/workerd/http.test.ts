import { beforeAll, afterAll, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { httpContract } from '../fixtures/http-contract.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
let mf: Miniflare;
let base: URL;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      bindings: {
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
      },
      ratelimits: {
        ABUSE_VOLUMETRIC: {
          namespace_id: '703399',
          simple: { limit: 2, period: 60 },
        },
      },
      modules: workerModules('dist/worker-entry-test'),
      unsafeDirectSockets: [{ entrypoint: 'default' }],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: [
        'nodejs_compat',
        'enable_request_signal',
        'cache_option_enabled',
      ],
    }),
  );
  await mf.ready;
  base = await mf.unsafeGetDirectURL();
});
it('loads its key source from a Worker binding and denies an absent binding', async () => {
  const response = await fetch(new URL('/_proof/worker-key-source', base));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    nonextractable: true,
    purpose: 'envelope-kek',
    missingRejected: true,
  });
});
it('loads a separate non-extractable abuse-key ring in workerd', async () => {
  const response = await fetch(
    new URL('/_proof/worker-abuse-key-source', base),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    versions: [2, 1],
    nonextractable: true,
    missingRejected: true,
  });
});
it('consumes the actual Miniflare rate-limit binding without treating it as authoritative', async () => {
  const outcomes = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(new URL('/_proof/worker-rate-binding', base));
    expect(response.status).toBe(200);
    outcomes.push(await response.json());
  }
  expect(outcomes).toEqual([
    { allowed: true },
    { allowed: true },
    { allowed: false, reason: 'limited' },
  ]);
});
it('canonicalizes an ingress-supplied address consistently in workerd', async () => {
  const response = await fetch(
    new URL('/_proof/worker-ip-normalization', base),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ipv6: '2001:db8::1',
    mapped: '192.0.2.1',
    forwardedRejected: true,
  });
});
afterAll(async () => {
  await mf?.dispose();
});
httpContract((path, init) =>
  fetch(new URL(path, base), {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init?.headers)),
      'accept-encoding': 'identity',
    },
  }),
);

it('requires the configured registration challenge before password work in workerd', async () => {
  const configured = new Miniflare(
    convertV4MiniflareOptions({
      bindings: {
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        REGISTRATION_TEST_CAPTCHA: 'enabled',
      },
      modules: workerModules('dist/worker-entry-test'),
      unsafeDirectSockets: [{ entrypoint: 'default' }],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: [
        'nodejs_compat',
        'enable_request_signal',
        'cache_option_enabled',
      ],
    }),
  );
  try {
    await configured.ready;
    const origin = await configured.unsafeGetDirectURL();
    const challenge = await fetch(new URL('/api/v1/accounts/register', origin));
    expect(await challenge.json()).toEqual({
      captchaRequired: true,
      captchaSiteKey: 'test-site-key',
      captchaAction: 'register',
    });
    const denied = await fetch(new URL('/api/v1/accounts/register', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'workerchallenge',
        password: 'long-test-password',
      }),
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    const state = await fetch(new URL('/_proof/registration/state', origin));
    expect(await state.json()).toEqual({ hashes: 0, creates: 0 });
  } finally {
    await configured.dispose();
  }
});

it('returns a closed registration response when workerd account storage stalls', async () => {
  const stalled = new Miniflare(
    convertV4MiniflareOptions({
      bindings: {
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        REGISTRATION_TEST_STORE_STALL: 'enabled',
      },
      modules: workerModules('dist/worker-entry-test'),
      unsafeDirectSockets: [{ entrypoint: 'default' }],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: [
        'nodejs_compat',
        'enable_request_signal',
        'cache_option_enabled',
      ],
    }),
  );
  try {
    await stalled.ready;
    const origin = await stalled.unsafeGetDirectURL();
    const response = await fetch(new URL('/api/v1/accounts/register', origin), {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'stallworker',
        password: 'long-test-password',
      }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'REGISTRATION_UNAVAILABLE' },
    });
    const state = await fetch(new URL('/_proof/registration/state', origin));
    expect(await state.json()).toEqual({ hashes: 1, creates: 0 });
  } finally {
    await stalled.dispose();
  }
}, 10000);
