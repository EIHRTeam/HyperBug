export const rateCategories = [
  'login',
  'password-reset',
  'registration',
  'issue-create',
  'comment-create',
  'reaction',
  'search',
  'attachment-upload',
  'api-token-create',
  'webhook-configure',
] as const;
export type RateCategory = (typeof rateCategories)[number];

export const rateDimensions = [
  'ip',
  'account',
  'principal',
  'project',
  'token',
  'route',
] as const;
export type RateDimension = (typeof rateDimensions)[number];

/** Minimum independent subjects for each route class, before any counter write. */
export const requiredRateDimensions: Readonly<
  Record<RateCategory, readonly RateDimension[]>
> = Object.freeze({
  login: Object.freeze(['account', 'ip'] as const),
  'password-reset': Object.freeze(['account', 'ip'] as const),
  registration: Object.freeze(['account', 'ip'] as const),
  'issue-create': Object.freeze(['principal', 'project'] as const),
  'comment-create': Object.freeze(['principal', 'project'] as const),
  reaction: Object.freeze(['principal', 'project'] as const),
  search: Object.freeze(['ip', 'route'] as const),
  'attachment-upload': Object.freeze(['principal', 'project'] as const),
  'api-token-create': Object.freeze(['principal', 'ip'] as const),
  'webhook-configure': Object.freeze(['principal', 'project'] as const),
});

export function hasRequiredRateDimensions(
  category: RateCategory,
  dimensions: ReadonlySet<RateDimension>,
): boolean {
  if (!rateCategories.includes(category)) return false;
  return requiredRateDimensions[category].every((required) =>
    dimensions.has(required),
  );
}

export interface RateSubject {
  readonly category: RateCategory;
  readonly dimension: RateDimension;
  readonly keyVersion: number;
  /** Lowercase HMAC-SHA256 hex; never raw IP, account, token or principal data. */
  readonly digest: string;
}

export interface RateRule {
  readonly limit: number;
  readonly windowMs: number;
  /** Additional time after the window closes before the row may be purged. */
  readonly retentionMs: number;
}

export interface RateCounterWrite extends RateSubject {
  readonly windowStart: number;
  readonly expiresAt: number;
}

export interface RateCounterStore {
  /** Atomic write and return from the authoritative counter, never a replica read. */
  increment(input: RateCounterWrite): Promise<number>;
  /** Delete at most limit expired rows; return the number removed. */
  purgeExpired(nowMs: number, limit: number): Promise<number>;
}

/** Approximate, location/process-scoped protection. Never the sole sensitive gate. */
export interface VolumetricLimiter {
  consume(digest: string, nowMs: number): Promise<VolumetricDecision>;
}

export type VolumetricDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: 'limited' | 'unavailable' };

export function validVolumetricKey(digest: string, nowMs: number): boolean {
  return (
    typeof digest === 'string' &&
    hexDigest.test(digest) &&
    Number.isSafeInteger(nowMs) &&
    nowMs >= 0 &&
    nowMs <= 8640000000000000
  );
}

export type RateDecision =
  | { readonly allowed: true; readonly remaining: number }
  | {
      readonly allowed: false;
      readonly reason: 'limited' | 'unavailable';
      readonly retryAfterSeconds: number | null;
    };

export class RateLimitFailure extends Error {
  readonly code = 'RATE_LIMIT_FAILURE';
  constructor() {
    super('Rate limit verification failed.');
  }
}

const hexDigest = /^[0-9a-f]{64}$/;
const encoder = new TextEncoder();
const unavailable: RateDecision = Object.freeze({
  allowed: false,
  reason: 'unavailable',
  retryAfterSeconds: null,
});

