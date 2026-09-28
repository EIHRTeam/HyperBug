import { env } from 'cloudflare:workers';
import { canonicalIpAddress } from '@hyperbug/security';
import { createIngressAttestation } from './ingress-attestation.ts';

/** Public edge entry; API is reachable only through its service binding. */
const attestation = createIngressAttestation(env.HYPERBUG_INGRESS_KEY);
const unavailable = () =>
  new Response(null, {
    status: 503,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
export default {
  async fetch(request, gatewayEnv) {
    try {
      if (request.headers.has('x-real-ip') || request.headers.has('cf-worker'))
        return unavailable();
      const ip = canonicalIpAddress(request.headers.get('cf-connecting-ip'));
      // Cloudflare substitutes this address for cross-zone Worker subrequests.
      if (ip === '2a06:98c0:3600::103') return unavailable();
      const headers = await attestation.sign(request, ip);
      return await gatewayEnv.API.fetch(new Request(request, { headers }));
    } catch {
      return unavailable();
    }
  },
} satisfies ExportedHandler<GatewayEnv>;
