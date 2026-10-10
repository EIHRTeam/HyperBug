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
  PASSWORD_CAPABILITY_DISABLED: [
    403,
    'Password accounts are disabled on this deployment.',
  ],
  BOOTSTRAP_UNAVAILABLE: [503, 'Initial enrollment is unavailable.'],
  BOOTSTRAP_FORBIDDEN: [403, 'Initial enrollment is not permitted.'],
  LOGIN_DENIED: [401, 'Invalid account credentials.'],
  AUTHENTICATION_REQUIRED: [401, 'Authentication is required.'],
  AUTHENTICATION_UNAVAILABLE: [503, 'Authentication is unavailable.'],
  RECOVERY_DENIED: [403, 'Account recovery is not permitted.'],
  RECOVERY_UNAVAILABLE: [503, 'Account recovery is unavailable.'],
  AUDIT_UNAVAILABLE: [503, 'The audit trail is unavailable.'],
  PASSKEY_DENIED: [403, 'Passkey verification is not permitted.'],
  PASSKEY_UNAVAILABLE: [503, 'Passkey authentication is unavailable.'],
  OAUTH_DENIED: [400, 'The authorization request is not permitted.'],
  OAUTH_UNAVAILABLE: [503, 'The authorization service is unavailable.'],
  PLUGIN_INVALID: [400, 'The plugin manifest or request is invalid.'],
  PLUGIN_STATE_CONFLICT: [
    409,
    'The plugin registry state does not allow this operation.',
  ],
  PLUGIN_UNAVAILABLE: [503, 'The plugin registry is unavailable.'],
  REVISION_CONFLICT: [
    409,
    'The resource was changed concurrently. Retry with the current revision.',
  ],
  IDEMPOTENCY_CONFLICT: [
    409,
    'The idempotency key was reused with a different request payload.',
  ],
  IDEMPOTENCY_EXPIRED: [
    409,
    'The idempotency receipt has expired. Use a new key.',
  ],
  SEARCH_SYNTAX: [400, 'The search syntax is invalid.'],
  SEARCH_UNSUPPORTED: [400, 'The search operator or filter is unsupported.'],
  SEARCH_VALUE: [400, 'The search value is invalid.'],
  SEARCH_PRINCIPAL_REQUIRED: [
    400,
    'This search requires an authenticated principal.',
  ],
  SEARCH_COMPLEXITY: [400, 'The search exceeds the complexity limit.'],
  SEARCH_VERSION: [400, 'The search version is unsupported.'],
  SEARCH_WINDOW_EXHAUSTED: [
    400,
    'The search result window is exhausted. Narrow or refresh the query.',
  ],
  SEARCH_BUDGET_EXHAUSTED: [
    503,
    'The search budget is unavailable. Retry or narrow the query.',
  ],
  SEARCH_INDEX_INCOMPLETE: [503, 'The search index is incomplete.'],
  SEARCH_UNAVAILABLE: [503, 'The search service is unavailable.'],
  CURSOR_STALE: [400, 'The pagination cursor is retired.'],
  INVALID_CURSOR: [400, 'The pagination cursor is invalid.'],
  ISSUE_INVALID: [400, 'The issue request is invalid.'],
  ISSUE_UNAVAILABLE: [503, 'The issue service is unavailable.'],
  ATTACHMENT_UNAVAILABLE: [503, 'The attachment service is unavailable.'],
  ATTACHMENT_RANGE_INVALID: [416, 'The requested byte range is unavailable.'],
  UPLOAD_INVALID: [
    400,
    'The upload request is invalid or exceeds the supported direct-upload limit.',
  ],
  UPLOAD_NOT_FOUND: [404, 'Upload intent not found.'],
  UPLOAD_FORBIDDEN: [403, 'Upload access denied.'],
  UPLOAD_CONFLICT: [
    409,
    'The upload intent conflicts with this request or state.',
  ],
  UPLOAD_EXPIRED: [410, 'The upload intent has expired.'],
  UPLOAD_QUOTA: [409, 'The upload quota is exhausted.'],
  UPLOAD_LEASE_LOST: [409, 'The upload processing lease is unavailable.'],
  UPLOAD_UNAVAILABLE: [503, 'The upload service is unavailable.'],
  PROJECT_INVALID: [400, 'The project request is invalid.'],
  PROJECT_CONFLICT: [409, 'The project slug is already in use.'],
  PROJECT_UNAVAILABLE: [503, 'The project service is unavailable.'],
  TAXONOMY_INVALID: [400, 'The taxonomy request is invalid.'],
  TAXONOMY_CONFLICT: [
    409,
    'The taxonomy name is already in use or the entry is referenced.',
  ],
  TAXONOMY_UNAVAILABLE: [503, 'The taxonomy service is unavailable.'],
  CONTENT_INVALID: [400, 'The content definition request is invalid.'],
  CONTENT_NAME_CONFLICT: [
    409,
    'The content definition name is already in use.',
  ],
  CONTENT_CATALOG_LIMIT: [409, 'The project content catalog is full.'],
  CONTENT_UNAVAILABLE: [503, 'The content definition service is unavailable.'],
  FORM_DEFINITION_INVALID: [400, 'The form definition is invalid.'],
  FORM_ATTRIBUTE_UNSUPPORTED: [400, 'The form attribute is unsupported.'],
  FORM_ANSWERS_INVALID: [400, 'The form answers are invalid.'],
  FORM_DEFAULTS_INVALID: [
    400,
    'The authored form defaults do not resolve in this project.',
  ],
  FORM_ATTACHMENTS_INVALID: [
    400,
    'The form attachments are not authorized for submission.',
  ],
  FORM_SUBMISSION_FORBIDDEN: [403, 'Form submission is not permitted.'],
  FORM_VERSION_STALE: [
    409,
    'The form changed or was disabled. Reload its definition.',
  ],
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
