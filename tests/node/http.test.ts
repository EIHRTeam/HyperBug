import { listenNode } from '../../apps/api-node/src/listen.ts';
import { closeRejectedNodeRequest } from '../../apps/api-node/src/rejected-request.ts';
import { nodeSocketClientAddress } from '../../apps/api-node/src/client-address.ts';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { Agent, request as nodeRequest } from 'node:http';
import { node } from '@elysia/node';
import { loadConfig } from '@hyperbug/config';
import { configureOptionalTurnstile } from '@hyperbug/server';
import { createProofApp } from '../fixtures/proof-app.ts';
import { httpContract } from '../fixtures/http-contract.ts';
let base = '';
let listener: Awaited<ReturnType<typeof listenNode>>;
const app = createProofApp(
  {
    adapter: node(),
    config: loadConfig(
      {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: 'http://localhost:5173',
        REQUEST_TIMEOUT_MS: 100,
        MAX_JSON_DEPTH: 8,
        MAX_JSON_NODES: 128,
        MAX_JSON_OBJECT_KEYS: 32,
        MAX_JSON_ARRAY_ITEMS: 64,
        MAX_JSON_STRING_LENGTH: 512,
        MAX_URL_LENGTH: 2048,
        MAX_QUERY_PARAMETERS: 16,
        MAX_QUERY_VALUE_LENGTH: 128,
        MAX_BODY_BYTES: 1024,
      },
      'node',
    ),
    telemetry: { request() {} },
    ready: async () => true,
    onRejectedRequest: closeRejectedNodeRequest,
  },
  nodeSocketClientAddress,
).get('/_proof/node-peer', ({ request }) => ({
  address: nodeSocketClientAddress(request),
}));
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

it('makes a configured public site key available with the enabled gate', async () => {
  const selected = configureOptionalTurnstile(
    {
      secret: 'test-secret',
      siteKey: 'test-site-key',
      hostname: 'localhost',
      environment: 'local',
    },
    () => ({ verify: async () => ({ success: false }) }),
  );
  const options = {
    adapter: node(),
    config: loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    telemetry: { request() {} },
    ready: async () => true,
  };
  expect(() =>
    createProofApp({ ...options, captchaSiteKey: selected.siteKey }),
  ).toThrow('Invalid public CAPTCHA configuration');
  const configured = await listenNode(
    createProofApp({
      ...options,
      captcha: selected.gate,
      captchaSiteKey: selected.siteKey,
    }),
    0,
  );
  try {
    const response = await fetch(configured.url + '/_proof/captcha');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      enabled: true,
      siteKey: 'test-site-key',
    });
    const challenge = await fetch(configured.url + '/api/v1/accounts/register');
    expect(await challenge.json()).toEqual({
      captchaRequired: true,
      captchaSiteKey: 'test-site-key',
      captchaAction: 'register',
    });
    const denied = await fetch(configured.url + '/api/v1/accounts/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'captcha-required',
        password: 'long-test-password',
      }),
    });
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({
      error: { code: 'CAPTCHA_DENIED' },
    });
    const state = await fetch(configured.url + '/_proof/registration/state');
    expect(await state.json()).toEqual({ hashes: 0, creates: 0 });
  } finally {
    await configured.close();
  }
});

it('returns a closed registration response when account storage stalls', async () => {
  const stalled = await listenNode(
    createProofApp({
      adapter: node(),
      config: loadConfig(
        { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
        'node',
      ),
      telemetry: { request() {} },
      ready: async () => true,
      registrationStore: { register: () => new Promise(() => {}) },
    }),
    0,
  );
  try {
    const response = await fetch(stalled.url + '/api/v1/accounts/register', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: 'stallnode',
        password: 'long-test-password',
      }),
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'REGISTRATION_UNAVAILABLE' },
    });
    const state = await fetch(stalled.url + '/_proof/registration/state');
    expect(await state.json()).toEqual({ hashes: 1, creates: 0 });
  } finally {
    await stalled.close();
  }
}, 10000);

it('derives the Node IP subject from the socket instead of forged forwarding headers', async () => {
  const response = await fetch(base + '/_proof/node-peer', {
    headers: {
      'x-forwarded-for': '198.51.100.42',
      'cf-connecting-ip': '203.0.113.7',
      'x-real-ip': '192.0.2.9',
    },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ address: '127.0.0.1' });
  expect(() =>
    nodeSocketClientAddress(new Request('http://localhost')),
  ).toThrow();
});

it('closes rejected incomplete HTTP/1 bodies before a keep-alive client sends another request', async () => {
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  try {
    for (const framing of ['content-length', 'chunked'] as const) {
      const response = await new Promise<{
        status: number;
        connection?: string;
      }>((resolve, reject) => {
        const client = nodeRequest(
          base + '/_proof/echo',
          {
            agent,
            method: 'POST',
            signal: AbortSignal.timeout(2000),
            headers: {
              'content-type': 'application/json',
              ...(framing === 'content-length'
                ? { 'content-length': '100000' }
                : { 'transfer-encoding': 'chunked' }),
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => {
              client.end();
              resolve({
                status: res.statusCode ?? 0,
                ...(res.headers.connection
                  ? { connection: res.headers.connection }
                  : {}),
              });
            });
            res.on('error', reject);
          },
        );
        client.on('error', reject);
        // Deliberately do not finish the body before the error response.
        client.write('{"message":"' + 'x'.repeat(2048));
      });
      expect(response).toEqual({ status: 413, connection: 'close' });
      await new Promise<void>((resolve, reject) => {
        const client = nodeRequest(
          base + '/health/live',
          { agent, signal: AbortSignal.timeout(2000) },
          (res) => {
            res.resume();
            res.on('end', () =>
              res.statusCode === 200
                ? resolve()
                : reject(new Error('Follow-up request failed')),
            );
            res.on('error', reject);
          },
        );
        client.on('error', reject);
        client.end();
      });
    }
  } finally {
    agent.destroy();
  }
});
