import {
  UploadIntentError,
  assertUploadTime,
  validateUploadScope,
  validateUploadLease,
  type UploadScope,
  type UploadLease,
  type UploadIntentRecord,
} from './upload-intents.ts';
import { assertId } from '@hyperbug/domain';

export interface UploadMultipartPlan {
  partBytes: number;
  maxParts: number;
}
export interface UploadPartReceipt {
  partNumber: number;
  etag: string;
  sizeBytes: number;
}
export interface UploadMultipartSession extends UploadMultipartPlan {
  state:
    | 'planned'
    | 'creating'
    | 'active'
    | 'completing'
    | 'completed'
    | 'aborting'
    | 'aborted';
  uploadId: string | null;
  parts: UploadPartReceipt[];
  revision: number;
}
export type MultipartMutation = UploadScope & { now: number } & (
    | ({ kind: 'claim-create' | 'claim-abort' } & Pick<
        UploadLease,
        'leaseId' | 'leaseExpiresAt'
      >)
    | ({ kind: 'claim-complete'; expectedRevision: number } & Pick<
        UploadLease,
        'leaseId' | 'leaseExpiresAt'
      >)
    | {
        kind: 'created' | 'creation-aborted';
        leaseId: string;
        uploadId: string;
      }
    | { kind: 'part'; expectedRevision: number; part: UploadPartReceipt }
    | { kind: 'completed'; leaseId: string; valid: boolean }
    | {
        kind: 'aborted' | 'cleanup-aborted' | 'cleanup-reconciled';
        leaseId: string;
      }
  );
