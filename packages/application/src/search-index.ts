import { assertId } from '@hyperbug/domain';
import { SearchError } from './search.ts';
export interface SearchBackfillQuery {
  projectId: string;
  after?: string;
  limit?: number;
  tier?: 'standard' | 'cloudflare-minimum';
  signal?: AbortSignal;
}
export interface SearchBackfillResult {
  processed: number;
  updated: number;
  rejectedIds: string[];
  nextCursor: string | null;
}
export interface SearchIndexStore {
  /** Current canonical readiness; no text/index payloads are returned. */
  ready(query: {
    projectId: string;
    principalId?: string;
    tier?: 'standard' | 'cloudflare-minimum';
  }): Promise<boolean>;
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
  query.signal?.throwIfAborted();
  return { projectId: query.projectId, after: query.after ?? null, limit };
}

/** Fail rather than scan a project above this bounded canonical candidate set. */
export const SEARCH_SCAN_LIMITS = Object.freeze({
  standard: 4096,
  'cloudflare-minimum': 256,
});
