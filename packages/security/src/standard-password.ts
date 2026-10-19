import {
  CryptoFailure,
  cryptoRecord,
  decodeBase64Url,
  encodeBase64Url,
} from './crypto.ts';

export interface Argon2idParameters {
  /** 1 KiB blocks, matching the Argon2 and Node 24 API unit. */
  readonly memoryKiB: number;
  readonly passes: number;
  readonly parallelism: number;
}

export interface StandardPasswordPolicy {
  /** Deployment-selected target; no unmeasured production default exists. */
  readonly current: Argon2idParameters;
  /** Maximum cost permitted when verifying a stored record. */
  readonly maximum: Argon2idParameters;
}

export interface StandardPasswordRecord extends Argon2idParameters {
  readonly v: 1;
  readonly alg: 'Argon2id';
  readonly salt: string;
  readonly verifier: string;
}

/** A trusted profile adapter must use an actual Argon2id implementation. */
export interface Argon2idProvider {
  derive(
    password: Uint8Array,
    salt: Uint8Array,
    parameters: Argon2idParameters,
    signal?: AbortSignal,
  ): Promise<Uint8Array>;
  /** Compare fixed-length verifier bytes with a timing-safe primitive. */
  matches(
    password: Uint8Array,
    salt: Uint8Array,
    verifier: Uint8Array,
    parameters: Argon2idParameters,
    signal?: AbortSignal,
  ): Promise<boolean>;
}

export interface StandardPasswordVerification {
  readonly verified: boolean;
  /** Persist with an expected record revision after a successful login. */
  readonly replacement: StandardPasswordRecord | null;
}

