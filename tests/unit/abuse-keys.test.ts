import { expect, it } from 'vitest';
import {
  activeAbuseSubjects,
  checkSensitiveRateAdmission,
  checkSensitiveRateAdmissionWithSubjects,
  SecretAbuseKeyProvider,
  type ActiveAbuseKey,
} from '../../packages/security/src/abuse-keys.ts';
import {
  abuseSubjectDigest,
  RateLimitFailure,
  type RateCounterStore,
} from '../../packages/security/src/rate-limit.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';

function provider(serialized: string) {
  return new SecretAbuseKeyProvider({ read: async () => serialized });
}

it('imports only non-extractable active HMAC versions and derives separate digests', async () => {
  const source = provider(abuseKeyFixture());
  const signal = new AbortController().signal;
  const keys = await source.active(signal);
  expect(keys.map(({ version }) => version)).toEqual([2, 1]);
  expect(
    keys.every(
      ({ key }) => !key.extractable && key.usages.join(',') === 'sign',
    ),
  ).toBe(true);
  const subjects = await activeAbuseSubjects(
    source,
    'login',
    'account',
    'person@example.org',
    signal,
  );
  expect(subjects.map(({ keyVersion }) => keyVersion)).toEqual([2, 1]);
  expect(subjects[0]?.digest).not.toBe(subjects[1]?.digest);
  expect(JSON.stringify(subjects)).not.toContain('person@example.org');
});

it('rejects malformed rings, duplicate material and unsafe version transitions', async () => {
  const valid = JSON.parse(abuseKeyFixture()) as {
    v: number;
    current: number;
    keys: { version: number; material: string }[];
  };
  const cases = [
    { ...valid, current: 3 },
    { ...valid, keys: [valid.keys[0], valid.keys[0]] },
    {
      ...valid,
      keys: [
        { ...valid.keys[0], version: 2 },
        { ...valid.keys[1], material: valid.keys[0]!.material },
      ],
    },
    { ...valid, keys: [...valid.keys].reverse() },
    { ...valid, keys: [{ ...valid.keys[0], material: 'short' }] },
    { ...valid, extra: 'unknown' },
    { ...valid, keys: [] },
  ];
  for (const entry of cases)
    await expect(
      provider(JSON.stringify(entry)).active(new AbortController().signal),
    ).rejects.toBeInstanceOf(RateLimitFailure);
});

it('fails closed on missing, cancelled and timed-out secret sources', async () => {
  await expect(
    provider('').active(new AbortController().signal),
  ).rejects.toBeInstanceOf(RateLimitFailure);
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(
    provider(abuseKeyFixture()).active(cancelled.signal),
  ).rejects.toBeInstanceOf(RateLimitFailure);
  const hung = new SecretAbuseKeyProvider(
    { read: async () => new Promise<string>(() => {}) },
    10,
  );
  await expect(
    hung.active(new AbortController().signal),
  ).rejects.toBeInstanceOf(RateLimitFailure);
});

const rule = { limit: 2, windowMs: 60000, retentionMs: 86400000 };
const checks = [
  {
    dimension: 'account' as const,
    canonicalSubject: 'person@example.org',
    rule,
  },
  { dimension: 'ip' as const, canonicalSubject: '192.0.2.42', rule },
];

it('returns only admitted versioned subjects from one rate-key snapshot', async () => {
  let sourceReads = 0;
  const source = new SecretAbuseKeyProvider({
    read: async () => {
      sourceReads++;
      return abuseKeyFixture();
    },
  });
  const signal = new AbortController().signal;
  const store: RateCounterStore = {
    increment: async () => 1,
    purgeExpired: async () => 0,
  };
  const admitted = await checkSensitiveRateAdmissionWithSubjects(
    source,
    store,
    'login',
    checks,
    120000,
    signal,
  );
  expect(sourceReads).toBe(1);
  expect(admitted.allowed).toBe(true);
  if (!admitted.allowed) throw new Error('Expected admission');
  expect(
    admitted.subjectsByCheck.map((set) =>
      set.map((subject) => subject.keyVersion),
    ),
  ).toEqual([
    [2, 1],
    [2, 1],
  ]);
  expect(admitted.subjectsByCheck[0]?.[0]?.digest).not.toBe(
    admitted.subjectsByCheck[1]?.[0]?.digest,
  );
  expect(JSON.stringify(admitted)).not.toContain('person@example.org');
  const denied = await checkSensitiveRateAdmissionWithSubjects(
    source,
    { ...store, increment: async () => 3 },
    'login',
    checks,
    120000,
    signal,
  );
  expect(denied).toMatchObject({ allowed: false, subjectsByCheck: null });
});

