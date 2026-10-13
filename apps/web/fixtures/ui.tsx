// Test-only build entry; never linked or included in the production build.
import { createRoot } from 'react-dom/client';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@hyperbug/api-client';
import { BrowserAuth, takeCallback } from '../src/auth.ts';
import { loadRuntimeConfig } from '../src/runtime-config.ts';
import { useForm, fieldErrorText } from '../src/forms.ts';
import {
  ConfirmDialog,
  ErrorSummary,
  Field,
  StateMessage,
} from '../src/components/ui.tsx';

const callback = takeCallback();
const config = await loadRuntimeConfig();
const queries = new QueryClient();
const subscribeCache = (listener: () => void) =>
  queries.getQueryCache().subscribe(listener);
const privateCacheCount = () =>
  queries.getQueryCache().findAll({ queryKey: ['private'] }).length;
const auth = new BrowserAuth(config, queries);
if (callback) await auth.completeCallback(callback);

function DraftForm() {
  const summary = useRef<HTMLElement>(null);
  const [attempts, setAttempts] = useState(0);
  const [message, setMessage] = useState('');
  const validate = (value: string) =>
    value.trim().length < 3 ? 'Enter at least three characters.' : undefined;
  const form = useForm({
    defaultValues: { title: '' },
    onSubmitInvalid: () => setAttempts((value) => value + 1),
    onSubmit: async () => {
      setMessage('');
      try {
        if (auth.getSnapshot().account)
          await auth.request('GET /api/v1/account');
        setMessage(
          'Validation complete. This fixture does not save product data.',
        );
      } catch (error) {
        setMessage(
          error instanceof ApiClientError && error.status === 429
            ? 'Too many requests. Wait before trying again.'
            : 'Access could not be checked.',
        );
      }
    },
  });
  useLayoutEffect(() => {
    if (attempts > 0) summary.current?.focus();
  }, [attempts]);
  return (
    <form
      noValidate
      aria-label="Primitive validation"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.fieldMeta.title}>
        {(meta) => (
          <ErrorSummary
            summaryRef={summary}
            errors={
              attempts > 0 && meta?.errors.length
                ? [
                    {
                      fieldId: 'fixture-title',
                      message: fieldErrorText(meta.errors),
                    },
                  ]
                : []
            }
          />
        )}
      </form.Subscribe>
      <form.Field
        name="title"
        validators={{
          onBlur: ({ value }) => validate(value),
          onSubmit: ({ value }) => validate(value),
          onChange: ({ value, fieldApi }) =>
            fieldApi.state.meta.isBlurred ||
            fieldApi.form.state.submissionAttempts > 0
              ? validate(value)
              : undefined,
        }}
      >
        {(field) => (
          <Field
            id="fixture-title"
            name="title"
            label="Draft title"
            hint="Enter 3–100 characters. This test draft stays in memory."
            required
            minLength={3}
            maxLength={100}
            value={field.state.value}
            interacted={field.state.meta.isBlurred || attempts > 0}
            error={fieldErrorText(field.state.meta.errors)}
            onBlur={field.handleBlur}
            onChange={(event) => {
              field.handleChange(event.target.value);
              if (field.state.meta.isBlurred) void field.validate('blur');
            }}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <button type="submit" disabled={submitting}>
            {submitting ? 'Checking…' : 'Validate draft'}
          </button>
        )}
      </form.Subscribe>
      <output>{message}</output>
    </form>
  );
}

function Fixture() {
  const state = useSyncExternalStore(auth.subscribe, auth.getSnapshot);
  const cacheCount = useSyncExternalStore(subscribeCache, privateCacheCount);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <>
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <nav aria-label="Fixture">
          <a href="#controls">Controls</a>
          <a href="#states">States</a>
        </nav>
      </header>
      <main id="content" tabIndex={-1}>
        <h1>UI acceptance fixture</h1>
        <p>Reusable primitives only; no product editing workflow.</p>
        <output>{state.notice}</output>
        <p data-testid="account-kind">
          {state.account
            ? state.account.kind === 'staff'
              ? 'Staff'
              : 'Public user'
            : 'Signed out'}
        </p>
        <div className="actions">
          <button
            type="button"
            onClick={() => {
              void auth.signIn();
            }}
          >
            Fixture sign in
          </button>
          <button
            type="button"
            onClick={() => {
              void auth.signOut();
            }}
          >
            Clear session
          </button>
          <button
            type="button"
            onClick={() => {
              queries.setQueryData(['private', state.epoch], 'fixture private');
              setConfirmed((value) => !value);
            }}
          >
            Seed private cache
          </button>
        </div>
        <p data-testid="cache-count">Private cache entries: {cacheCount}</p>
        <section id="controls">
          <h2>Field and dialog</h2>
          <DraftForm key={state.epoch} />
          <ConfirmDialog
            triggerLabel="Open confirmation"
            title="Discard the draft?"
            confirmLabel="Discard"
            onConfirm={() => setConfirmed(true)}
          >
            <p>Cancel keeps this test draft.</p>
          </ConfirmDialog>
          <output>{confirmed ? 'Fixture action confirmed.' : ''}</output>
        </section>
        <section id="states">
          <h2>Application states</h2>
          <StateMessage kind="loading" title="Checking access…" />
          <StateMessage kind="empty" title="No results">
            <p>Choose another filter.</p>
          </StateMessage>
          <StateMessage kind="permission-denied" title="Permission denied">
            <p>Ask an administrator for access.</p>
          </StateMessage>
          <StateMessage kind="error" title="Request unavailable">
            Try again later.
          </StateMessage>
        </section>
      </main>
      <footer className="site-footer">
        <p>Test fixture</p>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
