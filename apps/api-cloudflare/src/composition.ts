import { expiredCleanupBatchSize } from '@hyperbug/application';
import { configureWorkerUploads } from './uploads.ts';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import {
  configureOptionalTurnstile,
  createApp,
  parseBootstrapEnrollmentCode,
  parseOAuthClients,
  parsePasskeyConfiguration,
  createBoundMinimumLoginAdmission,
} from '@hyperbug/server';
import { loadConfig, type DeploymentConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { createCloudflareTurnstileVerifier } from './turnstile.ts';
import {
  adaptMinimumPasswordService,
  auditEvent,
  createMinimumPasswordService,
  withMinimumPasswordUpgrade,
  minimumTierAccountLockoutPolicy,
  type AccountPasswordService,
  minimumTierPasswordPolicy,
  type MinimumPasswordService,
} from '@hyperbug/security';
import { createWorkerAbuseKeyProvider } from './abuse-keys.ts';
import {
  createD1AccountAdministration,
  createD1AccountLockoutStore,
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
  createD1Repository,
  createD1SearchStore,
  createD1CommentStore,
  createD1ReactionStore,
  createD1TimelineStore,
  createD1RateCounterStore,
  createD1ExpiredCleanupStore,
  createD1StaffEnrollmentStore,
  createD1TaxonomyStore,
  createD1ContentDefinitionStore,
  createD1AttachmentStore,
} from '@hyperbug/database-d1';
import { createCloudflareVolumetricLimiter } from './rate-limit.ts';
import { createWorkerKeyProvider } from './key-provider.ts';
import { createIngressAttestation } from './ingress-attestation.ts';

export function createCloudflareApi(
  env: Env,
  standardFactory?: (deployment: DeploymentConfig) => AccountPasswordService,
) {
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
    ? createWorkerKeyProvider(
        env.HYPERBUG_KEY_RING,
        createD1KeyRegistry(env.DB),
        config.security.authorization.timeoutMs,
      )
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
  const issueRepository = env.DB ? createD1Repository(env.DB) : null;
  const commentStore = env.DB ? createD1CommentStore(env.DB) : null;
  const reactionStore = env.DB ? createD1ReactionStore(env.DB) : null;
  const timelineStore = env.DB ? createD1TimelineStore(env.DB) : null;
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
  const minimumTierEnabled = config.deployment.tier === 'cloudflare-minimum';
  const enablementEventId = '80fad34e-66c5-4c63-a0c1-1a2e7a35b3f2';
  if (minimumTierEnabled)
    console.warn(
      `HyperBug minimum tier enabled (acknowledged): degradations ${config.deployment.degradationIds.join(',')} active; PBKDF2 passwords use the disclosed Minimum exception; the tier runs without independent 13.G6 acceptance.`,
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
          targetId: 'cloudflare-minimum',
          result: 'success',
          requestId: enablementEventId,
          createdAt: Date.now(),
          metadata: {
            v: 1,
            acknowledgement: 'minimum-v2',
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
        throw new Error(
          'The minimum tier requires its audited enablement trail',
        );
      await recordTierEnablement();
      return createMinimumPasswordService(
        keyProvider!,
        minimumTierPasswordPolicy,
        // B15's ten-login burst exposed single-slot saturation; bound native
        // PBKDF2 work separately from durable account/IP admission.
        10,
      );
    })().catch((error: unknown) => {
      minimumService = null;
      throw error;
    }));
  const minimumPassword = minimumTierEnabled
    ? adaptMinimumPasswordService(loadMinimumPasswordService)
    : null;

  const standardPassword =
    config.deployment.tier === 'standard'
      ? (() => {
          if (!standardFactory)
            throw new Error(
              'The Minimum entry requires cloudflare-minimum configuration',
            );
          const standard = standardFactory(config.deployment);
          return keyProvider
            ? withMinimumPasswordUpgrade(
                standard,
                adaptMinimumPasswordService(() =>
                  createMinimumPasswordService(
                    keyProvider,
                    minimumTierPasswordPolicy,
                  ),
                ),
              )
            : standard;
        })()
      : null;
  const minimumLoginAdmission = minimumTierEnabled
    ? createBoundMinimumLoginAdmission(
        captcha.gate,
        {
          lockout: minimumTierAccountLockoutPolicy,
          rateTimeoutMs: config.security.authorization.timeoutMs,
          lockoutTimeoutMs: config.security.authorization.timeoutMs,
        },
        abuse && env.DB
          ? {
              provider: abuse.provider,
              rateStore: abuse.store,
              lockoutStore: createD1AccountLockoutStore(env.DB),
              ...(ingress ? { clientAddress: ingress.verify } : {}),
            }
          : null,
      )
    : null;
  const uploads = configureWorkerUploads(
    env.DB ?? null,
    env as unknown as Parameters<typeof configureWorkerUploads>[1],
  );
  const app = createApp({
    adapter: CloudflareAdapter,
    config,
    telemetry: jsonTelemetry((line) => console.log(line)),
    ready: async (signal) => {
      if (minimumTierEnabled && !activationComplete) return false;
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
    minimumLoginAdmission,
    registrationStore: accountStore,
    passwordStore: accountStore,
    sessionStore: env.DB ? createD1AccountSessionStore(env.DB) : null,
    recoveryStore: env.DB ? createD1AccountRecoveryStore(env.DB) : null,
    passkey,
    oauthClients,
    oauthCodeStore,
    projectRoleStore,
    projectStore,
    issueRepository,
    searchStore: env.DB ? createD1SearchStore(env.DB) : null,
    commentStore,
    reactionStore,
    timelineStore,
    taxonomyStore,
    contentDefinitionStore: env.DB
      ? createD1ContentDefinitionStore(env.DB)
      : null,
    attachmentStore: env.DB ? createD1AttachmentStore(env.DB) : null,
    mediaOrigin:
      (env as { HYPERBUG_MEDIA_ORIGIN?: string }).HYPERBUG_MEDIA_ORIGIN ?? null,
    uploads,
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

  // Request-local I/O starts lazily; only sensitive routes wait for activation.
  let activationComplete = false;
  let tierActivation: Promise<void> | null = null;
  const ensureTierActivated = (): Promise<void> =>
    (tierActivation ??= loadMinimumPasswordService()
      .then(() => {
        activationComplete = true;
      })
      .catch((error: unknown) => {
        tierActivation = null;
        throw error;
      }));

  return {
    async fetch(request: Request) {
      void uploads?.intents;
      if (minimumTierEnabled) {
        const path = new URL(request.url).pathname;
        const publicRead =
          (request.method === 'GET' || request.method === 'HEAD') &&
          !request.headers.has('authorization') &&
          !request.headers.has('cookie') &&
          path.startsWith('/api/v1/') &&
          !path.startsWith('/api/v1/account') &&
          !path.startsWith('/api/v1/admin');
        const activationExempt =
          path === '/health/live' ||
          path === '/health/ready' ||
          path === '/api/v1/instance' ||
          publicRead ||
          request.method === 'OPTIONS';
        if (!activationExempt) await ensureTierActivated();
      }
      return app.fetch(request);
    },
    async scheduled(_controller: ScheduledController, bindings: Env) {
      if (!bindings.DB) throw new Error('Expired cleanup unavailable');
      const cleanupConfig = loadConfig(bindings, 'cloudflare');
      await createD1ExpiredCleanupStore(bindings.DB).purgeExpired(
        Date.now(),
        cleanupConfig.security.retentionSeconds.expiredSessions * 1000,
        expiredCleanupBatchSize,
      );
    },
  } satisfies ExportedHandler<Env>;
}
