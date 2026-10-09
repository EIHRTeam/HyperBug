import {
  assertId,
  assertInstant,
  assertRevision,
  DomainError,
  validateContent,
  type Issue,
  type IssueState,
  type IssueListItem,
  type MutationResult,
} from '@hyperbug/domain';
import {
  type IssueFormAnswer,
  type IssueFormDefinition,
  IssueFormError,
  validateIssueFormAnswers,
} from './issue-forms.ts';

export * from './account-registration.ts';
export * from './account-session.ts';
export * from './staff-enrollment.ts';
export * from './account-recovery.ts';
export * from './passkey-store.ts';
export * from './oauth-code-store.ts';
export * from './project-role-store.ts';
export * from './account-administration.ts';
export * from './plugin-registry.ts';
export * from './plugin-settings.ts';
export * from './plugin-events.ts';
export * from './projects.ts';
export * from './taxonomy.ts';
export * from './comments.ts';
export * from './reactions.ts';
export * from './timeline.ts';

export interface MutationIdentity {
  mutationId: string;
  principalId: string;
  projectId: string;
  /** false only for an unkeyed one-shot request; omitted retains keyed compatibility. */
  persistReceipt?: boolean;
  keyHash: string;
  payloadHash: string;
  now: number;
  expiresAt: number;
  requestId: string;
  /** Required security audit action chosen by the authorized application service. */
  auditAction?: 'issue.created' | 'issue.edited';
}
/** Bounded taxonomy cardinality on every write path (06.3d bound, fixed now). */
export const maxIssueLabels = 20;
export const maxIssueAssignees = 10;
const closeReasonValues = [
  'completed',
  'not_planned',
  'duplicate',
  'invalid',
  'cannot_reproduce',
] as const;
export const closeReasons: readonly (typeof closeReasonValues)[number][] =
  closeReasonValues;

export interface CreateIssueIntent extends MutationIdentity {
  id: string;
  title: string;
  body: string;
  typeId: string | null;
  milestoneId: string | null;
  labelIds: readonly string[];
  assigneeIds: readonly string[];
  formSubmission?: IssueFormSubmissionIntent;
}
export interface IssueFormSubmissionIntent {
  readonly formId: string;
  readonly formVersion: number;
  readonly draftId?: string;
  readonly values: Readonly<Record<string, IssueFormAnswer>>;
}
/** Repeat at persistence boundary so direct port callers cannot spoof generation. */
export function prepareIssueFormSubmission(
  definition: IssueFormDefinition,
  submission: IssueFormSubmissionIntent,
  body: string,
) {
  const validated = validateIssueFormAnswers(definition, submission.values);
  if (validated.attachmentIds.length && !submission.draftId)
    throw new IssueFormError('FORM_ATTACHMENTS_INVALID', 'attachments');
  if (submission.draftId) assertId(submission.draftId);
  if (validated.markdown !== body)
    throw new IssueFormError('FORM_ANSWERS_INVALID', 'body');
  return validated;
}
export interface EditIssueIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  title: string;
  body: string;
}
export interface CloseIssueIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  reason: Issue['closeReason'];
}
export interface ReopenIssueIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
}
export interface SetIssueLabelsIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  labelIds: readonly string[];
}
export interface SetIssueAssigneesIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  assigneeIds: readonly string[];
}
export interface SetIssueTypeIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  typeId: string | null;
}
export interface SetIssueMilestoneIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  milestoneId: string | null;
}
export type IssueMutationIntent =
  | CreateIssueIntent
  | EditIssueIntent
  | CloseIssueIntent
  | ReopenIssueIntent
  | SetIssueLabelsIntent
  | SetIssueAssigneesIntent
  | SetIssueTypeIntent
  | SetIssueMilestoneIntent;
export type IssueOperation =
  | 'issue.create'
  | 'issue.edit'
  | 'issue.close'
  | 'issue.reopen'
  | 'issue.labels'
  | 'issue.assignees'
  | 'issue.type'
  | 'issue.milestone';
