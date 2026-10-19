import { browserR2Capabilities } from './web-r2-capabilities.ts';
import { browserUploadAction } from './web-upload-control.ts';
import { configureWorkerAttachmentScanner } from '../../apps/api-cloudflare/src/attachment-scanner.ts';
import { passkeyCaptcha } from './passkey-captcha.ts';
import { configureWorkerUploads } from '../../apps/api-cloudflare/src/uploads.ts';
import { uploadProof } from './upload-proof.ts';
import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import {
  createApp,
  createBoundMinimumLoginAdmission,
  parseBootstrapEnrollmentCode,
  parseOAuthClients,
  publishPluginEvent,
} from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { createCloudflareStandardPasswordService } from '../../apps/api-cloudflare/src/standard-password.ts';
import { createWorkerAbuseKeyProvider } from '../../apps/api-cloudflare/src/abuse-keys.ts';
import { createCloudflareVolumetricLimiter } from '../../apps/api-cloudflare/src/rate-limit.ts';
import {
  createD1AccountAdministration,
  createD1AccountLockoutStore,
  createD1AccountRecoveryStore,
  createD1AuditRepository,
  createD1OAuthStores,
  createD1PasskeyStores,
  createD1PluginRegistryStore,
  createD1PluginEventOutbox,
  createD1PluginSettingsStore,
  createD1ProjectRoleStore,
  createD1ProjectStore,
  createD1Repository,
  createD1SearchStore,
  createD1SearchIndexStore,
  createD1CommentStore,
  createD1ReactionStore,
  createD1TimelineStore,
  createD1TaxonomyStore,
  createD1ContentDefinitionStore,
  createD1AttachmentStore,
  createD1AccountRegistrationStore,
  createD1AccountSessionStore,
  createD1KeyRegistry,
  createD1RateCounterStore,
  createD1StaffEnrollmentStore,
} from '@hyperbug/database-d1';
import { createWorkerKeyProvider } from '../../apps/api-cloudflare/src/key-provider.ts';
import { boundedD1 } from './d1-bind-guard.ts';
import { createCaptchaGate } from '../../packages/server/src/captcha.ts';
import {
  adaptMinimumPasswordService,
  createMinimumPasswordService,
  minimumTierPasswordPolicy,
  minimumTierAccountLockoutPolicy,
  auditEvent,
  type MinimumPasswordService,
} from '../../packages/security/src/index.ts';

const db = boundedD1(env.DB);

const uploads = configureWorkerUploads(
  db,
  env as unknown as Parameters<typeof configureWorkerUploads>[1],
);
if (uploads && env.HYPERBUG_TEST_BROWSER_UPLOAD_ENDPOINT) {
  const selected = JSON.parse(env.HYPERBUG_UPLOAD_STORAGE);
  uploads.capabilities = browserR2Capabilities(
    env.HYPERBUG_TEST_BROWSER_UPLOAD_ENDPOINT,
    selected.bucket,
    selected.credentials,
  );
}
const captcha =
  env.HYPERBUG_TEST_PASSKEY_CAPTCHA === '1'
    ? passkeyCaptcha('auth.poc.example')
    : null;
const config = loadConfig(env, 'cloudflare');
const observations: string[] = [];
const abuse = {
  provider: createWorkerAbuseKeyProvider(env.HYPERBUG_ABUSE_KEY_RING),
  store: createD1RateCounterStore(db),
  limiter: createCloudflareVolumetricLimiter(env.ABUSE_VOLUMETRIC),
  // Test-only ingress assertion. The production root has no accepted resolver.
  clientAddress: () => '192.0.2.42',
};

// The same integrated journey may select Minimum explicitly. Its activation,
// password and lockout controls mirror the production root; no provider-plan
// CPU enforcement is simulated here.
const keyProvider = env.HYPERBUG_KEY_RING
  ? createWorkerKeyProvider(env.HYPERBUG_KEY_RING, createD1KeyRegistry(db))
  : null;
const minimum = config.deployment.tier === 'cloudflare-minimum';
let minimumService: Promise<MinimumPasswordService> | null = null;
const activateMinimum = () =>
  (minimumService ??= (async () => {
    if (!keyProvider) throw new Error('Minimum requires a key provider');
    const id = '80fad34e-66c5-4c63-a0c1-1a2e7a35b3f2';
    if (
      !(await db
        .prepare('SELECT id FROM audit_events WHERE id = ?')
        .bind(id)
        .first())
    )
      await createD1AuditRepository(db).append(
        auditEvent({
          id,
          projectId: null,
          actorId: null,
          systemActor: 'core.deployment',
          action: 'deployment.enablement',
          targetId: 'cloudflare-minimum',
          result: 'success',
          requestId: id,
          createdAt: Date.now(),
          metadata: { v: 1, acknowledgement: 'minimum-v2', outcome: 'enabled' },
        }),
        new AbortController().signal,
      );
    console.warn(
      'Minimum fixture explicitly acknowledged; independent 13.G6 remains open',
    );
    return createMinimumPasswordService(
      keyProvider,
      minimumTierPasswordPolicy,
      10,
    );
  })().catch((error: unknown) => {
    minimumService = null;
    throw error;
  }));
