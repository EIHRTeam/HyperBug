import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';

// 05.2a non-audit scope: the deployment-level plugin registry and its
// management endpoints on workerd/D1. Plugin administration is sensitive
// administration — recent authentication is enforced — and the suspended
// module-05 audit scope must stay silent (no plugin.* audit events).
const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const projectId = crypto.randomUUID();
let mf: Miniflare;
let authenticator: Awaited<ReturnType<typeof createFakeAuthenticator>>;

const post = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
      ...extra,
    },
    body: JSON.stringify(body),
  });

const call = (
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
      ...(init.token === undefined
        ? {}
        : { authorization: `Bearer ${init.token}` }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

const verifier = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const challengeOf = async (value: string) =>
  btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
      ),
    ),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

const form = (path: string, fields: Record<string, string>) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: authOrigin,
    },
    body: new URLSearchParams(fields),
  });

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'plugins-cli',
      redirectUri,
      scope: 'public-api',
      state,
      codeChallenge: await challengeOf(journeyVerifier),
    },
    { cookie },
  );
  expect(authorized.status).toBe(200);
  const code = new URL(
    ((await authorized.json()) as { redirectUri: string }).redirectUri,
  ).searchParams.get('code');
  const exchange = await form('/auth/token', {
    grant_type: 'authorization_code',
    code: code ?? '',
    redirect_uri: redirectUri,
    client_id: 'plugins-cli',
    code_verifier: journeyVerifier,
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

const zeroSettingsManifest = {
  id: '@hyperbug/sample',
  version: '1.0.0',
  trustTier: 'trusted-native',
  apiVersion: '^1.0.0',
  capabilities: ['notifications'],
  extensionPoints: [],
  permissions: [],
  settings: [],
};
const configuredManifest = {
  ...zeroSettingsManifest,
  id: '@hyperbug/configd',
  settings: [
    { key: 'api-key', kind: 'secret' },
    { key: 'threshold', kind: 'public', valueType: 'number' },
  ],
};

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/account-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      ratelimits: {
        ABUSE_VOLUMETRIC: {
          namespace_id: '703415',
          simple: { limit: 1000, period: 60 },
        },
      },
      bindings: {
        HYPERBUG_ENV: 'local',
        ALLOWED_ORIGINS: authOrigin,
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_TEST_OAUTH_CLIENTS: JSON.stringify([
          {
            clientId: 'plugins-cli',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
        HYPERBUG_TEST_PASSKEY_RP_ID: 'auth.poc.example',
        HYPERBUG_TEST_PASSKEY_RP_NAME: 'HyperBug Plugins PoC',
        HYPERBUG_TEST_PASSKEY_ORIGIN: authOrigin,
      },
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  for (const purpose of ['token-hmac', 'envelope-kek'])
    await db
      .prepare(
        'INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES (?, ?, 1, ?, ?)',
      )
      .bind(purpose, `${purpose}-test`, 'current', Date.now())
      .run();
  authenticator = await createFakeAuthenticator('auth.poc.example', authOrigin);
});

afterAll(async () => {
  await mf?.dispose();
});

it('manages the plugin registry with step-up on workerd/D1 and emits no plugin audit events', async () => {
  const db = await mf.getD1Database('DB');

  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  const staffLogin = await post('/auth/login', {
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(staffLogin.status).toBe(200);
  const staffCookie = (staffLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (staffCookie === undefined) throw new Error('Missing session cookie');
  const staffAccount = await call('/api/v1/account', {
    token: await tokenFromCookie(staffCookie!, 'password-state'),
  });
  expect(staffAccount.status).toBe(200);
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;
  const passwordToken = await tokenFromCookie(staffCookie!, 'password-token');

  await db
    .prepare(
      'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      projectId,
      'plugins-project',
      'Plugins Project',
      Date.now(),
      Date.now(),
    )
    .run();
  await db
    .prepare(
      "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES (?, ?, 'staff', 'administrator', ?)",
    )
    .bind(projectId, staffPrincipalId, Date.now())
    .run();

  // Unauthenticated and password-assurance calls fail before any registry work.
  const anonymous = await call('/api/v1/admin/plugins', {
    body: { manifest: zeroSettingsManifest },
  });
  expect(anonymous.status).toBe(401);
  const passwordAttempt = await call('/api/v1/admin/plugins', {
    body: { manifest: zeroSettingsManifest },
    token: passwordToken,
  });
  expect(passwordAttempt.status).toBe(403);
  expect(await passwordAttempt.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });

  // Step up through a passkey ceremony.
  const optionsResponse = await post(
    '/auth/passkey/register/options',
    {},
    { cookie: staffCookie! },
  );
  expect(optionsResponse.status).toBe(200);
  const options = (await optionsResponse.json()) as {
    challenge: string;
    user: { id: string };
  };
  const registration = await authenticator.registration(
    options.challenge,
    Uint8Array.from(Buffer.from(options.user.id.replaceAll('-', ''), 'hex')),
  );
  const registrationVerify = await post(
    '/auth/passkey/register',
    { response: registration },
    { cookie: staffCookie! },
  );
  expect(registrationVerify.status).toBe(200);
  const loginOptions = await post('/auth/passkey/login/options', {});
  const challenge = ((await loginOptions.json()) as { challenge: string })
    .challenge;
  const passkeyLogin = await post('/auth/passkey/login', {
    response: await authenticator.assertion(challenge, 1),
  });
  expect(passkeyLogin.status).toBe(200);
  const passkeyCookie = (passkeyLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (passkeyCookie === undefined) throw new Error('Missing passkey cookie');
  const token = await tokenFromCookie(passkeyCookie!, 'stepped-state');

  const invalidManifest = await call('/api/v1/admin/plugins', {
    body: { manifest: { ...zeroSettingsManifest, id: 'sample' } },
    token,
  });
  expect(invalidManifest.status).toBe(400);
  expect(await invalidManifest.json()).toMatchObject({
    error: { code: 'PLUGIN_INVALID' },
  });

  const incompatible = await call('/api/v1/admin/plugins', {
    body: { manifest: { ...zeroSettingsManifest, apiVersion: '^2.0.0' } },
    token,
  });
  expect(incompatible.status).toBe(400);

  const registered = await call('/api/v1/admin/plugins', {
    body: { manifest: zeroSettingsManifest },
    token,
  });
  expect(registered.status).toBe(201);
  expect(await registered.json()).toMatchObject({
    id: '@hyperbug/sample',
    version: '1.0.0',
    state: 'registered',
  });

  const duplicate = await call('/api/v1/admin/plugins', {
    body: { manifest: zeroSettingsManifest },
    token,
  });
  expect(duplicate.status).toBe(409);

  const missing = await call('/api/v1/admin/plugins/load', {
    body: { id: '@hyperbug/absent' },
    token,
  });
  expect(missing.status).toBe(404);

  const configured = await call('/api/v1/admin/plugins', {
    body: { manifest: configuredManifest },
    token,
  });
  expect(configured.status).toBe(201);
  // Settings-bearing plugins cannot enable before the configuration
  // interfaces exist (05.2b): configuration completeness fails closed.
  const prematureEnable = await call('/api/v1/admin/plugins/enable', {
    body: { id: '@hyperbug/configd' },
    token,
  });
  expect(prematureEnable.status).toBe(409);

  // Configuration interfaces (05.2b): write-only secret update, redacted
  // read, and enable consuming the stored configuration.
  const badConfigure = await call('/api/v1/admin/plugins/configure', {
    body: { id: '@hyperbug/configd', values: { bogus: 1 } },
    token,
  });
  expect(badConfigure.status).toBe(400);
  const publicOnly = await call('/api/v1/admin/plugins/configure', {
    body: { id: '@hyperbug/configd', values: { threshold: 3 } },
    token,
  });
  expect(publicOnly.status).toBe(200);
  const writeConfigured = await call('/api/v1/admin/plugins/configure', {
    body: {
      id: '@hyperbug/configd',
      secrets: { 'api-key': 'super-secret-value' },
    },
    token,
  });
  expect(writeConfigured.status).toBe(200);
  const configRead = await call('/api/v1/admin/plugins/configuration', {
    body: { id: '@hyperbug/configd' },
    token,
  });
  expect(configRead.status).toBe(200);
  expect(await configRead.json()).toEqual({
    settings: [
      { key: 'api-key', kind: 'secret', secretPresent: true },
      { key: 'threshold', kind: 'public', value: 3 },
    ],
  });
  const secretRow = await db
    .prepare(
      "SELECT secret_record FROM plugin_settings WHERE plugin_id = '@hyperbug/configd'",
    )
    .first<{ secret_record: string }>();
  expect(secretRow?.secret_record).toContain('A256GCM');
  expect(secretRow?.secret_record).not.toContain('super-secret-value');
  const enabledConfigd = await call('/api/v1/admin/plugins/enable', {
    body: { id: '@hyperbug/configd' },
    token,
  });
  expect(enabledConfigd.status).toBe(200);

  const enabled = await call('/api/v1/admin/plugins/enable', {
    body: { id: '@hyperbug/sample' },
    token,
  });
  expect(enabled.status).toBe(200);
  expect(await enabled.json()).toMatchObject({ state: 'enabled' });
  const enabledAgain = await call('/api/v1/admin/plugins/enable', {
    body: { id: '@hyperbug/sample' },
    token,
  });
  expect(enabledAgain.status).toBe(409);

  const upgradedWhileEnabled = await call('/api/v1/admin/plugins/upgrade', {
    body: {
      id: '@hyperbug/sample',
      manifest: { ...zeroSettingsManifest, version: '1.1.0' },
    },
    token,
  });
  expect(upgradedWhileEnabled.status).toBe(400);

  const disabled = await call('/api/v1/admin/plugins/disable', {
    body: { id: '@hyperbug/sample' },
    token,
  });
  expect(disabled.status).toBe(200);
  expect(await disabled.json()).toMatchObject({ state: 'disabled' });

  const upgraded = await call('/api/v1/admin/plugins/upgrade', {
    body: {
      id: '@hyperbug/sample',
      manifest: { ...zeroSettingsManifest, version: '1.1.0' },
    },
    token,
  });
  expect(upgraded.status).toBe(200);
  expect(await upgraded.json()).toMatchObject({ version: '1.1.0' });

  const downgraded = await call('/api/v1/admin/plugins/upgrade', {
    body: {
      id: '@hyperbug/sample',
      manifest: { ...zeroSettingsManifest, version: '1.0.0' },
    },
    token,
  });
  expect(downgraded.status).toBe(400);

  const listed = await call('/api/v1/admin/plugins', { token });
  expect(listed.status).toBe(200);
  const registry = (await listed.json()) as {
    plugins: { id: string; version: string; state: string }[];
  };
  expect(registry.plugins).toHaveLength(2);
  expect(registry.plugins[0]).toMatchObject({
    id: '@hyperbug/configd',
    state: 'enabled',
  });
  expect(registry.plugins[1]).toMatchObject({
    id: '@hyperbug/sample',
    version: '1.1.0',
    state: 'disabled',
  });

  const noPolicy = await call('/api/v1/admin/plugins/uninstall', {
    body: { id: '@hyperbug/sample' },
    token,
  });
  expect(noPolicy.status).toBe(400);
  const uninstalled = await call('/api/v1/admin/plugins/uninstall', {
    body: { id: '@hyperbug/sample', policy: 'retain' },
    token,
  });
  expect(uninstalled.status).toBe(204);
  const uninstalledConfigd = await call('/api/v1/admin/plugins/uninstall', {
    body: { id: '@hyperbug/configd', policy: 'delete' },
    token,
  });
  expect(uninstalledConfigd.status).toBe(204);
  const remainingSettings = await db
    .prepare('SELECT COUNT(*) AS n FROM plugin_settings')
    .first<{ n: number }>();
  expect(remainingSettings?.n).toBe(0);
  const gone = await call('/api/v1/admin/plugins/load', {
    body: { id: '@hyperbug/sample' },
    token,
  });
  expect(gone.status).toBe(404);

  // 05.2d: async event envelopes connect to the outbox model. An enabled
  // notifier publishes; a disabled one is safely inert; sync points and
  // unknown plugins refuse.
  const notifierManifest = {
    id: '@hyperbug/notifier',
    version: '1.0.0',
    trustTier: 'trusted-native',
    apiVersion: '^1.0.0',
    capabilities: ['notifications'],
    extensionPoints: ['notifications:deliver'],
    permissions: ['events:publish'],
    settings: [],
  };
  const notifierRegistered = await call('/api/v1/admin/plugins', {
    body: { manifest: notifierManifest },
    token,
  });
  expect(notifierRegistered.status).toBe(201);
  const notifierEnabled = await call('/api/v1/admin/plugins/enable', {
    body: { id: '@hyperbug/notifier' },
    token,
  });
  expect(notifierEnabled.status).toBe(200);
  const published = await post('/_proof/publish-plugin-event', {
    pluginId: '@hyperbug/notifier',
    point: 'notifications:deliver',
    payload: { subject: 'hello' },
  });
  expect(published.status).toBe(200);
  const { eventId } = (await published.json()) as { eventId: string };
  const outboxRow = await db
    .prepare(
      'SELECT payload, delivered_at FROM plugin_event_outbox WHERE event_id = ?',
    )
    .bind(eventId)
    .first<{ payload: string; delivered_at: number | null }>();
  expect(outboxRow?.delivered_at).toBeNull();
  expect(JSON.parse(outboxRow?.payload ?? '{}')).toMatchObject({
    hook: 'notifications:deliver',
    pluginId: '@hyperbug/notifier',
    payloadVersion: 1,
  });
  const notifierDisabled = await call('/api/v1/admin/plugins/disable', {
    body: { id: '@hyperbug/notifier' },
    token,
  });
  expect(notifierDisabled.status).toBe(200);
  const deniedPublish = await post('/_proof/publish-plugin-event', {
    pluginId: '@hyperbug/notifier',
    point: 'notifications:deliver',
    payload: { subject: 'nope' },
  });
  expect(deniedPublish.status).toBe(409);
  const syncPoint = await post('/_proof/publish-plugin-event', {
    pluginId: '@hyperbug/notifier',
    point: 'captcha:verify-required',
    payload: {},
  });
  expect(syncPoint.status).toBe(409);
  const unknownPlugin = await post('/_proof/publish-plugin-event', {
    pluginId: '@hyperbug/ghost',
    point: 'notifications:deliver',
    payload: {},
  });
  expect(unknownPlugin.status).toBe(409);

  // The suspended module-05 audit scope stays silent: registry operations
  // must not have emitted any plugin audit events.
  const pluginAudits = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM audit_events WHERE action LIKE 'plugin.%'",
    )
    .first<{ n: number }>();
  expect(pluginAudits?.n).toBe(0);
});
