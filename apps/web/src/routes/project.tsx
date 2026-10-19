import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { projectRoute, useInstance } from '../app.tsx';
import { useProductQuery } from '../product-api.ts';
import { ProjectNav, QueryStatus } from '../components/product.tsx';
import { projectIdPattern } from '../product-state.ts';

export function Project() {
  const { projectId } = projectRoute.useParams();
  const search = projectRoute.useSearch();
  const navigate = projectRoute.useNavigate();
  const { data: instance } = useInstance();
  const [edit, setEdit] = useState({ source: search.q, value: search.q });
  const text = edit.source === search.q ? edit.value : search.q;
  const composing = useRef(false);
  const valid = projectIdPattern.test(projectId);
  // URL commits (including back/forward) are authoritative. Debounce only edits.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (search.q !== undefined) clearTimeout(timer.current);
  }, [search.q]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const project = useProductQuery(
    'GET /api/v1/projects/{projectId}',
    { params: { projectId } },
    valid,
  );
  const labels = useProductQuery(
    'GET /api/v1/projects/{projectId}/labels',
    { params: { projectId } },
    valid,
  );
  const types = useProductQuery(
    'GET /api/v1/projects/{projectId}/issue-types',
    { params: { projectId } },
    valid,
  );
  const milestones = useProductQuery(
    'GET /api/v1/projects/{projectId}/milestones',
    { params: { projectId } },
    valid,
  );
  const results = useProductQuery(
    'GET /api/v1/projects/{projectId}/search',
    {
      params: { projectId },
      query: {
        q: search.q,
        limit: instance?.tier === 'cloudflare-minimum' ? 10 : 20,
        ...(search.after ? { after: search.after } : {}),
      },
    },
    valid && !search.invalid,
  );
  function commit(q: string) {
    clearTimeout(timer.current);
    void navigate({ search: { q, after: '', sort: 'created_desc' } });
  }
  if (!valid)
    return (
      <>
        <h1>Invalid project address</h1>
        <Link to="/">Choose a project</Link>
      </>
    );
  return (
    <>
      <p className="eyebrow">{project.data?.slug ?? 'Project'}</p>
      <h1 className="project-heading">
        {project.data?.name ?? 'Project issues'}
      </h1>
      <div className="project-load-status">
        <QueryStatus query={project} />
      </div>
      <ProjectNav projectId={projectId} />
      {project.data?.status === 'archived' ? (
        <output>This project is archived and read-only.</output>
      ) : null}
      <form
        aria-label="Project issue search"
        onSubmit={(event) => {
          event.preventDefault();
          if (!composing.current) commit(text);
        }}
      >
        <div className="field">
          <label htmlFor="issue-search">Search issues</label>
          <p id="search-help" className="field-hint">
            Use words, “quoted phrases”, state:open, label:ID, type:ID,
            milestone:ID, author:me or assignee:me. Maximum 512 characters;
            newest first. Search covers{' '}
            {instance?.search.textScope === 'title'
              ? 'titles only'
              : 'titles and bodies'}
            .
          </p>
          <input
            id="issue-search"
            name="q"
            type="search"
            value={text}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="search-help"
            onCompositionStart={() => {
              composing.current = true;
              clearTimeout(timer.current);
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              const q = event.currentTarget.value;
              timer.current = setTimeout(() => commit(q), 350);
            }}
            onChange={(event) => {
              const q = event.currentTarget.value;
              setEdit({ source: search.q, value: q });
              clearTimeout(timer.current);
              if (!composing.current)
                timer.current = setTimeout(() => commit(q), 350);
            }}
          />
        </div>
        <button type="submit">Search</button>
      </form>
      <details className="taxonomy-summary">
        <summary>Labels, types and milestones</summary>
        <QueryStatus query={labels} />
        <QueryStatus query={types} />
        <QueryStatus query={milestones} />
        <h2>Labels</h2>
        <ul>
          {labels.data?.labels.map((label) => (
            <li key={label.id}>
              <button type="button" onClick={() => commit(`label:${label.id}`)}>
                {label.name}
              </button>{' '}
              {label.description}
            </li>
          ))}
        </ul>
        <h2>Issue types</h2>
        <ul>
          {types.data?.types
            .filter((type) => type.enabled)
            .map((type) => (
              <li key={type.id}>
                <button type="button" onClick={() => commit(`type:${type.id}`)}>
                  {type.name}
                </button>{' '}
                {type.description}
              </li>
            ))}
        </ul>
        <h2>Milestones</h2>
        <ul>
          {milestones.data?.milestones.map((milestone) => (
            <li key={milestone.id}>
              <button
                type="button"
                onClick={() => commit(`milestone:${milestone.id}`)}
              >
                {milestone.title}
              </button>{' '}
              · {milestone.progress.open} open, {milestone.progress.closed}{' '}
              closed · {milestone.state}
            </li>
          ))}
        </ul>
      </details>
      {search.invalid ? (
        <p role="alert">{search.invalid}</p>
      ) : (
        <QueryStatus query={results} />
      )}
      {results.isFetching && !results.isPending ? (
        <output>Updating results…</output>
      ) : null}
      {!search.invalid && !results.isError && results.data ? (
        <section aria-label="Search results" aria-busy={results.isFetching}>
          <output>
            {results.data.items.length} issues on this page · newest first
          </output>
          {!results.data.items.length ? (
            <p>
              No matching issues. Try a different search or submit feedback.
            </p>
          ) : (
            <ul className="issue-list">
              {results.data.items.map((issue) => (
                <li key={issue.id}>
                  <Link
                    to="/projects/$projectId/issues/$issueId/$number"
                    params={{
                      projectId,
                      issueId: issue.id,
                      number: String(issue.number),
                    }}
                    search={{ cursor: '', comment: '' }}
                  >
                    #{issue.number} {issue.title}
                  </Link>
                  <p className="issue-meta">
                    {issue.state}
                    {issue.closeReason
                      ? ` · ${issue.closeReason.replaceAll('_', ' ')}`
                      : ''}{' '}
                    · {new Date(issue.createdAt).toLocaleDateString()}
                  </p>
                  {issue.preview ? <p>{issue.preview}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <nav aria-label="Issue pages">
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              search={{ ...search, after: '' }}
            >
              First page
            </Link>
            {results.data.nextCursor ? (
              <Link
                to="/projects/$projectId"
                params={{ projectId }}
                search={{ ...search, after: results.data.nextCursor }}
              >
                Next page
              </Link>
            ) : null}
          </nav>
        </section>
      ) : null}
      {search.invalid ? (
        <button type="button" onClick={() => commit(text)}>
          Search from first page
        </button>
      ) : null}
    </>
  );
}
