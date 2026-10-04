import { uploadAssociationGuard } from './upload-policy.ts';
import type { D1Database } from '@cloudflare/workers-types';
import {
  UploadIntentError,
  validateUploadScope,
  validateUploadQuota,
  validateUploadReservation,
  validateUploadLease,
  validateUploadVerification,
  assertUploadTime,
  sameUploadReservation,
  uploadAssociationColumns,
  uploadCleanupGraceMs,
  validateUploadCleanupQuery,
  uploadCleanupPage,
  validateUploadOrphanQuery,
  validateUploadOrphanLease,
  assertUploadOrphanEligible,
  uploadOrphanPage,
  type UploadOrphanCandidate,
  type UploadCleanupCandidate,
  transitionMultipart,
  transitionUploadScan,
  type UploadScanRecord,
  multipartSystemMutation,
  type UploadMultipartSession,
  type UploadIntentStore,
  type UploadQuotaPolicy,
  type UploadScope,
  type UploadIntentRecord,
  type ReserveUpload,
  type UploadAssociation,
} from '@hyperbug/application';

interface Row {
  id: string;
  project_id: string;
  principal_id: string;
  object_key: string;
  final_key: string;
  filename: string;
  media_type: string;
  max_bytes: number;
  created_at: number;
  expires_at: number;
  state: UploadIntentRecord['state'];
  revision: number;
  association_kind: string;
  draft_id: string | null;
  issue_id: string | null;
  comment_id: string | null;
  lease_id: string | null;
  lease_expires_at: number | null;
  provider_version: string | null;
  actual_bytes: number | null;
  verified_checksum: string | null;
  reservation_state: UploadIntentRecord['reservationState'];
  scan_status: UploadIntentRecord['scanStatus'];
  policy_state: UploadIntentRecord['policyState'];
  scan_attempt_id: string | null;
  scan_sha256: string | null;
  scan_size_bytes: number | null;
  scan_policy_version: string | null;
  scan_result_status: UploadScanRecord['status'] | null;
  scan_started_at: number | null;
  scan_completed_at: number | null;
  scan_evidence: string | UploadScanRecord['evidence'];
  scan_failure_code: UploadScanRecord['failure'];
  multipart_state: UploadMultipartSession['state'] | null;
  multipart_upload_id: string | null;
  multipart_part_bytes: number | null;
  multipart_max_parts: number | null;
  multipart_parts: string | UploadMultipartSession['parts'] | null;
  multipart_revision: number | null;
}
function record(row: Row): UploadIntentRecord {
  const association =
    row.association_kind === 'issue-draft'
      ? { kind: 'issue-draft' as const, draftId: row.draft_id! }
      : row.association_kind === 'comment-draft'
        ? {
            kind: 'comment-draft' as const,
            draftId: row.draft_id!,
            issueId: row.issue_id!,
          }
        : row.association_kind === 'issue'
          ? { kind: 'issue' as const, issueId: row.issue_id! }
          : { kind: 'comment' as const, commentId: row.comment_id! };
  return {
    id: row.id,
    projectId: row.project_id,
    principalId: row.principal_id,
    stagingKey: row.object_key,
    finalKey: row.final_key,
    filename: row.filename,
    contentType: row.media_type,
    maxBytes: Number(row.max_bytes),
    now: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    association,
    scan:
      row.scan_attempt_id === null
        ? null
        : {
            attemptId: row.scan_attempt_id,
            sha256: row.scan_sha256!,
            sizeBytes: Number(row.scan_size_bytes),
            policyVersion: row.scan_policy_version!,
            status: row.scan_result_status!,
            startedAt: Number(row.scan_started_at),
            completedAt:
              row.scan_completed_at === null
                ? null
                : Number(row.scan_completed_at),
            evidence:
              typeof row.scan_evidence === 'string'
                ? JSON.parse(row.scan_evidence)
                : row.scan_evidence,
            failure: row.scan_failure_code,
          },
    multipart:
      row.multipart_state === null
        ? null
        : {
            state: row.multipart_state,
            uploadId: row.multipart_upload_id,
            partBytes: Number(row.multipart_part_bytes),
            maxParts: Number(row.multipart_max_parts),
            parts:
              typeof row.multipart_parts === 'string'
                ? JSON.parse(row.multipart_parts)
                : row.multipart_parts!,
            revision: row.multipart_revision!,
          },
    state: row.state,
    revision: row.revision,
    leaseId: row.lease_id,
    leaseExpiresAt:
      row.lease_expires_at === null ? null : Number(row.lease_expires_at),
    reservationState: row.reservation_state,
    scanStatus: row.scan_status,
    policyState: row.policy_state,
    verified:
      row.state === 'finalized'
        ? {
            key: row.final_key,
            size: Number(row.actual_bytes),
            sha256: row.verified_checksum!,
            contentType: row.media_type,
            providerVersion: row.provider_version,
            scanStatus: 'unscanned',
          }
        : null,
  };
}
const select =
  'SELECT i.*, d.*, s.attempt_id AS scan_attempt_id, s.sha256 AS scan_sha256, s.size_bytes AS scan_size_bytes, s.policy_version AS scan_policy_version, s.status AS scan_result_status, s.started_at AS scan_started_at, s.completed_at AS scan_completed_at, s.evidence AS scan_evidence, s.failure_code AS scan_failure_code, m.state AS multipart_state, m.provider_upload_id AS multipart_upload_id, m.part_bytes AS multipart_part_bytes, m.max_parts AS multipart_max_parts, m.parts AS multipart_parts, m.revision AS multipart_revision FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id LEFT JOIN upload_multipart_sessions m ON m.intent_id = i.id AND m.project_id = i.project_id LEFT JOIN upload_scan_results s ON s.intent_id = i.id AND s.project_id = i.project_id WHERE i.id = ? AND i.project_id = ? AND i.principal_id = ?';
