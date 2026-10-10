import { assertId, assertInstant, assertRevision } from '@hyperbug/domain';

/**
 * A comment row (DATA-MODEL MVP records). Comments are their own table —
 * merged into the timeline view at read time — and never bump the issue's
 * aggregate revision. Moderation follows the tombstone model: deletion sets
 * `deletedAt` and redaction flips the moderation flag; the body stays
 * staff-restricted in both cases, and public reads see only visible,
 * non-deleted rows.
 */
export interface CommentRecord {
  readonly id: string;
  readonly projectId: string;
  readonly issueId: string;
  readonly authorId: string;
  readonly body: string;
  readonly bodyText: string | null;
  readonly bodyTextVersion: string | null;
  readonly revision: number;
  readonly moderation: 'visible' | 'hidden' | 'redacted';
  readonly deletedAt: number | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface CommentHistoryEntry {
  readonly id: string;
  readonly revision: number;
  readonly editorId: string;
  readonly body: string;
  readonly changedAtMs: number;
}

export interface CommentMutationIdentity {
  readonly mutationId: string;
  readonly principalId: string;
  readonly projectId: string;
  readonly persistReceipt?: boolean;
  readonly keyHash: string;
  readonly payloadHash: string;
  readonly now: number;
  readonly expiresAt: number;
  readonly requestId: string;
}

export interface CommentCreateIntent extends CommentMutationIdentity {
  readonly id: string;
  readonly issueId: string;
  readonly body: string;
}

export interface CommentEditIntent extends CommentMutationIdentity {
  readonly id: string;
  readonly issueId: string;
  readonly expectedRevision: number;
  readonly body: string;
}

export interface CommentMutationResult {
  readonly id: string;
  readonly projectId: string;
  readonly issueId: string;
  readonly revision: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface CommentMutationOutcome {
  readonly result: CommentMutationResult;
  readonly replayed: boolean;
}

export interface CommentPage {
  readonly items: readonly CommentRecord[];
  readonly nextCursor: string | null;
}

export interface CommentQuery {
  readonly projectId: string;
  readonly issueId: string;
  readonly limit?: number;
  readonly after?: string;
  /** Moderators only: hidden/redacted/deleted rows otherwise never leave the store. */
  readonly includeHidden?: boolean;
}

export interface CommentHistoryEntryRecord {
  readonly historyId: string;
  readonly commentId: string;
  readonly revision: number;
  readonly editorId: string;
  readonly body: string;
  readonly changedAtMs: number;
}

export interface CommentHistoryPage {
  readonly entries: readonly CommentHistoryEntryRecord[];
}

/**
 * Persistence port for issue comments. Creation and editing are atomic
 * (comment/history/outbox/receipt together), revision-conditional on edit,
 * and replayable through the shared mutation-receipt table scoped by the
 * `comment.*` operation strings.
 */
export interface CommentStore {
  create(intent: CommentCreateIntent): Promise<CommentMutationOutcome>;
  edit(intent: CommentEditIntent): Promise<CommentMutationOutcome>;
  /** Set the moderation flag; visible<->hidden<->redacted, staff action. */
  moderate(input: {
    readonly projectId: string;
    readonly id: string;
    readonly moderation: 'visible' | 'hidden' | 'redacted';
    readonly actorId: string;
    readonly nowMs: number;
  }): Promise<CommentRecord | null>;
  /** Tombstone deletion; the body stays staff-restricted. */
  remove(input: {
    readonly projectId: string;
    readonly id: string;
    readonly actorId: string;
    readonly nowMs: number;
  }): Promise<CommentRecord | null>;
  get(
    projectId: string,
    issueId: string,
    id: string,
    options?: { includeHidden?: boolean },
  ): Promise<CommentRecord | null>;
  getById(
    projectId: string,
    id: string,
    options?: { includeHidden?: boolean },
  ): Promise<CommentRecord | null>;
  listByIssue(query: CommentQuery): Promise<CommentPage>;
  /** Staff-only immutable edit history, bounded and ascending. */
  history(projectId: string, commentId: string): Promise<CommentHistoryPage>;
}

export function validateCommentIntent(
  intent: CommentCreateIntent | CommentEditIntent,
  operation: 'comment.create' | 'comment.edit',
): void {
  const conditional =
    'expectedRevision' in intent && intent.expectedRevision !== undefined;
  if (conditional === (operation === 'comment.create'))
    throw new Error('Invalid comment operation');
  for (const id of [
    intent.id,
    intent.issueId,
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
    throw new Error('Invalid comment receipt window');
  if (
    !/^[a-f0-9]{64}$/.test(intent.keyHash) ||
    !/^[a-f0-9]{64}$/.test(intent.payloadHash)
  )
    throw new Error('Invalid comment receipt digests');
  // A comment is body-only: 1–32768 code points, no NUL, scalar-only text.
  const length = [...intent.body].length;
  if (length < 1 || length > 32768 || intent.body.includes('\0'))
    throw new Error('Invalid comment body');
  if ('expectedRevision' in intent) assertRevision(intent.expectedRevision);
}

interface CommentCursor {
  v: 1;
  resource: 'comments';
  project: string;
  issue: string;
  sort: 'created_asc';
  time: number;
  id: string;
}

export function commentPageOptions(query: CommentQuery): {
  limit: number;
  cursor: CommentCursor | null;
} {
  assertId(query.projectId);
  assertId(query.issueId);
  const limit = query.limit ?? 40;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid comment page bound');
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
    if ('v' in cursor && (cursor as { v: number }).v !== 1)
      throw new Error('stale');
    if (
      Object.keys(cursor).sort().join(',') !==
      'id,issue,project,resource,sort,time,v'
    )
      throw new Error();
    const value = cursor as Record<string, unknown>;
    if (
      value.resource !== 'comments' ||
      value.project !== query.projectId ||
      value.issue !== query.issueId ||
      value.sort !== 'created_asc'
    )
      throw new Error();
    assertInstant(value.time);
    assertId(value.id as string);
    return {
      limit,
      cursor: {
        v: 1,
        resource: 'comments',
        project: query.projectId,
        issue: query.issueId,
        sort: 'created_asc',
        time: value.time as number,
        id: value.id as string,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'stale')
      throw new Error('stale cursor', { cause: error });
    throw new Error('invalid cursor', { cause: error });
  }
}

export function commentPage(
  query: CommentQuery,
  rows: readonly CommentRecord[],
): CommentPage {
  const { limit } = commentPageOptions(query);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  if (rows.length <= limit || !last) return { items, nextCursor: null };
  const cursor: CommentCursor = {
    v: 1,
    resource: 'comments',
    project: query.projectId,
    issue: query.issueId,
    sort: 'created_asc',
    time: last.createdAtMs,
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

/** The public comment view; moderation state travels, hidden bodies do not. */
export function commentView(record: CommentRecord, includeBody: boolean) {
  return {
    id: record.id,
    projectId: record.projectId,
    issueId: record.issueId,
    authorId: record.authorId,
    ...(includeBody ? { body: record.body } : {}),
    revision: record.revision,
    moderation: record.moderation,
    deleted: record.deletedAt !== null,
    createdAt: new Date(record.createdAtMs).toISOString(),
    updatedAt: new Date(record.updatedAtMs).toISOString(),
  };
}

export interface StoredCommentReceipt {
  payloadHash: string;
  expiresAt: number;
  result: unknown;
}

function commentResultOf(
  value: unknown,
  projectId: string,
): CommentMutationResult {
  try {
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).sort().join(',') !==
        'createdAtMs,id,issueId,projectId,revision,updatedAtMs'
    )
      throw new Error();
    const result = value as Record<string, unknown>;
    assertId(result.id);
    assertId(result.projectId);
    assertId(result.issueId);
    assertInstant(result.createdAtMs);
    assertInstant(result.updatedAtMs);
    const revision = result.revision;
    if (
      typeof revision !== 'number' ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      revision > 2147483647
    )
      throw new Error();
    if (
      result.projectId !== projectId ||
      result.updatedAtMs < result.createdAtMs
    )
      throw new Error();
    return {
      id: result.id,
      projectId: result.projectId,
      issueId: result.issueId,
      revision,
      createdAtMs: result.createdAtMs,
      updatedAtMs: result.updatedAtMs,
    };
  } catch {
    throw new Error('Invalid persisted comment receipt');
  }
}

export function replayCommentReceipt(
  receipt: StoredCommentReceipt | null,
  intent: CommentMutationIdentity,
): CommentMutationOutcome | null {
  if (!receipt) return null;
  if (receipt.expiresAt <= intent.now) throw new Error('idempotency-expired');
  if (receipt.payloadHash !== intent.payloadHash)
    throw new Error('idempotency-conflict');
  return {
    result: commentResultOf(receipt.result, intent.projectId),
    replayed: true,
  };
}
