import { afterAll, beforeAll, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
let mf: Miniflare;
beforeAll(async () => {
  // This lane runs the deployed Cloudflare artifact, not a fixture, so it also
  // proves that the production Worker starts from its chunked output.
  execFileSync(process.execPath, ['tooling/build.ts', '--target=cloudflare']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/cloudflare'),
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
