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
      if (request.headers.has('cf-worker')) return unavailable();
      const ip = canonicalIpAddress(request.headers.get('cf-connecting-ip'));
      // Cloudflare substitutes this address for cross-zone Worker subrequests.
      if (ip === '2a06:98c0:3600::103') return unavailable();
      // The edge force-sets x-real-ip to the connecting address on this
      // platform (observed deployed on workers.dev and custom domains;
      // client-supplied values are overwritten), so a direct client cannot
      // arrive without it. A same-zone Worker subrequest can still set it
      // (Cloudflare's header reference), so keep it as a divergence tripwire:
      // provenance itself is always the canonical cf-connecting-ip.
      const claimedRealIp = request.headers.get('x-real-ip');
      if (claimedRealIp !== null && canonicalIpAddress(claimedRealIp) !== ip)
        return unavailable();
      const headers = await attestation.sign(request, ip);
      return await gatewayEnv.API.fetch(new Request(request, { headers }));
    } catch {
      return unavailable();
    }
  },
} satisfies ExportedHandler<GatewayEnv>;
