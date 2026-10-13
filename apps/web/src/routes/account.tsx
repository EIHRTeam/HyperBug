import { useState } from 'react';
import { useAuth, useInstance } from '../app.tsx';

export function Account() {
  const { auth, state } = useAuth();
  const { data } = useInstance();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
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
            <button
              type="button"
              onClick={() => {
                void auth.signOut();
              }}
            >
              Sign out of this app
            </button>
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
        <p>
          Sign-in is unavailable on this instance. Contact its administrator for
          available account options.
        </p>
      )}
      {data?.authentication.passkeys ? (
        <p>Passkeys are available through the authorization service.</p>
      ) : (
        <p>Passkeys are unavailable on this instance.</p>
      )}
    </>
  );
}
