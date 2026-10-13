export type KeyPurpose =
  | 'token-hmac'
  | 'blind-index'
  | 'envelope-kek'
  | 'password-pepper';
export interface KeyReference {
  readonly purpose: KeyPurpose;
  readonly id: string;
  readonly version: number;
}
export interface ProvidedKey {
  readonly ref: KeyReference;
  readonly key: CryptoKey;
}
export interface KeyProvider {
  current(purpose: KeyPurpose): Promise<ProvidedKey>;
  get(ref: KeyReference): Promise<ProvidedKey>;
  /** Current first, then a bounded set of still-usable previous versions. */
  readable(purpose: KeyPurpose): Promise<readonly ProvidedKey[]>;
}
export interface SecretContext {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly field: string;
  readonly projectId: string | null;
  readonly schemaVersion: number;
}
export interface CredentialDigest {
  readonly v: 1;
  readonly alg: 'HS256';
  readonly key: KeyReference;
  readonly digest: string;
}
export interface EncryptedSecret {
  readonly v: 1;
  readonly alg: 'A256GCM';
  readonly wrap: 'A256KW';
  readonly key: KeyReference;
  readonly iv: string;
  readonly wrappedKey: string;
  /** Includes the platform-generated 128-bit GCM tag. */
  readonly ciphertext: string;
}
/** Cloudflare Free minimum-tier verifier only; standard profiles use memory-hard hashes. */
export interface MinimumPasswordRecord {
  readonly v: 1;
  readonly alg: 'PBKDF2-HMAC-SHA256';
  readonly iterations: number;
  readonly key: KeyReference;
  readonly salt: string;
  readonly verifier: string;
}
export class CryptoFailure extends Error {
  readonly code = 'CRYPTO_FAILURE';
  constructor() {
    super('Cryptographic operation failed.');
  }
}

const encoder = new TextEncoder();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const label = /^[a-z][a-z0-9-]{0,63}$/;
const maxSecretBytes = 16384;

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function decodeBase64Url(
  value: unknown,
  minBytes: number,
  maxBytes: number,
): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil((maxBytes * 4) / 3) ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  )
    throw new CryptoFailure();
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const padded =
      value.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (value.length % 4)) % 4);
    bytes = Uint8Array.from(atob(padded), (character) =>
      character.charCodeAt(0),
    );
  } catch {
    throw new CryptoFailure();
  }
  // Canonical encoding is public format validation, not a secret comparison.
  if (
    bytes.length < minBytes ||
    bytes.length > maxBytes ||
    encodeBase64Url(bytes) !== value
  )
    throw new CryptoFailure();
  return bytes;
}

export function cryptoRecord(
  value: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new CryptoFailure();
  const keys = Object.keys(value);
  if (
    keys.length !== fields.length ||
    keys.some((key) => !fields.includes(key))
  )
    throw new CryptoFailure();
  return value as Record<string, unknown>;
}

export function parseKeyReference(
  value: unknown,
  purpose?: KeyPurpose,
): KeyReference {
  const record = cryptoRecord(value, ['purpose', 'id', 'version']);
  if (
    !['token-hmac', 'blind-index', 'envelope-kek', 'password-pepper'].includes(
      String(record.purpose),
    ) ||
    (purpose !== undefined && record.purpose !== purpose) ||
    typeof record.id !== 'string' ||
    !label.test(record.id) ||
    !Number.isSafeInteger(record.version) ||
    Number(record.version) < 1 ||
    Number(record.version) > 2147483647
  )
    throw new CryptoFailure();
  return Object.freeze({
    purpose: record.purpose as KeyPurpose,
    id: record.id,
    version: Number(record.version),
  });
}

export function sameKeyReference(a: KeyReference, b: KeyReference): boolean {
  return a.id === b.id && a.version === b.version && a.purpose === b.purpose;
}

