import { prepareWorkerBrowserUploads } from './web-upload-worker-services.ts';
import { browserUploadServices } from './web-upload-services.ts';
import { Pool } from 'pg';
import { createHash, X509Certificate } from 'node:crypto';
import { markdownCorpus, rejectedMarkdown } from './markdown-corpus.ts';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { loadNodeTls } from '../../apps/api-node/src/tls.ts';
import { node } from '@elysia/node';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { createNodeStandardPasswordService } from '../../apps/api-node/src/standard-password.ts';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { listenNode } from '../../apps/api-node/src/listen.ts';
import { postgresNodeBindings } from './postgres-node-bindings.ts';
import { migrationStatements } from './migrations.ts';
import { cryptoFixture } from './crypto-scenarios.ts';
import { abuseKeyFixture } from './abuse-key-fixture.ts';
import { deploymentPolicy } from '../../apps/web/scripts/prepare-deployment.ts';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from './worker-modules.ts';
import { createD1SearchIndexStore } from '@hyperbug/database-d1';
import type { D1Database } from '@cloudflare/workers-types';
import type { SearchIndexStore } from '@hyperbug/application';

if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
  throw new Error('Use the isolated PostgreSQL cluster wrapper');
const profile =
  process.argv.find((arg) => arg.startsWith('--profile='))?.slice(10) ?? 'node';
if (!['node', 'standard', 'minimum'].includes(profile))
  throw new Error('Unknown local profile');
const uploadLane = process.argv.includes('--uploads');
const manualLane = process.argv.includes('--manual');
const performanceLane = process.argv.includes('--performance');
const directory = await mkdtemp(join(tmpdir(), 'hyperbug-web12-'));
const dbName = `hyperbug_web12_${crypto.randomUUID().replaceAll('-', '')}`;
const root = resolve('apps/web/dist');
const bootstrap = new Pool({ max: 1 });
let pool: Pool | undefined;
let configured: ReturnType<typeof configureNodeAbuseAdmission> | undefined;
let listener: Awaited<ReturnType<typeof listenNode>> | undefined;
let mf: Miniflare | undefined;
let workerUploadSetup:
  | Awaited<ReturnType<typeof prepareWorkerBrowserUploads>>
  | undefined;
let uploadServices:
  | Awaited<ReturnType<typeof browserUploadServices>>
  | ReturnType<
      Awaited<ReturnType<typeof prepareWorkerBrowserUploads>>['attach']
    >
  | undefined;
let mediaListener: Awaited<ReturnType<typeof listenNode>> | undefined;
let mediaOrigin = '';
let mediaSpki = '';
let query: (
  sql: string,
  values?: (string | number)[],
) => Promise<Record<string, unknown>[]>;
let index: SearchIndexStore;
let config: {
  schemaVersion: 1;
  applicationName: string;
  apiBaseUrl: string;
  authBaseUrl: string;
  mediaOrigins: string[];
  uploadOrigins?: string[];
};
const staticServer = createServer(async (request, response) => {
  try {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (
      path.startsWith('/.') ||
      path.startsWith('/api/') ||
      ['/_headers', '/_redirects', '/hosting.json'].includes(path)
    ) {
      response.writeHead(404).end();
      return;
    }
    let file = resolve(root, '.' + decodeURIComponent(path));
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    let body: Buffer;
    if (path === '/config.json') body = Buffer.from(JSON.stringify(config));
    else {
      try {
        body = await readFile(file);
      } catch {
        if (extname(file)) {
          response.writeHead(404).end();
          return;
        }
        file = join(root, 'index.html');
        body = await readFile(file);
      }
    }
    response.writeHead(200, {
      ...deploymentPolicy(config).headers,
      'cache-control': 'no-store',
      'content-type':
        (
          {
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
            '.json': 'application/json',
          } as Record<string, string>
        )[extname(file)] ?? 'application/json',
    });
    response.end(body);
  } catch {
    response.writeHead(500).end('Local static fixture unavailable');
  }
});
staticServer.listen(0, '127.0.0.1');
await once(staticServer, 'listening');
const staticAddress = staticServer.address();
if (!staticAddress || typeof staticAddress === 'string')
  throw new Error('Expected static listener');
