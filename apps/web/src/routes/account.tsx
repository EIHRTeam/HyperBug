import { useState } from 'react';
import { useAuth, useInstance } from '../app.tsx';
import { ConfirmDialog, StateMessage } from '../components/ui.tsx';
import { Link } from '@tanstack/react-router';
import { useProductQuery } from '../product-api.ts';
import { QueryStatus } from '../components/product.tsx';
import { CommandForm } from '../components/command-form.tsx';

export function Account() {
  const { auth, state } = useAuth();
  const { data } = useInstance();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const sessions = useProductQuery(
    'GET /api/v1/account/sessions',
    {},
    Boolean(state.account),
  );
  const canSignIn =
    data && (data.authentication.passwordLogin || data.authentication.passkeys);
  return (
    <>
      <p className="eyebrow">Account</p>
      <h1>
        {state.account ? 'You are signed in.' : 'Sign in to this instance.'}
      </h1>
      <p>
        Sign-in opens the authorization service. Your access token stays in
        memory; reloading this app requires a new top-level sign-in.
      </p>
      <output>{message || state.notice}</output>
      {state.account ? (
        <>
          <p>
            Account type:{' '}
            {state.account.kind === 'staff' ? 'Staff' : 'Public user'}
          </p>
          {state.account.kind === 'staff' ? (
            <Link to="/plugins">Instance plugins</Link>
          ) : null}
          {data?.authentication.passkeys ? (
            <button
              type="button"
              onClick={() => {
                void auth.signIn();
              }}
            >
              Verify a passkey for sensitive actions
            </button>
          ) : null}
          <h2>Authorization sessions</h2>
          <p>
            Revoking a session stops its reuse at the authorization service. App
            access tokens are separate; sign out of this app to revoke its
            token.
          </p>
          <QueryStatus query={sessions} />
          {sessions.data?.sessions.map((session) => (
            <section key={session.id}>
              <p>
                Session created {new Date(session.createdAt).toLocaleString()} ·
                expires {new Date(session.absoluteExpiresAt).toLocaleString()}
              </p>
              <CommandForm
                label={`Revoke session ${session.id}`}
                confirm
                fields={[]}
                onSave={async () => {
                  await auth.request('DELETE /api/v1/account/sessions/{id}', {
                    params: { id: session.id },
                    body: {},
                  });
                  await sessions.refetch();
                }}
              />
            </section>
          ))}
          <div className="actions">
            <button
              type="button"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  await auth.request('GET /api/v1/account');
                  setMessage('Your access is current.');
                } catch {
                  setMessage(
                    'Access could not be checked. Try again or sign in again.',
                  );
                } finally {
                  setChecking(false);
                }
              }}
            >
              {checking ? 'Checking access…' : 'Check access'}
            </button>
            <ConfirmDialog
              triggerLabel="Sign out of this app"
              title="Sign out of this app?"
              confirmLabel="Sign out"
              onConfirm={() => {
                void auth.signOut();
              }}
            >
              <p>
                Your unsaved changes will be cleared. The authorization
                service’s first-party session is separate.
              </p>
            </ConfirmDialog>
          </div>
          <p>
            Signing out revokes this app’s bearer token. The authorization
            service’s first-party session is separate.
          </p>
        </>
      ) : canSignIn ? (
        <button
          type="button"
          disabled={state.pending}
          onClick={() => {
            void auth.signIn();
          }}
        >
          {state.pending ? 'Opening sign-in…' : 'Sign in'}
        </button>
      ) : (
        <StateMessage kind="empty" title="Sign-in is unavailable">
          <p>
            Contact this instance’s administrator for available account options.
          </p>
        </StateMessage>
      )}
      {data?.authentication.passkeys ? (
        <p>
          Passkeys are available through the authorization service. For
          sensitive changes, choose “Use a passkey” there before authorizing
          access.
        </p>
      ) : (
        <p>Passkeys are unavailable on this instance.</p>
      )}
    </>
  );
}
