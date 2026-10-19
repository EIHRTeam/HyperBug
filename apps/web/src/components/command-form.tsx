import { useId, useRef, useState } from 'react';
import { useForm } from '../forms.ts';
import { ErrorSummary, ConfirmDialog } from './ui.tsx';
import { productError } from '../product-state.ts';

export interface CommandField {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  multiline?: boolean;
  secret?: boolean;
  inputType?: 'text' | 'date' | 'number';
  validate?: (value: string) => string | undefined;
  maxLength?: number;
  options?: readonly string[];
}
export function CommandForm({
  label,
  fields,
  confirm = false,
  onSave,
}: {
  label: string;
  fields: readonly CommandField[];
  confirm?: boolean;
  onSave: (value: Record<string, string>) => Promise<unknown>;
}) {
  const idPrefix = useId();
  const [errors, setErrors] = useState<{ fieldId: string; message: string }[]>(
    [],
  );
  const [message, setMessage] = useState('');
  const save = useRef(onSave);
  const summary = useRef<HTMLElement>(null);
  const form = useForm({
    defaultValues: Object.fromEntries(
      fields.map((field) => [field.name, field.value ?? '']),
    ),
    onSubmit: async ({ value }) => {
      const invalid = fields.flatMap((field) => {
        const answer = value[field.name] ?? '';
        const validationMessage =
          field.required && !answer.trim()
            ? `Enter ${field.label.toLowerCase()}.`
            : (field.validate?.(answer) ??
              (field.maxLength && [...answer].length > field.maxLength
                ? `${field.label} is too long.`
                : undefined));
        return validationMessage
          ? [
              {
                fieldId: `${idPrefix}-${field.name}`,
                message: validationMessage,
              },
            ]
          : [];
      });
      setErrors(invalid);
      if (invalid.length) {
        requestAnimationFrame(() => summary.current?.focus());
        return;
      }
      try {
        await save.current(value);
        setMessage('Changes saved.');
        for (const field of fields)
          if (field.secret) form.setFieldValue(field.name, '');
      } catch (error) {
        setMessage(productError(error));
      }
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!confirm) void form.handleSubmit();
      }}
    >
      <ErrorSummary errors={errors} summaryRef={summary} />
      {fields.map((definition) => (
        <form.Field key={definition.name} name={definition.name}>
          {(field) => {
            const id = `${idPrefix}-${definition.name}`;
            const error = errors.find((entry) => entry.fieldId === id);
            const common = {
              id,
              name: definition.name,
              required: definition.required,
              maxLength: definition.maxLength ?? 32768,
              value: field.state.value ?? '',
              'aria-invalid': error ? (true as const) : undefined,
              'aria-describedby': error ? `${id}-error` : undefined,
              onChange: (event: { target: { value: string } }) => {
                field.handleChange(event.target.value);
                setErrors((previous) =>
                  previous.filter((entry) => entry.fieldId !== id),
                );
              },
              onBlur: field.handleBlur,
            };
            return (
              <div className="field">
                <label htmlFor={id}>
                  {definition.label}
                  {definition.required ? ' (required)' : ''}
                </label>
                {definition.options ? (
                  <select {...common}>
                    {definition.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : definition.multiline ? (
                  <textarea {...common} rows={6} />
                ) : (
                  <input
                    {...common}
                    type={
                      definition.secret
                        ? 'password'
                        : (definition.inputType ?? 'text')
                    }
                    autoComplete={
                      definition.secret ? 'new-password' : undefined
                    }
                  />
                )}
                {error ? (
                  <p id={`${id}-error`} className="field-error">
                    Error: {error.message}
                  </p>
                ) : null}
              </div>
            );
          }}
        </form.Field>
      ))}
      <output>{message}</output>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) =>
          confirm ? (
            <ConfirmDialog
              triggerLabel={label}
              title={`${label}?`}
              confirmLabel={pending ? 'Saving…' : label}
              onConfirm={() => {
                if (!pending) void form.handleSubmit();
              }}
            >
              <p>
                Review the values above before confirming. The instance may
                require a recent sign-in. If access has changed, sign in again
                and review the latest values.
              </p>
            </ConfirmDialog>
          ) : (
            <button type="submit" disabled={pending}>
              {pending ? 'Saving…' : label}
            </button>
          )
        }
      </form.Subscribe>
    </form>
  );
}
