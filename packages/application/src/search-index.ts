import { assertId } from '@hyperbug/domain';
import { SearchError } from './search.ts';
import { searchAvailability } from './search-budget.ts';
export interface SearchBackfillQuery {
  projectId: string;
  after?: string;
  limit?: number;
  tier?: 'standard' | 'cloudflare-minimum';
  signal?: AbortSignal;
  event?: SearchIndexEvent;
}
export interface SearchBackfillResult {
  processed: number;
  updated: number;
  rejectedIds: string[];
  nextCursor: string | null;
  usage?: { rowsRead: number; rowsWritten: number; statements: number };
}
export interface SearchIndexStore {
  /** Current canonical readiness; no text/index payloads are returned. */
  ready(query: {
    projectId: string;
    principalId?: string;
    tier?: 'standard' | 'cloudflare-minimum';
  }): Promise<boolean>;
  /** Existing outbox payload's mutation ID locates its immutable timeline revision. */
  revisionOf(
    projectId: string,
    issueId: string,
    mutationId: string,
  ): Promise<number | null>;
  /** Explicit operator/fixture task, bounded and resumable; never invoked by search reads. */
  backfill(query: SearchBackfillQuery): Promise<SearchBackfillResult>;
}
export interface SearchSourceRow {
  id: string;
  revision: number;
  title: string;
  body_text: string | null;
  body_text_version: string | null;
  moderation: string;
  deleted_at: number | string | null;
}
export function searchBackfillOptions(query: SearchBackfillQuery) {
  assertId(query.projectId);
  if (query.after !== undefined) assertId(query.after);
  if (
    query.tier !== undefined &&
    query.tier !== 'standard' &&
    query.tier !== 'cloudflare-minimum'
  )
    throw new SearchError('SEARCH_VALUE');
  const maximum = query.tier === 'cloudflare-minimum' ? 10 : 25;
  const limit = query.limit ?? maximum;
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum)
    throw new SearchError('SEARCH_COMPLEXITY');
  if (query.event !== undefined) {
    validateSearchIndexEvent(query.event);
    if (
      query.event.projectId !== query.projectId ||
      query.after !== undefined ||
      limit !== 1
    )
      throw new SearchError('SEARCH_VALUE');
  }
  query.signal?.throwIfAborted();
  return { projectId: query.projectId, after: query.after ?? null, limit };
}

export { SEARCH_SCAN_LIMITS } from '@hyperbug/contracts';

/** Internal event reference. Module09 obtains revision from the canonical timeline witness. */
export interface SearchIndexEvent {
  version: 1;
  projectId: string;
  issueId: string;
  revision: number;
}
export function validateSearchIndexEvent(event: SearchIndexEvent): void {
  if (
    !event ||
    Object.keys(event).sort().join(',') !==
      'issueId,projectId,revision,version' ||
    event.version !== 1 ||
    !Number.isSafeInteger(event.revision) ||
    event.revision < 1 ||
    event.revision > 2147483647
  )
    throw new SearchError('SEARCH_VALUE');
  try {
    assertId(event.projectId);
    assertId(event.issueId);
  } catch {
    throw new SearchError('SEARCH_VALUE');
  }
}
/** No content from events is trusted. Stale references do not write; later events/reconciliation recover races. */
export function handleSearchIndexEvent(
  store: SearchIndexStore,
  event: SearchIndexEvent,
  tier: 'standard' | 'cloudflare-minimum' = 'standard',
  signal?: AbortSignal,
): Promise<SearchBackfillResult> {
  validateSearchIndexEvent(event);
  return store.backfill({
    projectId: event.projectId,
    event,
    tier,
    limit: 1,
    ...(signal ? { signal } : {}),
  });
}

export interface SearchOutboxEvent {
  projectId: string;
  aggregateId: string;
  eventType: string;
  payload: { issueId: string; mutationId: string };
}
/** Bridge existing Module02 outbox references; no queue/dispatch/scheduling code. */
export async function handleSearchOutboxEvent(
  store: SearchIndexStore,
  event: SearchOutboxEvent,
  tier: 'standard' | 'cloudflare-minimum' = 'standard',
  signal?: AbortSignal,
) {
  if (
    !event ||
    !/^issue\.(create|edit|close|reopen|labels|assignees|type|milestone|moderate|redact|delete)$/u.test(
      event.eventType,
    ) ||
    !event.payload ||
    event.payload.issueId !== event.aggregateId ||
    Object.keys(event.payload).sort().join(',') !== 'issueId,mutationId'
  )
    throw new SearchError('SEARCH_VALUE');
  try {
    assertId(event.projectId);
    assertId(event.aggregateId);
    assertId(event.payload.mutationId);
  } catch {
    throw new SearchError('SEARCH_VALUE');
  }
  signal?.throwIfAborted();
  let revision: number | null;
  try {
    revision = await store.revisionOf(
      event.projectId,
      event.aggregateId,
      event.payload.mutationId,
    );
  } catch (error) {
    throw searchAvailability(error);
  }
  if (revision === null) throw new SearchError('SEARCH_UNAVAILABLE');
  return handleSearchIndexEvent(
    store,
    {
      version: 1,
      projectId: event.projectId,
      issueId: event.aggregateId,
      revision,
    },
    tier,
    signal,
  );
}
