import type { Fetcher, D1Database, R2Bucket } from '@cloudflare/workers-types';
import { configureWorkerAttachmentScanner } from '../../apps/api-cloudflare/src/attachment-scanner.ts';
import { createR2BlobStore, createR2BlobDigest } from '@hyperbug/blob-r2';
import { createD1UploadIntentStore } from '@hyperbug/database-d1';
import {
  defaultUploadQuota,
  defaultUploadMultipart,
} from '@hyperbug/application';
import {
  proveScannerPipeline,
  type ScannerPipelineMode,
} from './scanner-pipeline-proof.ts';

export default {
  async fetch(
    request: Request,
    env: {
      SCANNER: Fetcher;
      SCANNER_SECRET: string;
      DB: D1Database;
      BLOB: R2Bucket;
    },
  ) {
    // Dedicated loopback-only test bundle, never a product API or real scanner configuration.
    const url = new URL(request.url),
      scanner = configureWorkerAttachmentScanner(
        env.SCANNER,
        env.SCANNER_SECRET,
      )!;
    const mode = url.searchParams.get('mode');
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (url.pathname === '/scan')
      return Response.json(
        await scanner.scan({
          body: new ReadableStream({
            start(c) {
              c.enqueue(bytes);
              c.close();
            },
          }),
          sizeBytes: bytes.length,
          contentType: 'text/plain',
          signal: request.signal,
        }),
      );
    if (
      url.pathname === '/pipeline' &&
      mode &&
      [
        'clean',
        'infected',
        'identity',
        'timeout',
        'commit-denied',
        'release-denied',
        'project-commit-denied',
        'project-release-denied',
        'partial',
      ].includes(mode)
    ) {
      const query = async (sql: string, values: (string | number)[] = []) =>
        (
          await env.DB.prepare(sql)
            .bind(...values)
            .all<Record<string, unknown>>()
        ).results;
      return Response.json(
        await proveScannerPipeline(
          {
            intents: createD1UploadIntentStore(env.DB, defaultUploadQuota),
            blobs: createR2BlobStore(env.BLOB, defaultUploadMultipart),
            createDigest: createR2BlobDigest,
            scanner,
          },
          query,
          mode as ScannerPipelineMode,
          bytes,
          500,
        ),
      );
    }
    return new Response(null, { status: 404 });
  },
};
