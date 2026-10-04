import { afterAll, beforeAll, expect, it } from 'vitest';
import { readFile, readdir, chmod, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  configureNodeAttachmentScanner,
  createClamAVAttachmentScanner,
  type ClamAVScannerConfig,
} from '../../apps/api-node/src/attachment-scanner.ts';
import { validateScanOutcome } from '@hyperbug/application';
import { scannerArchiveLimits } from '../fixtures/scanner-archive-limits.ts';

let scanner: Awaited<ReturnType<typeof createClamAVAttachmentScanner>>;
let config: ClamAVScannerConfig;
beforeAll(async () => {
  const file = process.env.HYPERBUG_TEST_SCANNER_CONFIG_FILE;
  if (!file)
    throw new Error(
      'Actual scanner lane requires a private pinned official ClamAV configuration',
    );
  config = JSON.parse(await readFile(file, 'utf8')) as ClamAVScannerConfig;
  scanner = (await configureNodeAttachmentScanner(file))!;
});
afterAll(async () => {
  await scanner?.close();
});
const text = new TextEncoder().encode('HyperBug actual clean scanner.\n');
// Standard EICAR test bytes; this lane uses the complete official signed database, never a custom rule.
const eicar = new TextEncoder().encode(
  [
    'X5O!P%@AP[4',
    'PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  ].join('\\'),
);
function body(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
}
function scan(
  bytes: Uint8Array,
  options: Partial<Parameters<typeof scanner.scan>[0]> = {},
) {
  return scanner.scan({
    body: body(bytes),
    sizeBytes: bytes.byteLength,
    contentType: 'text/plain',
    signal: new AbortController().signal,
    ...options,
  });
}
it('loads private configuration and signed official database identity; absent mount stays unconfigured', async () => {
  expect(await configureNodeAttachmentScanner(undefined)).toBeNull();
  expect(scanner.evidence).toMatchObject({ engine: 'ClamAV' });
  expect(scanner.evidence.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  expect(scanner.evidence.signatureVersion).toMatch(
    /^daily:\d+,main:\d+,bytecode:\d+$/,
  );
  validateScanOutcome({ status: 'clean', evidence: scanner.evidence });
});
it('actual engine consumes the complete clean fixture and emits its verified identity', async () => {
  expect(await scan(text)).toEqual({
    status: 'clean',
    evidence: scanner.evidence,
  });
  expect(await readdir(config.temporaryDirectory)).toEqual([]);
});
it('actual official EICAR signature rejects the complete 68-byte standard fixture', async () => {
  expect(eicar.byteLength).toBe(68);
  expect(await scan(eicar)).toEqual({
    status: 'infected',
    evidence: scanner.evidence,
  });
  expect(await readdir(config.temporaryDirectory)).toEqual([]);
});
it('actual engine identifies an encrypted benign ZIP as unscannable, never clean', async () => {
  // Info-ZIP encrypted ZIP containing one benign text file, password fixture-password.
  const encrypted = Uint8Array.from(
    Buffer.from(
      'UEsDBAoACQAAAKEyRF2wsNcvNwAAACsAAAAJABwAY2xlYW4udHh0VVQJAAPNf8FqzX/BanV4CwABBPUBAAAEFAAAAHqQWq/aTdDdDB7rAhIP174OTTjfIkTqpqFQPO2JJZpSd9SZwJQLUTQ7W/5PglLd7vm8Fyr7GqZQSwcIsLDXLzcAAAArAAAAUEsBAh4DCgAJAAAAoTJEXbCw1y83AAAAKwAAAAkAGAAAAAAAAQAAAKSBAAAAAGNsZWFuLnR4dFVUBQADzX/BanV4CwABBPUBAAAEFAAAAFBLBQYAAAAAAQABAE8AAACKAAAAAAA=',
      'base64',
    ),
  );
  expect(await scan(encrypted, { contentType: 'application/zip' })).toEqual({
    status: 'failed',
    failure: 'partial',
  });
  expect(await readdir(config.temporaryDirectory)).toEqual([]);
});
it.each(scannerArchiveLimits.filter(([kind]) => kind !== 'supported-size'))(
  'actual engine holds benign archives exceeding %s limits',
  async (_, encoded) => {
    const archive = Uint8Array.from(Buffer.from(encoded, 'base64'));
    expect(await scan(archive, { contentType: 'application/gzip' })).toEqual({
      status: 'failed',
      failure: 'partial',
    });
  },
);
it('actually scans the 33-MiB nested fixture within the 128-MiB expanded budget', async () => {
  const encoded = scannerArchiveLimits.find(
    ([kind]) => kind === 'supported-size',
  )![1];
  expect(
    await scan(Uint8Array.from(Buffer.from(encoded, 'base64')), {
      contentType: 'application/gzip',
    }),
  ).toEqual({ status: 'clean', evidence: scanner.evidence });
});
it.each(['short', 'surplus', 'read-error'] as const)(
  'actual adapter holds %s input',
  async (kind) => {
    const result = await scan(text, {
      ...(kind === 'read-error'
        ? {
            body: new ReadableStream<Uint8Array>({
              start(c) {
                c.error(new Error('private-stream-error'));
              },
            }),
          }
        : {}),
      sizeBytes:
        kind === 'short'
          ? text.length + 1
          : kind === 'surplus'
            ? text.length - 1
            : text.length,
    });
    expect(result).toEqual({ status: 'failed', failure: 'partial' });
    expect(await readdir(config.temporaryDirectory)).toEqual([]);
  },
);
it('bounds streamed input and refuses concurrent admission during actual engine consumption', async () => {
  const controller = new AbortController();
  let pulled!: () => void;
  const ready = new Promise<void>((resolve) => {
    pulled = resolve;
  });
  let canceled = false;
  const run = scan(text, {
    signal: controller.signal,
    body: new ReadableStream<Uint8Array>(
      {
        pull() {
          pulled();
        },
        cancel() {
          canceled = true;
        },
      },
      { highWaterMark: 0 },
    ),
  });
  await ready;
  expect(await scan(text)).toEqual({
    status: 'failed',
    failure: 'unavailable',
  });
  controller.abort();
  expect(await run).toEqual({ status: 'failed', failure: 'timeout' });
  expect(canceled).toBe(true);
  await scanner.close();
  expect(await readdir(config.temporaryDirectory)).toEqual([]);
  expect(await scan(text)).toEqual({
    status: 'failed',
    failure: 'unavailable',
  });
  scanner = await createClamAVAttachmentScanner(config);
  expect(await scan(text, { sizeBytes: 32 * 1024 ** 2 + 1 })).toEqual({
    status: 'failed',
    failure: 'partial',
  });
});
it('rejects unpinned executable/configuration with a fixed redacted startup error', async () => {
  for (const value of [
    { ...config, executableSha256: '0'.repeat(64) },
    { ...config, maxSignatureAgeMs: 48 * 3600000 + 1 },
    { ...config, certificateDirectory: 'private-invalid-path' },
  ]) {
    await expect(createClamAVAttachmentScanner(value)).rejects.toThrow(
      'Invalid attachment scanner configuration',
    );
  }
  const invalid = join(config.temporaryDirectory, 'invalid-config.json');
  try {
    await writeFile(invalid, JSON.stringify(config), { mode: 0o600 });
    await chmod(invalid, 0o644);
    await expect(configureNodeAttachmentScanner(invalid)).rejects.toThrow(
      'Invalid attachment scanner configuration',
    );
  } finally {
    await rm(invalid, { force: true });
  }
});
it('refuses an official daily snapshot older than the explicitly selected freshness limit', async () => {
  await expect(
    createClamAVAttachmentScanner({ ...config, maxSignatureAgeMs: 1 }),
  ).rejects.toThrow('Invalid attachment scanner configuration');
});
it('independently rejects a tampered detached official signature', async () => {
  const name = (await readdir(config.databaseDirectory)).find(
    (n) => n.startsWith('bytecode-') && n.endsWith('.cvd.sign'),
  )!;
  const signature = join(config.databaseDirectory, name);
  const original = await readFile(signature);
  try {
    await chmod(signature, 0o600);
    await writeFile(signature, 'invalid-detached-signature');
    await chmod(signature, 0o400);
    await expect(createClamAVAttachmentScanner(config)).rejects.toThrow(
      'Invalid attachment scanner configuration',
    );
  } finally {
    await chmod(signature, 0o600);
    await writeFile(signature, original);
    await chmod(signature, 0o400);
  }
  await scanner.close();
  scanner = await createClamAVAttachmentScanner(config);
});
it('fences snapshot identity changes and requires a new instance for recovery', async () => {
  const database = join(config.databaseDirectory, 'bytecode.cvd');
  try {
    await chmod(database, 0o600);
    expect(await scan(text)).toEqual({
      status: 'failed',
      failure: 'unavailable',
    });
    await expect(createClamAVAttachmentScanner(config)).rejects.toThrow(
      'Invalid attachment scanner configuration',
    );
  } finally {
    await chmod(database, 0o400);
  }
  // Even a restored mode changes ctime; the old engine identity cannot be reused.
  expect(await scan(text)).toEqual({
    status: 'failed',
    failure: 'unavailable',
  });
  await scanner.close();
  scanner = await createClamAVAttachmentScanner(config);
  expect(await scan(text)).toEqual({
    status: 'clean',
    evidence: scanner.evidence,
  });
});
