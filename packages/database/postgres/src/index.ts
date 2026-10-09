import { createPostgresSearchBudgetStore } from './search-budget.ts';
import {
  SearchError,
  SEARCH_MINIMUM_BUDGET,
  searchAvailability,
} from '@hyperbug/application';
import { createPostgresSearchIndexStore } from './search-index.ts';
import {
  searchPageOptions,
  searchPage,
  type SearchStore,
} from '@hyperbug/application';
import { compilePostgresSearch } from './search.ts';
import { projectMarkdownText } from '@hyperbug/security/markdown';
import { resolvePostgresIssueFormDefaults } from './content-definitions.ts';
import { consumeFormAttachments } from './form-attachments.ts';
import type { Pool, PoolClient } from 'pg';
export { createPostgresRateCounterStore } from './rate-limit.ts';
export { createPostgresAccountRegistrationStore } from './account-registration.ts';
export { createPostgresStaffEnrollmentStore } from './staff-enrollment.ts';
export { createPostgresContentDefinitionStore } from './content-definitions.ts';
export { createPostgresAttachmentStore } from './attachments.ts';
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
  prepareIssueFormSubmission,
  assertActiveIssueFormVersion,
  normalizeIssueFormDefinition,
  IssueFormError,
  issuePageOptions,
  issuePage,
  replayReceipt,
  type CloseIssueIntent,
  type CreateIssueIntent,
  type EditIssueIntent,
  type IssueListQuery,
  type IssueMutationIntent,
  type IssueFormDefinition,
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
  body_text: string | null;
  body_text_version: string | null;
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
  bodyText: r.body_text,
  bodyTextVersion: r.body_text_version,
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
  'id, project_id, number, title, body_text, body_text_version, state, close_reason, type_id, milestone_id, moderation, deleted_at, author_id, revision, created_at, updated_at, closed_at';
const issueColumns = `${listColumns}, body`;

