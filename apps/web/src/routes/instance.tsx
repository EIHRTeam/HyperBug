import { Link } from '@tanstack/react-router';
import { instanceRoute, useInstance } from '../app.tsx';
import { TrustedPluginSlot } from '../components/plugin-slot.tsx';

const labels = {
  passwordRegistration: 'Password registration',
  passwordLogin: 'Password sign-in',
  passkeys: 'Passkeys',
  recoveryCodes: 'Recovery codes',
  administratorAssistedRecovery: 'Administrator-assisted recovery',
};

export function Instance() {
  const { section } = instanceRoute.useSearch();
  const { data } = useInstance();
  if (!data) return null;
  return (
    <>
      <p className="eyebrow">Instance information</p>
      <h1>Know what is available.</h1>
      <p className="intro">
        Capabilities come from this instance. Availability may change with its
        deployment or administrator settings.
      </p>
      <nav className="section-nav" aria-label="Instance sections">
        <Link
          to="/instance"
          search={{ section: 'capabilities' }}
          aria-current={section === 'capabilities' ? 'page' : undefined}
        >
          Capabilities
        </Link>
        <Link
          to="/instance"
          search={{ section: 'limits' }}
          aria-current={section === 'limits' ? 'page' : undefined}
        >
          Limits
        </Link>
      </nav>
      {section === 'capabilities' ? (
        <section>
          <h2>Account options</h2>
          <dl className="capability-list">
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>
                  {data.authentication[key as keyof typeof labels]
                    ? 'Available'
                    : 'Unavailable'}
                </dd>
              </div>
            ))}
          </dl>
          <h2>Search</h2>
          <p>
            {data.search.textScope === 'title'
              ? 'Text search covers issue titles only. Issue bodies and comments are not searched.'
              : 'Text search covers issue titles and issue bodies. Comments are not searched.'}
          </p>
          <h2>Password protection</h2>
          <p>
            {data.passwordHashPolicy.algorithm === 'argon2id'
              ? 'This instance uses Argon2id password hashing.'
              : 'This instance uses peppered PBKDF2-HMAC-SHA256. It provides less resistance to offline password guessing than Standard.'}
          </p>
        </section>
      ) : (
        <section>
          <h2>Deployment limits</h2>
          <p>
            {data.tier === 'standard'
              ? 'Standard deployment'
              : 'Cloudflare Minimum deployment'}
          </p>
          <dl className="capability-list">
            <div>
              <dt>Background dispatch batch</dt>
              <dd>{data.background.dispatchBatch}</dd>
            </div>
            <div>
              <dt>Maximum job steps</dt>
              <dd>{data.background.maxJobSteps}</dd>
            </div>
            <div>
              <dt>Checkpoint size</dt>
              <dd>{data.background.checkpointBytes} bytes</dd>
            </div>
            <div>
              <dt>Bulk, imports, exports and long-running jobs</dt>
              <dd>Unavailable</dd>
            </div>
          </dl>
          <h2>Declared degradations</h2>
          {data.degradationIds.length ? (
            <ul>
              {data.degradationIds.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          ) : (
            <p>No deployment degradations declared.</p>
          )}
          <p>
            Limits reference: <code>{data.limits.documented}</code>
          </p>
        </section>
      )}
      <TrustedPluginSlot />
    </>
  );
}
