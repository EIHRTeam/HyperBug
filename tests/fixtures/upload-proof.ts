import {
  processUploadIntent,
  cleanupUploadIntent,
  scanVerifiedUpload,
  BlobStoreError,
  type UploadDependencies,
  type UploadScope,
} from '@hyperbug/application';

/** Test-only manual invocation: database transaction guards remain authoritative. */
export async function uploadProof(
  deps: UploadDependencies,
  scope: UploadScope,
  operation: string,
  text = '',
  failDelete = false,
): Promise<{ text?: string; etag?: string; sizeBytes?: number }> {
  const record = await deps.intents.get(scope);
  if (!record) throw new Error('Missing upload fixture');
  const now = Date.now();
  const lease = {
    ...scope,
    leaseId: scope.id,
    now,
    leaseExpiresAt: now + 60000,
  };
  if (operation === 'fail-signing') {
    const original = deps.capabilities.upload;
    deps.capabilities.upload = async () => {
      deps.capabilities.upload = original;
      throw new Error('private-signer-token-fixture');
    };
  } else if (operation === 'fail-completion') {
    const original = deps.intents.mutateMultipart;
    deps.intents.mutateMultipart = async (input) => {
      if (input.kind === 'completed') {
        deps.intents.mutateMultipart = original;
        throw new Error('private-completion-fixture');
      }
      return original(input);
    };
  } else if (operation === 'multipart-part') {
    const [partNumber, sizeBytes] = text.split(':').map(Number);
    if (!record.multipart?.uploadId || !sizeBytes || !partNumber)
      throw new Error('Invalid multipart proof');
    const bytes = new Uint8Array(sizeBytes).fill(97);
    const part = await deps.blobs.uploadPart(
      { key: record.stagingKey, uploadId: record.multipart.uploadId },
      partNumber,
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      sizeBytes,
    );
    return { etag: part.etag, sizeBytes };
  } else if (operation === 'final-size') {
    const blob = await deps.blobs.get(record.finalKey);
    if (!blob) throw new Error('Missing final proof');
    const reader = blob.body.getReader();
    let sizeBytes = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      sizeBytes += chunk.value.byteLength;
    }
    return { sizeBytes };
  } else if (
    operation === 'synthetic-scan' ||
    operation === 'synthetic-partial-scan'
  ) {
    await scanVerifiedUpload(
      {
        ...deps,
        scanner: {
          async scan({ body }) {
            if (operation === 'synthetic-scan') {
              const reader = body.getReader();
              try {
                for (;;) {
                  const chunk = await reader.read();
                  if (chunk.done) break;
                }
              } finally {
                reader.releaseLock();
              }
            }
            return {
              status: 'clean',
              evidence: {
                engine: 'synthetic-test-scanner',
                engineVersion: 'fixture-1',
                signatureVersion: 'fixture-1',
              },
            };
          },
        },
      },
      async () => {},
      { ...lease, leaseId: crypto.randomUUID() },
    );
  } else if (operation === 'stage') {
    const bytes = new TextEncoder().encode(text);
    await deps.blobs.put({
      key: record.stagingKey,
      size: bytes.length,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
      contentType: record.contentType,
      createOnly: false,
    });
  } else if (operation === 'process') {
    await processUploadIntent(deps, async () => {}, lease);
  } else if (operation === 'cleanup') {
    const blobs = failDelete
      ? new Proxy(deps.blobs, {
          get(target, property) {
            if (property === 'delete')
              return async () => {
                throw new BlobStoreError('BLOB_UNAVAILABLE');
              };
            return Reflect.get(target, property);
          },
        })
      : deps.blobs;
    await cleanupUploadIntent({ intents: deps.intents, blobs }, lease);
  } else if (operation === 'final') {
    const blob = await deps.blobs.get(record.finalKey);
    return { text: await new Response(blob?.body).text() };
  } else throw new Error('Invalid upload proof');
  return {};
}
