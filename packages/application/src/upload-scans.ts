import {
  UploadIntentError,
  validateUploadLease,
  validateUploadScope,
  assertUploadTime,
  type UploadScope,
  type UploadLease,
  type UploadIntentRecord,
} from './upload-intents.ts';

export const attachmentScanPolicyVersion = 'attachment-scan-1';
export interface ScanEvidence {
  engine: string;
  engineVersion: string;
  signatureVersion: string;
}
export type ScanFailure =
  | 'unavailable'
  | 'timeout'
  | 'partial'
  | 'identity'
  | 'invalid-result';
export type ScanOutcome =
  | { status: 'clean' | 'infected'; evidence: ScanEvidence }
  | { status: 'failed'; failure: ScanFailure };
export interface UploadScanRecord {
  attemptId: string;
  sha256: string;
  sizeBytes: number;
  policyVersion: string;
  status: 'pending' | 'clean' | 'infected' | 'failed';
  startedAt: number;
  completedAt: number | null;
  evidence: ScanEvidence | null;
  failure: ScanFailure | null;
}
export type UploadScanMutation =
  | (UploadLease & { kind: 'claim'; policyVersion: string })
  | (UploadScope & {
      now: number;
      leaseId: string;
      kind: 'commit';
      outcome: ScanOutcome;
    })
  | (UploadLease & {
      kind: 'release';
      policyVersion: string;
      attemptId: string;
    });
