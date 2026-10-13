import { expect, it } from 'vitest';
import {
  cryptoKnownAnswers,
  cryptoScenarios,
} from '../fixtures/crypto-scenarios.ts';

it('matches NIST and RFC known answers using platform cryptography', async () => {
  expect(await cryptoKnownAnswers()).toEqual({
    aesGcm: true,
    aesKw: true,
    hmacSign: true,
    hmacVerify: true,
  });
});

it('protects credentials, envelopes and key rotation with bounded fail-closed providers', async () => {
  const results = await cryptoScenarios();
  expect(Object.keys(results).length).toBeGreaterThan(30);
  for (const [scenario, result] of Object.entries(results))
    expect(result, scenario).toBe(true);
});