export function parseMinimumPasswordRecord(
  value: unknown,
): MinimumPasswordRecord {
  const record = cryptoRecord(value, [
    'v',
    'alg',
    'iterations',
    'key',
    'salt',
    'verifier',
  ]);
  if (
    record.v !== 1 ||
    record.alg !== 'PBKDF2-HMAC-SHA256' ||
    !Number.isSafeInteger(record.iterations) ||
    Number(record.iterations) < 1 ||
    Number(record.iterations) > 1_000_000
  )
    throw new CryptoFailure();
  decodeBase64Url(record.salt, 16, 16);
  decodeBase64Url(record.verifier, 32, 32);
  return Object.freeze({
    v: 1,
    alg: 'PBKDF2-HMAC-SHA256',
    iterations: Number(record.iterations),
    key: parseKeyReference(record.key, 'password-pepper'),
    salt: record.salt as string,
    verifier: record.verifier as string,
  });
}

/** Only the provider imports raw long-lived keys; imported handles cannot be exported. */
export async function importProvidedKey(
  ref: KeyReference,
  raw: Uint8Array,
): Promise<ProvidedKey> {
  const reference = parseKeyReference(ref);
  if (raw.byteLength !== 32) throw new CryptoFailure();
  const bytes = new Uint8Array(raw);
  try {
    const key =
      reference.purpose === 'envelope-kek'
        ? await crypto.subtle.importKey(
            'raw',
            bytes,
            { name: 'AES-KW' },
            false,
            ['wrapKey', 'unwrapKey'],
          )
        : await crypto.subtle.importKey(
            'raw',
            bytes,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign', 'verify'],
          );
    return Object.freeze({ ref: reference, key });
  } catch {
    throw new CryptoFailure();
  } finally {
    bytes.fill(0);
  }
}

export function contextBytes(
  context: SecretContext,
  domain: string,
): Uint8Array<ArrayBuffer> {
  const value = cryptoRecord(context, [
    'resourceType',
    'resourceId',
    'field',
    'projectId',
    'schemaVersion',
  ]);
  if (
    typeof value.resourceType !== 'string' ||
    !label.test(value.resourceType) ||
    typeof value.field !== 'string' ||
    !label.test(value.field) ||
    typeof value.resourceId !== 'string' ||
    !uuid.test(value.resourceId) ||
    (value.projectId !== null &&
      (typeof value.projectId !== 'string' || !uuid.test(value.projectId))) ||
    !Number.isSafeInteger(value.schemaVersion) ||
    Number(value.schemaVersion) < 1 ||
    Number(value.schemaVersion) > 65535
  )
    throw new CryptoFailure();
  return new Uint8Array(
    encoder.encode(
      JSON.stringify([
        'hyperbug',
        domain,
        1,
        value.resourceType,
        value.resourceId,
        value.field,
        value.projectId,
        value.schemaVersion,
      ]),
    ),
  );
}

export function checkedKey(
  provided: ProvidedKey,
  purpose: KeyPurpose,
  expected?: KeyReference,
): CryptoKey {
  const ref = parseKeyReference(provided.ref, purpose);
  if (expected && !sameKeyReference(ref, expected)) throw new CryptoFailure();
  const key = provided.key;
  const algorithm = key.algorithm;
  if (
    key.type !== 'secret' ||
    key.extractable ||
    !('length' in algorithm) ||
    algorithm.length !== 256
  )
    throw new CryptoFailure();
  if (purpose === 'envelope-kek') {
    if (
      algorithm.name !== 'AES-KW' ||
      !key.usages.includes('wrapKey') ||
      !key.usages.includes('unwrapKey')
    )
      throw new CryptoFailure();
  } else if (
    algorithm.name !== 'HMAC' ||
    !('hash' in algorithm) ||
    typeof algorithm.hash !== 'object' ||
    algorithm.hash === null ||
    !('name' in algorithm.hash) ||
    algorithm.hash.name !== 'SHA-256' ||
    !key.usages.includes('sign') ||
    !key.usages.includes('verify')
  )
    throw new CryptoFailure();
  return key;
}

function macPayload(
  domain: string,
  context: SecretContext,
  value: string,
): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    encoder.encode(
      JSON.stringify([
        new TextDecoder().decode(contextBytes(context, domain)),
        value,
      ]),
    ),
  );
}

