import { assertId } from '@hyperbug/domain';
import { assertBlobKey, assertBlobType } from './blob-store.ts';
import type {
  MultipartMutation,
  UploadMultipartPlan,
  UploadMultipartSession,
} from './multipart.ts';
import type { VerifiedBlob } from './blob-promotion.ts';
import type { UploadScanMutation, UploadScanRecord } from './upload-scans.ts';
import type {
  UploadCleanupQuery,
  UploadCleanupPage,
} from './upload-cleanup.ts';
import type {
  UploadOrphanQuery,
  UploadOrphanPage,
  UploadOrphanLease,
} from './upload-orphan-cleanup.ts';

export class UploadIntentError extends Error {
  readonly code:
    | 'UPLOAD_INVALID'
    | 'UPLOAD_NOT_FOUND'
    | 'UPLOAD_FORBIDDEN'
    | 'UPLOAD_CONFLICT'
    | 'UPLOAD_EXPIRED'
    | 'UPLOAD_QUOTA'
    | 'UPLOAD_LEASE_LOST'
    | 'UPLOAD_UNAVAILABLE';
  constructor(code: UploadIntentError['code']) {
    super(code);
    this.code = code;
  }
}
export type UploadAssociation =
  | { kind: 'issue-draft'; draftId: string }
  | { kind: 'comment-draft'; draftId: string; issueId: string }
  | { kind: 'issue'; issueId: string }
  | { kind: 'comment'; commentId: string };
