import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { configureNodeAbuseAdmission } from '../../apps/api-node/src/abuse-admission.ts';
import { abuseKeyFixture } from '../fixtures/abuse-key-fixture.ts';

it('keeps no-setup startup closed and rejects partial or unsafe configuration', async () => {
  const absent = configureNodeAbuseAdmission({}, 'local');
  expect(absent.abuse).toBeNull();
  expect(await absent.ready(new AbortController().signal)).toBe(false);
  await absent.close();
  const url = 'postgresql://127.0.0.1:5432/hyperbug';
  expect(() =>
    configureNodeAbuseAdmission({ databaseUrl: url }, 'local'),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission({ keyFile: '/private/abuse.json' }, 'local'),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission(
      { databaseUrl: url, keyProviderFile: 'relative-key' },
      'local',
    ),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission(
      { databaseUrl: 'postgresql://db.example.org/hyperbug', keyFile: '/key' },
      'local',
    ),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission(
      { databaseUrl: `${url}?sslmode=disable`, keyFile: '/key' },
      'production',
    ),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission(
      { databaseUrl: url, keyFile: 'relative-key' },
      'local',
    ),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission(
      {
        databaseUrl: url,
        socketDirectory: '/tmp/postgresql',
        databaseName: 'postgres',
        databaseUser: 'hyperbug_test',
        keyFile: '/key',
      },
      'local',
    ),
  ).toThrow();
  expect(() =>
    configureNodeAbuseAdmission(
      {
        socketDirectory: 'relative/socket',
        databaseName: 'postgres',
        databaseUser: 'hyperbug_test',
        keyFile: '/key',
      },
      'local',
    ),
  ).toThrow();
});

it('provides a PostgreSQL key registry without enabling abuse admission', async () => {
  const configured = configureNodeAbuseAdmission(
    {
      databaseUrl: 'postgresql://127.0.0.1:1/hyperbug',
      keyProviderFile: '/private/keys.json',
    },
    'local',
  );
  try {
    expect(configured.keyRegistry).not.toBeNull();
    expect(configured.abuse).toBeNull();
    expect(await configured.ready(new AbortController().signal)).toBe(false);
  } finally {
    await configured.close();
  }
});

it('loads the separate private abuse ring with a lazily constructed local pool', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'hyperbug-abuse-'));
  const keyFile = join(directory, 'abuse.json');
  let configured: ReturnType<typeof configureNodeAbuseAdmission> | undefined;
  try {
    await writeFile(keyFile, abuseKeyFixture(), { mode: 0o600 });
    configured = configureNodeAbuseAdmission(
      { databaseUrl: 'postgresql://127.0.0.1:1/hyperbug', keyFile },
      'local',
    );
    expect(configured.abuse).not.toBeNull();
    expect(
      await configured.abuse!.limiter?.consume('a'.repeat(64), 120000),
    ).toEqual({ allowed: true });
    const versions = await configured.abuse!.provider.active(
      new AbortController().signal,
    );
    expect(versions.map((entry) => entry.version)).toEqual([2, 1]);
    expect(await configured.ready(new AbortController().signal)).toBe(false);
  } finally {
    await configured?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
