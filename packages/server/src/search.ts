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
    if (error instanceof SearchError) throw new RequestFailure(error.code);
    throw new RequestFailure('SEARCH_UNAVAILABLE');
  }
}
