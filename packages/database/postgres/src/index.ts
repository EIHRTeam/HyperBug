import type { Pool, PoolClient } from 'pg';
import {
  DomainError,
  assertId,
  type Issue,
  type IssueListItem,
} from '@hyperbug/domain';
import {
  validateIntent,
  issuePageOptions,
  issuePage,
  replayReceipt,
  type CreateIssueIntent,
  type EditIssueIntent,
  type IssueListQuery,
  type IssueRepository,
  type MutationIdentity,
  type MutationOutcome,
} from '@hyperbug/application';
interface IssueRow {
  id: string;
  project_id: string;
  number: number;
  title: string;
  body: string;
  state: Issue['state'];
  close_reason: Issue['closeReason'];
  type_id: string | null;
  milestone_id: string | null;
  moderation: Issue['moderation'];
  deleted_at: string | null;
  author_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}
const toListItem = (r: Omit<IssueRow, 'body'>): IssueListItem => ({
  id: r.id,
  projectId: r.project_id,
  number: r.number,
  title: r.title,
  state: r.state,
  closeReason: r.close_reason,
  typeId: r.type_id,
  milestoneId: r.milestone_id,
  moderation: r.moderation,
  deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
  authorId: r.author_id,
  revision: r.revision,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  closedAt: r.closed_at === null ? null : Number(r.closed_at),
});
const toIssue = (r: IssueRow): Issue => ({ ...toListItem(r), body: r.body });
const listColumns =
  'id, project_id, number, title, state, close_reason, type_id, milestone_id, moderation, deleted_at, author_id, revision, created_at, updated_at, closed_at';
const issueColumns = `${listColumns}, body`;

