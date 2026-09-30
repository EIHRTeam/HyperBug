import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import { createApp, parseBootstrapEnrollmentCode } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { createCloudflareStandardPasswordService } from '../../apps/api-cloudflare/src/standard-password.ts';
import { createWorkerAbuseKeyProvider } from '../../apps/api-cloudflare/src/abuse-keys.ts';
import { createCloudflareVolumetricLimiter } from '../../apps/api-cloudflare/src/rate-limit.ts';
import {
  createD1AccountRecoveryStore,
  createD1PasskeyStores,
  createD1AccountRegistrationStore,
  createD1AccountSessionStore,
  createD1KeyRegistry,
  createD1RateCounterStore,
  createD1StaffEnrollmentStore,
} from '@hyperbug/database-d1';
import { createWorkerKeyProvider } from '../../apps/api-cloudflare/src/key-provider.ts';

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
  bootstrapCode: parseBootstrapEnrollmentCode(env.HYPERBUG_TEST_BOOTSTRAP_CODE),
  passkey: env.HYPERBUG_TEST_PASSKEY_RP_ID
    ? {
        rpID: env.HYPERBUG_TEST_PASSKEY_RP_ID,
        rpName: env.HYPERBUG_TEST_PASSKEY_RP_NAME,
        origin: env.HYPERBUG_TEST_PASSKEY_ORIGIN,
        store: createD1PasskeyStores(env.DB),
        passwordStore: createD1AccountRegistrationStore(env.DB),
        sessionStore: createD1AccountSessionStore(env.DB),
        keyProvider: env.HYPERBUG_KEY_RING
          ? createWorkerKeyProvider(
              env.HYPERBUG_KEY_RING,
              createD1KeyRegistry(env.DB),
            )
          : null,
      }
    : null,
  staffEnrollmentStore: createD1StaffEnrollmentStore(env.DB),
  bootstrapState: async () =>
    (await createD1StaffEnrollmentStore(env.DB).countActiveStaff()) === 0,
  sessionStore: createD1AccountSessionStore(env.DB),
  passwordStore: createD1AccountRegistrationStore(env.DB),
  recoveryStore: createD1AccountRecoveryStore(env.DB),
  keyProvider: env.HYPERBUG_KEY_RING
    ? createWorkerKeyProvider(
        env.HYPERBUG_KEY_RING,
        createD1KeyRegistry(env.DB),
      )
    : null,
})
  .get('/_proof/observations', () =>
    observations.map((line) => JSON.parse(line)),
  )
  .compile();