it('uses one key snapshot for every dimension and enforces an old-version limit', async () => {
  let sourceReads = 0;
  const source = new SecretAbuseKeyProvider({
    read: async () => {
      sourceReads++;
      return abuseKeyFixture();
    },
  });
  const writes: string[] = [];
  const store: RateCounterStore = {
    increment: async ({ category, dimension, keyVersion, digest }) => {
      writes.push(`${category}:${dimension}:${keyVersion}`);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      expect(digest).not.toContain('person@example.org');
      return dimension === 'account' && keyVersion === 1 ? 3 : 1;
    },
    purgeExpired: async () => 0,
  };
  expect(
    await checkSensitiveRateAdmission(
      source,
      store,
      'login',
      checks,
      120000,
      new AbortController().signal,
    ),
  ).toEqual({ allowed: false, reason: 'limited', retryAfterSeconds: 60 });
  expect(sourceReads).toBe(1);
  expect(writes.sort()).toEqual([
    'login:account:1',
    'login:account:2',
    'login:ip:1',
    'login:ip:2',
  ]);
});

it('captures route subjects and rules before waiting for a key provider', async () => {
  const signal = new AbortController().signal;
  const keys = await provider(abuseKeyFixture()).active(signal);
  const expected = await abuseSubjectDigest(
    keys[0]!.key,
    keys[0]!.version,
    'login',
    'account',
    'person@example.org',
  );
  let release!: (keys: readonly ActiveAbuseKey[]) => void;
  const delayed = {
    active: () =>
      new Promise<readonly ActiveAbuseKey[]>((resolve) => {
        release = resolve;
      }),
  };
  const mutable = [
    {
      dimension: 'account' as const,
      canonicalSubject: 'person@example.org',
      rule: { ...rule },
    },
    {
      dimension: 'ip' as const,
      canonicalSubject: '192.0.2.42',
      rule: { ...rule },
    },
  ];
  const seen: string[] = [];
  const store: RateCounterStore = {
    increment: async ({ dimension, digest }) => {
      if (dimension === 'account') seen.push(digest);
      return dimension === 'account' ? 3 : 1;
    },
    purgeExpired: async () => 0,
  };
  const pending = checkSensitiveRateAdmission(
    delayed,
    store,
    'login',
    mutable,
    120000,
    signal,
  );
  mutable[0]!.canonicalSubject = 'other@example.org';
  mutable[0]!.rule.limit = 100;
  release(keys);
  expect(await pending).toEqual({
    allowed: false,
    reason: 'limited',
    retryAfterSeconds: 60,
  });
  expect(seen).toContain(expected.digest);
});

