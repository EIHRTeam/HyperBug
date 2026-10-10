import { cryptoRecord, decodeBase64Url } from './crypto.ts';
import { secretDocumentDigest, type SecretKeySource } from './key-provider.ts';
import {
  abuseSubjectDigest,
  checkSensitiveRateLimits,
  checkSensitiveRateLimitVersions,
  rateAdmissionTiers,
  hasRequiredRateDimensions,
  rateCategories,
  rateDimensions,
  RateLimitFailure,
  type RateCategory,
  type RateCounterStore,
  type RateDecision,
  type RateDimension,
  type RateRule,
  type RateSubject,
  validRateRule,
  type VolumetricLimiter,
} from './rate-limit.ts';
import { canonicalIpAddress } from './ip-address.ts';

export interface ActiveAbuseKey {
  readonly version: number;
  readonly key: CryptoKey;
}

export interface AbuseKeyProvider {
  /** Current key first, then every prior version still needed by live windows. */
  active(signal: AbortSignal): Promise<readonly ActiveAbuseKey[]>;
}

async function importRing(
  serialized: string,
): Promise<readonly ActiveAbuseKey[]> {
  if (
    typeof serialized !== 'string' ||
    serialized.length < 1 ||
    serialized.length > 16384
  )
    throw new RateLimitFailure();
  const document = cryptoRecord(JSON.parse(serialized), [
    'v',
    'current',
    'keys',
  ]);
  if (
    document.v !== 1 ||
    !Number.isSafeInteger(document.current) ||
    Number(document.current) < 1 ||
    Number(document.current) > 2147483647 ||
    !Array.isArray(document.keys) ||
    document.keys.length < 1 ||
    document.keys.length > 8
  )
    throw new RateLimitFailure();

  const raw: {
    version: number;
    bytes: Uint8Array<ArrayBuffer>;
    material: string;
  }[] = [];
  try {
    for (const entry of document.keys) {
      const value = cryptoRecord(entry, ['version', 'material']);
      if (
        !Number.isSafeInteger(value.version) ||
        Number(value.version) < 1 ||
        Number(value.version) > 2147483647 ||
        typeof value.material !== 'string'
      )
        throw new RateLimitFailure();
      raw.push({
        version: Number(value.version),
        bytes: decodeBase64Url(value.material, 32, 32),
        material: value.material,
      });
    }
    if (
      raw[0]?.version !== document.current ||
      raw.some(
        (entry, index) => index > 0 && entry.version >= raw[index - 1]!.version,
      ) ||
      new Set(raw.map((entry) => entry.material)).size !== raw.length
    )
      throw new RateLimitFailure();
    return Object.freeze(
      await Promise.all(
        raw.map(async ({ version, bytes }) =>
          Object.freeze({
            version,
            key: await crypto.subtle.importKey(
              'raw',
              bytes,
              { name: 'HMAC', hash: 'SHA-256' },
              false,
              ['sign'],
            ),
          }),
        ),
      ),
    );
  } finally {
    for (const entry of raw) entry.bytes.fill(0);
  }
}

/** Fresh secret-store read per request; source updates cannot be silently cached. */
export class SecretAbuseKeyProvider implements AbuseKeyProvider {
  readonly #source: SecretKeySource;
  readonly #timeoutMs: number;
  #material: {
    digest: string;
    keys: Promise<readonly ActiveAbuseKey[]>;
  } | null = null;

  constructor(source: SecretKeySource, timeoutMs = 1000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 5000)
      throw new RateLimitFailure();
    this.#source = source;
    this.#timeoutMs = timeoutMs;
  }

  async active(signal: AbortSignal): Promise<readonly ActiveAbuseKey[]> {
    if (signal.aborted) throw new RateLimitFailure();
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const serialized = await Promise.race([
        this.#source.read(controller.signal),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => reject(new RateLimitFailure()),
            { once: true },
          );
          if (controller.signal.aborted) reject(new RateLimitFailure());
        }),
      ]);
      if (controller.signal.aborted) throw new RateLimitFailure();
      const digest = await secretDocumentDigest(serialized);
      if (controller.signal.aborted) throw new RateLimitFailure();
      if (this.#material?.digest !== digest) {
        const keys = importRing(serialized);
        this.#material = { digest, keys };
        void keys.catch(() => {
          if (this.#material?.keys === keys) this.#material = null;
        });
      }
      const keys = await this.#material.keys;
      if (controller.signal.aborted) throw new RateLimitFailure();
      return keys;
    } catch {
      throw new RateLimitFailure();
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      controller.abort();
    }
  }
}

