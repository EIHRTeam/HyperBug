import {
  createS3BlobStore,
  createNodeBlobDigest,
  type S3BlobConfig,
} from '@hyperbug/blob-s3';
import {
  defaultUploadMultipart,
  type UploadIntentStore,
  type UploadDependencies,
} from '@hyperbug/application';
import { nodeSecretFileSource } from './key-provider.ts';

/** Optional private operator configuration; no provider or bucket is selected implicitly. */
export async function configureNodeUploads(
  intents: UploadIntentStore | null,
  file: string | undefined,
  environment: string,
): Promise<{ uploads: UploadDependencies | null; close(): void }> {
  if (file === undefined) return { uploads: null, close() {} };
  try {
    if (!intents) throw new Error();
    const config = JSON.parse(
      await nodeSecretFileSource(file).read(new AbortController().signal),
    ) as S3BlobConfig;
    if (
      typeof config.forcePathStyle !== 'boolean' ||
      typeof config.credentials !== 'object' ||
      config.credentials === null ||
      !('accessKeyId' in config.credentials) ||
      !('secretAccessKey' in config.credentials) ||
      typeof config.credentials.accessKeyId !== 'string' ||
      !config.credentials.accessKeyId ||
      typeof config.credentials.secretAccessKey !== 'string' ||
      !config.credentials.secretAccessKey
    )
      throw new Error();
    const adapter = createS3BlobStore({
      ...config,
      multipart: config.multipart ?? defaultUploadMultipart,
      allowLocalHttp: environment === 'local' && config.allowLocalHttp === true,
    });
    return {
      uploads: {
        intents,
        blobs: adapter.store,
        capabilities: adapter.authorization,
        createDigest: createNodeBlobDigest,
        multipartReconciler: adapter.reconciliation,
      },
      close: adapter.close,
    };
  } catch {
    throw new Error('Invalid upload storage configuration');
  }
}
