import {
  CryptoFailure,
  SecretKeyProvider,
  blindIndexCandidates,
  decodeBase64Url,
  decryptSecret,
  digestCredential,
  encodeBase64Url,
  encryptSecret,
  generateOpaqueCredential,
  migrateCredentialDigest,
  hashMinimumPassword,
  rewrapSecret,
  verifyCredential,
  verifyMinimumPassword,
  type KeyLifecycleSnapshot,
  type KeyProvider,
  type KeyPurpose,
  type KeyReference,
  type SecretContext,
} from '../../packages/security/src/index.ts';

const encoder = new TextEncoder();
const purposes: readonly KeyPurpose[] = [
  'token-hmac',
  'blind-index',
  'envelope-kek',
  'password-pepper',
];

export function cryptoFixture() {
  const ref = (purpose: KeyPurpose, version: number): KeyReference => ({
    purpose,
    id: purpose + '-test',
    version,
  });
  const keys = purposes.flatMap((purpose) =>
    [1, 2].map((version) => ({
      ref: ref(purpose, version),
      material: encodeBase64Url(crypto.getRandomValues(new Uint8Array(32))),
    })),
  );
  const state = {
    version: 1,
    allowPrevious: true,
    required: purposes.map((purpose) => ref(purpose, 1)),
    keys,
    unavailable: false,
  };
  const source = {
    read: async () => JSON.stringify({ v: 1, keys: state.keys }),
  };
  const lifecycle = {
    async load(purpose: KeyPurpose): Promise<KeyLifecycleSnapshot> {
      if (state.unavailable) throw new Error('SEEDED_PROVIDER_SECRET');
      return {
        generation: state.version,
        current: ref(purpose, state.version),
        readable:
          state.version === 2 && state.allowPrevious
            ? [ref(purpose, 2), ref(purpose, 1)]
            : [ref(purpose, state.version)],
        required: state.required,
      };
    },
  };
  return {
    state,
    source,
    lifecycle,
    provider: new SecretKeyProvider(source, lifecycle),
    ref,
  };
}

const context: SecretContext = {
  resourceType: 'identity',
  resourceId: '00000000-0000-4000-8000-000000000001',
  field: 'refresh-token',
  projectId: '00000000-0000-4000-8000-000000000002',
  schemaVersion: 1,
};
async function rejected(operation: () => Promise<unknown>): Promise<boolean> {
  try {
    await operation();
    return false;
  } catch (error) {
    return (
      error instanceof CryptoFailure &&
      error.message === 'Cryptographic operation failed.' &&
      error.cause === undefined
    );
  }
}
function changed(value: string): string {
  const bytes = decodeBase64Url(value, 1, 20000);
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  return encodeBase64Url(bytes);
}

/** Public known-answer vectors; assertions exercise platform operations, not custom primitives. */
export async function cryptoKnownAnswers(): Promise<Record<string, boolean>> {
  const hex = (value: string) =>
    Uint8Array.from(value.match(/../g) ?? [], (pair) => parseInt(pair, 16));
  const toHex = (value: ArrayBuffer) =>
    Array.from(new Uint8Array(value), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
  // NIST CAVP gcmEncryptExtIV256.rsp: Keylen=256, IVlen=96, PTlen=128,
  // AADlen=128, Taglen=128, Count=0; retrieved 2026-09-19.
  const gcm = await crypto.subtle.importKey(
    'raw',
    hex('92e11dcdaa866f5ce790fd24501f92509aacf4cb8b1339d50c9c1240935dd08b'),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: hex('ac93a1a6145299bde902f21a'),
      additionalData: hex('1e0889016f67601c8ebea4943bc23ad6'),
      tagLength: 128,
    },
    gcm,
    hex('2d71bcfa914e4ac045b2aa60955fad24'),
  );
  // RFC 3394 section 4.6: 256-bit KEK wrapping a 256-bit key.
  const kek = await crypto.subtle.importKey(
    'raw',
    hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'),
    'AES-KW',
    false,
    ['wrapKey'],
  );
  const dek = await crypto.subtle.importKey(
    'raw',
    hex('00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f'),
    'AES-GCM',
    true,
    ['encrypt'],
  );
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, 'AES-KW');
  // RFC 4231 section 4.7: HMAC-SHA-256 with a 131-byte public test key.
  const hmac = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(131).fill(0xaa),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const message = encoder.encode(
    'Test Using Larger Than Block-Size Key - Hash Key First',
  );
  const signature = hex(
    '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
  );
  return {
    aesGcm:
      toHex(encrypted) ===
      '8995ae2e6df3dbf96fac7b7137bae67feca5aa77d51d4a0a14d9c51e1da474ab',
    aesKw:
      toHex(wrapped) ===
      '28c9f404c4b810f4cbccb35cfb87f8263f5786e2d80ed326cbc7f0e71a99f43bfb988b9b7a02dd21',
    hmacSign:
      toHex(await crypto.subtle.sign('HMAC', hmac, message)) ===
      toHex(signature.buffer),
    hmacVerify: await crypto.subtle.verify('HMAC', hmac, signature, message),
  };
}