export function generateOpaqueCredential(): string {
  return 'hb1_' + encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

function credential(value: string): void {
  if (typeof value !== 'string' || !/^hb1_[A-Za-z0-9_-]{43}$/.test(value))
    throw new CryptoFailure();
  decodeBase64Url(value.slice(4), 32, 32);
}

function parseDigest(value: unknown, purpose: KeyPurpose): CredentialDigest {
  const record = cryptoRecord(value, ['v', 'alg', 'key', 'digest']);
  if (record.v !== 1 || record.alg !== 'HS256') throw new CryptoFailure();
  const key = parseKeyReference(record.key, purpose);
  const digest = encodeBase64Url(decodeBase64Url(record.digest, 32, 32));
  return Object.freeze({ v: 1, alg: 'HS256', key, digest });
}

export async function digestCredential(
  provider: KeyProvider,
  token: string,
  context: SecretContext,
): Promise<CredentialDigest> {
  credential(token);
  const payload = macPayload('credential-HS256', context, token);
  try {
    const provided = await provider.current('token-hmac');
    const reference = parseKeyReference(provided.ref, 'token-hmac');
    const key = checkedKey(provided, 'token-hmac', reference);
    const digest = await crypto.subtle.sign('HMAC', key, payload);
    return Object.freeze({
      v: 1,
      alg: 'HS256',
      key: reference,
      digest: encodeBase64Url(new Uint8Array(digest)),
    });
  } catch {
    throw new CryptoFailure();
  }
}

/** False means invalid input/MAC; provider failures throw safely and must deny access. */
export async function verifyCredential(
  provider: KeyProvider,
  token: string,
  stored: unknown,
  context: SecretContext,
): Promise<boolean> {
  let record: CredentialDigest;
  let payload: Uint8Array<ArrayBuffer>;
  try {
    credential(token);
    record = parseDigest(stored, 'token-hmac');
    payload = macPayload('credential-HS256', context, token);
  } catch {
    return false;
  }
  try {
    const provided = await provider.get(record.key);
    return await crypto.subtle.verify(
      'HMAC',
      checkedKey(provided, 'token-hmac', record.key),
      decodeBase64Url(record.digest, 32, 32),
      payload,
    );
  } catch {
    throw new CryptoFailure();
  }
}

/** Only after successful verification; previous token keys need no plaintext storage. */
export async function migrateCredentialDigest(
  provider: KeyProvider,
  token: string,
  stored: unknown,
  context: SecretContext,
): Promise<CredentialDigest> {
  const boundContext = Object.freeze({ ...context });
  if (!(await verifyCredential(provider, token, stored, boundContext)))
    throw new CryptoFailure();
  return digestCredential(provider, token, boundContext);
}

/** Value normalization is the owning field's explicit policy, not this crypto service. */
export async function blindIndexCandidates(
  provider: KeyProvider,
  normalizedValue: string,
  context: SecretContext,
): Promise<readonly CredentialDigest[]> {
  if (
    typeof normalizedValue !== 'string' ||
    normalizedValue.length === 0 ||
    encoder.encode(normalizedValue).length > 2048
  )
    throw new CryptoFailure();
  const payload = macPayload('blind-index-HS256', context, normalizedValue);
  try {
    const provided = await provider.readable('blind-index');
    if (provided.length < 1 || provided.length > 3) throw new CryptoFailure();
    return await Promise.all(
      provided.map(async (entry) => ({
        v: 1 as const,
        alg: 'HS256' as const,
        key: parseKeyReference(entry.ref),
        digest: encodeBase64Url(
          new Uint8Array(
            await crypto.subtle.sign(
              'HMAC',
              checkedKey(entry, 'blind-index'),
              payload,
            ),
          ),
        ),
      })),
    );
  } catch {
    throw new CryptoFailure();
  }
}

function encryptedRecord(value: unknown): EncryptedSecret {
  const record = cryptoRecord(value, [
    'v',
    'alg',
    'wrap',
    'key',
    'iv',
    'wrappedKey',
    'ciphertext',
  ]);
  if (record.v !== 1 || record.alg !== 'A256GCM' || record.wrap !== 'A256KW')
    throw new CryptoFailure();
  return Object.freeze({
    v: 1,
    alg: 'A256GCM',
    wrap: 'A256KW',
    key: parseKeyReference(record.key, 'envelope-kek'),
    iv: encodeBase64Url(decodeBase64Url(record.iv, 12, 12)),
    wrappedKey: encodeBase64Url(decodeBase64Url(record.wrappedKey, 40, 40)),
    ciphertext: encodeBase64Url(
      decodeBase64Url(record.ciphertext, 17, maxSecretBytes + 16),
    ),
  });
}

export async function encryptSecret(
  provider: KeyProvider,
  plaintext: Uint8Array,
  context: SecretContext,
): Promise<EncryptedSecret> {
  if (
    !(plaintext instanceof Uint8Array) ||
    plaintext.byteLength < 1 ||
    plaintext.byteLength > maxSecretBytes
  )
    throw new CryptoFailure();
  const additionalData = contextBytes(context, 'A256GCM-A256KW');
  const bytes = new Uint8Array(plaintext);
  try {
    const provided = await provider.current('envelope-kek');
    const reference = parseKeyReference(provided.ref, 'envelope-kek');
    const kek = checkedKey(provided, 'envelope-kek', reference);
    // Every write gets a new key; this is its only encryption, so its nonce cannot repeat.
    const dek = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    if (!('type' in dek) || dek.type !== 'secret') throw new CryptoFailure();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const [ciphertext, wrappedKey] = await Promise.all([
      crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData, tagLength: 128 },
        dek,
        bytes,
      ),
      crypto.subtle.wrapKey('raw', dek, kek, 'AES-KW'),
    ]);
    return Object.freeze({
      v: 1,
      alg: 'A256GCM',
      wrap: 'A256KW',
      key: reference,
      iv: encodeBase64Url(iv),
      wrappedKey: encodeBase64Url(new Uint8Array(wrappedKey)),
      ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
    });
  } catch {
    throw new CryptoFailure();
  } finally {
    bytes.fill(0);
  }
}

