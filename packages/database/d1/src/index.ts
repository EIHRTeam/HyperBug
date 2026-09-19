import type { D1Database } from '@cloudflare/workers-types';
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
  deleted_at: number | null;
  author_id: string;
  revision: number;
  created_at: number;
  updated_at: number;
  closed_at: number | null;
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
  deletedAt: r.deleted_at,
  authorId: r.author_id,
  revision: r.revision,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  closedAt: r.closed_at,
});
const toIssue = (r: IssueRow): Issue => ({ ...toListItem(r), body: r.body });
const listColumns =
  'id, project_id, number, title, state, close_reason, type_id, milestone_id, moderation, deleted_at, author_id, revision, created_at, updated_at, closed_at';
const issueColumns = `${listColumns}, body`;

/** D1 SQL and bindings stay entirely in this adapter. Authorization precedes these intents. */
export function createD1Repository(db: D1Database): IssueRepository {
  async function receipt(
    intent: MutationIdentity,
    operation: string,
  ): Promise<MutationOutcome | null> {
    const row = await db
      .prepare(
        'SELECT payload_hash, expires_at, result FROM mutation_receipts WHERE principal_id = ? AND project_id = ? AND operation = ? AND key_hash = ?',
      )
      .bind(intent.principalId, intent.projectId, operation, intent.keyHash)
      .first<{ payload_hash: string; expires_at: number; result: string }>();
    return replayReceipt(
      row
        ? {
            payloadHash: row.payload_hash,
            expiresAt: row.expires_at,
            result: JSON.parse(row.result) as unknown,
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
    const replay = await receipt(intent, operation);
    if (replay) return replay;
    const statements = [
      db
        .prepare(
          "INSERT INTO mutation_receipts (id, principal_id, project_id, operation, key_hash, payload_hash, result, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, 'null', ?, ?)",
        )
        .bind(
          intent.mutationId,
          intent.principalId,
          intent.projectId,
          operation,
          intent.keyHash,
          intent.payloadHash,
          intent.now,
          intent.expiresAt,
        ),
    ];
    if ('expectedRevision' in intent) {
      statements.push(
        db
          .prepare(
            'UPDATE issues SET title = ?, body = ?, revision = revision + 1, updated_at = max(updated_at, ?), last_mutation_id = ? WHERE project_id = ? AND id = ? AND revision = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND status = ?)',
          )
          .bind(
            intent.title,
            intent.body,
            intent.now,
            intent.mutationId,
            intent.projectId,
            intent.id,
            intent.expectedRevision,
            intent.projectId,
            'active',
          ),
      );
    } else {
      statements.push(
        db
          .prepare(
            "UPDATE projects SET next_issue_number = next_issue_number + 1 WHERE id = ? AND status = 'active'",
          )
          .bind(intent.projectId),
      );
      statements.push(
        db
          .prepare(
            "INSERT INTO issues (id, project_id, number, title, body, author_id, created_at, updated_at, last_mutation_id) VALUES (?, ?, (SELECT next_issue_number - 1 FROM projects WHERE id = ? AND status = 'active'), ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            intent.id,
            intent.projectId,
            intent.projectId,
            intent.title,
            intent.body,
            intent.principalId,
            intent.now,
            intent.now,
            intent.mutationId,
          ),
      );
    }
    // VALUES always attempts a row. A missing conditional-write witness becomes NULL,
    // violates aggregate_revision NOT NULL and rolls the entire D1 batch back.
    statements.push(
      db
        .prepare(
          "INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES (?, ?, ?, (SELECT revision FROM issues WHERE project_id = ? AND id = ? AND last_mutation_id = ?), ?, ?, ?, '{}')",
        )
        .bind(
          intent.mutationId,
          intent.projectId,
          intent.id,
          intent.projectId,
          intent.id,
          intent.mutationId,
          intent.principalId,
          operation,
          intent.now,
        ),
    );
    if (intent.auditAction)
      statements.push(
        db
          .prepare(
            "INSERT INTO audit_events (id, project_id, actor_id, action, target_id, result, request_id, created_at, metadata) VALUES (?, ?, ?, ?, ?, 'success', ?, ?, '{}')",
          )
          .bind(
            intent.mutationId,
            intent.projectId,
            intent.principalId,
            intent.auditAction,
            intent.id,
            intent.requestId,
            intent.now,
          ),
      );
    statements.push(
      db
        .prepare(
          "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES (?, ?, ?, ?, json_object('issueId', ?, 'mutationId', ?), ?, ?)",
        )
        .bind(
          intent.mutationId,
          intent.projectId,
          intent.id,
          operation,
          intent.id,
          intent.mutationId,
          intent.now,
          intent.now,
        ),
    );
    statements.push(
      db
        .prepare(
          "UPDATE mutation_receipts SET result = (SELECT json_object('id', id, 'projectId', project_id, 'number', number, 'revision', revision, 'createdAt', created_at, 'updatedAt', updated_at) FROM issues WHERE id = ? AND project_id = ? AND last_mutation_id = ?) WHERE id = ?",
        )
        .bind(
          intent.id,
          intent.projectId,
          intent.mutationId,
          intent.mutationId,
        ),
    );
    try {
      await db.batch(statements);
    } catch (error) {
      // A competing identical request may have won the unique receipt scope.
      const concurrentReplay = await receipt(intent, operation);
      if (concurrentReplay) return concurrentReplay;
      const project = await db
        .prepare('SELECT status FROM projects WHERE id = ?')
        .bind(intent.projectId)
        .first<{ status: string }>();
      if (project?.status !== 'active') throw new DomainError('NOT_FOUND');
      if (
        'expectedRevision' in intent &&
        error instanceof Error &&
        error.message.includes('timeline_events.aggregate_revision')
      ) {
        const issue = await db
          .prepare('SELECT id FROM issues WHERE project_id = ? AND id = ?')
          .bind(intent.projectId, intent.id)
          .first();
        throw new DomainError(issue ? 'REVISION_CONFLICT' : 'NOT_FOUND');
      }
      throw error;
    }
    const result = await receipt(intent, operation);
    if (!result) throw new Error('Committed mutation receipt is missing');
    return { ...result, replayed: false };
  }
  return {
    createIssue: (intent) => mutate(intent, 'issue.create'),
    editIssue: (intent) => mutate(intent, 'issue.edit'),
    async getIssue(projectId, id) {
      assertId(projectId);
      assertId(id);
      const row = await db
        .prepare(
          `SELECT ${issueColumns} FROM issues WHERE project_id = ? AND id = ?`,
        )
        .bind(projectId, id)
        .first<IssueRow>();
      return row ? toIssue(row) : null;
    },
    async listIssues(query: IssueListQuery) {
      const { limit, cursor } = issuePageOptions(query);
      const values: (string | number)[] = [query.projectId];
      let where = 'project_id = ?';
      if (query.state !== undefined) {
        where += ' AND state = ?';
        values.push(query.state);
      }
      if (cursor) {
        where += ' AND (created_at, id) < (?, ?)';
        values.push(cursor.time, cursor.id);
      }
      const rows = await db
        .prepare(
          `SELECT ${listColumns} FROM issues WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT ?`,
        )
        .bind(...values, limit + 1)
        .all<IssueRow>();
      return issuePage(query, rows.results.map(toListItem));
    },
  };
}
