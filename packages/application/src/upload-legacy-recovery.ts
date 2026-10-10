import { assertId } from '@hyperbug/domain';
import {
  UploadIntentError,
  assertUploadTime,
  validateUploadLease,
  validateUploadScope,
  type UploadLease,
  type UploadScope,
} from './upload-intents.ts';
import type { UploadLegacyCandidate } from './upload-legacy-inventory.ts';
import {
  createUploadCleanupDeadline,
  UploadCleanupTimeoutError,
} from './upload-cleanup-deadline.ts';

export const uploadLegacyRecoveryVersion = 'upload-legacy-cleanup-1';
/** Internal operator decision, never supplied through a public client or inferred from key shape. */
export interface UploadLegacyRecoveryDecision {
  version: typeof uploadLegacyRecoveryVersion;
  decisionId: string;
  snapshot: UploadLegacyCandidate;
  /** References reviewed selected-provider/bucket/key ownership evidence outside the database. */
  ownershipEvidenceSha256: string;
  /** References proof this exact record is still included in retained backfilled accounting. */
  accountingEvidenceSha256: string;
  retainAfterExpiryMs: number;
}
export interface UploadLegacyRecoveryClaim extends UploadLease {
  decision: UploadLegacyRecoveryDecision;
}
export interface UploadLegacyRecoveryRecord extends UploadScope {
  decision: UploadLegacyRecoveryDecision;
  state: 'deleting' | 'released';
  revision: number;
  leaseId: string | null;
  leaseExpiresAt: number | null;
  createdAt: number;
  releasedAt: number | null;
}
/** Closed trusted provider result. A synthetic callback is never real physical recovery evidence. */
export interface UploadLegacyRecoveryAbsence {
  decisionId: string;
  ownershipEvidenceSha256: string;
  key: string;
  remainingObjects: 0;
  remainingUploads: 0;
}
export interface UploadLegacyRecoveryRelease extends UploadLease {
  absence: UploadLegacyRecoveryAbsence;
}
export interface UploadLegacyRecoveryQuery {
  projectId: string;
  now: number;
  limit: number;
  after?: string;
}
export interface UploadLegacyRecoveryPage {
  items: UploadScope[];
  next: string | null;
}
export interface UploadLegacyRecoveryStore {
  get(scope: UploadScope): Promise<UploadLegacyRecoveryRecord | null>;
  claim(input: UploadLegacyRecoveryClaim): Promise<UploadLegacyRecoveryRecord>;
  release(
    input: UploadLegacyRecoveryRelease,
  ): Promise<UploadLegacyRecoveryRecord>;
  select(input: UploadLegacyRecoveryQuery): Promise<UploadLegacyRecoveryPage>;
}
/** Selected provider capability must verify ownership and reconcile exact physical objects/sessions. */
export interface UploadLegacyRecoveryProvider {
  recover(input: {
    decision: UploadLegacyRecoveryDecision;
    signal: AbortSignal;
  }): Promise<UploadLegacyRecoveryAbsence>;
}
const closed = (value: unknown, keys: string[]) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.sort().join(',')
  )
    throw new UploadIntentError('UPLOAD_INVALID');
};
const bounded = (value: unknown, maximum: number) => {
  if (
    typeof value !== 'string' ||
    !value.length ||
    value.length > maximum ||
    /[\p{Cc}\p{Cs}]/u.test(value)
  )
    throw new UploadIntentError('UPLOAD_INVALID');
};
/** Canonical explicit snapshot without introducing current lifecycle or association fields. */
export function canonicalUploadLegacyDecision(
  input: UploadLegacyRecoveryDecision,
): UploadLegacyRecoveryDecision {
  closed(input, [
    'version',
    'decisionId',
    'snapshot',
    'ownershipEvidenceSha256',
    'accountingEvidenceSha256',
    'retainAfterExpiryMs',
  ]);
  if (input.version !== uploadLegacyRecoveryVersion)
    throw new UploadIntentError('UPLOAD_INVALID');
  assertId(input.decisionId);
  for (const digest of [
    input.ownershipEvidenceSha256,
    input.accountingEvidenceSha256,
  ])
    if (typeof digest !== 'string' || !/^[0-9a-f]{64}$/.test(digest))
      throw new UploadIntentError('UPLOAD_INVALID');
  assertUploadTime(input.retainAfterExpiryMs);
  if (input.retainAfterExpiryMs < 300000)
    throw new UploadIntentError('UPLOAD_INVALID');
  const value = input.snapshot;
  closed(value, [
    'id',
    'projectId',
    'principalId',
    'state',
    'revision',
    'objectKey',
    'contentType',
    'maxBytes',
    'createdAt',
    'expiresAt',
    'actualBytes',
    'objectVersion',
    'checksum',
    'hasAttachment',
  ]);
  validateUploadScope(value);
  if (
    !['pending', 'uploaded', 'finalized', 'expired', 'rejected'].includes(
      value.state,
    ) ||
    value.hasAttachment !== false ||
    !Number.isInteger(value.revision) ||
    value.revision < 1 ||
    value.revision >= 2147483647
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  bounded(value.objectKey, 1024);
  if (new TextEncoder().encode(value.objectKey).length > 1024)
    throw new UploadIntentError('UPLOAD_INVALID');
  bounded(value.contentType, 255);
  if (
    !Number.isSafeInteger(value.maxBytes) ||
    value.maxBytes < 1 ||
    (value.actualBytes !== null &&
      (!Number.isSafeInteger(value.actualBytes) ||
        value.actualBytes < 0 ||
        value.actualBytes > value.maxBytes))
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  assertUploadTime(value.createdAt);
  assertUploadTime(value.expiresAt);
  if (value.expiresAt <= value.createdAt)
    throw new UploadIntentError('UPLOAD_INVALID');
  if (value.objectVersion !== null) bounded(value.objectVersion, 1024);
  if (value.checksum !== null) bounded(value.checksum, 128);
  if (
    value.state === 'finalized' &&
    (value.actualBytes === null ||
      value.objectVersion === null ||
      value.checksum === null)
  )
    throw new UploadIntentError('UPLOAD_INVALID');
  return {
    version: uploadLegacyRecoveryVersion,
    decisionId: input.decisionId,
    snapshot: {
      id: value.id,
      projectId: value.projectId,
      principalId: value.principalId,
      state: value.state,
      revision: value.revision,
      objectKey: value.objectKey,
      contentType: value.contentType,
      maxBytes: value.maxBytes,
      createdAt: value.createdAt,
      expiresAt: value.expiresAt,
      actualBytes: value.actualBytes,
      objectVersion: value.objectVersion,
      checksum: value.checksum,
      hasAttachment: false,
    },
    ownershipEvidenceSha256: input.ownershipEvidenceSha256,
    accountingEvidenceSha256: input.accountingEvidenceSha256,
    retainAfterExpiryMs: input.retainAfterExpiryMs,
  };
}
export function uploadLegacyDecisionJson(
  input: UploadLegacyRecoveryDecision,
): string {
  const json = JSON.stringify(canonicalUploadLegacyDecision(input));
  if (new TextEncoder().encode(json).length > 8192)
    throw new UploadIntentError('UPLOAD_INVALID');
  return json;
}
export function validateUploadLegacyRecoveryClaim(
  input: UploadLegacyRecoveryClaim,
): void {
  validateUploadLease(input);
  const snapshot = canonicalUploadLegacyDecision(input.decision).snapshot;
  if (
    snapshot.id !== input.id ||
    snapshot.projectId !== input.projectId ||
    snapshot.principalId !== input.principalId ||
    input.now - snapshot.expiresAt < input.decision.retainAfterExpiryMs
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
}
export function assertUploadLegacyRecoveryDecision(
  record: UploadLegacyRecoveryRecord,
  input: UploadLegacyRecoveryClaim,
): void {
  validateUploadLegacyRecoveryClaim(input);
  if (
    uploadLegacyDecisionJson(record.decision) !==
    uploadLegacyDecisionJson(input.decision)
  )
    throw new UploadIntentError('UPLOAD_CONFLICT');
  if (
    record.leaseId !== null &&
    record.leaseId !== input.leaseId &&
    record.leaseExpiresAt! > input.now
  )
    throw new UploadIntentError('UPLOAD_LEASE_LOST');
}
export function assertUploadLegacyRecoveryRelease(
  record: UploadLegacyRecoveryRecord,
  input: UploadLegacyRecoveryRelease,
): void {
  validateUploadLease(input);
  closed(input.absence, [
    'decisionId',
    'ownershipEvidenceSha256',
    'key',
    'remainingObjects',
    'remainingUploads',
  ]);
  if (
    input.absence.decisionId !== record.decision.decisionId ||
    input.absence.ownershipEvidenceSha256 !==
      record.decision.ownershipEvidenceSha256 ||
    input.absence.key !== record.decision.snapshot.objectKey ||
    input.absence.remainingObjects !== 0 ||
    input.absence.remainingUploads !== 0
  )
    throw new UploadIntentError('UPLOAD_UNAVAILABLE');
  if (record.state === 'released' && record.leaseId === null) return;
  if (record.leaseId !== input.leaseId || record.leaseExpiresAt! <= input.now)
    throw new UploadIntentError('UPLOAD_LEASE_LOST');
}
export function uploadLegacyRecoveryAccounting(
  decision: UploadLegacyRecoveryDecision,
) {
  const snapshot = canonicalUploadLegacyDecision(decision).snapshot;
  return snapshot.state === 'finalized'
    ? { reservedBytes: 0, usedBytes: snapshot.actualBytes!, reservedCount: 0 }
    : { reservedBytes: snapshot.maxBytes, usedBytes: 0, reservedCount: 1 };
}
export function validateUploadLegacyRecoveryQuery(
  input: UploadLegacyRecoveryQuery,
): void {
  assertId(input.projectId);
  assertUploadTime(input.now);
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 20)
    throw new UploadIntentError('UPLOAD_INVALID');
  if (input.after !== undefined) assertId(input.after);
}
export function uploadLegacyRecoveryPage(
  input: UploadLegacyRecoveryQuery,
  rows: (UploadScope & { leaseExpiresAt: number | null })[],
): UploadLegacyRecoveryPage {
  // Limit the base window before filtering leases; held rows still advance the cursor.
  const scanned = rows.slice(0, input.limit);
  const items = scanned
    .filter(
      (row) => row.leaseExpiresAt === null || row.leaseExpiresAt <= input.now,
    )
    .map(({ id, projectId, principalId }) => ({ id, projectId, principalId }));
  return {
    items,
    next: rows.length > input.limit ? scanned.at(-1)!.id : null,
  };
}

/** System recovery only; retained approval/keys survive every failed, partial or late provider result. */
export async function recoverLegacyUpload(
  deps: {
    store: UploadLegacyRecoveryStore;
    provider: UploadLegacyRecoveryProvider;
  },
  input: UploadLegacyRecoveryClaim,
  clock: () => number = Date.now,
): Promise<UploadLegacyRecoveryRecord> {
  const record = await deps.store.claim({ ...input, now: clock() });
  const deadline = createUploadCleanupDeadline(input, clock);
  try {
    let absence: UploadLegacyRecoveryAbsence;
    try {
      absence = await deadline.wait((signal) =>
        deps.provider.recover({ decision: record.decision, signal }),
      );
    } catch (error) {
      if (error instanceof UploadCleanupTimeoutError) throw error;
      throw new UploadIntentError('UPLOAD_UNAVAILABLE');
    }
    deadline.check();
    return await deps.store.release({ ...input, now: clock(), absence });
  } finally {
    deadline.close();
  }
}

/** Bounded approved-ledger sweeps; inventory rows without a trusted decision are never selected. */
export async function recoverLegacyUploadPage(
  deps: {
    store: UploadLegacyRecoveryStore;
    provider: UploadLegacyRecoveryProvider;
  },
  input: UploadLegacyRecoveryQuery,
  clock: () => number = Date.now,
): Promise<{
  next: string | null;
  results: { id: string; outcome: 'released' | 'held' }[];
}> {
  const page = await deps.store.select(input);
  const results: { id: string; outcome: 'released' | 'held' }[] = [];
  for (const [index, scope] of page.items.entries()) {
    try {
      // eslint-disable-next-line no-await-in-loop -- One approved target at a time.
      const record = await deps.store.get(scope);
      if (!record) throw new UploadIntentError('UPLOAD_NOT_FOUND');
      const now = clock();
      // eslint-disable-next-line no-await-in-loop -- Fixed bounded page; timeout stops further candidates.
      await recoverLegacyUpload(
        deps,
        {
          ...scope,
          decision: record.decision,
          now,
          leaseId: crypto.randomUUID(),
          leaseExpiresAt: now + 300000,
        },
        clock,
      );
      results.push({ id: scope.id, outcome: 'released' });
    } catch (error) {
      results.push({ id: scope.id, outcome: 'held' });
      if (error instanceof UploadCleanupTimeoutError)
        return {
          next: index + 1 < page.items.length ? scope.id : page.next,
          results,
        };
    }
  }
  return { next: page.next, results };
}