const origin = `http://127.0.0.1:${staticAddress.port}`;
const clients = ['hyperbug-web', 'workflow-seed'].map((clientId) => ({
  clientId,
  redirectUris: [origin + '/oauth/callback'],
  scopes: ['public-api'],
}));
const keys = cryptoFixture();
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
let apiOrigin = '';
let projectId = '';
let replaceForm: (() => Promise<void>) | undefined;
let browserChild: ReturnType<typeof spawn> | undefined;
async function reindex() {
  const rows = await query(
    'SELECT i.id,i.revision FROM issues i LEFT JOIN search_documents d ON d.issue_id=i.id AND d.project_id=i.project_id WHERE i.project_id=? AND (d.issue_id IS NULL OR d.revision<>i.revision) ORDER BY i.id LIMIT 100',
    [projectId],
  );
  for (const row of rows)
    await index.backfill({
      projectId,
      limit: 1,
      event: {
        version: 1,
        projectId,
        issueId: String(row.id),
        revision: Number(row.revision),
      },
      ...(profile === 'minimum' ? { tier: 'cloudflare-minimum' as const } : {}),
    });
}
const control = createServer(async (request, response) => {
  try {
    const uploadAction =
      /^\/upload\/(process|scan|expire|quota)\/([0-9a-f-]{36})$/.exec(
        request.url ?? '',
      );
    if (
      manualLane &&
      request.method === 'POST' &&
      request.url === '/manual/stop'
    ) {
      browserChild?.kill('SIGTERM');
      response.writeHead(204).end();
    } else if (request.method === 'POST' && uploadAction && uploadServices) {
      await uploadServices.action(uploadAction[2]!, uploadAction[1]!);
      response.writeHead(204).end();
    } else if (request.method === 'POST' && request.url === '/reindex') {
      await reindex();
      response.writeHead(204).end();
    } else if (
      request.method === 'POST' &&
      request.url === '/replace-form' &&
      replaceForm
    ) {
      await replaceForm();
      response.writeHead(204).end();
    } else if (request.method === 'POST' && request.url === '/drop-triage') {
      await query(
        "DELETE FROM project_roles WHERE project_id=? AND principal_id IN (SELECT principal_id FROM identities WHERE subject='triager')",
        [projectId],
      );
      response.writeHead(204).end();
    } else response.writeHead(404).end();
  } catch (error) {
    const details = error as { code?: string; constraint?: string };
    console.error(
      'Disposable workflow control failed:',
      details.code ?? 'unknown',
      details.constraint ?? 'unknown',
    );
    response.writeHead(500).end();
  }
});
const cleanupErrors: string[] = [];
try {
  if (profile === 'node') {
    await bootstrap.query(`CREATE DATABASE ${dbName}`);
    pool = new Pool({ database: dbName, max: 2 });
    for (const migration of await migrationStatements('postgres'))
      for (const statement of migration.statements) await pool.query(statement);
    query = async (sql, values = []) => {
      let parameter = 0;
      return (
        await pool!.query(
          sql.replace(/\?/g, () => '$' + ++parameter),
          values,
        )
      ).rows;
    };
    const keyFile = join(directory, 'abuse.json'),
      tokenFile = join(directory, 'keys.json');
    await writeFile(keyFile, abuseKeyFixture(), { mode: 0o600 });
    await writeFile(tokenFile, await keys.source.read(), { mode: 0o600 });
    configured = configureNodeAbuseAdmission(
      { ...postgresNodeBindings(dbName), keyFile, keyProviderFile: tokenFile },
      'local',
    );
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected Node API port');
    const port = address.port;
    await new Promise<void>((done) => reservation.close(() => done()));
    apiOrigin = `http://localhost:${port}`;
    const runtime = {
      ...loadConfig({ HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: origin }, 'node'),
      allowedOrigins: [origin, apiOrigin],
    };
    if (uploadLane)
      uploadServices = await browserUploadServices(
        directory,
        origin,
        configured.uploadIntentStore!,
        query,
      );
    const appOptions: Parameters<typeof createApp>[0] = {
      adapter: node(),
      config: runtime,
      telemetry: { request() {} },
      ready: async () => true,
      abuse: configured.abuse,
      keyProvider: keys.provider,
      registrationStore: configured.registrationStore,
      passwordStore: configured.passwordStore,
      sessionStore: configured.sessionStore,
      standardPassword: createNodeStandardPasswordService(
        runtime.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      passkey: {
        rpID: 'localhost',
        rpName: 'Local workflow passkey',
        origin: apiOrigin,
        store: configured.passkeyStores!,
        passwordStore: configured.passwordStore!,
        sessionStore: configured.sessionStore!,
        keyProvider: keys.provider,
      },
      bootstrapCode: enrollmentCode,
      staffEnrollmentStore: configured.staffEnrollmentStore,
      oauthClients: clients,
      oauthCodeStore: configured.oauthCodeStore,
      projectRoleStore: configured.projectRoleStore,
      projectStore: configured.projectStore,
      taxonomyStore: configured.taxonomyStore,
      issueRepository: configured.issueRepository,
      contentDefinitionStore: configured.contentDefinitionStore,
      searchStore: configured.searchStore,
      searchIndexStore: configured.searchIndexStore,
      commentStore: configured.commentStore,
      reactionStore: configured.reactionStore,
      timelineStore: configured.timelineStore,
      accountAdministration: configured.accountAdministration,
      auditAppend: configured.auditAppend,
      auditRepository: configured.auditRepository,
      pluginRegistry: configured.pluginRegistryStore,
      pluginSettings: configured.pluginSettingsStore,
      uploads: uploadServices?.uploads ?? null,
    };
    listener = await listenNode(createApp(appOptions), port);
    if (uploadServices) {
      const mediaReservation = createServer();
      mediaReservation.listen(0, '127.0.0.1');
      await once(mediaReservation, 'listening');
      const mediaAddress = mediaReservation.address();
      if (!mediaAddress || typeof mediaAddress === 'string')
        throw new Error('Expected media port');
      const mediaPort = mediaAddress.port;
      await new Promise<void>((done) => mediaReservation.close(() => done()));
      mediaOrigin = `https://media.hyperbug.test:${mediaPort}`;
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
          '/CN=media.hyperbug.test',
          '-addext',
          'subjectAltName=DNS:media.hyperbug.test',
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
      const mediaTls = (await loadNodeTls(tlsFile))!;
      mediaSpki = createHash('sha256')
        .update(
          new X509Certificate(await readFile(certFile)).publicKey.export({
            type: 'spki',
            format: 'der',
          }),
        )
        .digest('base64');
      mediaListener = await listenNode(
        createApp({
          ...appOptions,
          attachmentStore: configured.attachmentStore,
          mediaOrigin,
        }),
        mediaPort,
        '127.0.0.1',
        mediaTls,
      );
    }
    index = configured.searchIndexStore!;
  } else {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    if (!address || typeof address === 'string')
      throw new Error('Expected port');
    const port = address.port;
    await new Promise<void>((done) => reservation.close(() => done()));
    apiOrigin = `http://localhost:${port}`;
    if (uploadLane) {
      workerUploadSetup = await prepareWorkerBrowserUploads(
        directory,
        apiOrigin,
      );
      mediaOrigin = workerUploadSetup.mediaOrigin;
      mediaSpki = workerUploadSetup.mediaSpki;
    }
    mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: workerModules('dist/account-worker', [
          'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm',
        ]),
        port,
        host: '127.0.0.1',
        compatibilityDate: '2026-09-16',
        compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
        d1Databases: ['DB'],
        ...(workerUploadSetup
          ? {
              r2Buckets: workerUploadSetup.r2Buckets,
              serviceBindings: workerUploadSetup.serviceBindings,
            }
          : {}),
        ratelimits: {
          ABUSE_VOLUMETRIC: {
            namespace_id: '120018',
            simple: { limit: 1000, period: 60 },
          },
        },
        bindings: {
          HYPERBUG_ENV: 'local',
          ...(workerUploadSetup?.bindings ?? {}),
          ALLOWED_ORIGINS: `${origin},${apiOrigin}`,
          HYPERBUG_ABUSE_KEY_RING: abuseKeyFixture(),
          HYPERBUG_KEY_RING: await keys.source.read(),
          HYPERBUG_TEST_PASSKEY_RP_ID: 'localhost',
          HYPERBUG_TEST_PASSKEY_RP_NAME: 'Local workflow passkey',
          HYPERBUG_TEST_PASSKEY_ORIGIN: apiOrigin,
          HYPERBUG_TEST_BOOTSTRAP_CODE: enrollmentCode,
          HYPERBUG_TEST_OAUTH_CLIENTS: JSON.stringify(clients),
          ...(profile === 'minimum'
            ? {
                HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-minimum',
                HYPERBUG_DEGRADATION_ACK: 'minimum-v2',
              }
            : {}),
        },
      }),
    );
    await mf.ready;
    if (workerUploadSetup) uploadServices = workerUploadSetup.attach(mf);
    const db = await mf.getD1Database('DB');
    for (const migration of await migrationStatements('d1'))
      await db.batch(
        migration.statements.map((statement) => db.prepare(statement)),
      );
    query = async (sql, values = []) =>
      (
        await db
          .prepare(sql)
          .bind(...values)
          .all<Record<string, unknown>>()
      ).results;
    index = createD1SearchIndexStore(db as unknown as D1Database);
  }
  for (const purpose of [
    'token-hmac',
    'password-pepper',
    'blind-index',
    'envelope-kek',
  ])
    await query(
      "INSERT INTO key_versions (purpose,key_id,version,state,created_at) VALUES (?,?,1,'current',?)",
      [purpose, `${purpose}-test`, Date.now()],
    );
  config = {
    schemaVersion: 1,
    applicationName: `HyperBug ${profile} workflow test`,
    apiBaseUrl: apiOrigin,
    authBaseUrl: apiOrigin,
    mediaOrigins: mediaOrigin ? [mediaOrigin] : [],
    ...(uploadServices
      ? { uploadOrigins: [uploadServices.storageOrigin] }
      : {}),
  };
  async function call(
    path: string,
    body?: unknown,
    token?: string,
    method = body === undefined ? 'GET' : 'POST',
  ) {
    return fetch(apiOrigin + path, {
      method,
      headers: {
        origin: apiOrigin,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }
  async function tokenFor(handle: string) {
    const login = await call('/auth/login', {
      handle,
      password: 'local-browser-password-1',
    });
    if (login.status !== 200)
      throw new Error(`Local login failed (${profile},${login.status})`);
    const cookie = login.headers.getSetCookie()[0]!.split(';')[0]!;
    const verifier = Buffer.from(
      crypto.getRandomValues(new Uint8Array(32)),
    ).toString('base64url');
    const challenge = Buffer.from(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
    ).toString('base64url');
    const response = await fetch(apiOrigin + '/auth/authorize', {
      method: 'POST',
      headers: {
        origin: apiOrigin,
        cookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        responseType: 'code',
        clientId: 'workflow-seed',
        redirectUri: clients[0]!.redirectUris[0],
        scope: 'public-api',
        state: 'local-workflow',
        codeChallenge: challenge,
        codeChallengeMethod: 'S256',
      }),
    });
    if (response.status !== 200)
      throw new Error(`Local authorization failed (${response.status})`);
    const code = new URL(
      ((await response.json()) as { redirectUri: string }).redirectUri,
    ).searchParams.get('code')!;
    const exchange = await fetch(apiOrigin + '/auth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'workflow-seed',
        redirect_uri: clients[0]!.redirectUris[0]!,
        code,
        code_verifier: verifier,
      }),
    });
    if (exchange.status !== 200)
      throw new Error(`Local token failed (${exchange.status})`);
    return ((await exchange.json()) as { accessToken: string }).accessToken;
  }
  const enrolled = await call('/auth/bootstrap/enroll', {
    enrollmentCode,
    handle: 'rootadmin',
    password: 'local-browser-password-1',
  });
  if (enrolled.status !== 201)
    throw new Error(`Local enrollment failed (${enrolled.status})`);
  const admin = await tokenFor('rootadmin');
  const project = await call(
    '/api/v1/projects',
    { slug: 'product-workflows', name: 'Product workflows' },
    admin,
  );
  if (project.status !== 201)
    throw new Error(`Local project failed (${project.status})`);
  projectId = ((await project.json()) as { id: string }).id;
  for (const handle of ['feedbackuser', 'triager', 'maintainer']) {
    const result = await call('/api/v1/accounts/register', {
      handle,
      password: 'local-browser-password-1',
    });
    if (result.status !== 202)
      throw new Error(`Local registration failed (${result.status})`);
    if (handle !== 'feedbackuser') {
      await query(
        "UPDATE principals SET kind='staff' WHERE id IN (SELECT principal_id FROM identities WHERE subject=?)",
        [handle],
      );
      const accountToken = await tokenFor(handle);
      const account = (await (
        await call('/api/v1/account', undefined, accountToken)
      ).json()) as { principalId: string };
      // Fixture-only initial grants, matching existing role-contract setup.
      // Password assurance 1 is never used to claim a sensitive API grant.
      await query(
        "INSERT INTO project_roles (project_id,principal_id,principal_kind,role,granted_at) VALUES (?,?,'staff',?,?)",
        [
          projectId,
          account.principalId,
          handle === 'triager' ? 'triage' : 'maintainer',
          Date.now(),
        ],
      );
    }
  }
  const author = await tokenFor('feedbackuser');
  const account = (await (
    await call('/api/v1/account', undefined, author)
  ).json()) as { principalId: string };
  const issue = (await (
    await call(
      `/api/v1/projects/${projectId}/issues`,
      {
        title: 'A discussion with history',
        body: '# Feedback\n\n**Safe content** from the real API.\n\n<script>window.userContentExecuted=true</script>\n\n![External](https://example.com/image.png)',
      },
      author,
    )
  ).json()) as { id: string; number: number };
  if (!issue.id) throw new Error('Local issue creation failed');
  for (let n = 0; n < 1000; n++)
    await query(
      'INSERT INTO comments (id,project_id,issue_id,author_id,body,body_text,body_text_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [
        crypto.randomUUID(),
        projectId,
        issue.id,
        account.principalId,
        `Discussion entry ${n}`,
        `Discussion entry ${n}`,
        'hyperbug-text-1',
        Date.now() - 2000 + n,
        Date.now() - 2000 + n,
      ],
    );
  await call(`/api/v1/projects/${projectId}/labels`, { name: 'Bug' }, admin);
  await call(
    `/api/v1/projects/${projectId}/issue-types`,
    { name: 'Defect' },
    admin,
  );
  await call(
    `/api/v1/projects/${projectId}/milestones`,
    { title: 'First release' },
    admin,
  );
  await call(
    `/api/v1/projects/${projectId}/templates`,
    {
      name: 'Short report',
      body: '## What happened\n\nDescribe the problem.',
      enabled: true,
    },
    admin,
  );
  const yaml =
    'name: Detailed report\ndescription: All supported fields\ntitle: A detailed report\nbody:\n- type: markdown\n  attributes:\n    value: "Please describe the problem."\n- type: input\n  id: summary\n  attributes:\n    label: Summary\n  validations:\n    required: true\n- type: textarea\n  id: detail\n  attributes:\n    label: Details\n  validations:\n    required: true\n- type: dropdown\n  id: version\n  attributes:\n    label: Version\n    options: [one, two]\n- type: dropdown\n  id: platforms\n  attributes:\n    label: Platforms\n    multiple: true\n    options: [desktop, mobile]\n- type: checkboxes\n  id: consent\n  attributes:\n    label: Checks\n    options:\n    - label: I checked existing reports\n      required: true\n- type: upload\n  id: file\n  attributes:\n    label: Screenshot\n';
  const form = await call(
    `/api/v1/projects/${projectId}/forms`,
    { format: 'yaml', source: yaml, enabled: true },
    admin,
  );
  if (form.status !== 201)
    throw new Error(`Local form failed (${form.status})`);
  const formDefinition = (await form.json()) as {
    id: string;
    revision: number;
  };
  replaceForm = async () => {
    const result = await call(
      `/api/v1/projects/${projectId}/forms/${formDefinition.id}`,
      {
        expectedRevision: formDefinition.revision,
        format: 'yaml',
        source: yaml.replace(
          'name: Detailed report',
          'name: Detailed report v2',
        ),
        enabled: true,
      },
      admin,
      'PUT',
    );
    if (result.status !== 200)
      throw new Error(`Concurrent form replacement failed (${result.status})`);
  };
  const corpus = (await (
    await call(
      `/api/v1/projects/${projectId}/issues`,
      { title: 'Transported Markdown corpus', body: markdownCorpus[0] },
      author,
    )
  ).json()) as { id: string; number: number };
  if (!corpus.id) throw new Error('Corpus issue failed');
  for (const body of markdownCorpus.slice(1)) {
    const result = await call(
      `/api/v1/projects/${projectId}/issues/${corpus.id}/comments`,
      { body },
      author,
    );
    if (result.status !== 201)
      throw new Error(`Corpus comment failed (${result.status})`);
  }
  for (const body of rejectedMarkdown) {
    const result = await call(
      `/api/v1/projects/${projectId}/issues`,
      { title: 'Rejected corpus', body },
      author,
    );
    if (![400, 422].includes(result.status))
      throw new Error(`Rejected corpus accepted (${result.status})`);
  }
  for (let n = 0; n < 25; n++) {
    const response = await call(
      `/api/v1/projects/${projectId}/issues`,
      { title: `Search page fixture ${n}`, body: 'Paging fixture' },
      author,
    );
    if (response.status !== 201) throw new Error('Local paging fixture failed');
  }
  await reindex();
  const principals = await query(
    "SELECT subject,principal_id FROM identities WHERE subject IN ('triager','maintainer')",
  );
  const principalIds = Object.fromEntries(
    principals.map((row) => [String(row.subject), String(row.principal_id)]),
  );
  control.listen(0, '127.0.0.1');
  await once(control, 'listening');
  const controlAddress = control.address();
  if (!controlAddress || typeof controlAddress === 'string')
    throw new Error('Expected control port');
  const optionsPath = join(directory, 'options.json');
  await writeFile(
    optionsPath,
    JSON.stringify({
      origin,
      apiOrigin,
      mediaOrigin,
      mediaSpki,
      uploadLane,
      storageOrigin: uploadServices?.storageOrigin,
      scanner: uploadServices?.evidence,
      projectId,
      principalIds,
      issue,
      corpus,
      corpusAccepted: markdownCorpus.length,
      corpusRejected: rejectedMarkdown.length,
      profile,
      directory,
      controlOrigin: `http://127.0.0.1:${controlAddress.port}`,
    }),
    { mode: 0o600 },
  );
  console.log(`Local ${profile} workflow fixture ready: ${origin}`);
  const child = spawn(
    process.execPath,
    [
      performanceLane
        ? 'tests/fixtures/web-product-performance.mjs'
        : manualLane
          ? 'tests/fixtures/web-product-manual.mjs'
          : uploadLane
            ? 'tests/fixtures/web-upload-browser.mjs'
            : 'tests/fixtures/web-product-browser.mjs',
      optionsPath,
    ],
    { stdio: 'inherit' },
  );
  browserChild = child;
  const code = await new Promise<number>((done, fail) => {
    child.once('error', fail);
    child.once('exit', (value) => done(value ?? 1));
  });
  if (code !== 0) throw new Error(`Browser workflow failed (${profile})`);
} finally {
  const cleanup = async (work: () => Promise<unknown> | undefined) => {
    try {
      await work();
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : 'unknown';
      if (code !== 'ERR_SERVER_NOT_RUNNING') cleanupErrors.push(code);
    }
  };
  await cleanup(
    () =>
      new Promise<void>((done) =>
        control.listening ? control.close(() => done()) : done(),
      ),
  );
  await cleanup(
    () =>
      new Promise<void>((done) =>
        staticServer.listening ? staticServer.close(() => done()) : done(),
      ),
  );
  await cleanup(() => listener?.close());
  await cleanup(() => mediaListener?.close());
  await cleanup(() => configured?.close());
  await cleanup(() => uploadServices?.close());
  await cleanup(() => workerUploadSetup?.close());
  await cleanup(() => mf?.dispose());
  await cleanup(() => pool?.end());
  if (profile === 'node')
    await cleanup(() =>
      bootstrap.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`),
    );
  await cleanup(() => bootstrap.end());
  await cleanup(() => rm(directory, { recursive: true, force: true }));
  console.log(
    `Owned ${profile} local workflow services and private fixture files removed.`,
  );
}

if (cleanupErrors.length)
  throw new Error(
    `Owned workflow cleanup reported ${cleanupErrors.length} failures (${cleanupErrors.join(',')})`,
  );
