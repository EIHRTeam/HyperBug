import { describe, expect, it } from 'vitest';
import {
  assertDeploymentAvailable,
  deploymentInvariants,
  loadConfig,
  minimumDegradations,
  type DeploymentEnvironment,
  type DeploymentRuntime,
} from '@hyperbug/config';

const environment = {
  HYPERBUG_ENV: 'production',
  ALLOWED_ORIGINS: 'https://issues.example.org',
};
const minimum = {
  HYPERBUG_DEPLOYMENT_TIER: 'cloudflare-free-minimum',
  HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1',
};

describe('deployment posture and startup gate', () => {
  it('defaults only the absent tier and never infers it from provider state', () => {
    for (const runtime of ['node', 'cloudflare'] as const) {
      for (const extra of [
        {},
        { HYPERBUG_DEPLOYMENT_TIER: 'standard' },
        { WORKERS_PLAN: 'free', QUOTA_EXHAUSTED: 'true', DB: undefined },
        { HYPERBUG_RUNTIME: 'cloudflare', PASSWORD_ALGORITHM: 'pbkdf2' },
      ]) {
        const config = loadConfig({ ...environment, ...extra }, runtime);
        expect(config.runtime).toBe(runtime);
        expect(config.deployment.tier).toBe('standard');
        expect(config.deployment.requiredPasswordAlgorithm).toBe('argon2id');
        expect(config.deployment.degradationIds).toEqual([]);
        expect(() =>
          assertDeploymentAvailable(config.deployment),
        ).not.toThrow();
      }
    }
  });

  it('rejects malformed, stale, orphaned and Node tier selections without echoing input', () => {
    const invalid: DeploymentEnvironment[] = [
      ...[
        null,
        '',
        true,
        0,
        'minimum',
        'STANDARD',
        ' standard',
        'standard ',
        'cloudflare-free-minimum ',
        'SEEDED_SECRET',
        {},
        ['standard'],
      ].map((value) => ({ HYPERBUG_DEPLOYMENT_TIER: value })),
      ...[undefined, null, '', true, 'free-minimum-v0', 'free-minimum-v1 '].map(
        (value) => ({ ...minimum, HYPERBUG_DEGRADATION_ACK: value }),
      ),
      { HYPERBUG_DEGRADATION_ACK: 'free-minimum-v1' },
      { HYPERBUG_DEPLOYMENT_TIER: 'standard', HYPERBUG_DEGRADATION_ACK: '' },
    ];
    for (const settings of invalid) {
      for (const runtime of ['node', 'cloudflare'] as const) {
        expect(() =>
          loadConfig({ ...environment, ...settings }, runtime),
        ).toThrow(/docs\/FREE-TIER-PROFILE\.md/);
        try {
          loadConfig({ ...environment, ...settings }, runtime);
        } catch (error) {
          expect(String(error)).not.toContain('SEEDED_SECRET');
        }
      }
    }
    expect(() => loadConfig({ ...environment, ...minimum }, 'node')).toThrow(
      /restricted to Cloudflare/,
    );
    for (const runtime of [
      undefined,
      'free',
      'NODE',
    ] as unknown as DeploymentRuntime[])
      expect(() => loadConfig(environment, runtime)).toThrow(
        /composition root/,
      );
  });

  it('keeps tier posture immutable and independent of the caller environment', () => {
    const env = { ...environment, ...minimum };
    const config = loadConfig(env, 'cloudflare');
    env.HYPERBUG_DEPLOYMENT_TIER = 'standard';
    env.HYPERBUG_DEGRADATION_ACK = '';
    expect(config.deployment).toMatchObject({
      tier: 'cloudflare-free-minimum',
      acknowledgement: 'free-minimum-v1',
      requiredPasswordAlgorithm: 'pbkdf2-hmac-sha256',
      degradationIds: [
        'FREE-01',
        'FREE-02',
        'FREE-03',
        'FREE-04',
        'FREE-05',
        'FREE-06',
        'FREE-07',
        'FREE-08',
      ],
      invariants: deploymentInvariants,
    });
    for (const value of [
      config,
      config.deployment,
      config.deployment.degradationIds,
      deploymentInvariants,
      minimumDegradations,
      ...Object.values(minimumDegradations),
    ])
      expect(Object.isFrozen(value)).toBe(true);
    expect(() =>
      (config.deployment.degradationIds as string[]).pop(),
    ).toThrow();
    expect(() =>
      (config.deployment.invariants as unknown as string[]).pop(),
    ).toThrow();
  });

  it('preserves invariant enforcement and rejects production debug on either tier', () => {
    const standard = loadConfig(environment, 'cloudflare');
    const selected = loadConfig({ ...environment, ...minimum }, 'cloudflare');
    expect(selected.security).toEqual(standard.security);
    expect(selected.allowedOrigins).toEqual(standard.allowedOrigins);
    expect(selected.deployment.invariants).toBe(standard.deployment.invariants);
    for (const overrides of [
      { DEBUG: 'true' },
      { ALLOWED_ORIGINS: '*' },
      { AUTHORIZATION_TIMEOUT_MS: 0 },
      { ADMIN_RECENT_AUTH_SECONDS: 901 },
      { RETENTION_AUDIT_SECONDS: 0 },
    ])
      expect(() =>
        loadConfig({ ...environment, ...minimum, ...overrides }, 'cloudflare'),
      ).toThrow();
  });

  it('accepts an acknowledged minimum-tier config; activation is the root contract', () => {
    const config = loadConfig({ ...environment, ...minimum }, 'cloudflare');
    // The config layer only checks consistency; the audited enablement
    // (persisted event, warning, pepper preflight) is the composition root's
    // per-isolate barrier and never an environment switch.
    expect(() => assertDeploymentAvailable(config.deployment)).not.toThrow();
    expect(() => assertDeploymentAvailable(undefined as never)).toThrow();
    expect(() =>
      assertDeploymentAvailable({ tier: 'unknown' } as never),
    ).toThrow();
    const attemptedBypass = {
      ...environment,
      ...minimum,
      HYPERBUG_ENABLE_UNACCEPTED_TIER: 'true',
    };
    expect(() =>
      assertDeploymentAvailable(
        loadConfig(attemptedBypass, 'cloudflare').deployment,
      ),
    ).not.toThrow();
  });
});
