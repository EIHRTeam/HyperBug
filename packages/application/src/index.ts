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

export interface MutationIdentity {
  mutationId: string;
  principalId: string;
  projectId: string;
  keyHash: string;
  payloadHash: string;
  now: number;
  expiresAt: number;
  requestId: string;
  /** Required security audit action chosen by the authorized application service. */
  auditAction?: 'issue.created' | 'issue.edited';
}
export interface CreateIssueIntent extends MutationIdentity {
  id: string;
  title: string;
  body: string;
}
export interface EditIssueIntent extends MutationIdentity {
  id: string;
  expectedRevision: number;
  title: string;
  body: string;
}
export interface MutationOutcome {
  result: MutationResult;
  replayed: boolean;
}
export interface IssueListQuery {
  projectId: string;
  state?: IssueState;
  limit?: number;
  after?: string;
}
export interface IssuePage {
  items: IssueListItem[];
  nextCursor: string | null;
}
export interface IssueRepository {
  createIssue(intent: CreateIssueIntent): Promise<MutationOutcome>;
  editIssue(intent: EditIssueIntent): Promise<MutationOutcome>;
  getIssue(projectId: string, id: string): Promise<Issue | null>;
  listIssues(query: IssueListQuery): Promise<IssuePage>;
}

export function validateIntent(
  intent: CreateIssueIntent | EditIssueIntent,
  operation: 'issue.create' | 'issue.edit' = 'expectedRevision' in intent
    ? 'issue.edit'
    : 'issue.create',
) {
  if ('expectedRevision' in intent !== (operation === 'issue.edit'))
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
  validateContent(intent.title, intent.body);
  if ('expectedRevision' in intent) assertRevision(intent.expectedRevision);
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
