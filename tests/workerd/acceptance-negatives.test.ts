import { afterAll, beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';
import { cryptoFixture } from '../fixtures/crypto-scenarios.ts';
import { createFakeAuthenticator } from '../fixtures/fake-authenticator.ts';
import { createNodeArgon2idProvider } from '../../apps/api-node/src/standard-password.ts';
import {
  createStandardPasswordService,
  initialStandardPasswordPolicy,
} from '../../packages/security/src/standard-password.ts';

// 06.V2 negatives matrix on workerd/D1: principal classes (anonymous,
// authenticated User, project Staff, and a membership revoked after setup),
// own-versus-others editing with the moderation lock, cross-project
// taxonomy/issue ids, removed assignees and deleted/disabled taxonomy,
// hidden/redacted content visibility, and direct API access without Origin
// or token. The second staff principal is seeded with a real Argon2id
// credential so its revocation journey runs through the public API.
const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const authOrigin = 'https://auth.poc.example';
const redirectUri = 'https://app.poc.example/oauth/callback';
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const triagerPassword = 'long-functional-password';
// Same initial policy the worker verifies with; the record is portable data.
const seedPasswordService = createStandardPasswordService(
  createNodeArgon2idProvider(
    1,
    initialStandardPasswordPolicy.maximum.memoryKiB,
  ),
  initialStandardPasswordPolicy,
);
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

async function tokenFromCookie(cookie: string, state: string): Promise<string> {
  const journeyVerifier = verifier();
  const authorized = await post(
    '/auth/authorize',
    {
      responseType: 'code',
      codeChallengeMethod: 'S256',
      clientId: 'negatives-cli',
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
    client_id: 'negatives-cli',
    code_verifier: journeyVerifier,
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

async function loginCookie(handle: string, password: string): Promise<string> {
  const login = await post('/auth/login', { handle, password });
  expect(login.status).toBe(200);
  const cookie = (login.headers.getSetCookie?.() ?? [])[0]?.split(';')[0];
  if (cookie === undefined) throw new Error('Missing session cookie');
  return cookie;
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
            clientId: 'negatives-cli',
            redirectUris: [redirectUri],
            scopes: ['public-api'],
          },
        ]),
        HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
        HYPERBUG_TEST_PASSKEY_RP_ID: 'auth.poc.example',
        HYPERBUG_TEST_PASSKEY_RP_NAME: 'HyperBug Negatives PoC',
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

it('enforces the 06.V2 negatives matrix on workerd/D1', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  expect(
    (
      await post('/api/v1/accounts/register', {
        handle: 'negauthor',
        password: 'long-functional-password',
      })
    ).status,
  ).toBe(202);
  expect(
    (
      await post('/api/v1/accounts/register', {
        handle: 'negother',
        password: 'long-functional-password',
      })
    ).status,
  ).toBe(202);

  // Second staff principal: bootstrap is single-shot, so seed the triage
  // candidate out of band with a real password credential and log it in
  // through the public flow. Membership itself is still granted and revoked
  // through the member routes below.
  const db = await mf.getD1Database('DB');
  const triagerPrincipalId = crypto.randomUUID();
  const triagerIdentityId = crypto.randomUUID();
  const triagerRecord = await seedPasswordService.hash(triagerPassword);
  await db.batch([
    db
      .prepare(
        "INSERT INTO principals (id, kind, display_name, status, created_at, revision) VALUES (?, 'staff', 'negtriager', 'active', ?, 1)",
      )
      .bind(triagerPrincipalId, Date.now()),
    db
      .prepare(
        "INSERT INTO identities (id, principal_id, provider, issuer, subject, created_at) VALUES (?, ?, 'local-password', 'hyperbug', 'negtriager', ?)",
      )
      .bind(triagerIdentityId, triagerPrincipalId, Date.now()),
    db
      .prepare(
        'INSERT INTO password_credentials (identity_id, record, revision, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
      )
      .bind(
        triagerIdentityId,
        JSON.stringify(triagerRecord),
        Date.now(),
        Date.now(),
      ),
  ]);

  const staffToken = await tokenFromCookie(
    await loginCookie('rootadmin', 'operator-password-1'),
    'staff',
  );
  const authorToken = await tokenFromCookie(
    await loginCookie('negauthor', 'long-functional-password'),
    'author',
  );
  const otherToken = await tokenFromCookie(
    await loginCookie('negother', 'long-functional-password'),
    'other',
  );
  const triagerToken = await tokenFromCookie(
    await loginCookie('negtriager', triagerPassword),
    'triager',
  );
  const staffPrincipalId = (
    (await (await call('/api/v1/account', { token: staffToken })).json()) as {
      principalId: string;
    }
  ).principalId;

  // Two public projects owned by the same staff principal.
  const projectA = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'negatives-a', name: 'Negatives A' },
    })
  ).json()) as { id: string };
  const projectB = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'negatives-b', name: 'Negatives B' },
    })
  ).json()) as { id: string };

  const labelBroken = (await (
    await call(`/api/v1/projects/${projectA.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'broken' },
    })
  ).json()) as { id: string };
  const labelDoomed = (await (
    await call(`/api/v1/projects/${projectA.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'doomed' },
    })
  ).json()) as { id: string };
  const typeFrozen = (await (
    await call(`/api/v1/projects/${projectA.id}/issue-types`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'defect', icon: '🐞' },
    })
  ).json()) as { id: string };
  const typeRetired = (await (
    await call(`/api/v1/projects/${projectA.id}/issue-types`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'chore', icon: '🧹' },
    })
  ).json()) as { id: string };
  const milestoneOne = (await (
    await call(`/api/v1/projects/${projectA.id}/milestones`, {
      method: 'POST',
      token: staffToken,
      body: { title: 'v0.1' },
    })
  ).json()) as { id: string };
  const labelForeign = (await (
    await call(`/api/v1/projects/${projectB.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'b-only' },
    })
  ).json()) as { id: string };

  // Principal classes: the journey issue is authored by a plain User.
  const anonymousCreate = await call(`/api/v1/projects/${projectA.id}/issues`, {
    method: 'POST',
    origin: null,
    body: { title: 'No principal', body: 'x' },
  });
  expect(anonymousCreate.status).toBe(401);
  const created = await call(`/api/v1/projects/${projectA.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Flaky build', body: 'Fails under load' },
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as { id: string; revision: number };
  let revision = issue.revision;
  expect(revision).toBe(1);

  // An authenticated User cannot triage or close.
  const userTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: authorToken,
      body: { expectedRevision: 1, labelIds: [labelBroken.id] },
    },
  );
  expect(userTriage.status).toBe(403);
  const userClose = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/close`,
    {
      method: 'POST',
      token: authorToken,
      body: { expectedRevision: 1, reason: 'completed' },
    },
  );
  expect(userClose.status).toBe(403);

  // Project staff (administrator) triages.
  const staffTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 1, labelIds: [labelBroken.id] },
    },
  );
  expect(staffTriage.status).toBe(200);
  revision = ((await staffTriage.json()) as { revision: number }).revision;
  expect(revision).toBe(2);

  // Membership lifecycle: a password token cannot grant the sensitive
  // role; a stepped-up administrator can. The granted triager exercises
  // triage, then loses it through member deletion and keeps only public
  // reads (the project stays public, so elevated actions answer 403).
  // The denial must be observed before any passkey ceremony: recent
  // authentication is principal-scoped, so one ceremony elevates every
  // token of that principal, password-issued ones included.
  const passwordGrant = await call(
    `/api/v1/projects/${projectA.id}/members/${triagerPrincipalId}`,
    { method: 'PUT', token: staffToken, body: { role: 'triage' } },
  );
  expect(passwordGrant.status).toBe(403);
  expect(await passwordGrant.json()).toMatchObject({
    error: { code: 'REAUTHENTICATION_REQUIRED' },
  });
  // Step the administrator up with a passkey ceremony.
  const staffCookie = await loginCookie('rootadmin', 'operator-password-1');
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
  const registrationVerify = await post(
    '/auth/passkey/register',
    {
      response: await authenticator.registration(
        options.challenge,
        Uint8Array.from(
          Buffer.from(options.user.id.replaceAll('-', ''), 'hex'),
        ),
      ),
    },
    { cookie: staffCookie },
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
  const steppedToken = await tokenFromCookie(passkeyCookie, 'stepped');
  const grant = await call(
    `/api/v1/projects/${projectA.id}/members/${triagerPrincipalId}`,
    { method: 'PUT', token: steppedToken, body: { role: 'triage' } },
  );
  expect(grant.status).toBe(200);
  expect(await grant.json()).toMatchObject({ role: 'triage' });
  const triagerTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: triagerToken,
      body: {
        expectedRevision: revision,
        labelIds: [labelBroken.id, labelDoomed.id],
      },
    },
  );
  expect(triagerTriage.status).toBe(200);
  revision = ((await triagerTriage.json()) as { revision: number }).revision;
  expect(revision).toBe(3);
  const revoked = await call(
    `/api/v1/projects/${projectA.id}/members/${triagerPrincipalId}`,
    { method: 'DELETE', token: steppedToken, body: {} },
  );
  expect(revoked.status).toBe(204);
  const triagerAfterRevoke = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: triagerToken,
      body: { expectedRevision: revision, labelIds: [labelBroken.id] },
    },
  );
  expect(triagerAfterRevoke.status).toBe(403);
  expect(await triagerAfterRevoke.json()).toMatchObject({
    error: { code: 'FORBIDDEN' },
  });
  const triagerPublicRead = await call(
    `/api/v1/projects/${projectA.id}/issues`,
    { token: triagerToken },
  );
  expect(triagerPublicRead.status).toBe(200);

  // Own-versus-others on the issue body/title: author 200, other User 403,
  // staff through the moderate permission 200.
  const authorEdit = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: {
        expectedRevision: revision,
        title: 'Flaky build!',
        body: 'Updated by author',
      },
    },
  );
  expect(authorEdit.status).toBe(200);
  revision = ((await authorEdit.json()) as { revision: number }).revision;
  expect(revision).toBe(4);
  const otherEdit = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: otherToken,
      body: { expectedRevision: revision, title: 'Hijack', body: 'No' },
    },
  );
  expect(otherEdit.status).toBe(403);
  const staffEdit = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: staffToken,
      body: {
        expectedRevision: revision,
        title: 'Flaky build!!',
        body: 'Updated by staff',
      },
    },
  );
  expect(staffEdit.status).toBe(200);
  revision = ((await staffEdit.json()) as { revision: number }).revision;
  expect(revision).toBe(5);

  // Own-versus-others on comments: author edits own, a stranger cannot,
  // staff can through issue:moderate, and a hidden comment locks its own
  // author out of editing.
  const commentPath = (commentId: string) =>
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/comments/${commentId}`;
  const firstComment = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/comments`,
    { method: 'POST', token: authorToken, body: { body: 'Author note' } },
  );
  expect(firstComment.status).toBe(201);
  const authorComment = (await firstComment.json()) as {
    id: string;
    revision: number;
  };
  const secondComment = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/comments`,
    { method: 'POST', token: otherToken, body: { body: 'Outsider note' } },
  );
  expect(secondComment.status).toBe(201);
  const otherComment = (await secondComment.json()) as { id: string };
  const ownCommentEdit = await call(commentPath(authorComment.id), {
    method: 'PATCH',
    token: authorToken,
    body: { expectedRevision: 1, body: 'Author note, edited' },
  });
  expect(ownCommentEdit.status).toBe(200);
  expect(((await ownCommentEdit.json()) as { revision: number }).revision).toBe(
    2,
  );
  const strangerCommentEdit = await call(commentPath(authorComment.id), {
    method: 'PATCH',
    token: otherToken,
    body: { expectedRevision: 2, body: 'Hijack' },
  });
  expect(strangerCommentEdit.status).toBe(403);
  const staffCommentEdit = await call(commentPath(authorComment.id), {
    method: 'PATCH',
    token: staffToken,
    body: { expectedRevision: 2, body: 'Author note, staff edit' },
  });
  expect(staffCommentEdit.status).toBe(200);
  expect(
    ((await staffCommentEdit.json()) as { revision: number }).revision,
  ).toBe(3);
  const hiddenModeration = await call(
    `${commentPath(otherComment.id)}/moderate`,
    { method: 'POST', token: staffToken, body: { moderation: 'hidden' } },
  );
  expect(hiddenModeration.status).toBe(200);
  expect(
    ((await hiddenModeration.json()) as { moderation: string }).moderation,
  ).toBe('hidden');
  const hiddenOwnEdit = await call(commentPath(otherComment.id), {
    method: 'PATCH',
    token: otherToken,
    body: { expectedRevision: 1, body: 'Still mine' },
  });
  expect(hiddenOwnEdit.status).toBe(403);

  // Cross-project ids: project A taxonomy cannot build an issue in project
  // B, and project B's issue id does not exist under project A's path.
  const foreignLabelCreate = await call(
    `/api/v1/projects/${projectB.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad label', body: 'x', labelIds: [labelBroken.id] },
    },
  );
  expect(foreignLabelCreate.status).toBe(400);
  expect(await foreignLabelCreate.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const foreignTypeCreate = await call(
    `/api/v1/projects/${projectB.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad type', body: 'x', typeId: typeFrozen.id },
    },
  );
  expect(foreignTypeCreate.status).toBe(400);
  expect(await foreignTypeCreate.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const foreignMilestoneCreate = await call(
    `/api/v1/projects/${projectB.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad milestone', body: 'x', milestoneId: milestoneOne.id },
    },
  );
  expect(foreignMilestoneCreate.status).toBe(400);
  const localCreate = await call(`/api/v1/projects/${projectB.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'B-side report', body: 'x', labelIds: [labelForeign.id] },
  });
  expect(localCreate.status).toBe(201);
  const bIssue = (await localCreate.json()) as { id: string };
  const crossProjectRead = await call(
    `/api/v1/projects/${projectA.id}/issues/${bIssue.id}`,
    { token: authorToken },
  );
  expect(crossProjectRead.status).toBe(404);
  const crossProjectTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${bIssue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 1, labelIds: [] },
    },
  );
  expect(crossProjectTriage.status).toBe(404);

  // Removed assignee: the revoked triager is no longer a member, so an
  // assignment targeting it is refused while a current member still works.
  const removedAssignee = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [triagerPrincipalId] },
    },
  );
  expect(removedAssignee.status).toBe(400);
  expect(await removedAssignee.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const eligibleAssignee = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [staffPrincipalId] },
    },
  );
  expect(eligibleAssignee.status).toBe(200);
  revision = ((await eligibleAssignee.json()) as { revision: number }).revision;
  const clearedAssignees = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, assigneeIds: [] },
    },
  );
  expect(clearedAssignees.status).toBe(200);
  revision = ((await clearedAssignees.json()) as { revision: number }).revision;

  // Deleted label: unreferenced entries delete through the taxonomy route,
  // and the dead id is refused afterwards both on triage and creation.
  const droppedLabel = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, labelIds: [labelBroken.id] },
    },
  );
  expect(droppedLabel.status).toBe(200);
  revision = ((await droppedLabel.json()) as { revision: number }).revision;
  const labelDeleted = await call(
    `/api/v1/projects/${projectA.id}/labels/${labelDoomed.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(labelDeleted.status).toBe(204);
  const deletedLabelTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, labelIds: [labelDoomed.id] },
    },
  );
  expect(deletedLabelTriage.status).toBe(400);
  expect(await deletedLabelTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const deletedLabelCreate = await call(
    `/api/v1/projects/${projectA.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Dead label', body: 'x', labelIds: [labelDoomed.id] },
    },
  );
  expect(deletedLabelCreate.status).toBe(400);

  // Deleted milestone: same pattern — detach, delete, refuse.
  const attachedMilestone = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, milestoneId: milestoneOne.id },
    },
  );
  expect(attachedMilestone.status).toBe(200);
  revision = ((await attachedMilestone.json()) as { revision: number })
    .revision;
  const clearedMilestone = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, milestoneId: null },
    },
  );
  expect(clearedMilestone.status).toBe(200);
  revision = ((await clearedMilestone.json()) as { revision: number }).revision;
  const milestoneDeleted = await call(
    `/api/v1/projects/${projectA.id}/milestones/${milestoneOne.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(milestoneDeleted.status).toBe(204);
  const deletedMilestoneTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, milestoneId: milestoneOne.id },
    },
  );
  expect(deletedMilestoneTriage.status).toBe(400);
  expect(await deletedMilestoneTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });

  // Deleted issue type: never referenced, so it deletes directly.
  const typeDeleted = await call(
    `/api/v1/projects/${projectA.id}/issue-types/${typeRetired.id}`,
    { method: 'DELETE', token: staffToken, body: {} },
  );
  expect(typeDeleted.status).toBe(204);
  const deletedTypeTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, typeId: typeRetired.id },
    },
  );
  expect(deletedTypeTriage.status).toBe(400);

  // Disabled issue type: new assignments refuse it while an issue that
  // already carries it keeps the reference.
  const frozenCreated = await call(`/api/v1/projects/${projectA.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Frozen reference', body: 'x', typeId: typeFrozen.id },
  });
  expect(frozenCreated.status).toBe(201);
  const frozenIssue = (await frozenCreated.json()) as { id: string };
  const typeDisabled = await call(
    `/api/v1/projects/${projectA.id}/issue-types/${typeFrozen.id}`,
    {
      method: 'PATCH',
      token: staffToken,
      body: { expectedRevision: 1, enabled: false },
    },
  );
  expect(typeDisabled.status).toBe(200);
  const disabledTypeTriage = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/type`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: revision, typeId: typeFrozen.id },
    },
  );
  expect(disabledTypeTriage.status).toBe(400);
  expect(await disabledTypeTriage.json()).toMatchObject({
    error: { code: 'ISSUE_INVALID' },
  });
  const frozenRead = await call(
    `/api/v1/projects/${projectA.id}/issues/${frozenIssue.id}`,
    { origin: null },
  );
  expect(frozenRead.status).toBe(200);
  expect(((await frozenRead.json()) as { typeId: string | null }).typeId).toBe(
    typeFrozen.id,
  );

  // Hidden issue: the author's own issue vanishes for every non-moderator,
  // the moderator still sees and edits it, and the author is locked out.
  const spamCreated = await call(`/api/v1/projects/${projectA.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Spam report', body: 'Unwanted content' },
  });
  expect(spamCreated.status).toBe(201);
  const spamIssue = (await spamCreated.json()) as { id: string };
  await db
    .prepare("UPDATE issues SET moderation = 'hidden' WHERE id = ?")
    .bind(spamIssue.id)
    .run();
  const hiddenAnonDetail = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}`,
    { origin: null },
  );
  expect(hiddenAnonDetail.status).toBe(404);
  const hiddenUserDetail = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}`,
    { token: otherToken },
  );
  expect(hiddenUserDetail.status).toBe(404);
  const hiddenAuthorDetail = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}`,
    { token: authorToken },
  );
  expect(hiddenAuthorDetail.status).toBe(404);
  const hiddenStaffDetail = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}`,
    { token: staffToken },
  );
  expect(hiddenStaffDetail.status).toBe(200);
  const anonList = await call(`/api/v1/projects/${projectA.id}/issues`, {
    origin: null,
  });
  expect(anonList.status).toBe(200);
  const anonIds = ((await anonList.json()) as { items: { id: string }[] })
    .items;
  expect(anonIds).toHaveLength(2);
  expect(anonIds.map((item) => item.id)).not.toContain(spamIssue.id);
  const userList = await call(`/api/v1/projects/${projectA.id}/issues`, {
    token: otherToken,
  });
  expect(
    ((await userList.json()) as { items: { id: string }[] }).items.map(
      (item) => item.id,
    ),
  ).not.toContain(spamIssue.id);
  const staffList = await call(`/api/v1/projects/${projectA.id}/issues`, {
    token: staffToken,
  });
  expect(
    ((await staffList.json()) as { items: { id: string }[] }).items.map(
      (item) => item.id,
    ),
  ).toContain(spamIssue.id);
  const hiddenAuthorEdit = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, title: 'Locked', body: 'No' },
    },
  );
  expect(hiddenAuthorEdit.status).toBe(403);
  const hiddenStaffEdit = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}`,
    {
      method: 'PATCH',
      token: staffToken,
      body: { expectedRevision: 1, title: 'Spam report', body: 'Withheld' },
    },
  );
  expect(hiddenStaffEdit.status).toBe(200);
  // Issue sub-resources inherit the issue's own moderation: the hidden
  // issue's timeline answers 404 to the same audience its detail does.
  const hiddenAnonTimeline = await call(
    `/api/v1/projects/${projectA.id}/issues/${spamIssue.id}/timeline`,
    { origin: null },
  );
  expect(hiddenAnonTimeline.status).toBe(404);

  // Hidden comment on a visible issue: excluded for the public and the
  // author, present for the moderator (whose permalink shows the body).
  const hiddenAnonPermalink = await call(commentPath(otherComment.id), {
    origin: null,
  });
  expect(hiddenAnonPermalink.status).toBe(404);
  const hiddenAuthorPermalink = await call(commentPath(otherComment.id), {
    token: otherToken,
  });
  expect(hiddenAuthorPermalink.status).toBe(404);
  const staffPermalink = await call(commentPath(otherComment.id), {
    token: staffToken,
  });
  expect(staffPermalink.status).toBe(200);
  expect(((await staffPermalink.json()) as { body: string }).body).toBe(
    'Outsider note',
  );
  const commentList = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/comments`,
    { origin: null },
  );
  expect(
    ((await commentList.json()) as { comments: { id: string }[] }).comments.map(
      (item) => item.id,
    ),
  ).toEqual([authorComment.id]);
  const anonTimeline = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/timeline`,
    { origin: null },
  );
  expect(
    (
      (await anonTimeline.json()) as { items: { kind: string; id: string }[] }
    ).items
      .filter((item) => item.kind === 'comment')
      .map((item) => item.id),
  ).toEqual([authorComment.id]);

  // Redacted comment behaves like hidden for the public.
  const redaction = await call(`${commentPath(otherComment.id)}/moderate`, {
    method: 'POST',
    token: staffToken,
    body: { moderation: 'redacted' },
  });
  expect(redaction.status).toBe(200);
  expect(((await redaction.json()) as { moderation: string }).moderation).toBe(
    'redacted',
  );
  const redactedAnonPermalink = await call(commentPath(otherComment.id), {
    origin: null,
  });
  expect(redactedAnonPermalink.status).toBe(404);
  const redactedList = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/comments`,
    { origin: null },
  );
  expect(
    ((await redactedList.json()) as { comments: { id: string }[] }).comments,
  ).toHaveLength(1);
  const redactedTimeline = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/timeline`,
    { origin: null },
  );
  expect(
    (
      (await redactedTimeline.json()) as { items: { kind: string }[] }
    ).items.filter((item) => item.kind === 'comment'),
  ).toHaveLength(1);
  const staffTimeline = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/timeline`,
    { token: staffToken },
  );
  const staffTimelineComments = (
    (await staffTimeline.json()) as {
      items: { kind: string; id: string; body?: string }[];
    }
  ).items.filter((item) => item.kind === 'comment');
  expect(staffTimelineComments.map((item) => item.id)).toEqual([
    authorComment.id,
    otherComment.id,
  ]);
  expect(
    staffTimelineComments.find((item) => item.id === otherComment.id)?.body,
  ).toBeUndefined();

  // Direct API access: a client with neither Origin nor token reads every
  // public representation and is refused on every mutation.
  const directProject = await call(`/api/v1/projects/${projectA.id}`, {
    origin: null,
  });
  expect(directProject.status).toBe(200);
  expect(((await directProject.json()) as { id: string }).id).toBe(projectA.id);
  const directList = await call(`/api/v1/projects/${projectA.id}/issues`, {
    origin: null,
  });
  expect(directList.status).toBe(200);
  const directDetail = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}`,
    { origin: null },
  );
  expect(directDetail.status).toBe(200);
  const directComments = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/comments`,
    { origin: null },
  );
  expect(directComments.status).toBe(200);
  const directTimeline = await call(
    `/api/v1/projects/${projectA.id}/issues/${issue.id}/timeline`,
    { origin: null },
  );
  expect(directTimeline.status).toBe(200);
  const directMutations = [
    call('/api/v1/projects', {
      method: 'POST',
      origin: null,
      body: { slug: 'direct', name: 'Direct' },
    }),
    call(`/api/v1/projects/${projectA.id}`, {
      method: 'PATCH',
      origin: null,
      body: { expectedRevision: 1, name: 'Nope' },
    }),
    call(`/api/v1/projects/${projectA.id}/labels`, {
      method: 'POST',
      origin: null,
      body: { name: 'Nope' },
    }),
    call(`/api/v1/projects/${projectA.id}/members/${staffPrincipalId}`, {
      method: 'PUT',
      origin: null,
      body: { role: 'triage' },
    }),
    call(`/api/v1/projects/${projectA.id}/members/${staffPrincipalId}`, {
      method: 'DELETE',
      origin: null,
      body: {},
    }),
    call(`/api/v1/projects/${projectA.id}/issues`, {
      method: 'POST',
      origin: null,
      body: { title: 'Nope', body: 'x' },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}`, {
      method: 'PATCH',
      origin: null,
      body: { expectedRevision: 1, title: 'Nope', body: 'x' },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/close`, {
      method: 'POST',
      origin: null,
      body: { expectedRevision: 1, reason: 'completed' },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/reopen`, {
      method: 'POST',
      origin: null,
      body: { expectedRevision: 1 },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/labels`, {
      method: 'PUT',
      origin: null,
      body: { expectedRevision: 1, labelIds: [] },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/assignees`, {
      method: 'PUT',
      origin: null,
      body: { expectedRevision: 1, assigneeIds: [] },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/type`, {
      method: 'PUT',
      origin: null,
      body: { expectedRevision: 1, typeId: null },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/milestone`, {
      method: 'PUT',
      origin: null,
      body: { expectedRevision: 1, milestoneId: null },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/comments`, {
      method: 'POST',
      origin: null,
      body: { body: 'Nope' },
    }),
    call(commentPath(authorComment.id), {
      method: 'PATCH',
      origin: null,
      body: { expectedRevision: 3, body: 'Nope' },
    }),
    call(`${commentPath(authorComment.id)}/moderate`, {
      method: 'POST',
      origin: null,
      body: { moderation: 'hidden' },
    }),
    call(commentPath(authorComment.id), {
      method: 'DELETE',
      origin: null,
      body: {},
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/reactions`, {
      method: 'POST',
      origin: null,
      body: { reaction: 'heart' },
    }),
    call(`/api/v1/projects/${projectA.id}/issues/${issue.id}/reactions/heart`, {
      method: 'DELETE',
      origin: null,
      body: {},
    }),
  ];
  for (const attempt of directMutations) {
    expect((await attempt).status).toBe(401);
  }
});
