import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Opt-in protocol fixture only: independent static callback, no API proxy. */
export async function createAcceptanceBrowserFixture(
  staticHandler?: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>,
) {
  const directory = await mkdtemp(
    join(tmpdir(), 'hyperbug-acceptance-browser-'),
  );
  const cert = join(directory, 'cert.pem'),
    key = join(directory, 'key.pem');
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
      '/CN=hyperbug-auth.test',
      '-addext',
      'subjectAltName=DNS:*.hyperbug-auth.test,DNS:*.hyperbug-browser.test,DNS:*.hyperbug-cookie.test',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  );
  const tls = {
    cert: await readFile(cert, 'utf8'),
    key: await readFile(key, 'utf8'),
  };
  let origin = '',
    callbacks = 0;
  const server = createServer(tls, (request, response) => {
    response.setHeader('cache-control', 'no-store');
    response.setHeader(
      'content-security-policy',
      "default-src 'none'; connect-src https:; base-uri 'none'; frame-ancestors 'none'",
    );
    response.setHeader('x-content-type-options', 'nosniff');
    if (request.url === '/probe/set') {
      response.setHeader(
        'set-cookie',
        'cookie_canary=present; Secure; SameSite=None; Path=/',
      );
    } else if (request.url === '/probe/echo') {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('access-control-allow-credentials', 'true');
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          cookiePresent:
            request.headers.cookie?.includes('cookie_canary=present') ?? false,
        }),
      );
      return;
    } else if (request.url === '/probe/control') {
      // Isolated cookie-canary document; the application keeps its exact CSP.
    } else if (staticHandler) {
      void staticHandler(request, response).catch(() =>
        response.writeHead(500).end(),
      );
      return;
    } else if (request.url?.startsWith('/oauth/callback?')) {
      callbacks++;
    } else if (request.url !== '/') {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(
      '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Auth protocol fixture</title><main><h1>Auth protocol fixture</h1><p>Independent static callback for backend acceptance.</p></main></html>',
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected browser fixture listener');
  origin = `https://client.hyperbug-browser.test:${address.port}`;
  // Reserve an ephemeral API port before configuring its exact auth origin.
  const reservation = createServer(tls);
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const reserved = reservation.address();
  if (!reserved || typeof reserved === 'string')
    throw new Error('Expected API port');
  const apiPort = reserved.port;
  await new Promise<void>((resolve) => reservation.close(() => resolve()));
  const authOrigin = `https://auth.hyperbug-auth.test:${apiPort}`;
  return {
    directory,
    certificatePath: cert,
    tls,
    apiPort,
    origin,
    authOrigin,
    redirectUri: `${origin}/oauth/callback`,
    async run(profile: string) {
      const options = join(directory, 'options.json');
      const receipt = join(directory, 'receipt.json');
      await writeFile(
        options,
        JSON.stringify({
          profile,
          directory,
          origin,
          authOrigin,
          canaryOrigin: `https://probe.hyperbug-cookie.test:${address.port}`,
          receipt,
        }),
        { mode: 0o600 },
      );
      await promisify(execFile)(
        process.execPath,
        ['tests/fixtures/acceptance-browser.mjs', options],
        { timeout: 60000 },
      );
      const result = JSON.parse(await readFile(receipt, 'utf8'));
      if (callbacks !== 2)
        throw new Error('Expected login and consent callback');
      return { ...result, callbacks, frontendProxy: false };
    },
    async close() {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
      await rm(directory, { recursive: true, force: true });
    },
  };
}
