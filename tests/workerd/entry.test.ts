import { afterAll, beforeAll, it, expect } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
let mf: Miniflare;
beforeAll(async () => {
  await build({
    entryPoints: ['apps/api-cloudflare/src/index.ts'],
    outfile: 'dist/worker-entry-test.mjs',
    bundle: true,
    platform: 'neutral',
    mainFields: ['browser', 'module', 'main'],
    format: 'esm',
    target: 'es2023',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*', 'cloudflare:*'],
  });
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: [{ type: 'ESModule', path: 'dist/worker-entry-test.mjs' }],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      bindings: {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://frontend.example',
      },
    }),
  );
  await mf.ready;
});
afterAll(async () => {
  await mf?.dispose();
});
it('serves the production Worker with module-initialized AOT and no fixture routes', async () => {
  const base = await mf.ready;
  const health = await fetch(new URL('/health/ready', base));
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ status: 'ok' });
  const proof = await fetch(new URL('/_proof/error', base));
  expect(proof.status).toBe(404);
  await proof.text();
});
