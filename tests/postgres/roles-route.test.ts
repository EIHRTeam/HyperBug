import { instanceEscalationContract } from '../fixtures/instance-escalation-contract.ts';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { node } from '@elysia/node';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { createNodeStandardPasswordService } from '../../apps/api-node/src/standard-password.ts';
import { listenNode } from '../../apps/api-node/src/listen.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { postgresNodeBindings } from '../fixtures/postgres-node-bindings.ts';
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';

const databaseName = 'hyperbug_roles_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'roles-admin-cli',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
  {
    clientId: 'roles-user-cli',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
];
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const projectId = crypto.randomUUID();
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let directory: string;
let base: string;
const sessionKeys = cryptoFixture();
let authenticator: Awaited<ReturnType<typeof createFakeAuthenticator>>;
type PasskeyOptions = NonNullable<Parameters<typeof createApp>[0]['passkey']>;
const passkeyConfig: {
  rpID: string;
  rpName: string;
  origin: string;
  store: PasskeyOptions['store'];
  passwordStore: PasskeyOptions['passwordStore'];
  sessionStore: PasskeyOptions['sessionStore'];
  keyProvider: PasskeyOptions['keyProvider'];
} = {
  rpID: 'localhost',
  rpName: 'HyperBug Roles PoC',
  origin: 'http://placeholder.invalid',
  store: null!,
  passwordStore: null!,
  sessionStore: null!,
  keyProvider: sessionKeys.provider,
};

const post = (
  path: string,
  body: unknown,
  extra: Record<string, string> = {},
) =>
  fetch(new URL(path, base), {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base, ...extra },
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

/** Full password login + code flow returning a bearer token. */
async function bearerToken(
  clientId: string,
  handle: string,
  password: string,
): Promise<{ token: string; principalId: string }> {
  const login = await post('/auth/login', { handle, password });
  expect(login.status).toBe(200);
  const cookie = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (cookie === undefined) throw new Error('Missing session cookie');
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId,
      redirectUri,
      scope: 'public-api',
      state: 'roles-state',
      codeChallenge: await challengeOf(journeyVerifier),
    },
    { cookie },
  );
  expect(authorized.status).toBe(200);
  const { redirectUri: target } = (await authorized.json()) as {
    redirectUri: string;
  };
  const code = new URL(target).searchParams.get('code') ?? '';
  const exchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: journeyVerifier,
    }),
  });
  expect(exchange.status).toBe(200);
  const body = (await exchange.json()) as { accessToken: string };
  const account = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: `Bearer ${body.accessToken}` },
  });
  expect(account.status).toBe(200);
  const document = (await account.json()) as { principalId: string };
  return { token: body.accessToken, principalId: document.principalId };
}

beforeAll(async () => {
  if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
    throw new Error('Use the isolated PostgreSQL test cluster');
  const socketDirectory = process.env.PGHOST;
  const databaseUser = process.env.PGUSER;
  if (!socketDirectory || !databaseUser)
    throw new Error('Private PostgreSQL socket is required');
  bootstrap = new Pool({ max: 1 });
  await bootstrap.query(`CREATE DATABASE ${databaseName}`);
  pool = new Pool({
    host: socketDirectory,
    user: databaseUser,
    database: databaseName,
    max: 2,
  });
  for (const migration of await migrationStatements('postgres')) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      for (const statement of migration.statements) await db.query(statement);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-roles-route-'));
  const keyFile = join(directory, 'abuse.json');
  const tokenKeyFile = join(directory, 'token.json');
  await writeFile(keyFile, abuseKeyFixture(), { mode: 0o600 });
  await writeFile(tokenKeyFile, await sessionKeys.source.read(), {
    mode: 0o600,
  });
  await pool.query(
    "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES ('token-hmac', 'token-hmac-test', 1, 'current', $1)",
    [Date.now()],
  );
  configured = configureNodeAbuseAdmission(
    {
      ...postgresNodeBindings(databaseName),
      keyFile,
      keyProviderFile: tokenKeyFile,
    },
    'local',
  );
  passkeyConfig.store = configured.passkeyStores!;
  passkeyConfig.passwordStore = configured.passwordStore!;
  passkeyConfig.sessionStore = configured.sessionStore!;
  const config = {
    ...loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    allowedOrigins: ['http://localhost:5173'],
  };
  listener = await listenNode(
    createApp({
      adapter: node(),
      config,
      telemetry: jsonTelemetry(() => {}),
      ready: (signal) => configured.ready(signal) as Promise<boolean>,
      abuse: configured.abuse,
      registrationStore: configured.registrationStore,
      passwordStore: configured.passwordStore,
      sessionStore: configured.sessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      oauthClients: clients,
      oauthCodeStore: configured.oauthCodeStore,
      projectRoleStore: configured.projectRoleStore,
      projectStore: configured.projectStore,
      pluginRegistry: configured.pluginRegistryStore,
      accountAdministration: configured.accountAdministration,
      auditAppend: configured.auditAppend,
      bootstrapCode: enrollmentCode,
      staffEnrollmentStore: configured.staffEnrollmentStore,
      passkey: passkeyConfig,
    }),
    0,
  );
  base = listener.url;
  config.allowedOrigins.push(base);
  passkeyConfig.origin = base;
  authenticator = await createFakeAuthenticator('localhost', base);
});

