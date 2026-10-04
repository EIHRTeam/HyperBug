import { configureWorkerUploads } from '../../apps/api-cloudflare/src/uploads.ts';
import { uploadProof } from './upload-proof.ts';
import { env } from 'cloudflare:workers';
import { CloudflareAdapter } from 'elysia/adapter/cloudflare-worker';
import {
  createApp,
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

const uploads = configureWorkerUploads(
  env.DB,
  env as unknown as Parameters<typeof configureWorkerUploads>[1],
);
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
  oauthClients: parseOAuthClients(env.HYPERBUG_TEST_OAUTH_CLIENTS),
  pluginRegistry: createD1PluginRegistryStore(env.DB),
  pluginSettings: createD1PluginSettingsStore(env.DB),
  pluginEventOutbox: createD1PluginEventOutbox(env.DB),
  projectRoleStore: createD1ProjectRoleStore(env.DB),
  projectStore: createD1ProjectStore(env.DB),
  issueRepository: createD1Repository(env.DB),
  commentStore: createD1CommentStore(env.DB),
  reactionStore: createD1ReactionStore(env.DB),
  timelineStore: createD1TimelineStore(env.DB),
  taxonomyStore: createD1TaxonomyStore(env.DB),
  contentDefinitionStore: createD1ContentDefinitionStore(env.DB),
  attachmentStore: createD1AttachmentStore(env.DB),
  mediaOrigin: uploads ? 'https://media.poc.invalid' : null,
  uploads,
  accountAdministration: createD1AccountAdministration(env.DB),
  auditAppend: createD1AuditRepository(env.DB).append,
  oauthCodeStore: createD1OAuthStores(env.DB),
  keyProvider: env.HYPERBUG_KEY_RING
    ? createWorkerKeyProvider(
        env.HYPERBUG_KEY_RING,
        createD1KeyRegistry(env.DB),
      )
    : null,
})
  .post('/_proof/upload', async ({ body, set }) => {
    try {
      if (!uploads) throw new Error();
      const scope = await env.DB.prepare(
        'SELECT id, project_id AS projectId, principal_id AS principalId FROM upload_intents WHERE id = ?',
      )
        .bind(String(body.id))
        .first<{ id: string; projectId: string; principalId: string }>();
      if (!scope) throw new Error();
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
          registry: createD1PluginRegistryStore(env.DB),
          events: createD1PluginEventOutbox(env.DB),
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
