import { describe, expect, it, vi } from 'vitest';
import { registerAccount } from '../../packages/server/src/account-registration.ts';
import { RequestFailure } from '../../packages/server/src/errors.ts';
import type { BoundSensitiveActionAdmission } from '../../packages/server/src/sensitive-admission.ts';
import type { AccountRegistrationStore } from '@hyperbug/application';
import type { StandardPasswordService } from '../../packages/security/src/standard-password.ts';

const record = {
  v: 1 as const,
  alg: 'Argon2id' as const,
  memoryKiB: 19456,
  passes: 2,
  parallelism: 1,
  salt: 'AAAAAAAAAAAAAAAAAAAAAA',
  verifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

function fixture() {
  const events: string[] = [];
  const admission: Pick<BoundSensitiveActionAdmission, 'require'> = {
    async require(intent) {
      events.push('admit');
      expect(intent.category).toBe('registration');
      expect(intent.checks).toMatchObject([
        { dimension: 'account', canonicalSubject: 'exampleuser' },
        { dimension: 'ip' },
      ]);
      expect(intent.captchaAction).toBe('register');
    },
  };
  const password: StandardPasswordService = {
    async hash() {
      events.push('hash');
      return record;
    },
    async verify() {
      return { verified: false, replacement: null };
    },
  };
  const store: AccountRegistrationStore = {
    async register(input) {
      events.push('store');
      expect(input.handle).toBe('exampleuser');
      expect(input.passwordRecord).toBe(record);
      return { status: 'existing' };
    },
  };
  return {
    events,
    admission,
    password,
    store,
    input: {
      request: new Request('https://example.org/api/v1/accounts/register'),
      body: { handle: 'ExampleUser', password: 'long-test-password' },
      admission,
      password,
      store,
    },
  };
}

describe('account registration admission', () => {
  it('runs admission before password work and returns the same result for an existing handle', async () => {
    const test = fixture();
    expect(await registerAccount(test.input)).toEqual({ accepted: true });
    expect(test.events).toEqual(['admit', 'hash', 'store']);
  });

  it('denies absent account dependencies before any side effect', async () => {
    const test = fixture();
    await expect(
      registerAccount({ ...test.input, store: null }),
    ).rejects.toMatchObject({
      code: 'REGISTRATION_UNAVAILABLE',
    });
    expect(test.events).toEqual([]);
  });

  it.each([
    ['RATE_LIMITED', 429],
    ['RATE_LIMIT_UNAVAILABLE', 503],
    ['CAPTCHA_DENIED', 403],
    ['CAPTCHA_UNAVAILABLE', 503],
  ] as const)(
    'keeps %s admission failures ahead of hashing/storage',
    async (code, _status) => {
      const test = fixture();
      const deny = vi.fn(async () => {
        throw new RequestFailure(code);
      });
      await expect(
        registerAccount({ ...test.input, admission: { require: deny } }),
      ).rejects.toMatchObject({ code });
      expect(deny).toHaveBeenCalledOnce();
      expect(test.events).toEqual([]);
    },
  );

  it('maps password and storage outages to safe 503 responses', async () => {
    const hashFailure = fixture();
    await expect(
      registerAccount({
        ...hashFailure.input,
        password: {
          ...hashFailure.password,
          hash: async () => {
            throw new Error('private hashing detail');
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'REGISTRATION_UNAVAILABLE' });
    expect(hashFailure.events).toEqual(['admit']);

    const storeFailure = fixture();
    await expect(
      registerAccount({
        ...storeFailure.input,
        store: {
          register: async () => {
            throw new Error('private SQL detail');
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'REGISTRATION_UNAVAILABLE' });
    expect(storeFailure.events).toEqual(['admit', 'hash']);
  });

  it('denies a stalled store within the registration deadline', async () => {
    vi.useFakeTimers();
    try {
      const test = fixture();
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const pending = registerAccount({
        ...test.input,
        store: {
          register: () => {
            entered();
            return new Promise(() => {});
          },
        },
      });
      await started;
      const denied = expect(pending).rejects.toMatchObject({
        code: 'REGISTRATION_UNAVAILABLE',
      });
      await vi.advanceTimersByTimeAsync(5000);
      await denied;
      expect(test.events).toEqual(['admit', 'hash']);
    } finally {
      vi.useRealTimers();
    }
  });
});
