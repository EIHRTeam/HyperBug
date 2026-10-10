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
  readonly persistReceipt: boolean;
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
 * mutation is one-shot and omits receipt persistence and replay reads.
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
    persistReceipt: keyed,
    keyHash: keyed ? await sha256Hex(`${operation}:${header}`) : '0'.repeat(64),
    payloadHash: keyed ? await sha256Hex(payload) : '0'.repeat(64),
    now,
    expiresAt: now + validityMs,
    principalId,
    projectId,
    requestId,
  };
}
