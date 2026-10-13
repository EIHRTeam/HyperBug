import { expect } from 'vitest';
import {
  SecretKeyProvider,
  scopeKeyProvider,
  type KeyRegistry,
} from '../../packages/security/src/index.ts';
import { cryptoFixture } from './crypto-scenarios.ts';

export async function keyMaterialContract(
  query: (
    sql: string,
    values?: (string | number)[],
  ) => Promise<Record<string, unknown>[]>,
  registry: KeyRegistry,
) {
  const fixture = cryptoFixture(),
    signal = new AbortController().signal;
  for (const purpose of ['token-hmac', 'password-pepper'] as const)
    await query(
      "INSERT INTO key_versions (purpose, key_id, version, state, created_at) VALUES (?, ?, 1, 'current', ?)",
      [purpose, purpose + '-test', Date.now()],
    );
  let sourceReads = 0,
    registryReads = 0;
  const provider = new SecretKeyProvider(
    {
      read: async () => {
        sourceReads++;
        return fixture.source.read();
      },
    },
    {
      load: async (purpose, s) => {
        registryReads++;
        return registry.load(purpose, s);
      },
    },
  );
  const first = scopeKeyProvider(provider, {}),
    token = await first.current('token-hmac');
  expect((await first.get(token.ref)).key).toBe(token.key);
  expect(sourceReads).toBe(1);
  expect(registryReads).toBe(1);
  expect((await scopeKeyProvider(provider, {}).current('token-hmac')).key).toBe(
    token.key,
  );
  expect(sourceReads).toBe(2);
  expect(registryReads).toBe(2);
  const pepper = await registry.load('password-pepper', signal);
  expect(
    pepper.readable.every((ref) => ref.purpose === 'password-pepper'),
  ).toBe(true);
  expect(
    pepper.required.every((ref) => ref.purpose === 'password-pepper'),
  ).toBe(true);
  const change = async (
    kind: 'activate' | 'revoke' | 'remove',
    version: number,
  ) =>
    registry.mutate({
      expectedGeneration: (await registry.inspect(signal)).generation,
      auditId: crypto.randomUUID(),
      requestId: crypto.randomUUID(),
      now: Date.now(),
      change: {
        kind,
        key: { purpose: 'token-hmac', id: 'token-hmac-test', version },
      },
    });
  await change('activate', 2);
  const rotated = scopeKeyProvider(provider, {});
  expect((await rotated.current('token-hmac')).ref.version).toBe(2);
  expect((await rotated.get(token.ref)).key).toBe(token.key);
  await change('revoke', 1);
  await expect(
    scopeKeyProvider(provider, {}).get(token.ref),
  ).rejects.toMatchObject({ code: 'CRYPTO_FAILURE' });
  // Only this original request still holds its already-observed lifecycle snapshot.
  expect((await first.get(token.ref)).key).toBe(token.key);
  await change('remove', 1);
  await expect(
    scopeKeyProvider(provider, {}).get(token.ref),
  ).rejects.toMatchObject({ code: 'CRYPTO_FAILURE' });
  expect(
    (await scopeKeyProvider(provider, {}).current('password-pepper')).ref
      .purpose,
  ).toBe('password-pepper');
}