export function createPostgresRepository(pool: Pool): IssueRepository {
  async function receipt(
    db: Pool | PoolClient,
    intent: MutationIdentity,
    operation: string,
  ): Promise<MutationOutcome | null> {
    const { rows } = await db.query<{
      payload_hash: string;
      expires_at: string;
      result: unknown;
    }>(
      'SELECT payload_hash, expires_at, result FROM mutation_receipts WHERE principal_id = $1 AND project_id = $2 AND operation = $3 AND key_hash = $4',
      [intent.principalId, intent.projectId, operation, intent.keyHash],
    );
    const row = rows[0];
    return replayReceipt(
      row
        ? {
            payloadHash: row.payload_hash,
            expiresAt: Number(row.expires_at),
            result: row.result,
          }
        : null,
      intent,
    );
  }
  async function mutate(
    intent: CreateIssueIntent | EditIssueIntent,
    operation: 'issue.create' | 'issue.edit',
  ): Promise<MutationOutcome> {
    validateIntent(intent, operation);
    const replay = await receipt(pool, intent, operation);
    if (replay) return replay;
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(
        "INSERT INTO mutation_receipts (id, principal_id, project_id, operation, key_hash, payload_hash, result, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, 'null'::jsonb, $7, $8)",
        [
          intent.mutationId,
          intent.principalId,
          intent.projectId,
          operation,
          intent.keyHash,
          intent.payloadHash,
          intent.now,
          intent.expiresAt,
        ],
      );
      let row: IssueRow | undefined;
      if ('expectedRevision' in intent) {
        const updated = await db.query<IssueRow>(
          `UPDATE issues SET title = $1, body = $2, revision = revision + 1, updated_at = greatest(updated_at, $3), last_mutation_id = $4 WHERE project_id = $5 AND id = $6 AND revision = $7 AND EXISTS (SELECT 1 FROM projects WHERE id = $5 AND status = 'active') RETURNING ${issueColumns}`,
          [
            intent.title,
            intent.body,
            intent.now,
            intent.mutationId,
            intent.projectId,
            intent.id,
            intent.expectedRevision,
          ],
        );
        row = updated.rows[0];
        if (!row) {
          const existing = await db.query(
            'SELECT id FROM issues WHERE project_id = $1 AND id = $2',
            [intent.projectId, intent.id],
          );
          throw new DomainError(
            existing.rowCount ? 'REVISION_CONFLICT' : 'NOT_FOUND',
          );
        }
      } else {
        const allocated = await db.query<{ number: number }>(
          "UPDATE projects SET next_issue_number = next_issue_number + 1 WHERE id = $1 AND status = 'active' RETURNING next_issue_number - 1 AS number",
          [intent.projectId],
        );
        const number = allocated.rows[0]?.number;
        if (number === undefined) throw new DomainError('NOT_FOUND');
        const inserted = await db.query<IssueRow>(
          `INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8) RETURNING ${issueColumns}`,
          [
            intent.id,
            intent.projectId,
            number,
            intent.title,
            intent.body,
            intent.principalId,
            intent.now,
            intent.mutationId,
          ],
        );
        row = inserted.rows[0];
      }
      if (!row) throw new Error('Mutation returned no aggregate');
      const result = {
        id: row.id,
        projectId: row.project_id,
        number: row.number,
        revision: row.revision,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      };
      await db.query(
        "INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)",
        [
          intent.mutationId,
          intent.projectId,
          intent.id,
          row.revision,
          intent.principalId,
          operation,
          intent.now,
        ],
      );
      if (intent.auditAction)
        await db.query(
          "INSERT INTO audit_events (id, project_id, actor_id, action, target_id, result, request_id, created_at, metadata) VALUES ($1, $2, $3, $4, $5, 'success', $6, $7, '{}'::jsonb)",
          [
            intent.mutationId,
            intent.projectId,
            intent.principalId,
            intent.auditAction,
            intent.id,
            intent.requestId,
            intent.now,
          ],
        );
      await db.query(
        'INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
        [
          intent.mutationId,
          intent.projectId,
          intent.id,
          operation,
          JSON.stringify({ issueId: intent.id, mutationId: intent.mutationId }),
          intent.now,
        ],
      );
      await db.query('UPDATE mutation_receipts SET result = $1 WHERE id = $2', [
        JSON.stringify(result),
        intent.mutationId,
      ]);
      await db.query('COMMIT');
      return { result, replayed: false };
    } catch (error) {
      await db.query('ROLLBACK');
      const concurrentReplay = await receipt(db, intent, operation);
      if (concurrentReplay) return concurrentReplay;
      const project = await db.query<{ status: string }>(
        'SELECT status FROM projects WHERE id = $1',
        [intent.projectId],
      );
      if (project.rows[0]?.status !== 'active')
        throw new DomainError('NOT_FOUND');
      throw error;
    } finally {
      db.release();
    }
  }
  return {
    createIssue: (intent) => mutate(intent, 'issue.create'),
    editIssue: (intent) => mutate(intent, 'issue.edit'),
    async getIssue(projectId, id) {
      assertId(projectId);
      assertId(id);
      const { rows } = await pool.query<IssueRow>(
        `SELECT ${issueColumns} FROM issues WHERE project_id = $1 AND id = $2`,
        [projectId, id],
      );
      return rows[0] ? toIssue(rows[0]) : null;
    },
    async listIssues(query: IssueListQuery) {
      const { limit, cursor } = issuePageOptions(query);
      const values: (string | number)[] = [query.projectId];
      let where = 'project_id = $1';
      if (query.state !== undefined) {
        values.push(query.state);
        where += ` AND state = $${values.length}`;
      }
      if (cursor) {
        values.push(cursor.time, cursor.id);
        where += ` AND (created_at, id) < ($${values.length - 1}, $${values.length}::uuid)`;
      }
      values.push(limit + 1);
      const { rows } = await pool.query<IssueRow>(
        `SELECT ${listColumns} FROM issues WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
        values,
      );
      return issuePage(query, rows.map(toListItem));
    },
  };
}
