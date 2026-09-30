import { listenNode } from './listen.ts';
import { closeRejectedNodeRequest } from './rejected-request.ts';
import { node } from '@elysia/node';
import {
  configureOptionalTurnstile,
  createApp,
  parseOAuthClients,
} from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { createNodeTurnstileVerifier } from './turnstile.ts';
import { initialStandardPasswordPolicy } from '@hyperbug/security';
import { createNodeStandardPasswordService } from './standard-password.ts';
import { configureNodeAbuseAdmission } from './abuse-admission.ts';
import { loadNodeBootstrapEnrollmentCode } from './bootstrap.ts';

const config = loadConfig(process.env, 'node');
const captcha = configureOptionalTurnstile(
  {
    secret: process.env.TURNSTILE_SECRET,
    siteKey: process.env.TURNSTILE_SITE_KEY,
    hostname: process.env.TURNSTILE_HOSTNAME,
    environment: config.environment,
  },
  createNodeTurnstileVerifier,
);
const standardPassword = createNodeStandardPasswordService(
  config.deployment,
  initialStandardPasswordPolicy,
  1,
  initialStandardPasswordPolicy.maximum.memoryKiB,
);
const abuse = configureNodeAbuseAdmission(
  {
    databaseUrl: process.env.HYPERBUG_DATABASE_URL,
    socketDirectory: process.env.HYPERBUG_DATABASE_SOCKET_DIR,
    databaseName: process.env.HYPERBUG_DATABASE_NAME,
    databaseUser: process.env.HYPERBUG_DATABASE_USER,
    keyFile: process.env.HYPERBUG_ABUSE_KEY_FILE,
    keyProviderFile: process.env.HYPERBUG_KEY_FILE,
  },
  config.environment,
);
const keyProvider = abuse.keyProvider;
const bootstrapCode = await loadNodeBootstrapEnrollmentCode(
  process.env.HYPERBUG_BOOTSTRAP_FILE,
);
// Public relying-party configuration: all three values or none; a complete
// selection without the session/key prerequisites refuses startup.
const passkeyValues = [
  process.env.PASSKEY_RP_ID,
  process.env.PASSKEY_RP_NAME,
  process.env.PASSKEY_ORIGIN,
];
const passkeySet = passkeyValues.filter((value) => value !== undefined).length;
if (passkeySet !== 0 && passkeySet !== 3)
  throw new Error('Invalid passkey configuration');
const passkeyConfigured = passkeySet === 3;
if (
  passkeyConfigured &&
  (!abuse.passkeyStores || !keyProvider || !abuse.sessionStore)
)
  throw new Error('Invalid passkey configuration');
const passkey =
  passkeyConfigured && abuse.passkeyStores && keyProvider && abuse.sessionStore
    ? {
        rpID: passkeyValues[0] as string,
        rpName: passkeyValues[1] as string,
        origin: passkeyValues[2] as string,
        store: abuse.passkeyStores,
        passwordStore: abuse.passwordStore!,
        sessionStore: abuse.sessionStore,
        keyProvider,
      }
    : null;
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid PORT');
// Optional registered public clients: absent disarms the code flow; a present
// but malformed registry refuses startup instead of running a broken flow.
const oauthClients = parseOAuthClients(process.env.HYPERBUG_OAUTH_CLIENTS);
const app = createApp({
  adapter: node(),
  config,
  telemetry: jsonTelemetry((line) => console.log(line)),
  ready: (signal) => abuse.ready(signal),
  onRejectedRequest: closeRejectedNodeRequest,
  captcha: captcha.gate,
  captchaSiteKey: captcha.siteKey,
  abuse: abuse.abuse,
  keyProvider,
  standardPassword,
  registrationStore: abuse.registrationStore,
  passwordStore: abuse.passwordStore,
  sessionStore: abuse.sessionStore,
  bootstrapCode,
  staffEnrollmentStore: abuse.staffEnrollmentStore,
  recoveryStore: abuse.recoveryStore,
  projectRoleStore: abuse.projectRoleStore,
  accountAdministration: abuse.accountAdministration,
  passkey,
  oauthClients,
  oauthCodeStore: abuse.oauthCodeStore,
  bootstrapState: abuse.staffEnrollmentStore
    ? async () => (await abuse.staffEnrollmentStore?.countActiveStaff()) === 0
    : null,
});
let listener: Awaited<ReturnType<typeof listenNode>>;
try {
  listener = await listenNode(app, port, process.env.HOST ?? '127.0.0.1');
} catch (error) {
  await abuse.close();
  throw error;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void Promise.allSettled([listener.close(), abuse.close()]);
  });
