import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';

/**
 * Minimum-tier account journey (04.V6) on workerd/D1 without an email
 * channel: the audited enablement, the floor-disabled password surface with
 * its documented capability error, the passkey sign-in path, single-use
 * recovery codes, administrator-assisted surfaces and the capability
 * document matching server enforcement.
 */
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://client.poc.example/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const enablementEventId = '5ee1a0d2-7c3b-4f68-9a1d-2b4c5d6e7f80';
const verifier = 'v'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('base64url');
let mf: Miniflare;
let authenticator: Awaited<ReturnType<typeof createFakeAuthenticator>>;
let bootstrapCookie: string;
let passkeyCookie: string;
let bearerToken: string;
let staffPrincipalId: string;

const request = (
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      origin: authOrigin,
      'sec-fetch-site': 'same-origin',
      ...init.headers,
    },
    // Redirects to the client callback must not be followed by the harness.
    redirect: 'manual',
    ...(init.body === undefined ? {} : { body: init.body }),
  });

const postJson = (path: string, body: unknown, cookie?: string) =>
  request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: JSON.stringify(body),
  });

const postForm = (path: string, body: URLSearchParams, cookie?: string) =>
  request(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body.toString(),
  });

const authorizeQuery = new URLSearchParams({
  response_type: 'code',
  client_id: 'tier-journey',
  redirect_uri: redirectUri,
  scope: 'read',
  state: 'tier-state',
  code_challenge: challenge,
  code_challenge_method: 'S256',
});

const auditRows = async (action: string) =>
  (
    await (
      await mf.getD1Database('DB')
    )
      .prepare(
        'SELECT action, actor_id, system_actor, target_id, result FROM audit_events WHERE action = ?',
      )
      .bind(action)
      .all()
  ).results;

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/minimum-tier-worker', []),
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
        HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
        HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1',
        HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
        HYPERBUG_KEY_RING: await cryptoFixture().source.read(),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
        HYPERBUG_TEST_PASSKEY_RP_ID: 'auth.poc.example',
        HYPERBUG_TEST_PASSKEY_RP_NAME: 'HyperBug PoC',
        HYPERBUG_TEST_PASSKEY_ORIGIN: authOrigin,
        HYPERBUG_TEST_OAUTH_CLIENTS: JSON.stringify([
          {
            clientId: 'tier-journey',
            redirectUris: [redirectUri],
            scopes: ['read'],
          },
        ]),
      },
    }),
  );
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(
      migration.statements.map((statement) => db.prepare(statement)),
    );
  await db
    .prepare(
      "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?), ('password-pepper', 'password-pepper-test', 1, 'current', ?)",
    )
    .bind(Date.now(), Date.now())
    .run();
  authenticator = await createFakeAuthenticator('auth.poc.example', authOrigin);
});

afterAll(async () => {
  await mf?.dispose();
});

it('reports the enabled tier truthfully and records its audited enablement', async () => {
  const instance = await request('/api/v1/instance', {});
  expect(instance.status).toBe(200);
  const document = (await instance.json()) as {
    tier: string;
    degradationIds: string[];
    passwordHashPolicy: { algorithm: string; downgraded: boolean };
    authentication: {
      passwordRegistration: boolean;
      passwordLogin: boolean;
      recoveryCodes: boolean;
      passkeys: boolean;
      administratorAssistedRecovery: boolean;
    };
  };
  expect(document.tier).toBe('cloudflare-free-minimum');
  expect(document.degradationIds).toEqual([
    'FREE-01',
    'FREE-02',
    'FREE-03',
    'FREE-04',
    'FREE-05',
    'FREE-06',
    'FREE-07',
    'FREE-08',
  ]);
  expect(document.passwordHashPolicy).toEqual({
    algorithm: 'pbkdf2-hmac-sha256',
    downgraded: true,
  });
  // The floor rule (50k current < 600k reviewed floor) disables the password
  // surface while the recommended path stays advertised as available.
  expect(document.authentication.passwordRegistration).toBe(false);
  expect(document.authentication.passwordLogin).toBe(false);
  expect(document.authentication.recoveryCodes).toBe(true);
  expect(document.authentication.passkeys).toBe(true);
  expect(document.authentication.administratorAssistedRecovery).toBe(true);
  const enablement = await (
    await mf.getD1Database('DB')
  )
    .prepare('SELECT action, result FROM audit_events WHERE id = ?')
    .bind(enablementEventId)
    .first<{ action: string; result: string }>();
  expect(enablement).toEqual({
    action: 'deployment.enablement',
    result: 'success',
  });
});