/** Call only with a canonical subject from a trusted route boundary. */
export async function activeAbuseSubjects(
  provider: AbuseKeyProvider,
  category: RateCategory,
  dimension: RateDimension,
  canonicalSubject: string,
  signal: AbortSignal,
): Promise<readonly RateSubject[]> {
  try {
    const keys = await provider.active(signal);
    if (signal.aborted || keys.length < 1 || keys.length > 8)
      throw new RateLimitFailure();
    return await Promise.all(
      keys.map(({ version, key }) =>
        abuseSubjectDigest(key, version, category, dimension, canonicalSubject),
      ),
    );
  } catch {
    throw new RateLimitFailure();
  }
}

export interface CanonicalRateCheck {
  readonly dimension: RateDimension;
  /** Trusted, canonical route subject; never an unverified forwarding header. */
  readonly canonicalSubject: string;
  readonly rule: RateRule;
}

const unavailable: RateDecision = Object.freeze({
  allowed: false,
  reason: 'unavailable',
  retryAfterSeconds: null,
});

export type RateAdmissionWithSubjects =
  | {
      readonly allowed: true;
      readonly remaining: number;
      /** One versioned digest set per input check, in the original order. */
      readonly subjectsByCheck: readonly (readonly RateSubject[])[];
    }
  | {
      readonly allowed: false;
      readonly reason: 'limited' | 'unavailable';
      readonly retryAfterSeconds: number | null;
      readonly subjectsByCheck: null;
    };

const unavailableWithSubjects: RateAdmissionWithSubjects = Object.freeze({
  ...unavailable,
  subjectsByCheck: null,
});

/**
 * Build one sensitive admission attempt from one key-ring snapshot. Route
 * owners still select trusted subjects and measured category budgets.
 */