export function validateScanOutcome(outcome: ScanOutcome): void {
  if (!outcome || !['clean', 'infected', 'failed'].includes(outcome.status))
    throw new UploadIntentError('UPLOAD_INVALID');
  if (
    Object.keys(outcome).sort().join(',') !==
    (outcome.status === 'failed' ? 'failure,status' : 'evidence,status')
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  if (outcome.status === 'failed') {
    if (
      ![
        'unavailable',
        'timeout',
        'partial',
        'identity',
        'invalid-result',
      ].includes(outcome.failure)
    )
      throw new UploadIntentError('UPLOAD_INVALID');
    return;
  }
  if (!outcome.evidence) throw new UploadIntentError('UPLOAD_INVALID');
  if (
    Object.keys(outcome.evidence).sort().join(',') !==
    'engine,engineVersion,signatureVersion'
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  for (const value of [
    outcome.evidence.engine,
    outcome.evidence.engineVersion,
    outcome.evidence.signatureVersion,
  ])
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value !== value.trim() ||
      value.length > 128 ||
      /[\p{Cc}\p{Cs}]/u.test(value)
    )
      throw new UploadIntentError('UPLOAD_INVALID');
}
function version(value: string) {
  if (!/^[a-z0-9][a-z0-9.-]{0,63}$/.test(value))
    throw new UploadIntentError('UPLOAD_INVALID');
}
export function uploadHasBoundScan(record: UploadIntentRecord): boolean {
  const scan = record.scan;
  if (
    !scan ||
    !['clean', 'infected'].includes(scan.status) ||
    scan.evidence === null
  )
    return false;
  try {
    validateScanOutcome({
      status: scan.status as 'clean' | 'infected',
      evidence: scan.evidence,
    });
  } catch {
    return false;
  }
  return (
    record.state === 'finalized' &&
    record.reservationState === 'used' &&
    record.verified !== null &&
    record.scanStatus === scan.status &&
    scan.completedAt !== null &&
    scan.sha256 === record.verified.sha256 &&
    scan.sizeBytes === record.verified.size
  );
}
export function uploadHasCurrentCleanScan(
  record: UploadIntentRecord,
  policyVersion = attachmentScanPolicyVersion,
): boolean {
  const scan = record.scan;
  return (
    uploadHasBoundScan(record) &&
    record.state === 'finalized' &&
    record.reservationState === 'used' &&
    record.verified !== null &&
    record.scanStatus === 'clean' &&
    scan?.status === 'clean' &&
    scan.evidence !== null &&
    scan.completedAt !== null &&
    scan.policyVersion === policyVersion &&
    scan.sha256 === record.verified.sha256 &&
    scan.sizeBytes === record.verified.size
  );
}
/** Latest policy result, never audit history; adapters fence the snapshot and current authorization. */
export function transitionUploadScan(
  before: UploadIntentRecord,
  input: UploadScanMutation,
): UploadIntentRecord {
  validateUploadScope(input);
  assertUploadTime(input.now);
  if (
    !before.verified ||
    before.state !== 'finalized' ||
    before.reservationState !== 'used' ||
    before.policyState === 'deleted'
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  const previous = before.scan;
  if (input.kind === 'commit') {
    validateScanOutcome(input.outcome);
    if (
      previous?.attemptId === input.leaseId &&
      previous.status !== 'pending'
    ) {
      const outcome = input.outcome;
      if (
        previous.status === outcome.status &&
        JSON.stringify(previous.evidence) ===
          JSON.stringify(
            outcome.status === 'failed' ? null : outcome.evidence,
          ) &&
        previous.failure ===
          (outcome.status === 'failed' ? outcome.failure : null)
      )
        return before;
      throw new UploadIntentError('UPLOAD_CONFLICT');
    }
  }
  if (input.kind !== 'commit') validateUploadLease(input);
  const after = { ...before, revision: before.revision + 1 };
  const claim = () => {
    if (input.kind === 'commit') throw new UploadIntentError('UPLOAD_INVALID');
    if (
      before.leaseId !== null &&
      before.leaseId !== input.leaseId &&
      before.leaseExpiresAt! > input.now
    )
      throw new UploadIntentError('UPLOAD_LEASE_LOST');
    after.leaseId = input.leaseId;
    after.leaseExpiresAt = input.leaseExpiresAt;
  };
  if (input.kind === 'claim') {
    version(input.policyVersion);
    if (
      before.policyState === 'ready' &&
      uploadHasCurrentCleanScan(before, input.policyVersion)
    )
      return before;
    if (before.policyState === 'rejected')
      throw new UploadIntentError('UPLOAD_CONFLICT');
    if (previous?.attemptId === input.leaseId)
      throw new UploadIntentError('UPLOAD_CONFLICT');
    claim();
    // Never duplicate/reset a live attempt, even with the same token.
    if (previous?.status === 'pending' && before.leaseExpiresAt! > input.now)
      throw new UploadIntentError('UPLOAD_LEASE_LOST');
    after.scan = {
      attemptId: input.leaseId,
      sha256: before.verified.sha256,
      sizeBytes: before.verified.size,
      policyVersion: input.policyVersion,
      status: 'pending',
      startedAt: input.now,
      completedAt: null,
      evidence: null,
      failure: null,
    };
    after.scanStatus = 'pending';
    after.policyState = 'quarantined';
    return after;
  }
  if (input.kind === 'release') {
    version(input.policyVersion);
    if (
      !uploadHasCurrentCleanScan(before, input.policyVersion) ||
      previous!.attemptId !== input.attemptId
    )
      throw new UploadIntentError('UPLOAD_CONFLICT');
    if (before.policyState === 'ready') return before;
    claim();
    after.policyState = 'ready';
    after.leaseId = null;
    after.leaseExpiresAt = null;
    return after;
  }
  if (before.leaseId !== input.leaseId || before.leaseExpiresAt! <= input.now)
    throw new UploadIntentError('UPLOAD_LEASE_LOST');
  if (
    !previous ||
    previous.attemptId !== input.leaseId ||
    previous.status !== 'pending' ||
    previous.sha256 !== before.verified.sha256 ||
    previous.sizeBytes !== before.verified.size ||
    input.now < previous.startedAt
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  const outcome = input.outcome;
  after.scan = {
    ...previous,
    status: outcome.status,
    completedAt: input.now,
    evidence: outcome.status === 'failed' ? null : { ...outcome.evidence },
    failure: outcome.status === 'failed' ? outcome.failure : null,
  };
  after.scanStatus = outcome.status;
  after.policyState =
    outcome.status === 'infected' ||
    (outcome.status === 'failed' && outcome.failure === 'identity')
      ? 'rejected'
      : 'quarantined';
  if (outcome.status !== 'clean') {
    after.leaseId = null;
    after.leaseExpiresAt = null;
  }
  return after;
}
