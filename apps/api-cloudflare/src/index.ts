import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import {
  configureOptionalTurnstile,
  createApp,
  parseBootstrapEnrollmentCode,
  parseOAuthClients,
  parsePasskeyConfiguration,
} from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { createCloudflareTurnstileVerifier } from './turnstile.ts';
import {
  adaptMinimumPasswordService,
  auditEvent,
  createMinimumPasswordService,
  initialStandardPasswordPolicy,
  minimumTierPasswordPolicy,
  type MinimumPasswordService,
} from '@hyperbug/security';
import { createCloudflareStandardPasswordService } from './standard-password.ts';
import { createWorkerAbuseKeyProvider } from './abuse-keys.ts';
import {
  createD1AccountAdministration,
  createD1AccountRegistrationStore,
  createD1AccountRecoveryStore,
  createD1AccountSessionStore,
  createD1AuditRepository,
  createD1KeyRegistry,
  createD1OAuthStores,
  createD1PasskeyStores,
  createD1PluginRegistryStore,
  createD1PluginEventOutbox,
  createD1PluginSettingsStore,
  createD1ProjectRoleStore,
  createD1ProjectStore,
  createD1RateCounterStore,
  createD1StaffEnrollmentStore,
  createD1TaxonomyStore,
} from '@hyperbug/database-d1';
import { createCloudflareVolumetricLimiter } from './rate-limit.ts';
import { createWorkerKeyProvider } from './key-provider.ts';
import { createIngressAttestation } from './ingress-attestation.ts';

// Workers permits AOT compilation during module initialization, before requests.
const config = loadConfig(env, 'cloudflare');
const captcha = configureOptionalTurnstile(
  {
    secret: env.TURNSTILE_SECRET,
    siteKey: env.TURNSTILE_SITE_KEY,
    hostname: env.TURNSTILE_HOSTNAME,
    environment: config.environment,
  },
  createCloudflareTurnstileVerifier,
);
const standardPassword =
  config.deployment.tier === 'standard'
    ? createCloudflareStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      )
    : undefined;
const auditRepository = env.DB ? createD1AuditRepository(env.DB) : null;
const abuse = env.DB
  ? {
      provider: createWorkerAbuseKeyProvider(env.HYPERBUG_ABUSE_KEY_RING),
      store: createD1RateCounterStore(env.DB),
      limiter: createCloudflareVolumetricLimiter(env.ABUSE_VOLUMETRIC),
      auditAppend: auditRepository?.append ?? null,
    }
  : null;
const keyProvider = env.DB
  ? createWorkerKeyProvider(env.HYPERBUG_KEY_RING, createD1KeyRegistry(env.DB))
  : null;
const ingress = env.HYPERBUG_INGRESS_KEY
  ? createIngressAttestation(env.HYPERBUG_INGRESS_KEY)
  : null;
const accountStore = env.DB ? createD1AccountRegistrationStore(env.DB) : null;
// Optional operator-channel enrollment code: absent disarms the bootstrap
// route; a present but malformed value must refuse startup instead of
// silently disabling enrollment. Not declared required anywhere, so the
// binding is read through a narrowed view of the generated environment.
const bootstrapSecret = (
  env as {
    HYPERBUG_BOOTSTRAP_ENROLLMENT?: string;
  }
).HYPERBUG_BOOTSTRAP_ENROLLMENT;
const bootstrapCode =
  bootstrapSecret === undefined
    ? null
    : parseBootstrapEnrollmentCode(bootstrapSecret);
if (bootstrapSecret !== undefined && bootstrapCode === null)
  throw new Error('Invalid bootstrap enrollment configuration');
const staffEnrollmentStore = env.DB
  ? createD1StaffEnrollmentStore(env.DB)
  : null;
// Optional registered public clients: absent disarms the code flow; a present
// but malformed registry refuses startup instead of running a broken flow.
// Not declared required anywhere, so the binding is read through a narrowed
// view of the generated environment.
const oauthSecret = (
  env as {
    HYPERBUG_OAUTH_CLIENTS?: string;
  }
).HYPERBUG_OAUTH_CLIENTS;
const oauthClients = parseOAuthClients(oauthSecret);
if (oauthClients.length > 0 && (!env.DB || !keyProvider))
  throw new Error('Invalid OAuth client configuration');
const oauthCodeStore = env.DB ? createD1OAuthStores(env.DB) : null;
const projectRoleStore = env.DB ? createD1ProjectRoleStore(env.DB) : null;
const projectStore = env.DB ? createD1ProjectStore(env.DB) : null;
const taxonomyStore = env.DB ? createD1TaxonomyStore(env.DB) : null;
const pluginRegistry = env.DB ? createD1PluginRegistryStore(env.DB) : null;
const pluginSettings = env.DB ? createD1PluginSettingsStore(env.DB) : null;
const pluginEventOutbox = env.DB ? createD1PluginEventOutbox(env.DB) : null;
const accountAdministration = env.DB
  ? createD1AccountAdministration(env.DB)
  : null;
// A complete relying-party selection without the session/key prerequisites
// refuses startup instead of silently disabling passkey authentication.
// Not declared required anywhere, so the bindings are read through a
// narrowed view of the generated environment.
const passkeyVars = env as {
  PASSKEY_RP_ID?: string;
  PASSKEY_RP_NAME?: string;
  PASSKEY_ORIGIN?: string;
};
const passkeyConfig = parsePasskeyConfiguration({
  rpId: passkeyVars.PASSKEY_RP_ID,
  rpName: passkeyVars.PASSKEY_RP_NAME,
  origin: passkeyVars.PASSKEY_ORIGIN,
});
if (passkeyConfig && (!env.DB || !keyProvider))
  throw new Error('Invalid passkey configuration');
