import { createServer } from 'node:https';
import { once } from 'node:events';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { UploadDependencies } from '@hyperbug/application';
import { configureNodeAttachmentScanner } from '../../apps/api-node/src/attachment-scanner.ts';
import { createNodeAttachmentScannerService } from '../../apps/api-node/src/attachment-scanner-service.ts';
import { scannerServiceNodeRequest } from './scanner-service-bridge.ts';

/** Local native R2/D1 browser lane. Miniflare development CORS is not production bucket-policy evidence. */
export async function prepareWorkerBrowserUploads(
  directory: string,
  apiOrigin: string,
) {
  const file = process.env.HYPERBUG_TEST_SCANNER_CONFIG_FILE;
  if (!file)
    throw new Error(
      'Worker upload browser lane requires a private current scanner snapshot',
    );
  const scanner = await configureNodeAttachmentScanner(file);
  if (!scanner) throw new Error('Missing actual scanner');
  const secret = randomBytes(32).toString('hex');
  const bridge = createNodeAttachmentScannerService(scanner, secret);
  const credentials = {
    accessKeyId: randomBytes(16).toString('hex'),
    secretAccessKey: randomBytes(32).toString('hex'),
  };
  const bucket = 'hyperbug-browser';
  let mf: Miniflare | undefined;
  let mediaOrigin = '';
  let closed = false;
  const certFile = join(directory, 'media-cert.pem'),
    keyFile = join(directory, 'media-key.pem');
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
      keyFile,
      '-out',
      certFile,
    ],
    { stdio: 'ignore' },
  );
  const cert = await readFile(certFile),
    key = await readFile(keyFile);
  const mediaSpki = createHash('sha256')
    .update(
      new X509Certificate(cert).publicKey.export({
        type: 'spki',
        format: 'der',
      }),
    )
    .digest('base64');
  const server = createServer({ cert, key }, async (request, response) => {
    let reader;
    try {
      if (!mf || !['GET', 'HEAD', 'OPTIONS'].includes(request.method ?? '')) {
        response.writeHead(404).end();
        return;
      }
      const headers: Record<string, string> = {};
      for (const [name, value] of Object.entries(request.headers))
        if (value !== undefined)
          headers[name] = Array.isArray(value) ? value.join(',') : value;
      headers.host = new URL(mediaOrigin).host;
      const result = await mf.dispatchFetch(
        new URL(request.url ?? '/', mediaOrigin).href,
        { method: request.method!, headers },
      );
      response.writeHead(result.status, Object.fromEntries(result.headers));
      reader = result.body?.getReader();
      if (reader) {
        const source = reader;
        response.once('close', () => {
          void source.cancel().catch(() => {});
        });
        for (;;) {
          // oxlint-disable-next-line no-await-in-loop -- Stream native media under HTTP backpressure.
          const next = await reader.read();
          if (next.done) break;
          // oxlint-disable-next-line no-await-in-loop -- Do not buffer attachment bytes in the test bridge.
          if (!response.write(next.value)) await once(response, 'drain');
        }
      }
      response.end();
    } catch {
      if (!response.headersSent) response.writeHead(503);
      response.end();
    } finally {
      reader?.releaseLock();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Expected isolated media listener');
  mediaOrigin = `https://media.hyperbug.test:${address.port}`;
  async function close() {
    if (closed) return;
    closed = true;
    await scanner?.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
  const serviceBindings: NonNullable<
    Parameters<typeof convertV4MiniflareOptions>[0]['serviceBindings']
  > = {
    HYPERBUG_TEST_BROWSER_SCANNER: (
      request: Parameters<typeof scannerServiceNodeRequest>[0],
    ) => bridge(scannerServiceNodeRequest(request)),
  };
  return {
    mediaOrigin,
    mediaSpki,
    close,
    serviceBindings,
    r2Buckets: {
      HYPERBUG_UPLOAD_BLOB: { id: bucket, s3Credentials: credentials },
    },
    bindings: {
      HYPERBUG_UPLOAD_STORAGE: JSON.stringify({
        accountId: 'a'.repeat(32),
        bucket,
        credentials,
      }),
      HYPERBUG_TEST_BROWSER_UPLOAD_ENDPOINT: `http://127.0.0.1:${new URL(apiOrigin).port}/cdn-cgi/local/r2/s3`,
      HYPERBUG_TEST_BROWSER_MEDIA_ORIGIN: mediaOrigin,
      HYPERBUG_TEST_BROWSER_SCANNER_SECRET: secret,
    },
    attach(runtime: Miniflare) {
      mf = runtime;
      return {
        uploads: null as UploadDependencies | null,
        storageOrigin: `http://127.0.0.1:${new URL(apiOrigin).port}`,
        evidence: scanner.evidence,
        async action(id: string, operation: string) {
          const response = await runtime.dispatchFetch(
            apiOrigin + '/_proof/upload',
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                origin: apiOrigin,
              },
              body: JSON.stringify({ id, operation: `browser-${operation}` }),
            },
          );
          if (response.status !== 200)
            throw new Error(
              `Native upload fixture operation failed (${operation}, ${response.status})`,
            );
          await response.body?.cancel();
        },
        close,
      };
    },
  };
}
