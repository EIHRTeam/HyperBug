import {
  CryptoFailure,
  SecretKeyProvider,
  type KeyLifecycle,
} from '@hyperbug/security';

/** Pass the generated Env's Worker Secret binding, never a vars/config default. */
export function createWorkerKeyProvider(
  secretBinding: string,
  lifecycle: KeyLifecycle,
  timeoutMs = 1000,
): SecretKeyProvider {
  return new SecretKeyProvider(
    {
      async read(signal) {
        if (
          signal.aborted ||
          typeof secretBinding !== 'string' ||
          secretBinding.length === 0 ||
          secretBinding.length > 16384
        )
          throw new CryptoFailure();
        return secretBinding;
      },
    },
    lifecycle,
    timeoutMs,
  );
}
