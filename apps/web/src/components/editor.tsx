import { ApiClientError } from '@hyperbug/api-client';
import { useId, useRef, useState, type ReactNode } from 'react';
import { useForm } from '../forms.ts';
import { ErrorSummary, Field } from './ui.tsx';
import { productError } from '../product-state.ts';
import { ContentPreview } from './content-preview.tsx';

/** Drafts live only in this identity-keyed route. Never browser persistence. */
export function ContentEditor({
  titleLabel,
  initialTitle = '',
  initialBody = '',
  submitLabel,
  onSave,
  children,
  projectId,
}: {
  titleLabel?: string;
  initialTitle?: string;
  initialBody?: string;
  submitLabel: string;
  onSave: (
    value: { title: string; body: string },
    key: string,
  ) => Promise<void>;
  children?: ReactNode;
  projectId?: string;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const save = useRef(onSave);
  const [submitted, setSubmitted] = useState(false);
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});
  const summary = useRef<HTMLElement>(null);
  const receipt = useRef({ fingerprint: '', key: crypto.randomUUID() });
  const form = useForm({
    defaultValues: { title: initialTitle, body: initialBody },
    onSubmit: async ({ value }) => {
      const fingerprint = JSON.stringify(value);
      if (fingerprint !== receipt.current.fingerprint)
        receipt.current = { fingerprint, key: crypto.randomUUID() };
      setError('');
      setSending(true);
      try {
        await save.current(value, receipt.current.key);
        setUncertain(false);
        form.reset();
        setSubmitted(false);
        setBlurred({});
        receipt.current = { fingerprint: '', key: crypto.randomUUID() };
      } catch (failure) {
        setError(productError(failure));
        setUncertain(failure instanceof ApiClientError && failure.ambiguous);
      } finally {
        setSending(false);
      }
    },
  });
  const titleError = (value: string) =>
    titleLabel && (!value.trim() || [...value].length > 200)
      ? 'Enter a title of 1–200 characters.'
      : undefined;
  const bodyError = (value: string) =>
    !value.trim() || [...value].length > 32768
      ? 'Enter content of 1–32,768 characters.'
      : undefined;
  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitted(true);
        await form.handleSubmit();
        if (!form.state.isValid)
          requestAnimationFrame(() => summary.current?.focus());
      }}
    >
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <ErrorSummary
            summaryRef={summary}
            errors={
              submitted
                ? [
                    ...(titleError(values.title)
                      ? [
                          {
                            fieldId: titleId,
                            message: titleError(values.title)!,
                          },
                        ]
                      : []),
                    ...(bodyError(values.body)
                      ? [
                          {
                            fieldId: bodyId,
                            message: bodyError(values.body)!,
                          },
                        ]
                      : []),
                  ]
                : []
            }
          />
        )}
      </form.Subscribe>
      {titleLabel ? (
        <form.Field
          name="title"
          validators={{
            onBlur: ({ value }) => titleError(value),
            onChange: ({ value }) => titleError(value),
          }}
        >
          {(field) => (
            <Field
              id={titleId}
              readOnly={uncertain || sending}
              name="title"
              label={titleLabel}
              hint="Maximum 200 characters."
              required
              maxLength={400}
              value={field.state.value}
              interacted={submitted || Boolean(blurred.title)}
              error={titleError(field.state.value) ?? ''}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={() => {
                setBlurred((previous) => ({ ...previous, title: true }));
                field.handleBlur();
              }}
            />
          )}
        </form.Field>
      ) : null}
      <form.Field
        name="body"
        validators={{
          onBlur: ({ value }) => bodyError(value),
          onChange: ({ value }) => bodyError(value),
        }}
      >
        {(field) => {
          const invalid =
            (submitted || blurred.body) && bodyError(field.state.value);
          return (
            <div className="field">
              <label htmlFor={bodyId}>Content (required)</label>
              <p id={`${bodyId}-hint`} className="field-hint">
                Markdown is supported. Drafts stay in memory on this page and
                are cleared on navigation, reload, sign-out or permission loss.
                Maximum 32,768 characters. Enter inserts a newline.
              </p>
              <textarea
                id={bodyId}
                readOnly={uncertain || sending}
                name="body"
                rows={9}
                required
                maxLength={65536}
                aria-describedby={`${bodyId}-hint${invalid ? ` ${bodyId}-error` : ''}`}
                aria-invalid={invalid ? true : undefined}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={() => {
                  setBlurred((previous) => ({ ...previous, body: true }));
                  field.handleBlur();
                }}
              />
              {invalid ? (
                <p id={`${bodyId}-error`} className="field-error">
                  Error: {invalid}
                </p>
              ) : null}
            </div>
          );
        }}
      </form.Field>
      {children}
      {projectId ? (
        <form.Subscribe selector={(state) => state.values.body}>
          {(body) => <ContentPreview projectId={projectId} input={{ body }} />}
        </form.Subscribe>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <button type="submit" disabled={pending}>
            {pending ? 'Saving…' : submitLabel}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
