import { assertId, assertInstant } from '@hyperbug/domain';

/** Structural application port shape; the security service validates its record. */
export interface AccountPasswordRecord {
  readonly v: 1;
  readonly alg: 'Argon2id';
  readonly memoryKiB: number;
  readonly passes: number;
  readonly parallelism: number;
  readonly salt: string;
  readonly verifier: string;
}

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
