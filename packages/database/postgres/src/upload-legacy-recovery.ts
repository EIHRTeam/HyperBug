import type { Pool, PoolClient } from 'pg';
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

/** Private operator port; project-first locks also serialize guarded legacy reference writers. */
export function createPostgresUploadLegacyRecoveryStore(
  pool: Pool,
): UploadLegacyRecoveryStore {
  const get = async (
    scope: UploadScope,
    db: Pool | PoolClient = pool,
  ): Promise<UploadLegacyRecoveryRecord | null> => {
    validateUploadScope(scope);
    const row = (
      await db.query(
        'SELECT * FROM upload_legacy_recoveries WHERE intent_id = $1 AND project_id = $2 AND principal_id = $3' +
          (db === pool ? '' : ' FOR UPDATE'),
        [scope.id, scope.projectId, scope.principalId],
      )
    ).rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: scope.id,
      projectId: scope.projectId,
      principalId: scope.principalId,
      decision: canonicalUploadLegacyDecision(
        row.decision as UploadLegacyRecoveryDecision,
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
  const transaction = async <T>(
    scope: UploadScope,
    work: (db: PoolClient) => Promise<T>,
  ): Promise<T> => {
    const db = await pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await db.query("SET LOCAL statement_timeout = '1s'");
      const project = await db.query(
        'SELECT id FROM projects WHERE id = $1 FOR UPDATE',
        [scope.projectId],
      );
      const principal = await db.query(
        'SELECT id FROM principals WHERE id = $1 FOR UPDATE',
        [scope.principalId],
      );
      if (!project.rowCount || !principal.rowCount)
        throw new UploadIntentError('UPLOAD_NOT_FOUND');
      const result = await work(db);
      await db.query('COMMIT');
      return result;
    } catch (error) {
      await db.query('ROLLBACK');
      if (error instanceof UploadIntentError) throw error;
      throw new UploadIntentError('UPLOAD_CONFLICT');
    } finally {
      db.release();
    }
  };
  const current = async (scope: UploadScope, db: PoolClient) => {
    const record = await get(scope, db);
    if (!record) throw new UploadIntentError('UPLOAD_NOT_FOUND');
    return record;
  };
  return {
    get: (scope) => get(scope),
    async claim(input) {
      validateUploadLegacyRecoveryClaim(input);
      const decision = uploadLegacyDecisionJson(input.decision),
        snapshot = input.decision.snapshot;
      return transaction(input, async (db) => {
        const before = await get(input, db);
        if (before) {
          assertUploadLegacyRecoveryDecision(before, input);
          await db.query(
            'UPDATE upload_legacy_recoveries SET lease_id = $1, lease_expires_at = $2, revision = revision + 1 WHERE intent_id = $3',
            [input.leaseId, input.leaseExpiresAt, input.id],
          );
        } else {
          const row = await db.query(
            'SELECT id FROM upload_intents i WHERE id = $1 AND project_id = $2 AND principal_id = $3 AND revision = $4 AND state = $5 AND object_key = $6 AND media_type = $7 AND max_bytes = $8 AND created_at = $9 AND expires_at = $10 AND actual_bytes IS NOT DISTINCT FROM $11::bigint AND verified_object_version IS NOT DISTINCT FROM $12::text AND verified_checksum IS NOT DISTINCT FROM $13::text AND NOT EXISTS (SELECT 1 FROM upload_intent_details d WHERE d.intent_id = i.id) AND NOT EXISTS (SELECT 1 FROM attachments a WHERE a.upload_intent_id = i.id) FOR UPDATE',
            [
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
            ],
          );
          if (!row.rowCount) throw new UploadIntentError('UPLOAD_CONFLICT');
          await db.query(
            "INSERT INTO upload_legacy_recoveries (intent_id,project_id,principal_id,decision_id,decision,state,lease_id,lease_expires_at,created_at) VALUES ($1,$2,$3,$4,$5::jsonb,'deleting',$6,$7,$8)",
            [
              input.id,
              input.projectId,
              input.principalId,
              input.decision.decisionId,
              decision,
              input.leaseId,
              input.leaseExpiresAt,
              input.now,
            ],
          );
        }
        return current(input, db);
      });
    },
    async release(input) {
      validateUploadLease(input);
      return transaction(input, async (db) => {
        const before = await current(input, db);
        assertUploadLegacyRecoveryRelease(before, input);
        if (before.state === 'released' && before.leaseId === null)
          return before;
        if (before.state !== 'released') {
          const amount = uploadLegacyRecoveryAccounting(before.decision);
          for (const [table, key, value] of [
            ['project_upload_usage', 'project_id', input.projectId],
            ['principal_upload_usage', 'principal_id', input.principalId],
          ] as const) {
            // eslint-disable-next-line no-await-in-loop -- Fixed project/principal accounting lock order.
            const updated = await db.query(
              `UPDATE ${table} SET reserved_bytes = reserved_bytes - $1, used_bytes = used_bytes - $2, reserved_count = reserved_count - $3 WHERE ${key} = $4 AND reserved_bytes >= $1 AND used_bytes >= $2 AND reserved_count >= $3`,
              [
                amount.reservedBytes,
                amount.usedBytes,
                amount.reservedCount,
                value,
              ],
            );
            if (!updated.rowCount)
              throw new UploadIntentError('UPLOAD_CONFLICT');
          }
        }
        await db.query(
          "UPDATE upload_legacy_recoveries SET state = 'released', released_at = coalesce(released_at,$1), lease_id = NULL, lease_expires_at = NULL, revision = revision + 1 WHERE intent_id = $2",
          [input.now, input.id],
        );
        return current(input, db);
      });
    },
    async select(input) {
      validateUploadLegacyRecoveryQuery(input);
      const rows = await pool.query<
        UploadScope & { leaseExpiresAt: string | null }
      >(
        'SELECT intent_id AS id, project_id AS "projectId", principal_id AS "principalId", lease_expires_at AS "leaseExpiresAt" FROM upload_legacy_recoveries WHERE project_id = $1 AND intent_id > $2 ORDER BY intent_id LIMIT $3',
        [
          input.projectId,
          input.after ?? '00000000-0000-0000-0000-000000000000',
          input.limit + 1,
        ],
      );
      return uploadLegacyRecoveryPage(
        input,
        rows.rows.map((row) => ({
          ...row,
          leaseExpiresAt:
            row.leaseExpiresAt === null ? null : Number(row.leaseExpiresAt),
        })),
      );
    },
  };
}
