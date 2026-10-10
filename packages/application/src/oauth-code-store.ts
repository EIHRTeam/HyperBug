import { assertId, assertInstant, authMethods } from '@hyperbug/domain';
import type { Assurance, AuthMethod } from '@hyperbug/domain';

/** A single-use authorization code issued for one session-bound principal. */
export interface OAuthCodeInsert {
  readonly id: string;
  /** JSON of a versioned keyed digest of the code secret; no plaintext. */
  readonly digest: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly codeChallenge: string;
  readonly principalId: string;
  readonly identityId: string;
  readonly nowMs: number;
  readonly expiresAtMs: number;
  readonly authMethod: AuthMethod;
  /** Ceremony instant copied from the authorizing session. */
  readonly authenticatedAtMs: number;
  readonly assurance: Assurance;
}

/** The consumed code row, returned once to the single winning redemption. */
export interface OAuthCodeExchange {
  readonly principalId: string;
  readonly identityId: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: string;
  readonly codeChallenge: string;
  readonly authMethod: AuthMethod;
  /** Ceremony instant copied from the authorizing session. */
  readonly authenticatedAtMs: number;
  readonly assurance: Assurance;
}

export interface OAuthCodeStore {
  insert(input: OAuthCodeInsert): Promise<void>;
  /**
   * Consume exactly one unused, unexpired code atomically. Null means the
   * code is unknown, already redeemed or past its lifetime; either way it
   * stays consumed so a failed verification cannot revive it.
   */
  consume(id: string, nowMs: number): Promise<OAuthCodeExchange | null>;
}

export interface OAuthAccessTokenInsert {
  readonly id: string;
  readonly digest: string;
  readonly principalId: string;
  readonly identityId: string;
  readonly clientId: string;
  readonly scope: string;
  readonly nowMs: number;
  readonly expiresAtMs: number;
  readonly authMethod: AuthMethod;
  /** Ceremony instant copied from the authorizing session. */
  readonly authenticatedAtMs: number;
  readonly assurance: Assurance;
}

/** An unrevoked, unexpired token record with its stored keyed digest. */
export interface OAuthAccessTokenRecord {
  readonly principalId: string;
  readonly identityId: string;
  readonly clientId: string;
  readonly scope: string;
  readonly digest: string;
  readonly authMethod: AuthMethod;
  /** Ceremony instant copied from the authorizing session. */
  readonly authenticatedAtMs: number;
  readonly assurance: Assurance;
}

export interface OAuthAccessTokenStore {
  insertAccessToken(input: OAuthAccessTokenInsert): Promise<void>;
  /** Primary read of an active token; the digest is verified by the caller. */
  loadActive(id: string, nowMs: number): Promise<OAuthAccessTokenRecord | null>;
  /** Revoke the exact token after the secret has been verified. */
  revoke(id: string, nowMs: number): Promise<boolean>;
  /**
   * Active-principal kind for a token-bound principal; null when the
   * principal is unknown, suspended or deleted.
   */
  loadPrincipalKind(principalId: string): Promise<'user' | 'staff' | null>;
}

const clientIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const challengePattern = /^[A-Za-z0-9_-]{43,128}$/;

function boundedText(value: string, minimum: number, maximum: number): boolean {
  return value.length >= minimum && value.length <= maximum;
}

function validCeremony(input: {
  readonly authMethod: AuthMethod;
  readonly authenticatedAtMs: number;
  readonly assurance: Assurance;
  readonly nowMs: number;
}): boolean {
  return (
    authMethods.includes(input.authMethod) &&
    (input.assurance === 1 || input.assurance === 2) &&
    Number.isSafeInteger(input.authenticatedAtMs) &&
    input.authenticatedAtMs >= 0 &&
    input.authenticatedAtMs <= input.nowMs
  );
}

export function validateOAuthCodeInsert(input: OAuthCodeInsert): void {
  assertId(input.id);
  assertId(input.principalId);
  assertId(input.identityId);
  assertInstant(input.nowMs);
  assertInstant(input.expiresAtMs);
  if (
    !clientIdPattern.test(input.clientId) ||
    !boundedText(input.redirectUri, 1, 2048) ||
    !boundedText(input.scope, 1, 256) ||
    !challengePattern.test(input.codeChallenge) ||
    typeof input.digest !== 'string' ||
    input.digest.length < 1 ||
    input.digest.length > 1024 ||
    input.expiresAtMs <= input.nowMs ||
    input.expiresAtMs - input.nowMs > 60000 ||
    !validCeremony(input)
  )
    throw new Error('Invalid authorization code');
}

export function validateOAuthAccessTokenInsert(
  input: OAuthAccessTokenInsert,
): void {
  assertId(input.id);
  assertId(input.principalId);
  assertId(input.identityId);
  assertInstant(input.nowMs);
  assertInstant(input.expiresAtMs);
  if (
    !clientIdPattern.test(input.clientId) ||
    !boundedText(input.scope, 1, 256) ||
    typeof input.digest !== 'string' ||
    input.digest.length < 1 ||
    input.digest.length > 1024 ||
    input.expiresAtMs <= input.nowMs ||
    input.expiresAtMs - input.nowMs < 300000 ||
    input.expiresAtMs - input.nowMs > 900000 ||
    !validCeremony(input)
  )
    throw new Error('Invalid access token');
}
