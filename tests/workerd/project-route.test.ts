import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';

// 06.1a/06.1b route journey on workerd/D1: staff creates a project and is
// auto-granted its first administrator role; configuration requires recent
// authentication; private projects are invisible to anonymous callers and
// non-members; taxonomy writes follow the maintainer-or-higher rule and the
// archived read-only rule; no project/taxonomy audit event is emitted while
// 06.1c's audit portion stays suspended.
const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
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
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });

const call = (
  path: string,
  init: {
    method?: string;
    token?: string;
    body?: unknown;
    origin?: string | null;
  } = {},
) =>
  mf.dispatchFetch(`${authOrigin}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(init.origin === null ? {} : { origin: init.origin ?? authOrigin }),
      'sec-fetch-site': 'same-origin',
      ...(init.token === undefined
        ? {}
        : { authorization: `Bearer ${init.token}` }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'projects-cli',
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
    client_id: 'projects-cli',
    code_verifier: journeyVerifier,
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

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
            clientId: 'projects-cli',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
        HYPERBUG_TEST_PASSKEY_RP_ID: 'auth.poc.example',
        HYPERBUG_TEST_PASSKEY_RP_NAME: 'HyperBug Projects PoC',
        HYPERBUG_TEST_PASSKEY_ORIGIN: authOrigin,
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
      "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', ?)",
    )
    .bind(Date.now())
    .run();
  authenticator = await createFakeAuthenticator('auth.poc.example', authOrigin);
});

afterAll(async () => {
  await mf?.dispose();
});

it('delivers the project and taxonomy journey on workerd/D1', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  const registered = await post('/api/v1/accounts/register', {
    handle: 'plainuser',
    password: 'long-functional-password',
  });
  expect(registered.status).toBe(202);

  const staffLogin = await post('/auth/login', {
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(staffLogin.status).toBe(200);
  const staffCookie = (staffLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (staffCookie === undefined) throw new Error('Missing session cookie');
  const userLogin = await post('/auth/login', {
    handle: 'plainuser',
    password: 'long-functional-password',
  });
  expect(userLogin.status).toBe(200);
  const userCookie = (userLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (userCookie === undefined) throw new Error('Missing session cookie');
  const staffToken = await tokenFromCookie(staffCookie!, 'staff-state');
  const userToken = await tokenFromCookie(userCookie!, 'user-state');
  const staffAccount = await call('/api/v1/account', { token: staffToken });
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;

  // Creation is a staff action: anonymous and User principals are denied.
  const anonymousCreate = await call('/api/v1/projects', {
    method: 'POST',
    body: { slug: 'rocket', name: 'Rocket' },
  });
  expect(anonymousCreate.status).toBe(401);
  const userCreate = await call('/api/v1/projects', {
    method: 'POST',
    token: userToken,
    body: { slug: 'rocket', name: 'Rocket' },
  });
  expect(userCreate.status).toBe(403);

  const invalidSlug = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'Rocket!', name: 'Rocket' },
  });
  expect(invalidSlug.status).toBe(400);
  expect(await invalidSlug.json()).toMatchObject({
    error: { code: 'PROJECT_INVALID' },
  });

  const created = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'rocket', name: 'Rocket' },
  });
  expect(created.status).toBe(201);
  const project = (await created.json()) as {
    id: string;
    slug: string;
    visibility: string;
    status: string;
    revision: number;
  };
  expect(project.slug).toBe('rocket');
  expect(project.visibility).toBe('public');
  expect(project.status).toBe('active');
  expect(project.revision).toBe(1);

  const db = await mf.getD1Database('DB');
  const grant = await db
    .prepare(
      'SELECT role FROM project_roles WHERE project_id = ? AND principal_id = ?',
    )
    .bind(project.id, staffPrincipalId)
    .first<{ role: string }>();
  expect(grant).toEqual({ role: 'administrator' });

  const duplicate = await call('/api/v1/projects', {
    method: 'POST',
    token: staffToken,
    body: { slug: 'rocket', name: 'Another' },
  });
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toMatchObject({
    error: { code: 'PROJECT_CONFLICT' },
  });

  // Public read works anonymously and for any authenticated principal.
  const anonymousRead = await call(`/api/v1/projects/${project.id}`, {
    origin: null,
  });
  expect(anonymousRead.status).toBe(200);
  const userRead = await call(`/api/v1/projects/${project.id}`, {
    token: userToken,
  });
  expect(userRead.status).toBe(200);

  // Configuration is sensitive: a password-issued token lacks the ceremony.
  const configureDenied = await call(`/api/v1/projects/${project.id}`, {
    method: 'PATCH',
    token: staffToken,
    body: { expectedRevision: 1, name: 'Rocket Tracker' },
  });
  expect(configureDenied.status).toBe(403);
  expect(await configureDenied.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });

  // Step up with a passkey ceremony and retry.
  const optionsResponse = await post(
    '/auth/passkey/register/options',
    {},
    { cookie: staffCookie! },
  );
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
  if (passkeyCookie === undefined) throw new Error('Missing session cookie');
  const steppedToken = await tokenFromCookie(passkeyCookie!, 'stepped-state');

  const configured = await call(`/api/v1/projects/${project.id}`, {
    method: 'PATCH',
    token: steppedToken,
    body: { expectedRevision: 1, name: 'Rocket Tracker' },
  });
  expect(configured.status).toBe(200);
  expect(((await configured.json()) as { revision: number }).revision).toBe(2);

  const staleRevision = await call(`/api/v1/projects/${project.id}`, {
    method: 'PATCH',
    token: steppedToken,
    body: { expectedRevision: 1, name: 'Stale' },
  });
  expect(staleRevision.status).toBe(409);
  expect(await staleRevision.json()).toMatchObject({
    error: { code: 'REVISION_CONFLICT' },
  });

  // A plain User principal cannot manage taxonomy even on a public project.
  const userLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: userToken,
    body: { name: 'Bug', color: '#ff0000' },
  });
  expect(userLabel.status).toBe(403);
  const anonymousLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    origin: null,
    body: { name: 'Nope' },
  });
  expect(anonymousLabel.status).toBe(401);

  const label = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: steppedToken,
    body: { name: 'Bug', color: '#ff0000' },
  });
  expect(label.status).toBe(201);
  const labelDocument = (await label.json()) as {
    id: string;
    name: string;
    revision: number;
  };
  expect(labelDocument.name).toBe('Bug');

  const duplicateLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: steppedToken,
    body: { name: '  bug  ', color: '' },
  });
  expect(duplicateLabel.status).toBe(409);
  expect(await duplicateLabel.json()).toMatchObject({
    error: { code: 'TAXONOMY_CONFLICT' },
  });

  const anonymousLabels = await call(`/api/v1/projects/${project.id}/labels`, {
    origin: null,
  });
  expect(anonymousLabels.status).toBe(200);
  expect(
    ((await anonymousLabels.json()) as { labels: unknown[] }).labels,
  ).toHaveLength(1);

  const labelUpdate = await call(
    `/api/v1/projects/${project.id}/labels/${labelDocument.id}`,
    {
      method: 'PATCH',
      token: steppedToken,
      body: { expectedRevision: 1, description: 'Something broken' },
    },
  );
  expect(labelUpdate.status).toBe(200);
  expect(
    ((await labelUpdate.json()) as { description: string }).description,
  ).toBe('Something broken');

  const labelConflict = await call(
    `/api/v1/projects/${project.id}/labels/${labelDocument.id}`,
    {
      method: 'PATCH',
      token: steppedToken,
      body: { expectedRevision: 1, name: 'Still Bug' },
    },
  );
  expect(labelConflict.status).toBe(409);
  expect(await labelConflict.json()).toMatchObject({
    error: { code: 'REVISION_CONFLICT' },
  });

  const labelDeleted = await call(
    `/api/v1/projects/${project.id}/labels/${labelDocument.id}`,
    { method: 'DELETE', token: steppedToken, body: {} },
  );
  expect(labelDeleted.status).toBe(204);
  const labelGone = await call(
    `/api/v1/projects/${project.id}/labels/${labelDocument.id}`,
    { method: 'DELETE', token: steppedToken, body: {} },
  );
  expect(labelGone.status).toBe(404);

  // Issue types: create, disable through the enabled flag, remove.
  const type = await call(`/api/v1/projects/${project.id}/issue-types`, {
    method: 'POST',
    token: steppedToken,
    body: { name: 'Bug', icon: '🐛', position: 0 },
  });
  expect(type.status).toBe(201);
  const typeDocument = (await type.json()) as {
    id: string;
    enabled: boolean;
    revision: number;
  };
  expect(typeDocument.enabled).toBe(true);
  const typeDisabled = await call(
    `/api/v1/projects/${project.id}/issue-types/${typeDocument.id}`,
    {
      method: 'PATCH',
      token: steppedToken,
      body: { expectedRevision: 1, enabled: false },
    },
  );
  expect(typeDisabled.status).toBe(200);
  expect(((await typeDisabled.json()) as { enabled: boolean }).enabled).toBe(
    false,
  );
  const typeDeleted = await call(
    `/api/v1/projects/${project.id}/issue-types/${typeDocument.id}`,
    { method: 'DELETE', token: steppedToken, body: {} },
  );
  expect(typeDeleted.status).toBe(204);

  // Milestones: bounded due dates, state transitions and derived progress.
  const badDate = await call(`/api/v1/projects/${project.id}/milestones`, {
    method: 'POST',
    token: steppedToken,
    body: { title: 'v1.0', dueDate: '2026-02-30' },
  });
  expect(badDate.status).toBe(400);
  const milestone = await call(`/api/v1/projects/${project.id}/milestones`, {
    method: 'POST',
    token: steppedToken,
    body: { title: 'v1.0', dueDate: '2026-12-31' },
  });
  expect(milestone.status).toBe(201);
  const milestoneDocument = (await milestone.json()) as {
    id: string;
    state: string;
    dueDate: string;
    revision: number;
    progress: { open: number; closed: number };
  };
  expect(milestoneDocument.state).toBe('open');
  expect(milestoneDocument.dueDate).toBe('2026-12-31');
  expect(milestoneDocument.progress).toEqual({ open: 0, closed: 0 });
  const milestoneClosed = await call(
    `/api/v1/projects/${project.id}/milestones/${milestoneDocument.id}`,
    {
      method: 'PATCH',
      token: steppedToken,
      body: { expectedRevision: 1, state: 'closed' },
    },
  );
  expect(milestoneClosed.status).toBe(200);
  expect(((await milestoneClosed.json()) as { state: string }).state).toBe(
    'closed',
  );

  // Private projects are invisible: anonymous and non-member see 404.
  const beforePrivate = (await (
    await call(`/api/v1/projects/${project.id}`, { token: steppedToken })
  ).json()) as { revision: number };
  const madePrivate = await call(`/api/v1/projects/${project.id}`, {
    method: 'PATCH',
    token: steppedToken,
    body: { expectedRevision: beforePrivate.revision, visibility: 'private' },
  });
  expect(madePrivate.status).toBe(200);
  const privateAnonymous = await call(`/api/v1/projects/${project.id}`, {
    origin: null,
  });
  expect(privateAnonymous.status).toBe(404);
  const privateUser = await call(`/api/v1/projects/${project.id}`, {
    token: userToken,
  });
  expect(privateUser.status).toBe(404);
  const privateMember = await call(`/api/v1/projects/${project.id}`, {
    token: steppedToken,
  });
  expect(privateMember.status).toBe(200);

  // Archive makes the project read-only; reads stay available.
  const current = (await (
    await call(`/api/v1/projects/${project.id}`, { token: steppedToken })
  ).json()) as { revision: number };
  const archived = await call(`/api/v1/projects/${project.id}/archive`, {
    method: 'POST',
    token: steppedToken,
    body: { expectedRevision: current.revision },
  });
  expect(archived.status).toBe(200);
  expect(((await archived.json()) as { status: string }).status).toBe(
    'archived',
  );
  const archivedRead = await call(`/api/v1/projects/${project.id}`, {
    token: steppedToken,
  });
  expect(archivedRead.status).toBe(200);
  const archivedLabel = await call(`/api/v1/projects/${project.id}/labels`, {
    method: 'POST',
    token: steppedToken,
    body: { name: 'Blocked' },
  });
  expect(archivedLabel.status).toBe(403);

  // 06.1c's audit portion stays suspended: no project/taxonomy audit events.
  const audited = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'project.%' OR action LIKE 'taxonomy.%'",
    )
    .first<{ count: number }>();
  expect(audited?.count).toBe(0);
});
