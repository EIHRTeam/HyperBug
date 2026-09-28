import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createProofApp } from './proof-app.ts';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { env } from 'cloudflare:workers';
import { createWorkerKeyProvider } from '../../apps/api-cloudflare/src/key-provider.ts';
import { createCaptchaGate } from '@hyperbug/server';
import { createWorkerAbuseKeyProvider } from '../../apps/api-cloudflare/src/abuse-keys.ts';
import { createCloudflareVolumetricLimiter } from '../../apps/api-cloudflare/src/rate-limit.ts';
import { canonicalIpAddress } from '../../packages/security/src/ip-address.ts';
import { cryptoFixture } from './crypto-scenarios.ts';

export default createProofApp({
  adapter: CloudflareAdapter,
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
      MAX_BODY_BYTES: '1024',
    },
    'cloudflare',
  ),
  telemetry: jsonTelemetry(() => {}),
  ready: async () => true,
  ...((env as unknown as { REGISTRATION_TEST_CAPTCHA?: string })
    .REGISTRATION_TEST_CAPTCHA === 'enabled'
    ? {
        captcha: createCaptchaGate({
          verifier: { verify: async () => ({ success: false }) },
          expectedHostname: 'localhost',
          maxAgeMs: 300000,
          minimumScore: null,
          timeoutMs: 1000,
        }),
        captchaSiteKey: 'test-site-key',
      }
    : {}),
  ...((env as unknown as { REGISTRATION_TEST_STORE_STALL?: string })
    .REGISTRATION_TEST_STORE_STALL === 'enabled'
    ? { registrationStore: { register: () => new Promise(() => {}) } }
    : {}),
})
  .get('/_proof/worker-key-source', async () => {
    const { lifecycle } = cryptoFixture();
    const provider = createWorkerKeyProvider(env.HYPERBUG_KEY_RING, lifecycle);
    const key = await provider.current('envelope-kek');
    let missingRejected = false;
    try {
      await createWorkerKeyProvider('', lifecycle).current('envelope-kek');
    } catch {
      missingRejected = true;
    }
    return {
      nonextractable: !key.key.extractable,
      purpose: key.ref.purpose,
      missingRejected,
    };
  })
  .get('/_proof/worker-abuse-key-source', async () => {
    const signal = new AbortController().signal;
    const keys = await createWorkerAbuseKeyProvider(
      env.HYPERBUG_ABUSE_KEY_RING,
    ).active(signal);
    let missingRejected = false;
    try {
      await createWorkerAbuseKeyProvider('').active(signal);
    } catch {
      missingRejected = true;
    }
    return {
      versions: keys.map((entry) => entry.version),
      nonextractable: keys.every((entry) => !entry.key.extractable),
      missingRejected,
    };
  })
  .get('/_proof/worker-rate-binding', () =>
    createCloudflareVolumetricLimiter(env.ABUSE_VOLUMETRIC).consume(
      'a'.repeat(64),
      Date.now(),
    ),
  )
  .get('/_proof/worker-ip-normalization', () => {
    let forwardedRejected = false;
    try {
      canonicalIpAddress('203.0.113.7, 198.51.100.2');
    } catch {
      forwardedRejected = true;
    }
    return {
      ipv6: canonicalIpAddress('2001:0DB8:0000:0:0:0:0:1'),
      mapped: canonicalIpAddress('::ffff:192.0.2.1'),
      forwardedRejected,
    };
  })
  .compile();
