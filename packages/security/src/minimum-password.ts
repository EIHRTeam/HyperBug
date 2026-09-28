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
    return Object.freeze({
      hash: (password: string, context: SecretContext) =>
        admitted(() =>
          hashMinimumPassword(provider, password, context, selected),
        ),
      verify: (password: string, stored: unknown, context: SecretContext) =>
        admitted(() =>
          verifyMinimumPassword(provider, password, stored, context, selected),
        ),
    });
  } catch {
    throw new CryptoFailure();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
