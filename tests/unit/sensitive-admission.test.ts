import { expect, it } from 'vitest';
import { SecretAbuseKeyProvider } from '../../packages/security/src/abuse-keys.ts';
import type {
  RateCounterStore,
  VolumetricLimiter,
} from '../../packages/security/src/rate-limit.ts';
import { createCaptchaGate } from '../../packages/server/src/captcha.ts';
import { createSensitiveActionAdmission } from '../../packages/server/src/sensitive-admission.ts';
import { createBoundSensitiveActionAdmission } from '../../packages/server/src/sensitive-admission.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';

function admission(limit = 2) {
  const counts = new Map<string, number>();
  let writes = 0;
  const store: RateCounterStore = {
    async increment(input) {
      writes++;
      const key = JSON.stringify([
        input.category,
        input.dimension,
        input.keyVersion,
        input.digest,
        input.windowStart,
      ]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return count;
    },
    async purgeExpired() {
      return 0;
    },
  };
  return {
    intent: {
      provider: new SecretAbuseKeyProvider({
        read: async () => abuseKeyFixture(),
      }),
      store,
      category: 'login' as const,
      checks: [
        {
          dimension: 'account' as const,
          canonicalSubject: 'known-fixture@example.org',
          rule: { limit, windowMs: 60000, retentionMs: 86400000 },
        },
        {
          dimension: 'ip' as const,
          canonicalSubject: '192.0.2.42',
          rule: { limit, windowMs: 60000, retentionMs: 86400000 },
        },
      ],
      nowMs: 2000000000000,
      signal: new AbortController().signal,
      timeoutMs: 1000,
      captchaAction: 'login',
    },
    writes: () => writes,
  };
}

it('runs authoritative admission without a CAPTCHA provider or token', async () => {
  const { intent, writes } = admission();
  await expect(
    createSensitiveActionAdmission(createCaptchaGate()).require(intent),
  ).resolves.toBeUndefined();
  expect(writes()).toBe(4);
});

it('binds authoritative sources at construction and denies when they are absent', async () => {
  const { intent, writes } = admission();
  let substituted = false;
  const forged = {
    ...intent,
    checks: intent.checks.map((check) =>
      check.dimension === 'ip'
        ? { ...check, canonicalSubject: 'forged-forwarded-ip' }
        : check,
    ),
    provider: {
      active: async () => {
        substituted = true;
        return [];
      },
    },
    store: {
      increment: async () => {
        substituted = true;
        return 1;
      },
      purgeExpired: async () => 0,
    },
    limiter: {
      consume: async () => {
        substituted = true;
        return { allowed: true as const };
      },
    },
  };
  let shedChecks = 0;
  const bound = createBoundSensitiveActionAdmission(createCaptchaGate(), {
    provider: intent.provider,
    store: intent.store,
    limiter: {
      consume: async () => {
        shedChecks++;
        return { allowed: true };
      },
    },
    clientAddress: () => '192.0.2.42',
  });
  await expect(
    bound.require({ ...forged, request: new Request('https://example.org') }),
  ).resolves.toBeUndefined();
  expect(writes()).toBe(4);
  expect(shedChecks).toBe(2);
  expect(substituted).toBe(false);
  await expect(
    createBoundSensitiveActionAdmission(createCaptchaGate(), {
      provider: intent.provider,
      store: intent.store,
    }).require({ ...intent, request: new Request('https://example.org') }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  await expect(
    createBoundSensitiveActionAdmission(createCaptchaGate(), {
      provider: intent.provider,
      store: intent.store,
      clientAddress: () => {
        throw new Error('private peer detail');
      },
    }).require({ ...intent, request: new Request('https://example.org') }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  await expect(
    createBoundSensitiveActionAdmission(createCaptchaGate(), null).require({
      ...intent,
      request: new Request('https://example.org'),
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  expect(writes()).toBe(4);
});

it('uses approximate shedding before authoritative writes and denies its failures', async () => {
  const { intent, writes } = admission();
  const digests: string[] = [];
  await expect(
    createSensitiveActionAdmission(createCaptchaGate()).require({
      ...intent,
      limiter: {
        async consume(digest) {
          digests.push(digest);
          return { allowed: false, reason: 'limited' };
        },
      },
    }),
  ).rejects.toMatchObject({
    code: 'RATE_LIMITED',
    retryAfterSeconds: null,
  });
  expect(digests).toHaveLength(2);
  expect(new Set(digests).size).toBe(2);
  expect(digests.every((digest) => /^[0-9a-f]{64}$/.test(digest))).toBe(true);
  expect(writes()).toBe(0);
  await expect(
    createSensitiveActionAdmission(createCaptchaGate()).require({
      ...intent,
      limiter: { consume: async () => ({ allowed: true }) },
    }),
  ).resolves.toBeUndefined();
  expect(writes()).toBe(4);
  for (const consume of [
    async () => ({ allowed: false as const, reason: 'unavailable' as const }),
    async () => {
      throw new Error('private limiter failure');
    },
    async () => ({ allowed: true, reason: 'unavailable' }),
  ]) {
    await expect(
      createSensitiveActionAdmission(createCaptchaGate()).require({
        ...intent,
        limiter: { consume: consume as VolumetricLimiter['consume'] },
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  }
  expect(writes()).toBe(4);
});

it('sheds registration before parsing with a separate trusted-IP bucket and no primary write', async () => {
  const { intent, writes } = admission();
  const request = new Request('https://example.org/api/v1/accounts/register', {
    method: 'POST',
  });
  const digests: string[] = [];
  const bound = createBoundSensitiveActionAdmission(createCaptchaGate(), {
    provider: intent.provider,
    store: intent.store,
    limiter: {
      async consume(digest) {
        digests.push(digest);
        return { allowed: true };
      },
    },
    clientAddress: () => '192.0.2.42',
  });
  await expect(bound.preparseRegistration(request)).resolves.toBeUndefined();
  await expect(bound.require({ ...intent, request })).resolves.toBeUndefined();
  expect(digests).toHaveLength(3);
  expect(new Set(digests).size).toBe(3);
  expect(writes()).toBe(4);
});

it('closes pre-parse registration on limited, unavailable and untrusted dependencies', async () => {
  const { intent, writes } = admission();
  const request = new Request('https://example.org/api/v1/accounts/register', {
    method: 'POST',
  });
  const make = (overrides: Record<string, unknown>) =>
    createBoundSensitiveActionAdmission(createCaptchaGate(), {
      provider: intent.provider,
      store: intent.store,
      limiter: { consume: async () => ({ allowed: true }) },
      clientAddress: () => '192.0.2.42',
      ...overrides,
    });
  await expect(
    make({
      limiter: { consume: async () => ({ allowed: false, reason: 'limited' }) },
    }).preparseRegistration(request),
  ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: null });
  for (const guard of [
    make({
      limiter: {
        consume: async () => ({ allowed: false, reason: 'unavailable' }),
      },
    }),
    make({
      limiter: {
        consume: async () => {
          throw new Error('private failure');
        },
      },
    }),
    make({
      provider: {
        active: async () => {
          throw new Error('private key failure');
        },
      },
    }),
    make({ clientAddress: () => 'forged-address' }),
    make({ clientAddress: undefined }),
    make({ limiter: undefined }),
    createBoundSensitiveActionAdmission(createCaptchaGate(), null),
  ])
    await expect(guard.preparseRegistration(request)).rejects.toMatchObject({
      code: 'RATE_LIMIT_UNAVAILABLE',
    });
  expect(writes()).toBe(0);
});

it('bounds an asynchronous ingress assertion before any counter write', async () => {
  const { intent, writes } = admission();
  const guard = createBoundSensitiveActionAdmission(createCaptchaGate(), {
    provider: intent.provider,
    store: intent.store,
    clientAddress: async () => new Promise<string>(() => {}),
  });
  await expect(
    guard.require({
      ...intent,
      request: new Request('https://example.org'),
      timeoutMs: 10,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  expect(writes()).toBe(0);
});

it('denies cancellation after rate admission before a protected action', async () => {
  const { intent, writes } = admission();
  const controller = new AbortController();
  const mutable = { ...intent, signal: controller.signal };
  const guard = createSensitiveActionAdmission({
    enabled: false,
    async require() {
      controller.abort();
      mutable.signal = new AbortController().signal;
    },
  });
  await expect(guard.require(mutable)).rejects.toMatchObject({
    code: 'RATE_LIMIT_UNAVAILABLE',
  });
  expect(writes()).toBe(4);
});

it('requires a configured challenge after rate admission and never calls it for a limited request', async () => {
  let verifications = 0;
  const gate = createCaptchaGate({
    verifier: {
      async verify() {
        verifications++;
        return {
          success: true,
          hostname: 'issues.example.org',
          action: 'login',
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
  });
  const guard = createSensitiveActionAdmission(gate);
  const { intent, writes } = admission();
  await expect(guard.require(intent)).rejects.toMatchObject({
    code: 'CAPTCHA_DENIED',
  });
  expect(verifications).toBe(0);
  expect(writes()).toBe(4);
  await expect(
    guard.require({ ...intent, captchaToken: 'client-token' }),
  ).resolves.toBeUndefined();
  expect(verifications).toBe(1);
  await expect(
    guard.require({ ...intent, captchaToken: 'client-token' }),
  ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  expect(verifications).toBe(1);
});

it('keeps a configured provider outage closed after rate admission', async () => {
  const gate = createCaptchaGate({
    verifier: {
      async verify() {
        throw new Error('private provider detail');
      },
    },
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 1000,
  });
  await expect(
    createSensitiveActionAdmission(gate).require({
      ...admission().intent,
      captchaToken: 'client-token',
    }),
  ).rejects.toMatchObject({ code: 'CAPTCHA_UNAVAILABLE' });
});

it('audits a configured provider outage without letting the audit write soften the denial', async () => {
  const gate = createCaptchaGate({
    verifier: {
      async verify() {
        throw new Error('private provider detail');
      },
    },
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 1000,
  });
  const events: unknown[] = [];
  await expect(
    createSensitiveActionAdmission(gate, async (event) => {
      events.push(event);
    }).require({
      ...admission().intent,
      captchaToken: 'client-token',
      requestId: crypto.randomUUID(),
    }),
  ).rejects.toMatchObject({ code: 'CAPTCHA_UNAVAILABLE' });
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    action: 'provider.outage',
    systemActor: 'core.admission',
    targetId: '["turnstile","login"]',
    result: 'failure',
    metadata: { v: 1, outcome: 'unavailable' },
  });
  expect(JSON.stringify(events)).not.toContain('private provider detail');
  await expect(
    createSensitiveActionAdmission(gate, async () => {
      throw new Error('audit outage');
    }).require({
      ...admission().intent,
      captchaToken: 'client-token',
    }),
  ).rejects.toMatchObject({ code: 'CAPTCHA_UNAVAILABLE' });
});