afterAll(async () => {
  await listener?.close();
  await configured?.close();
  await pool?.end();
  await bootstrap?.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await bootstrap?.end();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'roles-admin-cli',
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
  const exchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code ?? '',
      redirect_uri: redirectUri,
      client_id: 'roles-admin-cli',
      code_verifier: journeyVerifier,
    }),
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

it('manages sessions, project roles and principal suspension end to end', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  const registered = await post('/api/v1/accounts/register', {
    handle: 'roleuser',
    password: 'long-functional-password',
  });
  expect(registered.status).toBe(202);

  const staff = await bearerToken(
    'roles-admin-cli',
    'rootadmin',
    'operator-password-1',
  );
  const user = await bearerToken(
    'roles-user-cli',
    'roleuser',
    'long-functional-password',
  );

  const sessions = await fetch(new URL('/api/v1/account/sessions', base), {
    headers: { authorization: `Bearer ${user.token}` },
  });
  expect(sessions.status).toBe(200);
  const listed = (await sessions.json()) as {
    sessions: { id: string }[];
  };
  expect(listed.sessions.length).toBeGreaterThanOrEqual(1);
  const removed = await fetch(
    new URL(`/api/v1/account/sessions/${listed.sessions[0]!.id}`, base),
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: '{}',
    },
  );
  expect(removed.status).toBe(204);
  const removedAgain = await fetch(
    new URL(`/api/v1/account/sessions/${listed.sessions[0]!.id}`, base),
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: '{}',
    },
  );
  expect(removedAgain.status).toBe(404);

  const revokedSession = await pool.query(
    "SELECT actor_id, target_id, result FROM audit_events WHERE action = 'session.revoked'",
  );
  expect(revokedSession.rowCount).toBe(1);
  expect(revokedSession.rows[0]).toEqual({
    actor_id: user.principalId,
    target_id: listed.sessions[0]!.id,
    result: 'success',
  });
  await pool.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)',
    [projectId, 'roles-project', 'Roles Project', Date.now()],
  );
  // The bootstrap administrator's initial project role is seeded out of band;
  // every later grant goes through the guarded API.
  await pool.query(
    "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES ($1, $2, 'staff', 'administrator', $3)",
    [projectId, staff.principalId, Date.now()],
  );

  // A password-issued token is assurance 1: sensitive administration
  // demands step-up, so the shared guard answers reauthentication-required
  // before any target check runs.
  const passwordTokenGrant = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${user.principalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${staff.token}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'triage' }),
    },
  );
  expect(passwordTokenGrant.status).toBe(403);
  expect(await passwordTokenGrant.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });

  // Step-up: the administrator registers a passkey and signs in with it;
  // the required user verification stamps the ceremony server-side.
  const staffLogin = await post('/auth/login', {
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(staffLogin.status).toBe(200);
  const staffCookie = (staffLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (staffCookie === undefined) throw new Error('Missing session cookie');
  const optionsResponse = await post(
    '/auth/passkey/register/options',
    {},
    { cookie: staffCookie },
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
    { cookie: staffCookie },
  );
  expect(registrationVerify.status).toBe(200);
  const loginOptions = await post('/auth/passkey/login/options', {});
  expect(loginOptions.status).toBe(200);
  const challenge = ((await loginOptions.json()) as { challenge: string })
    .challenge;
  const assertion = await authenticator.assertion(challenge, 1);
  const passkeyLogin = await post('/auth/passkey/login', {
    response: assertion,
  });
  expect(passkeyLogin.status).toBe(200);
  const passkeyCookie = (passkeyLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (passkeyCookie === undefined) throw new Error('Missing passkey cookie');

  // The passkey ceremony stamps assurance 2; a token obtained after it can
  // administer. Membership never converts a User into Staff: granting TO a
  // user principal is forbidden even with a stepped-up administrator token.
  const steppedVerifier = verifier();
  const steppedAuthorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'roles-admin-cli',
      redirectUri,
      scope: 'public-api',
      state: 'roles-state-2',
      codeChallenge: await challengeOf(steppedVerifier),
    },
    { cookie: passkeyCookie! },
  );
  expect(steppedAuthorized.status).toBe(200);
  const steppedCode = new URL(
    ((await steppedAuthorized.json()) as { redirectUri: string }).redirectUri,
  ).searchParams.get('code');
  const steppedExchange = await fetch(new URL('/auth/token', base), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: steppedCode ?? '',
      redirect_uri: redirectUri,
      client_id: 'roles-admin-cli',
      code_verifier: steppedVerifier,
    }),
  });
  expect(steppedExchange.status).toBe(200);
  const steppedUpToken = (
    (await steppedExchange.json()) as { accessToken: string }
  ).accessToken;
  const oldTokenGrant = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${staff.principalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${staff.token}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'administrator' }),
    },
  );
  expect(oldTokenGrant.status).toBe(403);
  expect(await oldTokenGrant.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });
  const userGrant = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${user.principalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${steppedUpToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'triage' }),
    },
  );
  expect(userGrant.status).toBe(403);
  expect(await userGrant.json()).toMatchObject({
    error: { code: 'FORBIDDEN' },
  });
  const selfReplace = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${staff.principalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${steppedUpToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'administrator' }),
    },
  );
  expect(selfReplace.status).toBe(200);
  expect(await selfReplace.json()).toEqual({
    projectId,
    principalId: staff.principalId,
    role: 'administrator',
  });
  const storedRole = await pool.query(
    'SELECT role FROM project_roles WHERE project_id = $1 AND principal_id = $2',
    [projectId, staff.principalId],
  );
  expect((storedRole.rows[0] as { role: string }).role).toBe('administrator');

  const grantedAudit = await pool.query(
    "SELECT project_id, actor_id, target_id, result, metadata FROM audit_events WHERE action = 'role.granted'",
  );
  expect(grantedAudit.rowCount).toBe(1);
  expect(grantedAudit.rows[0]).toEqual({
    project_id: projectId,
    actor_id: staff.principalId,
    target_id: staff.principalId,
    result: 'success',
    metadata: { v: 1, role: 'administrator' },
  });
  const unauthorized = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${staff.principalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${user.token}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'triage' }),
    },
  );
  expect(unauthorized.status).toBe(403);

  const suspended = await post(
    `/api/v1/admin/principals/${user.principalId}/suspend`,
    {},
    { authorization: `Bearer ${steppedUpToken}` },
  );
  expect(suspended.status).toBe(200);
  expect(await suspended.json()).toMatchObject({
    principalId: user.principalId,
    status: 'suspended',
  });
  const deniedWhileSuspended = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: `Bearer ${user.token}` },
  });
  expect(deniedWhileSuspended.status).toBe(401);
  const lastStaff = await post(
    `/api/v1/admin/principals/${staff.principalId}/suspend`,
    {},
    { authorization: `Bearer ${steppedUpToken}` },
  );
  expect(lastStaff.status).toBe(403);

  const activated = await post(
    `/api/v1/admin/principals/${user.principalId}/activate`,
    {},
    { authorization: `Bearer ${steppedUpToken}` },
  );
  expect(activated.status).toBe(200);
  expect(await activated.json()).toMatchObject({
    principalId: user.principalId,
    status: 'active',
  });
  const restored = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: `Bearer ${user.token}` },
  });
  expect(restored.status).toBe(200);

  const suspensionAudit = await pool.query(
    "SELECT action, project_id, actor_id, target_id, result FROM audit_events WHERE action IN ('principal.suspended', 'principal.activated') ORDER BY action",
  );
  expect(suspensionAudit.rows).toEqual([
    {
      action: 'principal.activated',
      project_id: null,
      actor_id: staff.principalId,
      target_id: user.principalId,
      result: 'success',
    },
    {
      action: 'principal.suspended',
      project_id: null,
      actor_id: staff.principalId,
      target_id: user.principalId,
      result: 'success',
    },
  ]);
  const memberRemoved = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${staff.principalId}`, base),
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${steppedUpToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: '{}',
    },
  );
  expect(memberRemoved.status).toBe(204);

  const revokedRole = await pool.query(
    "SELECT project_id, actor_id, target_id, result FROM audit_events WHERE action = 'role.revoked'",
  );
  expect(revokedRole.rowCount).toBe(1);
  expect(revokedRole.rows[0]).toEqual({
    project_id: projectId,
    actor_id: staff.principalId,
    target_id: staff.principalId,
    result: 'success',
  });
});

it('closes the 04.V3 role-behavior matrix', async () => {
  // A second staff principal is seeded directly (bootstrap is single-shot);
  // the administrator grants it the triage role through the guarded API.
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(403); // staff already exists; the code is inert

  const staffLogin = await post('/auth/login', {
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(staffLogin.status).toBe(200);
  const staffCookie = (staffLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (staffCookie === undefined) throw new Error('Missing session cookie');
  const loginOptions = await post('/auth/passkey/login/options', {});
  const challenge = ((await loginOptions.json()) as { challenge: string })
    .challenge;
  const passkeyLogin = await post('/auth/passkey/login', {
    response: await authenticator.assertion(challenge, 2),
  });
  expect(passkeyLogin.status).toBe(200);
  const passkeyCookie = (passkeyLogin.headers.getSetCookie?.() ?? [])[0]?.split(
    ';',
  )[0];
  if (passkeyCookie === undefined) throw new Error('Missing passkey cookie');
  const adminToken = await tokenFromCookie(passkeyCookie!, 'v3-state');
  const adminAccount = await fetch(new URL('/api/v1/account', base), {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const adminPrincipalId = (
    (await adminAccount.json()) as { principalId: string }
  ).principalId;

  // The first journey removed the administrator's role; re-seed it out of
  // band exactly as the bootstrap policy does for the initial grant.
  await pool.query(
    "INSERT INTO project_roles (project_id, principal_id, principal_kind, role, granted_at) VALUES ($1, $2, 'staff', 'administrator', $3)",
    [projectId, adminPrincipalId, Date.now()],
  );

  const triagePrincipalId = crypto.randomUUID();
  const triageIdentityId = crypto.randomUUID();
  await pool.query('BEGIN');
  await pool.query(
    "INSERT INTO principals (id, kind, display_name, status, created_at, revision) VALUES ($1, 'staff', 'triageonly', 'active', $2, 1)",
    [triagePrincipalId, Date.now()],
  );
  await pool.query(
    "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES ($1, $2, 'local-password', 'hyperbug', 'triageonly', $3)",
    [triageIdentityId, triagePrincipalId, Date.now()],
  );
  await pool.query('COMMIT');

  const grant = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${triagePrincipalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'triage' }),
    },
  );
  expect(grant.status).toBe(200);

  const triageGrant = await pool.query(
    "SELECT actor_id, target_id, metadata FROM audit_events WHERE action = 'role.granted' AND target_id = $1",
    [triagePrincipalId],
  );
  expect(triageGrant.rows).toEqual([
    {
      actor_id: adminPrincipalId,
      target_id: triagePrincipalId,
      metadata: { v: 1, role: 'triage' },
    },
  ]);
  const otherProjectId = crypto.randomUUID();
  await pool.query(
    'INSERT INTO projects (id, slug, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)',
    [otherProjectId, 'other-project', 'Other Project', Date.now()],
  );

  // Cross-project: the administrator of the first project holds no role in
  // the second, so both administration attempts on it are forbidden.
  const crossProjectGrant = await fetch(
    new URL(
      `/api/v1/projects/${otherProjectId}/members/${triagePrincipalId}`,
      base,
    ),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'triage' }),
    },
  );
  expect(crossProjectGrant.status).toBe(403);
  expect(await crossProjectGrant.json()).toMatchObject({
    error: { code: 'FORBIDDEN' },
  });

  // Anonymous: no token at all answers authentication-required.
  const anonymous = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${triagePrincipalId}`, base),
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ role: 'triage' }),
    },
  );
  expect(anonymous.status).toBe(401);

  // Permission removal strips administration: after deleting the
  // administrator's own role, even the stepped-up token can no longer act.
  const removed = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${adminPrincipalId}`, base),
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: '{}',
    },
  );
  expect(removed.status).toBe(204);
  const afterRemoval = await fetch(
    new URL(`/api/v1/projects/${projectId}/members/${triagePrincipalId}`, base),
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
        origin: base,
      },
      body: JSON.stringify({ role: 'maintainer' }),
    },
  );
  expect(afterRemoval.status).toBe(403);
});

it('denies instance powers to a Staff principal after creating their own project', async () => {
  await instanceEscalationContract(
    async (sql, values = []) => {
      let index = 0;
      return pool.query(
        sql.replace(/\?/g, () => `$${++index}`),
        values,
      );
    },
    (path, init = {}) =>
      fetch(new URL(path, base), {
        method: init.method ?? 'GET',
        headers: {
          origin: base,
          ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
          ...(init.body === undefined
            ? {}
            : { 'content-type': 'application/json' }),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      }),
    sessionKeys.provider,
  );
});
