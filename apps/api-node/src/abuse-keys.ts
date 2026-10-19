import { SecretAbuseKeyProvider } from '@hyperbug/security';
import { nodeSecretFileSource } from './key-provider.ts';

/** A separate private mount from the credential/envelope key ring. */
export function createNodeAbuseKeyProvider(
  path: string,
): SecretAbuseKeyProvider {
  return new SecretAbuseKeyProvider(nodeSecretFileSource(path));
}
