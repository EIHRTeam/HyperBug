import { assertId, assertInstant } from '@hyperbug/domain';

/**
 * One merged timeline row: an immutable issue event from timeline_events, or
 * a comment joined at read time. Comment items carry the body only when the
 * row is visible and not deleted; moderator views of hidden/redacted rows
 * keep the metadata without the body.
 */
export type TimelineItem =
  | {
      readonly kind: 'event';
      readonly id: string;
      readonly action: string;
      readonly actorId: string | null;
      readonly systemActor: string | null;
      readonly revision: number;
      readonly createdAtMs: number;
    }
  | {
      readonly kind: 'comment';
      readonly id: string;
      readonly actorId: string;
      readonly revision: number;
      readonly moderation: 'visible' | 'hidden' | 'redacted';
      readonly deleted: boolean;
      readonly body: string | null;
      readonly createdAtMs: number;
    };

export interface TimelinePage {
  readonly items: readonly TimelineItem[];
  readonly nextCursor: string | null;
}

export interface TimelineQuery {
  readonly projectId: string;
  readonly issueId: string;
  readonly limit?: number;
  readonly after?: string;
  readonly includeHidden?: boolean;
}

/**
 * Read port for the merged per-issue timeline. Ordering is ascending
 * (created_at, id) with the id as the unique tie-breaker; pagination follows
 * the same cursor contract as the issue list. Actor references are safe DTOs:
 * principal ids or fixed system-actor names, never display names or content.
 */
export interface TimelineStore {
  timeline(query: TimelineQuery): Promise<TimelinePage>;
}

interface TimelineCursor {
  v: 1;
  resource: 'timeline';
  project: string;
  issue: string;
  sort: 'created_asc';
  time: number;
  id: string;
}

export function timelinePageOptions(query: TimelineQuery): {
  limit: number;
  cursor: TimelineCursor | null;
} {
  assertId(query.projectId);
  assertId(query.issueId);
  const limit = query.limit ?? 40;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid timeline page bound');
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
      value.resource !== 'timeline' ||
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
        resource: 'timeline',
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

export function timelinePage(
  query: TimelineQuery,
  rows: readonly TimelineItem[],
): TimelinePage {
  const { limit } = timelinePageOptions(query);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  if (rows.length <= limit || !last) return { items, nextCursor: null };
  const cursor: TimelineCursor = {
    v: 1,
    resource: 'timeline',
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
