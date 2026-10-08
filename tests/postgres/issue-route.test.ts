import { searchHttpContract } from '../fixtures/search-contract.ts';
import { createPostgresSearchIndexStore } from '@hyperbug/database-postgres';
import { uploadHttpContract } from '../fixtures/upload-http-contract.ts';
import { attachmentHttpContract } from '../fixtures/attachment-http-contract.ts';
import { seedFormUpload } from '../fixtures/form-submission-contract.ts';
import { uploadProof } from '../fixtures/upload-proof.ts';
import { configureNodeUploads } from '../../apps/api-node/src/uploads.ts';
import { startLocalS3 } from '../../tooling/local-s3.ts';
import { contentDefinitionHttpContract } from '../fixtures/content-definition-http-contract.ts';
import { contentHttpContract } from '../fixtures/content-http-contract.ts';
import { contentPolicyUpgradeContract } from '../fixtures/content-policy-upgrade-contract.ts';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Pool } from 'pg';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { node } from '@elysia/node';
import { request as httpsRequest } from 'node:https';
import { loadNodeTls, type NodeTls } from '../../apps/api-node/src/tls.ts';
import { Readable } from 'node:stream';
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

// 06.2 lifecycle journey on the Node/PostgreSQL profile: the identical issue
// surface against the PostgreSQL repository — number allocation, taxonomy
// references, idempotent replay, revision conflicts, the triage mutation set
// with atomic timeline/outbox writes, moderation-aware reads and the audit
// suspension.
const databaseName = 'hyperbug_issue_route_test';
const redirectUri = 'http://localhost:5173/oauth/callback';
const clients = [
  {
    clientId: 'issues-cli',
    redirectUris: [redirectUri],
    scopes: ['public-api'],
  },
];
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let bootstrap: Pool;
let pool: Pool;
let configured: ReturnType<typeof configureNodeAbuseAdmission>;
let listener: Awaited<ReturnType<typeof listenNode>>;
let mediaListener: Awaited<ReturnType<typeof listenNode>>;
let mediaOrigin: string;
let mediaTls: NodeTls;
let directory: string;
let base: string;
let appOptions: Parameters<typeof createApp>[0];
const sessionKeys = cryptoFixture();
const uploadObservations: string[] = [];
let storage: Awaited<ReturnType<typeof startLocalS3>>;
let uploadStorage: Awaited<ReturnType<typeof configureNodeUploads>>;

// Native TCP transport with virtual media Host; no DNS/loopback alias assumption.
function mediaFetch(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
) {
  return new Promise<Response>((complete, reject) => {
    const req = httpsRequest(
      new URL(path, mediaListener.url),
      {
        method: init.method ?? 'GET',
        headers: { host: new URL(mediaOrigin).host, ...init.headers },
        ca: mediaTls.cert,
      },
      (incoming) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers))
          if (value !== undefined)
            headers.set(name, Array.isArray(value) ? value.join(', ') : value);
        const empty = init.method === 'HEAD' || incoming.statusCode === 204;
        if (empty) incoming.resume();
        complete(
          new Response(
            empty
              ? null
              : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>),
            {
              status: incoming.statusCode!,
              headers,
            },
          ),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(5000, () =>
      req.destroy(new Error('Media test transport timeout')),
    );
    req.end();
  });
}

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

const call = (
  path: string,
  init: {
    method?: string;
    token?: string;
    body?: unknown;
    origin?: string | null;
    idempotencyKey?: string;
    ifNoneMatch?: string;
  } = {},
) =>
  fetch(new URL(path, base), {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined
        ? {}
        : { 'content-type': 'application/json' }),
      ...(init.origin === null ? {} : { origin: init.origin ?? base }),
      ...(init.token === undefined
        ? {}
        : { authorization: `Bearer ${init.token}` }),
      ...(init.idempotencyKey === undefined
        ? {}
        : { 'idempotency-key': init.idempotencyKey }),
      ...(init.ifNoneMatch === undefined
        ? {}
        : { 'if-none-match': init.ifNoneMatch }),
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

async function loginToken(handle: string, password: string): Promise<string> {
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
      clientId: 'issues-cli',
      redirectUri,
      scope: 'public-api',
      state: 'pg-issue-state',
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
      client_id: 'issues-cli',
      code_verifier: journeyVerifier,
    }),
  });
  expect(exchange.status).toBe(200);
  return ((await exchange.json()) as { accessToken: string }).accessToken;
}

