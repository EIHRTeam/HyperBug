// Local loopback capability verification only; no deployment or custom PQ code.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  chmod,
  mkdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { connect, createServer } from 'node:tls';

const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'hyperbug-transport-'));
let privateKey;
try {
  await chmod(directory, 0o700);
  const { stdout: cliVersion } = await exec('openssl', ['version'], {
    timeout: 10000,
  });
  const keyPath = join(directory, 'key.pem');
  const certPath = join(directory, 'cert.pem');
  await exec(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-sha256',
      '-noenc',
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
      '-keyout',
      keyPath,
      '-out',
      certPath,
    ],
    { timeout: 10000 },
  );
  await chmod(keyPath, 0o600);
  privateKey = await readFile(keyPath);
  const certificate = await readFile(certPath);

  async function handshake(name, serverGroups, clientOptions = {}) {
    const sockets = new Set();
    const server = createServer({
      key: privateKey,
      cert: certificate,
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
      ecdhCurve: serverGroups,
    });
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    server.on('tlsClientError', () => {}); // Expected rejection cases have no payload logging.
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
      });
      const address = server.address();
      assert(address && typeof address === 'object');
      return await new Promise((resolve) => {
        const socket = connect({
          host: '127.0.0.1',
          port: address.port,
          servername: 'localhost',
          ca: certificate,
          rejectUnauthorized: true,
          minVersion: 'TLSv1.3',
          maxVersion: 'TLSv1.3',
          ecdhCurve: 'auto',
          ...clientOptions,
        });
        const timer = setTimeout(() => {
          socket.destroy();
          resolve({ name, connected: false, error: 'PROBE_TIMEOUT' });
        }, 4000);
        socket.once('secureConnect', () => {
          clearTimeout(timer);
          const peer = socket.getPeerX509Certificate();
          resolve({
            name,
            connected: true,
            authorized: socket.authorized,
            protocol: socket.getProtocol(),
            cipher: socket.getCipher().standardName,
            keyAgreement: socket.getEphemeralKeyInfo(),
            certificateKeyAlgorithm: peer?.publicKey.asymmetricKeyType,
            certificateSignatureAlgorithm: peer?.signatureAlgorithm ?? null,
          });
          socket.destroy();
        });
        socket.once('error', (error) => {
          clearTimeout(timer);
          resolve({ name, connected: false, error: error.code ?? 'TLS_ERROR' });
          socket.destroy();
        });
      });
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    }
  }

  const observations = [];
  observations.push(
    await handshake('forced-hybrid', 'X25519MLKEM768', {
      ecdhCurve: 'X25519MLKEM768',
    }),
  );
  observations.push(await handshake('platform-default-groups', 'auto'));
  observations.push(
    await handshake('classical-client-fallback', 'X25519MLKEM768:X25519', {
      ecdhCurve: 'X25519',
    }),
  );
  observations.push(
    await handshake('no-shared-group', 'X25519', {
      ecdhCurve: 'X25519MLKEM768',
    }),
  );
  observations.push(
    await handshake('wrong-hostname', 'X25519MLKEM768', {
      servername: 'wrong.invalid',
      ecdhCurve: 'X25519MLKEM768',
    }),
  );
  observations.push(
    await handshake('untrusted-certificate', 'X25519MLKEM768', {
      ca: [],
      ecdhCurve: 'X25519MLKEM768',
    }),
  );
  observations.push(
    await handshake('old-protocol-rejected', 'X25519', {
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
      ecdhCurve: 'X25519',
    }),
  );
  for (const observation of observations.slice(0, 3)) {
    assert.equal(observation.connected, true, observation.name);
    assert.equal(observation.authorized, true, observation.name);
    assert.equal(observation.protocol, 'TLSv1.3', observation.name);
    assert.equal(observation.certificateKeyAlgorithm, 'rsa', observation.name);
  }
  assert.equal(observations[0].keyAgreement.name, 'X25519MLKEM768');
  assert.equal(observations[2].keyAgreement.name, 'X25519');
  for (const observation of observations.slice(3)) {
    assert.equal(observation.connected, false, observation.name);
    assert.notEqual(observation.error, 'PROBE_TIMEOUT', observation.name);
  }
  assert.equal(observations[4].error, 'ERR_TLS_CERT_ALTNAME_INVALID');
  assert.equal(
    observations[3].error,
    'ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE',
  );
  assert.equal(observations[5].error, 'DEPTH_ZERO_SELF_SIGNED_CERT');
  assert.equal(observations[6].error, 'ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION');
  const report = {
    v: 1,
    kind: 'local TLS capability verification only; no deployed Cloudflare/origin acceptance',
    recordedAt: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    nodeOpenSSL: process.versions.openssl,
    certificateTool: cliVersion.trim(),
    policy: {
      v: 1,
      minimumProtocol: 'TLSv1.3',
      preferredGroup: 'X25519MLKEM768',
      classicalFallbackObserved: true,
      certificateAuthentication: 'classical-rsa',
      endToEndPqAuthentication: false,
    },
    observations,
  };
  await mkdir('.local/phase03-transport', { recursive: true });
  await writeFile(
    '.local/phase03-transport/node-tls-result.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  privateKey?.fill(0);
  await rm(directory, { recursive: true, force: true });
}
