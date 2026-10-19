import { useId, useState } from 'react';
import { useProductApi, useProductQuery } from '../product-api.ts';
import { productError } from '../product-state.ts';
import { QueryStatus } from './product.tsx';
const values = [
  'thumbs_up',
  'thumbs_down',
  'laugh',
  'hooray',
  'confused',
  'heart',
  'rocket',
  'eyes',
] as const;
export function Reactions({
  projectId,
  issueId,
  commentId,
}: {
  projectId: string;
  issueId: string;
  commentId?: string;
}) {
  const api = useProductApi();
  const id = useId();
  const [reaction, setReaction] =
    useState<(typeof values)[number]>('thumbs_up');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const issue = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}/reactions',
    { params: { projectId, issueId } },
    !commentId,
  );
  const comment = useProductQuery(
    'GET /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}/reactions',
    { params: { projectId, issueId, commentId: commentId ?? '' } },
    Boolean(commentId),
  );
  const query = commentId ? comment : issue;
  async function apply(remove: boolean) {
    setPending(true);
    setMessage('');
    try {
      if (commentId) {
        if (remove)
          await api.request(
            'DELETE /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}/reactions/{reaction}',
            { params: { projectId, issueId, commentId, reaction } },
          );
        else
          await api.request(
            'POST /api/v1/projects/{projectId}/issues/{issueId}/comments/{commentId}/reactions',
            { params: { projectId, issueId, commentId }, body: { reaction } },
          );
      } else if (remove)
        await api.request(
          'DELETE /api/v1/projects/{projectId}/issues/{issueId}/reactions/{reaction}',
          { params: { projectId, issueId, reaction } },
        );
      else
        await api.request(
          'POST /api/v1/projects/{projectId}/issues/{issueId}/reactions',
          { params: { projectId, issueId }, body: { reaction } },
        );
      await query.refetch();
    } catch (error) {
      setMessage(productError(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-label="Reactions">
      <QueryStatus query={query} />
      <p>
        {query.data?.reactions
          .map(
            (entry) => `${entry.reaction.replaceAll('_', ' ')} ${entry.count}`,
          )
          .join(' · ') || 'No reactions yet.'}
      </p>
      {api.state.account ? (
        <>
          <label htmlFor={id}>Choose a reaction</label>
          <select
            id={id}
            value={reaction}
            onChange={(event) =>
              setReaction(event.target.value as (typeof values)[number])
            }
          >
            {values.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <div className="actions">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                void apply(false);
              }}
            >
              Add reaction
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                void apply(true);
              }}
            >
              Remove my reaction
            </button>
          </div>
        </>
      ) : null}
      <output>{message}</output>
    </section>
  );
}
