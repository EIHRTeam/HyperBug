import {
  boundedInteger,
  loadSecurityConfig,
  type SecurityConfig,
  type SecurityEnvironment,
} from './security.ts';
import {
  loadDeploymentConfig,
  type DeploymentConfig,
  type DeploymentEnvironment,
  type DeploymentRuntime,
} from './deployment.ts';

export {
  assertDeploymentAvailable,
  deploymentInvariants,
  minimumDegradations,
  type DeploymentConfig,
  type DeploymentEnvironment,
  type DeploymentRuntime,
  type DeploymentTier,
  type DegradationId,
} from './deployment.ts';

export type {
  SecurityConfig,
  SecurityEnvironment,
  InputLimits,
} from './security.ts';

export interface RuntimeConfig {
  readonly runtime: DeploymentRuntime;
  readonly deployment: DeploymentConfig;
  environment: 'local' | 'staging' | 'production';
  allowedOrigins: readonly string[];
  maxBodyBytes: number;
  requestTimeoutMs: number;
  security: SecurityConfig;
}

export function loadConfig(
  env: SecurityEnvironment &
    DeploymentEnvironment & {
      HYPERBUG_ENV?: unknown;
      ALLOWED_ORIGINS?: unknown;
      MAX_BODY_BYTES?: unknown;
      REQUEST_TIMEOUT_MS?: unknown;
    },
  runtime: DeploymentRuntime,
): RuntimeConfig {
  const deployment = loadDeploymentConfig(env, runtime);
  const environment = env.HYPERBUG_ENV;
  if (
    environment !== 'local' &&
    environment !== 'staging' &&
    environment !== 'production'
  ) {
    throw new Error(
      'HYPERBUG_ENV must be explicitly local, staging, or production',
    );
  }
  const raw = env.ALLOWED_ORIGINS;
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) {
    throw new Error('ALLOWED_ORIGINS must contain explicit origins');
  }
  const allowedOrigins = raw.split(',').map((origin) => {
    const value = origin.trim();
    const url = new URL(value);
    if (
      url.origin !== value ||
      url.username ||
      url.password ||
      url.hostname.includes('*') ||
      (url.protocol !== 'https:' &&
        !(
          environment === 'local' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        ))
    ) {
      throw new Error('Invalid allowed origin');
    }
    return value;
  });
  if (
    allowedOrigins.length > 16 ||
    new Set(allowedOrigins).size !== allowedOrigins.length
  ) {
    throw new Error('Invalid allowed origin count');
  }
  return Object.freeze({
    runtime,
    deployment,
    environment,
    allowedOrigins: Object.freeze(allowedOrigins),
    maxBodyBytes: boundedInteger(env.MAX_BODY_BYTES, 65536, 1024, 1048576),
    requestTimeoutMs: boundedInteger(env.REQUEST_TIMEOUT_MS, 10000, 50, 30000),
    security: loadSecurityConfig(env, environment),
  });
}

export { loadAsyncMaintenancePolicy } from './async.ts';
