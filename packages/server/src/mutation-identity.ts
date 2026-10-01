const idempotencyKeyPattern = /^[!-~]{16,128}$/;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export interface MutationIdentityFields {
  readonly mutationId: string;
  readonly keyHash: string;
  readonly payloadHash: string;
  readonly now: number;
  readonly expiresAt: number;
  readonly principalId: string;
  readonly projectId: string;
  readonly requestId: string;
}

/**
 * The mutation identity per DATA-MODEL: a present Idempotency-Key (16–128
 * ASCII characters) scopes the receipt, and the canonical payload hash makes
 * a same-key/different-payload retry a conflict. Without a header the
 * mutation is one-shot: the receipt row still participates in the atomic
 * write but no retry can ever match it.
 */
export async function mutationIdentityOf(
  request: Request,
  requestId: string,
  operation: string,
  payload: string,
  principalId: string,
  projectId: string,
  validityMs: number,
): Promise<MutationIdentityFields> {
  const mutationId = crypto.randomUUID();
  const now = Date.now();
  const header = request.headers.get('idempotency-key');
  const keyed = header !== null && idempotencyKeyPattern.test(header);
  return {
    mutationId,
    keyHash: await sha256Hex(
      keyed ? `${operation}:${header}` : `one-shot:${mutationId}`,
    ),
    payloadHash: await sha256Hex(keyed ? payload : `one-shot:${mutationId}`),
    now,
    expiresAt: now + validityMs,
    principalId,
    projectId,
    requestId,
  };
}