beforeAll(async () => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
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
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-issue-route-'));
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
  const config = {
    ...loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
    allowedOrigins: ['http://localhost:5173'],
  };
  storage = await startLocalS3();
  const storageFile = join(directory, 'upload-storage.json');
  await writeFile(
    storageFile,
    JSON.stringify({
      endpoint: storage.endpoint,
      bucket: storage.bucket,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: storage.credentials,
      allowLocalHttp: true,
    }),
    { mode: 0o600 },
  );
  uploadStorage = await configureNodeUploads(
    configured.uploadIntentStore,
    storageFile,
    'local',
  );
  appOptions = {
    adapter: node(),
    config,
    telemetry: jsonTelemetry((line) => uploadObservations.push(line)),
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
    taxonomyStore: configured.taxonomyStore,
    contentDefinitionStore: configured.contentDefinitionStore,
    uploads: uploadStorage.uploads,
    commentStore: configured.commentStore,
    issueRepository: configured.issueRepository,
    searchStore: configured.searchStore,
    searchIndexStore: configured.searchIndexStore,
    accountAdministration: configured.accountAdministration,
    auditAppend: configured.auditAppend,
    bootstrapCode: enrollmentCode,
    staffEnrollmentStore: configured.staffEnrollmentStore,
  };
  listener = await listenNode(createApp(appOptions), 0);
  base = listener.url;
  config.allowedOrigins.push(base);
  const selection = await listenNode(createApp(appOptions), 0);
  mediaOrigin = selection.url
    .replace('http:', 'https:')
    .replace('127.0.0.1', '127.0.0.2');
  await selection.close();
  const certFile = join(directory, 'media-cert.pem'),
    mediaKeyFile = join(directory, 'media-key.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-noenc',
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-keyout',
      mediaKeyFile,
      '-out',
      certFile,
    ],
    { stdio: 'ignore' },
  );
  const tlsFile = join(directory, 'media-tls.json');
  await writeFile(
    tlsFile,
    JSON.stringify({
      cert: await readFile(certFile, 'utf8'),
      key: await readFile(mediaKeyFile, 'utf8'),
    }),
    { mode: 0o600 },
  );
  mediaTls = (await loadNodeTls(tlsFile))!;
  mediaListener = await listenNode(
    createApp({
      ...appOptions,
      attachmentStore: configured.attachmentStore,
      mediaOrigin,
    }),
    Number(new URL(mediaOrigin).port),
    '127.0.0.1',
    mediaTls,
  );
});

afterAll(async () => {
  await listener?.close().catch(() => {});
  await mediaListener?.close().catch(() => {});
  uploadStorage?.close();
  await storage?.close();
  await pool?.end().catch(() => {});
  if (bootstrap)
    await bootstrap.query(`DROP DATABASE ${databaseName}`).catch(() => {});
  await bootstrap?.end().catch(() => {});
  if (directory) await rm(directory, { recursive: true, force: true });
});

