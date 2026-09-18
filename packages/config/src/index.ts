export interface RuntimeConfig {
  environment: 'local' | 'staging' | 'production';
  allowedOrigins: readonly string[];
  maxBodyBytes: number;
  requestTimeoutMs: number;
}

function integer(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new Error('Invalid bounded runtime setting');
  }
  return result;
}

export function loadConfig(env: {
  HYPERBUG_ENV?: unknown;
  ALLOWED_ORIGINS?: unknown;
  MAX_BODY_BYTES?: unknown;
  REQUEST_TIMEOUT_MS?: unknown;
}): RuntimeConfig {
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
    environment,
    allowedOrigins: Object.freeze(allowedOrigins),
    maxBodyBytes: integer(env.MAX_BODY_BYTES, 65536, 1024, 1048576),
    requestTimeoutMs: integer(env.REQUEST_TIMEOUT_MS, 10000, 50, 30000),
  });
}
