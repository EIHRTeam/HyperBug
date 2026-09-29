import type { DeploymentConfig } from '@hyperbug/config';
import {
  createMinimumPasswordService,
  CryptoFailure,
  minimumTierPasswordPolicy,
  type KeyProvider,
  type MinimumPasswordPolicy,
  type MinimumPasswordService,
} from '@hyperbug/security';

/** Separate opt-in tier; standard paid Workers retain Argon2id. */
export async function createCloudflareMinimumPasswordService(
  deployment: DeploymentConfig,
  provider: KeyProvider,
  policy: MinimumPasswordPolicy,
): Promise<MinimumPasswordService> {
  if (deployment?.tier !== 'cloudflare-free-minimum') throw new CryptoFailure();
  // The measured plan fit is a hard ceiling: a configured policy above it
  // would exceed the Free per-invocation CPU budget on every verification.
  if (
    policy.maximumIterations > minimumTierPasswordPolicy.maximumIterations ||
    policy.currentIterations > minimumTierPasswordPolicy.maximumIterations
  )
    throw new CryptoFailure();
  return createMinimumPasswordService(provider, policy);
}
