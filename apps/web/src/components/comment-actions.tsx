import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { QueryStatus } from './product.tsx';
import { ContentEditor } from './editor.tsx';
import { Reactions } from './reactions.tsx';
import { CommandForm } from './command-form.tsx';
export function CommentActions({
  projectId,
  issueId,
  commentId,
  authorId,
}: {
  projectId: string;
  issueId: string;
  commentId: string;
  authorId: string | null;
}) {
  const api = useProductApi();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editGeneration, setEditGeneration] = useState(0);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const comment = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}',
    { params: { projectId, issueId, commentId } },
    editing,
  );
  const history = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}/history',
    { params: { projectId, issueId, commentId } },
    historyOpen,
  );
  const [editSnapshot, setEditSnapshot] = useState<typeof comment.data>();
  async function changed(work: Promise<unknown>) {
    await work;
    await cache.invalidateQueries({
      queryKey: ['product', api.origin, api.state.epoch],
    });
  }
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Comment actions and reactions</summary>
      {open ? (
        <>
          <Reactions
            projectId={projectId}
            issueId={issueId}
            commentId={commentId}
          />
          {api.state.account?.principalId === authorId ? (
            <>
              <button
                type="button"
                onClick={async () => {
                  setEditing(false);
                  if (!editing) {
                    const result = await comment.refetch();
                    if (result.isSuccess) {
                      setEditSnapshot(result.data);
                      setEditGeneration((value) => value + 1);
                      setEditing(true);
                    }
                  }
                }}
              >
                {editing ? 'Cancel comment edit' : 'Edit comment'}
              </button>
              {comment.isFetched ? <QueryStatus query={comment} /> : null}
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      setEditing(false);
                      const result = await comment.refetch();
                      if (result.isSuccess) {
                        setEditSnapshot(result.data);
                        setEditGeneration((value) => value + 1);
                        setEditing(true);
                      }
                    }}
                  >
                    Discard comment draft and reload latest
                  </button>
                  {editSnapshot?.body !== undefined ? (
                    <ContentEditor
                      key={editGeneration}
                      projectId={projectId}
                      initialBody={editSnapshot.body}
                      submitLabel="Save comment"
                      onSave={async (value, key) => {
                        await changed(
                          api.request(
                            'PATCH /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}',
                            {
                              params: { projectId, issueId, commentId },
                              body: {
                                expectedRevision: editSnapshot.revision,
                                body: value.body,
                              },
                              idempotencyKey: key,
                            },
                          ),
                        );
                        setEditing(false);
                      }}
                    />
                  ) : null}
                </>
              ) : null}
              <CommandForm
                label="Delete my comment"
                confirm
                fields={[]}
                onSave={() =>
                  changed(
                    api.request(
                      'DELETE /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}',
                      { params: { projectId, issueId, commentId }, body: {} },
                    ),
                  )
                }
              />
            </>
          ) : null}
          {api.state.account?.kind === 'staff' ? (
            <>
              <button type="button" onClick={() => setHistoryOpen(true)}>
                View edit history (Maintainer)
              </button>
              {historyOpen ? (
                <>
                  <QueryStatus query={history} />
                  <p>Historical content is shown as original Markdown text.</p>
                  {history.data?.entries.map((entry) => (
                    <section key={entry.id}>
                      <h3>Revision {entry.revision}</h3>
                      <time dateTime={entry.changedAt}>
                        {new Date(entry.changedAt).toLocaleString()}
                      </time>
                      <pre>{entry.body}</pre>
                    </section>
                  ))}
                </>
              ) : null}
              <CommandForm
                label="Moderate comment"
                confirm
                fields={[
                  {
                    name: 'moderation',
                    label: 'Moderation state (Maintainer)',
                    value: 'visible',
                    options: ['visible', 'hidden', 'redacted'],
                  },
                ]}
                onSave={(value) =>
                  changed(
                    api.request(
                      'POST /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}/moderate',
                      {
                        params: { projectId, issueId, commentId },
                        body: {
                          moderation: value.moderation as
                            | 'visible'
                            | 'hidden'
                            | 'redacted',
                        },
                      },
                    ),
                  )
                }
              />
            </>
          ) : null}
        </>
      ) : null}
    </details>
  );
}
