import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import {
  configureOptionalTurnstile,
  createApp,
  parseBootstrapEnrollmentCode,
  parseOAuthClients,
} from '@hyperbug/server';
import { assertDeploymentAvailable, loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { createCloudflareTurnstileVerifier } from './turnstile.ts';
import {
  deploymentEnablementAuditEvent,
  initialStandardPasswordPolicy,
} from '@hyperbug/security';
import { createCloudflareStandardPasswordService } from './standard-password.ts';
import { createWorkerAbuseKeyProvider } from './abuse-keys.ts';
import {
  createD1AccountRegistrationStore,
  createD1AccountRecoveryStore,
  createD1AccountSessionStore,
  createD1AuditRepository,
  createD1KeyRegistry,
  createD1OAuthStores,
  createD1PasskeyStores,
  createD1RateCounterStore,
  createD1StaffEnrollmentStore,
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
const abuse = env.DB
  ? {
      provider: createWorkerAbuseKeyProvider(env.HYPERBUG_ABUSE_KEY_RING),
      store: createD1RateCounterStore(env.DB),
      limiter: createCloudflareVolumetricLimiter(env.ABUSE_VOLUMETRIC),
      auditAppend: createD1AuditRepository(env.DB).append,
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
// Public relying-party configuration: all three values or none. A complete
// selection without the session/key prerequisites refuses startup instead of
// silently disabling passkey authentication.
const passkeyVars = env as {
  PASSKEY_RP_ID?: string;
  PASSKEY_RP_NAME?: string;
  PASSKEY_ORIGIN?: string;
};
const passkeySet = [
  passkeyVars.PASSKEY_RP_ID,
  passkeyVars.PASSKEY_RP_NAME,
  passkeyVars.PASSKEY_ORIGIN,
].filter((value) => value !== undefined).length;
if (passkeySet !== 0 && passkeySet !== 3)
  throw new Error('Invalid passkey configuration');
const passkeyConfigured = passkeySet === 3;
if (passkeyConfigured && (!env.DB || !keyProvider))
  throw new Error('Invalid passkey configuration');
const passkey =
  passkeyConfigured && env.DB && keyProvider
    ? {
        rpID: passkeyVars.PASSKEY_RP_ID as string,
        rpName: passkeyVars.PASSKEY_RP_NAME as string,
        origin: passkeyVars.PASSKEY_ORIGIN as string,
        store: createD1PasskeyStores(env.DB),
        passwordStore: createD1AccountRegistrationStore(env.DB),
        sessionStore: createD1AccountSessionStore(env.DB),
        keyProvider,
      }
    : null;
// A correctly acknowledged minimum-tier selection is warned about and its
// enablement attempt audited before the fail-closed barrier refuses startup.
// The refusal audit write is best-effort by design: a refused deployment
// never runs far enough for a D1 write to land, so the observable refusal
// trail is the deployment/startup failure itself. When activation is later
// accepted under 13.G6, this branch is replaced by the enabled outcome.
if (config.deployment.tier === 'cloudflare-free-minimum') {
  console.warn(
    `HyperBug minimum tier selected (acknowledged): degradations ${config.deployment.degradationIds.join(',')} active; tier password login is disabled (reviewed floor unmet); startup is refused until activation is accepted.`,
  );
  if (env.DB) {
    try {
      await Promise.race([
        createD1AuditRepository(env.DB).append(
          deploymentEnablementAuditEvent('refused', Date.now()),
          new AbortController().signal,
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('deadline')), 1000),
        ),
      ]);
    } catch {
      /* The audited-refusal write is best-effort; the barrier still throws. */
    }
  }
  assertDeploymentAvailable(config.deployment);
}
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
  registrationStore: accountStore,
  passwordStore: accountStore,
  sessionStore: env.DB ? createD1AccountSessionStore(env.DB) : null,
  recoveryStore: env.DB ? createD1AccountRecoveryStore(env.DB) : null,
  passkey,
  oauthClients,
  oauthCodeStore,
  bootstrapCode,
  staffEnrollmentStore,
  bootstrapState: staffEnrollmentStore
    ? async () => (await staffEnrollmentStore.countActiveStaff()) === 0
    : null,
}).compile();

export default {
  fetch(request: Request) {
    return app.fetch(request);
  },
  async scheduled(_controller: ScheduledController, bindings: Env) {
    if (!bindings.DB) throw new Error('Rate counter cleanup unavailable');
    await createD1RateCounterStore(bindings.DB).purgeExpired(Date.now(), 1000);
  },
} satisfies ExportedHandler<Env>;
