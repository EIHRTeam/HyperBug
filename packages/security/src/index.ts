export * from './authorization.ts';
export * from './classification.ts';
export * from './crypto.ts';
export * from './key-provider.ts';
export * from './outbound.ts';
export * from './rate-limit.ts';
export * from './abuse-keys.ts';
export * from './ip-address.ts';

/** Hash non-secret canonical idempotency material. Not a password/credential hash. */
export async function idempotencyDigest(
  canonicalValue: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalValue),
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

export * from './key-registry.ts';
export * from './minimum-password.ts';
export * from './standard-password.ts';
export * from './account-delay.ts';
export * from './account-lockout.ts';
