import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rm } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { once } from 'node:events';
import { extname, resolve, sep, join } from 'node:path';
import { Pool } from 'pg';
import { node } from '@elysia/node';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { jsonTelemetry } from '@hyperbug/observability';
import { initialStandardPasswordPolicy } from '../../packages/security/src/standard-password.ts';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { createNodeStandardPasswordService } from '../../apps/api-node/src/standard-password.ts';
import { listenNode } from '../../apps/api-node/src/listen.ts';
import { abuseKeyFixture } from './abuse-key-fixture.ts';
import { cryptoFixture } from './crypto-scenarios.ts';
import { migrationStatements } from './migrations.ts';
import { postgresNodeBindings } from './postgres-node-bindings.ts';
import { createAcceptanceBrowserFixture } from './acceptance-browser.ts';
import { deploymentPolicy } from '../../apps/web/scripts/prepare-deployment.ts';

// Explicit local executable, not a skipped opt-in test in a green CI lane.
if (process.env.HYPERBUG_TEST_POSTGRES !== '1')
  throw new Error('Use the private PostgreSQL test cluster wrapper');
const databaseName = 'hyperbug_web_module11_test';
const root = resolve('apps/web/dist');
const bootstrap = new Pool({ max: 1 });
let pool: Pool | undefined;
let configured: ReturnType<typeof configureNodeAbuseAdmission> | undefined;
let browser:
  | Awaited<ReturnType<typeof createAcceptanceBrowserFixture>>
  | undefined;
let api: Awaited<ReturnType<typeof listenNode>> | undefined;
let tlsApi: Awaited<ReturnType<typeof listenNode>> | undefined;
let localOrigin = '';
let trusted = false;
let staticServer: ReturnType<typeof createServer> | undefined;
const enrollmentCode =
  'hbbs1_' +
  Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
const sessionKeys = cryptoFixture();

async function staticHandler(
  request: IncomingMessage,
  response: ServerResponse,
) {
  const local =
    request.headers.host === new URL(localOrigin || 'http://127.0.0.1').host;
  const config = {
    schemaVersion: 1 as const,
    applicationName: 'HyperBug local acceptance',
    apiBaseUrl: local ? api!.url : browser!.authOrigin,
    authBaseUrl: local ? api!.url : browser!.authOrigin,
    mediaOrigins: [],
  };
  const policy = deploymentPolicy(config);
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  let file = resolve(root, '.' + decodeURIComponent(path));
  if (
    (file !== root && !file.startsWith(root + sep)) ||
    path.startsWith('/.') ||
    ['/hosting.json', '/_headers', '/_redirects'].includes(path) ||
    path.startsWith('/api/')
  ) {
    response.writeHead(404).end();
    return;
  }
  let body: Buffer;
  if (path === '/config.json') body = Buffer.from(JSON.stringify(config));
  else {
    try {
      body = await readFile(file);
    } catch {
      if (extname(path)) {
        response.writeHead(404).end();
        return;
      }
      file = join(root, 'index.html');
      body = await readFile(file);
    }
  }
  response.writeHead(200, {
    ...policy.headers,
    'cache-control':
      path === '/config.json'
        ? 'no-store'
        : path.startsWith('/assets/')
          ? policy.cache.assets
          : 'no-cache',
    'content-type':
      path === '/config.json'
        ? 'application/json'
        : ({
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.html': 'text/html',
          }[extname(file)] ?? 'application/octet-stream'),
  });
  response.end(body);
}

