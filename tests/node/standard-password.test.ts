import { expect, it } from 'vitest';
import {
  createNodeArgon2idProvider,
  createNodeStandardPasswordService,
} from '../../apps/api-node/src/standard-password.ts';
import { loadDeploymentConfig } from '../../packages/config/src/deployment.ts';
import { CryptoFailure } from '../../packages/security/src/crypto.ts';

it('derives the archived cross-implementation Argon2id known answer with Node 24', async () => {
  expect(() => createNodeArgon2idProvider(0, 19456)).toThrow(CryptoFailure);
  const provider = createNodeArgon2idProvider(1, 19456);
  const password = new TextEncoder().encode('test password');
  const salt = new TextEncoder().encode('0123456789abcdef');
  await expect(
    provider.derive(password, salt, {
      memoryKiB: 65536,
      passes: 2,
      parallelism: 1,
    }),
  ).rejects.toBeInstanceOf(CryptoFailure);
  const derived = await provider.derive(password, salt, {
    memoryKiB: 19456,
    passes: 2,
    parallelism: 1,
  });
  expect(Buffer.from(derived).toString('hex')).toBe(
    '0878ed8cc76d64e98c1d146d7913446f382c7f7ce49892b055ccaead269e9fbc',
  );
  const mutableVerifier = Uint8Array.from(derived);
  const matching = provider.matches(password, salt, mutableVerifier, {
    memoryKiB: 19456,
    passes: 2,
    parallelism: 1,
  });
  mutableVerifier.fill(0);
  expect(await matching).toBe(true);
  const wrong = Uint8Array.from(derived);
  wrong[0] = (wrong[0] ?? 0) ^ 1;
  expect(
    await provider.matches(password, salt, wrong, {
      memoryKiB: 19456,
      passes: 2,
      parallelism: 1,
    }),
  ).toBe(false);
  wrong.fill(0);
  derived.fill(0);
  password.fill(0);
});

it('rejects an unsupported Node verification ceiling before account use', async () => {
  const floor = { memoryKiB: 19456, passes: 2, parallelism: 1 };
  const standard = loadDeploymentConfig({}, 'node');
  const minimum = loadDeploymentConfig(
    {
      HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
      HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1',
    },
    'cloudflare',
  );
  const policy = {
    current: floor,
    maximum: { ...floor, memoryKiB: 32768 },
  };
  expect(() =>
    createNodeStandardPasswordService(standard, policy, 1, 19456),
  ).toThrow(CryptoFailure);
  expect(() =>
    createNodeStandardPasswordService(
      minimum,
      { current: floor, maximum: floor },
      1,
      19456,
    ),
  ).toThrow(CryptoFailure);
  const service = createNodeStandardPasswordService(
    standard,
    { current: floor, maximum: floor },
    1,
    19456,
  );
  const record = await service.hash('test password');
  await expect(service.verify('test password', record)).resolves.toEqual({
    verified: true,
    replacement: null,
  });
});