export function createPostgresRepository(pool: Pool): IssueRepository {
  async function receipt(
    db: Pool | PoolClient,
    intent: MutationIdentity,
    operation: string,
  ): Promise<MutationOutcome | null> {
    if (intent.persistReceipt === false) return null;
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
      // Lock before receipt FK checks: concurrent KEY SHARE-to-UPDATE
      // upgrades would otherwise deadlock on the project row.
      const project = await db.query<{ status: string }>(
        'SELECT status FROM projects WHERE id = $1' +
          (operation === 'issue.create' &&
          (intent as CreateIssueIntent).formSubmission
            ? ' FOR UPDATE'
            : ''),
        [intent.projectId],
      );
      if (project.rows[0]?.status !== 'active')
        throw new DomainError('NOT_FOUND');
      if (intent.persistReceipt !== false)
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
      let metadata: Record<string, unknown> = { v: 1 };
      if (operation === 'issue.create') {
        let create = intent as CreateIssueIntent;
        let formValues:
          | ReturnType<typeof prepareIssueFormSubmission>
          | undefined;
        let formDefinition: IssueFormDefinition | undefined;
        if (create.formSubmission) {
          // Project precedes the form lock, matching definition management.
          const { rows } = await db.query<{
            revision: number;
            enabled: number;
            definition: unknown;
          }>(
            'SELECT h.revision, h.enabled, v.definition FROM issue_forms h JOIN issue_form_versions v ON v.project_id = h.project_id AND v.form_id = h.id AND v.version = $3 WHERE h.project_id = $1 AND h.id = $2 FOR SHARE OF h',
            [
              create.projectId,
              create.formSubmission.formId,
              create.formSubmission.formVersion,
            ],
          );
          const form = rows[0];
          if (!form)
            throw new IssueFormError('FORM_VERSION_STALE', 'formVersion');
          assertActiveIssueFormVersion(
            form.enabled === 1,
            form.revision,
            create.formSubmission.formVersion,
          );
          const definition = normalizeIssueFormDefinition(
            form.definition,
            'canonical',
          );
          formDefinition = definition;
          formValues = prepareIssueFormSubmission(
            definition,
            create.formSubmission,
            create.body,
          );
          create = {
            ...create,
            ...(await resolvePostgresIssueFormDefaults(
              db,
              create.projectId,
              definition,
              true,
            )),
          };
          validateIntent(create, operation);
          const actor = await db.query<{ kind: string; status: string }>(
            'SELECT kind, status FROM principals WHERE id = $1 FOR SHARE',
            [create.principalId],
          );
          const member = await db.query(
            'SELECT 1 FROM project_roles WHERE project_id = $1 AND principal_id = $2 FOR SHARE',
            [create.projectId, create.principalId],
          );
          const visibility = await db.query<{ visibility: string }>(
            'SELECT visibility FROM projects WHERE id = $1',
            [create.projectId],
          );
          if (
            actor.rows[0]?.status !== 'active' ||
            (actor.rows[0].kind === 'staff'
              ? member.rowCount !== 1
              : visibility.rows[0]?.visibility !== 'public')
          )
            throw new IssueFormError('FORM_SUBMISSION_FORBIDDEN', 'principal');
        }
        const projection = projectMarkdownText(create.body);
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
          `INSERT INTO issues (id, project_id, number, title, body, type_id, milestone_id, author_id, created_at, updated_at, last_mutation_id, body_text, body_text_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12) RETURNING ${issueColumns}`,
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
            projection.text,
            projection.version,
          ],
        );
        row = inserted.rows[0];
        if (create.formSubmission && formValues && formDefinition) {
          await db.query(
            'INSERT INTO form_submissions (project_id, issue_id, form_id, form_version, "values", created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)',
            [
              create.projectId,
              create.id,
              create.formSubmission.formId,
              create.formSubmission.formVersion,
              JSON.stringify(formValues.values),
              create.now,
            ],
          );
          await consumeFormAttachments(
            db,
            create,
            formDefinition,
            formValues.attachmentIds,
          );
        }
        // One set-based insert per relation: the validated, bounded ID arrays
        // (20 labels, 10 assignees) unnest server-side in a single round trip.
        if (create.labelIds.length > 0)
          await db.query(
            'INSERT INTO issue_labels (project_id, issue_id, label_id) SELECT $1, $2, unnest($3::uuid[])',
            [create.projectId, create.id, create.labelIds],
          );
        if (create.assigneeIds.length > 0)
          await db.query(
            'INSERT INTO issue_assignees (project_id, issue_id, principal_id) SELECT $1, $2, unnest($3::uuid[])',
            [create.projectId, create.id, create.assigneeIds],
          );
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
          const projection = projectMarkdownText(edit.body);
          assignments.push({
            text: 'title = $1, body = $2, body_text = $3, body_text_version = $4',
            values: [
              edit.title,
              edit.body,
              projection.text,
              projection.version,
            ],
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
          const labelIds = (intent as SetIssueLabelsIntent).labelIds;
          if (labelIds.length > 0)
            await db.query(
              'INSERT INTO issue_labels (project_id, issue_id, label_id) SELECT $1, $2, unnest($3::uuid[])',
              [intent.projectId, intent.id, labelIds],
            );
        } else if (operation === 'issue.assignees') {
          await db.query(
            'DELETE FROM issue_assignees WHERE project_id = $1 AND issue_id = $2',
            [intent.projectId, intent.id],
          );
          const assigneeIds = (intent as SetIssueAssigneesIntent).assigneeIds;
          if (assigneeIds.length > 0)
            await db.query(
              'INSERT INTO issue_assignees (project_id, issue_id, principal_id) SELECT $1, $2, unnest($3::uuid[])',
              [intent.projectId, intent.id, assigneeIds],
            );
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
      if (intent.persistReceipt !== false)
        await db.query(
          'UPDATE mutation_receipts SET result = $1 WHERE id = $2',
          [JSON.stringify(result), intent.mutationId],
        );
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
    async issueVisible(projectId, id, options) {
      assertId(projectId);
      assertId(id);
      const hidden =
        options?.includeHidden === true ? '' : " AND moderation = 'visible'";
      const { rowCount } = await pool.query(
        `SELECT 1 FROM issues WHERE project_id = $1 AND id = $2 AND deleted_at IS NULL${hidden}`,
        [projectId, id],
      );
      return (rowCount ?? 0) > 0;
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
export {
  createPostgresCommentStore,
  createPostgresReactionStore,
  createPostgresTimelineStore,
} from './comments.ts';

export { createPostgresContentProjectionStore } from './content-projections.ts';
export { createPostgresUploadIntentStore } from './upload-intents.ts';
export { createPostgresUploadLegacyInventoryStore } from './upload-legacy-inventory.ts';
export { createPostgresUploadLegacyRecoveryStore } from './upload-legacy-recovery.ts';

export { createPostgresExpiredCleanupStore } from './expired-cleanup.ts';

export function createPostgresSearchStore(db: Pool): SearchStore {
  const repository = createPostgresRepository(db);
  return {
    async search(query) {
      try {
        const options = await searchPageOptions(query);
        const compiled = compilePostgresSearch(query, options, listColumns);
        if (
          query.tier === 'cloudflare-minimum' &&
          !(await createPostgresSearchBudgetStore(db).reserve({
            reads: SEARCH_MINIMUM_BUDGET.searchReads,
            writes: SEARCH_MINIMUM_BUDGET.searchWrites,
            nowMs: Date.now(),
          }))
        )
          throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
        if (!(await createPostgresSearchIndexStore(db).ready(query)))
          throw new SearchError('SEARCH_INDEX_INCOMPLETE');
        const rows = (
          await db.query<IssueRow & { search_overflow: number }>(
            compiled.sql,
            compiled.values,
          )
        ).rows;
        if (rows.some((row) => row.search_overflow === 1))
          throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
        const page = searchPage(query, options, rows.map(toListItem));
        const relations = page.items.length
          ? await repository.relations(
              query.projectId,
              page.items.map((row) => row.id),
            )
          : {
              labels: new Map<string, string[]>(),
              assignees: new Map<string, string[]>(),
            };
        return { ...page, relations };
      } catch (error) {
        throw searchAvailability(error);
      }
    },
  };
}

export { createPostgresSearchIndexStore } from './search-index.ts';

export { createPostgresSearchBudgetStore } from './search-budget.ts';

export { createPostgresAsyncStore } from './async-processing.ts';
