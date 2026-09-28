/** Deployment policy contains bounds and retention, never credentials. */
export interface SecurityEnvironment {
  DEBUG?: unknown;
  MAX_JSON_DEPTH?: unknown;
  MAX_JSON_NODES?: unknown;
  MAX_JSON_OBJECT_KEYS?: unknown;
  MAX_JSON_ARRAY_ITEMS?: unknown;
  MAX_JSON_STRING_LENGTH?: unknown;
  MAX_URL_LENGTH?: unknown;
  MAX_QUERY_PARAMETERS?: unknown;
  MAX_QUERY_VALUE_LENGTH?: unknown;
  ADMIN_RECENT_AUTH_SECONDS?: unknown;
  AUTHORIZATION_TIMEOUT_MS?: unknown;
  RETENTION_SECURITY_LOG_SECONDS?: unknown;
  RETENTION_AUDIT_SECONDS?: unknown;
  RETENTION_ABUSE_SECONDS?: unknown;
  RETENTION_EXPIRED_SESSION_SECONDS?: unknown;
  RETENTION_DELETED_ACCOUNT_SECONDS?: unknown;
  RETENTION_TEMPORARY_UPLOAD_SECONDS?: unknown;
  RETENTION_EXPORT_SECONDS?: unknown;
}

export interface InputLimits {
  readonly maxJsonDepth: number;
  readonly maxJsonNodes: number;
  readonly maxJsonObjectKeys: number;
  readonly maxJsonArrayItems: number;
  readonly maxJsonStringLength: number;
  readonly maxUrlLength: number;
  readonly maxQueryParameters: number;
  readonly maxQueryValueLength: number;
}

export interface SecurityConfig {
  readonly debug: boolean;
  readonly input: InputLimits;
  readonly authorization: {
    readonly recentAuthMaxAgeMs: number;
    readonly timeoutMs: number;
  };
  readonly retentionSeconds: Readonly<{
    securityLogs: number;
    audit: number;
    abuseMetadata: number;
    expiredSessions: number;
    deletedAccounts: number;
    temporaryUploads: number;
    exports: number;
  }>;
}

/** Reject coercions such as true, whitespace, hexadecimal and exponent strings. */
export function boundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'number' &&
    (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value))
  ) {
    throw new Error('Invalid bounded runtime setting');
  }
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new Error('Invalid bounded runtime setting');
  }
  return result;
}

export function loadSecurityConfig(
  env: SecurityEnvironment,
  environment: 'local' | 'staging' | 'production',
): SecurityConfig {
  if (
    env.DEBUG !== undefined &&
    env.DEBUG !== 'true' &&
    env.DEBUG !== 'false'
  ) {
    throw new Error('DEBUG must be explicitly true or false');
  }
  const debug = env.DEBUG === 'true';
  if (debug && environment !== 'local') {
    throw new Error('Debug is restricted to the explicit local environment');
  }
  const day = 86400;
  return Object.freeze({
    debug,
    input: Object.freeze({
      maxJsonDepth: boundedInteger(env.MAX_JSON_DEPTH, 16, 1, 32),
      maxJsonNodes: boundedInteger(env.MAX_JSON_NODES, 4096, 1, 16384),
      maxJsonObjectKeys: boundedInteger(env.MAX_JSON_OBJECT_KEYS, 128, 1, 256),
      maxJsonArrayItems: boundedInteger(env.MAX_JSON_ARRAY_ITEMS, 256, 1, 1024),
      maxJsonStringLength: boundedInteger(
        env.MAX_JSON_STRING_LENGTH,
        32768,
        1,
        262144,
      ),
      maxUrlLength: boundedInteger(env.MAX_URL_LENGTH, 8192, 256, 16384),
      maxQueryParameters: boundedInteger(env.MAX_QUERY_PARAMETERS, 64, 1, 128),
      maxQueryValueLength: boundedInteger(
        env.MAX_QUERY_VALUE_LENGTH,
        2048,
        1,
        4096,
      ),
    }),
    authorization: Object.freeze({
      recentAuthMaxAgeMs:
        boundedInteger(env.ADMIN_RECENT_AUTH_SECONDS, 300, 1, 900) * 1000,
      timeoutMs: boundedInteger(env.AUTHORIZATION_TIMEOUT_MS, 1000, 10, 5000),
    }),
    retentionSeconds: Object.freeze({
      securityLogs: boundedInteger(
        env.RETENTION_SECURITY_LOG_SECONDS,
        30 * day,
        1,
        365 * day,
      ),
      audit: boundedInteger(
        env.RETENTION_AUDIT_SECONDS,
        365 * day,
        day,
        3650 * day,
      ),
      abuseMetadata: boundedInteger(
        env.RETENTION_ABUSE_SECONDS,
        day,
        1,
        7 * day,
      ),
      expiredSessions: boundedInteger(
        env.RETENTION_EXPIRED_SESSION_SECONDS,
        day,
        1,
        30 * day,
      ),
      deletedAccounts: boundedInteger(
        env.RETENTION_DELETED_ACCOUNT_SECONDS,
        30 * day,
        1,
        365 * day,
      ),
      temporaryUploads: boundedInteger(
        env.RETENTION_TEMPORARY_UPLOAD_SECONDS,
        day,
        1,
        7 * day,
      ),
      exports: boundedInteger(env.RETENTION_EXPORT_SECONDS, day, 1, 7 * day),
    }),
  });
}
