import { expect, it } from 'vitest';
import { CryptoFailure } from '../../packages/security/src/crypto.ts';
import {
  createStandardPasswordService,
  hashStandardPassword,
  parseStandardPasswordRecord,
  verifyStandardPassword,
  type Argon2idProvider,
} from '../../packages/security/src/standard-password.ts';

const floor = { memoryKiB: 19456, passes: 2, parallelism: 1 };
const maximum = { memoryKiB: 65536, passes: 5, parallelism: 4 };

it('rejects weaker algorithms, malformed records and unaccepted policy before provider work', async () => {
  let calls = 0;
  const provider: Argon2idProvider = {
    derive: async () => {
      calls++;
      return new Uint8Array(32);
    },
    matches: async () => {
      calls++;
      return true;
    },
  };
  const policy = { current: floor, maximum };
  for (const stored of [
    { v: 1, alg: 'PBKDF2-HMAC-SHA256' },
    {
      v: 1,
      alg: 'Argon2id',
      ...floor,
      salt: 'not-base64url!',
      verifier: 'a',
    },
  ])
    await expect(
      verifyStandardPassword(provider, 'password', stored, policy),
    ).rejects.toBeInstanceOf(CryptoFailure);
  await expect(
    hashStandardPassword(provider, 'password', {
      current: { ...floor, memoryKiB: 1024 },
      maximum,
    }),
  ).rejects.toBeInstanceOf(CryptoFailure);
  await expect(
    hashStandardPassword(provider, 'password', {
      current: floor,
      maximum: { ...maximum, memoryKiB: 16384 },
    }),
  ).rejects.toBeInstanceOf(CryptoFailure);
  const overMaximum = {
    v: 1,
    alg: 'Argon2id',
    memoryKiB: 131072,
    passes: 2,
    parallelism: 1,
    salt: 'MDEyMzQ1Njc4OWFiY2RlZg',
    verifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  };
  await expect(
    verifyStandardPassword(provider, 'password', overMaximum, policy),
  ).rejects.toBeInstanceOf(CryptoFailure);
  expect(calls).toBe(0);
});

it('versions independent salts and upgrades without lowering a stronger parameter', async () => {
  const derived: Array<{
    memoryKiB: number;
    passes: number;
    parallelism: number;
  }> = [];
  const provider: Argon2idProvider = {
    derive: async (_password, salt, parameters) => {
      expect(salt.byteLength).toBe(16);
      derived.push({ ...parameters });
      return new Uint8Array(32).fill(7);
    },
    matches: async (_password, salt, verifier, parameters) => {
      expect(salt.byteLength).toBe(16);
      expect(verifier.byteLength).toBe(32);
      expect(parameters).toMatchObject({ ...floor, passes: 3 });
      return true;
    },
  };
  const initial = await hashStandardPassword(provider, 'password', {
    current: { ...floor, passes: 3 },
    maximum,
  });
  const another = await hashStandardPassword(provider, 'password', {
    current: { ...floor, passes: 3 },
    maximum,
  });
  expect(initial.salt).not.toBe(another.salt);
  expect(parseStandardPasswordRecord(initial)).toEqual(initial);
  const result = await verifyStandardPassword(provider, 'password', initial, {
    current: { memoryKiB: 32768, passes: 2, parallelism: 2 },
    maximum,
  });
  expect(result.verified).toBe(true);
  expect(result.replacement).toMatchObject({
    v: 1,
    alg: 'Argon2id',
    memoryKiB: 32768,
    passes: 3,
    parallelism: 2,
  });
  expect(result.replacement?.salt).not.toBe(initial.salt);
  expect(derived).toEqual([
    { ...floor, passes: 3 },
    { ...floor, passes: 3 },
    { memoryKiB: 32768, passes: 3, parallelism: 2 },
  ]);
});

it('does not rehash a stronger record and denies unavailable or cancelled verification', async () => {
  const provider: Argon2idProvider = {
    derive: async () => new Uint8Array(32),
    matches: async () => true,
  };
  const record = await hashStandardPassword(provider, 'password', {
    current: { memoryKiB: 32768, passes: 3, parallelism: 2 },
    maximum,
  });
  expect(
    await verifyStandardPassword(provider, 'password', record, {
      current: floor,
      maximum,
    }),
  ).toEqual({ verified: true, replacement: null });
  expect(
    await verifyStandardPassword(
      { ...provider, matches: async () => false },
      'wrong',
      record,
      { current: floor, maximum },
    ),
  ).toEqual({ verified: false, replacement: null });
  await expect(
    verifyStandardPassword(
      {
        ...provider,
        matches: async () => {
          throw new Error('private detail');
        },
      },
      'password',
      record,
      { current: floor, maximum },
    ),
  ).rejects.toBeInstanceOf(CryptoFailure);
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(
    verifyStandardPassword(
      provider,
      'password',
      record,
      { current: floor, maximum },
      cancelled.signal,
    ),
  ).rejects.toBeInstanceOf(CryptoFailure);
});

it('binds an immutable policy before account use', async () => {
  const costs: number[] = [];
  const provider: Argon2idProvider = {
    derive: async (_password, _salt, parameters) => {
      costs.push(parameters.passes);
      return new Uint8Array(32);
    },
    matches: async () => true,
  };
  const policy = {
    current: { ...floor },
    maximum: { ...floor },
  };
  const service = createStandardPasswordService(provider, policy);
  policy.current.passes = 3;
  policy.maximum.passes = 3;
  const record = await service.hash('password');
  expect(record.passes).toBe(2);
  expect(await service.verify('password', record)).toEqual({
    verified: true,
    replacement: null,
  });
  expect(costs).toEqual([2]);
  expect(() =>
    createStandardPasswordService({} as Argon2idProvider, policy),
  ).toThrow(CryptoFailure);
  expect(() =>
    createStandardPasswordService(provider, {
      current: { ...floor, memoryKiB: 1024 },
      maximum: floor,
    }),
  ).toThrow(CryptoFailure);
});
