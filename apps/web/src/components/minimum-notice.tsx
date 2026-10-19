import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useInstance, usePublicConfig } from '../app.tsx';

// Public presentation preference only. No principal, draft or credential stored.
export function minimumNoticeKey(origin: string) {
  return `hyperbug.minimum-notice.v1:${origin}`;
}
export function MinimumNotice() {
  const { data } = useInstance();
  const config = usePublicConfig();
  const key = minimumNoticeKey(config.apiBaseUrl);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(key) === 'dismissed';
    } catch {
      return false;
    }
  });
  if (data?.tier !== 'cloudflare-minimum') return null;
  return (
    <aside aria-label="Minimum tier status" className="minimum-notice">
      <p>
        <strong>Cloudflare Minimum · reduced protections and capacity.</strong>{' '}
        <Link to="/instance" search={{ section: 'limits' }}>
          Review instance limits
        </Link>{' '}
        ·{' '}
        <a
          href="https://github.com/EIHRTeam/HyperBug/blob/main/docs/FREE-TIER-PROFILE.md"
          target="_blank"
          rel="noreferrer noopener"
        >
          Operator documentation
        </a>
      </p>
      {!dismissed ? (
        <>
          <p>
            This instance reports{' '}
            {data.passwordHashPolicy.algorithm === 'pbkdf2-hmac-sha256'
              ? 'PBKDF2-HMAC-SHA256'
              : 'Argon2id'}{' '}
            password hashing
            {data.passwordHashPolicy.downgraded
              ? ' with reduced password protection'
              : ''}
            ,{' '}
            {data.search.textScope === 'title'
              ? 'title-only search'
              : 'title and body search'}
            , and{' '}
            {data.background.mode === 'checkpointed-cron'
              ? 'checkpointed scheduled processing'
              : 'workflow processing'}
            . Unavailable capabilities cannot be enabled here.
          </p>
          <p>
            Reported degradations:{' '}
            {data.degradationIds.join(', ') || 'See instance limits'}.
          </p>
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(key, 'dismissed');
              } catch {
                /* In-memory dismissal still works. */
              }
            }}
          >
            Dismiss details for this session
          </button>
        </>
      ) : null}
    </aside>
  );
}
