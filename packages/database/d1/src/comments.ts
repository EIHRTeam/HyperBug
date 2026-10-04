import { projectMarkdownText } from '@hyperbug/security/markdown';
import type { D1Database } from '@cloudflare/workers-types';
import {
  commentPage,
  commentPageOptions,
  replayCommentReceipt,
  timelinePage,
  timelinePageOptions,
  validateCommentIntent,
  validateReactionInput,
  type CommentMutationIdentity,
  type CommentMutationOutcome,
  type CommentQuery,
  type CommentRecord,
  type CommentStore,
  type ReactionAddInput,
  type ReactionStore,
  type ReactionValue,
  type ReactionSummary,
  type TimelineItem,
  type TimelineQuery,
  type TimelineStore,
} from '@hyperbug/application';

interface CommentRow {
  id: string;
  project_id: string;
  issue_id: string;
  author_id: string;
  body: string;
  body_text: string | null;
  body_text_version: string | null;
  revision: number;
  moderation: 'visible' | 'hidden' | 'redacted';
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

function toRecord(row: CommentRow): CommentRecord {
  const record: CommentRecord = {
    id: row.id,
    projectId: row.project_id,
    issueId: row.issue_id,
    authorId: row.author_id,
    body: row.body,
    bodyText: row.body_text,
    bodyTextVersion: row.body_text_version,
    revision: row.revision,
    moderation: row.moderation,
    deletedAt: row.deleted_at,
    createdAtMs: row.created_at,
    updatedAtMs: row.updated_at,
  };
  if (record.updatedAtMs < record.createdAtMs)
    throw new Error('Invalid persisted comment timestamps');
  return record;
}

const commentColumns =
  'id, project_id, issue_id, author_id, body, body_text, body_text_version, revision, moderation, deleted_at, created_at, updated_at';

const placeholders = (count: number) =>
  Array.from({ length: count }, () => '?').join(', ');

/**
 * D1 adapter for comments, reactions and the merged timeline. Comment
 * creation/editing run as one atomic D1 batch with their receipt and outbox
 * row; moderation and tombstone deletion batch their outbox row with the
 * state write. Reaction add/remove are single guarded statements whose
 * unique constraints make them idempotent.
 */
export function createD1CommentStore(db: D1Database): CommentStore {
  async function receipt(
    intent: CommentMutationIdentity,
    operation: string,
  ): Promise<CommentMutationOutcome | null> {
    const row = await db
      .prepare(
        'SELECT payload_hash, expires_at, result FROM mutation_receipts WHERE principal_id = ? AND project_id = ? AND operation = ? AND key_hash = ?',
      )
      .bind(intent.principalId, intent.projectId, operation, intent.keyHash)
      .first<{ payload_hash: string; expires_at: number; result: string }>();
    return replayCommentReceipt(
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
  async function load(projectId: string, issueId: string, id: string) {
    return db
      .prepare(
        `SELECT ${commentColumns} FROM comments WHERE project_id = ? AND issue_id = ? AND id = ? LIMIT 1`,
      )
      .bind(projectId, issueId, id)
      .first<CommentRow>();
  }
  async function mutate(
    intent: Parameters<typeof validateCommentIntent>[0],
    operation: 'comment.create' | 'comment.edit',
  ): Promise<CommentMutationOutcome> {
    validateCommentIntent(intent, operation);
    const projection = projectMarkdownText(intent.body);
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
    if (operation === 'comment.create') {
      statements.push(
        db
          .prepare(
            "INSERT INTO comments (id, project_id, issue_id, author_id, body, revision, moderation, created_at, updated_at, body_text, body_text_version) VALUES (?, ?, ?, ?, ?, 1, 'visible', ?, ?, ?, ?)",
          )
          .bind(
            intent.id,
            intent.projectId,
            intent.issueId,
            intent.principalId,
            intent.body,
            intent.now,
            intent.now,
            projection.text,
            projection.version,
          ),
        db
          .prepare(
            'INSERT INTO comment_history (id, project_id, comment_id, revision, editor_id, body, changed_at) VALUES (?, ?, ?, 1, ?, ?, ?)',
          )
          .bind(
            crypto.randomUUID(),
            intent.projectId,
            intent.id,
            intent.principalId,
            intent.body,
            intent.now,
          ),
      );
    } else {
      const edit = intent as import('@hyperbug/application').CommentEditIntent;
      const current = await load(intent.projectId, intent.issueId, intent.id);
      if (current === null) throw new Error('not-found');
      if (current.revision !== edit.expectedRevision)
        throw new Error('revision-conflict');
      statements.push(
        db
          .prepare(
            'UPDATE comments SET body = ?, body_text = ?, body_text_version = ?, revision = revision + 1, updated_at = max(updated_at, ?) WHERE project_id = ? AND issue_id = ? AND id = ? AND revision = ?',
          )
          .bind(
            intent.body,
            projection.text,
            projection.version,
            intent.now,
            intent.projectId,
            intent.issueId,
            intent.id,
            (intent as import('@hyperbug/application').CommentEditIntent)
              .expectedRevision,
          ),
        db
          .prepare(
            'INSERT INTO comment_history (id, project_id, comment_id, revision, editor_id, body, changed_at) VALUES (?, ?, ?, (SELECT revision FROM comments WHERE id = ? AND project_id = ?), ?, ?, ?)',
          )
          .bind(
            crypto.randomUUID(),
            intent.projectId,
            intent.id,
            intent.id,
            intent.projectId,
            intent.principalId,
            intent.body,
            intent.now,
          ),
      );
    }
    statements.push(
      db
        .prepare(
          "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES (?, ?, ?, ?, json_object('commentId', ?, 'issueId', ?, 'mutationId', ?), ?, ?)",
        )
        .bind(
          intent.mutationId,
          intent.projectId,
          intent.issueId,
          operation,
          intent.id,
          intent.issueId,
          intent.mutationId,
          intent.now,
          intent.now,
        ),
      db
        .prepare(
          "UPDATE mutation_receipts SET result = (SELECT json_object('id', id, 'projectId', project_id, 'issueId', issue_id, 'revision', revision, 'createdAtMs', created_at, 'updatedAtMs', updated_at) FROM comments WHERE id = ? AND project_id = ?) WHERE id = ?",
        )
        .bind(intent.id, intent.projectId, intent.mutationId),
    );
    try {
      await db.batch(statements);
    } catch (error) {
      const concurrentReplay = await receipt(intent, operation);
      if (concurrentReplay) return concurrentReplay;
      throw error;
    }
    const result = await receipt(intent, operation);
    if (!result) throw new Error('Committed comment receipt is missing');
    return { ...result, replayed: false };
  }
  return {
    create: (intent) => mutate(intent, 'comment.create'),
    edit: (intent) => mutate(intent, 'comment.edit'),
    async moderate(input) {
      const before = await db
        .prepare(
          'SELECT id FROM comments WHERE project_id = ? AND id = ? LIMIT 1',
        )
        .bind(input.projectId, input.id)
        .first();
      if (before === null) return null;
      const statements = [
        db
          .prepare(
            'UPDATE comments SET moderation = ?, updated_at = max(updated_at, ?) WHERE project_id = ? AND id = ?',
          )
          .bind(input.moderation, input.nowMs, input.projectId, input.id),
        db
          .prepare(
            "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES (?, ?, (SELECT issue_id FROM comments WHERE id = ? AND project_id = ?), 'comment.moderated', json_object('commentId', ?, 'moderation', ?, 'actorId', ?), ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            input.projectId,
            input.id,
            input.projectId,
            input.id,
            input.moderation,
            input.actorId,
            input.nowMs,
            input.nowMs,
          ),
      ];
      await db.batch(statements);
      const row = await db
        .prepare(
          `SELECT ${commentColumns} FROM comments WHERE project_id = ? AND id = ? LIMIT 1`,
        )
        .bind(input.projectId, input.id)
        .first<CommentRow>();
      return row ? toRecord(row) : null;
    },
    async remove(input) {
      const before = await db
        .prepare(
          'SELECT id, deleted_at FROM comments WHERE project_id = ? AND id = ? LIMIT 1',
        )
        .bind(input.projectId, input.id)
        .first<{ id: string; deleted_at: number | null }>();
      if (before === null || before.deleted_at !== null) return null;
      await db.batch([
        db
          .prepare(
            'UPDATE comments SET deleted_at = ?, updated_at = max(updated_at, ?) WHERE project_id = ? AND id = ? AND deleted_at IS NULL',
          )
          .bind(input.nowMs, input.nowMs, input.projectId, input.id),
        db
          .prepare(
            "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES (?, ?, (SELECT issue_id FROM comments WHERE id = ? AND project_id = ?), 'comment.deleted', json_object('commentId', ?, 'actorId', ?), ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            input.projectId,
            input.id,
            input.projectId,
            input.id,
            input.actorId,
            input.nowMs,
            input.nowMs,
          ),
      ]);
      const row = await db
        .prepare(
          `SELECT ${commentColumns} FROM comments WHERE project_id = ? AND id = ? LIMIT 1`,
        )
        .bind(input.projectId, input.id)
        .first<CommentRow>();
      return row ? toRecord(row) : null;
    },
    async getById(projectId, id, options) {
      const hidden =
        options?.includeHidden === true
          ? ''
          : " AND moderation = 'visible' AND deleted_at IS NULL";
      const row = await db
        .prepare(
          `SELECT ${commentColumns} FROM comments WHERE project_id = ? AND id = ?${hidden} LIMIT 1`,
        )
        .bind(projectId, id)
        .first<CommentRow>();
      return row ? toRecord(row) : null;
    },
    async get(projectId, issueId, id, options) {
      const hidden =
        options?.includeHidden === true
          ? ''
          : " AND moderation = 'visible' AND deleted_at IS NULL";
      const row = await db
        .prepare(
          `SELECT ${commentColumns} FROM comments WHERE project_id = ? AND issue_id = ? AND id = ?${hidden} LIMIT 1`,
        )
        .bind(projectId, issueId, id)
        .first<CommentRow>();
      return row ? toRecord(row) : null;
    },
    async listByIssue(query: CommentQuery) {
      const { limit, cursor } = commentPageOptions(query);
      let where = 'project_id = ? AND issue_id = ?';
      const values: (string | number)[] = [query.projectId, query.issueId];
      if (query.includeHidden !== true)
        where += " AND moderation = 'visible' AND deleted_at IS NULL";
      if (cursor) {
        where += ' AND (created_at > ? OR (created_at = ? AND id > ?))';
        values.push(cursor.time, cursor.time, cursor.id);
      }
      values.push(limit + 1);
      const rows = await db
        .prepare(
          `SELECT ${commentColumns} FROM comments WHERE ${where} ORDER BY created_at, id LIMIT ?`,
        )
        .bind(...values)
        .all<CommentRow>();
      return commentPage(query, rows.results.map(toRecord));
    },
    async history(projectId, commentId) {
      const rows = await db
        .prepare(
          'SELECT id, comment_id, revision, editor_id, body, changed_at FROM comment_history WHERE project_id = ? AND comment_id = ? ORDER BY revision LIMIT 100',
        )
        .bind(projectId, commentId)
        .all<{
          id: string;
          comment_id: string;
          revision: number;
          editor_id: string;
          body: string;
          changed_at: number;
        }>();
      return {
        entries: rows.results.map((row) => ({
          historyId: row.id,
          commentId: row.comment_id,
          revision: row.revision,
          editorId: row.editor_id,
          body: row.body,
          changedAtMs: row.changed_at,
        })),
      };
    },
  };
}

export function createD1ReactionStore(db: D1Database): ReactionStore {
  const targetColumns = (input: { issueId?: string; commentId?: string }) =>
    input.issueId !== undefined
      ? { issue: input.issueId as string, comment: null }
      : { issue: null, comment: input.commentId as string };
  return {
    async add(input: ReactionAddInput) {
      validateReactionInput(input);
      const target = targetColumns(input);
      const row = await db
        .prepare(
          `INSERT INTO reactions (id, project_id, issue_id, comment_id, principal_id, reaction, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT ${
            target.issue !== null
              ? '(issue_id, principal_id, reaction)'
              : '(comment_id, principal_id, reaction)'
          } DO NOTHING RETURNING id`,
        )
        .bind(
          crypto.randomUUID(),
          input.projectId,
          target.issue,
          target.comment,
          input.principalId,
          input.reaction,
          input.nowMs,
        )
        .first<{ id: string }>();
      return row === null ? 'present' : 'added';
    },
    async remove(input) {
      validateReactionInput(input);
      const target = targetColumns(input);
      const result = await db
        .prepare(
          target.issue !== null
            ? 'DELETE FROM reactions WHERE project_id = ? AND issue_id = ? AND principal_id = ? AND reaction = ?'
            : 'DELETE FROM reactions WHERE project_id = ? AND comment_id = ? AND principal_id = ? AND reaction = ?',
        )
        .bind(
          input.projectId,
          target.issue ?? target.comment,
          input.principalId,
          input.reaction,
        )
        .run();
      return result.meta.changes === 1 ? 'removed' : 'absent';
    },
    async issueCounts(projectId, issueIds) {
      if (issueIds.length === 0) return new Map();
      const rows = await db
        .prepare(
          `SELECT issue_id, reaction, COUNT(*) AS count FROM reactions WHERE project_id = ? AND issue_id IN (${placeholders(issueIds.length)}) GROUP BY issue_id, reaction`,
        )
        .bind(projectId, ...issueIds)
        .all<{ issue_id: string; reaction: ReactionValue; count: number }>();
      return groupCounts(rows.results, (row) => row.issue_id);
    },
    async commentCounts(projectId, commentIds) {
      if (commentIds.length === 0) return new Map();
      const rows = await db
        .prepare(
          `SELECT comment_id, reaction, COUNT(*) AS count FROM reactions WHERE project_id = ? AND comment_id IN (${placeholders(commentIds.length)}) GROUP BY comment_id, reaction`,
        )
        .bind(projectId, ...commentIds)
        .all<{ comment_id: string; reaction: ReactionValue; count: number }>();
      return groupCounts(rows.results, (row) => row.comment_id);
    },
  };
}

function groupCounts<T extends { reaction: ReactionValue; count: number }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): ReadonlyMap<string, readonly ReactionSummary[]> {
  const grouped = new Map<string, ReactionSummary[]>();
  for (const row of rows) {
    const list = grouped.get(keyOf(row)) ?? [];
    list.push({ reaction: row.reaction, count: row.count });
    grouped.set(keyOf(row), list);
  }
  return grouped;
}

interface TimelineRow {
  kind: 'event' | 'comment';
  id: string;
  action: string | null;
  actor_id: string | null;
  system_actor: string | null;
  body: string | null;
  revision: number;
  moderation: 'visible' | 'hidden' | 'redacted' | null;
  deleted: number | null;
  created_at: number;
}

export function createD1TimelineStore(db: D1Database): TimelineStore {
  return {
    async timeline(query: TimelineQuery) {
      const { limit, cursor } = timelinePageOptions(query);
      const commentFilter =
        query.includeHidden === true
          ? "CASE WHEN moderation = 'visible' AND deleted_at IS NULL THEN body ELSE NULL END AS body, moderation, deleted_at"
          : 'body, moderation, deleted_at';
      const commentWhere =
        query.includeHidden === true
          ? 'TRUE'
          : "moderation = 'visible' AND deleted_at IS NULL";
      let cursorClause = '';
      const values: (string | number)[] = [
        query.projectId,
        query.issueId,
        query.projectId,
        query.issueId,
      ];
      if (cursor) {
        cursorClause = ' WHERE created_at > ? OR (created_at = ? AND id > ?)';
        values.push(cursor.time, cursor.time, cursor.id);
      }
      values.push(limit + 1);
      const rows = await db
        .prepare(
          `SELECT * FROM (SELECT 'event' AS kind, id, action, actor_id, system_actor, NULL AS body_placeholder, NULL AS moderation, NULL AS deleted, aggregate_revision AS revision, created_at FROM timeline_events WHERE project_id = ? AND issue_id = ? UNION ALL SELECT 'comment' AS kind, id, NULL AS action, author_id AS actor_id, NULL AS system_actor, ${commentFilter}, revision, created_at FROM comments WHERE project_id = ? AND issue_id = ? AND ${commentWhere})${cursorClause} ORDER BY created_at, id LIMIT ?`,
        )
        .bind(...values)
        .all<TimelineRow & { body_placeholder: string | null }>();
      const items: TimelineItem[] = rows.results.map((row) =>
        row.kind === 'event'
          ? {
              kind: 'event',
              id: row.id,
              action: row.action as string,
              actorId: row.actor_id,
              systemActor: row.system_actor,
              revision: row.revision,
              createdAtMs: row.created_at,
            }
          : {
              kind: 'comment',
              id: row.id,
              actorId: row.actor_id as string,
              revision: row.revision,
              moderation: (row.moderation ?? 'visible') as
                | 'visible'
                | 'hidden'
                | 'redacted',
              deleted: row.deleted !== null && row.deleted !== undefined,
              body: row.body_placeholder ?? row.body ?? null,
              createdAtMs: row.created_at,
            },
      );
      return timelinePage(query, items);
    },
  };
}