export interface MutationOutcome {
  result: MutationResult;
  replayed: boolean;
}
export interface IssueListQuery {
  projectId: string;
  state?: IssueState;
  limit?: number;
  after?: string;
  /** Moderators only: hidden/redacted issues otherwise never leave the store. */
  includeHidden?: boolean;
}
export interface IssuePage {
  items: IssueListItem[];
  nextCursor: string | null;
}
/** Batched per-issue relations for one page; never one query per item. */
export interface IssueRelations {
  readonly labels: ReadonlyMap<string, readonly string[]>;
  readonly assignees: ReadonlyMap<string, readonly string[]>;
}
export interface IssueRepository {
  createIssue(intent: CreateIssueIntent): Promise<MutationOutcome>;
  editIssue(intent: EditIssueIntent): Promise<MutationOutcome>;
  closeIssue(intent: CloseIssueIntent): Promise<MutationOutcome>;
  reopenIssue(intent: ReopenIssueIntent): Promise<MutationOutcome>;
  setIssueLabels(intent: SetIssueLabelsIntent): Promise<MutationOutcome>;
  setIssueAssignees(intent: SetIssueAssigneesIntent): Promise<MutationOutcome>;
  setIssueType(intent: SetIssueTypeIntent): Promise<MutationOutcome>;
  setIssueMilestone(intent: SetIssueMilestoneIntent): Promise<MutationOutcome>;
  /** One issue read; hidden/redacted rows return null unless included. */
  getIssue(
    projectId: string,
    id: string,
    options?: { includeHidden?: boolean },
  ): Promise<Issue | null>;
  /**
   * Parent-visibility probe for issue sub-resources: true when the issue
   * exists, is not deleted and is visible (or hidden rows are included).
   * Reads no body or relations.
   */
  issueVisible(
    projectId: string,
    id: string,
    options?: { includeHidden?: boolean },
  ): Promise<boolean>;
  listIssues(query: IssueListQuery): Promise<IssuePage>;
  /** Labels and assignees for at most one page of issues, in two queries. */
  relations(
    projectId: string,
    issueIds: readonly string[],
  ): Promise<IssueRelations>;
}

function checkedIdList(
  values: readonly string[],
  maximum: number,
): readonly string[] {
  if (!Array.isArray(values) || values.length > maximum)
    throw new DomainError('INVALID_INPUT');
  const seen = new Set<string>();
  for (const value of values) {
    assertId(value);
    if (seen.has(value)) throw new DomainError('INVALID_INPUT');
    seen.add(value);
  }
  return values;
}

export function validateIntent(
  intent: IssueMutationIntent,
  operation: IssueOperation,
) {
  const conditional =
    'expectedRevision' in intent && intent.expectedRevision !== undefined;
  if (conditional === (operation === 'issue.create'))
    throw new DomainError('INVALID_INPUT');
  for (const id of [
    intent.id,
    intent.mutationId,
    intent.principalId,
    intent.projectId,
    intent.requestId,
  ])
    assertId(id);
  assertInstant(intent.now);
  assertInstant(intent.expiresAt);
  if (
    intent.expiresAt <= intent.now ||
    intent.expiresAt - intent.now > 86400000
  )
    throw new DomainError('INVALID_INPUT');
  if (
    !/^[a-f0-9]{64}$/.test(intent.keyHash) ||
    !/^[a-f0-9]{64}$/.test(intent.payloadHash)
  )
    throw new DomainError('INVALID_INPUT');
  if (
    intent.auditAction !== undefined &&
    intent.auditAction !==
      (operation === 'issue.create' ? 'issue.created' : 'issue.edited')
  )
    throw new DomainError('INVALID_INPUT');
  switch (operation) {
    case 'issue.create':
    case 'issue.edit': {
      const typed = intent as CreateIssueIntent | EditIssueIntent;
      validateContent(typed.title, typed.body);
      if (operation === 'issue.create') {
        const create = typed as CreateIssueIntent;
        if (create.typeId !== null) assertId(create.typeId);
        if (create.milestoneId !== null) assertId(create.milestoneId);
        checkedIdList(create.labelIds, maxIssueLabels);
        checkedIdList(create.assigneeIds, maxIssueAssignees);
        if (create.formSubmission) {
          assertId(create.formSubmission.formId);
          assertRevision(create.formSubmission.formVersion);
          if (create.formSubmission.draftId !== undefined)
            assertId(create.formSubmission.draftId);
        }
      } else {
        assertRevision((typed as EditIssueIntent).expectedRevision);
      }
      break;
    }
    case 'issue.close': {
      const close = intent as CloseIssueIntent;
      assertRevision(close.expectedRevision);
      if (close.reason === null || !closeReasonValues.includes(close.reason))
        throw new DomainError('INVALID_INPUT');
      break;
    }
    case 'issue.reopen': {
      assertRevision((intent as ReopenIssueIntent).expectedRevision);
      break;
    }
    case 'issue.labels': {
      const labels = intent as SetIssueLabelsIntent;
      assertRevision(labels.expectedRevision);
      checkedIdList(labels.labelIds, maxIssueLabels);
      break;
    }
    case 'issue.assignees': {
      const assignees = intent as SetIssueAssigneesIntent;
      assertRevision(assignees.expectedRevision);
      checkedIdList(assignees.assigneeIds, maxIssueAssignees);
      break;
    }
    case 'issue.type': {
      const typed = intent as SetIssueTypeIntent;
      assertRevision(typed.expectedRevision);
      if (typed.typeId !== null) assertId(typed.typeId);
      break;
    }
    case 'issue.milestone': {
      const typed = intent as SetIssueMilestoneIntent;
      assertRevision(typed.expectedRevision);
      if (typed.milestoneId !== null) assertId(typed.milestoneId);
      break;
    }
  }
}

