import { ApiClientError } from '@hyperbug/api-client';
import { useId, useRef, useState } from 'react';
import { useForm } from '../forms.ts';
import {
  initialAnswers,
  answerError,
  type Answer,
  type FormDocument,
} from '../issue-form-values.ts';
import { ErrorSummary, Field } from './ui.tsx';
import { Markdown } from './markdown.tsx';
import { UploadField } from './upload-field.tsx';
import { productError } from '../product-state.ts';
import { ContentPreview } from './content-preview.tsx';

export function IssueForm({
  document,
  onSave,
}: {
  document: FormDocument;
  onSave: (
    body: {
      formVersion: number;
      draftId: string;
      title: string;
      values: Record<string, Answer>;
    },
    key: string,
  ) => Promise<unknown>;
}) {
  const idPrefix = useId();
  const titleId = `${idPrefix}-title`;
  const [sending, setSending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const save = useRef(onSave);
  const [titleBlurred, setTitleBlurred] = useState(false);
  const titleError = (value: string) =>
    !value.trim() || [...value].length > 200
      ? 'Enter an issue title of 1–200 characters.'
      : undefined;
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const summary = useRef<HTMLElement>(null);
  const [draftId] = useState(() => crypto.randomUUID());
  const receipt = useRef({ fingerprint: '', key: crypto.randomUUID() });
  const form = useForm({
    defaultValues: {
      title: document.definition.title,
      values: initialAnswers(document),
    },
    onSubmit: async ({ value }) => {
      if (
        document.definition.body.some((field) =>
          answerError(field, value.values[field.id]),
        ) ||
        titleError(value.title)
      )
        return;
      const body = { formVersion: document.version, draftId, ...value };
      const fingerprint = JSON.stringify(body);
      if (receipt.current.fingerprint !== fingerprint)
        receipt.current = { fingerprint, key: crypto.randomUUID() };
      setSending(true);
      try {
        setMessage('');
        await save.current(body, receipt.current.key);
        setUncertain(false);
      } catch (error) {
        setMessage(productError(error));
        setUncertain(error instanceof ApiClientError && error.ambiguous);
      } finally {
        setSending(false);
      }
    },
  });
  return (
    <form
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        setSubmitted(true);
        await form.handleSubmit();
        requestAnimationFrame(() => summary.current?.focus());
      }}
    >
      <h2>{document.name}</h2>
      <p>{document.definition.description}</p>
      <p>
        Drafts remain in memory on this page. Reload, navigation or identity
        changes clear them. The form is pinned to version {document.version};
        after a stale-version error, reload and review the latest form.
      </p>
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
                    ...document.definition.body.flatMap((field) => {
                      const error = answerError(field, values.values[field.id]);
                      return error
                        ? [
                            {
                              fieldId: `${idPrefix}-${field.id}`,
                              message: error,
                            },
                          ]
                        : [];
                    }),
                  ]
                : []
            }
          />
        )}
      </form.Subscribe>
      <form.Field name="title">
        {(field) => (
          <Field
            id={titleId}
            name="title"
            label="Issue title"
            hint="Maximum 200 characters."
            required
            readOnly={uncertain || sending}
            maxLength={400}
            value={field.state.value}
            interacted={submitted || titleBlurred}
            error={titleError(field.state.value) ?? ''}
            onChange={(event) => field.handleChange(event.target.value)}
            onBlur={() => {
              setTitleBlurred(true);
              field.handleBlur();
            }}
          />
        )}
      </form.Field>
      {document.definition.body.map((definition) => {
        const rendered = document.renderedFields.find(
          (entry) => entry.id === definition.id,
        );
        if (definition.type === 'markdown')
          return (
            <Markdown
              key={definition.id}
              tree={rendered?.valueTree}
              version={document.contentPolicyVersion}
            />
          );
        return (
          <form.Field key={definition.id} name={`values.${definition.id}`}>
            {(field) => {
              const id = `${idPrefix}-${definition.id}`;
              const error =
                submitted || touched[definition.id]
                  ? answerError(definition, field.state.value)
                  : undefined;
              const help = `${id}-help`;
              const common = {
                id,
                name: definition.id,
                required: definition.validations.required,
                'aria-invalid': error ? (true as const) : undefined,
                'aria-describedby': `${help}${error ? ` ${id}-error` : ''}`,
                onBlur: () => {
                  setTouched((previous) => ({
                    ...previous,
                    [definition.id]: true,
                  }));
                  field.handleBlur();
                },
              };
              const value = field.state.value;
              let control;
              if (
                definition.type === 'input' ||
                definition.type === 'textarea'
              ) {
                const props = {
                  ...common,
                  readOnly: uncertain || sending,
                  value: typeof value === 'string' ? value : '',
                  placeholder: definition.attributes.placeholder,
                  minLength: definition.validations.min_length,
                  maxLength: definition.type === 'input' ? 2048 : 32768,
                  onChange: (event: { target: { value: string } }) =>
                    field.handleChange(event.target.value),
                };
                control =
                  definition.type === 'textarea' ? (
                    <textarea {...props} rows={6} />
                  ) : (
                    <input {...props} />
                  );
              } else if (definition.type === 'dropdown') {
                const selected = Array.isArray(value)
                  ? (value as string[])
                  : typeof value === 'string' && value
                    ? [value]
                    : [];
                control = (
                  <select
                    {...common}
                    disabled={uncertain || sending}
                    multiple={definition.attributes.multiple}
                    value={
                      definition.attributes.multiple
                        ? selected
                        : (selected[0] ?? '')
                    }
                    onChange={(event) =>
                      field.handleChange(
                        definition.attributes.multiple
                          ? [...event.target.selectedOptions]
                              .map((option) => option.value)
                              .filter(Boolean)
                          : event.target.value,
                      )
                    }
                  >
                    <option value="">Choose…</option>
                    {definition.attributes.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                );
              } else if (definition.type === 'checkboxes') {
                const selected = Array.isArray(value)
                  ? (value as number[])
                  : [];
                control = (
                  <fieldset
                    id={id}
                    disabled={uncertain || sending}
                    aria-invalid={common['aria-invalid']}
                    aria-describedby={common['aria-describedby']}
                    tabIndex={-1}
                  >
                    <legend>{definition.attributes.label}</legend>
                    {definition.attributes.options.map((option, index) => (
                      <label key={option.label} className="checkbox-label">
                        <input
                          type="checkbox"
                          name={definition.id}
                          required={option.required}
                          checked={selected.includes(index)}
                          onBlur={common.onBlur}
                          onChange={(event) =>
                            field.handleChange(
                              event.target.checked
                                ? [...selected, index].sort((a, b) => a - b)
                                : selected.filter((entry) => entry !== index),
                            )
                          }
                        />
                        {rendered?.optionLabelTrees?.[index] ? (
                          <Markdown
                            tree={rendered.optionLabelTrees[index]}
                            version={document.contentPolicyVersion}
                          />
                        ) : (
                          option.label
                        )}
                        {option.required ? ' (required)' : ''}
                      </label>
                    ))}
                  </fieldset>
                );
              } else {
                control = (
                  <>
                    <UploadField
                      projectId={document.projectId}
                      draftId={draftId}
                      id={id}
                      label={definition.attributes.label}
                      required={definition.validations.required}
                      describedBy={common['aria-describedby']}
                      invalid={Boolean(error)}
                      disabled={uncertain || sending}
                      accept={definition.validations.accept}
                      onReady={(uploadId) => {
                        const values = Array.isArray(value)
                          ? (value as string[])
                          : [];
                        if (!values.includes(uploadId))
                          field.handleChange([...values, uploadId]);
                      }}
                    />
                    <p>
                      {Array.isArray(value) ? value.length : 0} released file(s)
                      selected.
                    </p>
                  </>
                );
              }
              return (
                <div className="field">
                  {definition.type !== 'checkboxes' &&
                  definition.type !== 'upload' ? (
                    <label htmlFor={id}>
                      {definition.attributes.label}
                      {definition.validations.required ? ' (required)' : ''}
                    </label>
                  ) : null}
                  <div id={help}>
                    {rendered?.descriptionTree ? (
                      <Markdown
                        tree={rendered.descriptionTree}
                        version={document.contentPolicyVersion}
                      />
                    ) : (
                      definition.attributes.description
                    )}
                  </div>
                  {control}
                  {error ? (
                    <p id={`${id}-error`} className="field-error">
                      Error: {error}
                    </p>
                  ) : null}
                </div>
              );
            }}
          </form.Field>
        );
      })}
      <form.Subscribe selector={(state) => state.values.values}>
        {(values) => (
          <ContentPreview
            projectId={document.projectId}
            input={{
              formId: document.id,
              formVersion: document.version,
              values,
            }}
          />
        )}
      </form.Subscribe>
      {message ? <p role="alert">{message}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <button type="submit" disabled={pending}>
            {pending ? 'Submitting…' : 'Submit Issue Form'}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
