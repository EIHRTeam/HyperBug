import {
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from '@hyperbug/server';
import { createNodeOutboundFetcher } from './outbound.ts';

/** Optional Node provider using the address-pinned direct HTTPS transport. */
export function createNodeTurnstileVerifier(secret: string) {
  return createTurnstileVerifier(
    secret,
    createNodeOutboundFetcher(turnstileOutboundLimits),
  );
}
