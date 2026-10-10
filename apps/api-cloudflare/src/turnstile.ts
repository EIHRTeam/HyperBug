import {
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from '@hyperbug/server';
import { createCloudflareOutboundFetcher } from './outbound.ts';

/** Optional Workers provider using platform fetch under the fixed catalog. */
export function createCloudflareTurnstileVerifier(secret: string) {
  return createTurnstileVerifier(
    secret,
    createCloudflareOutboundFetcher(turnstileOutboundLimits),
  );
}
