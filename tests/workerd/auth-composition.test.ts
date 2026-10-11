import { execFileSync } from 'node:child_process';
import { beforeAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { workerModules } from '../fixtures/worker-modules.ts';

const base = {
  HYPERBUG_ENV: 'production',
  ALLOWED_ORIGINS: 'https://client.example.org',
  HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-minimum',
  HYPERBUG_DEGRADATION_ACK: 'minimum-v2',
};
const oauth = {
  HYPERBUG_OAUTH_CLIENTS: JSON.stringify([
    {
      clientId: 'composition-test',
      redirectUris: ['https://client.example.org/callback'],
      scopes: ['public-api'],
    },
  ]),
};
const passkey = {
  PASSKEY_RP_ID: 'auth.example.org',
  PASSKEY_RP_NAME: 'HyperBug',
  PASSKEY_ORIGIN: 'https://auth.example.org',
};

beforeAll(() => {
  execFileSync(process.execPath, [
    'tooling/build.ts',
    '--target=cloudflare-minimum',
    '--target=cloudflare-ingress',
  ]);
});

function root(bindings: Record<string, string>) {
  const modules = workerModules('dist/cloudflare-minimum');
  return new Miniflare(
    convertV4MiniflareOptions({
      modules: [
        ...modules.filter((module) => module.path.endsWith('/minimum.mjs')),
        ...modules.filter((module) => !module.path.endsWith('/minimum.mjs')),
      ],
      compatibilityDate: '2026-09-16',
      compatibilityFlags: ['nodejs_compat', 'enable_request_signal'],
      bindings: { ...base, ...bindings },
    }),
  );
}

for (const [name, bindings] of Object.entries({ oauth, passkey })) {
  it(`evaluates valid ${name} config without live bindings and rejects runtime routes`, async () => {
    const mf = root(bindings);
    try {
      await mf.ready;
      for (const path of ['/health/live', '/api/v1/instance', '/auth/login']) {
        const response = await mf.dispatchFetch(
          'https://auth.example.org' + path,
        );
        expect(response.status).toBe(500);
        expect(await response.text()).toContain(
          `Invalid ${name === 'oauth' ? 'OAuth client' : 'passkey'} configuration`,
        );
      }
    } finally {
      await mf.dispose();
    }
  });
}

for (const [name, bindings] of Object.entries({
  oauth: { HYPERBUG_OAUTH_CLIENTS: 'malformed' },
  passkey: { PASSKEY_RP_ID: passkey.PASSKEY_RP_ID },
})) {
  it(`still rejects malformed ${name} config during evaluation`, async () => {
    const mf = root(bindings);
    try {
      await expect(mf.ready).rejects.toThrow();
    } finally {
      // A rejected startup is also rethrown by Miniflare disposal.
      await mf.dispose().catch(() => undefined);
    }
  });
}
