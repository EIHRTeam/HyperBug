import { expect, it } from 'vitest';
import { SecretAbuseKeyProvider } from '../../packages/security/src/abuse-keys.ts';
import type { AccountLockoutStore } from '../../packages/security/src/account-lockout.ts';
import type { RateCounterStore } from '../../packages/security/src/rate-limit.ts';
import { createCaptchaGate } from '../../packages/server/src/captcha.ts';
import {
  createBoundMinimumLoginAdmission,
  createMinimumLoginAdmission,
} from '../../packages/server/src/minimum-login-admission.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';

const nowMs = 2000000000000;
const policy = {
  rateTimeoutMs: 100,
  lockoutTimeoutMs: 100,
  lockout: {
    initialMs: 1000,
    maximumMs: 30000,
    failuresPerStep: 2,
    resetAfterMs: 60000,
  },
};

function harness(limit = 10) {
  let keyReads = 0;
  let counterWrites = 0;
  let lockoutReads = 0;
  let lockoutWrites = 0;
  const counts = new Map<string, number>();
  const lockouts = new Map<
    string,
    {
      failedAttempts: number;
      notBeforeMs: number;
      expiresAtMs: number;
    }
  >();
  const provider = new SecretAbuseKeyProvider({
    read: async () => {
      keyReads++;
      return abuseKeyFixture();
    },
  });
  const rateStore: RateCounterStore = {
    async increment(input) {
      counterWrites++;
      const key = JSON.stringify(input);
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    purgeExpired: async () => 0,
  };
  const lockoutStore: AccountLockoutStore = {
    async get(subject) {
      lockoutReads++;
      return lockouts.get(`${subject.keyVersion}:${subject.digest}`) ?? null;
    },
    async recordFailure(subject, at, selected) {
      lockoutWrites++;
      const key = `${subject.keyVersion}:${subject.digest}`;
      const next = (lockouts.get(key)?.failedAttempts ?? 0) + 1;
      const state = {
        failedAttempts: next,
        notBeforeMs: at + selected.initialMs,
        expiresAtMs: at + selected.resetAfterMs,
      };
      lockouts.set(key, state);
      return state;
    },
    async clear(subject) {
      lockoutWrites++;
      lockouts.delete(`${subject.keyVersion}:${subject.digest}`);
    },
    purgeExpired: async () => 0,
  };
  const rule = { limit, windowMs: 60000, retentionMs: 86400000 };
  return {
    intent: {
      provider,
      rateStore,
      lockoutStore,
      checks: [
        {
          dimension: 'account' as const,
          canonicalSubject: 'person@example.org',
          rule,
        },
        { dimension: 'ip' as const, canonicalSubject: '192.0.2.42', rule },
      ],
      nowMs,
      signal: new AbortController().signal,
    },
    counts: () => ({ keyReads, counterWrites, lockoutReads, lockoutWrites }),
  };
}

it('uses one key snapshot across rate and lockout, then records a failed password once', async () => {
  const { intent, counts } = harness();
  const service = createMinimumLoginAdmission(createCaptchaGate(), policy);
  const permit = await service.require(intent);
  expect(counts()).toEqual({
    keyReads: 1,
    counterWrites: 4,
    lockoutReads: 2,
    lockoutWrites: 0,
  });
  await permit.recordFailure(nowMs);
  expect(counts().lockoutWrites).toBe(2);
  await expect(permit.clearAfterSuccess()).rejects.toMatchObject({
    code: 'RATE_LIMIT_UNAVAILABLE',
  });
  await expect(service.require(intent)).rejects.toMatchObject({
    code: 'RATE_LIMITED',
    retryAfterSeconds: 1,
  });
});

it('clears a verified success and denies rate limits before lockout or CAPTCHA', async () => {
  const { intent, counts } = harness(1);
  let challenges = 0;
  const captcha = createCaptchaGate({
    verifier: {
      async verify() {
        challenges++;
        return {
          success: true,
          hostname: 'issues.example.org',
          action: 'login',
          challengeAtMs: nowMs - 1000,
          score: null,
        };
      },
    },
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 100,
    now: () => nowMs,
  });
  const service = createMinimumLoginAdmission(captcha, policy);
  await expect(service.require(intent)).rejects.toMatchObject({
    code: 'CAPTCHA_DENIED',
  });
  expect(challenges).toBe(0);
  expect(counts().counterWrites).toBe(4);
  await expect(
    service.require({ ...intent, captchaToken: 'token' }),
  ).rejects.toMatchObject({
    code: 'RATE_LIMITED',
  });
  expect(counts().lockoutReads).toBe(2);
  expect(challenges).toBe(0);
});

it('clears after a configured challenge and keeps storage failure closed', async () => {
  const { intent, counts } = harness();
  let challenges = 0;
  const captcha = createCaptchaGate({
    verifier: {
      async verify() {
        challenges++;
        return {
          success: true,
          hostname: 'issues.example.org',
          action: 'login',
          challengeAtMs: nowMs - 1000,
          score: null,
        };
      },
    },
    expectedHostname: 'issues.example.org',
    maxAgeMs: 300000,
    minimumScore: null,
    timeoutMs: 100,
    now: () => nowMs,
  });
  const service = createMinimumLoginAdmission(captcha, policy);
  const permit = await service.require({ ...intent, captchaToken: 'token' });
  expect(challenges).toBe(1);
  await permit.clearAfterSuccess();
  expect(counts().lockoutWrites).toBe(2);
  await expect(permit.recordFailure(nowMs)).rejects.toMatchObject({
    code: 'RATE_LIMIT_UNAVAILABLE',
  });
  await expect(
    service.require({
      ...intent,
      captchaToken: 'token',
      lockoutStore: {
        ...intent.lockoutStore,
        get: async () => {
          throw new Error('private D1 detail');
        },
      },
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
});

it('binds login stores and client IP at the root, and stays closed without them', async () => {
  const { intent, counts } = harness(1);
  const captcha = createCaptchaGate();
  const dependencies = {
    provider: intent.provider,
    rateStore: intent.rateStore,
    lockoutStore: intent.lockoutStore,
    clientAddress: () => '192.0.2.42',
  };
  const bound = createBoundMinimumLoginAdmission(captcha, policy, dependencies);
  const request = new Request('https://issues.example.org/api/v1/login');
  const first = await bound.require({
    request,
    checks: intent.checks.map((check) =>
      check.dimension === 'ip'
        ? { ...check, canonicalSubject: '203.0.113.1' }
        : check,
    ),
    nowMs,
    signal: intent.signal,
  });
  await first.clearAfterSuccess();
  await expect(
    bound.require({
      request,
      checks: intent.checks.map((check) =>
        check.dimension === 'account'
          ? { ...check, canonicalSubject: 'other@example.org' }
          : { ...check, canonicalSubject: '198.51.100.2' },
      ),
      nowMs,
      signal: intent.signal,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  expect(counts().lockoutReads).toBe(2);
  await expect(
    createBoundMinimumLoginAdmission(captcha, policy, null).require({
      request,
      checks: intent.checks,
      nowMs,
      signal: intent.signal,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
  await expect(
    createBoundMinimumLoginAdmission(captcha, policy, {
      provider: intent.provider,
      rateStore: intent.rateStore,
      lockoutStore: intent.lockoutStore,
    }).require({
      request,
      checks: intent.checks,
      nowMs,
      signal: intent.signal,
    }),
  ).rejects.toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE' });
});
