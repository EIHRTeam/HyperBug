import { useEffect, useRef, useState } from 'react';
import type { OperationTypes } from '@hyperbug/api-client';
import { useProductApi } from '../product-api.ts';
import { Markdown } from './markdown.tsx';
import { productError } from '../product-state.ts';
type Input =
  OperationTypes['POST /api/v1/projects/{projectId}/content/preview']['body'];
type Result =
  OperationTypes['POST /api/v1/projects/{projectId}/content/preview']['response'];
export function ContentPreview({
  projectId,
  input,
}: {
  projectId: string;
  input: Input;
}) {
  const api = useProductApi();
  const fingerprint = JSON.stringify(input);
  const [result, setResult] = useState<{
    fingerprint: string;
    value: Result;
  }>();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = fingerprint;
    return () => {
      if (current !== undefined) controller.current?.abort();
    };
  }, [fingerprint]);
  return (
    <section>
      <h3>Preview</h3>
      <p>
        Preview uses the instance’s content policy and shares its comment
        request budget. Previewing does not publish content.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const abort = new AbortController();
          controller.current = abort;
          setPending(true);
          setMessage('');
          try {
            const value = await api.request(
              'POST /api/v1/projects/{projectId}/content/preview',
              { params: { projectId }, body: input, signal: abort.signal },
            );
            if (!abort.signal.aborted) setResult({ fingerprint, value });
          } catch (error) {
            if (!abort.signal.aborted) setMessage(productError(error));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? 'Preparing preview…' : 'Preview current content'}
      </button>
      <output>{message}</output>
      {result?.fingerprint === fingerprint ? (
        <Markdown
          tree={result.value.bodyTree}
          version={result.value.contentPolicyVersion}
        />
      ) : result ? (
        <p>The draft changed. Preview again to see current content.</p>
      ) : null}
    </section>
  );
}
