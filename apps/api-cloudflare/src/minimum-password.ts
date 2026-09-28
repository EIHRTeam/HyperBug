import type { DeploymentConfig } from '@hyperbug/config';
import {
  createMinimumPasswordService,
  CryptoFailure,
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
  return createMinimumPasswordService(provider, policy);
}
