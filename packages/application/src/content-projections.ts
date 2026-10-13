import { assertId } from '@hyperbug/domain';

export interface ProjectionRow {
  readonly id: string;
  readonly revision: number;
  readonly body: string;
}
export interface ProjectionBackfillQuery {
  readonly projectId: string;
  readonly resource: 'issues' | 'comments';
  readonly after?: string;
  readonly limit?: number;
}
export interface ProjectionBackfillResult {
  readonly processed: number;
  readonly updated: number;
  readonly rejectedIds: readonly string[];
  readonly nextCursor: string | null;
}
export interface ContentProjectionStore {
  /** Explicit operator task, never invoked by a read or scheduled here. */
  backfill(query: ProjectionBackfillQuery): Promise<ProjectionBackfillResult>;
}
export function projectionBackfillOptions(query: ProjectionBackfillQuery) {
  assertId(query.projectId);
  if (query.resource !== 'issues' && query.resource !== 'comments')
    throw new Error('Invalid projection resource');
  const limit = query.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid projection page');
  if (query.after !== undefined) assertId(query.after);
  return {
    projectId: query.projectId,
    resource: query.resource,
    limit,
    after: query.after ?? null,
  };
}