export async function cryptoScenarios(): Promise<Record<string, boolean>> {
  const { provider, state, source, lifecycle } = cryptoFixture();
  const token = generateOpaqueCredential();
  const digest = await digestCredential(provider, token, context);
  const plaintext = encoder.encode('SEEDED_RECOVERABLE_SECRET');
  const envelope = await encryptSecret(provider, plaintext, context);
  const second = await encryptSecret(provider, plaintext, context);
  const beforeIndex = await blindIndexCandidates(
    provider,
    'normalized@example.invalid',
    context,
  );
  const result: Record<string, boolean> = {
    tokenEntropyEncoding:
      /^hb1_[A-Za-z0-9_-]{43}$/.test(token) &&
      token !== generateOpaqueCredential(),
    credentialValid: await verifyCredential(provider, token, digest, context),
    wrongCredential: !(await verifyCredential(
      provider,
      generateOpaqueCredential(),
      digest,
      context,
    )),
    wrongMac: !(await verifyCredential(
      provider,
      token,
      { ...digest, digest: changed(digest.digest) },
      context,
    )),
    wrongTokenContext: !(await verifyCredential(provider, token, digest, {
      ...context,
      field: 'password-reset',
    })),
    crossPurpose: !(await verifyCredential(
      provider,
      token,
      { ...digest, key: { ...digest.key, purpose: 'blind-index' } },
      context,
    )),
    recovered:
      new TextDecoder().decode(
        await decryptSecret(provider, envelope, context),
      ) === 'SEEDED_RECOVERABLE_SECRET',
    distinctDekNonce:
      second.iv !== envelope.iv &&
      second.wrappedKey !== envelope.wrappedKey &&
      second.ciphertext !== envelope.ciphertext,
    secretNotSerialized:
      !JSON.stringify({ digest, envelope }).includes(
        'SEEDED_RECOVERABLE_SECRET',
      ) && !JSON.stringify(digest).includes(token),
    oversizedPlaintext: await rejected(() =>
      encryptSecret(provider, new Uint8Array(16385), context),
    ),
    unknownVersion: await rejected(() =>
      decryptSecret(provider, { ...envelope, v: 2 }, context),
    ),
    unknownAlgorithm: await rejected(() =>
      decryptSecret(provider, { ...envelope, alg: 'A128GCM' }, context),
    ),
    extraField: await rejected(() =>
      decryptSecret(provider, { ...envelope, plaintext: 'untrusted' }, context),
    ),
  };
  for (const field of ['iv', 'wrappedKey', 'ciphertext'] as const)
    result['tamper-' + field] = await rejected(() =>
      decryptSecret(
        provider,
        { ...envelope, [field]: changed(envelope[field]) },
        context,
      ),
    );
  for (const [field, value] of Object.entries({
    resourceType: 'account',
    resourceId: '00000000-0000-4000-8000-000000000099',
    field: 'other-secret',
    projectId: null,
    schemaVersion: 2,
  }))
    result['aad-' + field] = await rejected(() =>
      decryptSecret(provider, envelope, { ...context, [field]: value }),
    );
  state.version = 2;
  result.previousCredential = await verifyCredential(
    provider,
    token,
    digest,
    context,
  );
  result.previousEnvelope =
    new TextDecoder().decode(
      await decryptSecret(provider, envelope, context),
    ) === 'SEEDED_RECOVERABLE_SECRET';
  const migrated = await migrateCredentialDigest(
    provider,
    token,
    digest,
    context,
  );
  result.migratedCredential =
    migrated.key.version === 2 &&
    (await verifyCredential(provider, token, migrated, context));
  const rewrapped = await rewrapSecret(provider, envelope, context);
  result.rewrappedWithoutReencryption =
    rewrapped.key.version === 2 &&
    rewrapped.iv === envelope.iv &&
    rewrapped.ciphertext === envelope.ciphertext &&
    rewrapped.wrappedKey !== envelope.wrappedKey &&
    new TextDecoder().decode(
      await decryptSecret(provider, rewrapped, context),
    ) === 'SEEDED_RECOVERABLE_SECRET';
  result.rewrapAuthenticatesContext = await rejected(() =>
    rewrapSecret(provider, envelope, { ...context, field: 'wrong-field' }),
  );
  const rotatedIndex = await blindIndexCandidates(
    provider,
    'normalized@example.invalid',
    context,
  );
  result.blindIndexRotation =
    rotatedIndex.length === 2 &&
    rotatedIndex[0]?.key.version === 2 &&
    rotatedIndex[1]?.digest === beforeIndex[0]?.digest;
  state.allowPrevious = false;
  result.revokedCredential = await rejected(() =>
    verifyCredential(provider, token, digest, context),
  );
  result.revokedEnvelope = await rejected(() =>
    decryptSecret(provider, envelope, context),
  );
  result.currentSurvivesRevocation = await verifyCredential(
    provider,
    token,
    migrated,
    context,
  );
  const originalKeys = state.keys;
  state.keys = state.keys.filter(
    (entry) =>
      !(entry.ref.purpose === 'envelope-kek' && entry.ref.version === 1),
  );
  result.retainedBackupMissing = await rejected(() =>
    encryptSecret(provider, plaintext, context),
  );
  state.keys = originalKeys;
  state.unavailable = true;
  result.lifecycleUnavailable = await rejected(() =>
    decryptSecret(provider, rewrapped, context),
  );
  state.unavailable = false;
  result.sourceUnavailable = await rejected(() =>
    new SecretKeyProvider(
      {
        read: async () => {
          throw new Error('SEEDED_SECRET');
        },
      },
      lifecycle,
    ).current('token-hmac'),
  );
  result.sourceTimeout = await rejected(() =>
    new SecretKeyProvider(
      { read: async () => new Promise(() => {}) },
      lifecycle,
      10,
    ).current('token-hmac'),
  );
  result.malformedLifecycle = await rejected(() =>
    new SecretKeyProvider(source, {
      load: async () => null as unknown as KeyLifecycleSnapshot,
    }).current('token-hmac'),
  );
  state.keys = originalKeys.map((entry) => ({
    ...entry,
    material: originalKeys[0]!.material,
  }));
  result.reusedKeyMaterial = await rejected(() =>
    provider.current('token-hmac'),
  );
  state.keys = originalKeys;
  const imported = await provider.current('token-hmac');
  result.longLivedNonextractable = !imported.key.extractable;
  return result;
}

