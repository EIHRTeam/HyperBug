import type { R2Bucket } from '@cloudflare/workers-types';
import {
  createR2BlobStore,
  createR2BlobDigest,
  createR2BlobAuthorization,
  createR2MultipartReconciler,
  type R2SigningConfig,
} from '@hyperbug/blob-r2';
import { blobTestPolicy, proveBlobStore } from './blob-store-proof.ts';
import { proveBlobPromotion } from './blob-promotion-proof.ts';
import { proveBlobSigning } from './blob-signing-proof.ts';
import { proveMultipartReconciliation } from './multipart-reconciliation-proof.ts';
import { proveR2LegacyRecovery } from './r2-legacy-provider-proof.ts';
import { AwsClient } from 'aws4fetch';
import { r2MissingUpload } from '../../packages/blob-r2/src/multipart-xml.ts';
export default {
  async fetch(request: Request, env: { BLOB: R2Bucket }): Promise<Response> {
    // Test-only loopback harness; never composed into a product server.
    if (new URL(request.url).pathname === '/ready') {
      await env.BLOB.head('__hyperbug_loopback_storage_readiness__');
      return new Response(null, { status: 200 });
    }
    if (
      new URL(request.url).pathname === '/legacy-recovery' &&
      request.method === 'POST'
    ) {
      const config = (await request.json()) as R2SigningConfig & {
        ownedFixtureKey?: string;
      };
      if (
        !config.ownedFixtureKey ||
        !/^historical prefix\/文件 [0-9a-f-]{36} \?#%\+&$/.test(
          config.ownedFixtureKey,
        )
      )
        throw new Error('Missing loopback owned fixture receipt');
      const observer = new AwsClient({
        ...config.credentials,
        region: 'auto',
        service: 's3',
      });
      const direct = async (
        key: string,
        method: 'HEAD' | 'DELETE',
        uploadId?: string,
      ) => {
        const url = new URL(
          `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
        );
        if (uploadId) url.searchParams.set('uploadId', uploadId);
        return fetch(
          await observer.sign(url.toString(), {
            method,
            signal: AbortSignal.timeout(30000),
            redirect: 'manual',
            cache: 'no-store',
            aws: { signQuery: false },
          }),
        );
      };
      return Response.json(
        await proveR2LegacyRecovery(
          config,
          {
            async put(key) {
              await env.BLOB.put(key, 'old');
            },
            async head(key) {
              const response = await direct(key, 'HEAD');
              void response.body?.cancel().catch(() => {});
              if (response.status === 404) return false;
              if (response.status === 200) return true;
              throw new Error('Owned direct R2 observation failed');
            },
            async create(key) {
              return (await env.BLOB.createMultipartUpload(key)).uploadId;
            },
            async writable(key, id) {
              try {
                await env.BLOB.resumeMultipartUpload(key, id).uploadPart(
                  1,
                  'x',
                );
                return true;
              } catch {
                return false;
              }
            },
            async abort(key, id) {
              const response = await direct(key, 'DELETE', id);
              if (response.status === 204) {
                void response.body?.cancel().catch(() => {});
                return;
              }
              if (
                response.status === 404 &&
                (await r2MissingUpload(response, AbortSignal.timeout(30000)))
              )
                return;
              void response.body?.cancel().catch(() => {});
              throw new Error('Owned direct R2 session cleanup failed');
            },
            async delete(key) {
              const response = await direct(key, 'DELETE');
              void response.body?.cancel().catch(() => {});
              if (response.status !== 204)
                throw new Error('Owned direct R2 object cleanup failed');
            },
          },
          config.ownedFixtureKey,
        ),
      );
    }
    if (
      new URL(request.url).pathname === '/reconciliation' &&
      request.method === 'POST'
    ) {
      const config = (await request.json()) as R2SigningConfig;
      return Response.json(
        await proveMultipartReconciliation(
          createR2BlobStore(env.BLOB, blobTestPolicy),
          createR2MultipartReconciler(config),
        ),
      );
    }
    if (
      new URL(request.url).pathname === '/signing' &&
      request.method === 'POST'
    ) {
      const config = (await request.json()) as R2SigningConfig;
      return Response.json(
        await proveBlobSigning(
          createR2BlobStore(env.BLOB, blobTestPolicy),
          createR2BlobAuthorization(config),
        ),
      );
    }
    if (new URL(request.url).pathname === '/promotion')
      return Response.json(
        await proveBlobPromotion(
          createR2BlobStore(env.BLOB, blobTestPolicy),
          createR2BlobDigest,
        ),
      );
    return Response.json(
      await proveBlobStore(createR2BlobStore(env.BLOB, blobTestPolicy)),
    );
  },
};
