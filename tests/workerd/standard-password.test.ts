import { beforeAll, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { createNodeArgon2idProvider } from '../../apps/api-node/src/standard-password.ts';
import {
  hashStandardPassword,
  verifyStandardPassword,
} from '../../packages/security/src/standard-password.ts';
import { workerModules } from '../fixtures/worker-modules.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { expectedStandardPasswordRehashObservation } from '../fixtures/standard-password-rehash-contract.ts';

const wasmPath = 'apps/api-cloudflare/src/vendor/libsodium-sumo-0.8.4.wasm';
const expectedWasmSha256 =
  '29dd7daf12daec2afdf7b73101e50679bfe9c38861aa1f0de50ae505ccba99bd';
const vector = {
  hex: '0878ed8cc76d64e98c1d146d7913446f382c7f7ce49892b055ccaead269e9fbc',
  correct: true,
  incorrect: false,
  deniedParallelism: true,
};

beforeAll(() => {
  const wasm = readFileSync(wasmPath);
  expect(createHash('sha256').update(wasm).digest('hex')).toBe(
    expectedWasmSha256,
  );
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures']);
});

it('matches the public Argon2id vector through the static Wasm module in local workerd', async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/standard-password-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    }),
  );
  try {
    const response = await fetch(await mf.ready);
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual(vector);
  } finally {
    await mf.dispose();
  }
});

it('round-trips shared password records between Node and local workerd providers', async () => {
  const policy = {
    current: { memoryKiB: 19456, passes: 2, parallelism: 1 },
    maximum: { memoryKiB: 19456, passes: 2, parallelism: 1 },
  };
  const node = createNodeArgon2idProvider(1, 19456);
  const nodeRecord = await hashStandardPassword(node, 'test password', policy);
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/standard-password-worker', [wasmPath]),
      bindings: { NODE_RECORD: JSON.stringify(nodeRecord) },
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    }),
  );
  try {
    const response = await fetch(new URL('/exchange', await mf.ready));
    const body = await response.text();
    expect(response.status, body).toBe(200);
    const result = JSON.parse(body) as {
      nodeVerified: boolean;
      nodeReplacement: unknown;
      workerRecord: unknown;
    };
    expect(result.nodeVerified).toBe(true);
    expect(result.nodeReplacement).toBeNull();
    const fromWorker = await verifyStandardPassword(
      node,
      'test password',
      result.workerRecord,
      policy,
    );
    expect(fromWorker).toEqual({ verified: true, replacement: null });
  } finally {
    await mf.dispose();
  }
});

it('rejects Worker policies exceeding its single-lane and memory capabilities', async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/standard-password-worker', [wasmPath]),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    }),
  );
  try {
    const response = await fetch(new URL('/policy', await mf.ready));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deniedMemory: true,
      deniedParallelism: true,
      deniedMinimumTier: true,
    });
  } finally {
    await mf.dispose();
  }
});

it('runs the Wrangler dry-run JS and unchanged Wasm module in local workerd', async () => {
  mkdirSync('.local', { recursive: true });
  const outdir = mkdtempSync(join('.local', 'password-wrangler-test-'));
  try {
    execFileSync('node_modules/.bin/wrangler', [
      'deploy',
      'tests/fixtures/standard-password-worker.ts',
      '--config',
      'apps/api-cloudflare/wrangler.jsonc',
      '--env=',
      '--dry-run',
      '--outdir',
      outdir,
    ]);
    const wasmFiles = readdirSync(outdir).filter((name) =>
      name.endsWith('.wasm'),
    );
    expect(wasmFiles).toHaveLength(1);
    const emittedWasm = join(outdir, wasmFiles[0]!);
    expect(
      createHash('sha256').update(readFileSync(emittedWasm)).digest('hex'),
    ).toBe(expectedWasmSha256);
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: [
          {
            type: 'ESModule',
            path: join(outdir, 'standard-password-worker.js'),
          },
          { type: 'CompiledWasm', path: emittedWasm },
        ],
        compatibilityDate: '2026-09-16',
        compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      }),
    );
    try {
      const response = await fetch(await mf.ready);
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(JSON.parse(body)).toEqual(vector);
    } finally {
      await mf.dispose();
    }
  } finally {
    rmSync(outdir, { recursive: true, force: true });
  }
});

it('rehashes a superseded credential at login with the real Workers provider on D1', async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/standard-password-worker', [wasmPath]),
      d1Databases: ['REHASH_DB'],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
    }),
  );
  try {
    const db = await mf.getD1Database('REHASH_DB');
    for (const migration of await migrationStatements('d1'))
      await db.batch(migration.statements.map((sql) => db.prepare(sql)));
    const response = await fetch(new URL('/rehash', await mf.ready));
    const body = await response.text();
    expect(response.status, body).toBe(200);
    expect(JSON.parse(body)).toEqual(
      expectedStandardPasswordRehashObservation(),
    );
  } finally {
    await mf.dispose();
  }
}, 30000);