/** Account services receive this bound capability from a profile root. */
export interface StandardPasswordService {
  hash(password: string, signal?: AbortSignal): Promise<StandardPasswordRecord>;
  verify(
    password: string,
    stored: unknown,
    signal?: AbortSignal,
  ): Promise<StandardPasswordVerification>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const saltBytes = 16;
const verifierBytes = 32;
const minimumMemoryKiB = 19 * 1024;

/** Initial standard profile policy from the source OWASP minimum. */
export const initialStandardPasswordPolicy: StandardPasswordPolicy =
  Object.freeze({
    current: Object.freeze({
      memoryKiB: minimumMemoryKiB,
      passes: 2,
      parallelism: 1,
    }),
    maximum: Object.freeze({
      memoryKiB: minimumMemoryKiB,
      passes: 2,
      parallelism: 1,
    }),
  });

/** Format bounds; deployment policy narrows the maximum after measurement. */
export function validArgon2idParameters(value: Argon2idParameters): boolean {
  try {
    return (
      value !== null &&
      typeof value === 'object' &&
      Number.isSafeInteger(value.memoryKiB) &&
      value.memoryKiB >= minimumMemoryKiB &&
      value.memoryKiB <= 1_048_576 &&
      Number.isSafeInteger(value.passes) &&
      value.passes >= 2 &&
      value.passes <= 32 &&
      Number.isSafeInteger(value.parallelism) &&
      value.parallelism >= 1 &&
      value.parallelism <= 16 &&
      value.memoryKiB % (4 * value.parallelism) === 0
    );
  } catch {
    return false;
  }
}

function within(
  value: Argon2idParameters,
  maximum: Argon2idParameters,
): boolean {
  return (
    value.memoryKiB <= maximum.memoryKiB &&
    value.passes <= maximum.passes &&
    value.parallelism <= maximum.parallelism
  );
}

/** Validate once before profile capability checks or account construction. */
export function snapshotStandardPasswordPolicy(
  value: StandardPasswordPolicy,
): StandardPasswordPolicy {
  try {
    const current = Object.freeze({
      memoryKiB: value.current.memoryKiB,
      passes: value.current.passes,
      parallelism: value.current.parallelism,
    });
    const maximum = Object.freeze({
      memoryKiB: value.maximum.memoryKiB,
      passes: value.maximum.passes,
      parallelism: value.maximum.parallelism,
    });
    if (
      !validArgon2idParameters(current) ||
      !validArgon2idParameters(maximum) ||
      !within(current, maximum)
    )
      throw new CryptoFailure();
    return Object.freeze({ current, maximum });
  } catch {
    throw new CryptoFailure();
  }
}

function passwordBytes(password: string): Uint8Array<ArrayBuffer> {
  if (
    typeof password !== 'string' ||
    password.length < 1 ||
    password.length > 1024
  )
    throw new CryptoFailure();
  const bytes = new Uint8Array(encoder.encode(password));
  if (
    bytes.length < 1 ||
    bytes.length > 1024 ||
    decoder.decode(bytes) !== password
  ) {
    bytes.fill(0);
    throw new CryptoFailure();
  }
  return bytes;
}

export function parseStandardPasswordRecord(
  value: unknown,
): StandardPasswordRecord {
  try {
    const record = cryptoRecord(value, [
      'v',
      'alg',
      'memoryKiB',
      'passes',
      'parallelism',
      'salt',
      'verifier',
    ]);
    const parameters = {
      memoryKiB: record.memoryKiB as number,
      passes: record.passes as number,
      parallelism: record.parallelism as number,
    };
    if (
      record.v !== 1 ||
      record.alg !== 'Argon2id' ||
      !validArgon2idParameters(parameters)
    )
      throw new CryptoFailure();
    decodeBase64Url(record.salt, saltBytes, saltBytes).fill(0);
    decodeBase64Url(record.verifier, verifierBytes, verifierBytes).fill(0);
    return Object.freeze({
      v: 1,
      alg: 'Argon2id',
      ...parameters,
      salt: record.salt as string,
      verifier: record.verifier as string,
    });
  } catch {
    throw new CryptoFailure();
  }
}

async function createRecord(
  provider: Argon2idProvider,
  password: string,
  parameters: Argon2idParameters,
  signal?: AbortSignal,
): Promise<StandardPasswordRecord> {
  const bytes = passwordBytes(password);
  const salt = crypto.getRandomValues(new Uint8Array(saltBytes));
  let derived: Uint8Array | undefined;
  try {
    if (signal?.aborted) throw new CryptoFailure();
    derived = await provider.derive(bytes, salt, parameters, signal);
    if (
      signal?.aborted ||
      !(derived instanceof Uint8Array) ||
      derived.byteLength !== verifierBytes
    )
      throw new CryptoFailure();
    return Object.freeze({
      v: 1,
      alg: 'Argon2id',
      ...parameters,
      salt: encodeBase64Url(salt),
      verifier: encodeBase64Url(derived),
    });
  } finally {
    bytes.fill(0);
    derived?.fill(0);
  }
}

/** Standard profiles only. Policy values need separate deployment acceptance. */
export async function hashStandardPassword(
  provider: Argon2idProvider,
  password: string,
  policy: StandardPasswordPolicy,
  signal?: AbortSignal,
): Promise<StandardPasswordRecord> {
  try {
    const snapshot = snapshotStandardPasswordPolicy(policy);
    return await createRecord(provider, password, snapshot.current, signal);
  } catch {
    throw new CryptoFailure();
  }
}

function upgradeParameters(
  stored: Argon2idParameters,
  current: Argon2idParameters,
): Argon2idParameters {
  const parallelism = Math.max(stored.parallelism, current.parallelism);
  const block = 4 * parallelism;
  return {
    memoryKiB:
      Math.ceil(Math.max(stored.memoryKiB, current.memoryKiB) / block) * block,
    passes: Math.max(stored.passes, current.passes),
    parallelism,
  };
}

/** Rejects PBKDF2 records; a weaker tier verifier cannot enter this path. */
export async function verifyStandardPassword(
  provider: Argon2idProvider,
  password: string,
  stored: unknown,
  policy: StandardPasswordPolicy,
  signal?: AbortSignal,
): Promise<StandardPasswordVerification> {
  try {
    const snapshot = snapshotStandardPasswordPolicy(policy);
    const record = parseStandardPasswordRecord(stored);
    if (!within(record, snapshot.maximum)) throw new CryptoFailure();
    const bytes = passwordBytes(password);
    const salt = decodeBase64Url(record.salt, saltBytes, saltBytes);
    const verifier = decodeBase64Url(
      record.verifier,
      verifierBytes,
      verifierBytes,
    );
    let verified: boolean;
    try {
      if (signal?.aborted) throw new CryptoFailure();
      verified = await provider.matches(bytes, salt, verifier, record, signal);
      if (signal?.aborted || typeof verified !== 'boolean')
        throw new CryptoFailure();
    } finally {
      bytes.fill(0);
      verifier.fill(0);
    }
    if (!verified) return { verified: false, replacement: null };
    const upgraded = upgradeParameters(record, snapshot.current);
    if (
      upgraded.memoryKiB === record.memoryKiB &&
      upgraded.passes === record.passes &&
      upgraded.parallelism === record.parallelism
    )
      return { verified: true, replacement: null };
    if (
      !validArgon2idParameters(upgraded) ||
      !within(upgraded, snapshot.maximum)
    )
      throw new CryptoFailure();
    return {
      verified: true,
      replacement: await createRecord(provider, password, upgraded, signal),
    };
  } catch {
    throw new CryptoFailure();
  }
}

/** Freeze a deployment-selected policy for the lifetime of one account service. */
export function createStandardPasswordService(
  provider: Argon2idProvider,
  policy: StandardPasswordPolicy,
): StandardPasswordService {
  if (
    !provider ||
    typeof provider.derive !== 'function' ||
    typeof provider.matches !== 'function'
  )
    throw new CryptoFailure();
  const selected = snapshotStandardPasswordPolicy(policy);
  return Object.freeze({
    hash: (password: string, signal?: AbortSignal) =>
      hashStandardPassword(provider, password, selected, signal),
    verify: (password: string, stored: unknown, signal?: AbortSignal) =>
      verifyStandardPassword(provider, password, stored, selected, signal),
  });
}
