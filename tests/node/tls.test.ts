import { beforeAll, afterAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  chmod,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpsRequest } from 'node:https';
import { node } from '@elysia/node';
import { createApp } from '@hyperbug/server';
import { loadConfig } from '@hyperbug/config';
import { loadNodeTls, type NodeTls } from '../../apps/api-node/src/tls.ts';
import { listenNode } from '../../apps/api-node/src/listen.ts';

let directory: string, file: string, pem: NodeTls;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'hyperbug-tls-'));
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
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-keyout',
      key,
      '-out',
      cert,
    ],
    { stdio: 'ignore' },
  );
  pem = {
    cert: await readFile(cert, 'utf8'),
    key: await readFile(key, 'utf8'),
  };
  file = join(directory, 'tls.json');
  await writeFile(file, JSON.stringify(pem), { mode: 0o600 });
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('keeps an absent TLS mount optional', async () => {
  expect(await loadNodeTls(undefined)).toBeUndefined();
});
it('serves verified HTTPS using the private PEM mount and ignores untrusted forwarding headers', async () => {
  const tls = (await loadNodeTls(file))!;
  const app = createApp({
    adapter: node(),
    telemetry: { request() {} },
    ready: async () => true,
    config: loadConfig(
      { HYPERBUG_ENV: 'local', ALLOWED_ORIGINS: 'http://localhost:5173' },
      'node',
    ),
  }).get('/tls-proof', ({ request }) => ({
    origin: new URL(request.url).origin,
  }));
  const listener = await listenNode(app, 0, '127.0.0.1', tls);
  const fetchProof = (trusted: boolean) =>
    new Promise<string>((resolve, reject) => {
      const req = httpsRequest(
        `${listener.url}/tls-proof`,
        {
          ...(trusted ? { ca: pem.cert } : {}),
          headers: {
            'x-forwarded-proto': 'http',
            'x-forwarded-host': 'evil.example',
          },
        },
        (response) => {
          let body = '';
          response.setEncoding('utf8');
          response.on('data', (chunk: string) => {
            body += chunk;
          });
          response.on('end', () => resolve(body));
          response.on('error', reject);
        },
      );
      req.on('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('TLS test timeout')));
      req.end();
    });
  try {
    expect(JSON.parse(await fetchProof(true))).toEqual({
      origin: listener.url,
    });
    await expect(fetchProof(false)).rejects.toMatchObject({
      code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    });
  } finally {
    await listener.close();
  }
});
it('refuses broad mount permissions and symlinks without revealing PEM data', async () => {
  const unsafe = join(directory, 'unsafe.json'),
    link = join(directory, 'link.json');
  await writeFile(unsafe, JSON.stringify(pem), { mode: 0o600 });
  await chmod(unsafe, 0o644);
  await symlink(file, link);
  await expect(loadNodeTls(unsafe)).rejects.toThrow(
    'Invalid Node TLS configuration',
  );
  await expect(loadNodeTls(link)).rejects.toThrow(
    'Invalid Node TLS configuration',
  );
});
it.each(['malformed', 'extra'] as const)(
  'refuses %s TLS configuration at startup',
  async (mode) => {
    const invalid = join(directory, `${mode}.json`);
    await writeFile(
      invalid,
      JSON.stringify(
        mode === 'extra'
          ? { ...pem, trustProxy: true }
          : {
              cert: pem.cert,
              key: ['-----BEGIN', 'PRIVATE KEY-----'].join(' ') + '\ninvalid',
            },
      ),
      { mode: 0o600 },
    );
    await expect(loadNodeTls(invalid)).rejects.toThrow(
      'Invalid Node TLS configuration',
    );
  },
);
