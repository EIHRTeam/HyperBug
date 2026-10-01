export type DeploymentRuntime = 'node' | 'cloudflare';
export type DeploymentTier = 'standard' | 'cloudflare-free-minimum';

export interface DeploymentEnvironment {
  HYPERBUG_DEPLOYMENT_TIER?: unknown;
  HYPERBUG_DEGRADATION_ACK?: unknown;
}

/** These controls are unconditional policy, never operator/plugin switches. */
export const deploymentInvariants = Object.freeze([
  'object-authorization-and-roles',
  'append-only-redacted-audit',
  'markdown-csp-and-sanitization',
  'keyed-credentials-and-envelope-encryption',
  'tls-and-hsts',
  'memory-only-browser-tokens',
  'bearer-only-business-apis',
  'fail-closed-authorization',
  'no-production-debug-or-bypasses',
] as const);

/** IDs and compensation requirements are versioned by ADR 0007, not by env. */
export const minimumDegradations = Object.freeze({
  'FREE-01': Object.freeze({
    summary: 'PBKDF2 password hashing instead of Argon2id',
    compensation:
      'Versioned pepper and salt, reviewed measured floor, upgrade rehash, passkeys and recovery codes',
  }),
  'FREE-02': Object.freeze({
    summary: 'Approximate location-scoped sensitive rate limits',
    compensation:
      'D1 account lockout and progressive delay, account/route quotas, configured required CAPTCHA and alerts',
  }),
  'FREE-03': Object.freeze({
    summary: 'Reduced background durability with bounded D1/Cron dispatch',
    compensation:
      'Idempotency, crash reconciliation, D1 failed-job replay and visible backlog age',
  }),
  'FREE-04': Object.freeze({
    summary: 'Shorter audit/log retention without Logpush or OTLP export',
    compensation:
      'Complete append-only audit, authorized browsing, bounded operator queries and quota/backlog alerts',
  }),
  'FREE-05': Object.freeze({
    summary: 'Free-plan storage, request, query and scheduling ceilings',
    compensation:
      'Measured instance ceiling, quota pre-checks, bounded batches and explicit capacity errors',
  }),
  'FREE-06': Object.freeze({
    summary: 'Operator SMTP relay required for arbitrary email recipients',
    compensation:
      'TLS and SASL, encrypted relay credentials, bounded retry/deduplication and header-injection protection',
  }),
  'FREE-07': Object.freeze({
    summary: 'Recovery limited by seven-day Time Travel and no log export',
    compensation:
      'Tier-specific measured recovery objectives and backup/restore rehearsal',
  }),
  'FREE-08': Object.freeze({
    summary: 'Bulk, import/export and long-running jobs unavailable or capped',
    compensation:
      'API/UI capability gates, explanatory states and bounded administrator alternatives',
  }),
});
export type DegradationId = keyof typeof minimumDegradations;

const standard = Object.freeze({
  tier: 'standard' as const,
  acknowledgement: null,
  degradationIds: Object.freeze([]),
  invariants: deploymentInvariants,
  requiredPasswordAlgorithm: 'argon2id' as const,
});
const minimum = Object.freeze({
  tier: 'cloudflare-free-minimum' as const,
  acknowledgement: 'free-minimum-v1' as const,
  degradationIds: Object.freeze(
    Object.keys(minimumDegradations) as DegradationId[],
  ),
  invariants: deploymentInvariants,
  requiredPasswordAlgorithm: 'pbkdf2-hmac-sha256' as const,
});

/** Required policy only. This is not a capability or a password verifier. */
export type DeploymentConfig = typeof standard | typeof minimum;

const documentation = 'See docs/FREE-TIER-PROFILE.md (ADR 0007).';

export function loadDeploymentConfig(
  env: DeploymentEnvironment,
  runtime: DeploymentRuntime,
): DeploymentConfig {
  if (runtime !== 'node' && runtime !== 'cloudflare')
    throw new Error(
      'Deployment runtime must be supplied by the composition root',
    );
  const tier =
    env.HYPERBUG_DEPLOYMENT_TIER === undefined
      ? 'standard'
      : env.HYPERBUG_DEPLOYMENT_TIER;
  // Only an absent value defaults. Null, empty, mixed case and coercions fail.
  if (tier !== 'standard' && tier !== 'cloudflare-free-minimum')
    throw new Error(`Invalid HYPERBUG_DEPLOYMENT_TIER. ${documentation}`);
  if (tier === 'standard') {
    if (env.HYPERBUG_DEGRADATION_ACK !== undefined)
      throw new Error(
        `Degradation acknowledgement requires the minimum tier. ${documentation}`,
      );
    return standard;
  }
  if (runtime !== 'cloudflare')
    throw new Error(
      `The minimum tier is restricted to Cloudflare. ${documentation}`,
    );
  if (env.HYPERBUG_DEGRADATION_ACK !== 'free-minimum-v1')
    throw new Error(
      `The minimum tier requires HYPERBUG_DEGRADATION_ACK=free-minimum-v1. ${documentation}`,
    );
  return minimum;
}

/**
 * Consistency gate for a parsed deployment config. The audited enablement
 * itself is enforced by the composition root: the persisted
 * deployment.enablement audit event, the startup warning and the peppered
 * password service preflight run per isolate and fail every request closed
 * while they fail (Cloudflare's upload-time module validation runs without
 * live bindings, so a binding-dependent check here would falsely refuse
 * valid uploads). Passing this check never implies the independent 13.G6
 * acceptance or tier support, and there is no environment flag or test-only
 * override.
 */
export function assertDeploymentAvailable(config: DeploymentConfig): void {
  if (config?.tier === 'standard') return;
  if (config?.tier === 'cloudflare-free-minimum') return;
  throw new Error(`Invalid deployment configuration. ${documentation}`);
}