/** Functional PBKDF2 cases only; fixture counts are not Free-plan parameters. */
export async function minimumPasswordScenarios(): Promise<
  Record<string, boolean>
> {
  const { provider, state } = cryptoFixture();
  const passwordContext: SecretContext = {
    resourceType: 'public-user',
    resourceId: '00000000-0000-4000-8000-000000000003',
    field: 'password',
    projectId: null,
    schemaVersion: 1,
  };
  const password = 'correct horse battery staple';
  const lowPolicy = { currentIterations: 1000, maximumIterations: 1200 };
  const highPolicy = { currentIterations: 1200, maximumIterations: 1200 };
  const first = await hashMinimumPassword(
    provider,
    password,
    passwordContext,
    lowPolicy,
  );
  const second = await hashMinimumPassword(
    provider,
    password,
    passwordContext,
    lowPolicy,
  );
  const valid = await verifyMinimumPassword(
    provider,
    password,
    first,
    passwordContext,
    lowPolicy,
  );
  const wrong = await verifyMinimumPassword(
    provider,
    'wrong password',
    first,
    passwordContext,
    lowPolicy,
  );
  const wrongContext = await verifyMinimumPassword(
    provider,
    password,
    first,
    { ...passwordContext, resourceId: crypto.randomUUID() },
    lowPolicy,
  );
  const tampered = await verifyMinimumPassword(
    provider,
    password,
    { ...first, verifier: changed(first.verifier) },
    passwordContext,
    lowPolicy,
  );
  let unexpectedProviderCalls = 0;
  const unusedProvider: KeyProvider = {
    async current() {
      unexpectedProviderCalls++;
      throw new Error('unexpected pepper lookup');
    },
    async get() {
      unexpectedProviderCalls++;
      throw new Error('unexpected pepper lookup');
    },
    async readable() {
      unexpectedProviderCalls++;
      throw new Error('unexpected pepper lookup');
    },
  };
  const overMaximumDenied = await rejected(() =>
    verifyMinimumPassword(
      unusedProvider,
      password,
      { ...first, iterations: 1201 },
      passwordContext,
      lowPolicy,
    ),
  );
  const invalidPolicyDenied = await rejected(() =>
    verifyMinimumPassword(unusedProvider, password, first, passwordContext, {
      currentIterations: 1201,
      maximumIterations: 1200,
    }),
  );
  const result: Record<string, boolean> = {
    versionedRecord:
      first.v === 1 &&
      first.alg === 'PBKDF2-HMAC-SHA256' &&
      first.iterations === 1000 &&
      first.key.purpose === 'password-pepper' &&
      first.key.version === 1,
    secretNotSerialized:
      !JSON.stringify(first).includes(password) &&
      !JSON.stringify(first).includes('material'),
    randomSalt:
      first.salt !== second.salt && first.verifier !== second.verifier,
    valid: valid.verified && valid.replacement === null,
    wrongPassword: !wrong.verified && wrong.replacement === null,
    accountBound: !wrongContext.verified,
    tamperedVerifier: !tampered.verified,
    overMaximumDeniedBeforeProvider:
      overMaximumDenied && unexpectedProviderCalls === 0,
    invalidPolicyDeniedBeforeProvider:
      invalidPolicyDenied && unexpectedProviderCalls === 0,
    strongerAlgorithmDenied: await rejected(() =>
      verifyMinimumPassword(
        provider,
        password,
        { ...first, alg: 'Argon2id' },
        passwordContext,
        lowPolicy,
      ),
    ),
    crossPurposePepperDenied: await rejected(() =>
      verifyMinimumPassword(
        provider,
        password,
        { ...first, key: { ...first.key, purpose: 'token-hmac' } },
        passwordContext,
        lowPolicy,
      ),
    ),
    malformedCostDenied: await rejected(() =>
      verifyMinimumPassword(
        provider,
        password,
        { ...first, iterations: 1_000_001 },
        passwordContext,
        lowPolicy,
      ),
    ),
    extraRecordFieldDenied: await rejected(() =>
      verifyMinimumPassword(
        provider,
        password,
        { ...first, secret: 'SEEDED_SECRET' },
        passwordContext,
        lowPolicy,
      ),
    ),
    malformedPasswordDenied: await rejected(() =>
      hashMinimumPassword(provider, '\ud800', passwordContext, lowPolicy),
    ),
  };
  state.version = 2;
  const pepperOnly = await verifyMinimumPassword(
    provider,
    password,
    first,
    passwordContext,
    lowPolicy,
  );
  result.pepperRotationOnly =
    pepperOnly.verified &&
    pepperOnly.replacement?.key.version === 2 &&
    pepperOnly.replacement.iterations === 1000;
  const upgraded = await verifyMinimumPassword(
    provider,
    password,
    first,
    passwordContext,
    highPolicy,
  );
  result.loginRehash =
    upgraded.verified &&
    upgraded.replacement?.iterations === 1200 &&
    upgraded.replacement.key.version === 2 &&
    upgraded.replacement.salt !== first.salt;
  const later = await verifyMinimumPassword(
    provider,
    password,
    upgraded.replacement,
    passwordContext,
    lowPolicy,
  );
  result.noCostDowngrade = later.verified && later.replacement === null;
  state.allowPrevious = false;
  result.revokedPepperDenied = await rejected(() =>
    verifyMinimumPassword(
      provider,
      password,
      first,
      passwordContext,
      highPolicy,
    ),
  );
  const originalKeys = state.keys;
  state.keys = state.keys.filter(
    (entry) =>
      !(entry.ref.purpose === 'password-pepper' && entry.ref.version === 1),
  );
  result.missingRetainedPepperDenied = await rejected(() =>
    hashMinimumPassword(provider, password, passwordContext, highPolicy),
  );
  state.keys = originalKeys;
  state.unavailable = true;
  result.providerOutageDenied = await rejected(() =>
    verifyMinimumPassword(
      provider,
      password,
      upgraded.replacement,
      passwordContext,
      highPolicy,
    ),
  );
  return result;
}
