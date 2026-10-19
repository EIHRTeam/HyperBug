import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { issueRoute, useAuth } from '../app.tsx';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { ProjectNav, QueryStatus } from '../components/product.tsx';
import { ContentEditor } from '../components/editor.tsx';
import { Markdown } from '../components/markdown.tsx';
import { projectIdPattern } from '../product-state.ts';
import { Reactions } from '../components/reactions.tsx';
import { CommentActions } from '../components/comment-actions.tsx';
const Triage = lazy(() =>
  import('../components/triage.tsx').then((module) => ({
    default: module.IssueTriage,
  })),
);

export function Issue() {
  const { projectId, issueId, number } = issueRoute.useParams();
  const search = issueRoute.useSearch();
  const { auth, state } = useAuth();
  const api = useProductApi();
  const queries = useQueryClient();
  const [editGeneration, setEditGeneration] = useState(0);
  const [editor, setEditor] = useState(false);
  const timelineHeading = useRef<HTMLHeadingElement>(null);
  const valid =
    projectIdPattern.test(projectId) &&
    projectIdPattern.test(issueId) &&
    /^[1-9][0-9]{0,9}$/.test(number);
  const issue = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}',
    { params: { projectId, issueId } },
    valid,
  );
  const timeline = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}/timeline',
    {
      params: { projectId, issueId },
      query: { limit: 20, ...(search.cursor ? { cursor: search.cursor } : {}) },
    },
    valid,
  );
  const comment = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}',
    { params: { projectId, issueId, commentId: search.comment } },
    valid && Boolean(search.comment),
  );
  const [editSnapshot, setEditSnapshot] = useState<typeof issue.data>();
  useLayoutEffect(() => {
    if (search.cursor && timeline.data) timelineHeading.current?.focus();
  }, [search.cursor, timeline.data]);
  async function refresh() {
    await queries.invalidateQueries({
      queryKey: ['product', api.origin, state.epoch],
    });
  }
  if (!valid) return <h1>Invalid issue address</h1>;
  return (
    <>
      <ProjectNav projectId={projectId} />
      <section className="issue-overview" aria-busy={issue.isPending}>
        <QueryStatus query={issue} />
        {issue.data ? (
          <>
            <p className="eyebrow">
              Issue #{issue.data.number} · {issue.data.state}{' '}
              {issue.data.closeReason?.replaceAll('_', ' ')}
            </p>
            <h1 className="issue-title">{issue.data.title}</h1>
            {state.account?.kind === 'staff' ? (
              <Suspense fallback={<output>Loading triage controls…</output>}>
                <Triage issue={issue.data} />
              </Suspense>
            ) : null}
            {issue.data.moderation !== 'visible' ? (
              <output>
                This issue was {issue.data.moderation}. Its content is
                unavailable.
              </output>
            ) : (
              <Markdown
                tree={issue.data.bodyTree}
                version={issue.data.contentPolicyVersion}
              />
            )}
            {state.account?.principalId === issue.data.authorId ? (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setEditor(false);
                    if (!editor) {
                      const result = await issue.refetch();
                      if (result.isSuccess) {
                        setEditSnapshot(result.data);
                        setEditGeneration((value) => value + 1);
                        setEditor(true);
                      }
                    }
                  }}
                >
                  {editor ? 'Cancel editing' : 'Edit issue'}
                </button>
                {editor && editSnapshot ? (
                  <section aria-label="Edit issue">
                    <button
                      type="button"
                      onClick={async () => {
                        setEditor(false);
                        const result = await issue.refetch();
                        if (result.isSuccess) {
                          setEditSnapshot(result.data);
                          setEditGeneration((value) => value + 1);
                          setEditor(true);
                        }
                      }}
                    >
                      Discard issue draft and reload latest
                    </button>
                    <ContentEditor
                      key={editGeneration}
                      projectId={projectId}
                      titleLabel="Issue title"
                      initialTitle={editSnapshot.title}
                      initialBody={editSnapshot.body}
                      submitLabel="Save issue"
                      onSave={async (value, key) => {
                        await api.request(
                          'PATCH /api/v1/projects/{projectId}/issues/{issueId}',
                          {
                            params: { projectId, issueId },
                            body: {
                              ...value,
                              expectedRevision: editSnapshot.revision,
                            },
                            idempotencyKey: key,
                          },
                        );
                        setEditor(false);
                        await refresh();
                      }}
                    />
                  </section>
                ) : null}
              </>
            ) : null}
            <h2>Reactions</h2>
            <Reactions projectId={projectId} issueId={issueId} />
          </>
        ) : null}
      </section>
      {search.comment ? (
        <section aria-label="Linked comment">
          <h2>Linked comment</h2>
          <QueryStatus query={comment} />
          {comment.data ? (
            <Markdown
              tree={comment.data.bodyTree}
              version={comment.data.contentPolicyVersion}
            />
          ) : null}
        </section>
      ) : null}
      <h2 ref={timelineHeading} tabIndex={-1}>
        Discussion and timeline
      </h2>
      <p>
        One page of 20 entries is shown at a time. Page links preserve browser
        history and keep long discussions bounded.
      </p>
      <div className="project-load-status">
        <QueryStatus query={timeline} />
      </div>
      {timeline.data ? (
        <>
          <ol className="timeline">
            {timeline.data.items.map((entry) => (
              <li key={`${entry.kind}:${entry.id}`} id={`entry-${entry.id}`}>
                <p>
                  {entry.kind === 'event'
                    ? entry.action?.replaceAll('.', ' ')
                    : 'Comment'}{' '}
                  ·{' '}
                  <time dateTime={entry.createdAt}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>{' '}
                  ·{' '}
                  <Link
                    to="/projects/$projectId/issues/$issueId/$number"
                    params={{ projectId, issueId, number }}
                    search={{
                      ...search,
                      comment: entry.kind === 'comment' ? entry.id : '',
                    }}
                    hash={`entry-${entry.id}`}
                  >
                    Permalink
                  </Link>
                </p>
                {entry.kind === 'comment' ? (
                  entry.deleted || entry.moderation !== 'visible' ? (
                    <p>
                      Comment {entry.deleted ? 'deleted' : entry.moderation}.
                    </p>
                  ) : (
                    <Markdown
                      tree={entry.bodyTree}
                      version={entry.contentPolicyVersion}
                    />
                  )
                ) : null}
                {entry.kind === 'comment' ? (
                  <CommentActions
                    projectId={projectId}
                    issueId={issueId}
                    commentId={entry.id}
                    authorId={entry.actorId}
                  />
                ) : null}
              </li>
            ))}
          </ol>
          {!timeline.data.items.length ? <p>No discussion yet.</p> : null}
          <nav aria-label="Timeline pages">
            <Link
              to="/projects/$projectId/issues/$issueId/$number"
              params={{ projectId, issueId, number }}
              search={{ cursor: '', comment: '' }}
            >
              First page
            </Link>
            {timeline.data.nextCursor ? (
              <Link
                to="/projects/$projectId/issues/$issueId/$number"
                params={{ projectId, issueId, number }}
                search={{ cursor: timeline.data.nextCursor, comment: '' }}
              >
                Next timeline page
              </Link>
            ) : null}
          </nav>
        </>
      ) : null}
      {state.account && issue.data ? (
        <section>
          <h2>Add a comment</h2>
          <ContentEditor
            projectId={projectId}
            submitLabel="Post comment"
            onSave={async (value, key) => {
              await api.request(
                'POST /api/v1/projects/{projectId}/issues/{issueId}/comments',
                {
                  params: { projectId, issueId },
                  body: { body: value.body },
                  idempotencyKey: key,
                },
              );
              await refresh();
            }}
          />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            void auth.signIn();
          }}
        >
          Sign in to join the discussion
        </button>
      )}
    </>
  );
}
