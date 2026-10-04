import { scopeKeyProvider } from './key-provider.ts';
import {
  checkedKey,
  contextBytes,
  CryptoFailure,
  decodeBase64Url,
  encodeBase64Url,
  parseKeyReference,
  parseMinimumPasswordRecord,
  sameKeyReference,
  type KeyProvider,
  type MinimumPasswordRecord,
  type ProvidedKey,
  type SecretContext,
} from './crypto.ts';
import {
  parseStandardPasswordRecord,
  type StandardPasswordRecord,
} from './standard-password.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const saltBytes = 16;
const verifierBytes = 32;

export interface MinimumPasswordPolicy {
  /** Accepted target for new records; no production default or floor is assumed. */
  readonly currentIterations: number;
  /** Maximum stored cost permitted before pepper lookup or PBKDF2 work. */
  readonly maximumIterations: number;
}

/**
 * Reviewed security floor for PBKDF2-HMAC-SHA256 on the minimum tier
 * (OWASP Password Storage Cheat Sheet recommendation, 2026-09-29 review).
 * A plan measurement can never lower this floor; an unmet floor disables
 * password login on the tier instead.
 */
export const minimumTierPasswordFloorIterations = 600_000;

/**
 * Deployment policy measured on a real Cloudflare Free plan on 2026-09-29
 * (docs/plan/evidence/03-free-pbkdf2-measurement.json): 100,000 iterations
 * complete deterministically within one invocation's CPU budget and 100,500
 * fail, so the stored-record maximum is the measured fit and the new-record
 * target keeps about half the budget for the rest of a login invocation.
 */
export const minimumTierPasswordPolicy: MinimumPasswordPolicy = Object.freeze({
  currentIterations: 50_000,
  maximumIterations: 100_000,
});

/** The floor rule: an unmet reviewed floor disables tier password login. */
export function minimumPasswordLoginAvailable(
  policy: MinimumPasswordPolicy,
  floorIterations: number,
): boolean {
  try {
    const snapshot = policySnapshot(policy);
    return (
      Number.isSafeInteger(floorIterations) &&
      floorIterations >= 1 &&
      snapshot.currentIterations >= floorIterations
    );
  } catch {
    return false;
  }
}

/** Measured outcome of the floor rule for the deployment policy above. */
export const minimumTierPasswordLoginEnabled = minimumPasswordLoginAvailable(
  minimumTierPasswordPolicy,
  minimumTierPasswordFloorIterations,
);

function cost(iterations: number): void {
  if (
    !Number.isSafeInteger(iterations) ||
    iterations < 1 ||
    iterations > 1_000_000
  )
    throw new CryptoFailure();
}

function policySnapshot(value: MinimumPasswordPolicy): MinimumPasswordPolicy {
  try {
    const currentIterations = value.currentIterations;
    const maximumIterations = value.maximumIterations;
    cost(currentIterations);
    cost(maximumIterations);
    if (currentIterations > maximumIterations) throw new CryptoFailure();
    return Object.freeze({ currentIterations, maximumIterations });
  } catch {
    throw new CryptoFailure();
  }
}

function passwordBytes(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length < 1 || value.length > 1024)
    throw new CryptoFailure();
  const bytes = new Uint8Array(encoder.encode(value));
  if (
    bytes.length < 1 ||
    bytes.length > 1024 ||
    decoder.decode(bytes) !== value
  )
    throw new CryptoFailure();
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const bytes = passwordBytes(password);
  try {
    const base = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, [
      'deriveBits',
    ]);
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        base,
        verifierBytes * 8,
      ),
    );
  } finally {
    bytes.fill(0);
  }
}

function pepperMessage(
  context: Uint8Array<ArrayBuffer>,
  derived: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(context.length + derived.length);
  result.set(context);
  result.set(derived, context.length);
  return result;
}

