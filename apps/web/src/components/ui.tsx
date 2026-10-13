import {
  useId,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

export function Field({
  label,
  hint,
  error,
  interacted,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint: string;
  error?: string;
  interacted: boolean;
}) {
  const generated = useId();
  const id = input.id ?? generated;
  const invalid = interacted && Boolean(error);
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {input.required ? ' (required)' : ''}
      </label>
      <p id={`${id}-hint`} className="field-hint">
        {hint}
      </p>
      <input
        {...input}
        id={id}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
      />
      {invalid ? (
        <p className="field-error" id={`${id}-error`}>
          Error: {error}
        </p>
      ) : null}
    </div>
  );
}

// Focus the summary after a failed submit; do not announce the same errors live.
export function ErrorSummary({
  errors,
  summaryRef,
}: {
  errors: readonly { fieldId: string; message: string }[];
  summaryRef?: Ref<HTMLElement>;
}) {
  const heading = useId();
  if (!errors.length) return null;
  return (
    <section
      ref={summaryRef}
      tabIndex={-1}
      className="error-summary"
      aria-labelledby={heading}
    >
      <h2 id={heading}>Check the following fields</h2>
      <ul>
        {errors.map((error) => (
          <li key={error.fieldId}>
            <a
              href={`#${error.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.fieldId)?.focus();
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StateMessage({
  kind,
  title,
  children,
}: {
  kind: 'loading' | 'empty' | 'error' | 'permission-denied';
  title: string;
  children?: ReactNode;
}) {
  if (kind === 'loading')
    return <output className="state-message">{title}</output>;
  return (
    <section className={`state-message state-${kind}`}>
      <h2>{title}</h2>
      {kind === 'error' ? <p role="alert">{children}</p> : children}
    </section>
  );
}

/** showModal supplies inertness, focus trapping and Escape across the baseline. */
export function ConfirmDialog({
  triggerLabel,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  triggerLabel: string;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onClose={() => {
          if (trigger.current?.isConnected) trigger.current.focus();
          else document.getElementById('content')?.focus();
        }}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <div id={`${id}-description`}>{children}</div>
        <div className="actions">
          <button
            ref={cancel}
            type="button"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              dialog.current?.close();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
