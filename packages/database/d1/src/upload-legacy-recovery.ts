import type { D1Database } from '@cloudflare/workers-types';
import {
  UploadIntentError,
  validateUploadScope,
  validateUploadLease,
  canonicalUploadLegacyDecision,
  uploadLegacyDecisionJson,
  validateUploadLegacyRecoveryClaim,
  assertUploadLegacyRecoveryDecision,
  assertUploadLegacyRecoveryRelease,
  uploadLegacyRecoveryAccounting,
  validateUploadLegacyRecoveryQuery,
  uploadLegacyRecoveryPage,
  type UploadLegacyRecoveryRecord,
  type UploadLegacyRecoveryStore,
  type UploadLegacyRecoveryDecision,
  type UploadScope,
} from '@hyperbug/application';

const columns = 'id = ? AND project_id = ? AND principal_id = ?';
/** Additive private operator port; no User authorization or fabricated current lifecycle. */
export function createD1UploadLegacyRecoveryStore(
  db: D1Database,
): UploadLegacyRecoveryStore {
  const get = async (
    scope: UploadScope,
  ): Promise<UploadLegacyRecoveryRecord | null> => {
    validateUploadScope(scope);
    const row = await db
      .prepare(
        'SELECT * FROM upload_legacy_recoveries WHERE intent_id = ? AND project_id = ? AND principal_id = ?',
      )
      .bind(scope.id, scope.projectId, scope.principalId)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return {
      id: scope.id,
      projectId: scope.projectId,
      principalId: scope.principalId,
      decision: canonicalUploadLegacyDecision(
        JSON.parse(String(row.decision)) as UploadLegacyRecoveryDecision,
      ),
      state: row.state as UploadLegacyRecoveryRecord['state'],
      revision: Number(row.revision),
      leaseId: row.lease_id as string | null,
      leaseExpiresAt:
        row.lease_expires_at === null ? null : Number(row.lease_expires_at),
      createdAt: Number(row.created_at),
      releasedAt: row.released_at === null ? null : Number(row.released_at),
    };
  };
  // A SELECT witness also fails when the conditional mutation inserted/updated zero rows.
  const witness = () =>
    db.prepare(
      "SELECT json(CASE WHEN changes() = 1 THEN 'true' ELSE 'invalid' END) AS witnessed",
    );
  const current = async (scope: UploadScope) => {
    const record = await get(scope);
    if (!record) throw new UploadIntentError('UPLOAD_NOT_FOUND');
    return record;
  };
  return {
    get,
    async claim(input) {
      validateUploadLegacyRecoveryClaim(input);
      const before = await get(input),
        decision = uploadLegacyDecisionJson(input.decision);
      if (before) assertUploadLegacyRecoveryDecision(before, input);
      const snapshot = input.decision.snapshot;
      try {
        if (before) {
          await db.batch([
            db
              .prepare(
                'UPDATE upload_legacy_recoveries SET lease_id = ?, lease_expires_at = ?, revision = revision + 1 WHERE intent_id = ? AND project_id = ? AND principal_id = ? AND revision = ? AND decision = ? AND (lease_id IS NULL OR lease_expires_at <= ? OR lease_id = ?)',
              )
              .bind(
                input.leaseId,
                input.leaseExpiresAt,
                input.id,
                input.projectId,
                input.principalId,
                before.revision,
                decision,
                input.now,
                input.leaseId,
              ),
            witness(),
          ]);
        } else {
          await db.batch([
            db
              .prepare(
                `INSERT INTO upload_legacy_recoveries (intent_id, project_id, principal_id, decision_id, decision, state, lease_id, lease_expires_at, created_at) SELECT id, project_id, principal_id, ?, ?, 'deleting', ?, ?, ? FROM upload_intents WHERE ${columns} AND revision = ? AND state = ? AND object_key = ? AND media_type = ? AND max_bytes = ? AND created_at = ? AND expires_at = ? AND actual_bytes IS ? AND verified_object_version IS ? AND verified_checksum IS ? AND NOT EXISTS (SELECT 1 FROM upload_intent_details d WHERE d.intent_id = upload_intents.id) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = upload_intents.id)`,
              )
              .bind(
                input.decision.decisionId,
                decision,
                input.leaseId,
                input.leaseExpiresAt,
                input.now,
                input.id,
                input.projectId,
                input.principalId,
                snapshot.revision,
                snapshot.state,
                snapshot.objectKey,
                snapshot.contentType,
                snapshot.maxBytes,
                snapshot.createdAt,
                snapshot.expiresAt,
                snapshot.actualBytes,
                snapshot.objectVersion,
                snapshot.checksum,
              ),
            witness(),
          ]);
        }
      } catch {
        const after = await get(input);
        if (
          after &&
          after.leaseId === input.leaseId &&
          after.leaseExpiresAt === input.leaseExpiresAt &&
          uploadLegacyDecisionJson(after.decision) === decision
        )
          return after;
        throw new UploadIntentError('UPLOAD_CONFLICT');
      }
      return current(input);
    },
    async release(input) {
      validateUploadLease(input);
      const before = await current(input);
      assertUploadLegacyRecoveryRelease(before, input);
      if (before.state === 'released' && before.leaseId === null) return before;
      const amount = uploadLegacyRecoveryAccounting(before.decision);
      const statements = [
        db
          .prepare(
            "UPDATE upload_legacy_recoveries SET state = 'released', released_at = coalesce(released_at, ?), lease_id = NULL, lease_expires_at = NULL, revision = revision + 1 WHERE intent_id = ? AND project_id = ? AND principal_id = ? AND revision = ? AND lease_id = ? AND lease_expires_at > ?",
          )
          .bind(
            input.now,
            input.id,
            input.projectId,
            input.principalId,
            before.revision,
            input.leaseId,
            input.now,
          ),
        witness(),
      ];
      if (before.state !== 'released') {
        for (const [table, key, value] of [
          ['project_upload_usage', 'project_id', input.projectId],
          ['principal_upload_usage', 'principal_id', input.principalId],
        ] as const) {
          statements.push(
            db
              .prepare(
                `UPDATE ${table} SET reserved_bytes = reserved_bytes - ?, used_bytes = used_bytes - ?, reserved_count = reserved_count - ? WHERE ${key} = ? AND reserved_bytes >= ? AND used_bytes >= ? AND reserved_count >= ?`,
              )
              .bind(
                amount.reservedBytes,
                amount.usedBytes,
                amount.reservedCount,
                value,
                amount.reservedBytes,
                amount.usedBytes,
                amount.reservedCount,
              ),
            witness(),
          );
        }
      }
      try {
        await db.batch(statements);
      } catch {
        const after = await current(input);
        if (after.state === 'released' && after.leaseId === null) return after;
        throw new UploadIntentError('UPLOAD_LEASE_LOST');
      }
      return current(input);
    },
    async select(input) {
      validateUploadLegacyRecoveryQuery(input);
      const rows = await db
        .prepare(
          'SELECT intent_id AS id, project_id AS projectId, principal_id AS principalId, lease_expires_at AS leaseExpiresAt FROM upload_legacy_recoveries WHERE project_id = ? AND intent_id > ? ORDER BY intent_id LIMIT ?',
        )
        .bind(
          input.projectId,
          input.after ?? '00000000-0000-0000-0000-000000000000',
          input.limit + 1,
        )
        .all<UploadScope & { leaseExpiresAt: number | null }>();
      return uploadLegacyRecoveryPage(input, rows.results);
    },
  };
}
