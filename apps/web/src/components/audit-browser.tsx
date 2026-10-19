import { Link } from '@tanstack/react-router';
import { manageRoute } from '../app.tsx';
import { useProductQuery } from '../product-api.ts';
import { QueryStatus } from './product.tsx';
export function AuditBrowser({ projectId }: { projectId: string }) {
  const search = manageRoute.useSearch();
  const audit = useProductQuery('GET /api/v1/projects/{projectId}/audit', {
    params: { projectId },
    query: {
      limit: 20,
      ...(search.auditAfter ? { after: search.auditAfter } : {}),
    },
  });
  return (
    <section>
      <h2>Project audit trail</h2>
      <p>
        Administrator access only. This view omits metadata, secret values and
        request identifiers. Each page is authorized against current
        permissions.
      </p>
      <QueryStatus query={audit} />
      {audit.data ? (
        <>
          <ol className="timeline">
            {audit.data.items.map((event) => (
              <li key={event.id}>
                <time dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>{' '}
                · {event.action} · {event.result}
                <p>
                  Actor: {event.actorId ?? event.systemActor} · Target:{' '}
                  {event.targetId}
                </p>
              </li>
            ))}
          </ol>
          {!audit.data.items.length ? <p>No project audit events.</p> : null}
          <nav aria-label="Audit pages">
            <Link
              to="/projects/$projectId/manage"
              params={{ projectId }}
              search={{ auditAfter: '' }}
            >
              First audit page
            </Link>
            {audit.data.nextCursor ? (
              <Link
                to="/projects/$projectId/manage"
                params={{ projectId }}
                search={{ auditAfter: audit.data.nextCursor }}
              >
                Next audit page
              </Link>
            ) : null}
          </nav>
        </>
      ) : null}
    </section>
  );
}
