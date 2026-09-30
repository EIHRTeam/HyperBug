/** Only catalogued messages cross the API boundary, even for expected errors. */
const failures = {
  BODY_TOO_LARGE: [413, 'Request body exceeds the limit.'],
  INVALID_JSON: [400, 'Invalid JSON body.'],
  INPUT_LIMIT_EXCEEDED: [400, 'Request input exceeds the allowed limits.'],
  INVALID_REQUEST: [400, 'Request validation failed.'],
  REQUEST_TIMEOUT: [408, 'Request timed out or was cancelled.'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'Use application/json.'],
  NOT_FOUND: [404, 'Resource not found.'],
  FORBIDDEN: [403, 'Access denied.'],
  REAUTHENTICATION_REQUIRED: [403, 'Recent authentication is required.'],
  AUTHORIZATION_UNAVAILABLE: [503, 'Authorization is unavailable.'],
  ORIGIN_FORBIDDEN: [403, 'Request origin is not allowed.'],
  INVALID_PREFLIGHT: [400, 'Invalid preflight request.'],
  RATE_LIMITED: [429, 'Request rate limit exceeded.'],
  RATE_LIMIT_UNAVAILABLE: [
    503,
    'Request rate limit verification is unavailable.',
  ],
  CAPTCHA_DENIED: [403, 'Required challenge verification failed.'],
  CAPTCHA_UNAVAILABLE: [503, 'Required challenge verification is unavailable.'],
  REGISTRATION_UNAVAILABLE: [503, 'Account registration is unavailable.'],
  BOOTSTRAP_UNAVAILABLE: [503, 'Initial enrollment is unavailable.'],
  BOOTSTRAP_FORBIDDEN: [403, 'Initial enrollment is not permitted.'],
  LOGIN_DENIED: [401, 'Invalid account credentials.'],
  RECOVERY_DENIED: [403, 'Account recovery is not permitted.'],
  RECOVERY_UNAVAILABLE: [503, 'Account recovery is unavailable.'],
  INTERNAL_ERROR: [500, 'An internal error occurred.'],
} as const;

export type RequestFailureCode = keyof typeof failures;

export class RequestFailure extends Error {
  readonly code: RequestFailureCode;
  readonly retryAfterSeconds: number | null;
  constructor(code: RequestFailureCode, retryAfterSeconds?: number) {
    if (
      retryAfterSeconds !== undefined &&
      (code !== 'RATE_LIMITED' ||
        !Number.isSafeInteger(retryAfterSeconds) ||
        retryAfterSeconds < 1 ||
        retryAfterSeconds > 86400)
    )
      throw new Error('Invalid retry hint');
    super(
      Object.hasOwn(failures, code)
        ? failures[code][1]
        : failures.INTERNAL_ERROR[1],
    );
    this.code = Object.hasOwn(failures, code) ? code : 'INTERNAL_ERROR';
    this.retryAfterSeconds = retryAfterSeconds ?? null;
  }
}

/** Do not trust even an Error's message/status properties as public data. */
export function publicFailure(error: unknown, frameworkCode: unknown) {
  const source =
    frameworkCode === 'PARSE' &&
    error instanceof Error &&
    error.cause instanceof RequestFailure
      ? error.cause
      : error;
  const candidate = source instanceof RequestFailure ? source.code : undefined;
  const code =
    candidate !== undefined && Object.hasOwn(failures, candidate)
      ? candidate
      : frameworkCode === 'VALIDATION' || frameworkCode === 'PARSE'
        ? 'INVALID_REQUEST'
        : frameworkCode === 'NOT_FOUND'
          ? 'NOT_FOUND'
          : 'INTERNAL_ERROR';
  return {
    code,
    status: failures[code][0],
    message: failures[code][1],
    ...(code === 'RATE_LIMITED' &&
    source instanceof RequestFailure &&
    Number.isSafeInteger(source.retryAfterSeconds) &&
    source.retryAfterSeconds !== null &&
    source.retryAfterSeconds >= 1 &&
    source.retryAfterSeconds <= 86400
      ? { retryAfterSeconds: source.retryAfterSeconds }
      : {}),
  };
}
