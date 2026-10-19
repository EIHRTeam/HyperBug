import { browserUploadAction } from './web-upload-control.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { startSeaweedTestService } from '../../tooling/seaweed-test-service.ts';
import { configureNodeUploads } from '../../apps/api-node/src/uploads.ts';
import { configureNodeAttachmentScanner } from '../../apps/api-node/src/attachment-scanner.ts';
import {
  createUploadCorsRules,
  validateUploadCorsRules,
  type UploadIntentStore,
  type UploadDependencies,
} from '@hyperbug/application';

type Query = (
  sql: string,
  values?: (string | number)[],
) => Promise<Record<string, unknown>[]>;
/** Disposable protocol fixture. Storage is an isolated genuine SeaweedFS S3 service; scanning is actual pinned ClamAV. */
export async function browserUploadServices(
  directory: string,
  origin: string,
  intents: UploadIntentStore,
  query: Query,
) {
  const configFile = process.env.HYPERBUG_TEST_SCANNER_CONFIG_FILE;
  if (!configFile)
    throw new Error(
      'Upload browser lane requires a private current scanner snapshot',
    );
  const binary = process.env.HYPERBUG_TEST_SEAWEED;
  if (!binary)
    throw new Error(
      'Upload browser lane requires a pinned SeaweedFS 4.48 binary',
    );
  const storage = await startSeaweedTestService(binary);
  const s3 = new S3Client({
    ...storage,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    maxAttempts: 1,
  });
  s3.middlewareStack.remove('addExpectContinueMiddleware');
  let adapter: Awaited<ReturnType<typeof configureNodeUploads>> | undefined;
  let scanner:
    | Awaited<ReturnType<typeof configureNodeAttachmentScanner>>
    | undefined;
  try {
    const rules = createUploadCorsRules([origin], true);
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: storage.bucket,
        CORSConfiguration: { CORSRules: rules },
      }),
    );
    const installed = await s3.send(
      new GetBucketCorsCommand({ Bucket: storage.bucket }),
    );
    validateUploadCorsRules(installed.CORSRules, [origin], true);
    const file = join(directory, 'upload-storage.json');
    await writeFile(
      file,
      JSON.stringify({ ...storage, allowLocalHttp: true }),
      { mode: 0o600 },
    );
    adapter = await configureNodeUploads(intents, file, 'local');
    scanner = await configureNodeAttachmentScanner(configFile);
    if (!adapter.uploads || !scanner)
      throw new Error('Missing upload or scanner fixture');
    const deps: UploadDependencies = adapter.uploads;
    return {
      uploads: deps,
      storageOrigin: new URL(storage.endpoint).origin,
      evidence: scanner.evidence,
      action: (id: string, operation: string) =>
        browserUploadAction(deps, query, scanner ?? null, id, operation),
      async close() {
        await scanner?.close();
        adapter?.close();
        s3.destroy();
        await storage.close();
      },
    };
  } catch (error) {
    await scanner?.close();
    adapter?.close();
    s3.destroy();
    await storage.close();
    throw error;
  }
}