const app = createApp({
  adapter: CloudflareAdapter,
  config,
  telemetry: jsonTelemetry((line) => observations.push(line)),
  ready: async () => true,
  abuse,
  ...(captcha
    ? { captcha: captcha.gate, captchaSiteKey: captcha.siteKey }
    : {}),
  registrationStore: createD1AccountRegistrationStore(db),
  standardPassword: minimum
    ? null
    : createCloudflareStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
  minimumPassword: minimum
    ? adaptMinimumPasswordService(activateMinimum)
    : null,
  minimumLoginAdmission: minimum
    ? createBoundMinimumLoginAdmission(
        captcha?.gate ?? createCaptchaGate(),
        {
          lockout: minimumTierAccountLockoutPolicy,
          rateTimeoutMs: 1000,
          lockoutTimeoutMs: 1000,
        },
        {
          provider: abuse.provider,
          rateStore: abuse.store,
          lockoutStore: createD1AccountLockoutStore(db),
          clientAddress: abuse.clientAddress,
        },
      )
    : null,
  bootstrapCode: parseBootstrapEnrollmentCode(env.HYPERBUG_TEST_BOOTSTRAP_CODE),
  passkey: env.HYPERBUG_TEST_PASSKEY_RP_ID
    ? {
        rpID: env.HYPERBUG_TEST_PASSKEY_RP_ID,
        rpName: env.HYPERBUG_TEST_PASSKEY_RP_NAME,
        origin: env.HYPERBUG_TEST_PASSKEY_ORIGIN,
        store: createD1PasskeyStores(db),
        passwordStore: createD1AccountRegistrationStore(db),
        sessionStore: createD1AccountSessionStore(db),
        keyProvider: env.HYPERBUG_KEY_RING
          ? createWorkerKeyProvider(
              env.HYPERBUG_KEY_RING,
              createD1KeyRegistry(db),
            )
          : null,
      }
    : null,
  staffEnrollmentStore: createD1StaffEnrollmentStore(db),
  bootstrapState: async () =>
    (await createD1StaffEnrollmentStore(db).countActiveStaff()) === 0,
  sessionStore: createD1AccountSessionStore(db),
  passwordStore: createD1AccountRegistrationStore(db),
  recoveryStore: createD1AccountRecoveryStore(db),
  oauthClients: parseOAuthClients(env.HYPERBUG_TEST_OAUTH_CLIENTS),
  pluginRegistry: createD1PluginRegistryStore(db),
  pluginSettings: createD1PluginSettingsStore(db),
  pluginEventOutbox: createD1PluginEventOutbox(db),
  projectRoleStore: createD1ProjectRoleStore(db),
  projectStore: createD1ProjectStore(db),
  issueRepository: createD1Repository(db),
  searchStore: createD1SearchStore(db),
  searchIndexStore: createD1SearchIndexStore(db),
  commentStore: createD1CommentStore(db),
  reactionStore: createD1ReactionStore(db),
  timelineStore: createD1TimelineStore(db),
  taxonomyStore: createD1TaxonomyStore(db),
  contentDefinitionStore: createD1ContentDefinitionStore(db),
  attachmentStore: createD1AttachmentStore(db),
  mediaOrigin: uploads
    ? (env.HYPERBUG_TEST_BROWSER_MEDIA_ORIGIN ?? 'https://media.poc.invalid')
    : null,
  uploads,
  accountAdministration: createD1AccountAdministration(db),
  auditAppend: createD1AuditRepository(db).append,
  auditRepository: createD1AuditRepository(db),
  oauthCodeStore: createD1OAuthStores(db),
  keyProvider: env.HYPERBUG_KEY_RING
    ? createWorkerKeyProvider(env.HYPERBUG_KEY_RING, createD1KeyRegistry(db))
    : null,
})
  .post('/_proof/upload', async ({ body, set }) => {
    try {
      if (!uploads) throw new Error();
      const scope = await db
        .prepare(
          'SELECT id, project_id AS projectId, principal_id AS principalId FROM upload_intents WHERE id = ?',
        )
        .bind(String(body.id))
        .first<{ id: string; projectId: string; principalId: string }>();
      if (!scope) throw new Error();
      if (
        env.HYPERBUG_TEST_BROWSER_UPLOAD_ENDPOINT &&
        String(body.operation).startsWith('browser-')
      ) {
        const query = async (sql: string, values: (string | number)[] = []) =>
          (
            await db
              .prepare(sql)
              .bind(...values)
              .all<Record<string, unknown>>()
          ).results;
        const scanner = configureWorkerAttachmentScanner(
          env.HYPERBUG_TEST_BROWSER_SCANNER,
          env.HYPERBUG_TEST_BROWSER_SCANNER_SECRET,
        );
        await browserUploadAction(
          uploads,
          query,
          scanner,
          scope.id,
          String(body.operation).slice(8),
        );
        return { completed: true };
      }
      return await uploadProof(
        uploads,
        scope,
        String(body.operation),
        String(body.text ?? ''),
        body.failDelete === true,
      );
    } catch {
      set.status = 503;
      return { error: 'Upload proof failed' };
    }
  })
  .get('/_proof/observations', () =>
    observations.map((line) => JSON.parse(line)),
  )
  // Test-only trigger for the internal plugin-event publication service; the
  // production surface has no such endpoint (business actions own triggers).
  .post('/_proof/publish-plugin-event', async ({ body, set }) => {
    try {
      const result = await publishPluginEvent(
        {
          registry: createD1PluginRegistryStore(db),
          events: createD1PluginEventOutbox(db),
        },
        {
          pluginId: String(body.pluginId),
          point: String(body.point),
          payload: body.payload ?? null,
        },
      );
      return result;
    } catch (error) {
      set.status = error instanceof Error && 'code' in error ? 409 : 500;
      return { error: String(error) };
    }
  })
  .compile();

export default {
  async fetch(request: Request) {
    if (minimum) await activateMinimum();
    return app.fetch(request);
  },
};
