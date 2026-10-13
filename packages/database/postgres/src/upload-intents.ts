import { uploadAssociationGuard } from './upload-policy.ts';
import type { Pool, PoolClient } from 'pg';
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
  'SELECT i.*, d.*, s.attempt_id AS scan_attempt_id, s.sha256 AS scan_sha256, s.size_bytes AS scan_size_bytes, s.policy_version AS scan_policy_version, s.status AS scan_result_status, s.started_at AS scan_started_at, s.completed_at AS scan_completed_at, s.evidence AS scan_evidence, s.failure_code AS scan_failure_code, m.state AS multipart_state, m.provider_upload_id AS multipart_upload_id, m.part_bytes AS multipart_part_bytes, m.max_parts AS multipart_max_parts, m.parts AS multipart_parts, m.revision AS multipart_revision FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id LEFT JOIN upload_multipart_sessions m ON m.intent_id = i.id AND m.project_id = i.project_id LEFT JOIN upload_scan_results s ON s.intent_id = i.id AND s.project_id = i.project_id WHERE i.id = $1 AND i.project_id = $2 AND i.principal_id = $3';
export async function readPostgresUploadIntent(
  db: Pool | PoolClient,
  scope: UploadScope,
  lock = false,
) {
  validateUploadScope(scope);
  const result = await db.query<Row>(
    select + (lock ? ' FOR UPDATE OF i, d' : ''),
    [scope.id, scope.projectId, scope.principalId],
  );
  return result.rows[0] ? record(result.rows[0]) : null;
}
export function createPostgresUploadIntentStore(
  pool: Pool,
  suppliedPolicy: UploadQuotaPolicy,
): UploadIntentStore {
  const policy = validateUploadQuota(suppliedPolicy);
  const read = readPostgresUploadIntent;
  async function current(db: Pool | PoolClient, scope: UploadScope) {
    const found = await read(db, scope, db !== pool);
    if (!found) throw new UploadIntentError('UPLOAD_NOT_FOUND');
    return found;
  }
  async function transaction<T>(
    scope: UploadScope & { association?: UploadAssociation },
    operation: (db: PoolClient) => Promise<T>,
    requireAuthorization = true,
  ): Promise<T> {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      // All attachment transactions lock project first, then principal/usage/intent rows.
      const project = await db.query<{ status: string }>(
        'SELECT status FROM projects WHERE id = $1 FOR UPDATE',
        [scope.projectId],
      );
      const principal = await db.query<{ status: string }>(
        'SELECT status FROM principals WHERE id = $1 FOR SHARE',
        [scope.principalId],
      );
      if (
        requireAuthorization &&
        (project.rows[0]?.status !== 'active' ||
          principal.rows[0]?.status !== 'active')
      )
        throw new UploadIntentError('UPLOAD_FORBIDDEN');
      // A stale handler snapshot cannot override the consumed parent target.
      const association = (await read(db, scope))?.association ??
        scope.association ?? {
          kind: 'issue-draft' as const,
          draftId: scope.id,
        };
      await db.query(
        'SELECT project_id FROM project_roles WHERE project_id = $1 AND principal_id = $2 FOR SHARE',
        [scope.projectId, scope.principalId],
      );
      if (association.kind === 'issue' || association.kind === 'comment-draft')
        await db.query(
          'SELECT id FROM issues WHERE project_id = $1 AND id = $2 FOR SHARE',
          [scope.projectId, association.issueId],
        );
      if (association.kind === 'comment') {
        await db.query(
          'SELECT i.id FROM issues i JOIN comments c ON c.issue_id = i.id AND c.project_id = i.project_id WHERE c.project_id = $1 AND c.id = $2 FOR SHARE OF i',
          [scope.projectId, association.commentId],
        );
        await db.query(
          'SELECT id FROM comments WHERE project_id = $1 AND id = $2 FOR SHARE',
          [scope.projectId, association.commentId],
        );
      }
      const guard = uploadAssociationGuard(scope, association);
      if (
        requireAuthorization &&
        !(await db.query(`SELECT 1 WHERE ${guard.sql}`, guard.values)).rowCount
      )
        throw new UploadIntentError('UPLOAD_FORBIDDEN');
      const result = await operation(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      if (error instanceof UploadIntentError) throw error;
      throw new UploadIntentError('UPLOAD_UNAVAILABLE');
    } finally {
      db.release();
    }
  }
  return {
    async selectOrphanCleanup(input) {
      validateUploadOrphanQuery(input);
      const after = input.after;
      const result = await pool.query<{
        id: string;
        project_id: string;
        principal_id: string;
        state: UploadOrphanCandidate['state'];
        expires_at: number;
      }>(
        "SELECT i.id, i.project_id, i.principal_id, i.state, i.expires_at FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id WHERE i.state = 'finalized' AND (d.reservation_state = 'used' OR (d.reservation_state = 'released' AND d.policy_state = 'deleted')) AND i.expires_at <= $1 AND (d.lease_id IS NULL OR d.lease_expires_at <= $2) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = i.id) AND (i.state > $3 OR (i.state = $3 AND (i.expires_at > $4 OR (i.expires_at = $4 AND i.id > $5)))) AND i.project_id = $6 ORDER BY i.state, i.expires_at, i.id LIMIT $7",
        [
          input.now - input.retainAfterExpiryMs,
          input.now,
          after?.state ?? '',
          after?.expiresAt ?? 0,
          after?.id ?? '00000000-0000-0000-0000-000000000000',
          input.projectId,
          input.limit + 1,
        ],
      );
      return uploadOrphanPage(
        input,
        result.rows.map((row) => ({
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
      return transaction(
        input,
        async (db) => {
          const before = await current(db, input);
          assertUploadOrphanEligible(before, input);
          if (
            (
              await db.query(
                'SELECT 1 FROM attachments WHERE upload_intent_id = $1',
                [input.id],
              )
            ).rowCount
          )
            throw new UploadIntentError('UPLOAD_CONFLICT');
          await db.query(
            "UPDATE upload_intent_details SET policy_state = 'deleted', lease_id = $1, lease_expires_at = $2 WHERE intent_id = $3",
            [input.leaseId, input.leaseExpiresAt, input.id],
          );
          await db.query(
            'UPDATE upload_intents SET revision = revision + 1 WHERE id = $1',
            [input.id],
          );
          return current(db, input);
        },
        false,
      );
    },
    async releaseUsedAfterCleanup(input) {
      validateUploadOrphanLease(input);
      return transaction(
        input,
        async (db) => {
          const before = await current(db, input);
          assertUploadOrphanEligible(before, input);
          if (
            before.policyState !== 'deleted' ||
            (
              await db.query(
                'SELECT 1 FROM attachments WHERE upload_intent_id = $1',
                [input.id],
              )
            ).rowCount
          )
            throw new UploadIntentError('UPLOAD_CONFLICT');
          if (before.reservationState === 'released') {
            if (
              before.leaseId === input.leaseId &&
              before.leaseExpiresAt! > input.now
            )
              await db.query(
                'UPDATE upload_intent_details SET lease_id = NULL, lease_expires_at = NULL WHERE intent_id = $1',
                [input.id],
              );
            return current(db, input);
          }
          if (
            before.leaseId !== input.leaseId ||
            before.leaseExpiresAt! <= input.now
          )
            throw new UploadIntentError('UPLOAD_LEASE_LOST');
          await db.query(
            "UPDATE upload_intent_details SET reservation_state = 'released', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = $1",
            [input.id],
          );
          const size = before.verified!.size;
          for (const [table, column, id] of [
            ['project_upload_usage', 'project_id', input.projectId],
            ['principal_upload_usage', 'principal_id', input.principalId],
          ] as const) {
            // Project-first transaction; two bounded counter writes, never provider I/O.
            // eslint-disable-next-line no-await-in-loop
            const changed = await db.query(
              `UPDATE ${table} SET used_bytes = used_bytes - $1 WHERE ${column} = $2 RETURNING ${column}`,
              [size, id],
            );
            if (changed.rowCount !== 1)
              throw new UploadIntentError('UPLOAD_UNAVAILABLE');
          }
          await db.query(
            'UPDATE upload_intents SET revision = revision + 1 WHERE id = $1',
            [input.id],
          );
          return current(db, input);
        },
        false,
      );
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
        input.limit + 1,
        input.projectId,
      ];
      const result = await pool.query<{
        id: string;
        project_id: string;
        principal_id: string;
        state: UploadCleanupCandidate['state'];
        expires_at: number;
      }>(
        "SELECT i.id, i.project_id, i.principal_id, i.state, i.expires_at FROM upload_intents i JOIN upload_intent_details d ON d.intent_id = i.id AND d.project_id = i.project_id WHERE i.state IN ('expired','pending','rejected','uploaded') AND i.expires_at <= $1 AND d.reservation_state IN ('reserved','released') AND (d.lease_id IS NULL OR d.lease_expires_at <= $2) AND (i.state > $3 OR (i.state = $4 AND (i.expires_at > $5 OR (i.expires_at = $6 AND i.id > $7)))) AND i.project_id = $9 ORDER BY i.state, i.expires_at, i.id LIMIT $8",
        values,
      );
      const rows = result.rows;
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
      await current(pool, input);
      return transaction(input, async (db) => {
        const before = await current(db, input);
        const after = transitionUploadScan(before, input);
        if (after === before) return before;
        const scan = after.scan!;
        await db.query(
          "UPDATE upload_intent_details SET scan_status = $1, policy_state = 'quarantined', lease_id = $2, lease_expires_at = $3 WHERE intent_id = $4 AND project_id = $5",
          [
            after.scanStatus,
            after.leaseId,
            after.leaseExpiresAt,
            input.id,
            input.projectId,
          ],
        );
        await db.query(
          'INSERT INTO upload_scan_results (intent_id, project_id, attempt_id, sha256, size_bytes, policy_version, status, started_at, completed_at, evidence, failure_code) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(intent_id) DO UPDATE SET attempt_id = excluded.attempt_id, sha256 = excluded.sha256, size_bytes = excluded.size_bytes, policy_version = excluded.policy_version, status = excluded.status, started_at = excluded.started_at, completed_at = excluded.completed_at, evidence = excluded.evidence, failure_code = excluded.failure_code',
          [
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
          ],
        );
        await db.query(
          'UPDATE upload_intents SET revision = $1 WHERE id = $2 AND project_id = $3',
          [after.revision, input.id, input.projectId],
        );
        await db.query(
          'UPDATE upload_intent_details SET policy_state = $1 WHERE intent_id = $2 AND project_id = $3',
          [after.policyState, input.id, input.projectId],
        );
        return current(db, input);
      });
    },
    get(scope) {
      return read(pool, scope);
    },
    async mutateMultipart(input) {
      // Match owner/project-scoped absence before authorization classification on D1.
      // The locked transaction still repeats every authorization and state predicate.
      await current(pool, input);
      return transaction(
        input,
        async (db) => {
          const before = await current(db, input);
          const after = transitionMultipart(before, input);
          if (after === before) return before;
          const mp = after.multipart!;
          await db.query(
            'UPDATE upload_multipart_sessions SET state = $1, provider_upload_id = $2, parts = $3, revision = $4 WHERE intent_id = $5 AND project_id = $6',
            [
              mp.state,
              mp.uploadId,
              JSON.stringify(mp.parts),
              mp.revision,
              input.id,
              input.projectId,
            ],
          );
          await db.query(
            'UPDATE upload_intent_details SET lease_id = $1, lease_expires_at = $2, policy_state = $3 WHERE intent_id = $4',
            [after.leaseId, after.leaseExpiresAt, after.policyState, input.id],
          );
          await db.query(
            'UPDATE upload_intents SET state = $1, revision = $2 WHERE id = $3',
            [after.state, after.revision, input.id],
          );
          return current(db, input);
        },
        !multipartSystemMutation(input),
      );
    },
    async reserve(input) {
      validateUploadReservation(input, policy);
      try {
        return await transaction(input, async (db) => {
          const previous = await read(db, input, true);
          if (previous) {
            if (!sameUploadReservation(previous, input))
              throw new UploadIntentError('UPLOAD_CONFLICT');
            return previous;
          }
          await db.query(
            'INSERT INTO project_upload_usage (project_id) VALUES ($1) ON CONFLICT DO NOTHING',
            [input.projectId],
          );
          await db.query(
            'INSERT INTO principal_upload_usage (principal_id) VALUES ($1) ON CONFLICT DO NOTHING',
            [input.principalId],
          );
          const project = await db.query(
            'UPDATE project_upload_usage SET reserved_bytes = reserved_bytes + $1, reserved_count = reserved_count + 1 WHERE project_id = $2 AND $1 <= $3 - used_bytes - reserved_bytes AND reserved_count < $4 RETURNING project_id',
            [
              input.maxBytes,
              input.projectId,
              policy.projectBytes,
              policy.projectPending,
            ],
          );
          if (!project.rowCount) throw new UploadIntentError('UPLOAD_QUOTA');
          const principal = await db.query(
            'UPDATE principal_upload_usage SET reserved_bytes = reserved_bytes + $1, reserved_count = reserved_count + 1 WHERE principal_id = $2 AND $1 <= $3 - used_bytes - reserved_bytes AND reserved_count < $4 RETURNING principal_id',
            [
              input.maxBytes,
              input.principalId,
              policy.principalBytes,
              policy.principalPending,
            ],
          );
          if (!principal.rowCount) throw new UploadIntentError('UPLOAD_QUOTA');
          await db.query(
            'INSERT INTO upload_intents (id, project_id, principal_id, object_key, media_type, max_bytes, created_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              input.id,
              input.projectId,
              input.principalId,
              input.stagingKey,
              input.contentType,
              input.maxBytes,
              input.now,
              input.expiresAt,
            ],
          );
          const [kind, draft, issue, comment] = uploadAssociationColumns(
            input.association,
          );
          await db.query(
            'INSERT INTO upload_intent_details (intent_id, project_id, filename, final_key, association_kind, draft_id, issue_id, comment_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
            [
              input.id,
              input.projectId,
              input.filename,
              input.finalKey,
              kind,
              draft,
              issue,
              comment,
            ],
          );
          if (input.multipartPlan)
            await db.query(
              'INSERT INTO upload_multipart_sessions (intent_id, project_id, part_bytes, max_parts) VALUES ($1, $2, $3, $4)',
              [
                input.id,
                input.projectId,
                input.multipartPlan.partBytes,
                input.multipartPlan.maxParts,
              ],
            );
          return current(db, input);
        });
      } catch (error) {
        if (
          error instanceof UploadIntentError &&
          error.code !== 'UPLOAD_UNAVAILABLE'
        )
          throw error;
        const previous = await read(pool, input);
        if (previous && sameUploadReservation(previous, input)) return previous;
        throw new UploadIntentError('UPLOAD_CONFLICT');
      }
    },
    async requestFinalize(scope, now) {
      validateUploadScope(scope);
      assertUploadTime(now);
      return transaction(scope, async (db) => {
        const before = await current(db, scope);
        if (before.state === 'finalized') return before;
        if (before.expiresAt <= now || before.state === 'expired')
          throw new UploadIntentError('UPLOAD_EXPIRED');
        if (before.state === 'uploaded') return before;
        if (before.multipart && before.multipart.state !== 'completed')
          throw new UploadIntentError('UPLOAD_CONFLICT');
        if (before.state !== 'pending')
          throw new UploadIntentError('UPLOAD_CONFLICT');
        await db.query(
          "UPDATE upload_intents SET state = 'uploaded', revision = revision + 1 WHERE id = $1",
          [scope.id],
        );
        return current(db, scope);
      });
    },
    async claim(input) {
      validateUploadLease(input);
      return transaction(input, async (db) => {
        const before = await current(db, input);
        if (before.expiresAt <= input.now)
          throw new UploadIntentError('UPLOAD_EXPIRED');
        if (before.state !== 'uploaded')
          throw new UploadIntentError('UPLOAD_CONFLICT');
        if (
          before.leaseId !== null &&
          before.leaseId !== input.leaseId &&
          before.leaseExpiresAt! > input.now
        )
          throw new UploadIntentError('UPLOAD_LEASE_LOST');
        await db.query(
          'UPDATE upload_intent_details SET lease_id = $1, lease_expires_at = $2 WHERE intent_id = $3',
          [input.leaseId, input.leaseExpiresAt, input.id],
        );
        return current(db, input);
      });
    },
    async commitVerified(input) {
      validateUploadScope(input);
      assertUploadTime(input.now);
      return transaction(input, async (db) => {
        const before = await current(db, input);
        validateUploadVerification(input, before);
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
        if (
          before.state !== 'uploaded' ||
          before.leaseId !== input.leaseId ||
          before.leaseExpiresAt! <= input.now
        )
          throw new UploadIntentError('UPLOAD_LEASE_LOST');
        const blob = input.verified;
        const changed = await db.query(
          "UPDATE upload_intent_details SET provider_version = $1, reservation_state = 'used', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = $2 AND reservation_state = 'reserved' RETURNING intent_id",
          [blob.providerVersion, input.id],
        );
        if (!changed.rowCount) throw new UploadIntentError('UPLOAD_LEASE_LOST');
        await db.query(
          'UPDATE project_upload_usage SET reserved_bytes = reserved_bytes - $1, used_bytes = used_bytes + $2, reserved_count = reserved_count - 1 WHERE project_id = $3',
          [before.maxBytes, blob.size, input.projectId],
        );
        await db.query(
          'UPDATE principal_upload_usage SET reserved_bytes = reserved_bytes - $1, used_bytes = used_bytes + $2, reserved_count = reserved_count - 1 WHERE principal_id = $3',
          [before.maxBytes, blob.size, input.principalId],
        );
        await db.query(
          "UPDATE upload_intents SET state = 'finalized', revision = revision + 1, verified_object_version = $1, verified_checksum = $2, actual_bytes = $3 WHERE id = $4",
          [`sha256:${blob.sha256}`, blob.sha256, blob.size, input.id],
        );
        return current(db, input);
      });
    },
    async rejectVerification(input) {
      validateUploadLease(input);
      return transaction(input, async (db) => {
        const before = await current(db, input);
        if (before.state === 'rejected') return before;
        if (
          before.state !== 'uploaded' ||
          before.leaseId !== input.leaseId ||
          before.leaseExpiresAt! <= input.now
        )
          throw new UploadIntentError('UPLOAD_LEASE_LOST');
        await db.query(
          "UPDATE upload_intent_details SET policy_state = 'rejected', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = $1",
          [input.id],
        );
        await db.query(
          "UPDATE upload_intents SET state = 'rejected', revision = revision + 1 WHERE id = $1",
          [input.id],
        );
        return current(db, input);
      });
    },
    async claimCleanup(input) {
      validateUploadLease(input);
      return transaction(
        input,
        async (db) => {
          const before = await current(db, input);
          if (
            before.state === 'finalized' ||
            before.reservationState === 'used' ||
            input.now - before.expiresAt < uploadCleanupGraceMs
          )
            throw new UploadIntentError('UPLOAD_CONFLICT');
          if (
            before.leaseId !== null &&
            before.leaseId !== input.leaseId &&
            before.leaseExpiresAt! > input.now
          )
            throw new UploadIntentError('UPLOAD_LEASE_LOST');
          await db.query(
            'UPDATE upload_intent_details SET lease_id = $1, lease_expires_at = $2 WHERE intent_id = $3',
            [input.leaseId, input.leaseExpiresAt, input.id],
          );
          await db.query(
            "UPDATE upload_intents SET state = 'expired', revision = revision + 1 WHERE id = $1",
            [input.id],
          );
          return current(db, input);
        },
        false,
      );
    },
    async releaseQuotaAfterCleanup(input) {
      validateUploadLease(input);
      return transaction(
        input,
        async (db) => {
          const before = await current(db, input);
          if (before.state !== 'expired')
            throw new UploadIntentError('UPLOAD_CONFLICT');
          if (before.reservationState === 'released') {
            if (
              before.leaseId === input.leaseId &&
              before.leaseExpiresAt! > input.now
            ) {
              await db.query(
                'UPDATE upload_intent_details SET lease_id = NULL, lease_expires_at = NULL WHERE intent_id = $1',
                [input.id],
              );
              return current(db, input);
            }
            return before;
          }
          if (
            before.leaseId !== input.leaseId ||
            before.leaseExpiresAt! <= input.now
          )
            throw new UploadIntentError('UPLOAD_LEASE_LOST');
          await db.query(
            "UPDATE upload_intent_details SET reservation_state = 'released', lease_id = NULL, lease_expires_at = NULL WHERE intent_id = $1 AND reservation_state = 'reserved'",
            [input.id],
          );
          await db.query(
            'UPDATE project_upload_usage SET reserved_bytes = reserved_bytes - $1, reserved_count = reserved_count - 1 WHERE project_id = $2',
            [before.maxBytes, input.projectId],
          );
          await db.query(
            'UPDATE principal_upload_usage SET reserved_bytes = reserved_bytes - $1, reserved_count = reserved_count - 1 WHERE principal_id = $2',
            [before.maxBytes, input.principalId],
          );
          return current(db, input);
        },
        false,
      );
    },
  };
}