export interface UploadQuotaPolicy {
  maxFileBytes: number;
  projectBytes: number;
  principalBytes: number;
  projectPending: number;
  principalPending: number;
}
export interface ReserveUpload {
  id: string;
  projectId: string;
  principalId: string;
  stagingKey: string;
  finalKey: string;
  filename: string;
  contentType: string;
  maxBytes: number;
  association: UploadAssociation;
  now: number;
  expiresAt: number;
  multipartPlan?: UploadMultipartPlan;
}
export interface UploadScope {
  id: string;
  projectId: string;
  principalId: string;
}
export interface UploadIntentRecord extends ReserveUpload {
  multipart: UploadMultipartSession | null;
  scan: UploadScanRecord | null;
  state: 'pending' | 'uploaded' | 'finalized' | 'expired' | 'rejected';
  revision: number;
  leaseId: string | null;
  leaseExpiresAt: number | null;
  verified: VerifiedBlob | null;
  reservationState: 'reserved' | 'used' | 'released';
  scanStatus: 'unscanned' | 'pending' | 'clean' | 'infected' | 'failed';
  policyState: 'quarantined' | 'ready' | 'rejected' | 'deleted';
}
export interface UploadLease extends UploadScope {
  leaseId: string;
  now: number;
  leaseExpiresAt: number;
}
export interface UploadVerification extends UploadScope {
  leaseId: string;
  now: number;
  verified: VerifiedBlob;
}
/** Internal port. Callers authorize requests; mutations also guard current database permissions. */
export interface UploadIntentStore {
  selectOrphanCleanup(input: UploadOrphanQuery): Promise<UploadOrphanPage>;
  claimOrphanCleanup(input: UploadOrphanLease): Promise<UploadIntentRecord>;
  releaseUsedAfterCleanup(
    input: UploadOrphanLease,
  ): Promise<UploadIntentRecord>;
  selectCleanup(input: UploadCleanupQuery): Promise<UploadCleanupPage>;
  mutateScan(input: UploadScanMutation): Promise<UploadIntentRecord>;
  mutateMultipart(input: MultipartMutation): Promise<UploadIntentRecord>;
  reserve(input: ReserveUpload): Promise<UploadIntentRecord>;
  get(scope: UploadScope): Promise<UploadIntentRecord | null>;
  requestFinalize(scope: UploadScope, now: number): Promise<UploadIntentRecord>;
  claim(input: UploadLease): Promise<UploadIntentRecord>;
  commitVerified(input: UploadVerification): Promise<UploadIntentRecord>;
  rejectVerification(input: UploadLease): Promise<UploadIntentRecord>;
  claimCleanup(input: UploadLease): Promise<UploadIntentRecord>;
  releaseQuotaAfterCleanup(input: UploadLease): Promise<UploadIntentRecord>;
}
export const uploadCleanupGraceMs = 300000;
export function assertUploadTime(time: number): void {
  if (!Number.isSafeInteger(time) || time < 0 || time > 8640000000000000)
    throw new UploadIntentError('UPLOAD_INVALID');
}
export function validateUploadScope(input: UploadScope): void {
  assertId(input.id);
  assertId(input.projectId);
  assertId(input.principalId);
}
export function validateUploadQuota(
  policy: UploadQuotaPolicy,
): Readonly<UploadQuotaPolicy> {
  for (const value of [
    policy.maxFileBytes,
    policy.projectBytes,
    policy.principalBytes,
  ]) {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > Number.MAX_SAFE_INTEGER
    )
      throw new UploadIntentError('UPLOAD_INVALID');
  }
  if (
    policy.maxFileBytes > Math.min(policy.projectBytes, policy.principalBytes)
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  for (const count of [policy.projectPending, policy.principalPending])
    if (!Number.isInteger(count) || count < 1 || count > 10000)
      throw new UploadIntentError('UPLOAD_INVALID');
  return Object.freeze({ ...policy });
}
export function validateUploadReservation(
  input: ReserveUpload,
  policy: UploadQuotaPolicy,
): void {
  validateUploadScope(input);
  assertUploadTime(input.now);
  assertUploadTime(input.expiresAt);
  assertBlobKey(input.stagingKey, true);
  assertBlobKey(input.finalKey);
  assertBlobType(input.contentType);
  if (
    !input.finalKey.startsWith('objects/') ||
    !Number.isSafeInteger(input.maxBytes) ||
    input.maxBytes < 1 ||
    input.maxBytes > policy.maxFileBytes ||
    input.expiresAt <= input.now ||
    input.expiresAt - input.now > 86400000
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  if (
    !input.filename ||
    input.filename !== input.filename.trim() ||
    Array.from(input.filename).length > 255 ||
    /[\p{Cc}\p{Cs}\\/]/u.test(input.filename) ||
    input.filename === '.' ||
    input.filename === '..'
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  if (
    input.multipartPlan &&
    (!Number.isSafeInteger(input.multipartPlan.partBytes) ||
      input.multipartPlan.partBytes < 5 * 1024 ** 2 ||
      input.multipartPlan.partBytes > 5 * 1024 ** 3 ||
      input.multipartPlan.maxParts !==
        Math.ceil(input.maxBytes / input.multipartPlan.partBytes) ||
      input.multipartPlan.maxParts < 1 ||
      input.multipartPlan.maxParts > 10000)
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  const association = input.association;
  if (
    !association ||
    !['issue-draft', 'comment-draft', 'issue', 'comment'].includes(
      association.kind,
    )
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  if (
    association.kind === 'issue-draft' ||
    association.kind === 'comment-draft'
  )
    assertId(association.draftId);
  if (association.kind === 'issue' || association.kind === 'comment-draft')
    assertId(association.issueId);
  if (association.kind === 'comment') assertId(association.commentId);
}
export function validateUploadLease(input: UploadLease): void {
  validateUploadScope(input);
  assertId(input.leaseId);
  assertUploadTime(input.now);
  assertUploadTime(input.leaseExpiresAt);
  if (
    input.leaseExpiresAt <= input.now ||
    input.leaseExpiresAt - input.now > 300000
  )
    throw new UploadIntentError('UPLOAD_INVALID');
}
export function validateUploadVerification(
  input: UploadVerification,
  record: UploadIntentRecord,
): void {
  validateUploadScope(input);
  assertId(input.leaseId);
  assertUploadTime(input.now);
  const blob = input.verified;
  if (
    blob.key !== record.finalKey ||
    blob.contentType !== record.contentType ||
    !Number.isSafeInteger(blob.size) ||
    blob.size < 0 ||
    blob.size > record.maxBytes ||
    !/^[0-9a-f]{64}$/.test(blob.sha256) ||
    blob.scanStatus !== 'unscanned' ||
    (blob.providerVersion !== null &&
      (!blob.providerVersion || blob.providerVersion.length > 1024))
  )
    throw new UploadIntentError('UPLOAD_INVALID');
}
export function sameUploadReservation(
  record: UploadIntentRecord,
  input: ReserveUpload,
): boolean {
  return (
    record.id === input.id &&
    record.projectId === input.projectId &&
    record.principalId === input.principalId &&
    record.stagingKey === input.stagingKey &&
    record.finalKey === input.finalKey &&
    record.filename === input.filename &&
    record.contentType === input.contentType &&
    record.maxBytes === input.maxBytes &&
    record.now === input.now &&
    record.expiresAt === input.expiresAt &&
    (record.multipart?.partBytes ?? null) ===
      (input.multipartPlan?.partBytes ?? null) &&
    (record.multipart?.maxParts ?? null) ===
      (input.multipartPlan?.maxParts ?? null) &&
    JSON.stringify(uploadAssociationColumns(record.association)) ===
      JSON.stringify(uploadAssociationColumns(input.association))
  );
}
export function uploadAssociationColumns(
  association: UploadAssociation,
): [string, string | null, string | null, string | null] {
  return [
    association.kind,
    'draftId' in association ? association.draftId : null,
    'issueId' in association ? association.issueId : null,
    'commentId' in association ? association.commentId : null,
  ];
}
