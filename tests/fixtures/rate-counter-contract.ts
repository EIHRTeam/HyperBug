import { expect, it } from 'vitest';
import {
  checkSensitiveRateAdmission,
  SecretAbuseKeyProvider,
} from '../../packages/security/src/abuse-keys.ts';
import {
  checkSensitiveRateLimit,
  type RateCounterStore,
  type RateCounterWrite,
  type RateSubject,
} from '../../packages/security/src/rate-limit.ts';
import { abuseKeyFixture } from './abuse-key-fixture.ts';

const subject: RateSubject = {
  category: 'login',
  dimension: 'account',
  keyVersion: 1,
  digest: 'a'.repeat(64),
};

export function rateCounterContract(store: () => RateCounterStore): void {
  it('atomically counts concurrent sensitive attempts on one subject', async () => {
    const input: RateCounterWrite = {
      ...subject,
      digest: 'b'.repeat(64),
      windowStart: 1000000000000,
      expiresAt: 1000000060000,
    };
    const counts = await Promise.all(
      Array.from({ length: 20 }, () => store().increment(input)),
    );
    expect(counts.sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
    expect(await store().increment({ ...input, dimension: 'ip' })).toBe(1);
  });

  it('fails closed after the limit and resets only at the next window', async () => {
    const rule = { limit: 3, windowMs: 60000, retentionMs: 86400000 };
    const now = 2000000000000;
    for (const remaining of [2, 1, 0])
      expect(
        await checkSensitiveRateLimit(store(), subject, rule, now),
      ).toEqual({ allowed: true, remaining });
    expect(await checkSensitiveRateLimit(store(), subject, rule, now)).toEqual({
      allowed: false,
      reason: 'limited',
      retryAfterSeconds: 40,
    });
    expect(
      await checkSensitiveRateLimit(store(), subject, rule, now + 60000),
    ).toEqual({ allowed: true, remaining: 2 });
    expect(
      await checkSensitiveRateLimit(
        {
          increment: async () => {
            throw new Error('private database failure');
          },
          purgeExpired: async () => 0,
        },
        subject,
        rule,
        now,
      ),
    ).toEqual({
      allowed: false,
      reason: 'unavailable',
      retryAfterSeconds: null,
    });
  });

  it('shares sensitive admission counts across independent adapter instances and key versions', async () => {
    const provider = new SecretAbuseKeyProvider({
      read: async () => abuseKeyFixture(),
    });
    const rule = { limit: 3, windowMs: 60000, retentionMs: 86400000 };
    const checks = [
      {
        dimension: 'account' as const,
        canonicalSubject: 'admission@example.org',
        rule,
      },
      { dimension: 'ip' as const, canonicalSubject: '192.0.2.101', rule },
    ];
    const now = 2100000000000;
    for (const remaining of [2, 1, 0])
      expect(
        await checkSensitiveRateAdmission(
          provider,
          store(),
          'login',
          checks,
          now,
          new AbortController().signal,
        ),
      ).toEqual({ allowed: true, remaining });
    expect(
      await checkSensitiveRateAdmission(
        provider,
        store(),
        'login',
        checks,
        now,
        new AbortController().signal,
      ),
    ).toEqual({
      allowed: false,
      reason: 'limited',
      retryAfterSeconds: 60,
    });
  });

  it('purges only bounded expired rows and rejects malformed writes', async () => {
    for (const digest of ['c', 'd', 'e'])
      await store().increment({
        ...subject,
        digest: digest.repeat(64),
        windowStart: 1000,
        expiresAt: 2000,
      });
    expect(await store().purgeExpired(2000, 2)).toBe(2);
    expect(await store().purgeExpired(2000, 2)).toBe(1);
    expect(await store().purgeExpired(2000, 2)).toBe(0);
    await expect(
      store().increment({
        ...subject,
        digest: 'raw-ip',
        windowStart: 1000,
        expiresAt: 2000,
      }),
    ).rejects.toThrow();
    await expect(store().purgeExpired(2000, 1001)).rejects.toThrow();
  });
}
