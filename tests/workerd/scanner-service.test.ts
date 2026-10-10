import { beforeAll, afterAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { createNodeAttachmentScannerService } from '../../apps/api-node/src/attachment-scanner-service.ts';
import { syntheticClean } from '../fixtures/upload-scan-contract.ts';
import { scannerServiceNodeRequest } from '../fixtures/scanner-service-bridge.ts';
let mf: Miniflare;
let received = 0;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures'], {
    stdio: 'pipe',
  });
  const secret = randomBytes(32).toString('hex');
  const handler = createNodeAttachmentScannerService(
    {
      async scan(input) {
        const reader = input.body.getReader();
        let total = 0;
        try {
          for (;;) {
            const next = await reader.read();
            if (next.done) break;
            total += next.value.byteLength;
          }
        } finally {
          reader.releaseLock();
        }
        received = total;
        return syntheticClean;
      },
    },
    secret,
  );
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/scanner-worker'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      r2Buckets: ['BLOB'],
      bindings: { SCANNER_SECRET: secret },
      serviceBindings: {
        SCANNER: async (request) => {
          return handler(scannerServiceNodeRequest(request));
        },
      },
    }),
  );
  await mf.ready;
}, 60000);
afterAll(async () => {
  await mf?.dispose();
});
it('native service binding streams exact bytes to the synthetic Node handler and validates its digest reply', async () => {
  const bytes = new Uint8Array(1024 * 1024).fill(97);
  const response = await mf.dispatchFetch('http://localhost/scan', {
    method: 'POST',
    body: bytes,
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(syntheticClean);
  expect(received).toBe(bytes.length);
});
