import { Link } from '@tanstack/react-router';
import { useInstance, usePublicConfig } from '../app.tsx';

export function Overview() {
  const config = usePublicConfig();
  const { data } = useInstance();
  if (!data) return null;
  return (
    <>
      <p className="eyebrow">{config.applicationName}</p>
      <h1>
        A shared place
        <br />
        for better feedback.
      </h1>
      <p className="intro">
        Keep issues, conversations and decisions together. This instance makes
        its available capabilities clear before you begin.
      </p>
      <Link
        className="primary-link"
        to="/instance"
        search={{ section: 'capabilities' }}
      >
        Explore this instance <span aria-hidden="true">→</span>
      </Link>
      <section className="overview-summary">
        <h2>What this instance offers</h2>
        <dl>
          <div>
            <dt>Deployment</dt>
            <dd>
              {data.tier === 'standard' ? 'Standard' : 'Cloudflare Minimum'}
            </dd>
          </div>
          <div>
            <dt>Search covers</dt>
            <dd>
              {data.search.textScope === 'title'
                ? 'Issue titles'
                : 'Issue titles and bodies'}
            </dd>
          </div>
          <div>
            <dt>Passkey sign-in</dt>
            <dd>
              {data.authentication.passkeys ? 'Available' : 'Unavailable'}
            </dd>
          </div>
        </dl>
        {data.tier === 'cloudflare-minimum' ? (
          <p className="disclosure">
            This Minimum instance has reduced capacity and weaker password
            hashing than Standard. Review its limits before choosing how to sign
            in.
          </p>
        ) : null}
      </section>
    </>
  );
}
