import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { readdirSync } from 'node:fs';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
let processUnderTest: ChildProcess;
let base: string;
beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=node']);
  // The Node entry must stay a single file: `package.json` points at
  // `dist/node/index.mjs` for a real deployment. Rolldown only splits on
  // dynamic imports, so more than one emitted module means the entry gained
  // one and the start command would need a directory instead.
  expect(
    readdirSync('dist/node').filter((name) => name.endsWith('.mjs')),
  ).toEqual(['index.mjs']);
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  await new Promise<void>((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  base = `http://127.0.0.1:${address.port}`;
  processUnderTest = spawn(process.execPath, ['dist/node/index.mjs'], {
    env: {
      ...process.env,
      HYPERBUG_ENV: 'production',
      ALLOWED_ORIGINS: 'https://frontend.example',
      HOST: '127.0.0.1',
      PORT: String(address.port),
    },
    stdio: 'ignore',
  });
  await vi.waitFor(
    async () => {
      expect(processUnderTest.exitCode).toBeNull();
      const response = await fetch(`${base}/health/live`);
      expect(await response.json()).toEqual({ status: 'ok' });
    },
    { timeout: 5000 },
  );
});
afterAll(async () => {
  if (processUnderTest && processUnderTest.exitCode === null) {
    const exited = once(processUnderTest, 'exit');
    processUnderTest.kill('SIGTERM');
    await exited;
  }
});
it('serves the production Node bundle without fixture routes', async () => {
  const response = await fetch(`${base}/health/ready`);
  expect(response.status).toBe(200);
  await response.text();
  const proof = await fetch(`${base}/_proof/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  expect(proof.status).toBe(404);
  await proof.text();
});
