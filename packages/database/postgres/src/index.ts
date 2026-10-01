import type { Pool, PoolClient } from 'pg';
export { createPostgresRateCounterStore } from './rate-limit.ts';
export { createPostgresAccountRegistrationStore } from './account-registration.ts';
export { createPostgresStaffEnrollmentStore } from './staff-enrollment.ts';
export { createPostgresAccountRecoveryStore } from './account-recovery.ts';
export { createPostgresPasskeyStores } from './passkey-store.ts';
export { createPostgresOAuthStores } from './oauth-store.ts';
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
  type CloseIssueIntent,
  type CreateIssueIntent,
  type EditIssueIntent,
  type IssueListQuery,
  type IssueMutationIntent,
  type IssueOperation,
  type IssueRepository,
  type MutationIdentity,
  type MutationOutcome,
  type SetIssueAssigneesIntent,
  type SetIssueLabelsIntent,
  type SetIssueMilestoneIntent,
  type SetIssueTypeIntent,
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

  /** The mutation snapshot every operation's receipt replays. */
  function outcomeOf(row: IssueRow): MutationOutcome {
    return {
      result: {
        id: row.id,
        projectId: row.project_id,
        number: row.number,
        revision: Number(row.revision),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      },
      replayed: false,
    };
  }

  /**
   * One atomic mutation per operation: the receipt insert, the conditional
   * aggregate write, the relation writes, the timeline event at the new
   * aggregate revision and the outbox row commit together, or nothing does.
   * Idempotent no-ops (same value already stored) return the current
   * snapshot without an event. Reference checks run inside the transaction;
   * taxonomy references must exist in this project, assignees must hold a
   * current project role, and a selected issue type must be enabled.
   */
  async function mutate(
    intent: IssueMutationIntent,
    operation: IssueOperation,
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
      const project = await db.query<{ status: string }>(
        'SELECT status FROM projects WHERE id = $1',
        [intent.projectId],
      );
      if (project.rows[0]?.status !== 'active')
        throw new DomainError('NOT_FOUND');
      let row: IssueRow | undefined;
      let metadata: Record<string, unknown> = { v: 1 };
      if (operation === 'issue.create') {
        const create = intent as CreateIssueIntent;
        if (create.typeId !== null) {
          const type = await db.query(
            'SELECT 1 FROM issue_types WHERE project_id = $1 AND id = $2 AND enabled = 1',
            [create.projectId, create.typeId],
          );
          if (type.rowCount === 0) throw new DomainError('INVALID_INPUT');
        }
        if (create.milestoneId !== null) {
          const milestone = await db.query(
            'SELECT 1 FROM milestones WHERE project_id = $1 AND id = $2',
            [create.projectId, create.milestoneId],
          );
          if (milestone.rowCount === 0) throw new DomainError('INVALID_INPUT');
        }
        if (create.labelIds.length > 0) {
          const labels = await db.query<{ id: string }>(
            'SELECT id FROM labels WHERE project_id = $1 AND id = ANY($2::uuid[])',
            [create.projectId, [...create.labelIds]],
          );
          if (labels.rowCount !== create.labelIds.length)
            throw new DomainError('INVALID_INPUT');
        }
        if (create.assigneeIds.length > 0) {
          const members = await db.query<{ principal_id: string }>(
            'SELECT principal_id FROM project_roles WHERE project_id = $1 AND principal_id = ANY($2::uuid[])',
            [create.projectId, [...create.assigneeIds]],
          );
          if (members.rowCount !== create.assigneeIds.length)
            throw new DomainError('INVALID_INPUT');
        }
        const allocated = await db.query<{ number: number }>(
          "UPDATE projects SET next_issue_number = next_issue_number + 1 WHERE id = $1 AND status = 'active' RETURNING next_issue_number - 1 AS number",
          [intent.projectId],
        );
        const number = allocated.rows[0]?.number;
        if (number === undefined) throw new DomainError('NOT_FOUND');
        const inserted = await db.query<IssueRow>(
          `INSERT INTO issues (id, project_id, number, title, body, type_id, milestone_id, author_id, created_at, updated_at, last_mutation_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10) RETURNING ${issueColumns}`,
          [
            create.id,
            create.projectId,
            number,
            create.title,
            create.body,
            create.typeId,
            create.milestoneId,
            create.principalId,
            create.now,
            create.mutationId,
          ],
        );
        row = inserted.rows[0];
        // Sequential by design: one transaction client cannot run parallel
        // statements, and the bounded cardinality (20 labels, 10 assignees)
        // keeps the loop short.
        for (const labelId of create.labelIds) {
          // eslint-disable-next-line no-await-in-loop
          await db.query(
            'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES ($1, $2, $3)',
            [create.projectId, create.id, labelId],
          );
        }
        for (const assigneeId of create.assigneeIds) {
          // eslint-disable-next-line no-await-in-loop
          await db.query(
            'INSERT INTO issue_assignees (project_id, issue_id, principal_id) VALUES ($1, $2, $3)',
            [create.projectId, create.id, assigneeId],
          );
        }
        metadata = { v: 1 };
      } else {
        const current = await db.query<IssueRow>(
          `SELECT ${issueColumns} FROM issues WHERE project_id = $1 AND id = $2 FOR UPDATE`,
          [intent.projectId, intent.id],
        );
        const existing = current.rows[0];
        if (!existing) throw new DomainError('NOT_FOUND');
        // validateIntent guarantees every non-create intent is conditional.
        const conditional = intent as EditIssueIntent;
        if (Number(existing.revision) !== conditional.expectedRevision)
          throw new DomainError('REVISION_CONFLICT');
        const sets =
          operation === 'issue.labels' || operation === 'issue.assignees';
        if (sets) {
          const oldIds = (
            await db.query<{ label_id: string } | { principal_id: string }>(
              operation === 'issue.labels'
                ? 'SELECT label_id FROM issue_labels WHERE project_id = $1 AND issue_id = $2'
                : 'SELECT principal_id FROM issue_assignees WHERE project_id = $1 AND issue_id = $2',
              [intent.projectId, intent.id],
            )
          ).rows.map((r) => ('label_id' in r ? r.label_id : r.principal_id));
          const setIntent = intent as
            | SetIssueLabelsIntent
            | SetIssueAssigneesIntent;
          const newIds = (
            'labelIds' in setIntent ? setIntent.labelIds : setIntent.assigneeIds
          ) as readonly string[];
          const added = newIds.filter((id) => !oldIds.includes(id));
          const removed = oldIds.filter((id) => !newIds.includes(id));
          if (added.length === 0 && removed.length === 0) {
            // No mutation: roll the speculative receipt back and return the
            // current snapshot without an event.
            await db.query('ROLLBACK');
            return outcomeOf(existing);
          }
          if (operation === 'issue.labels') {
            const labels = await db.query<{ id: string }>(
              'SELECT id FROM labels WHERE project_id = $1 AND id = ANY($2::uuid[])',
              [intent.projectId, [...newIds]],
            );
            if (labels.rowCount !== newIds.length)
              throw new DomainError('INVALID_INPUT');
          } else {
            const members = await db.query<{ principal_id: string }>(
              'SELECT principal_id FROM project_roles WHERE project_id = $1 AND principal_id = ANY($2::uuid[])',
              [intent.projectId, [...newIds]],
            );
            if (members.rowCount !== newIds.length)
              throw new DomainError('INVALID_INPUT');
          }
          metadata = { v: 1, added: added.length, removed: removed.length };
        } else if (operation === 'issue.type') {
          const typeIntent = intent as SetIssueTypeIntent;
          if (typeIntent.typeId !== null) {
            const type = await db.query(
              'SELECT 1 FROM issue_types WHERE project_id = $1 AND id = $2 AND enabled = 1',
              [intent.projectId, typeIntent.typeId],
            );
            if (type.rowCount === 0) throw new DomainError('INVALID_INPUT');
          }
          if ((existing.type_id ?? null) === typeIntent.typeId) {
            await db.query('ROLLBACK');
            return outcomeOf(existing);
          }
          metadata = { v: 1, typeId: typeIntent.typeId };
        } else if (operation === 'issue.milestone') {
          const milestoneIntent = intent as SetIssueMilestoneIntent;
          if (milestoneIntent.milestoneId !== null) {
            const milestone = await db.query(
              'SELECT 1 FROM milestones WHERE project_id = $1 AND id = $2',
              [intent.projectId, milestoneIntent.milestoneId],
            );
            if (milestone.rowCount === 0)
              throw new DomainError('INVALID_INPUT');
          }
          if ((existing.milestone_id ?? null) === milestoneIntent.milestoneId) {
            await db.query('ROLLBACK');
            return outcomeOf(existing);
          }
          metadata = { v: 1, milestoneId: milestoneIntent.milestoneId };
        } else if (operation === 'issue.close') {
          if (existing.state !== 'open')
            throw new DomainError('REVISION_CONFLICT');
          metadata = { v: 1, reason: (intent as CloseIssueIntent).reason };
        } else if (operation === 'issue.reopen') {
          if (existing.state !== 'closed')
            throw new DomainError('REVISION_CONFLICT');
        }
        const assignments: { text: string; values: unknown[] }[] = [];
        if (operation === 'issue.edit') {
          const edit = intent as EditIssueIntent;
          assignments.push({
            text: 'title = $1, body = $2',
            values: [edit.title, edit.body],
          });
        } else if (operation === 'issue.close') {
          const close = intent as CloseIssueIntent;
          assignments.push({
            text: "state = 'closed', close_reason = $1, closed_at = $2",
            values: [close.reason, intent.now],
          });
        } else if (operation === 'issue.reopen') {
          assignments.push({
            text: "state = 'open', close_reason = NULL, closed_at = NULL",
            values: [],
          });
        } else if (operation === 'issue.type') {
          assignments.push({
            text: 'type_id = $1',
            values: [(intent as SetIssueTypeIntent).typeId],
          });
        } else if (operation === 'issue.milestone') {
          assignments.push({
            text: 'milestone_id = $1',
            values: [(intent as SetIssueMilestoneIntent).milestoneId],
          });
        } else if (operation === 'issue.labels') {
          assignments.push({ text: '', values: [] });
        } else if (operation === 'issue.assignees') {
          assignments.push({ text: '', values: [] });
        }
        const assignment = assignments[0];
        const valueCount = assignment?.values.length ?? 0;
        const setClause =
          (assignment && assignment.text ? `${assignment.text}, ` : '') +
          `revision = revision + 1, updated_at = GREATEST(updated_at, $${valueCount + 1}), last_mutation_id = $${valueCount + 2}`;
        const updated = await db.query<IssueRow>(
          `UPDATE issues SET ${setClause} WHERE project_id = $${valueCount + 3} AND id = $${valueCount + 4} AND revision = $${valueCount + 5} RETURNING ${issueColumns}`,
          [
            ...(assignment?.values ?? []),
            intent.now,
            intent.mutationId,
            intent.projectId,
            intent.id,
            (intent as EditIssueIntent).expectedRevision,
          ],
        );
        row = updated.rows[0];
        if (!row) throw new DomainError('REVISION_CONFLICT');
        if (operation === 'issue.labels') {
          await db.query(
            'DELETE FROM issue_labels WHERE project_id = $1 AND issue_id = $2',
            [intent.projectId, intent.id],
          );
          // eslint-disable-next-line no-await-in-loop
          for (const labelId of (intent as SetIssueLabelsIntent).labelIds) {
            // eslint-disable-next-line no-await-in-loop
            await db.query(
              'INSERT INTO issue_labels (project_id, issue_id, label_id) VALUES ($1, $2, $3)',
              [intent.projectId, intent.id, labelId],
            );
          }
        } else if (operation === 'issue.assignees') {
          await db.query(
            'DELETE FROM issue_assignees WHERE project_id = $1 AND issue_id = $2',
            [intent.projectId, intent.id],
          );
          for (const principalId of (intent as SetIssueAssigneesIntent)
            .assigneeIds) {
            // eslint-disable-next-line no-await-in-loop
            await db.query(
              'INSERT INTO issue_assignees (project_id, issue_id, principal_id) VALUES ($1, $2, $3)',
              [intent.projectId, intent.id, principalId],
            );
          }
        }
      }
      if (!row) throw new Error('Mutation returned no aggregate');
      const result = {
        id: row.id,
        projectId: row.project_id,
        number: row.number,
        revision: Number(row.revision),
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at),
      };
      await db.query(
        'INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)',
        [
          intent.mutationId,
          intent.projectId,
          intent.id,
          Number(row.revision),
          intent.principalId,
          operation,
          intent.now,
          JSON.stringify(metadata),
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
      await db.query('ROLLBACK').catch(() => {});
      const concurrentReplay = await receipt(db, intent, operation);
      if (concurrentReplay) return concurrentReplay;
      throw error;
    } finally {
      db.release();
    }
  }
  return {
    createIssue: (intent) => mutate(intent, 'issue.create'),
    editIssue: (intent) => mutate(intent, 'issue.edit'),
    closeIssue: (intent) => mutate(intent, 'issue.close'),
    reopenIssue: (intent) => mutate(intent, 'issue.reopen'),
    setIssueLabels: (intent) => mutate(intent, 'issue.labels'),
    setIssueAssignees: (intent) => mutate(intent, 'issue.assignees'),
    setIssueType: (intent) => mutate(intent, 'issue.type'),
    setIssueMilestone: (intent) => mutate(intent, 'issue.milestone'),
    async getIssue(projectId, id, options) {
      assertId(projectId);
      assertId(id);
      const hidden =
        options?.includeHidden === true ? '' : " AND moderation = 'visible'";
      const { rows } = await pool.query<IssueRow>(
        `SELECT ${issueColumns} FROM issues WHERE project_id = $1 AND id = $2 AND deleted_at IS NULL${hidden}`,
        [projectId, id],
      );
      return rows[0] ? toIssue(rows[0]) : null;
    },
    async listIssues(query: IssueListQuery) {
      const { limit, cursor } = issuePageOptions(query);
      const values: (string | number)[] = [query.projectId];
      let where = 'project_id = $1 AND deleted_at IS NULL';
      if (query.includeHidden !== true) where += " AND moderation = 'visible'";
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
    async relations(projectId, issueIds) {
      assertId(projectId);
      if (issueIds.length === 0 || issueIds.length > 101)
        throw new DomainError('INVALID_INPUT');
      const labels = new Map<string, string[]>();
      const assignees = new Map<string, string[]>();
      for (const id of issueIds) {
        assertId(id);
        labels.set(id, []);
        assignees.set(id, []);
      }
      const labelRows = await pool
        .query<{ issue_id: string; label_id: string }>(
          'SELECT issue_id, label_id FROM issue_labels WHERE project_id = $1 AND issue_id = ANY($2::uuid[])',
          [projectId, [...issueIds]],
        )
        .then((result) => result.rows);
      for (const row of labelRows) labels.get(row.issue_id)?.push(row.label_id);
      const assigneeRows = await pool
        .query<{ issue_id: string; principal_id: string }>(
          'SELECT issue_id, principal_id FROM issue_assignees WHERE project_id = $1 AND issue_id = ANY($2::uuid[])',
          [projectId, [...issueIds]],
        )
        .then((result) => result.rows);
      for (const row of assigneeRows)
        assignees.get(row.issue_id)?.push(row.principal_id);
      return { labels, assignees };
    },
  };
}

export * from './key-registry.ts';
export { createPostgresAccountSessionStore } from './account-session.ts';
export { createPostgresProjectRoleStore } from './project-role-store.ts';
export { createPostgresPluginRegistryStore } from './plugin-registry.ts';
export { createPostgresPluginSettingsStore } from './plugin-settings.ts';
export { createPostgresPluginEventOutbox } from './plugin-events.ts';
export { createPostgresAccountAdministration } from './account-administration.ts';
export { createPostgresAuditRepository } from './audit.ts';
export { createPostgresProjectStore } from './projects.ts';
export { createPostgresTaxonomyStore } from './taxonomy.ts';
