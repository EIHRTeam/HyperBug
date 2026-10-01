import { expect, it } from 'vitest';
import {
  abuseSubjectDigest,
  checkSensitiveRateLimit,
  checkSensitiveRateLimitVersions,
  checkSensitiveRateLimits,
  RateLimitFailure,
  type RateCounterStore,
} from '../../packages/security/src/rate-limit.ts';

it('uses a dedicated non-extractable HMAC key and separates abuse dimensions', async () => {
  const raw = new Uint8Array(32).fill(7);
  const key = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const account = await abuseSubjectDigest(
    key,
    1,
    'login',
    'account',
    'person@example.org',
  );
  const again = await abuseSubjectDigest(
    key,
    1,
    'login',
    'account',
    'person@example.org',
  );
  const ip = await abuseSubjectDigest(
    key,
    1,
    'login',
    'ip',
    'person@example.org',
  );
  const recovery = await abuseSubjectDigest(
    key,
    1,
    'password-reset',
    'account',
    'person@example.org',
  );
  expect(account).toEqual(again);
  expect(new Set([account.digest, ip.digest, recovery.digest]).size).toBe(3);
  expect(JSON.stringify(account)).not.toContain('person@example.org');
  const extractable = await crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign'],
  );
  await expect(
    abuseSubjectDigest(
      extractable,
      1,
      'login',
      'account',
      'person@example.org',
    ),
  ).rejects.toBeInstanceOf(RateLimitFailure);
  raw.fill(0);
});

