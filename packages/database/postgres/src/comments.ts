import type { Pool } from 'pg';
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
  revision: string | number;
  moderation: 'visible' | 'hidden' | 'redacted';
  deleted_at: string | null;
  created_at: string | number;
  updated_at: string | number;
}

function toRecord(row: CommentRow): CommentRecord {
  const record: CommentRecord = {
    id: row.id,
    projectId: row.project_id,
    issueId: row.issue_id,
    authorId: row.author_id,
    body: row.body,
    revision: Number(row.revision),
    moderation: row.moderation,
    deletedAt: row.deleted_at === null ? null : Number(row.deleted_at),
    createdAtMs: Number(row.created_at),
    updatedAtMs: Number(row.updated_at),
  };
  if (record.updatedAtMs < record.createdAtMs)
    throw new Error('Invalid persisted comment timestamps');
  return record;
}

const commentColumns =
  'id, project_id, issue_id, author_id, body, revision, moderation, deleted_at, created_at, updated_at';

/**
 * PostgreSQL adapter for comments, reactions and the merged timeline,
 * mirroring the D1 store: atomic comment mutations with receipts and outbox
 * rows in one transaction, idempotent reaction writes and grouped counts.
 */
export function createPostgresCommentStore(pool: Pool): CommentStore {
  async function receipt(
    db: Pool,
    intent: CommentMutationIdentity,
    operation: string,
  ): Promise<CommentMutationOutcome | null> {
    const { rows } = await db.query<{
      payload_hash: string;
      expires_at: string;
      result: unknown;
    }>(
      'SELECT payload_hash, expires_at, result FROM mutation_receipts WHERE principal_id = $1 AND project_id = $2 AND operation = $3 AND key_hash = $4',
      [intent.principalId, intent.projectId, operation, intent.keyHash],
    );
    const row = rows[0];
    return replayCommentReceipt(
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
    intent: Parameters<typeof validateCommentIntent>[0],
    operation: 'comment.create' | 'comment.edit',
  ): Promise<CommentMutationOutcome> {
    validateCommentIntent(intent, operation);
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
      let row: CommentRow | undefined;
      if (operation === 'comment.create') {
        const inserted = await db.query<CommentRow>(
          "INSERT INTO comments (id, project_id, issue_id, author_id, body, revision, moderation, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 1, 'visible', $6, $6) RETURNING " +
            commentColumns,
          [
            intent.id,
            intent.projectId,
            intent.issueId,
            intent.principalId,
            intent.body,
            intent.now,
          ],
        );
        row = inserted.rows[0];
        await db.query(
          'INSERT INTO comment_history (id, project_id, comment_id, revision, editor_id, body, changed_at) VALUES ($1, $2, $3, 1, $4, $5, $6)',
          [
            crypto.randomUUID(),
            intent.projectId,
            intent.id,
            intent.principalId,
            intent.body,
            intent.now,
          ],
        );
      } else {
        const updated = await db.query<CommentRow>(
          'UPDATE comments SET body = $1, revision = revision + 1, updated_at = GREATEST(updated_at, $2) WHERE project_id = $3 AND issue_id = $4 AND id = $5 AND revision = $6 RETURNING ' +
            commentColumns,
          [
            intent.body,
            intent.now,
            intent.projectId,
            intent.issueId,
            intent.id,
            (intent as import('@hyperbug/application').CommentEditIntent)
              .expectedRevision,
          ],
        );
        row = updated.rows[0];
        if (!row) {
          const existing = await db.query(
            'SELECT id FROM comments WHERE project_id = $1 AND id = $2',
            [intent.projectId, intent.id],
          );
          throw new Error(
            existing.rowCount ? 'revision-conflict' : 'not-found',
          );
        }
        await db.query(
          'INSERT INTO comment_history (id, project_id, comment_id, revision, editor_id, body, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            crypto.randomUUID(),
            intent.projectId,
            intent.id,
            Number(row.revision),
            intent.principalId,
            intent.body,
            intent.now,
          ],
        );
      }
      const result = {
        id: row!.id,
        projectId: row!.project_id,
        issueId: row!.issue_id,
        revision: Number(row!.revision),
        createdAtMs: Number(row!.created_at),
        updatedAtMs: Number(row!.updated_at),
      };
      await db.query(
        'INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)',
        [
          intent.mutationId,
          intent.projectId,
          intent.issueId,
          operation,
          JSON.stringify({
            commentId: intent.id,
            issueId: intent.issueId,
            mutationId: intent.mutationId,
          }),
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
      const concurrentReplay = await receipt(pool, intent, operation);
      if (concurrentReplay) return concurrentReplay;
      throw error;
    } finally {
      db.release();
    }
  }
  return {
    create: (intent) => mutate(intent, 'comment.create'),
    edit: (intent) => mutate(intent, 'comment.edit'),
    async moderate(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updated = await client.query<CommentRow>(
          'UPDATE comments SET moderation = $1, updated_at = GREATEST(updated_at, $2) WHERE project_id = $3 AND id = $4 RETURNING issue_id',
          [input.moderation, input.nowMs, input.projectId, input.id],
        );
        const target = updated.rows[0];
        if (!target) {
          await client.query('ROLLBACK');
          return null;
        }
        await client.query(
          "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES ($1, $2, $3, 'comment.moderated', $4::jsonb, $5, $5)",
          [
            crypto.randomUUID(),
            input.projectId,
            target.issue_id,
            JSON.stringify({
              commentId: input.id,
              moderation: input.moderation,
              actorId: input.actorId,
            }),
            input.nowMs,
          ],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
      const { rows } = await pool.query<CommentRow>(
        `SELECT ${commentColumns} FROM comments WHERE project_id = $1 AND id = $2 LIMIT 1`,
        [input.projectId, input.id],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async remove(input) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const updated = await client.query<CommentRow>(
          'UPDATE comments SET deleted_at = $1, updated_at = GREATEST(updated_at, $1) WHERE project_id = $2 AND id = $3 AND deleted_at IS NULL RETURNING issue_id',
          [input.nowMs, input.projectId, input.id],
        );
        const target = updated.rows[0];
        if (!target) {
          await client.query('ROLLBACK');
          return null;
        }
        await client.query(
          "INSERT INTO outbox (id, project_id, aggregate_id, event_type, payload, created_at, available_at) VALUES ($1, $2, $3, 'comment.deleted', $4::jsonb, $5, $5)",
          [
            crypto.randomUUID(),
            input.projectId,
            target.issue_id,
            JSON.stringify({
              commentId: input.id,
              actorId: input.actorId,
            }),
            input.nowMs,
          ],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
      const { rows } = await pool.query<CommentRow>(
        `SELECT ${commentColumns} FROM comments WHERE project_id = $1 AND id = $2 LIMIT 1`,
        [input.projectId, input.id],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async get(projectId, issueId, id, options) {
      const hidden =
        options?.includeHidden === true
          ? ''
          : " AND moderation = 'visible' AND deleted_at IS NULL";
      const { rows } = await pool.query<CommentRow>(
        `SELECT ${commentColumns} FROM comments WHERE project_id = $1 AND issue_id = $2 AND id = $3${hidden} LIMIT 1`,
        [projectId, issueId, id],
      );
      return rows[0] ? toRecord(rows[0]) : null;
    },
    async listByIssue(query: CommentQuery) {
      const { limit, cursor } = commentPageOptions(query);
      let where = 'project_id = $1 AND issue_id = $2';
      const values: (string | number)[] = [query.projectId, query.issueId];
      if (query.includeHidden !== true)
        where += " AND moderation = 'visible' AND deleted_at IS NULL";
      if (cursor) {
        where += ` AND (created_at > $${values.length + 1} OR (created_at = $${values.length + 1} AND id > $${values.length + 2}))`;
        values.push(cursor.time, cursor.id);
      }
      values.push(limit + 1);
      const { rows } = await pool.query<CommentRow>(
        `SELECT ${commentColumns} FROM comments WHERE ${where} ORDER BY created_at, id LIMIT $${values.length}`,
        values,
      );
      return commentPage(query, rows.map(toRecord));
    },
    async history(projectId, commentId) {
      const { rows } = await pool.query<{
        id: string;
        comment_id: string;
        revision: string | number;
        editor_id: string;
        body: string;
        changed_at: string | number;
      }>(
        'SELECT id, comment_id, revision, editor_id, body, changed_at FROM comment_history WHERE project_id = $1 AND comment_id = $2 ORDER BY revision LIMIT 100',
        [projectId, commentId],
      );
      return {
        entries: rows.map((row) => ({
          historyId: row.id,
          commentId: row.comment_id,
          revision: Number(row.revision),
          editorId: row.editor_id,
          body: row.body,
          changedAtMs: Number(row.changed_at),
        })),
      };
    },
  };
}

export function createPostgresReactionStore(pool: Pool): ReactionStore {
  const targetColumns = (input: { issueId?: string; commentId?: string }) =>
    input.issueId !== undefined
      ? { issue: input.issueId as string, comment: null }
      : { issue: null, comment: input.commentId as string };
  return {
    async add(input: ReactionAddInput) {
      validateReactionInput(input);
      const target = targetColumns(input);
      const { rows } = await pool.query(
        `INSERT INTO reactions (id, project_id, issue_id, comment_id, principal_id, reaction, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT ${
          target.issue !== null
            ? '(issue_id, principal_id, reaction)'
            : '(comment_id, principal_id, reaction)'
        } DO NOTHING RETURNING id`,
        [
          crypto.randomUUID(),
          input.projectId,
          target.issue,
          target.comment,
          input.principalId,
          input.reaction,
          input.nowMs,
        ],
      );
      return rows.length === 0 ? 'present' : 'added';
    },
    async remove(input) {
      validateReactionInput(input);
      const target = targetColumns(input);
      const result = await pool.query(
        target.issue !== null
          ? 'DELETE FROM reactions WHERE project_id = $1 AND issue_id = $2 AND principal_id = $3 AND reaction = $4'
          : 'DELETE FROM reactions WHERE project_id = $1 AND comment_id = $2 AND principal_id = $3 AND reaction = $4',
        [
          input.projectId,
          target.issue ?? target.comment,
          input.principalId,
          input.reaction,
        ],
      );
      return result.rowCount === 1 ? 'removed' : 'absent';
    },
    async issueCounts(projectId, issueIds) {
      if (issueIds.length === 0) return new Map();
      const { rows } = await pool.query<{
        issue_id: string;
        reaction: ReactionValue;
        count: string | number;
      }>(
        'SELECT issue_id, reaction, COUNT(*) AS count FROM reactions WHERE project_id = $1 AND issue_id = ANY($2::uuid[]) GROUP BY issue_id, reaction',
        [projectId, [...issueIds]],
      );
      return groupCounts(
        rows.map((row) => ({
          ...row,
          count: Number(row.count),
        })),
        (row) => row.issue_id,
      );
    },
    async commentCounts(projectId, commentIds) {
      if (commentIds.length === 0) return new Map();
      const { rows } = await pool.query<{
        comment_id: string;
        reaction: ReactionValue;
        count: string | number;
      }>(
        'SELECT comment_id, reaction, COUNT(*) AS count FROM reactions WHERE project_id = $1 AND comment_id = ANY($2::uuid[]) GROUP BY comment_id, reaction',
        [projectId, [...commentIds]],
      );
      return groupCounts(
        rows.map((row) => ({
          ...row,
          count: Number(row.count),
        })),
        (row) => row.comment_id,
      );
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
  revision: string | number;
  moderation: 'visible' | 'hidden' | 'redacted' | null;
  deleted: string | number | null;
  created_at: string | number;
}

export function createPostgresTimelineStore(pool: Pool): TimelineStore {
  return {
    async timeline(query: TimelineQuery) {
      const { limit, cursor } = timelinePageOptions(query);
      const commentProjection =
        query.includeHidden === true
          ? "CASE WHEN moderation = 'visible' AND deleted_at IS NULL THEN body ELSE NULL END AS body, moderation, deleted_at AS deleted"
          : "NULL AS body, 'visible' AS moderation, NULL AS deleted";
      const commentWhere =
        query.includeHidden === true
          ? 'TRUE'
          : "moderation = 'visible' AND deleted_at IS NULL";
      const values: (string | number)[] = [
        query.projectId,
        query.issueId,
        query.projectId,
        query.issueId,
      ];
      let cursorClause = '';
      if (cursor) {
        values.push(cursor.time, cursor.id);
        const timeIndex = values.length - 1;
        cursorClause = ` WHERE created_at > $${timeIndex} OR (created_at = $${timeIndex} AND id > $${values.length})`;
      }
      values.push(limit + 1);
      const { rows } = await pool.query<TimelineRow>(
        `SELECT * FROM (SELECT 'event' AS kind, id, action, actor_id, system_actor, NULL AS body, NULL AS moderation, NULL AS deleted, aggregate_revision AS revision, created_at FROM timeline_events WHERE project_id = $1 AND issue_id = $2 UNION ALL SELECT 'comment' AS kind, id, NULL AS action, author_id AS actor_id, NULL AS system_actor, ${commentProjection}, revision, created_at FROM comments WHERE project_id = $3 AND issue_id = $4 AND ${commentWhere})${cursorClause} ORDER BY created_at, id LIMIT $${values.length}`,
        values,
      );
      const items: TimelineItem[] = rows.map((row) =>
        row.kind === 'event'
          ? {
              kind: 'event',
              id: row.id,
              action: row.action as string,
              actorId: row.actor_id,
              systemActor: row.system_actor,
              revision: Number(row.revision),
              createdAtMs: Number(row.created_at),
            }
          : {
              kind: 'comment',
              id: row.id,
              actorId: row.actor_id as string,
              revision: Number(row.revision),
              moderation: (row.moderation ?? 'visible') as
                | 'visible'
                | 'hidden'
                | 'redacted',
              deleted: row.deleted !== null,
              body: row.body,
              createdAtMs: Number(row.created_at),
            },
      );
      return timelinePage(query, items);
    },
  };
}
