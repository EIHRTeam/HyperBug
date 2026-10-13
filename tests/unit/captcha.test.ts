import { expect, it } from 'vitest';
import {
  createCaptchaGate,
  type CaptchaProviderConfiguration,
} from '../../packages/server/src/captcha.ts';

const signal = new AbortController().signal;
const challenge = { expectedAction: 'register', signal };

it('allows a deployment with no CAPTCHA provider and no token', async () => {
  const gate = createCaptchaGate();
  expect(gate.enabled).toBe(false);
  await expect(gate.require(challenge)).resolves.toBeUndefined();
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(
    gate.require({ expectedAction: 'register', signal: cancelled.signal }),
  ).rejects.toMatchObject({ code: 'CAPTCHA_UNAVAILABLE' });
});

it('automatically requires server verification when a provider is configured', async () => {
  let calls = 0;
  const configuration = {
    verifier: {
      async verify(token) {
        calls++;
        expect(token).toBe('client-token');
        return {
          success: true,
          hostname: 'issues.example.org',
          action: 'register',
          challengeAtMs: 1000,
          score: null,
        };
      },
    },
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 1000,
    now: () => 2000,
  } satisfies CaptchaProviderConfiguration;
  const gate = createCaptchaGate(configuration);
  configuration.expectedHostname = 'elsewhere.example.org';
  expect(gate.enabled).toBe(true);
  await expect(gate.require(challenge)).rejects.toMatchObject({
    code: 'CAPTCHA_DENIED',
  });
  expect(calls).toBe(0);
  await expect(
    gate.require({ ...challenge, token: 'client-token' }),
  ).resolves.toBeUndefined();
  expect(calls).toBe(1);
});

it('rejects a configured provider that is incomplete or unavailable', async () => {
  expect(() => createCaptchaGate({ verifier: null } as never)).toThrowError(
    expect.objectContaining({ code: 'CAPTCHA_UNAVAILABLE' }),
  );
  const gate = createCaptchaGate({
    verifier: {
      async verify() {
        throw new Error('provider details');
      },
    },
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 1000,
  });
  await expect(
    gate.require({ ...challenge, token: 'client-token' }),
  ).rejects.toMatchObject({ code: 'CAPTCHA_UNAVAILABLE' });
});