export async function checkSensitiveRateAdmissionWithSubjects(
  provider: AbuseKeyProvider,
  store: RateCounterStore,
  category: RateCategory,
  checks: readonly CanonicalRateCheck[],
  nowMs: number,
  signal: AbortSignal,
  limiter?: VolumetricLimiter,
): Promise<RateAdmissionWithSubjects> {
  if (
    !signal ||
    typeof signal.aborted !== 'boolean' ||
    signal.aborted ||
    !rateCategories.includes(category) ||
    !Array.isArray(checks) ||
    checks.length < 2 ||
    checks.length > 8
  )
    return unavailableWithSubjects;
  const dimensions = new Set<RateDimension>();
  const dimensionWindows = new Set<string>();
  const snapshot: CanonicalRateCheck[] = [];
  for (const check of checks) {
    const dimension = check?.dimension;
    const canonicalSubject = check?.canonicalSubject;
    const candidateRule = check?.rule;
    const rule = candidateRule && {
      limit: candidateRule.limit,
      windowMs: candidateRule.windowMs,
      retentionMs: candidateRule.retentionMs,
    };
    if (
      !rateDimensions.includes(dimension) ||
      typeof canonicalSubject !== 'string' ||
      canonicalSubject.length < 1 ||
      canonicalSubject.length > 512 ||
      !validRateRule(rule, nowMs)
    )
      return unavailableWithSubjects;
    if (dimension === 'ip') {
      try {
        if (canonicalIpAddress(canonicalSubject) !== canonicalSubject)
          return unavailableWithSubjects;
      } catch {
        return unavailableWithSubjects;
      }
    }
    const identity = JSON.stringify([dimension, rule.windowMs]);
    if (dimensionWindows.has(identity)) return unavailableWithSubjects;
    dimensions.add(dimension);
    dimensionWindows.add(identity);
    snapshot.push({
      dimension,
      canonicalSubject,
      rule,
    });
  }
  if (dimensions.size < 2 || !hasRequiredRateDimensions(category, dimensions))
    return unavailableWithSubjects;

  const content = rateAdmissionTiers[category] === 'content';
  if (content && (!limiter || snapshot.length !== 2 || dimensions.size !== 2))
    return unavailableWithSubjects;
  try {
    const keys = await provider.active(signal);
    if (
      signal.aborted ||
      !Array.isArray(keys) ||
      keys.length < 1 ||
      keys.length > 8 ||
      keys.length * snapshot.length > 16
    )
      return unavailableWithSubjects;
    const keySnapshot = (content ? keys.slice(0, 1) : keys).map(
      ({ version, key }) => ({ version, key }),
    );
    const derived = await Promise.all(
      snapshot.map(async (check) => ({
        rule: check.rule,
        subjects: await Promise.all(
          keySnapshot.map(({ key, version }) =>
            abuseSubjectDigest(
              key,
              version,
              category,
              check.dimension,
              check.canonicalSubject,
            ),
          ),
        ),
      })),
    );
    if (signal.aborted) return unavailableWithSubjects;
    if (limiter !== undefined) {
      // Approximate shedding uses only the current key. Primary counters below
      // consume every active version for identity/existing categories; content uses current principal only.
      const digests = Array.from(
        new Set(derived.map((check) => check.subjects[0]!.digest)),
      );
      const decisions = await Promise.all(
        digests.map((digest) => limiter.consume(digest, nowMs)),
      );
      if (
        signal.aborted ||
        decisions.some(
          (decision) =>
            !decision ||
            !(
              (decision.allowed === true && !('reason' in decision)) ||
              (decision.allowed === false &&
                (decision.reason === 'limited' ||
                  decision.reason === 'unavailable'))
            ),
        ) ||
        decisions.some(
          (decision) => !decision.allowed && decision.reason === 'unavailable',
        )
      )
        return unavailableWithSubjects;
      if (decisions.some((decision) => !decision.allowed))
        return {
          allowed: false,
          reason: 'limited',
          retryAfterSeconds: null,
          subjectsByCheck: null,
        };
    }
    const principalIndex = snapshot.findIndex(
      (check) => check.dimension === 'principal',
    );
    const principal = derived[principalIndex];
    const decision = content
      ? await checkSensitiveRateLimitVersions(
          store,
          principal!.subjects,
          principal!.rule,
          nowMs,
        )
      : await checkSensitiveRateLimits(store, derived, nowMs);
    if (signal.aborted) return unavailableWithSubjects;
    if (!decision.allowed) return { ...decision, subjectsByCheck: null };
    return {
      ...decision,
      subjectsByCheck: Object.freeze(
        derived.map((check) => Object.freeze([...check.subjects])),
      ),
    };
  } catch {
    return unavailableWithSubjects;
  }
}

/** Decision-only compatibility API for routes without follow-on subject work. */
export async function checkSensitiveRateAdmission(
  provider: AbuseKeyProvider,
  store: RateCounterStore,
  category: RateCategory,
  checks: readonly CanonicalRateCheck[],
  nowMs: number,
  signal: AbortSignal,
  limiter?: VolumetricLimiter,
): Promise<RateDecision> {
  const result = await checkSensitiveRateAdmissionWithSubjects(
    provider,
    store,
    category,
    checks,
    nowMs,
    signal,
    limiter,
  );
  return result.allowed
    ? { allowed: true, remaining: result.remaining }
    : {
        allowed: false,
        reason: result.reason,
        retryAfterSeconds: result.retryAfterSeconds,
      };
}
