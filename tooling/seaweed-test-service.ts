import { randomBytes } from 'node:crypto';
import { mkdtemp, chmod, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

/** Explicit genuine local S3 test service. Never downloads a binary or uses an existing service. */
export async function startSeaweedTestService(binary: string) {
  const version = execFileSync(binary, ['version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!/version .* 4\.48 /.test(version))
    throw new Error('Storage evidence currently requires SeaweedFS 4.48.');
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-s3-'));
  await chmod(directory, 0o700);
  const credentials = {
    accessKeyId: randomBytes(16).toString('hex'),
    secretAccessKey: randomBytes(32).toString('hex'),
  };
  const bucket = 'hyperbug-test';
  const config = join(directory, 's3.json');
  await writeFile(
    config,
    JSON.stringify({
      identities: [
        {
          name: 'hyperbug-test',
          credentials: [
            {
              accessKey: credentials.accessKeyId,
              secretKey: credentials.secretAccessKey,
            },
          ],
          actions: [
            `Read:${bucket}`,
            `Write:${bucket}`,
            `List:${bucket}`,
            `Tagging:${bucket}`,
            `Admin:${bucket}`,
          ],
        },
      ],
    }),
    { mode: 0o600 },
  );
  const ports: number[] = [];
  const reservations = [];
  for (let i = 0; i < 10; i++) {
    const server = createServer();
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolveListen);
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('No local test port');
    ports.push(address.port);
    reservations.push(server);
  }
  await Promise.all(
    reservations.map(
      (server) =>
        new Promise<void>((resolveClose) => server.close(() => resolveClose())),
    ),
  );
  const names = [
    's3.port',
    'master.port',
    'volume.port',
    'filer.port',
    'admin.port',
    's3.port.grpc',
    'master.port.grpc',
    'volume.port.grpc',
    'filer.port.grpc',
    'admin.port.grpc',
  ];
  const child = spawn(
    binary,
    [
      'mini',
      `-dir=${directory}`,
      '-ip=127.0.0.1',
      '-ip.bind=127.0.0.1',
      `-s3.config=${config}`,
      `-bucket=${bucket}`,
      '-master.telemetry=false',
      '-admin.ui=false',
      '-webdav=false',
      '-s3.iam=false',
      '-s3.port.iceberg=0',
      '-s3.port.lance=0',
      '-volume.max=2',
      '-filer.localSocket=',
      '-s3.localSocket=',
      ...names.map((name, i) => `-${name}=${ports[i]}`),
    ],
    { stdio: 'ignore', env: { PATH: process.env.PATH } },
  );
  let spawnError: Error | undefined;
  child.once('error', (error) => {
    spawnError = error;
  });
  const endpoint = `http://127.0.0.1:${ports[0]}`;
  const client = new S3Client({
    endpoint,
    region: 'us-east-1',
    credentials,
    forcePathStyle: true,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    maxAttempts: 1,
  });
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    client.destroy();
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise<void>((resolveExit) =>
        child.once('exit', () => resolveExit()),
      );
      child.kill('SIGTERM');
      const timeout = globalThis.setTimeout(() => child.kill('SIGKILL'), 5000);
      await stopped;
      clearTimeout(timeout);
    }
    await rm(directory, { recursive: true, force: true });
  }
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (spawnError || child.exitCode !== null)
        throw new Error(
          'Isolated SeaweedFS startup failed; no credentials or service logs exposed.',
        );
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }), {
          abortSignal: AbortSignal.timeout(500),
        });
      } catch {}
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }), {
          abortSignal: AbortSignal.timeout(500),
        });
        client.destroy();
        return {
          version,
          endpoint,
          bucket,
          region: 'us-east-1',
          credentials,
          forcePathStyle: true,
          allowLocalHttp: true,
          close,
        };
      } catch {}
      await delay(100);
    }
    throw new Error('Isolated SeaweedFS startup timed out.');
  } catch (error) {
    await close();
    throw error;
  }
}
