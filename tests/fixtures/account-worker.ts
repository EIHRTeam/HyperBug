import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { createCloudflareStandardPasswordService } from '../../apps/api-cloudflare/src/standard-password.ts';
import { createWorkerAbuseKeyProvider } from '../../apps/api-cloudflare/src/abuse-keys.ts';
import { createCloudflareVolumetricLimiter } from '../../apps/api-cloudflare/src/rate-limit.ts';
import {
  createD1AccountRegistrationStore,
  createD1RateCounterStore,
} from '@hyperbug/database-d1';

const config = loadConfig(env, 'cloudflare');
const observations: string[] = [];
const abuse = {
  provider: createWorkerAbuseKeyProvider(env.HYPERBUG_ABUSE_KEY_RING),
  store: createD1RateCounterStore(env.DB),
  limiter: createCloudflareVolumetricLimiter(env.ABUSE_VOLUMETRIC),
  // Test-only ingress assertion. The production root has no accepted resolver.
  clientAddress: () => '192.0.2.42',
};

export default createApp({
  adapter: CloudflareAdapter,
  config,
  telemetry: jsonTelemetry((line) => observations.push(line)),
  ready: async () => true,
  abuse,
  registrationStore: createD1AccountRegistrationStore(env.DB),
  standardPassword: createCloudflareStandardPasswordService(
    config.deployment,
    initialStandardPasswordPolicy,
    initialStandardPasswordPolicy.maximum.memoryKiB,
  ),
})
  .get('/_proof/observations', () =>
    observations.map((line) => JSON.parse(line)),
  )
  .compile();