export function validCounterWrite(value: RateCounterWrite): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    rateCategories.includes(value.category) &&
    rateDimensions.includes(value.dimension) &&
    Number.isSafeInteger(value.keyVersion) &&
    value.keyVersion >= 1 &&
    value.keyVersion <= 2147483647 &&
    typeof value.digest === 'string' &&
    hexDigest.test(value.digest) &&
    Number.isSafeInteger(value.windowStart) &&
    value.windowStart >= 0 &&
    value.windowStart <= 8640000000000000 &&
    Number.isSafeInteger(value.expiresAt) &&
    value.expiresAt > value.windowStart &&
    value.expiresAt <= 8640000000000000
  );
}

export function validRateRule(rule: RateRule, nowMs: number): boolean {
  return (
    rule !== null &&
    typeof rule === 'object' &&
    Number.isSafeInteger(nowMs) &&
    nowMs >= 0 &&
    nowMs <= 8640000000000000 &&
    Number.isSafeInteger(rule.limit) &&
    rule.limit >= 1 &&
    rule.limit <= 1000000 &&
    Number.isSafeInteger(rule.windowMs) &&
    rule.windowMs >= 1000 &&
    rule.windowMs <= 86400000 &&
    Number.isSafeInteger(rule.retentionMs) &&
    rule.retentionMs >= 1000 &&
    rule.retentionMs <= 604800000
  );
}

/** Domain-separated HMAC for a canonicalized subject from a trusted caller. */
export async function abuseSubjectDigest(
  key: CryptoKey,
  keyVersion: number,
  category: RateCategory,
  dimension: RateDimension,
  subject: string,
): Promise<RateSubject> {
  const hash = 'hash' in key.algorithm ? key.algorithm.hash : null;
  if (
    !rateCategories.includes(category) ||
    !rateDimensions.includes(dimension) ||
    !Number.isSafeInteger(keyVersion) ||
    keyVersion < 1 ||
    keyVersion > 2147483647 ||
    typeof subject !== 'string' ||
    subject.length < 1 ||
    subject.length > 512 ||
    key.type !== 'secret' ||
    key.extractable ||
    key.algorithm.name !== 'HMAC' ||
    !('length' in key.algorithm) ||
    key.algorithm.length !== 256 ||
    hash === null ||
    typeof hash !== 'object' ||
    !('name' in hash) ||
    hash.name !== 'SHA-256' ||
    !key.usages.includes('sign')
  )
    throw new RateLimitFailure();
  try {
    const message = encoder.encode(
      JSON.stringify(['hyperbug-abuse', 1, category, dimension, subject]),
    );
    const signature = await crypto.subtle.sign('HMAC', key, message);
    return Object.freeze({
      category,
      dimension,
      keyVersion,
      digest: Array.from(new Uint8Array(signature), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
    });
  } catch {
    throw new RateLimitFailure();
  }
}

/** Every call consumes a slot; a storage error never grants access. */
export async function checkSensitiveRateLimit(
  store: RateCounterStore,
  subject: RateSubject,
  rule: RateRule,
  nowMs: number,
): Promise<RateDecision> {
  if (!validRateRule(rule, nowMs)) return unavailable;
  const windowStart = Math.floor(nowMs / rule.windowMs) * rule.windowMs;
  const windowEnd = windowStart + rule.windowMs;
  const input = {
    ...subject,
    windowStart,
    expiresAt: windowEnd + rule.retentionMs,
  };
  if (!validCounterWrite(input)) return unavailable;
  try {
    const count = await store.increment(input);
    if (!Number.isSafeInteger(count) || count < 1 || count > 2147483647)
      return unavailable;
    return count <= rule.limit
      ? { allowed: true, remaining: rule.limit - count }
      : {
          allowed: false,
          reason: 'limited',
          retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)),
        };
  } catch {
    return unavailable;
  }
}

/**
 * During key rotation, consume every readable version for the same subject.
 * Keep the previous key active for at least the longest configured window so
 * retiring it cannot reset an in-flight limit.
 */
