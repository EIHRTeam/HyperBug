import { assertId, assertInstant } from '@hyperbug/domain';

/** Stored passkey credential; the private key never leaves the authenticator. */
export interface PasskeyCredentialRecord {
  readonly id: string;
  readonly identityId: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly transports: readonly string[] | null;
  readonly deviceType: 'singleDevice' | 'multiDevice';
  readonly backedUp: boolean;
}

export interface PasskeyStore {
  insertCredential(input: {
    id: string;
    identityId: string;
    publicKey: string;
    counter: number;
    transports: readonly string[] | null;
    deviceType: 'singleDevice' | 'multiDevice';
    backedUp: boolean;
    aaguid: string;
    nowMs: number;
  }): Promise<boolean>;
  loadCredential(id: string): Promise<PasskeyCredentialRecord | null>;
  /** Advance the replay counter after a verified assertion. */
  updateCounter(id: string, counter: number, nowMs: number): Promise<boolean>;
  listCredentialIds(identityId: string): Promise<readonly string[]>;
}

export interface WebauthnChallengeStore {
  /** Single-use ceremony challenge with a bounded lifetime. */
  create(input: {
    kind: 'registration' | 'authentication';
    challenge: string;
    identityId: string | null;
    nowMs: number;
    expiresAtMs: number;
  }): Promise<void>;
  /**
   * Consume the exact unused, unexpired challenge. Null means no match; a
   * consumed row returns its (possibly null) identity, so anonymous
   * authentication challenges stay distinguishable from absence.
   */
  consume(
    kind: 'registration' | 'authentication',
    challenge: string,
    nowMs: number,
  ): Promise<{ identityId: string | null } | null>;
}

export function validatePasskeyCredentialInsert(input: {
  id: string;
  identityId: string;
  publicKey: string;
  counter: number;
  transports: readonly string[] | null;
  deviceType: string;
  backedUp: boolean;
  aaguid: string;
  nowMs: number;
}): void {
  assertId(input.identityId);
  assertInstant(input.nowMs);
  if (
    typeof input.id !== 'string' ||
    input.id.length < 1 ||
    input.id.length > 1024 ||
    !/^[A-Za-z0-9_-]+$/.test(input.id)
  )
    throw new Error('Invalid passkey credential id');
  if (
    typeof input.publicKey !== 'string' ||
    input.publicKey.length < 1 ||
    input.publicKey.length > 4096 ||
    !/^[A-Za-z0-9_-]+$/.test(input.publicKey)
  )
    throw new Error('Invalid passkey public key');
  if (
    !Number.isSafeInteger(input.counter) ||
    input.counter < 0 ||
    input.counter > 2147483647
  )
    throw new Error('Invalid passkey counter');
  if (input.deviceType !== 'singleDevice' && input.deviceType !== 'multiDevice')
    throw new Error('Invalid passkey device type');
  if (
    input.transports !== null &&
    (!Array.isArray(input.transports) ||
      input.transports.some(
        (transport) =>
          typeof transport !== 'string' ||
          transport.length < 1 ||
          transport.length > 32,
      ) ||
      input.transports.length > 8)
  )
    throw new Error('Invalid passkey transports');
  if (typeof input.aaguid !== 'string' || !/^[0-9a-f-]{36}$/.test(input.aaguid))
    throw new Error('Invalid passkey aaguid');
}
