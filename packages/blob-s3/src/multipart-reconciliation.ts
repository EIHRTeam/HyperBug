import {
  ListMultipartUploadsCommand,
  AbortMultipartUploadCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  BlobStoreError,
  createBoundedMultipartReconciler,
  type UploadMultipartReconciler,
} from '@hyperbug/application';

/** SDK serialization stays in the adapter; exact-key/absence/bounds policy is shared. */
export function createS3MultipartReconciler(
  client: S3Client,
  bucket: string,
): UploadMultipartReconciler {
  return createBoundedMultipartReconciler({
    async list(input) {
      const result = await client.send(
        new ListMultipartUploadsCommand({
          Bucket: bucket,
          Prefix: input.key,
          MaxUploads: input.maxUploads,
          ...(input.keyMarker === undefined
            ? {}
            : { KeyMarker: input.keyMarker }),
          ...(input.uploadIdMarker === undefined
            ? {}
            : { UploadIdMarker: input.uploadIdMarker }),
        }),
        { abortSignal: input.signal },
      );
      if (
        (result.Uploads !== undefined && !Array.isArray(result.Uploads)) ||
        (result.CommonPrefixes !== undefined &&
          !Array.isArray(result.CommonPrefixes))
      )
        throw new BlobStoreError('BLOB_UNAVAILABLE');
      return {
        truncated: result.IsTruncated,
        uploads: (result.Uploads ?? []).map((upload) => ({
          key: upload.Key,
          id: upload.UploadId,
        })),
        groupedPrefixes: result.CommonPrefixes?.length ?? 0,
        nextKey: result.NextKeyMarker,
        nextId: result.NextUploadIdMarker,
      };
    },
    async abort(input) {
      try {
        await client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: input.key,
            UploadId: input.uploadId,
          }),
          { abortSignal: input.signal },
        );
      } catch (error) {
        if (
          !(
            error &&
            typeof error === 'object' &&
            'name' in error &&
            error.name === 'NoSuchUpload'
          )
        )
          throw error;
      }
    },
  });
}