async function hashWithKey(
  provided: ProvidedKey,
  password: string,
  context: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<MinimumPasswordRecord> {
  const key = checkedKey(provided, 'password-pepper');
  const ref = parseKeyReference(provided.ref, 'password-pepper');
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  const derived = await derive(password, salt, iterations);
  const message = pepperMessage(context, derived);
  try {
    const signature = await crypto.subtle.sign('HMAC', key, message);
    return Object.freeze({
      v: 1,
      alg: 'PBKDF2-HMAC-SHA256',
      iterations,
      key: ref,
      salt: encodeBase64Url(salt),
      verifier: encodeBase64Url(new Uint8Array(signature)),
    });
  } finally {
    derived.fill(0);
    message.fill(0);
  }
}

/** Minimum-tier mechanism only. The caller must supply an accepted measured policy. */
export async function hashMinimumPassword(
  provider: KeyProvider,
  password: string,
  context: SecretContext,
  policy: MinimumPasswordPolicy,
): Promise<MinimumPasswordRecord> {
  try {
    const snapshot = policySnapshot(policy);
    const binding = contextBytes(context, 'minimum-password');
    const current = await provider.current('password-pepper');
    return await hashWithKey(
      current,
      password,
      binding,
      snapshot.currentIterations,
    );
  } catch {
    throw new CryptoFailure();
  }
}

export interface MinimumPasswordVerification {
  readonly verified: boolean;
  /** Persist with an expected record revision after a successful login. */
  readonly replacement: MinimumPasswordRecord | null;
}

/** Account services receive this bound capability only after pepper preflight. */
export interface MinimumPasswordService {
  forRequest?(scope: object): MinimumPasswordService;
  hash(
    password: string,
    context: SecretContext,
  ): Promise<MinimumPasswordRecord>;
  verify(
    password: string,
    stored: unknown,
    context: SecretContext,
  ): Promise<MinimumPasswordVerification>;
}

/** Rejects other algorithms; a stronger record cannot enter this weaker path. */
export async function verifyMinimumPassword(
  provider: KeyProvider,
  password: string,
  stored: unknown,
  context: SecretContext,
  policy: MinimumPasswordPolicy,
): Promise<MinimumPasswordVerification> {
  try {
    const snapshot = policySnapshot(policy);
    const record = parseMinimumPasswordRecord(stored);
    if (record.iterations > snapshot.maximumIterations)
      throw new CryptoFailure();
    const binding = contextBytes(context, 'minimum-password');
    const provided = await provider.get(record.key);
    const key = checkedKey(provided, 'password-pepper', record.key);
    const salt = decodeBase64Url(record.salt, saltBytes, saltBytes);
    const verifier = decodeBase64Url(
      record.verifier,
      verifierBytes,
      verifierBytes,
    );
    const derived = await derive(password, salt, record.iterations);
    const message = pepperMessage(binding, derived);
    let verified: boolean;
    try {
      verified = await crypto.subtle.verify('HMAC', key, verifier, message);
    } finally {
      derived.fill(0);
      message.fill(0);
    }
    if (!verified) return { verified: false, replacement: null };
    const current = await provider.current('password-pepper');
    checkedKey(current, 'password-pepper');
    if (
      record.iterations >= snapshot.currentIterations &&
      sameKeyReference(current.ref, record.key)
    )
      return { verified: true, replacement: null };
    return {
      verified: true,
      replacement: await hashWithKey(
        current,
        password,
        binding,
        Math.max(record.iterations, snapshot.currentIterations),
      ),
    };
  } catch {
    throw new CryptoFailure();
  }
}

/**
 * Prepare one explicit tier policy and prove a current pepper is available
 * before an account service can use the weaker minimum-tier verifier.
 * Operations still read fresh lifecycle state and fail closed after rotation.
 */
export async function createMinimumPasswordService(
  provider: KeyProvider,
  policy: MinimumPasswordPolicy,
  maxConcurrent = 1,
  startupTimeoutMs = 5000,
): Promise<MinimumPasswordService> {
  if (
    !provider ||
    typeof provider.current !== 'function' ||
    typeof provider.get !== 'function' ||
    !Number.isSafeInteger(maxConcurrent) ||
    maxConcurrent < 1 ||
    maxConcurrent > 32 ||
    !Number.isSafeInteger(startupTimeoutMs) ||
    startupTimeoutMs < 10 ||
    startupTimeoutMs > 5000
  )
    throw new CryptoFailure();
  const selected = policySnapshot(policy);
  let active = 0;
  const admitted = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (active >= maxConcurrent) throw new CryptoFailure();
    active++;
    try {
      return await operation();
    } finally {
      active--;
    }
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const current = await Promise.race([
      provider.current('password-pepper'),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CryptoFailure()), startupTimeoutMs);
      }),
    ]);
    checkedKey(current, 'password-pepper');
    const view = (selectedProvider: KeyProvider): MinimumPasswordService =>
      Object.freeze({
        forRequest: (scope: object) => view(scopeKeyProvider(provider, scope)),
        hash: (password: string, context: SecretContext) =>
          admitted(() =>
            hashMinimumPassword(selectedProvider, password, context, selected),
          ),
        verify: (password: string, stored: unknown, context: SecretContext) =>
          admitted(() =>
            verifyMinimumPassword(
              selectedProvider,
              password,
              stored,
              context,
              selected,
            ),
          ),
      });
    return view(provider);
  } catch {
    throw new CryptoFailure();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Fixed binding context for account password records on this tier. The
 * per-user random salt provides record uniqueness — exactly the binding
 * strength of the standard Argon2id path — while this context separates the
 * derivation from every other purpose of the same pepper. The identifier is
 * a fixed namespace value, not a per-resource reference.
 */
const accountPasswordContext: SecretContext = Object.freeze({
  resourceType: 'account',
  resourceId: '0f1e2d3c-4b5a-4968-8776-6574a3b2c1d0',
  field: 'verifier',
  projectId: null,
  schemaVersion: 1,
});

/** Either profile's stored credential record, opaque to the account routes. */
export type AccountPasswordRecord =
  | StandardPasswordRecord
  | MinimumPasswordRecord;

/**
 * Parse either profile's stored credential record. The adapters use this on
 * credential writes and reads; the verification paths keep their own
 * per-algorithm parsers so a weaker verifier never sees a stronger record.
 */
export function parseAccountPasswordRecord(
  value: unknown,
): AccountPasswordRecord {
  try {
    return parseStandardPasswordRecord(value);
  } catch {
    return parseMinimumPasswordRecord(value);
  }
}

export interface AccountPasswordVerification {
  readonly verified: boolean;
  /** Persist with an expected record revision after a successful login. */
  readonly replacement: AccountPasswordRecord | null;
}

/**
 * Profile-neutral account password port: the standard roots supply their
 * Argon2id service directly (it is structurally compatible) and a minimum-tier
 * root supplies the adapted peppered PBKDF2 service below.
 */
export interface AccountPasswordService {
  forRequest?(scope: object): AccountPasswordService;
  hash(password: string, signal?: AbortSignal): Promise<AccountPasswordRecord>;
  verify(
    password: string,
    stored: unknown,
    signal?: AbortSignal,
  ): Promise<AccountPasswordVerification>;
}

/**
 * Adapt the context-bound minimum-tier service to the profile-neutral account
 * port under the fixed account context. The source is either a constructed
 * service or a loader: Workers global scope cannot perform the async D1 work
 * of the pepper preflight, so a composition root passes a loader and the
 * service is constructed (and its pepper proven) at first use. The wrapped
 * service keeps its own concurrency bound; callers keep applying their
 * response deadlines. A failed load is not memoized.
 */
export function adaptMinimumPasswordService(
  source: MinimumPasswordService | (() => Promise<MinimumPasswordService>),
): AccountPasswordService {
  const load =
    typeof source === 'function'
      ? source
      : async () => {
          if (
            !source ||
            typeof source.hash !== 'function' ||
            typeof source.verify !== 'function'
          )
            throw new CryptoFailure();
          return source;
        };
  let service: Promise<MinimumPasswordService> | null = null;
  const resolve = () =>
    (service ??= load().catch((error: unknown) => {
      service = null;
      throw error;
    }));
  return Object.freeze({
    forRequest: (scope: object) =>
      adaptMinimumPasswordService(async () => {
        const root = await resolve();
        return root.forRequest?.(scope) ?? root;
      }),
    hash: async (password: string) =>
      (await resolve()).hash(password, accountPasswordContext),
    verify: async (password: string, stored: unknown) =>
      (await resolve()).verify(password, stored, accountPasswordContext),
  });
}
