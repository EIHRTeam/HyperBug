import type {
  SearchIndexStore,
  SearchBackfillQuery,
} from '@hyperbug/application';
import { credentialFactsOf, requireAuthorizedAction } from './authorization.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
import { securityDecisionTimeoutMs, storeWriteTimeoutMs } from './bounds.ts';
import {
  parseSearchQuery,
  SearchError,
  searchFields,
  type SearchStore,
  type SearchFilter,
} from '@hyperbug/application';
import { projectBearer, readProject, type ProjectContext } from './projects.ts';
import { viewOf, type IssuePageView } from './issues.ts';
import { storeReadTimeoutMs, withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

export interface SearchContext extends ProjectContext {
  readonly search: SearchStore | null;
  readonly index: SearchIndexStore | null;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'requireRate'> | null;
  readonly tier: 'standard' | 'cloudflare-minimum';
}
/** Shared project permission path precedes index availability, for both operations. */
export async function searchIssues(
  request: Request,
  context: SearchContext,
  projectId: string,
  query: {
    q?: string | undefined;
    limit?: number | undefined;
    after?: string | undefined;
    field?: string;
  },
): Promise<
  IssuePageView | { items: { field: SearchFilter; value: string }[] }
> {
  await readProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  try {
    const ast = parseSearchQuery(query.q ?? '', principal?.principalId);
    if (
      query.field !== undefined &&
      !searchFields.includes(query.field as SearchFilter)
    )
      throw new SearchError('SEARCH_UNSUPPORTED');
    if (!context.admission) throw new RequestFailure('RATE_LIMIT_UNAVAILABLE');
    const rule = {
      limit: context.tier === 'cloudflare-minimum' ? 30 : 120,
      windowMs: 60000,
      retentionMs: 86400000,
    };
    await context.admission.requireRate({
      request,
      category: 'search',
      checks: [
        { dimension: 'ip', rule },
        { dimension: 'route', canonicalSubject: 'issue-search', rule },
      ],
      nowMs: Date.now(),
      signal: request.signal,
      timeoutMs: securityDecisionTimeoutMs(request.signal),
    });
    if (!context.search) throw new SearchError('SEARCH_UNAVAILABLE');
    const page = await withDeadline(
      request.signal,
      Math.min(1000, storeReadTimeoutMs(request.signal)),
      () =>
        context.search!.search({
          projectId,
          ast,
          ...(principal ? { principalId: principal.principalId } : {}),
          tier: context.tier,
          ...(query.field !== undefined
            ? { limit: context.tier === 'cloudflare-minimum' ? 10 : 25 }
            : query.limit === undefined
              ? {}
              : { limit: query.limit }),
          ...(query.after === undefined ? {} : { after: query.after }),
        }),
    );
    if (query.field !== undefined) {
      const field = query.field as SearchFilter;
      const values = new Set<string>();
      for (const issue of page.items) {
        if (field === 'label' || field === 'assignee') {
          for (const value of (field === 'label'
            ? page.relations.labels
            : page.relations.assignees
          ).get(issue.id) ?? [])
            values.add(value);
        } else {
          const value = {
            state: issue.state,
            project: issue.projectId,
            author: issue.authorId,
            type: issue.typeId,
            milestone: issue.milestoneId,
          }[field];
          if (value !== null) values.add(value);
        }
      }
      return {
        items: [...values]
          .sort()
          .slice(0, 10)
          .map((value) => ({ field, value })),
      };
    }
    return {
      items: page.items.map((issue) =>
        viewOf(
          issue,
          page.relations.labels.get(issue.id) ?? [],
          page.relations.assignees.get(issue.id) ?? [],
        ),
      ),
      nextCursor: page.nextCursor,
    };
  } catch (error) {
    if (error instanceof RequestFailure && error.code !== 'REQUEST_TIMEOUT')
      throw error;
    if (error instanceof SearchError) throw new RequestFailure(error.code);
    throw new RequestFailure('SEARCH_UNAVAILABLE');
  }
}

/** Administrator-triggered operator service, deliberately not a new public endpoint. One call = one bounded page. */
export async function reindexSearch(
  request: Request,
  context: SearchContext,
  projectId: string,
  query: Pick<SearchBackfillQuery, 'after' | 'limit'> = {},
) {
  await readProject(request, context, projectId);
  const principal = await projectBearer(request, context);
  if (!principal) throw new RequestFailure('AUTHENTICATION_REQUIRED');
  if (!context.authorizationResolver)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  await requireAuthorizedAction({
    httpRequest: request,
    request: {
      actorId: principal.principalId,
      permission: 'project:configure',
      target: { projectId, type: 'project', id: projectId },
    },
    resolver: context.authorizationResolver,
    policy: context.authorizationPolicy,
    signal: request.signal,
    credential: credentialFactsOf(principal),
  });
  if (!context.index) throw new RequestFailure('SEARCH_UNAVAILABLE');
  try {
    return await withDeadline(
      request.signal,
      Math.min(1000, storeWriteTimeoutMs(request.signal)),
      (signal) =>
        context.index!.backfill({
          ...query,
          projectId,
          tier: context.tier,
          signal,
        }),
    );
  } catch (error) {
    if (error instanceof SearchError) throw new RequestFailure(error.code);
    throw new RequestFailure('SEARCH_UNAVAILABLE');
  }
}
