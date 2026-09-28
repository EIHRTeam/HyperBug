import { createOutboundFetcher, type OutboundLimits } from '@hyperbug/security';

/** Workers egress uses platform fetch under the shared fixed-destination policy. */
export function createCloudflareOutboundFetcher(limits: OutboundLimits) {
  return createOutboundFetcher(limits, fetch);
}
