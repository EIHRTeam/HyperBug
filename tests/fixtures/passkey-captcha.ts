import {
  configureOptionalTurnstile,
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from '@hyperbug/server';
import { createOutboundFetcher } from '../../packages/security/src/index.ts';

/** Exercise the configured Turnstile parser/gate without contacting a provider. */
export function passkeyCaptcha(hostname: string) {
  return configureOptionalTurnstile(
    {
      secret: 'private-fixture-secret',
      siteKey: 'public-fixture-key',
      hostname,
      environment: 'local',
    },
    (secret) =>
      createTurnstileVerifier(
        secret,
        createOutboundFetcher(turnstileOutboundLimits, async (_url, init) => {
          const form = new URLSearchParams(
            new TextDecoder().decode(init?.body as ArrayBuffer),
          );
          const token = form.get('response');
          return new Response(
            JSON.stringify({
              success:
                token === 'fixture-login' || token === 'fixture-register',
              hostname,
              action: token === 'fixture-login' ? 'login' : 'register',
              challenge_ts: new Date().toISOString(),
              'error-codes': [],
            }),
            { headers: { 'content-type': 'application/json' } },
          );
        }),
      ),
  );
}
