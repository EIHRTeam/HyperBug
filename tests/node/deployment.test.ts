import { beforeAll, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';

beforeAll(() => {
  execFileSync(process.execPath, ['tooling/build.ts', '--target=node']);
});

// The production Node bundle is minified and carries an external source map, and
// Node only applies that map when asked. Running the entry with the flag is both
// how production should start it and what keeps the assertions below
// meaningful: the minified bundle is a single ~190 kB line, so without the map
// the stack trace's source-line echo overflows the captured stderr pipe and the
// real startup error is truncated away.
const nodeEntryArguments = ['--enable-source-maps', 'dist/node/index.mjs'];

it('refuses minimum and malformed tier settings in the real Node entry point before listening', () => {
  for (const settings of [
    { HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum' },
    {
      HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
      HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1',
    },
    { HYPERBUG_DEPLOYMENT_TIER: 'SEEDED_SECRET' },
    { HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1' },
  ]) {
    const result = spawnSync(process.execPath, nodeEntryArguments, {
      env: {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://issues.example.org',
        ...settings,
      },
      encoding: 'utf8',
      timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('docs/FREE-TIER-PROFILE.md');
    expect(result.stderr).not.toContain('SEEDED_SECRET');
  }
});

it('refuses partial and public-test Turnstile bindings before the Node listener starts', () => {
  for (const settings of [
    { TURNSTILE_SECRET: 'test-secret' },
    {
      TURNSTILE_SECRET: 'test-secret',
      TURNSTILE_SITE_KEY: 'test-site-key',
      TURNSTILE_HOSTNAME: 'localhost',
    },
    {
      TURNSTILE_SECRET: '1x0000000000000000000000000000000AA',
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_HOSTNAME: 'issues.example.org',
    },
  ]) {
    const result = spawnSync(process.execPath, nodeEntryArguments, {
      env: {
        HYPERBUG_ENV: 'production',
        ALLOWED_ORIGINS: 'https://issues.example.org',
        ...settings,
      },
      encoding: 'utf8',
      timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid Turnstile provider configuration');
    expect(result.stderr).not.toContain('test-secret');
  }
});

it('refuses a key file without its PostgreSQL registry configuration', () => {
  const result = spawnSync(process.execPath, nodeEntryArguments, {
    env: {
      HYPERBUG_ENV: 'production',
      ALLOWED_ORIGINS: 'https://issues.example.org',
      HYPERBUG_KEY_FILE: '/nonexistent/private-key-ring.json',
    },
    encoding: 'utf8',
    timeout: 5000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(
    'Invalid Node security database configuration',
  );
  expect(result.stderr).not.toContain('/nonexistent/private-key-ring.json');
});
