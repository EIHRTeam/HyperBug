import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import {
  createApp,
  parseBootstrapEnrollmentCode,
  parseOAuthClients,
} from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { auditEvent } from '../../packages/security/src/audit.ts';
import {
  adaptMinimumPasswordService,
  createMinimumPasswordService,
  minimumTierPasswordPolicy,
  type MinimumPasswordService,
} from '../../packages/security/src/minimum-password.ts';
import { createWorkerAbuseKeyProvider } from '../../apps/api-cloudflare/src/abuse-keys.ts';
import { createCloudflareVolumetricLimiter } from '../../apps/api-cloudflare/src/rate-limit.ts';
import {
  createD1AccountAdministration,
  createD1AccountRecoveryStore,
  createD1AuditRepository,
  createD1KeyRegistry,
  createD1OAuthStores,
  createD1PasskeyStores,
  createD1ProjectRoleStore,
  createD1AccountRegistrationStore,
  createD1AccountSessionStore,
  createD1RateCounterStore,
  createD1StaffEnrollmentStore,
} from '@hyperbug/database-d1';
import { createWorkerKeyProvider } from '../../apps/api-cloudflare/src/key-provider.ts';

// Test-only composition of the cloudflare-free-minimum tier: the environment
// selects the tier with its exact acknowledgement, and this fixture mirrors
// the production root's audited activation (warning, idempotent persisted
// enablement event, pepper preflight) before composing the shared app. Like
// the production root, the activation and composition run lazily on the
// first request because Workers global scope forbids the async D1 work.
const config = loadConfig(env, 'cloudflare');
if (config.deployment.tier !== 'cloudflare-free-minimum')
  throw new Error('The minimum-tier fixture requires the tier environment');
const observations: string[] = [];
const auditRepository = createD1AuditRepository(env.DB);
const abuse = {
  provider: createWorkerAbuseKeyProvider(env.HYPERBUG_ABUSE_KEY_RING),
  store: createD1RateCounterStore(env.DB),
  limiter: createCloudflareVolumetricLimiter(env.ABUSE_VOLUMETRIC),
  // Test-only ingress assertion. The production root has no accepted resolver.
  clientAddress: () => '192.0.2.42',
};
const keyProvider = createWorkerKeyProvider(
  env.HYPERBUG_KEY_RING,
  createD1KeyRegistry(env.DB),
);
// Same deterministic id as the production root so the event is written once
// per database; this fixture only ever runs against its private Miniflare
// D1, never the shared remote test database.
const enablementEventId = '5ee1a0d2-7c3b-4f68-9a1d-2b4c5d6e7f80';

const recordTierEnablement = async (): Promise<void> => {
  const recorded = await env.DB.prepare(
    'SELECT id FROM audit_events WHERE id = ?',
  )
    .bind(enablementEventId)
    .first();
  if (recorded !== null) return;
  await auditRepository.append(
    auditEvent({
      id: enablementEventId,
      projectId: null,
      actorId: null,
      systemActor: 'core.deployment',
      action: 'deployment.enablement',
      targetId: 'cloudflare-free-minimum',
      result: 'success',
      requestId: enablementEventId,
      createdAt: Date.now(),
      metadata: {
        v: 1,
        acknowledgement: 'free-minimum-v1',
        outcome: 'enabled',
      },
    }),
    new AbortController().signal,
  );
};
let minimumService: Promise<MinimumPasswordService> | null = null;
const loadMinimumPasswordService = (): Promise<MinimumPasswordService> =>
  (minimumService ??= (async () => {
    await recordTierEnablement();
    return createMinimumPasswordService(keyProvider, minimumTierPasswordPolicy);
  })().catch((error: unknown) => {
    minimumService = null;
    throw error;
  }));
const minimumPassword = adaptMinimumPasswordService(loadMinimumPasswordService);
const app = createApp({
  adapter: CloudflareAdapter,
  config,
  telemetry: jsonTelemetry((line) => observations.push(line)),
  ready: async () => true,
  abuse,
  auditAppend: auditRepository.append,
  registrationStore: createD1AccountRegistrationStore(env.DB),
  minimumPassword,
  bootstrapCode: parseBootstrapEnrollmentCode(env.HYPERBUG_TEST_BOOTSTRAP_CODE),
  passkey: env.HYPERBUG_TEST_PASSKEY_RP_ID
    ? {
        rpID: env.HYPERBUG_TEST_PASSKEY_RP_ID,
        rpName: env.HYPERBUG_TEST_PASSKEY_RP_NAME,
        origin: env.HYPERBUG_TEST_PASSKEY_ORIGIN,
        store: createD1PasskeyStores(env.DB),
        passwordStore: createD1AccountRegistrationStore(env.DB),
        sessionStore: createD1AccountSessionStore(env.DB),
        keyProvider,
      }
    : null,
  staffEnrollmentStore: createD1StaffEnrollmentStore(env.DB),
  bootstrapState: async () =>
    (await createD1StaffEnrollmentStore(env.DB).countActiveStaff()) === 0,
  sessionStore: createD1AccountSessionStore(env.DB),
  passwordStore: createD1AccountRegistrationStore(env.DB),
  recoveryStore: createD1AccountRecoveryStore(env.DB),
  oauthClients: parseOAuthClients(env.HYPERBUG_TEST_OAUTH_CLIENTS),
  projectRoleStore: createD1ProjectRoleStore(env.DB),
  accountAdministration: createD1AccountAdministration(env.DB),
  oauthCodeStore: createD1OAuthStores(env.DB),
  keyProvider,
})
  .get('/_proof/observations', () =>
    observations.map((line) => JSON.parse(line)),
  )
  .compile();

// The app is compiled in global scope (workerd permits code generation only
// there); the audited activation runs once per isolate at the first request.
let tierActivation: Promise<void> | null = null;
export default {
  async fetch(request: Request) {
    tierActivation ??= loadMinimumPasswordService()
      .then(() => undefined)
      .catch((error: unknown) => {
        tierActivation = null;
        throw error;
      });
    await tierActivation;
    return app.fetch(request);
  },
};