const passkey =
  passkeyConfig && env.DB && keyProvider
    ? {
        ...passkeyConfig,
        store: createD1PasskeyStores(env.DB),
        passwordStore: createD1AccountRegistrationStore(env.DB),
        sessionStore: createD1AccountSessionStore(env.DB),
        keyProvider,
      }
    : null;
// A correctly acknowledged minimum-tier selection is activated through the
// audited enablement contract: the startup warning, one persisted
// deployment.enablement event (a deterministic id makes cold starts
// idempotent — only the first request of the first isolate writes it) and
// the peppered password service preflight through the loader-based adapter.
const minimumTierEnabled = config.deployment.tier === 'cloudflare-free-minimum';
const enablementEventId = '5ee1a0d2-7c3b-4f68-9a1d-2b4c5d6e7f80';
if (minimumTierEnabled)
  console.warn(
    `HyperBug minimum tier enabled (acknowledged): degradations ${config.deployment.degradationIds.join(',')} active; tier password login is disabled (reviewed floor unmet); the tier runs without independent 13.G6 acceptance.`,
  );
const recordTierEnablement = async (): Promise<void> => {
  const recorded = await env
    .DB!.prepare('SELECT id FROM audit_events WHERE id = ?')
    .bind(enablementEventId)
    .first();
  if (recorded !== null) return;
  try {
    await auditRepository!.append(
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
  } catch {
    // A racing cold start may have written the same deterministic id.
    const raced = await env
      .DB!.prepare('SELECT id FROM audit_events WHERE id = ?')
      .bind(enablementEventId)
      .first();
    if (raced === null)
      throw new Error('The minimum tier enablement audit write failed');
  }
};
let minimumService: Promise<MinimumPasswordService> | null = null;
const loadMinimumPasswordService = (): Promise<MinimumPasswordService> =>
  (minimumService ??= (async () => {
    // Runtime prerequisite check: the audited activation needs the database,
    // its audit repository and the key provider. (Cloudflare's upload-time
    // module validation runs without live bindings, so a module-scope check
    // here would falsely refuse valid uploads; this runs per isolate.)
    if (!env.DB || !auditRepository || !keyProvider)
      throw new Error('The minimum tier requires its audited enablement trail');
    await recordTierEnablement();
    return createMinimumPasswordService(
      keyProvider!,
      minimumTierPasswordPolicy,
    );
  })().catch((error: unknown) => {
    minimumService = null;
    throw error;
  }));
const minimumPassword = minimumTierEnabled
  ? adaptMinimumPasswordService(loadMinimumPasswordService)
  : null;

const app = createApp({
  adapter: CloudflareAdapter,
  config,
  telemetry: jsonTelemetry((line) => console.log(line)),
  ready: async (signal) => {
    if (
      !abuse ||
      !env.DB ||
      typeof env.ABUSE_VOLUMETRIC?.limit !== 'function' ||
      signal.aborted
    )
      return false;
    try {
      await abuse.provider.active(signal);
      if (signal.aborted) return false;
      if (!keyProvider) return false;
      await keyProvider.current('token-hmac');
      if (signal.aborted) return false;
      const result = await env.DB.prepare(
        'SELECT 1 FROM rate_limit_counters, password_credentials, authorization_sessions LIMIT 0',
      ).all();
      return !signal.aborted && result.success === true;
    } catch {
      return false;
    }
  },
  captcha: captcha.gate,
  captchaSiteKey: captcha.siteKey,
  abuse: abuse
    ? {
        ...abuse,
        ...(ingress ? { clientAddress: ingress.verify } : {}),
      }
    : null,
  keyProvider,
  standardPassword: standardPassword ?? null,
  minimumPassword,
  registrationStore: accountStore,
  passwordStore: accountStore,
  sessionStore: env.DB ? createD1AccountSessionStore(env.DB) : null,
  recoveryStore: env.DB ? createD1AccountRecoveryStore(env.DB) : null,
  passkey,
  oauthClients,
  oauthCodeStore,
  projectRoleStore,
  projectStore,
  taxonomyStore,
  pluginRegistry,
  pluginSettings,
  pluginEventOutbox,
  accountAdministration,
  auditAppend: auditRepository?.append ?? null,
  bootstrapCode,
  staffEnrollmentStore,
  bootstrapState: staffEnrollmentStore
    ? async () => (await staffEnrollmentStore.countActiveStaff()) === 0
    : null,
}).compile();

// The app is compiled during module initialization — workerd permits
// dynamic code generation only in global scope — while the tier's audited
// activation above needs async D1 work that global scope forbids, so it runs
// once per isolate at the first request and every request waits for it. A
// failed activation is not memoized and fails every request closed — the
// effective startup gate; readiness stays unreachable while it fails.
// Activation never implies the independent 13.G6 acceptance or tier support.
let tierActivation: Promise<void> | null = null;
const ensureTierActivated = (): Promise<void> =>
  (tierActivation ??= loadMinimumPasswordService()
    .then(() => undefined)
    .catch((error: unknown) => {
      tierActivation = null;
      throw error;
    }));

export default {
  async fetch(request: Request) {
    if (minimumTierEnabled) await ensureTierActivated();
    return app.fetch(request);
  },
  async scheduled(_controller: ScheduledController, bindings: Env) {
    if (!bindings.DB) throw new Error('Rate counter cleanup unavailable');
    await createD1RateCounterStore(bindings.DB).purgeExpired(Date.now(), 1000);
  },
} satisfies ExportedHandler<Env>;