it('keeps old and new key versions enforced throughout rotation', async () => {
  const counts = new Map<number, number>([[1, 2]]);
  const store: RateCounterStore = {
    increment: async ({ keyVersion }) => {
      const next = (counts.get(keyVersion) ?? 0) + 1;
      counts.set(keyVersion, next);
      return next;
    },
    purgeExpired: async () => 0,
  };
  const subject = {
    category: 'login' as const,
    dimension: 'account' as const,
    digest: 'a'.repeat(64),
  };
  const subjects = [
    { ...subject, keyVersion: 1 },
    { ...subject, keyVersion: 2, digest: 'b'.repeat(64) },
  ];
  const rule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
  expect(
    await checkSensitiveRateLimitVersions(store, subjects, rule, 120000),
  ).toEqual({ allowed: false, reason: 'limited', retryAfterSeconds: 60 });
  expect(counts.get(2)).toBe(1);
  expect(
    await checkSensitiveRateLimitVersions(store, subjects, rule, 120001),
  ).toEqual({ allowed: false, reason: 'limited', retryAfterSeconds: 60 });
  expect(counts.get(2)).toBe(2);
  expect(
    await checkSensitiveRateLimitVersions(
      store,
      [subjects[0]!, subjects[0]!],
      rule,
      120002,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
  expect(counts.get(1)).toBe(4);
});

it('denies when any active key version has a counter failure', async () => {
  const attempted: number[] = [];
  const store: RateCounterStore = {
    increment: async ({ keyVersion }) => {
      attempted.push(keyVersion);
      if (keyVersion === 2) throw new Error('storage detail');
      return 1;
    },
    purgeExpired: async () => 0,
  };
  const subject = {
    category: 'password-reset' as const,
    dimension: 'account' as const,
    digest: 'c'.repeat(64),
  };
  expect(
    await checkSensitiveRateLimitVersions(
      store,
      [
        { ...subject, keyVersion: 1 },
        { ...subject, keyVersion: 2, digest: 'd'.repeat(64) },
      ],
      { limit: 2, windowMs: 60000, retentionMs: 86400000 },
      120000,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
  expect(attempted).toEqual([1, 2]);
  expect(
    await checkSensitiveRateLimitVersions(
      store,
      [
        { ...subject, keyVersion: 1 },
        { ...subject, keyVersion: 2, dimension: 'ip' },
      ],
      { limit: 2, windowMs: 60000, retentionMs: 86400000 },
      120000,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
  expect(attempted).toEqual([1, 2]);
});

it('consumes every version across multiple required dimensions before admission', async () => {
  const counts = new Map<string, number>([['account:1', 2]]);
  const store: RateCounterStore = {
    increment: async ({ dimension, keyVersion }) => {
      const key = `${dimension}:${keyVersion}`;
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    purgeExpired: async () => 0,
  };
  const subjects = (dimension: 'account' | 'ip') => [
    {
      category: 'login' as const,
      dimension,
      keyVersion: 2,
      digest: 'a'.repeat(64),
    },
    {
      category: 'login' as const,
      dimension,
      keyVersion: 1,
      digest: 'b'.repeat(64),
    },
  ];
  const rule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
  const checks = [
    { subjects: subjects('account'), rule },
    { subjects: subjects('ip'), rule },
  ];
  expect(await checkSensitiveRateLimits(store, checks, 120000)).toEqual({
    allowed: false,
    reason: 'limited',
    retryAfterSeconds: 60,
  });
  expect(Object.fromEntries(counts)).toEqual({
    'account:1': 3,
    'account:2': 1,
    'ip:1': 1,
    'ip:2': 1,
  });
});

it('rejects incomplete or inconsistent route policies before any counter write', async () => {
  let writes = 0;
  const store: RateCounterStore = {
    increment: async () => {
      writes++;
      return 1;
    },
    purgeExpired: async () => 0,
  };
  const rule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
  const account = {
    category: 'login' as const,
    dimension: 'account' as const,
    keyVersion: 2,
    digest: 'a'.repeat(64),
  };
  const ip = { ...account, dimension: 'ip' as const };
  for (const checks of [
    [{ subjects: [account], rule }],
    [
      { subjects: [account], rule },
      { subjects: [{ ...account, dimension: 'route' as const }], rule },
    ],
    [
      { subjects: [account], rule },
      { subjects: [account], rule },
    ],
    [
      { subjects: [account], rule },
      { subjects: [{ ...ip, keyVersion: 1 }], rule },
    ],
    [
      { subjects: [account], rule },
      { subjects: [{ ...ip, category: 'registration' as const }], rule },
    ],
  ])
    expect(await checkSensitiveRateLimits(store, checks, 120000)).toEqual({
      allowed: false,
      reason: 'unavailable',
      retryAfterSeconds: null,
    });
  expect(writes).toBe(0);
});

it('denies a multi-dimension policy when one authoritative counter is unavailable', async () => {
  const attempted: string[] = [];
  const store: RateCounterStore = {
    increment: async ({ dimension }) => {
      attempted.push(dimension);
      if (dimension === 'ip') throw new Error('private database detail');
      return 1;
    },
    purgeExpired: async () => 0,
  };
  const subject = {
    category: 'password-reset' as const,
    keyVersion: 1,
    digest: 'c'.repeat(64),
  };
  const rule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
  expect(
    await checkSensitiveRateLimits(
      store,
      [
        { subjects: [{ ...subject, dimension: 'account' }], rule },
        { subjects: [{ ...subject, dimension: 'ip' }], rule },
      ],
      120000,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
  expect(attempted).toEqual(['account', 'ip']);
});

it('denies malformed rules and corrupt or unavailable counter results', async () => {
  const subject = {
    category: 'login' as const,
    dimension: 'account' as const,
    keyVersion: 1,
    digest: 'f'.repeat(64),
  };
  const rule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
  const store: RateCounterStore = {
    increment: async () => Number.NaN,
    purgeExpired: async () => 0,
  };
  expect(
    await checkSensitiveRateLimit(store, subject, rule, 2000000000000),
  ).toEqual({
    allowed: false,
    reason: 'unavailable',
    retryAfterSeconds: null,
  });
  expect(
    await checkSensitiveRateLimit(
      store,
      subject,
      { ...rule, limit: 0 },
      2000000000000,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
  expect(
    await checkSensitiveRateLimit(
      store,
      { ...subject, digest: 'raw-ip' },
      rule,
      2000000000000,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
});