it('refuses the password surface with the documented capability error', async () => {
  const registration = await postJson('/api/v1/accounts/register', {
    handle: 'tieruser',
    password: 'long-functional-password',
  });
  expect(registration.status).toBe(403);
  expect(await registration.json()).toMatchObject({
    error: { code: 'PASSWORD_CAPABILITY_DISABLED' },
  });
  const login = await postJson('/auth/login', {
    handle: 'tieruser',
    password: 'long-functional-password',
  });
  expect(login.status).toBe(403);
  expect(await login.json()).toMatchObject({
    error: { code: 'PASSWORD_CAPABILITY_DISABLED' },
  });
  const db = await mf.getD1Database('DB');
  const credentials = await db
    .prepare('SELECT COUNT(*) AS count FROM password_credentials')
    .first<{ count: number }>();
  expect(credentials?.count).toBe(0);
  // The authorization login page shows the degradation notice and an
  // explained state instead of a password form that cannot succeed.
  const page = await request(`/auth/authorize?${authorizeQuery}`, {});
  expect(page.status).toBe(200);
  const html = await page.text();
  expect(html).toContain('degradation-notice');
  expect(html).toContain('Password sign-in is unavailable');
  expect(html).not.toContain('name="password"');
  const loginPost = await postForm(
    '/auth/authorize/login',
    new URLSearchParams({
      ...Object.fromEntries(authorizeQuery),
      handle: 'tieradmin',
      password: 'long-functional-password',
    }),
  );
  expect(loginPost.status).toBe(403);
  expect(await loginPost.text()).toContain(
    'Password sign-in is disabled on this instance.',
  );
});

