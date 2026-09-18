import { beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { httpContract } from '../fixtures/http-contract.ts';
let mf: Miniflare;
let base: URL;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/worker-entry-test'),
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