it('delivers the issue lifecycle on Node/PostgreSQL', async () => {
  const enrolled = await post('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'operator-password-1',
  });
  expect(enrolled.status).toBe(201);
  await post('/api/v1/accounts/register', {
    handle: 'issueauthor',
    password: 'long-functional-password',
  });
  const staffToken = await loginToken('rootadmin', 'operator-password-1');
  const authorToken = await loginToken(
    'issueauthor',
    'long-functional-password',
  );
  const staffAccount = await call('/api/v1/account', { token: staffToken });
  const staffPrincipalId = (
    (await staffAccount.json()) as { principalId: string }
  ).principalId;

  const project = (await (
    await call('/api/v1/projects', {
      method: 'POST',
      token: staffToken,
      body: { slug: 'pg-lifecycle', name: 'PG Lifecycle' },
    })
  ).json()) as { id: string };
  const label = (await (
    await call(`/api/v1/projects/${project.id}/labels`, {
      method: 'POST',
      token: staffToken,
      body: { name: 'Bug' },
    })
  ).json()) as { id: string };
  const milestone = (await (
    await call(`/api/v1/projects/${project.id}/milestones`, {
      method: 'POST',
      token: staffToken,
      body: { title: 'v1.0' },
    })
  ).json()) as { id: string };

  const created = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: {
      title: 'PG crash',
      body: 'PostgreSQL body',
      milestoneId: milestone.id,
      labelIds: [label.id],
      assigneeIds: [staffPrincipalId],
    },
  });
  expect(created.status).toBe(201);
  const issue = (await created.json()) as {
    id: string;
    number: number;
    revision: number;
    labelIds: string[];
    assigneeIds: string[];
  };
  expect(issue.number).toBe(1);
  expect(issue.labelIds).toEqual([label.id]);
  expect(issue.assigneeIds).toEqual([staffPrincipalId]);

  const second = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Second', body: 'Another' },
    idempotencyKey: 'pg-idem-key-0001',
  });
  expect(second.status).toBe(201);
  const replay = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Second', body: 'Another' },
    idempotencyKey: 'pg-idem-key-0001',
  });
  expect(replay.status).toBe(201);
  expect((await replay.json()).id).toBe((await second.json()).id);
  const { rows: numbers } = await pool.query(
    'SELECT number FROM issues WHERE project_id = $1 ORDER BY number',
    [project.id],
  );
  expect(numbers.map((row) => row.number)).toEqual([1, 2]);

  // Taxonomy references outside the project never create.
  const foreignLabel = await call(`/api/v1/projects/${project.id}/issues`, {
    method: 'POST',
    token: authorToken,
    body: { title: 'Bad', body: 'x', labelIds: [crypto.randomUUID()] },
  });
  expect(foreignLabel.status).toBe(400);
  const ineligibleAssignee = await call(
    `/api/v1/projects/${project.id}/issues`,
    {
      method: 'POST',
      token: authorToken,
      body: { title: 'Bad', body: 'x', assigneeIds: [crypto.randomUUID()] },
    },
  );
  expect(ineligibleAssignee.status).toBe(400);

  // Own-content edit, stranger denial, stale revision conflict.
  const edited = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, title: 'PG crash!', body: 'Updated' },
    },
  );
  expect(edited.status).toBe(200);
  expect(((await edited.json()) as { revision: number }).revision).toBe(2);
  const stale = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    {
      method: 'PATCH',
      token: authorToken,
      body: { expectedRevision: 1, title: 'Stale', body: 'x' },
    },
  );
  expect(stale.status).toBe(409);

  // Triage set with a same-value no-op and a real change.
  const noOpLabels = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 2, labelIds: [label.id] },
    },
  );
  expect(noOpLabels.status).toBe(200);
  expect(((await noOpLabels.json()) as { revision: number }).revision).toBe(2);
  const labelsCleared = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/labels`,
    {
      method: 'PUT',
      token: staffToken,
      body: { expectedRevision: 2, labelIds: [] },
    },
  );
  expect(labelsCleared.status).toBe(200);

  const closed = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/close`,
    {
      method: 'POST',
      token: staffToken,
      body: { expectedRevision: 3, reason: 'completed' },
    },
  );
  expect(closed.status).toBe(200);
  const reopened = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}/reopen`,
    { method: 'POST', token: staffToken, body: { expectedRevision: 4 } },
  );
  expect(reopened.status).toBe(200);

  const { rows: events } = await pool.query(
    'SELECT action, aggregate_revision FROM timeline_events WHERE issue_id = $1 ORDER BY aggregate_revision',
    [issue.id],
  );
  expect(events.map((row) => row.action)).toEqual([
    'issue.create',
    'issue.edit',
    'issue.labels',
    'issue.close',
    'issue.reopen',
  ]);
  const { rows: outbox } = await pool.query(
    'SELECT event_type FROM outbox WHERE aggregate_id = $1 ORDER BY created_at, id',
    [issue.id],
  );
  expect(outbox.map((row) => row.event_type)).toEqual([
    'issue.create',
    'issue.edit',
    'issue.labels',
    'issue.close',
    'issue.reopen',
  ]);

  // Moderation-aware reads on PostgreSQL.
  await pool.query('UPDATE issues SET moderation = $1 WHERE id = $2', [
    'hidden',
    issue.id,
  ]);
  const hiddenDetail = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { origin: null },
  );
  expect(hiddenDetail.status).toBe(404);
  const staffHidden = await call(
    `/api/v1/projects/${project.id}/issues/${issue.id}`,
    { token: staffToken },
  );
  expect(staffHidden.status).toBe(200);
  const list = await call(`/api/v1/projects/${project.id}/issues`, {
    origin: null,
  });
  expect(((await list.json()) as { items: unknown[] }).items).toHaveLength(1);
  const staffList = await call(`/api/v1/projects/${project.id}/issues`, {
    token: staffToken,
  });
  expect(((await staffList.json()) as { items: unknown[] }).items).toHaveLength(
    2,
  );

  // 06.2c's audit portion stays suspended: no issue.* audit events.
  const { rows: audited } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM audit_events WHERE action LIKE 'issue.%'",
  );
  expect(audited[0]!.count).toBe(0);
  await contentHttpContract({
    projectId: project.id,
    token: staffToken,
    call,
    query: async (sql, values) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    },
  });
  const uploadCommand = async (
    id: string,
    operation: string,
    text = '',
    failDelete = false,
  ) => {
    const scope = (
      await pool.query(
        'SELECT id, project_id AS "projectId", principal_id AS "principalId" FROM upload_intents WHERE id = $1',
        [id],
      )
    ).rows[0];
    return uploadProof(
      uploadStorage.uploads!,
      scope,
      operation,
      text,
      failDelete,
    );
  };
  await uploadHttpContract({
    token: staffToken,
    userToken: authorToken,
    call,
    query: async (sql, values) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    },
    failSigning: async (id) => {
      await uploadCommand(id, 'fail-signing');
    },
    observations: async () => JSON.stringify(uploadObservations),
    stage: async (id, text) => {
      await uploadCommand(id, 'stage', text);
    },
    process: async (id) => {
      await uploadCommand(id, 'process');
    },
    finalText: async (id) => (await uploadCommand(id, 'final')).text!,
    finalSize: async (id) => (await uploadCommand(id, 'final-size')).sizeBytes!,
    syntheticScan: async (id, partial) => {
      await uploadCommand(
        id,
        partial ? 'synthetic-partial-scan' : 'synthetic-scan',
      );
    },
    stagePart: async (id, number, size) => {
      const result = await uploadCommand(
        id,
        'multipart-part',
        `${number}:${size}`,
      );
      return { etag: result.etag!, sizeBytes: result.sizeBytes! };
    },
    failCompletion: async (id) => {
      await uploadCommand(id, 'fail-completion');
    },
    cleanup: async (id, failDelete) => {
      await uploadCommand(id, 'cleanup', '', failDelete);
    },
  });
  await attachmentHttpContract({
    token: staffToken,
    userToken: authorToken,
    call,
    allowedOrigin: base,
    proof: uploadCommand,
    media: mediaFetch,
    mediaMismatch: (path) =>
      mediaFetch(path, {
        headers: {
          host: `${new URL(mediaOrigin).hostname}:1`,
          'x-forwarded-host': new URL(mediaOrigin).host,
          'x-forwarded-proto': 'https',
        },
      }),
    observations: async () => uploadObservations.join('\n'),
    query: async (sql, values) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    },
  });
  await contentDefinitionHttpContract({
    token: staffToken,
    userToken: authorToken,
    principalId: staffPrincipalId,
    call,
    seedAttachment: async ({ draftId, ...scope }) =>
      (
        await seedFormUpload(uploadStorage.uploads!.intents, scope, {
          draftId,
          now: Date.now(),
          filename: 'fixture.log',
        })
      ).id,
    query: async (sql, values) => {
      let index = 0;
      return (
        await pool.query(
          sql.replace(/\?/g, () => `$${++index}`),
          values,
        )
      ).rows;
    },
  });
  await contentPolicyUpgradeContract({
    projectId: project.id,
    token: staffToken,
    call,
    upgrade: async () => {
      const replacement = (await import(
        pathToFileURL(
          resolve('dist/policy-upgrade-server/policy-upgrade-server.mjs'),
        ).href
      )) as { createApp: typeof createApp };
      await listener.close();
      listener = await listenNode(replacement.createApp(appOptions), 0);
      base = listener.url;
    },
  });
}, 30000);

searchHttpContract(() => ({
  query: async (sql, values = []) => {
    let parameter = 0;
    return (
      await pool.query(
        sql.replace(/\?/gu, () => '$' + ++parameter),
        values,
      )
    ).rows;
  },
  index: createPostgresSearchIndexStore(pool),
  fetch: (path) => call(path),
}));
