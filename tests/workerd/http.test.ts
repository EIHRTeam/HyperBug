import { beforeAll, afterAll } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { httpContract } from '../fixtures/http-contract.ts';
let mf: Miniflare;
let base: URL;
beforeAll(async () => {
  await build({
    entryPoints: ['tests/fixtures/worker.ts'],
    outfile: 'dist/test-worker.mjs',
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
      modules: [{ type: 'ESModule', path: 'dist/test-worker.mjs' }],
      unsafeDirectSockets: [{ entrypoint: 'default' }],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    }),
  );
  await mf.ready;
  base = await mf.unsafeGetDirectURL();
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
