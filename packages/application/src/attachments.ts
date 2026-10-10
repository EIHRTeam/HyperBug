import type { UploadIntentRecord } from './upload-intents.ts';
import { uploadHasCurrentCleanScan } from './upload-scans.ts';
import type { BlobInfo, BlobRange } from './blob-store.ts';

/** Internal delivery snapshot; never a public DTO or download capability. */
export interface AttachmentRecord {
  id: string;
  projectId: string;
  uploadIntentId: string;
  issueId: string | null;
  commentId: string | null;
  objectKey: string;
  objectVersion: string;
  checksum: string;
  mediaType: string;
  sizeBytes: number;
  policyState: 'pending' | 'ready' | 'quarantined' | 'deleted';
  revision: number;
  upload: UploadIntentRecord;
}
export interface AttachmentStore {
  get(id: string): Promise<AttachmentRecord | null>;
}
export function attachmentIsDeliverable(file: AttachmentRecord): boolean {
  const upload = file.upload;
  return (
    file.policyState === 'ready' &&
    upload.policyState === 'ready' &&
    upload.leaseId === null &&
    uploadHasCurrentCleanScan(upload) &&
    file.id === upload.id &&
    file.uploadIntentId === upload.id &&
    file.projectId === upload.projectId &&
    file.objectKey === upload.verified!.key &&
    file.objectVersion === `sha256:${upload.verified!.sha256}` &&
    file.checksum === upload.verified!.sha256 &&
    file.mediaType === upload.contentType &&
    file.sizeBytes === upload.verified!.size &&
    ((file.issueId !== null &&
      file.commentId === null &&
      upload.association.kind === 'issue' &&
      upload.association.issueId === file.issueId) ||
      (file.commentId !== null &&
        file.issueId === null &&
        upload.association.kind === 'comment' &&
        upload.association.commentId === file.commentId))
  );
}
export function attachmentBlobMatches(
  file: AttachmentRecord,
  blob: BlobInfo,
): boolean {
  return (
    blob.key === file.objectKey &&
    blob.size === file.sizeBytes &&
    blob.contentType === file.mediaType &&
    blob.metadata['intent-id'] === file.uploadIntentId &&
    (file.upload.verified!.providerVersion === null ||
      blob.version === file.upload.verified!.providerVersion)
  );
}
/** One byte range only; parsing occurs after authorization. */
export function attachmentRange(
  header: string,
  size: number,
): BlobRange | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if (
    (first !== null && !Number.isSafeInteger(first)) ||
    (last !== null && !Number.isSafeInteger(last))
  )
    return null;
  const offset = first ?? Math.max(0, size - (last ?? 0));
  const end = first === null ? size - 1 : Math.min(size - 1, last ?? size - 1);
  return offset >= size || offset > end || (first === null && last === 0)
    ? null
    : { offset, length: end - offset + 1 };
}
