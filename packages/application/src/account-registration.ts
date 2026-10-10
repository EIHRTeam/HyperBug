import { assertId, assertInstant } from '@hyperbug/domain';

/**
 * Structural application port shapes; the security service validates its
 * record. The union covers both deployment profiles' credential records —
 * Argon2id on the standard profiles and peppered PBKDF2 on the Cloudflare
 * Free minimum tier — and the stores treat them as opaque JSON.
 */
export interface Argon2idCredentialRecord {
  readonly v: 1;
  readonly alg: 'Argon2id';
  readonly memoryKiB: number;
  readonly passes: number;
  readonly parallelism: number;
  readonly salt: string;
  readonly verifier: string;
}

export interface Pbkdf2CredentialRecord {
  readonly v: 1;
  readonly alg: 'PBKDF2-HMAC-SHA256';
  readonly iterations: number;
  /**
   * Versioned pepper key reference, structurally mirrored from security;
   * the security record validates the closed purpose set on every use.
   */
  readonly key: {
    readonly purpose: string;
    readonly id: string;
    readonly version: number;
  };
  readonly salt: string;
  readonly verifier: string;
}

export type AccountPasswordRecord =
  | Argon2idCredentialRecord
  | Pbkdf2CredentialRecord;

export interface AccountRegistrationInput {
  principalId: string;
  identityId: string;
  /** Canonical, lower-case ASCII account handle. */
  handle: string;
  passwordRecord: AccountPasswordRecord;
  nowMs: number;
}

export type AccountRegistrationResult =
  | { status: 'created'; principalId: string }
  | { status: 'existing' };

export interface AccountRegistrationStore {
  register(input: AccountRegistrationInput): Promise<AccountRegistrationResult>;
}

/** A login flow must use the revision to replace a verified password record. */
export interface AccountPasswordCredential {
  readonly principalId: string;
  readonly identityId: string;
  readonly record: AccountPasswordRecord;
  readonly revision: number;
}

export interface AccountPasswordStore {
  loadCredential(handle: string): Promise<AccountPasswordCredential | null>;
  /** Identity-scoped lookup used by passkey login to bind the session. */
  loadCredentialByIdentity(
    identityId: string,
  ): Promise<AccountPasswordCredential | null>;
  replaceCredential(input: {
    identityId: string;
    expectedRevision: number;
    record: AccountPasswordRecord;
    nowMs: number;
  }): Promise<boolean>;
}

export function validateAccountRegistrationInput(
  input: AccountRegistrationInput,
): void {
  assertId(input.principalId);
  assertId(input.identityId);
  assertInstant(input.nowMs);
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(input.handle))
    throw new Error('Invalid account handle');
}
