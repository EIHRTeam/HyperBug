import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import {
  createR2BlobStore,
  createR2BlobAuthorization,
  createR2BlobDigest,
  createR2MultipartReconciler,
  type R2SigningConfig,
} from '@hyperbug/blob-r2';
import { createD1UploadIntentStore } from '@hyperbug/database-d1';
import {
  defaultUploadQuota,
  defaultUploadMultipart,
  validateMultipartPolicy,
  type BlobMultipartPolicy,
  type UploadDependencies,
} from '@hyperbug/application';

export interface WorkerUploadBindings {
  HYPERBUG_UPLOAD_BLOB?: R2Bucket;
  HYPERBUG_UPLOAD_STORAGE?: string;
}
/** Native CRUD binding plus a private signing secret for the same operator-selected bucket. */
export function configureWorkerUploads(
  db: D1Database | null,
  bindings: WorkerUploadBindings,
): UploadDependencies | null {
  if (
    bindings.HYPERBUG_UPLOAD_BLOB === undefined &&
    bindings.HYPERBUG_UPLOAD_STORAGE === undefined
  )
    return null;
  let phase = 'bindings';
  try {
    if (!bindings.HYPERBUG_UPLOAD_STORAGE) throw new Error();
    phase = 'configuration';
    const config = JSON.parse(
      bindings.HYPERBUG_UPLOAD_STORAGE,
    ) as R2SigningConfig & { multipart?: BlobMultipartPolicy };
    // Validate static policy now; native bindings may be absent during
    // upload-time module validation. Acquire them on the first runtime request.
    phase = 'blob-policy';
    const multipart = validateMultipartPolicy(
      config.multipart ?? defaultUploadMultipart,
    );
    phase = 'signing';
    const capabilities = createR2BlobAuthorization(config);
    phase = 'reconciliation';
    const multipartReconciler = createR2MultipartReconciler(config);
    let native: Pick<UploadDependencies, 'intents' | 'blobs'> | null = null;
    const live = () => {
      if (native) return native;
      if (!db || !bindings.HYPERBUG_UPLOAD_BLOB)
        throw new Error('Invalid upload storage configuration (bindings)');
      native = {
        intents: createD1UploadIntentStore(db, defaultUploadQuota),
        blobs: createR2BlobStore(bindings.HYPERBUG_UPLOAD_BLOB, multipart),
      };
      return native;
    };
    return {
      get intents() {
        return live().intents;
      },
      get blobs() {
        return live().blobs;
      },
      capabilities,
      createDigest: createR2BlobDigest,
      multipartReconciler,
    };
  } catch {
    throw new Error(`Invalid upload storage configuration (${phase})`);
  }
}