interface IssueCursor {
  v: 1;
  resource: 'issues';
  project: string;
  state: IssueState | null;
  sort: 'created_desc';
  time: number;
  id: string;
}
export function issuePageOptions(query: IssueListQuery): {
  limit: number;
  cursor: IssueCursor | null;
} {
  assertId(query.projectId);
  const limit = query.limit ?? 40;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100 ||
    (query.state !== undefined &&
      query.state !== 'open' &&
      query.state !== 'closed')
  )
    throw new DomainError('INVALID_INPUT');
  if (query.after === undefined) return { limit, cursor: null };
  try {
    if (
      query.after.length === 0 ||
      query.after.length > 1024 ||
      !/^[a-zA-Z0-9_-]+$/.test(query.after)
    )
      throw new Error();
    const cursor: unknown = JSON.parse(
      atob(query.after.replaceAll('-', '+').replaceAll('_', '/')),
    );
    if (!cursor || typeof cursor !== 'object') throw new Error();
    if ('v' in cursor && cursor.v !== 1) throw new DomainError('CURSOR_STALE');
    if (
      Object.keys(cursor).sort().join(',') !==
      'id,project,resource,sort,state,time,v'
    )
      throw new Error();
    if (
      !('resource' in cursor) ||
      cursor.resource !== 'issues' ||
      !('project' in cursor) ||
      cursor.project !== query.projectId ||
      !('state' in cursor) ||
      cursor.state !== (query.state ?? null) ||
      !('sort' in cursor) ||
      cursor.sort !== 'created_desc' ||
      !('time' in cursor) ||
      !('id' in cursor)
    )
      throw new Error();
    assertInstant(cursor.time);
    assertId(cursor.id);
    return {
      limit,
      cursor: {
        v: 1,
        resource: 'issues',
        project: query.projectId,
        state: query.state ?? null,
        sort: 'created_desc',
        time: cursor.time,
        id: cursor.id,
      },
    };
  } catch (error) {
    if (error instanceof DomainError && error.code === 'CURSOR_STALE')
      throw error;
    throw new DomainError('INVALID_CURSOR');
  }
}
export function issuePage(
  query: IssueListQuery,
  rows: IssueListItem[],
): IssuePage {
  const { limit } = issuePageOptions(query);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  if (rows.length <= limit || !last) return { items, nextCursor: null };
  const cursor: IssueCursor = {
    v: 1,
    resource: 'issues',
    project: query.projectId,
    state: query.state ?? null,
    sort: 'created_desc',
    time: last.createdAt,
    id: last.id,
  };
  return {
    items,
    nextCursor: btoa(JSON.stringify(cursor))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, ''),
  };
}
export interface StoredReceipt {
  payloadHash: string;
  expiresAt: number;
  result: unknown;
}

function receiptResult(value: unknown, projectId: string): MutationResult {
  try {
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).sort().join(',') !==
        'createdAt,id,number,projectId,revision,updatedAt'
    )
      throw new Error();
    const result = value as Record<string, unknown>;
    assertId(result.id);
    assertId(result.projectId);
    assertInstant(result.createdAt);
    assertInstant(result.updatedAt);
    for (const field of ['number', 'revision']) {
      const number = result[field];
      if (
        typeof number !== 'number' ||
        !Number.isInteger(number) ||
        number < 1 ||
        number > 2147483647
      )
        throw new Error();
    }
    if (result.projectId !== projectId || result.updatedAt < result.createdAt)
      throw new Error();
    return {
      id: result.id,
      projectId: result.projectId,
      number: result.number as number,
      revision: result.revision as number,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch {
    throw new Error('Invalid persisted mutation receipt');
  }
}
export function replayReceipt(
  receipt: StoredReceipt | null,
  intent: MutationIdentity,
): MutationOutcome | null {
  if (!receipt) return null;
  if (receipt.expiresAt <= intent.now)
    throw new DomainError('IDEMPOTENCY_EXPIRED');
  if (receipt.payloadHash !== intent.payloadHash)
    throw new DomainError('IDEMPOTENCY_CONFLICT');
  return {
    result: receiptResult(receipt.result, intent.projectId),
    replayed: true,
  };
}

export * from './content-projections.ts';
export * from './issue-forms.ts';
export * from './content-definitions.ts';
export * from './blob-store.ts';
export * from './blob-promotion.ts';
export * from './upload-intents.ts';
export * from './uploads.ts';

export * from './multipart.ts';
export * from './multipart-uploads.ts';
export * from './upload-scans.ts';
export * from './scan-upload.ts';
export * from './upload-cleanup.ts';
export * from './multipart-reconciliation.ts';
export * from './upload-orphan-cleanup.ts';
export * from './upload-legacy-inventory.ts';
export * from './upload-legacy-recovery.ts';
export * from './upload-cors.ts';
export * from './form-attachments.ts';
export * from './attachments.ts';
export * from './scanner-service-protocol.ts';
export * from './scanner-service-stream.ts';
export * from './scanner-service-client.ts';

export type { PreparedAuditEvent } from './prepared-audit.ts';

export * from './expired-cleanup.ts';
export * from './search.ts';
export * from './search-index.ts';

export * from './search-budget.ts';

export * from './async-processing.ts';
