import { assertId, assertInstant } from '@hyperbug/domain';

/** A stored recovery code: its id and keyed digest, never the plaintext. */
export interface RecoveryCodeDigestRecord {
  readonly id: string;
  readonly digest: string;
}

export interface AccountRecoveryStore {
  /**
   * Replace every stored code for the identity under a fresh generation;
   * the previous generation is deleted, so regeneration invalidates it.
   */
  replaceCodes(input: {
    identityId: string;
    digests: readonly string[];
    nowMs: number;
  }): Promise<void>;
  /** Unused digests of the identity's latest generation. */
  listActive(identityId: string): Promise<readonly RecoveryCodeDigestRecord[]>;
  /** Consume exactly one unused code atomically; false on race or loss. */
  consume(id: string, nowMs: number): Promise<boolean>;
}

export function validateRecoveryCodeReplacement(
  identityId: string,
  digests: readonly string[],
  nowMs: number,
): void {
  assertId(identityId);
  assertInstant(nowMs);
  if (digests.length < 1 || digests.length > 20)
    throw new Error('Invalid recovery code set');
  for (const digest of digests) {
    if (typeof digest !== 'string' || digest.length < 1 || digest.length > 1024)
      throw new Error('Invalid recovery code digest');
  }
}
