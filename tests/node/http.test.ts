import { listenNode } from '../../apps/api-node/src/listen.ts';
import { beforeAll, afterAll } from 'vitest';
import { node } from '@elysia/node';
import { loadConfig } from '@hyperbug/config';
import { createProofApp } from '../fixtures/proof-app.ts';
import { httpContract } from '../fixtures/http-contract.ts';
let base = '';
let listener: Awaited<ReturnType<typeof listenNode>>;
const app = createProofApp({
  adapter: node(),
  config: loadConfig({
    HYPERBUG_ENV: 'local',
    ALLOWED_ORIGINS: 'http://localhost:5173',
    REQUEST_TIMEOUT_MS: 100,
    MAX_BODY_BYTES: 1024,
  }),
  telemetry: { request() {} },
  ready: async () => true,
});
beforeAll(async () => {
  listener = await listenNode(app, 0);
  base = listener.url;
});
afterAll(async () => {
  await listener?.close();
});
httpContract(async (path, init) => {
  try {
    return await fetch(base + path, init);
  } catch (cause) {
    throw new Error(`Node HTTP fixture request failed: ${path}`, { cause });
  }
});
