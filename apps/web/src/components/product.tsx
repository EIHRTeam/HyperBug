import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useAuth } from '../app.tsx';
import { productError } from '../product-state.ts';

export function QueryStatus({
  query,
}: {
  query: Pick<
    UseQueryResult,
    'isPending' | 'isError' | 'error' | 'refetch' | 'isFetching'
  >;
}) {
  if (query.isPending) return <output>Loading…</output>;
  if (!query.isError) return null;
  return (
    <div className="state-message">
      <p role="alert">{productError(query.error)}</p>
      <button
        type="button"
        disabled={query.isFetching}
        onClick={() => {
          void query.refetch();
        }}
      >
        Try again
      </button>
    </div>
  );
}
export function ProjectNav({ projectId }: { projectId: string }) {
  const { state } = useAuth();
  return (
    <nav className="section-nav" aria-label="Project">
      <Link
        to="/projects/$projectId"
        params={{ projectId }}
        search={{ q: '', after: '', sort: 'created_desc' }}
      >
        Issues
      </Link>
      <Link to="/projects/$projectId/new" params={{ projectId }}>
        New issue
      </Link>
      {state.account?.kind === 'staff' ? (
        <Link
          to="/projects/$projectId/manage"
          params={{ projectId }}
          search={{ auditAfter: '' }}
        >
          Manage project
        </Link>
      ) : null}
    </nav>
  );
}
