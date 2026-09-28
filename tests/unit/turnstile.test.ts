import { expect, it } from 'vitest';
import { createOutboundFetcher } from '../../packages/security/src/outbound.ts';
import {
  configureOptionalTurnstile,
  createCaptchaGate,
  createTurnstileVerifier,
  turnstileOutboundLimits,
} from '../../packages/server/src/index.ts';

const challengeAt = '2026-09-26T00:00:00.000Z';
const signal = new AbortController().signal;

it('selects optional Turnstile only when all provider bindings exist', async () => {
  let constructions = 0;
  const makeVerifier = () => {
    constructions++;
    return { verify: async () => ({ success: false }) };
  };
  const absent = configureOptionalTurnstile(
    { environment: 'production' },
    makeVerifier,
  );
  expect(absent.gate.enabled).toBe(false);
  expect(absent.siteKey).toBeNull();
  expect(constructions).toBe(0);
  await expect(
    absent.gate.require({ expectedAction: 'register', signal }),
  ).resolves.toBeUndefined();
  const present = configureOptionalTurnstile(
    {
      environment: 'production',
      secret: 'test-secret',
      siteKey: 'test-site-key',
      hostname: 'issues.example.org',
    },
    makeVerifier,
  );
  expect(present.gate.enabled).toBe(true);
  expect(present.siteKey).toBe('test-site-key');
  expect(constructions).toBe(1);
  await expect(
    present.gate.require({ expectedAction: 'register', signal }),
  ).rejects.toMatchObject({ code: 'CAPTCHA_DENIED' });
});

it('rejects partial, local-only and failed Turnstile setup', () => {
  const valid = {
    environment: 'production' as const,
    secret: 'test-secret',
    siteKey: 'test-site-key',
    hostname: 'issues.example.org',
  };
  const verifier = () => ({ verify: async () => ({ success: false }) });
  for (const bindings of [
    { environment: 'production' as const, secret: 'test-secret' },
    { ...valid, siteKey: '' },
    { ...valid, hostname: 'localhost' },
    { ...valid, hostname: '127.0.0.1' },
  ])
    expect(() => configureOptionalTurnstile(bindings, verifier)).toThrow(
      'Invalid Turnstile provider configuration',
    );
  expect(() =>
    configureOptionalTurnstile(valid, () => {
      throw new Error('test-secret must not appear');
    }),
  ).toThrow('Invalid Turnstile provider configuration');
});

it('rejects Cloudflare public test credentials outside local development', () => {
  const verifier = () => ({ verify: async () => ({ success: false }) });
  const settings = {
    secret: 'test-secret',
    siteKey: 'test-site-key',
    hostname: 'issues.example.org',
  };
  for (const environment of ['staging', 'production'] as const) {
    for (const secret of [
      '1x0000000000000000000000000000000AA',
      '2x0000000000000000000000000000000AA',
      '3x0000000000000000000000000000000AA',
    ])
      expect(() =>
        configureOptionalTurnstile(
          { ...settings, environment, secret },
          verifier,
        ),
      ).toThrow('Invalid Turnstile provider configuration');
    for (const siteKey of [
      '1x00000000000000000000AA',
      '1x00000000000000000000BB',
      '2x00000000000000000000AB',
      '2x00000000000000000000BB',
      '3x00000000000000000000FF',
    ])
      expect(() =>
        configureOptionalTurnstile(
          { ...settings, environment, siteKey },
          verifier,
        ),
      ).toThrow('Invalid Turnstile provider configuration');
  }
  const local = configureOptionalTurnstile(
    {
      environment: 'local',
      hostname: 'localhost',
      secret: '1x0000000000000000000000000000000AA',
      siteKey: '1x00000000000000000000AA',
    },
    verifier,
  );
  expect(local.gate.enabled).toBe(true);
});

function gateFor(response: unknown) {
  const outbound = createOutboundFetcher(turnstileOutboundLimits, (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    expect(input).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(init?.method).toBe('POST');
    expect(init?.redirect).toBe('manual');
    expect(init?.cache).toBe('no-store');
    const fields = new URLSearchParams(await new Response(init?.body).text());
    expect(fields.get('secret')).toBe('test-secret');
    expect(fields.get('response')).toBe('test-token');
    expect(fields.size).toBe(2);
    return Response.json(response);
  }) as typeof fetch);
  return createCaptchaGate({
    verifier: createTurnstileVerifier('test-secret', outbound),
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 1000,
    now: () => Date.parse(challengeAt) + 1000,
  });
}

it('redeems a token through the exact Siteverify operation before allowing work', async () => {
  const gate = gateFor({
    success: true,
    hostname: 'issues.example.org',
    action: 'register',
    challenge_ts: challengeAt,
    'error-codes': [],
  });
  await expect(
    gate.require({ token: 'test-token', expectedAction: 'register', signal }),
  ).resolves.toBeUndefined();
});

it('denies a failed, mismatched or malformed provider response', async () => {
  for (const [response, code] of [
    [
      { success: false, 'error-codes': ['timeout-or-duplicate'] },
      'CAPTCHA_DENIED',
    ],
    [
      {
        success: true,
        hostname: 'other.example.org',
        action: 'register',
        challenge_ts: challengeAt,
      },
      'CAPTCHA_DENIED',
    ],
    [
      { success: false, 'error-codes': ['invalid-input-secret'] },
      'CAPTCHA_UNAVAILABLE',
    ],
    [{ success: true, hostname: 'issues.example.org' }, 'CAPTCHA_UNAVAILABLE'],
  ] as const) {
    await expect(
      gateFor(response).require({
        token: 'test-token',
        expectedAction: 'register',
        signal,
      }),
    ).rejects.toMatchObject({ code });
  }
});

it('rejects invalid provider setup and an overlong Turnstile token before egress', async () => {
  expect(() =>
    createTurnstileVerifier('', async () => {
      throw new Error();
    }),
  ).toThrow();
  let calls = 0;
  const verifier = createTurnstileVerifier('test-secret', async () => {
    calls++;
    throw new Error('unexpected egress');
  });
  await expect(
    verifier.verify('x'.repeat(2049), signal),
  ).resolves.toMatchObject({
    success: false,
  });
  expect(calls).toBe(0);
});
