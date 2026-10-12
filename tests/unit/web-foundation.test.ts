import { describe, expect, it } from 'vitest';
import { checkImport } from '../../tooling/check-boundaries.mjs';
import { InstanceDocumentSchema } from '@hyperbug/contracts';
import {
  validateRuntimeConfig,
  loadRuntimeConfig,
} from '../../apps/web/src/runtime-config.ts';
import { validateInstanceDocument } from '../../apps/web/src/capability-validation.ts';
import { deploymentPolicy } from '../../apps/web/scripts/prepare-deployment.ts';

const publicConfig = {
  schemaVersion: 1,
  applicationName: 'HyperBug',
  apiBaseUrl: 'https://api.example.net',
  authBaseUrl: 'https://auth.example.org',
  mediaOrigins: ['https://media.example.com'],
};
const minimum = {
  tier: 'cloudflare-minimum',
  degradationIds: ['FREE-01', 'FREE-05'],
  passwordHashPolicy: { algorithm: 'pbkdf2-hmac-sha256', downgraded: true },
  authentication: {
    passwordRegistration: false,
    passwordLogin: false,
    passkeys: false,
    recoveryCodes: false,
    administratorAssistedRecovery: false,
  },
  background: {
    mode: 'checkpointed-cron',
    dispatchBatch: 10,
    maxJobSteps: 16,
    checkpointBytes: 1024,
    bulk: false,
    import: false,
    export: false,
    longRunning: false,
  },
  search: { textScope: 'title' },
  limits: { documented: 'docs/FREE-TIER-PROFILE.md' },
};

describe('static frontend trust boundaries', () => {
  it('allows frontend-local TSX imports while denying backend implementations', () => {
    expect(
      checkImport('apps/web/src/app.tsx', './capabilities.ts'),
    ).toBeUndefined();
    expect(
      checkImport('apps/web/src/app.tsx', '@hyperbug/api-client'),
    ).toBeUndefined();
    expect(
      checkImport('apps/web/src/app.tsx', '@hyperbug/server'),
    ).toBeDefined();
    expect(
      checkImport('apps/web/src/app.tsx', '../../api-node/src/index.ts'),
    ).toBeDefined();
  });
  it('rejects secrets, remote-code configuration and unsafe origin syntax', () => {
    for (const extra of [
      { token: 'secret' },
      { plugins: ['https://evil.example/script.js'] },
    ])
      expect(() =>
        validateRuntimeConfig({ ...publicConfig, ...extra }),
      ).toThrow();
    for (const origin of [
      'javascript:alert(1)',
      'https://user:secret@api.example.net',
      'https://api.example.net/path',
      'https://api.example.net?token=secret',
      'http://api.example.net',
    ])
      expect(() =>
        validateRuntimeConfig({ ...publicConfig, apiBaseUrl: origin }),
      ).toThrow();
    expect(validateRuntimeConfig(publicConfig).apiBaseUrl).toBe(
      'https://api.example.net',
    );
  });
  it('loads fresh bounded JSON with omitted credentials and refuses oversized config', async () => {
    let options: RequestInit | undefined;
    const fetcher = (async (_url: unknown, input: RequestInit) => {
      options = input;
      return new Response(JSON.stringify(publicConfig), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    expect((await loadRuntimeConfig(fetcher)).applicationName).toBe('HyperBug');
    expect(options?.credentials).toBe('omit');
    expect(options?.cache).toBe('no-store');
    await expect(
      loadRuntimeConfig(
        (async () =>
          new Response(' '.repeat(16385), {
            headers: { 'content-type': 'application/json' },
          })) as typeof fetch,
      ),
    ).rejects.toThrow();
  });
  it('uses the public schema and retains unavailable/minimum capabilities exactly', () => {
    expect(validateInstanceDocument(minimum, InstanceDocumentSchema)).toEqual(
      minimum,
    );
    for (const value of [
      { ...minimum, tier: 'guessed-standard' },
      { ...minimum, degradationIds: ['FREE-01', 'FREE-01'] },
      { ...minimum, search: { textScope: 'all' } },
      {
        ...minimum,
        authentication: { ...minimum.authentication, passwordLogin: 'true' },
      },
      { ...minimum, background: { ...minimum.background, bulk: true } },
      { ...minimum, background: { ...minimum.background, dispatchBatch: 11 } },
      { ...minimum, injection: '<script>unsafe</script>' },
    ])
      expect(() =>
        validateInstanceDocument(value, InstanceDocumentSchema),
      ).toThrow();
  });
  it('generates exact API/auth/media and reviewed-plugin origins without unsafe CSP', () => {
    const config = validateRuntimeConfig(publicConfig);
    const policy = deploymentPolicy(config, [
      {
        id: 'reviewed',
        scripts: ['https://captcha.example.org'],
        frames: ['https://captcha.example.org'],
        connect: [],
        images: [],
      },
    ]);
    const csp = policy.headers['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self' https://captcha.example.org");
    expect(csp).toContain('https://api.example.net https://auth.example.org');
    expect(csp).toContain('https://media.example.com');
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(policy.cache.assets).toContain('immutable');
    expect(policy.cache.config).toBe('no-store');
    expect(policy.cache.html).toBe('no-cache');
    expect(() =>
      deploymentPolicy(config, [
        {
          id: 'bad',
          connect: ['https://api.example.org/path'],
          scripts: [],
          frames: [],
          images: [],
        },
      ]),
    ).toThrow();
  });
});
