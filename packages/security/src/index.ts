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