export async function decryptSecret(
  provider: KeyProvider,
  stored: unknown,
  context: SecretContext,
): Promise<Uint8Array<ArrayBuffer>> {
  const record = encryptedRecord(stored);
  const additionalData = contextBytes(context, 'A256GCM-A256KW');
  try {
    const provided = await provider.get(record.key);
    const dek = await crypto.subtle.unwrapKey(
      'raw',
      decodeBase64Url(record.wrappedKey, 40, 40),
      checkedKey(provided, 'envelope-kek', record.key),
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    return new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: decodeBase64Url(record.iv, 12, 12),
          additionalData,
          tagLength: 128,
        },
        dek,
        decodeBase64Url(record.ciphertext, 17, maxSecretBytes + 16),
      ),
    );
  } catch {
    throw new CryptoFailure();
  }
}

/** Authentication is checked before replacing the wrapper; caller persists atomically. */
export async function rewrapSecret(
  provider: KeyProvider,
  stored: unknown,
  context: SecretContext,
): Promise<EncryptedSecret> {
  const record = encryptedRecord(stored);
  const additionalData = contextBytes(context, 'A256GCM-A256KW');
  try {
    const old = await provider.get(record.key);
    const current = await provider.current('envelope-kek');
    const currentReference = parseKeyReference(current.ref, 'envelope-kek');
    const dek = await crypto.subtle.unwrapKey(
      'raw',
      decodeBase64Url(record.wrappedKey, 40, 40),
      checkedKey(old, 'envelope-kek', record.key),
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt'],
    );
    const authenticated = new Uint8Array(
      await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: decodeBase64Url(record.iv, 12, 12),
          additionalData,
          tagLength: 128,
        },
        dek,
        decodeBase64Url(record.ciphertext, 17, maxSecretBytes + 16),
      ),
    );
    authenticated.fill(0);
    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      dek,
      checkedKey(current, 'envelope-kek', currentReference),
      'AES-KW',
    );
    return Object.freeze({
      ...record,
      key: currentReference,
      wrappedKey: encodeBase64Url(new Uint8Array(wrappedKey)),
    });
  } catch {
    throw new CryptoFailure();
  }
}

/** Strictly validate a persisted crypto payload before pairing it with a key reference. */
export function parseProtectedValue(
  value: unknown,
): CredentialDigest | EncryptedSecret | MinimumPasswordRecord {
  if (!value || typeof value !== 'object' || !('key' in value))
    throw new CryptoFailure();
  const ref = parseKeyReference(value.key);
  if (ref.purpose === 'envelope-kek') return encryptedRecord(value);
  if (ref.purpose === 'password-pepper')
    return parseMinimumPasswordRecord(value);
  return parseDigest(value, ref.purpose);
}
