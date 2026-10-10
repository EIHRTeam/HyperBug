import { searchMeter } from './search-meter.ts';
import { createD1SearchBudgetStore } from './search-budget.ts';
import {
  SearchError,
  SEARCH_MINIMUM_BUDGET,
  searchAvailability,
} from '@hyperbug/application';
import { createD1SearchIndexStore } from './search-index.ts';
import {
  searchPageOptions,
  searchPage,
  type SearchStore,
} from '@hyperbug/application';
import { compileD1Search } from './search.ts';
import { projectMarkdownText } from '@hyperbug/security/markdown';
import type { D1Database } from '@cloudflare/workers-types';
export { createD1RateCounterStore } from './rate-limit.ts';
export { createD1AccountLockoutStore } from './account-lockout.ts';
export { createD1AccountRegistrationStore } from './account-registration.ts';
export { createD1AccountSessionStore } from './account-session.ts';
export { createD1StaffEnrollmentStore } from './staff-enrollment.ts';
export { createD1AccountRecoveryStore } from './account-recovery.ts';
export { createD1PasskeyStores } from './passkey-store.ts';
export { createD1OAuthStores } from './oauth-store.ts';
export { createD1AuditRepository } from './audit.ts';
export { createD1ProjectRoleStore } from './project-role-store.ts';
export { createD1PluginRegistryStore } from './plugin-registry.ts';
export { createD1PluginSettingsStore } from './plugin-settings.ts';
export { createD1PluginEventOutbox } from './plugin-events.ts';
export { createD1AccountAdministration } from './account-administration.ts';
export { createD1ContentDefinitionStore } from './content-definitions.ts';
export { createD1AttachmentStore } from './attachments.ts';
import { createD1ContentDefinitionStore } from './content-definitions.ts';
import { formAttachmentStatements } from './form-attachments.ts';
import {
  DomainError,
  assertId,
  type Issue,
  type IssueListItem,
} from '@hyperbug/domain';
import {
  validateIntent,
  prepareIssueFormSubmission,
  IssueFormError,
  nameKeyOf,
  type IssueFormDefinition,
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
  body_text: string | null;
  body_text_version: string | null;
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
  bodyText: r.body_text,
  bodyTextVersion: r.body_text_version,
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
  'id, project_id, number, title, body_text, body_text_version, state, close_reason, type_id, milestone_id, moderation, deleted_at, author_id, revision, created_at, updated_at, closed_at';
const issueColumns = `${listColumns}, body`;

/** D1 SQL and bindings stay entirely in this adapter. Authorization precedes these intents. */
export function createD1Repository(db: D1Database): IssueRepository {
  async function receipt(
    intent: MutationIdentity,
    operation: string,
  ): Promise<MutationOutcome | null> {
    if (intent.persistReceipt === false) return null;
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

  /**
   * Bounded ID sets bind as one JSON array expanded by `json_each`, so every
   * statement keeps a fixed bind count far below D1's 100-parameter limit
   * regardless of page size or relation cardinality. Callers pass IDs that
   * the application validators already checked as unique UUIDs.
   */
  const idSet = 'SELECT value FROM json_each(?)';
  const idJson = (ids: readonly string[]) => JSON.stringify(ids);

  /**
   * One atomic mutation per operation through a single D1 batch: the receipt
   * insert, the conditional aggregate write, the relation writes, the
   * timeline event at the new aggregate revision and the outbox row commit
   * together. Reference checks run before the batch (taxonomy references in
   * this project, assignees holding a current role, enabled issue types) and
   * the schema's foreign keys remain the integrity backstop. Idempotent
   * no-ops return the current snapshot without writing anything.
   */
  async function mutate(
    intent: IssueMutationIntent,
    operation: IssueOperation,
  ): Promise<MutationOutcome> {
    validateIntent(intent, operation);
    const replay = await receipt(intent, operation);
    if (replay) return replay;
    const snapshotOf = (row: IssueRow): MutationOutcome => ({
      result: {
        id: row.id,
        projectId: row.project_id,
        number: row.number,
        revision: row.revision,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      replayed: false,
    });
    const statements =
      intent.persistReceipt === false
        ? []
        : [
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
    let metadata = '{}';
    if (operation === 'issue.create') {
      let create = intent as CreateIssueIntent;
      let formValues: ReturnType<typeof prepareIssueFormSubmission> | undefined;
      let definition: IssueFormDefinition | undefined;
      if (create.formSubmission) {
        const form = await createD1ContentDefinitionStore(db).getForm(
          create.projectId,
          create.formSubmission.formId,
          create.formSubmission.formVersion,
        );
        if (
          !form ||
          !form.enabled ||
          form.revision !== create.formSubmission.formVersion
        ) {
          const concurrentReplay = await receipt(intent, operation);
          if (concurrentReplay) return concurrentReplay;
          throw new IssueFormError('FORM_VERSION_STALE', 'formVersion');
        }
        definition = form.definition;
        formValues = prepareIssueFormSubmission(
          form.definition,
          create.formSubmission,
          create.body,
        );
        create = {
          ...create,
          ...(await createD1ContentDefinitionStore(db).resolveFormDefaults(
            create.projectId,
            form.definition,
          )),
        };
        validateIntent(create, operation);
      }
      const projection = projectMarkdownText(create.body);
      const project = await db
        .prepare('SELECT status FROM projects WHERE id = ?')
        .bind(create.projectId)
        .first<{ status: string }>();
      if (project?.status !== 'active') throw new DomainError('NOT_FOUND');
      if (create.typeId !== null) {
        const type = await db
          .prepare(
            'SELECT 1 FROM issue_types WHERE project_id = ? AND id = ? AND enabled = 1',
          )
          .bind(create.projectId, create.typeId)
          .first();
        if (type === null) throw new DomainError('INVALID_INPUT');
      }
      if (create.milestoneId !== null) {
        const milestone = await db
          .prepare('SELECT 1 FROM milestones WHERE project_id = ? AND id = ?')
          .bind(create.projectId, create.milestoneId)
          .first();
        if (milestone === null) throw new DomainError('INVALID_INPUT');
      }
      if (create.labelIds.length > 0) {
        const labels = await db
          .prepare(
            `SELECT COUNT(*) AS count FROM labels WHERE project_id = ? AND id IN (${idSet})`,
          )
          .bind(create.projectId, idJson(create.labelIds))
          .first<{ count: number }>();
        if ((labels?.count ?? 0) !== create.labelIds.length)
          throw new DomainError('INVALID_INPUT');
      }
      if (create.assigneeIds.length > 0) {
        const members = await db
          .prepare(
            `SELECT COUNT(*) AS count FROM project_roles WHERE project_id = ? AND principal_id IN (${idSet})`,
          )
          .bind(create.projectId, idJson(create.assigneeIds))
          .first<{ count: number }>();
        if ((members?.count ?? 0) !== create.assigneeIds.length)
          throw new DomainError('INVALID_INPUT');
      }
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
            "INSERT INTO issues (id, project_id, number, title, body, type_id, milestone_id, author_id, created_at, updated_at, last_mutation_id, body_text, body_text_version) VALUES (?, ?, (SELECT next_issue_number - 1 FROM projects WHERE id = ? AND status = 'active'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            create.id,
            create.projectId,
            create.projectId,
            create.title,
            create.body,
            create.typeId,
            create.milestoneId,
            create.principalId,
            create.now,
            create.now,
            create.mutationId,
            projection.text,
            projection.version,
          ),
      );
      if (create.labelIds.length > 0)
        statements.push(
          db
            .prepare(
              'INSERT INTO issue_labels (project_id, issue_id, label_id) SELECT ?, ?, value FROM json_each(?)',
            )
            .bind(create.projectId, create.id, idJson(create.labelIds)),
        );
      if (create.formSubmission && formValues && definition) {
        const guards = [
          "EXISTS (SELECT 1 FROM projects x JOIN principals p ON p.id = ? WHERE x.id = ? AND x.status = 'active' AND p.status = 'active' AND ((p.kind = 'user' AND x.visibility = 'public') OR (p.kind = 'staff' AND EXISTS (SELECT 1 FROM project_roles r WHERE r.project_id = x.id AND r.principal_id = p.id))))",
        ];
        const values: (string | number)[] = [
          create.principalId,
          create.projectId,
        ];
        // Recheck resolved names, active types and Staff handles in the same
        // batch. A renamed/revoked default cannot become a different choice.
        if (create.labelIds.length) {
          guards.push(
            `(SELECT COUNT(*) FROM labels WHERE project_id = ? AND id IN (${idSet}) AND name_key IN (${idSet})) = ?`,
          );
          values.push(
            create.projectId,
            idJson(create.labelIds),
            idJson(definition.labels.map(nameKeyOf)),
            create.labelIds.length,
          );
        }
        if (create.assigneeIds.length) {
          guards.push(
            `(SELECT COUNT(DISTINCT p.id) FROM project_roles r JOIN principals p ON p.id = r.principal_id JOIN identities i ON i.principal_id = p.id WHERE r.project_id = ? AND p.status = 'active' AND p.kind = 'staff' AND i.provider = 'local-password' AND i.issuer = 'hyperbug' AND p.id IN (${idSet}) AND i.subject IN (${idSet})) = ?`,
          );
          values.push(
            create.projectId,
            idJson(create.assigneeIds),
            idJson(definition.assignees),
            create.assigneeIds.length,
          );
        }
        if (create.typeId) {
          guards.push(
            'EXISTS (SELECT 1 FROM issue_types WHERE project_id = ? AND id = ? AND name_key = ? AND enabled = 1)',
          );
          values.push(
            create.projectId,
            create.typeId,
            nameKeyOf(definition.type!),
          );
        }
        statements.push(
          db
            .prepare(
              `INSERT INTO form_submissions (project_id, issue_id, form_id, form_version, "values", created_at) VALUES (?, ?, ?, (SELECT revision FROM issue_forms WHERE project_id = ? AND id = ? AND enabled = 1 AND revision = ? AND ${guards.join(' AND ')}), ?, ?)`,
            )
            .bind(
              create.projectId,
              create.id,
              create.formSubmission.formId,
              create.projectId,
              create.formSubmission.formId,
              create.formSubmission.formVersion,
              ...values,
              JSON.stringify(formValues.values),
              create.now,
            ),
        );
        try {
          statements.push(
            ...(await formAttachmentStatements(
              db,
              create,
              definition,
              formValues.attachmentIds,
            )),
          );
        } catch (error) {
          // An identical winner may have consumed the draft after our initial
          // receipt read. Replay that success before reporting changed state.
          const concurrentReplay = await receipt(intent, operation);
          if (concurrentReplay) return concurrentReplay;
          throw error;
        }
      }
      if (create.assigneeIds.length > 0)
        statements.push(
          db
            .prepare(
              'INSERT INTO issue_assignees (project_id, issue_id, principal_id) SELECT ?, ?, value FROM json_each(?)',
            )
            .bind(create.projectId, create.id, idJson(create.assigneeIds)),
        );
      metadata = '{}';
    } else {
      const conditional = intent as EditIssueIntent;
      const project = await db
        .prepare('SELECT status FROM projects WHERE id = ?')
        .bind(intent.projectId)
        .first<{ status: string }>();
      if (project?.status !== 'active') throw new DomainError('NOT_FOUND');
      const current = await db
        .prepare(
          `SELECT ${issueColumns} FROM issues WHERE project_id = ? AND id = ?`,
        )
        .bind(intent.projectId, intent.id)
        .first<IssueRow>();
      if (current === null) throw new DomainError('NOT_FOUND');
      if (current.revision !== conditional.expectedRevision)
        throw new DomainError('REVISION_CONFLICT');
      if (operation === 'issue.labels' || operation === 'issue.assignees') {
        const isLabels = operation === 'issue.labels';
        const oldIds = (
          await db
            .prepare(
              isLabels
                ? 'SELECT label_id AS value FROM issue_labels WHERE project_id = ? AND issue_id = ?'
                : 'SELECT principal_id AS value FROM issue_assignees WHERE project_id = ? AND issue_id = ?',
            )
            .bind(intent.projectId, intent.id)
            .all<{ value: string }>()
        ).results.map((row) => row.value);
        const newIds = isLabels
          ? (intent as SetIssueLabelsIntent).labelIds
          : (intent as SetIssueAssigneesIntent).assigneeIds;
        const added = newIds.filter((id) => !oldIds.includes(id));
        const removed = oldIds.filter((id) => !newIds.includes(id));
        if (added.length === 0 && removed.length === 0)
          return snapshotOf(current);
        if (newIds.length > 0) {
          const reference = isLabels
            ? await db
                .prepare(
                  `SELECT COUNT(*) AS count FROM labels WHERE project_id = ? AND id IN (${idSet})`,
                )
                .bind(intent.projectId, idJson(newIds))
                .first<{ count: number }>()
            : await db
                .prepare(
                  `SELECT COUNT(*) AS count FROM project_roles WHERE project_id = ? AND principal_id IN (${idSet})`,
                )
                .bind(intent.projectId, idJson(newIds))
                .first<{ count: number }>();
          if ((reference?.count ?? 0) !== newIds.length)
            throw new DomainError('INVALID_INPUT');
        }
        metadata = JSON.stringify({
          v: 1,
          added: added.length,
          removed: removed.length,
        });
        statements.push(
          db
            .prepare(
              isLabels
                ? 'DELETE FROM issue_labels WHERE project_id = ? AND issue_id = ?'
                : 'DELETE FROM issue_assignees WHERE project_id = ? AND issue_id = ?',
            )
            .bind(intent.projectId, intent.id),
        );
        if (newIds.length > 0)
          statements.push(
            db
              .prepare(
                isLabels
                  ? 'INSERT INTO issue_labels (project_id, issue_id, label_id) SELECT ?, ?, value FROM json_each(?)'
                  : 'INSERT INTO issue_assignees (project_id, issue_id, principal_id) SELECT ?, ?, value FROM json_each(?)',
              )
              .bind(intent.projectId, intent.id, idJson(newIds)),
          );
      } else if (operation === 'issue.type') {
        const typeIntent = intent as SetIssueTypeIntent;
        if (typeIntent.typeId !== null) {
          const type = await db
            .prepare(
              'SELECT 1 FROM issue_types WHERE project_id = ? AND id = ? AND enabled = 1',
            )
            .bind(intent.projectId, typeIntent.typeId)
            .first();
          if (type === null) throw new DomainError('INVALID_INPUT');
        }
        if ((current.type_id ?? null) === typeIntent.typeId)
          return snapshotOf(current);
        metadata = JSON.stringify({ v: 1, typeId: typeIntent.typeId });
      } else if (operation === 'issue.milestone') {
        const milestoneIntent = intent as SetIssueMilestoneIntent;
        if (milestoneIntent.milestoneId !== null) {
          const milestone = await db
            .prepare('SELECT 1 FROM milestones WHERE project_id = ? AND id = ?')
            .bind(intent.projectId, milestoneIntent.milestoneId)
            .first();
          if (milestone === null) throw new DomainError('INVALID_INPUT');
        }
        if ((current.milestone_id ?? null) === milestoneIntent.milestoneId)
          return snapshotOf(current);
        metadata = JSON.stringify({
          v: 1,
          milestoneId: milestoneIntent.milestoneId,
        });
      } else if (operation === 'issue.close') {
        if (current.state !== 'open')
          throw new DomainError('REVISION_CONFLICT');
        metadata = JSON.stringify({
          v: 1,
          reason: (intent as CloseIssueIntent).reason,
        });
      } else if (operation === 'issue.reopen') {
        if (current.state !== 'closed')
          throw new DomainError('REVISION_CONFLICT');
        metadata = '{}';
      }
      let assignment = '';
      const assignmentValues: unknown[] = [];
      if (operation === 'issue.edit') {
        const edit = intent as EditIssueIntent;
        const projection = projectMarkdownText(edit.body);
        assignment =
          ', title = ?, body = ?, body_text = ?, body_text_version = ?';
        assignmentValues.push(
          edit.title,
          edit.body,
          projection.text,
          projection.version,
        );
      } else if (operation === 'issue.close') {
        const close = intent as CloseIssueIntent;
        assignment = ', state = ?, close_reason = ?, closed_at = ?';
        assignmentValues.push('closed', close.reason, intent.now);
      } else if (operation === 'issue.reopen') {
        assignment = ", state = 'open', close_reason = NULL, closed_at = NULL";
      } else if (operation === 'issue.type') {
        assignment = ', type_id = ?';
        assignmentValues.push((intent as SetIssueTypeIntent).typeId);
      } else if (operation === 'issue.milestone') {
        assignment = ', milestone_id = ?';
        assignmentValues.push((intent as SetIssueMilestoneIntent).milestoneId);
      }
      statements.push(
        db
          .prepare(
            'UPDATE issues SET revision = revision + 1, updated_at = max(updated_at, ?), last_mutation_id = ?' +
              assignment +
              ' WHERE project_id = ? AND id = ? AND revision = ?',
          )
          .bind(
            intent.now,
            intent.mutationId,
            ...assignmentValues,
            intent.projectId,
            intent.id,
            conditional.expectedRevision,
          ),
      );
    }
    // VALUES always attempts a row. A missing conditional-write witness becomes NULL,
    // violates aggregate_revision NOT NULL and rolls the entire D1 batch back.
    statements.push(
      db
        .prepare(
          'INSERT INTO timeline_events (id, project_id, issue_id, aggregate_revision, actor_id, action, created_at, metadata) VALUES (?, ?, ?, (SELECT revision FROM issues WHERE project_id = ? AND id = ? AND last_mutation_id = ?), ?, ?, ?, ?)',
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
          metadata,
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
    if (intent.persistReceipt !== false)
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
    if (intent.persistReceipt === false)
      statements.push(
        db
          .prepare(
            `SELECT ${issueColumns} FROM issues WHERE project_id = ? AND id = ? AND last_mutation_id = ?`,
          )
          .bind(intent.projectId, intent.id, intent.mutationId),
      );
    let committed: IssueRow | undefined;
    try {
      const batch = await db.batch(statements);
      if (intent.persistReceipt === false)
        committed = batch.at(-1)?.results?.[0] as unknown as
          | IssueRow
          | undefined;
    } catch (error) {
      // A competing identical request may have won the unique receipt scope.
      const concurrentReplay = await receipt(intent, operation);
      if (concurrentReplay) return concurrentReplay;
      const form =
        operation === 'issue.create'
          ? (intent as CreateIssueIntent).formSubmission
          : undefined;
      if (form) {
        const head = await db
          .prepare(
            'SELECT revision, enabled FROM issue_forms WHERE project_id = ? AND id = ?',
          )
          .bind(intent.projectId, form.formId)
          .first<{ revision: number; enabled: number }>();
        if (!head || head.enabled !== 1 || head.revision !== form.formVersion)
          throw new IssueFormError('FORM_VERSION_STALE', 'formVersion');
        if (/constraint failed: attachments\./u.test(String(error)))
          throw new IssueFormError('FORM_ATTACHMENTS_INVALID', 'attachments');
        if (
          /NOT NULL constraint failed: form_submissions\.form_version/u.test(
            String(error),
          )
        ) {
          const allowed = await db
            .prepare(
              "SELECT 1 FROM projects x JOIN principals p ON p.id = ? WHERE x.id = ? AND x.status = 'active' AND p.status = 'active' AND ((p.kind = 'user' AND x.visibility = 'public') OR (p.kind = 'staff' AND EXISTS (SELECT 1 FROM project_roles r WHERE r.project_id = x.id AND r.principal_id = p.id)))",
            )
            .bind(intent.principalId, intent.projectId)
            .first();
          if (!allowed)
            throw new IssueFormError('FORM_SUBMISSION_FORBIDDEN', 'principal');
          throw new IssueFormError('FORM_DEFAULTS_INVALID', 'defaults');
        }
      }
      // A conditional mutation whose pre-read passed but whose batch lost a
      // race (the timeline witness stays NULL) classifies by the row's
      // current existence: a lost revision/state race, never a raw failure.
      if (operation !== 'issue.create') {
        const loser = await db
          .prepare('SELECT id FROM issues WHERE project_id = ? AND id = ?')
          .bind(intent.projectId, intent.id)
          .first();
        throw new DomainError(
          loser === null ? 'NOT_FOUND' : 'REVISION_CONFLICT',
        );
      }
      throw error;
    }
    if (intent.persistReceipt === false) {
      if (!committed) throw new Error('Committed one-shot issue is missing');
      return snapshotOf(committed);
    }
    const result = await receipt(intent, operation);
    if (!result) throw new Error('Committed mutation receipt is missing');
    return { ...result, replayed: false };
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
      const row = await db
        .prepare(
          `SELECT ${issueColumns} FROM issues WHERE project_id = ? AND id = ? AND deleted_at IS NULL${hidden}`,
        )
        .bind(projectId, id)
        .first<IssueRow>();
      return row ? toIssue(row) : null;
    },
    async issueVisible(projectId, id, options) {
      assertId(projectId);
      assertId(id);
      const hidden =
        options?.includeHidden === true ? '' : " AND moderation = 'visible'";
      const row = await db
        .prepare(
          `SELECT 1 AS present FROM issues WHERE project_id = ? AND id = ? AND deleted_at IS NULL${hidden}`,
        )
        .bind(projectId, id)
        .first();
      return row !== null;
    },
    async listIssues(query: IssueListQuery) {
      const { limit, cursor } = issuePageOptions(query);
      const values: (string | number)[] = [query.projectId];
      let where = 'project_id = ? AND deleted_at IS NULL';
      if (query.includeHidden !== true) where += " AND moderation = 'visible'";
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
      const labelRows = (
        await db
          .prepare(
            `SELECT issue_id, label_id FROM issue_labels WHERE project_id = ? AND issue_id IN (${idSet})`,
          )
          .bind(projectId, idJson(issueIds))
          .all<{ issue_id: string; label_id: string }>()
      ).results;
      for (const row of labelRows) labels.get(row.issue_id)?.push(row.label_id);
      const assigneeRows = (
        await db
          .prepare(
            `SELECT issue_id, principal_id FROM issue_assignees WHERE project_id = ? AND issue_id IN (${idSet})`,
          )
          .bind(projectId, idJson(issueIds))
          .all<{ issue_id: string; principal_id: string }>()
      ).results;
      for (const row of assigneeRows)
        assignees.get(row.issue_id)?.push(row.principal_id);
      return { labels, assignees };
    },
  };
}

export * from './key-registry.ts';
export { createD1ProjectStore } from './projects.ts';
export { createD1TaxonomyStore } from './taxonomy.ts';
export {
  createD1CommentStore,
  createD1ReactionStore,
  createD1TimelineStore,
} from './comments.ts';

export { createD1ContentProjectionStore } from './content-projections.ts';
export { createD1UploadIntentStore } from './upload-intents.ts';
export { createD1UploadLegacyInventoryStore } from './upload-legacy-inventory.ts';
export { createD1UploadLegacyRecoveryStore } from './upload-legacy-recovery.ts';

export { createD1ExpiredCleanupStore } from './expired-cleanup.ts';

export function createD1SearchStore(db: D1Database): SearchStore {
  return {
    async search(query) {
      try {
        const options = await searchPageOptions(query);
        const compiled = compileD1Search(query, options, listColumns);
        if (
          query.tier === 'cloudflare-minimum' &&
          !(await createD1SearchBudgetStore(db).reserve({
            reads: SEARCH_MINIMUM_BUDGET.searchReads,
            writes: SEARCH_MINIMUM_BUDGET.searchWrites,
            nowMs: Date.now(),
          }))
        )
          throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
        const meter =
          query.tier === 'cloudflare-minimum'
            ? searchMeter(db, SEARCH_MINIMUM_BUDGET.searchReads, 0, 4)
            : null;
        const work = meter?.db ?? db;
        if (!(await createD1SearchIndexStore(work).ready(query)))
          throw new SearchError('SEARCH_INDEX_INCOMPLETE');
        const rows = (
          await work
            .prepare(compiled.sql)
            .bind(...compiled.values)
            .all<IssueRow & { search_overflow: number }>()
        ).results;
        if (rows.some((row) => row.search_overflow === 1))
          throw new SearchError('SEARCH_BUDGET_EXHAUSTED');
        const page = searchPage(query, options, rows.map(toListItem));
        const relations = page.items.length
          ? await createD1Repository(work).relations(
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

export { createD1SearchIndexStore } from './search-index.ts';

export { createD1SearchBudgetStore } from './search-budget.ts';

export { createD1AsyncStore } from './async-processing.ts';

export { createD1MinimumAsyncStore } from './async-minimum.ts';