export async function checkSensitiveRateLimitVersions(
  store: RateCounterStore,
  subjects: readonly RateSubject[],
  rule: RateRule,
  nowMs: number,
): Promise<RateDecision> {
  if (!validVersionSet(subjects, rule, nowMs)) return unavailable;

  // A denied older version still increments the newer counter. Otherwise a
  // denied attempt could become allowed as soon as the older key is retired.
  return combineDecisions(
    await Promise.all(
      subjects.map((subject) =>
        checkSensitiveRateLimit(store, subject, rule, nowMs),
      ),
    ),
  );
}

function validVersionSet(
  subjects: readonly RateSubject[],
  rule: RateRule,
  nowMs: number,
): boolean {
  if (
    !validRateRule(rule, nowMs) ||
    !Array.isArray(subjects) ||
    subjects.length < 1 ||
    subjects.length > 8
  )
    return false;
  const windowStart = Math.floor(nowMs / rule.windowMs) * rule.windowMs;
  const expiresAt = windowStart + rule.windowMs + rule.retentionMs;
  const first = subjects[0];
  if (
    !first ||
    subjects.some(
      (subject) =>
        !subject ||
        typeof subject !== 'object' ||
        !validCounterWrite({ ...subject, windowStart, expiresAt }) ||
        subject.category !== first.category ||
        subject.dimension !== first.dimension,
    ) ||
    new Set(subjects.map((subject) => subject.keyVersion)).size !==
      subjects.length
  )
    return false;

  return true;
}

function combineDecisions(decisions: readonly RateDecision[]): RateDecision {
  if (
    decisions.some(
      (decision) => !decision.allowed && decision.reason === 'unavailable',
    )
  )
    return unavailable;
  const limited = decisions.filter(
    (decision): decision is Extract<RateDecision, { allowed: false }> =>
      !decision.allowed,
  );
  if (limited.length)
    return {
      allowed: false,
      reason: 'limited',
      retryAfterSeconds: Math.max(
        ...limited.map((decision) => decision.retryAfterSeconds ?? 1),
      ),
    };
  return {
    allowed: true,
    remaining: Math.min(
      ...decisions.map((decision) =>
        decision.allowed ? decision.remaining : 0,
      ),
    ),
  };
}

export interface SensitiveRateCheck {
  /** All active key versions for one canonical subject and dimension. */
  readonly subjects: readonly RateSubject[];
  readonly rule: RateRule;
}

/**
 * Apply a complete route policy before a sensitive side effect. Every
 * dimension/window/version consumes an attempt, even if another is limited.
 */
export async function checkSensitiveRateLimits(
  store: RateCounterStore,
  checks: readonly SensitiveRateCheck[],
  nowMs: number,
): Promise<RateDecision> {
  if (!Array.isArray(checks) || checks.length < 2 || checks.length > 8)
    return unavailable;
  const first = checks[0];
  if (!first || !validVersionSet(first.subjects, first.rule, nowMs))
    return unavailable;
  const category = first.subjects[0]!.category;
  const versions = first.subjects
    .map((subject: RateSubject) => subject.keyVersion)
    .join(',');
  const dimensions = new Set<RateDimension>();
  const dimensionsAndWindows = new Set<string>();
  let writes = 0;
  for (const check of checks) {
    if (!check || !validVersionSet(check.subjects, check.rule, nowMs))
      return unavailable;
    const subject = check.subjects[0]!;
    const identity = JSON.stringify([subject.dimension, check.rule.windowMs]);
    writes += check.subjects.length;
    if (
      subject.category !== category ||
      check.subjects.map((entry: RateSubject) => entry.keyVersion).join(',') !==
        versions ||
      dimensionsAndWindows.has(identity) ||
      writes > 16
    )
      return unavailable;
    dimensions.add(subject.dimension);
    dimensionsAndWindows.add(identity);
  }
  if (dimensions.size < 2 || !hasRequiredRateDimensions(category, dimensions))
    return unavailable;

  return combineDecisions(
    await Promise.all(
      checks.map((check) =>
        checkSensitiveRateLimitVersions(
          store,
          check.subjects,
          check.rule,
          nowMs,
        ),
      ),
    ),
  );
}
