import { RateLimitFailure, SecretAbuseKeyProvider } from '@hyperbug/security';

/** A dedicated Worker Secret binding, separate from ordinary vars and keys. */
export function createWorkerAbuseKeyProvider(
  secretBinding: string,
): SecretAbuseKeyProvider {
  return new SecretAbuseKeyProvider({
    async read(signal) {
      if (
        signal.aborted ||
        typeof secretBinding !== 'string' ||
        secretBinding.length < 1 ||
        secretBinding.length > 16384
      )
        throw new RateLimitFailure();
      return secretBinding;
    },
  });
}
