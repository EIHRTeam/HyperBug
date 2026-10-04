import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
let mf: Miniflare;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/blob-worker'),
      compatibilityDate: '2026-09-16',
      r2Buckets: ['BLOB'],
    }),
  );
  await mf.ready;
}, 60000);
it('verifies immutable promotion, overwrite/crash races and final bytes in workerd', async () => {
  const response = await mf.dispatchFetch('http://localhost/promotion');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    checks: expect.arrayContaining([
      'staging-overwrite',
      'final-byte-sha256',
      'explicit-unscanned',
    ]),
  });
});
afterAll(async () => {
  await mf?.dispose();
});
it('proves streaming, conditional writes, checksums and multipart in native workerd/R2 emulation', async () => {
  const response = await mf.dispatchFetch('http://localhost/');
  expect(response.status).toBe(200);
  const proof = await response.json();
  expect(proof).toMatchObject({
    largeSize: 32 * 1024 ** 2,
    producerChunks: 512,
  });
  console.log(JSON.stringify({ blobStore: 'workerd R2 emulator', proof }));
}, 60000);