it('rejects noncanonical IPs and invalid route policies before reading keys or writing counters', async () => {
  let sourceReads = 0;
  let writes = 0;
  const source = new SecretAbuseKeyProvider({
    read: async () => {
      sourceReads++;
      return abuseKeyFixture();
    },
  });
  const store: RateCounterStore = {
    increment: async () => {
      writes++;
      return 1;
    },
    purgeExpired: async () => 0,
  };
  for (const invalid of [
    [{ ...checks[0]! }, { ...checks[1]!, canonicalSubject: '192.0.2.042' }],
    [{ ...checks[0]! }, { ...checks[0]! }],
    [{ ...checks[0]! }, { ...checks[1]!, rule: { ...rule, limit: 0 } }],
    [
      { ...checks[0]! },
      { dimension: 'route' as const, canonicalSubject: 'login', rule },
    ],
  ]) {
    expect(
      await checkSensitiveRateAdmission(
        source,
        store,
        'login',
        invalid,
        120000,
        new AbortController().signal,
      ),
    ).toEqual({
      allowed: false,
      reason: 'unavailable',
      retryAfterSeconds: null,
    });
  }
  const cancelled = new AbortController();
  cancelled.abort();
  expect(
    await checkSensitiveRateAdmission(
      source,
      store,
      'login',
      checks,
      120000,
      cancelled.signal,
    ),
  ).toEqual({
    allowed: false,
    reason: 'unavailable',
    retryAfterSeconds: null,
  });
  expect(sourceReads).toBe(0);
  expect(writes).toBe(0);
});

it('requires project scope for privileged project actions before reading keys', async () => {
  let sourceReads = 0;
  let writes = 0;
  const source = new SecretAbuseKeyProvider({
    read: async () => {
      sourceReads++;
      return abuseKeyFixture();
    },
  });
  const store: RateCounterStore = {
    increment: async () => {
      writes++;
      return 1;
    },
    purgeExpired: async () => 0,
  };
  const principal = {
    dimension: 'principal' as const,
    canonicalSubject: '71ab9b40-8bf9-4c0f-a180-354375643ad1',
    rule,
  };
  const ip = { dimension: 'ip' as const, canonicalSubject: '192.0.2.42', rule };
  const project = {
    dimension: 'project' as const,
    canonicalSubject: '205b18a4-51d3-46f7-a93d-f6dc5bd0b27a',
    rule,
  };
  const signal = new AbortController().signal;
  expect(
    await checkSensitiveRateAdmission(
      source,
      store,
      'webhook-configure',
      [principal, ip],
      120000,
      signal,
    ),
  ).toEqual({ allowed: false, reason: 'unavailable', retryAfterSeconds: null });
  expect(sourceReads).toBe(0);
  expect(writes).toBe(0);
  expect(
    await checkSensitiveRateAdmission(
      source,
      store,
      'webhook-configure',
      [principal, project],
      120000,
      signal,
    ),
  ).toEqual({ allowed: true, remaining: 1 });
  expect(sourceReads).toBe(1);
  expect(writes).toBe(4);
});

it('denies the whole admission when a key source or one authoritative dimension fails', async () => {
  const signal = new AbortController().signal;
  const store: RateCounterStore = {
    increment: async ({ dimension }) => {
      if (dimension === 'ip') throw new Error('private database detail');
      return 1;
    },
    purgeExpired: async () => 0,
  };
  expect(
    await checkSensitiveRateAdmission(
      provider(''),
      store,
      'login',
      checks,
      120000,
      signal,
    ),
  ).toEqual({
    allowed: false,
    reason: 'unavailable',
    retryAfterSeconds: null,
  });
  expect(
    await checkSensitiveRateAdmission(
      provider(abuseKeyFixture()),
      store,
      'login',
      checks,
      120000,
      signal,
    ),
  ).toEqual({
    allowed: false,
    reason: 'unavailable',
    retryAfterSeconds: null,
  });
});

it('reuses imported abuse keys while rereading and replacing a changed source', async () => {
  let serialized = abuseKeyFixture(),
    reads = 0;
  const source = new SecretAbuseKeyProvider({
    read: async () => {
      reads++;
      return serialized;
    },
  });
  const signal = new AbortController().signal;
  const first = await source.active(signal),
    second = await source.active(signal);
  expect(second[0]!.key).toBe(first[0]!.key);
  expect(reads).toBe(2);
  const ring = JSON.parse(serialized);
  ring.keys[0].material = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString('base64url');
  serialized = JSON.stringify(ring);
  expect((await source.active(signal))[0]!.key).not.toBe(first[0]!.key);
  serialized = '';
  await expect(source.active(signal)).rejects.toBeInstanceOf(RateLimitFailure);
});