try {
  await readFile(join(root, 'index.html'));
  await bootstrap.query(`CREATE DATABASE ${databaseName}`);
  pool = new Pool({
    ...postgresNodeBindings(databaseName),
    host: process.env.PGHOST,
    user: process.env.PGUSER,
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
  browser = await createAcceptanceBrowserFixture(staticHandler);
  staticServer = createServer((request, response) => {
    void staticHandler(request, response).catch(() =>
      response.writeHead(500).end(),
    );
  });
  staticServer.listen(0, '127.0.0.1');
  await once(staticServer, 'listening');
  const address = staticServer.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected static listener');
  localOrigin = `http://127.0.0.1:${address.port}`;
  const keyFile = join(browser.directory, 'abuse.json'),
    tokenKeyFile = join(browser.directory, 'token.json');
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
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: browser.origin },
      'node',
    ),
    allowedOrigins: [browser.origin, browser.authOrigin, localOrigin],
  };
  const makeApp = () =>
    createApp({
      adapter: node(),
      config,
      telemetry: jsonTelemetry(() => {}),
      ready: (signal) => configured!.ready(signal) as Promise<boolean>,
      abuse: configured!.abuse,
      registrationStore: configured!.registrationStore,
      passwordStore: configured!.passwordStore,
      sessionStore: configured!.sessionStore,
      keyProvider: sessionKeys.provider,
      standardPassword: createNodeStandardPasswordService(
        config.deployment,
        initialStandardPasswordPolicy,
        1,
        initialStandardPasswordPolicy.maximum.memoryKiB,
      ),
      oauthClients: [
        {
          clientId: 'hyperbug-web',
          redirectUris: [browser!.redirectUri],
          scopes: ['public-api'],
        },
      ],
      oauthCodeStore: configured!.oauthCodeStore,
      projectRoleStore: configured!.projectRoleStore,
      accountAdministration: configured!.accountAdministration,
      auditAppend: configured!.auditAppend,
      bootstrapCode: enrollmentCode,
      staffEnrollmentStore: configured!.staffEnrollmentStore,
    });
  api = await listenNode(makeApp(), 0);
  config.allowedOrigins.push(api.url);
  tlsApi = await listenNode(
    makeApp(),
    browser.apiPort,
    '127.0.0.1',
    browser.tls,
  );
  const enrolled = await fetch(api.url + '/auth/bootstrap/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: api.url },
    body: JSON.stringify({
      enrollmentCode,
      handle: 'rootadmin',
      password: 'operator-password-1',
    }),
  });
  if (enrolled.status !== 201)
    throw new Error(`Local enrollment failed (${enrolled.status})`);
  // Trust this generated test certificate, rather than disabling TLS validation.
  execFileSync(
    'security',
    [
      'add-trusted-cert',
      '-r',
      'trustRoot',
      '-p',
      'ssl',
      '-k',
      join(process.env.HOME!, 'Library/Keychains/login.keychain-db'),
      browser.certificatePath,
    ],
    { stdio: 'pipe' },
  );
  trusted = true;
  const options = join(browser.directory, 'web-options.json');
  await writeFile(
    options,
    JSON.stringify({
      origin: browser.origin,
      authOrigin: browser.authOrigin,
      canaryOrigin: browser.origin.replace(
        'client.hyperbug-browser',
        'probe.hyperbug-cookie',
      ),
      directory: browser.directory,
      localOrigin,
      receipt: resolve('docs/plan/evidence/11-browser-auth.json'),
    }),
    { mode: 0o600 },
  );
  const result = await promisify(execFile)(
    process.execPath,
    ['tests/fixtures/web-browser.mjs', options],
    { timeout: 60000 },
  );
  process.stdout.write(result.stdout);
  console.log(
    JSON.stringify({
      localOrigin,
      options,
      certificateTrusted: true,
      browserAuth: 'passed',
    }),
  );
  if (process.argv.includes('--hold')) {
    await writeFile(
      '/tmp/hyperbug-module11-local.json',
      JSON.stringify({ localOrigin, options }),
      { mode: 0o600 },
    );
    await new Promise<void>((done) => {
      process.once('SIGTERM', done);
      process.once('SIGINT', done);
    });
  }
} finally {
  if (trusted && browser)
    execFileSync('security', ['remove-trusted-cert', browser.certificatePath], {
      stdio: 'pipe',
    });
  await tlsApi?.close();
  await api?.close();
  if (staticServer)
    await new Promise<void>((done) => {
      staticServer!.close(() => done());
      staticServer!.closeAllConnections();
    });
  await configured?.close();
  await pool?.end();
  await bootstrap.query(`DROP DATABASE IF EXISTS ${databaseName}`);
  await bootstrap.end();
  await browser?.close();
  await rm('/tmp/hyperbug-module11-local.json', { force: true });
  console.log('Module 11 local resources and certificate trust cleaned.');
}