export async function readD1UploadIntent(db: D1Database, scope: UploadScope) {
  validateUploadScope(scope);
  const row = await db
    .prepare(select)
    .bind(scope.id, scope.projectId, scope.principalId)
    .first<Row>();
  return row ? record(row) : null;
}
export function createD1UploadIntentStore(
  db: D1Database,
  suppliedPolicy: UploadQuotaPolicy,
): UploadIntentStore {
  const policy = validateUploadQuota(suppliedPolicy);
  const get = (scope: UploadScope) => readD1UploadIntent(db, scope);
  async function current(scope: UploadScope): Promise<UploadIntentRecord> {
    const found = await get(scope);
    if (!found) throw new UploadIntentError('UPLOAD_NOT_FOUND');
    return found;
  }
  async function requireActive(
    scope: UploadScope & { association?: UploadAssociation },
  ) {
    // Persisted associations own authorization after draft consumption. A
    // stale handler snapshot must not restore the former draft permissions.
    const association = (await get(scope))?.association ??
      scope.association ?? {
        kind: 'issue-draft' as const,
        draftId: scope.id,
      };
    const guard = uploadAssociationGuard(scope, association);
    if (
      !(await db
        .prepare(`SELECT 1 WHERE ${guard.sql}`)
        .bind(...guard.values)
        .first())
    )
      throw new UploadIntentError('UPLOAD_FORBIDDEN');
    return guard;
  }
  async function classifyReserve(
    input: ReserveUpload,
  ): Promise<UploadIntentRecord> {
    const existing = await get(input);
    if (existing) {
      if (!sameUploadReservation(existing, input))
        throw new UploadIntentError('UPLOAD_CONFLICT');
      return existing;
    }
    await requireActive(input);
    const quota = await db
      .prepare(
        'SELECT (SELECT reserved_bytes + used_bytes FROM project_upload_usage WHERE project_id = ?) AS project_bytes, (SELECT reserved_count FROM project_upload_usage WHERE project_id = ?) AS project_count, (SELECT reserved_bytes + used_bytes FROM principal_upload_usage WHERE principal_id = ?) AS principal_bytes, (SELECT reserved_count FROM principal_upload_usage WHERE principal_id = ?) AS principal_count',
      )
      .bind(
        input.projectId,
        input.projectId,
        input.principalId,
        input.principalId,
      )
      .first<{
        project_bytes: number;
        project_count: number;
        principal_bytes: number;
        principal_count: number;
      }>();
    if (
      quota &&
      (input.maxBytes > policy.projectBytes - (quota.project_bytes ?? 0) ||
        input.maxBytes > policy.principalBytes - (quota.principal_bytes ?? 0) ||
        quota.project_count >= policy.projectPending ||
        quota.principal_count >= policy.principalPending)
    )
      throw new UploadIntentError('UPLOAD_QUOTA');
    throw new UploadIntentError('UPLOAD_CONFLICT');
  }
  return {
    async selectOrphanCleanup(input) {
      validateUploadOrphanQuery(input);
      const after = input.after;
      const result = await db
        .prepare(
          "SELECT i.id, i.project_id, i.principal_id, i.state, i.expires_at FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id WHERE i.state = 'finalized' AND (d.reservation_state = 'used' OR (d.reservation_state = 'released' AND d.policy_state = 'deleted')) AND i.expires_at <= ? AND (d.lease_id IS NULL OR d.lease_expires_at <= ?) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = i.id) AND (i.state > ? OR (i.state = ? AND (i.expires_at > ? OR (i.expires_at = ? AND i.id > ?)))) AND i.project_id = ? ORDER BY i.state, i.expires_at, i.id LIMIT ?",
        )
        .bind(
          input.now - input.retainAfterExpiryMs,
          input.now,
          after?.state ?? '',
          after?.state ?? '',
          after?.expiresAt ?? 0,
          after?.expiresAt ?? 0,
          after?.id ?? '00000000-0000-0000-0000-000000000000',
          input.projectId,
          input.limit + 1,
        )
        .all<{
          id: string;
          project_id: string;
          principal_id: string;
          state: UploadOrphanCandidate['state'];
          expires_at: number;
        }>();
      return uploadOrphanPage(
        input,
        result.results.map((row) => ({
          id: row.id,
          projectId: row.project_id,
          principalId: row.principal_id,
          state: row.state,
          expiresAt: Number(row.expires_at),
        })),
      );
    },
    async claimOrphanCleanup(input) {
      validateUploadOrphanLease(input);
      const before = await current(input);
      assertUploadOrphanEligible(before, input);
      if (
        await db
          .prepare('SELECT 1 FROM attachments WHERE upload_intent_id = ?')
          .bind(input.id)
          .first()
      )
        throw new UploadIntentError('UPLOAD_CONFLICT');
      try {
        await db.batch([
          db
            .prepare(
              "UPDATE upload_intent_details SET policy_state = 'deleted', lease_id = ?, lease_expires_at = ? WHERE intent_id = ? AND project_id = ? AND (lease_id IS NULL OR lease_expires_at <= ? OR lease_id = ?) AND EXISTS (SELECT 1 FROM upload_intents i WHERE i.id = ? AND i.project_id = ? AND i.principal_id = ? AND i.revision = ? AND i.expires_at <= ? AND i.state = 'finalized' AND (reservation_state = 'used' OR (reservation_state = 'released' AND policy_state = 'deleted'))) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = ?)",
            )
            .bind(
              input.leaseId,
              input.leaseExpiresAt,
              input.id,
              input.projectId,
              input.now,
              input.leaseId,
              input.id,
              input.projectId,
              input.principalId,
              before.revision,
              input.now - input.retainAfterExpiryMs,
              input.id,
            ),
          db
            .prepare(
              'UPDATE upload_intents SET revision = revision + 1 WHERE id = ? AND project_id = ? AND changes() = 1',
            )
            .bind(input.id, input.projectId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ?',
            )
            .bind(input.id),
        ]);
      } catch {
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async releaseUsedAfterCleanup(input) {
      validateUploadOrphanLease(input);
      const before = await current(input);
      assertUploadOrphanEligible(before, input);
      if (before.policyState !== 'deleted')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      if (before.reservationState === 'released') {
        await db
          .prepare(
            'UPDATE upload_intent_details SET lease_id = NULL, lease_expires_at = NULL WHERE intent_id = ? AND project_id = ? AND lease_id = ? AND lease_expires_at > ? AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = ?)',
          )
          .bind(input.id, input.projectId, input.leaseId, input.now, input.id)
          .run();
        return current(input);
      }
      if (
        before.leaseId !== input.leaseId ||
        before.leaseExpiresAt! <= input.now
      )
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      const size = before.verified!.size;
      try {
        await db.batch([
          db
            .prepare(
              "UPDATE upload_intent_details SET reservation_state = 'released', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = ? AND project_id = ? AND reservation_state = 'used' AND policy_state = 'deleted' AND lease_id = ? AND lease_expires_at > ? AND EXISTS (SELECT 1 FROM upload_intents i WHERE i.id = ? AND i.project_id = ? AND i.principal_id = ? AND i.state = 'finalized' AND i.revision = ? AND i.actual_bytes = ?) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = ?)",
            )
            .bind(
              input.id,
              input.projectId,
              input.leaseId,
              input.now,
              input.id,
              input.projectId,
              input.principalId,
              before.revision,
              size,
              input.id,
            ),
          db
            .prepare(
              'UPDATE project_upload_usage SET used_bytes = used_bytes - ? WHERE project_id = ? AND changes() = 1',
            )
            .bind(size, input.projectId),
          db
            .prepare(
              'UPDATE principal_upload_usage SET used_bytes = used_bytes - ? WHERE principal_id = ? AND changes() = 1',
            )
            .bind(size, input.principalId),
          db
            .prepare(
              'UPDATE upload_intents SET revision = revision + 1 WHERE id = ? AND project_id = ? AND changes() = 1',
            )
            .bind(input.id, input.projectId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ?',
            )
            .bind(input.id),
        ]);
      } catch {
        const after = await current(input);
        if (
          after.state === 'finalized' &&
          after.reservationState === 'released' &&
          after.policyState === 'deleted'
        ) {
          assertUploadOrphanEligible(after, input);
          return after;
        }
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async selectCleanup(input) {
      validateUploadCleanupQuery(input);
      const after = input.after;
      const values = [
        input.now - uploadCleanupGraceMs,
        input.now,
        after?.state ?? '',
        after?.state ?? '',
        after?.expiresAt ?? 0,
        after?.expiresAt ?? 0,
        after?.id ?? '00000000-0000-0000-0000-000000000000',
        input.projectId,
        input.limit + 1,
      ];
      const result = await db
        .prepare(
          "SELECT i.id, i.project_id, i.principal_id, i.state, i.expires_at FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id WHERE i.state IN ('expired','pending','rejected','uploaded') AND i.expires_at <= ? AND d.reservation_state IN ('reserved','released') AND (d.lease_id IS NULL OR d.lease_expires_at <= ?) AND (i.state > ? OR (i.state = ? AND (i.expires_at > ? OR (i.expires_at = ? AND i.id > ?)))) AND i.project_id = ? ORDER BY i.state, i.expires_at, i.id LIMIT ?",
        )
        .bind(...values)
        .all<{
          id: string;
          project_id: string;
          principal_id: string;
          state: UploadCleanupCandidate['state'];
          expires_at: number;
        }>();
      const rows = result.results;
      const candidates: UploadCleanupCandidate[] = rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        principalId: row.principal_id,
        state: row.state,
        expiresAt: Number(row.expires_at),
      }));
      return uploadCleanupPage(input, candidates);
    },
    async mutateScan(input) {
      const before = await current(input);
      const guard = await requireActive(input);
      const after = transitionUploadScan(before, input);
      if (after === before) return before;
      const scan = after.scan!;
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE upload_intents SET revision = ? WHERE id = ? AND project_id = ? AND principal_id = ? AND revision = ? AND ${guard.sql}`,
            )
            .bind(
              after.revision,
              input.id,
              input.projectId,
              input.principalId,
              before.revision,
              ...guard.values,
            ),
          db
            .prepare(
              "UPDATE upload_intent_details SET scan_status = ?, policy_state = 'quarantined', lease_id = ?, lease_expires_at = ? WHERE intent_id = ? AND project_id = ? AND changes() = 1",
            )
            .bind(
              after.scanStatus,
              after.leaseId,
              after.leaseExpiresAt,
              input.id,
              input.projectId,
            ),
          db
            .prepare(
              'INSERT INTO upload_scan_results (intent_id, project_id, attempt_id, sha256, size_bytes, policy_version, status, started_at, completed_at, evidence, failure_code) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1 ON CONFLICT(intent_id) DO UPDATE SET attempt_id = excluded.attempt_id, sha256 = excluded.sha256, size_bytes = excluded.size_bytes, policy_version = excluded.policy_version, status = excluded.status, started_at = excluded.started_at, completed_at = excluded.completed_at, evidence = excluded.evidence, failure_code = excluded.failure_code',
            )
            .bind(
              input.id,
              input.projectId,
              scan.attemptId,
              scan.sha256,
              scan.sizeBytes,
              scan.policyVersion,
              scan.status,
              scan.startedAt,
              scan.completedAt,
              scan.evidence === null ? null : JSON.stringify(scan.evidence),
              scan.failure,
            ),
          db
            .prepare(
              'UPDATE upload_intent_details SET policy_state = ? WHERE intent_id = ? AND project_id = ? AND changes() = 1',
            )
            .bind(after.policyState, input.id, input.projectId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ? AND project_id = ?',
            )
            .bind(input.id, input.projectId),
        ]);
      } catch {
        await requireActive(input);
        const latest = await current(input);
        if (transitionUploadScan(latest, input) === latest) return latest;
        throw new UploadIntentError('UPLOAD_UNAVAILABLE');
      }
      return current(input);
    },
    get,
    async mutateMultipart(input) {
      const before = await current(input);
      const guard = multipartSystemMutation(input)
        ? null
        : await requireActive(input);
      const after = transitionMultipart(before, input);
      if (after === before) return before;
      const mp = after.multipart!;
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE upload_multipart_sessions SET state = ?, provider_upload_id = ?, parts = ?, revision = ? WHERE intent_id = ? AND project_id = ? AND revision = ? AND EXISTS (SELECT 1 FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id WHERE i.id = ? AND i.project_id = ? AND i.principal_id = ? AND i.revision = ? AND d.lease_id IS ? AND d.lease_expires_at IS ?) ${guard ? `AND ${guard.sql}` : ''}`,
            )
            .bind(
              mp.state,
              mp.uploadId,
              JSON.stringify(mp.parts),
              mp.revision,
              input.id,
              input.projectId,
              before.multipart!.revision,
              input.id,
              input.projectId,
              input.principalId,
              before.revision,
              before.leaseId,
              before.leaseExpiresAt,
              ...(guard?.values ?? []),
            ),
          db
            .prepare(
              'UPDATE upload_intent_details SET lease_id = ?, lease_expires_at = ?, policy_state = ? WHERE intent_id = ? AND project_id = ? AND changes() = 1',
            )
            .bind(
              after.leaseId,
              after.leaseExpiresAt,
              after.policyState,
              input.id,
              input.projectId,
            ),
          db
            .prepare(
              'UPDATE upload_intents SET state = ?, revision = ? WHERE id = ? AND project_id = ? AND changes() = 1',
            )
            .bind(after.state, after.revision, input.id, input.projectId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ? AND project_id = ?',
            )
            .bind(input.id, input.projectId),
        ]);
      } catch {
        if (!multipartSystemMutation(input)) await requireActive(input);
        const latest = await current(input);
        if (transitionMultipart(latest, input) === latest) return latest;
        throw new UploadIntentError('UPLOAD_UNAVAILABLE');
      }
      return current(input);
    },
    async reserve(input) {
      validateUploadReservation(input, policy);
      const guard = await requireActive(input);
      const previous = await get(input);
      if (previous) return classifyReserve(input);
      const [kind, draft, issue, comment] = uploadAssociationColumns(
        input.association,
      );
      try {
        await db.batch([
          db
            .prepare(
              'INSERT OR IGNORE INTO project_upload_usage (project_id) VALUES (?)',
            )
            .bind(input.projectId),
          db
            .prepare(
              'INSERT OR IGNORE INTO principal_upload_usage (principal_id) VALUES (?)',
            )
            .bind(input.principalId),
          db
            .prepare(
              'UPDATE project_upload_usage SET reserved_bytes = reserved_bytes + ?, reserved_count = reserved_count + 1 WHERE project_id = ? AND ? <= ? - used_bytes - reserved_bytes AND reserved_count < ?',
            )
            .bind(
              input.maxBytes,
              input.projectId,
              input.maxBytes,
              policy.projectBytes,
              policy.projectPending,
            ),
          db
            .prepare(
              'UPDATE principal_upload_usage SET reserved_bytes = reserved_bytes + ?, reserved_count = reserved_count + 1 WHERE principal_id = ? AND ? <= ? - used_bytes - reserved_bytes AND reserved_count < ? AND changes() = 1',
            )
            .bind(
              input.maxBytes,
              input.principalId,
              input.maxBytes,
              policy.principalBytes,
              policy.principalPending,
            ),
          db
            .prepare(
              `INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, created_at, expires_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1 AND ${guard.sql}`,
            )
            .bind(
              input.id,
              input.projectId,
              input.principalId,
              input.stagingKey,
              input.contentType,
              input.maxBytes,
              input.now,
              input.expiresAt,
              ...guard.values,
            ),
          // The NOT NULL witness aborts all prior quota writes on any zero-row predicate.
          db
            .prepare(
              'INSERT INTO upload_intent_details (intent_id, project_id, filename, final_key, association_kind, draft_id, issue_id, comment_id) VALUES (?, ?, CASE WHEN changes() = 1 THEN ? ELSE NULL END, ?, ?, ?, ?, ?)',
            )
            .bind(
              input.id,
              input.projectId,
              input.filename,
              input.finalKey,
              kind,
              draft,
              issue,
              comment,
            ),
          ...(input.multipartPlan
            ? [
                db
                  .prepare(
                    'INSERT INTO upload_multipart_sessions (intent_id, project_id, part_bytes, max_parts) VALUES (?, ?, ?, ?)',
                  )
                  .bind(
                    input.id,
                    input.projectId,
                    input.multipartPlan.partBytes,
                    input.multipartPlan.maxParts,
                  ),
              ]
            : []),
        ]);
      } catch {
        return classifyReserve(input);
      }
      return current(input);
    },
    async requestFinalize(scope, now) {
      validateUploadScope(scope);
      assertUploadTime(now);
      const guard = await requireActive(scope);
      const before = await current(scope);
      if (before.state === 'finalized') return before;
      if (before.expiresAt <= now || before.state === 'expired')
        throw new UploadIntentError('UPLOAD_EXPIRED');
      if (before.state === 'uploaded') return before;
      if (before.multipart && before.multipart.state !== 'completed')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      if (before.state !== 'pending')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      await db
        .prepare(
          `UPDATE upload_intents SET state = 'uploaded', revision = revision + 1 WHERE id = ? AND project_id = ? AND principal_id = ? AND state = 'pending' AND expires_at > ? AND ${guard.sql}`,
        )
        .bind(
          scope.id,
          scope.projectId,
          scope.principalId,
          now,
          ...guard.values,
        )
        .run();
      const after = await current(scope);
      if (after.state !== 'uploaded' && after.state !== 'finalized') {
        await requireActive(scope);
        throw new UploadIntentError('UPLOAD_CONFLICT');
      }
      return after;
    },
    async claim(input) {
      validateUploadLease(input);
      const guard = await requireActive(input);
      const before = await current(input);
      if (before.expiresAt <= input.now)
        throw new UploadIntentError('UPLOAD_EXPIRED');
      if (before.state !== 'uploaded')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      const result = await db
        .prepare(
          `UPDATE upload_intent_details SET lease_id = ?, lease_expires_at = ? WHERE intent_id = ? AND project_id = ? AND reservation_state = 'reserved' AND (lease_id IS NULL OR lease_expires_at <= ? OR lease_id = ?) AND EXISTS (SELECT 1 FROM upload_intents WHERE id = ? AND principal_id = ? AND state = 'uploaded' AND expires_at > ?) AND ${guard.sql}`,
        )
        .bind(
          input.leaseId,
          input.leaseExpiresAt,
          input.id,
          input.projectId,
          input.now,
          input.leaseId,
          input.id,
          input.principalId,
          input.now,
          ...guard.values,
        )
        .run();
      if (result.meta.changes !== 1) {
        await requireActive(input);
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async commitVerified(input) {
      const before = await current(input);
      validateUploadVerification(input, before);
      const guard = await requireActive(input);
      if (before.state === 'finalized') {
        if (
          before.verified?.sha256 !== input.verified.sha256 ||
          before.verified.size !== input.verified.size
        )
          throw new UploadIntentError('UPLOAD_CONFLICT');
        return before;
      }
      if (before.expiresAt <= input.now)
        throw new UploadIntentError('UPLOAD_EXPIRED');
      const blob = input.verified;
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE upload_intent_details SET provider_version = ?, reservation_state = 'used', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = ? AND project_id = ? AND lease_id = ? AND lease_expires_at > ? AND reservation_state = 'reserved' AND EXISTS (SELECT 1 FROM upload_intents WHERE id = ? AND principal_id = ? AND state = 'uploaded' AND expires_at > ?) AND ${guard.sql}`,
            )
            .bind(
              blob.providerVersion,
              input.id,
              input.projectId,
              input.leaseId,
              input.now,
              input.id,
              input.principalId,
              input.now,
              ...guard.values,
            ),
          db
            .prepare(
              'UPDATE project_upload_usage SET reserved_bytes = reserved_bytes - ?, used_bytes = used_bytes + ?, reserved_count = reserved_count - 1 WHERE project_id = ? AND changes() = 1',
            )
            .bind(before.maxBytes, blob.size, input.projectId),
          db
            .prepare(
              'UPDATE principal_upload_usage SET reserved_bytes = reserved_bytes - ?, used_bytes = used_bytes + ?, reserved_count = reserved_count - 1 WHERE principal_id = ? AND changes() = 1',
            )
            .bind(before.maxBytes, blob.size, input.principalId),
          db
            .prepare(
              "UPDATE upload_intents SET state = 'finalized', revision = revision + 1, verified_object_version = ?, verified_checksum = ?, actual_bytes = ? WHERE id = ? AND project_id = ? AND principal_id = ? AND state = 'uploaded' AND changes() = 1",
            )
            .bind(
              `sha256:${blob.sha256}`,
              blob.sha256,
              blob.size,
              input.id,
              input.projectId,
              input.principalId,
            ),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ? AND project_id = ?',
            )
            .bind(input.id, input.projectId),
        ]);
      } catch {
        const after = await current(input);
        await requireActive(input);
        if (
          after.state === 'finalized' &&
          after.verified?.sha256 === blob.sha256 &&
          after.verified.size === blob.size
        )
          return after;
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async rejectVerification(input) {
      validateUploadLease(input);
      const before = await current(input);
      const guard = await requireActive(input);
      if (before.state === 'rejected') return before;
      try {
        await db.batch([
          db
            .prepare(
              `UPDATE upload_intent_details SET policy_state = 'rejected', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = ? AND project_id = ? AND reservation_state = 'reserved' AND lease_id = ? AND lease_expires_at > ? AND EXISTS (SELECT 1 FROM upload_intents WHERE id = ? AND principal_id = ? AND state = 'uploaded') AND ${guard.sql}`,
            )
            .bind(
              input.id,
              input.projectId,
              input.leaseId,
              input.now,
              input.id,
              input.principalId,
              ...guard.values,
            ),
          db
            .prepare(
              "UPDATE upload_intents SET state = 'rejected', revision = revision + 1 WHERE id = ? AND project_id = ? AND changes() = 1",
            )
            .bind(input.id, input.projectId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ?',
            )
            .bind(input.id),
        ]);
      } catch {
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async claimCleanup(input) {
      validateUploadLease(input);
      const before = await current(input);
      if (before.state === 'finalized' || before.reservationState === 'used')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      if (input.now - before.expiresAt < uploadCleanupGraceMs)
        throw new UploadIntentError('UPLOAD_CONFLICT');
      try {
        await db.batch([
          db
            .prepare(
              "UPDATE upload_intent_details SET lease_id = ?, lease_expires_at = ? WHERE intent_id = ? AND project_id = ? AND reservation_state IN ('reserved','released') AND (lease_id IS NULL OR lease_expires_at <= ? OR lease_id = ?) AND EXISTS (SELECT 1 FROM upload_intents WHERE id = ? AND principal_id = ? AND state IN ('pending','uploaded','expired','rejected') AND expires_at <= ?)",
            )
            .bind(
              input.leaseId,
              input.leaseExpiresAt,
              input.id,
              input.projectId,
              input.now,
              input.leaseId,
              input.id,
              input.principalId,
              input.now - uploadCleanupGraceMs,
            ),
          db
            .prepare(
              "UPDATE upload_intents SET state = 'expired', revision = revision + 1 WHERE id = ? AND project_id = ? AND changes() = 1",
            )
            .bind(input.id, input.projectId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ?',
            )
            .bind(input.id),
        ]);
      } catch {
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async releaseQuotaAfterCleanup(input) {
      validateUploadLease(input);
      const before = await current(input);
      if (before.state !== 'expired')
        throw new UploadIntentError('UPLOAD_CONFLICT');
      if (before.reservationState === 'released') {
        await db
          .prepare(
            'UPDATE upload_intent_details SET lease_id = NULL, lease_expires_at = NULL WHERE intent_id = ? AND project_id = ? AND lease_id = ? AND lease_expires_at > ?',
          )
          .bind(input.id, input.projectId, input.leaseId, input.now)
          .run();
        return current(input);
      }
      if (
        before.leaseId !== input.leaseId ||
        before.leaseExpiresAt! <= input.now
      )
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      try {
        await db.batch([
          db
            .prepare(
              "UPDATE upload_intent_details SET reservation_state = 'released', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = ? AND project_id = ? AND reservation_state = 'reserved' AND lease_id = ? AND lease_expires_at > ?",
            )
            .bind(input.id, input.projectId, input.leaseId, input.now),
          db
            .prepare(
              'UPDATE project_upload_usage SET reserved_bytes = reserved_bytes - ?, reserved_count = reserved_count - 1 WHERE project_id = ? AND changes() = 1',
            )
            .bind(before.maxBytes, input.projectId),
          db
            .prepare(
              'UPDATE principal_upload_usage SET reserved_bytes = reserved_bytes - ?, reserved_count = reserved_count - 1 WHERE principal_id = ? AND changes() = 1',
            )
            .bind(before.maxBytes, input.principalId),
          db
            .prepare(
              'UPDATE upload_intent_details SET filename = CASE WHEN changes() = 1 THEN filename ELSE NULL END WHERE intent_id = ?',
            )
            .bind(input.id),
        ]);
      } catch {
        const after = await current(input);
        if (after.reservationState === 'released') return after;
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
  };
}
