/* eslint-disable no-await-in-loop -- Sequential disposable migration batches and actual engine lifecycle. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Pool } from 'pg';
import { createPostgresUploadIntentStore } from '@hyperbug/database-postgres';
import { createS3BlobStore, createNodeBlobDigest } from '@hyperbug/blob-s3';
import {
  defaultUploadMultipart,
  defaultUploadQuota,
  type AttachmentScanner,
  type ScanOutcome,
} from '@hyperbug/application';
import { configureNodeAttachmentScanner } from '../../apps/api-node/src/attachment-scanner.ts';
import { createNodeAttachmentScannerService } from '../../apps/api-node/src/attachment-scanner-service.ts';
import { startLocalS3 } from '../../tooling/local-s3.ts';
import { migrationStatements } from '../fixtures/migrations.ts';
import { workerModules } from '../fixtures/worker-modules.ts';
import { scannerServiceNodeRequest } from '../fixtures/scanner-service-bridge.ts';
import {
  proveScannerPipeline,
  type ScannerPipelineMode,
} from '../fixtures/scanner-pipeline-proof.ts';

let mf: Miniflare, pool: Pool;
let service: Awaited<ReturnType<typeof startLocalS3>>;
let s3: ReturnType<typeof createS3BlobStore>;
let handler: ReturnType<typeof createNodeAttachmentScannerService> | undefined;
let configuration: string;
beforeAll(async () => {
  if (
    !process.env.HYPERBUG_TEST_SCANNER_CONFIG_FILE ||
    process.env.HYPERBUG_TEST_POSTGRES !== '1'
  )
    throw new Error(
      'Actual pipeline lane requires private scanner configuration and the isolated PostgreSQL cluster runner',
    );
  configuration = process.env.HYPERBUG_TEST_SCANNER_CONFIG_FILE;
  execFileSync(process.execPath, ['tooling/build.ts', '--target=fixtures'], {
    stdio: 'pipe',
  });
  pool = new Pool({ max: 2 });
  for (const migration of await migrationStatements('postgres')) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      for (const sql of migration.statements) await db.query(sql);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
  service = await startLocalS3();
  s3 = createS3BlobStore({
    ...service,
    multipart: defaultUploadMultipart,
    allowLocalHttp: true,
  });
  const secret = randomBytes(32).toString('hex');
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: workerModules('dist/scanner-worker'),
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      d1Databases: ['DB'],
      r2Buckets: ['BLOB'],
      bindings: { SCANNER_SECRET: secret },
      serviceBindings: {
        SCANNER: (request) => {
          if (!handler)
            throw new Error('Actual scanner fixture is not initialized');
          return handler(scannerServiceNodeRequest(request));
        },
      },
    }),
  );
  await mf.ready;
  const db = await mf.getD1Database('DB');
  for (const migration of await migrationStatements('d1'))
    await db.batch(migration.statements.map((sql) => db.prepare(sql)));
  // Private fixture capability only; the production composition root has no selection.
  scannerSecret = secret;
}, 60000);
let scannerSecret: string;
afterAll(async () => {
  handler = undefined;
  await mf?.dispose();
  s3?.close();
  await service?.close();
  await pool?.end();
});
const clean = new TextEncoder().encode('HyperBug actual durable scan.\n');
const eicar = new TextEncoder().encode(
  [
    'X5O!P%@AP[4',
    'PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  ].join('\\'),
);
const modes: ScannerPipelineMode[] = [
  'clean',
  'infected',
  'identity',
  'partial',
  'timeout',
  'commit-denied',
  'release-denied',
  'project-commit-denied',
  'project-release-denied',
];
describe.each(['postgres', 'workerd-d1'] as const)(
  '%s actual ClamAV durable pipeline',
  (profile) => {
    it.each(modes)(
      'holds identity, authorization, quota and separate release for %s',
      async (mode) => {
        const scanner = (await configureNodeAttachmentScanner(configuration))!;
        let calls = 0,
          engineOutcome: ScanOutcome | undefined;
        let engineSignal: AbortSignal | undefined;
        const observed: AttachmentScanner = {
          async scan(input) {
            calls++;
            engineSignal = input.signal;
            engineOutcome = await scanner.scan(input);
            return engineOutcome;
          },
        };
        handler = createNodeAttachmentScannerService(
          observed,
          scannerSecret,
          mode === 'timeout' ? 100 : 60000,
        );
        const bytes = mode === 'infected' ? eicar : clean;
        try {
          const result =
            profile === 'postgres'
              ? await proveScannerPipeline(
                  {
                    intents: createPostgresUploadIntentStore(
                      pool,
                      defaultUploadQuota,
                    ),
                    blobs: s3.store,
                    createDigest: createNodeBlobDigest,
                    scanner: observed,
                  },
                  async (sql, values = []) => {
                    let index = 0;
                    return (
                      await pool.query(
                        sql.replace(/\?/g, () => `$${++index}`),
                        values,
                      )
                    ).rows;
                  },
                  mode,
                  bytes,
                  100,
                )
              : await (async () => {
                  const response = await mf.dispatchFetch(
                    `http://localhost/pipeline?mode=${mode}`,
                    { method: 'POST', body: bytes },
                  );
                  expect(response.status).toBe(200);
                  return (await response.json()) as Awaited<
                    ReturnType<typeof proveScannerPipeline>
                  >;
                })();
          expect(calls).toBe(1);
          if (
            [
              'clean',
              'infected',
              'commit-denied',
              'release-denied',
              'project-commit-denied',
              'project-release-denied',
            ].includes(mode)
          ) {
            expect(engineOutcome).toEqual({
              status: mode === 'infected' ? 'infected' : 'clean',
              evidence: scanner.evidence,
            });
          }
          if (
            mode === 'clean' ||
            mode === 'infected' ||
            mode.endsWith('release-denied')
          ) {
            expect(result.evidence).toEqual(scanner.evidence);
            expect(result.evidence?.engine).toBe('ClamAV');
            expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
            expect(result.sizeBytes).toBe(bytes.length);
          } else {
            expect(result.evidence).toBeNull();
          }
          if (mode === 'timeout') expect(engineSignal?.aborted).toBe(true);
          expect(result.usedBytes).toBe(bytes.length);
          expect(result.authorizationChecks).toBe(
            mode === 'clean' || mode.endsWith('release-denied') ? 3 : 2,
          );
        } finally {
          await scanner.close();
          handler = undefined;
        }
      },
    );
  },
);
