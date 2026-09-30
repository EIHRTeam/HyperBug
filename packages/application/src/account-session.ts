import { assertId, assertInstant } from '@hyperbug/domain';

/** A first-party authorization session, never a business API bearer token. */
export interface AccountSessionCreate {
  readonly id: string;
  readonly principalId: string;
  readonly identityId: string;
  readonly credentialRevision: number;
  /** JSON of a versioned keyed credential digest; no plaintext token. */
  readonly digest: string;
  readonly nowMs: number;
  readonly idleExpiresAtMs: number;
  readonly absoluteExpiresAtMs: number;
}

export interface AccountSessionRecord {
  readonly principalId: string;
  readonly identityId: string;
  readonly digest: string;
  readonly absoluteExpiresAtMs: number;
}

export interface AccountSessionStore {
  /** Insert only while the verified User credential revision is still current. */
  createIfCurrent(input: AccountSessionCreate): Promise<boolean>;
  /** Primary read of an active, unrevoked and unexpired User session. */
  load(id: string, nowMs: number): Promise<AccountSessionRecord | null>;
  /** Extend idle expiry only for the exact digest and still-current account. */
  touch(input: {
    id: string;
    digest: string;
    nowMs: number;
    idleExpiresAtMs: number;
  }): Promise<boolean>;
  /** Revoke the exact session after the token has been verified. */
  revoke(id: string, digest: string, nowMs: number): Promise<boolean>;
  /** Revoke every active session of a principal; used by account recovery. */
  revokeAllForPrincipal(principalId: string, nowMs: number): Promise<number>;
}

export function validateAccountSessionCreate(
  input: AccountSessionCreate,
): void {
  assertId(input.id);
  assertId(input.principalId);
  assertId(input.identityId);
  assertInstant(input.nowMs);
  assertInstant(input.idleExpiresAtMs);
  assertInstant(input.absoluteExpiresAtMs);
  if (
    !Number.isSafeInteger(input.credentialRevision) ||
    input.credentialRevision < 1 ||
    input.credentialRevision > 2147483647 ||
    typeof input.digest !== 'string' ||
    input.digest.length < 1 ||
    input.digest.length > 1024 ||
    input.idleExpiresAtMs <= input.nowMs ||
    input.absoluteExpiresAtMs < input.idleExpiresAtMs
  )
    throw new Error('Invalid authorization session');
}