export function multipartTotal(record: UploadIntentRecord): number {
  const session = record.multipart;
  if (!session || !session.parts.length)
    throw new UploadIntentError('UPLOAD_INVALID');
  let total = 0;
  for (const [index, part] of session.parts.entries()) {
    validatePartReceipt(part, session);
    if (
      part.partNumber !== index + 1 ||
      (index < session.parts.length - 1 && part.sizeBytes !== session.partBytes)
    )
      throw new UploadIntentError('UPLOAD_INVALID');
    total += part.sizeBytes;
    if (total > record.maxBytes) throw new UploadIntentError('UPLOAD_INVALID');
  }
  return total;
}
export function validatePartReceipt(
  part: UploadPartReceipt,
  plan: UploadMultipartPlan,
): void {
  if (
    !Number.isInteger(part.partNumber) ||
    part.partNumber < 1 ||
    part.partNumber > plan.maxParts ||
    !part.etag ||
    part.etag.length > 256 ||
    /[\p{Cc}\p{Cs}]/u.test(part.etag) ||
    !Number.isSafeInteger(part.sizeBytes) ||
    part.sizeBytes < 1 ||
    part.sizeBytes > plan.partBytes
  )
    throw new UploadIntentError('UPLOAD_INVALID');
}
export function multipartSystemMutation(input: MultipartMutation): boolean {
  return [
    'created',
    'creation-aborted',
    'aborted',
    'cleanup-aborted',
    'cleanup-reconciled',
  ].includes(input.kind);
}
/** Pure shared transitions; adapters enforce this snapshot and authorization atomically. */
export function transitionMultipart(
  before: UploadIntentRecord,
  input: MultipartMutation,
): UploadIntentRecord {
  validateUploadScope(input);
  assertUploadTime(input.now);
  const previous = before.multipart;
  if (!previous) throw new UploadIntentError('UPLOAD_CONFLICT');
  if (input.kind === 'part' || input.kind === 'claim-complete') {
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 1 ||
      input.expectedRevision > 2147483647
    )
      throw new UploadIntentError('UPLOAD_INVALID');
  }
  const after = {
    ...before,
    multipart: {
      ...previous,
      parts: previous.parts.map((part) => ({ ...part })),
      revision: previous.revision + 1,
    },
    revision: before.revision + 1,
  };
  const session = after.multipart;
  const unfinished = (allowRejected = false) => {
    if (before.expiresAt <= input.now || before.state === 'expired')
      throw new UploadIntentError('UPLOAD_EXPIRED');
    if (
      before.reservationState !== 'reserved' ||
      !['pending', 'uploaded', ...(allowRejected ? ['rejected'] : [])].includes(
        before.state,
      )
    )
      throw new UploadIntentError('UPLOAD_CONFLICT');
  };
  const claim = () => {
    if (!('leaseExpiresAt' in input))
      throw new UploadIntentError('UPLOAD_INVALID');
    validateUploadLease(input);
    if (
      before.leaseId !== null &&
      before.leaseId !== input.leaseId &&
      before.leaseExpiresAt! > input.now
    )
      throw new UploadIntentError('UPLOAD_LEASE_LOST');
    after.leaseId = input.leaseId;
    after.leaseExpiresAt = input.leaseExpiresAt;
  };
  const ownedLease = () => {
    if (!('leaseId' in input)) throw new UploadIntentError('UPLOAD_INVALID');
    assertId(input.leaseId);
    if (before.leaseId !== input.leaseId || before.leaseExpiresAt! <= input.now)
      throw new UploadIntentError('UPLOAD_LEASE_LOST');
  };
  const clearLease = () => {
    after.leaseId = null;
    after.leaseExpiresAt = null;
  };
  switch (input.kind) {
    case 'claim-create':
      unfinished();
      if (previous.state === 'active') return before;
      if (previous.state === 'creating') {
        if (before.leaseExpiresAt! > input.now)
          throw new UploadIntentError('UPLOAD_LEASE_LOST');
        // An unknown provider-side creation cannot safely be duplicated.
        throw new UploadIntentError('UPLOAD_UNAVAILABLE');
      }
      if (previous.state !== 'planned' || before.state !== 'pending')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      claim();
      session.state = 'creating';
      break;
    case 'creation-aborted':
    case 'created':
      ownedLease();
      if (
        previous.state !== 'creating' ||
        !input.uploadId ||
        input.uploadId.length > 2048 ||
        /[\p{Cc}\p{Cs}]/u.test(input.uploadId)
      )
        throw new UploadIntentError('UPLOAD_CONFLICT');
      session.uploadId = input.uploadId;
      session.state = input.kind === 'created' ? 'active' : 'aborted';
      if (input.kind === 'creation-aborted') {
        after.state = 'rejected';
        after.policyState = 'rejected';
      }
      clearLease();
      break;
    case 'part': {
      unfinished();
      if (previous.state !== 'active' || before.state !== 'pending')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      validatePartReceipt(input.part, previous);
      const old = previous.parts.find(
        (part) => part.partNumber === input.part.partNumber,
      );
      if (
        old?.etag === input.part.etag &&
        old.sizeBytes === input.part.sizeBytes
      )
        return before;
      if (input.expectedRevision !== previous.revision)
        throw new UploadIntentError('UPLOAD_CONFLICT');
      session.parts = [
        ...previous.parts.filter(
          (part) => part.partNumber !== input.part.partNumber,
        ),
        { ...input.part },
      ].sort((a, b) => a.partNumber - b.partNumber);
      break;
    }
    case 'claim-complete':
      if (previous.state === 'completed' && before.state === 'finalized')
        return before;
      unfinished();
      if (previous.state === 'completed') return before;
      if (
        !['active', 'completing'].includes(previous.state) ||
        before.state !== 'pending' ||
        !previous.uploadId ||
        input.expectedRevision !== previous.revision
      )
        throw new UploadIntentError('UPLOAD_CONFLICT');
      multipartTotal(before);
      claim();
      session.state = 'completing';
      break;
    case 'completed':
      ownedLease();
      unfinished();
      if (previous.state !== 'completing')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      session.state = 'completed';
      after.state = input.valid ? 'uploaded' : 'rejected';
      if (!input.valid) after.policyState = 'rejected';
      clearLease();
      break;
    case 'claim-abort':
      if (previous.state === 'aborted') return before;
      unfinished(previous.state === 'aborting');
      if (previous.state === 'creating')
        throw new UploadIntentError('UPLOAD_UNAVAILABLE');
      claim();
      session.state = 'aborting';
      after.state = 'rejected';
      break;
    case 'aborted':
      ownedLease();
      if (previous.state !== 'aborting')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      session.state = 'aborted';
      after.policyState = 'rejected';
      clearLease();
      break;
    case 'cleanup-aborted':
      ownedLease();
      if (
        before.state !== 'expired' ||
        (previous.state === 'creating' && previous.uploadId === null)
      )
        throw new UploadIntentError('UPLOAD_UNAVAILABLE');
      session.state = 'aborted';
      break;
    case 'cleanup-reconciled':
      ownedLease();
      if (
        before.state !== 'expired' ||
        previous.state !== 'creating' ||
        previous.uploadId !== null
      )
        throw new UploadIntentError('UPLOAD_CONFLICT');
      // Retain ambiguity on the tombstone: every later sweep repeats provider discovery.
      break;
  }
  return after;
}