it('bootstraps the initial administrator with a tier session', async () => {
  const enrolled = await postJson('/auth/bootstrap/enroll', {
    handle: 'tieradmin',
    password: 'long-functional-password',
    enrollmentCode,
  });
  expect(enrolled.status).toBe(201);
  const enrolledCookie = (enrolled.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (enrolledCookie === undefined) throw new Error('Missing session cookie');
  bootstrapCookie = enrolledCookie;
  const session = await request('/auth/session', {
    headers: { cookie: bootstrapCookie },
  });
  expect(session.status).toBe(200);
  const db = await mf.getD1Database('DB');
  const credential = await db
    .prepare(
      "SELECT p.id AS principal_id, c.record->>'alg' AS alg FROM password_credentials c JOIN identities i ON i.id = c.identity_id JOIN principals p ON p.id = i.principal_id WHERE i.provider = 'local-password'",
    )
    .first<{ principal_id: string; alg: string }>();
  expect(credential?.alg).toBe('PBKDF2-HMAC-SHA256');
  staffPrincipalId = credential!.principal_id;
  expect(await auditRows('account.enrolled')).toEqual([
    {
      action: 'account.enrolled',
      actor_id: null,
      system_actor: 'core.identity',
      target_id: staffPrincipalId,
      result: 'success',
    },
  ]);
});

it('links a passkey on the tier session and signs in with it', async () => {
  const optionsResponse = await postJson(
    '/auth/passkey/register/options',
    {},
    bootstrapCookie,
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
  const verified = await postJson(
    '/auth/passkey/register',
    { response: registration },
    bootstrapCookie,
  );
  expect(verified.status).toBe(200);
  expect(await auditRows('account.linked')).toHaveLength(1);
  const logout = await postJson('/auth/logout', {}, bootstrapCookie);
  expect(logout.status).toBe(204);
  const loginOptions = await postJson('/auth/passkey/login/options', {});
  expect(loginOptions.status).toBe(200);
  const first = await authenticator.assertion(
    ((await loginOptions.json()) as { challenge: string }).challenge,
    1,
  );
  const login = await postJson('/auth/passkey/login', {
    response: first,
  });
  expect(login.status).toBe(200);
  const firstCookie = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (firstCookie === undefined) throw new Error('Missing session cookie');
  passkeyCookie = firstCookie;
  const session = await request('/auth/session', {
    headers: { cookie: passkeyCookie },
  });
  expect(session.status).toBe(200);
});

it('generates and redeems single-use recovery codes without email', async () => {
  const generation = await postJson('/auth/recovery-codes', {}, passkeyCookie);
  expect(generation.status).toBe(200);
  const { codes } = (await generation.json()) as { codes: string[] };
  expect(codes).toHaveLength(10);
  expect(await auditRows('recovery.generated')).toHaveLength(1);
  const recovered = await postJson('/auth/recover', {
    handle: 'tieradmin',
    recoveryCode: codes[0],
    password: 'fresh-functional-password',
  });
  expect(recovered.status).toBe(200);
  expect(await recovered.json()).toEqual({ recovered: true });
  expect(await auditRows('account.recovered')).toHaveLength(1);
  // Recovery revoked the still-active tier session and stored a fresh
  // PBKDF2 record.
  const oldSession = await request('/auth/session', {
    headers: { cookie: passkeyCookie },
  });
  expect(oldSession.status).toBe(401);
  const db = await mf.getD1Database('DB');
  const record = await db
    .prepare("SELECT record->>'alg' AS alg FROM password_credentials")
    .first<{ alg: string }>();
  expect(record?.alg).toBe('PBKDF2-HMAC-SHA256');
  // The floor rule keeps the password surface closed even after recovery.
  const passwordLogin = await postJson('/auth/login', {
    handle: 'tieradmin',
    password: 'fresh-functional-password',
  });
  expect(passwordLogin.status).toBe(403);
  expect(await passwordLogin.json()).toMatchObject({
    error: { code: 'PASSWORD_CAPABILITY_DISABLED' },
  });
  // The passkey path still signs in after the credential revision change.
  const loginOptions = await postJson('/auth/passkey/login/options', {});
  const second = await authenticator.assertion(
    ((await loginOptions.json()) as { challenge: string }).challenge,
    2,
  );
  const login = await postJson('/auth/passkey/login', {
    response: second,
  });
  expect(login.status).toBe(200);
  const secondCookie = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (secondCookie === undefined) throw new Error('Missing session cookie');
  passkeyCookie = secondCookie;
});

it('completes the consent authorization-code flow with a bearer token', async () => {
  const consentPage = await request(`/auth/authorize?${authorizeQuery}`, {
    headers: { cookie: passkeyCookie },
  });
  expect(consentPage.status).toBe(200);
  const html = await consentPage.text();
  expect(html).toContain('degradation-notice');
  expect(html).toContain('Authorize access');
  const consent = await postForm(
    '/auth/authorize/consent',
    new URLSearchParams(Object.fromEntries(authorizeQuery)),
    passkeyCookie,
  );
  expect(consent.status).toBe(302);
  const location = new URL(consent.headers.get('location') ?? '', redirectUri);
  const code = location.searchParams.get('code');
  expect(location.searchParams.get('state')).toBe('tier-state');
  if (code === null) throw new Error('Missing authorization code');
  const token = await postForm(
    '/auth/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'tier-journey',
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
  );
  expect(token.status).toBe(200);
  bearerToken = ((await token.json()) as { accessToken: string }).accessToken;
  const account = await request('/api/v1/account', {
    headers: { authorization: `Bearer ${bearerToken}` },
  });
  expect(account.status).toBe(200);
  expect(await account.json()).toMatchObject({
    principalId: staffPrincipalId,
    kind: 'staff',
  });
});

it('exercises the audited account-management APIs on the tier', async () => {
  const sessions = await request('/api/v1/account/sessions', {
    headers: { authorization: `Bearer ${bearerToken}` },
  });
  expect(sessions.status).toBe(200);
  const listed = (await sessions.json()) as {
    sessions: { id: string }[];
  };
  expect(listed.sessions.length).toBeGreaterThan(0);
  const revoked = await request(
    `/api/v1/account/sessions/${listed.sessions[0]!.id}`,
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${bearerToken}`,
        'content-type': 'application/json',
      },
      body: '{}',
    },
  );
  expect(revoked.status).toBe(204);
  expect(await auditRows('session.revoked')).toHaveLength(1);
  // The last active Staff administrator cannot be suspended, including on
  // the tier where the operator channel is the only recovery path.
  const suspension = await request(
    `/api/v1/admin/principals/${staffPrincipalId}/suspend`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bearerToken}`,
        'content-type': 'application/json',
      },
      body: '{}',
    },
  );
  expect([403, 404]).toContain(suspension.status);
});
