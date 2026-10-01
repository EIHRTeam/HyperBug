import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

/** Normalized result from a server-side provider verification call. */
export interface CaptchaEvidence {
  readonly success: boolean;
  readonly hostname: string;
  readonly action: string;
  readonly challengeAtMs: number;
  /** Null for providers without a score. */
  readonly score: number | null;
}

export interface CaptchaVerifier {
  /** Verify the token with the provider; never accept client-supplied success. */
  verify(token: string, signal: AbortSignal): Promise<unknown>;
}

export interface RequiredCaptchaIntent {
  readonly verifier: CaptchaVerifier;
  readonly token: string;
  readonly expectedHostname: string;
  readonly expectedAction: string;
  /** Defaults to the server clock and is called after provider verification. */
  readonly now?: () => number;
  readonly maxAgeMs: number;
  readonly minimumScore: number | null;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
}

/** An absent provider needs no CAPTCHA setup; a present one is mandatory. */
export interface CaptchaProviderConfiguration {
  readonly verifier: CaptchaVerifier;
  readonly expectedHostname: string;
  readonly maxAgeMs: number;
  readonly minimumScore: number | null;
  readonly timeoutMs: number;
  readonly now?: () => number;
}

export interface CaptchaChallengeIntent {
  readonly token?: string | null;
  readonly expectedAction: string;
  readonly signal: AbortSignal;
}

export interface CaptchaGate {
  readonly enabled: boolean;
  require(intent: CaptchaChallengeIntent): Promise<void>;
}

function validHostname(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 253 &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(value) &&
    value
      .split('.')
      .every(
        (part) =>
          part.length <= 63 && !part.startsWith('-') && !part.endsWith('-'),
      )
  );
}

function validScore(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1)
  );
}

/** Construct once in the composition root, then share the gate with routes. */
export function createCaptchaGate(
  configuration?: CaptchaProviderConfiguration | null,
): CaptchaGate {
  if (configuration == null)
    return Object.freeze({
      enabled: false,
      require: async (intent: CaptchaChallengeIntent) => {
        if (!intent?.signal || intent.signal.aborted !== false)
          throw new RequestFailure('CAPTCHA_UNAVAILABLE');
      },
    });
  let verify: CaptchaVerifier['verify'];
  try {
    verify = configuration.verifier.verify.bind(configuration.verifier);
  } catch {
    throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  }
  const expectedHostname = configuration.expectedHostname;
  const maxAgeMs = configuration.maxAgeMs;
  const minimumScore = configuration.minimumScore;
  const timeoutMs = configuration.timeoutMs;
  const now = configuration.now ?? Date.now;
  if (
    !validHostname(expectedHostname) ||
    !Number.isSafeInteger(maxAgeMs) ||
    maxAgeMs < 1000 ||
    maxAgeMs > 300000 ||
    !validScore(minimumScore) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 10 ||
    timeoutMs > 5000 ||
    typeof now !== 'function' ||
    typeof verify !== 'function'
  )
    throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  const verifier = Object.freeze({ verify });
  return Object.freeze({
    enabled: true,
    require: (intent: CaptchaChallengeIntent) =>
      requireRequiredCaptcha({
        verifier,
        token: intent?.token ?? '',
        expectedHostname,
        expectedAction: intent?.expectedAction,
        maxAgeMs,
        minimumScore,
        timeoutMs,
        now,
        signal: intent?.signal,
      }),
  });
}

/** Deny every required challenge that is invalid, unavailable or stale. */
export async function requireRequiredCaptcha(
  intent: RequiredCaptchaIntent,
): Promise<void> {
  const signal = intent?.signal;
  if (!signal || signal.aborted !== false)
    throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  const token = intent.token;
  if (
    typeof token !== 'string' ||
    token.length < 1 ||
    token.length > 4096 ||
    !/^[\x21-\x7e]+$/.test(token)
  )
    throw new RequestFailure('CAPTCHA_DENIED');
  const expectedHostname = intent.expectedHostname;
  const expectedAction = intent.expectedAction;
  const now = intent.now ?? Date.now;
  const maxAgeMs = intent.maxAgeMs;
  const minimumScore = intent.minimumScore;
  const timeoutMs = intent.timeoutMs;
  const verifier = intent.verifier;
  const verify = verifier?.verify;
  if (
    !validHostname(expectedHostname) ||
    typeof expectedAction !== 'string' ||
    !/^[a-z][a-z0-9:_-]{0,63}$/.test(expectedAction) ||
    typeof now !== 'function' ||
    !Number.isSafeInteger(maxAgeMs) ||
    maxAgeMs < 1000 ||
    maxAgeMs > 300000 ||
    !validScore(minimumScore) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 10 ||
    timeoutMs > 5000 ||
    typeof verify !== 'function'
  )
    throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  let evidence: unknown;
  try {
    evidence = await withDeadline(signal, timeoutMs, (boundSignal) =>
      verify.call(verifier, token, boundSignal),
    );
  } catch {
    throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  }
  if (signal.aborted) throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  try {
    const nowMs = now();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0)
      throw new RequestFailure('CAPTCHA_UNAVAILABLE');
    if (
      evidence === null ||
      typeof evidence !== 'object' ||
      Array.isArray(evidence)
    )
      throw new RequestFailure('CAPTCHA_UNAVAILABLE');
    const { success, hostname, action, challengeAtMs, score } =
      evidence as Partial<CaptchaEvidence>;
    if (success === false) throw new RequestFailure('CAPTCHA_DENIED');
    if (
      success !== true ||
      !validHostname(hostname) ||
      typeof action !== 'string' ||
      typeof challengeAtMs !== 'number' ||
      !Number.isSafeInteger(challengeAtMs) ||
      challengeAtMs < 0 ||
      !validScore(score)
    )
      throw new RequestFailure('CAPTCHA_UNAVAILABLE');
    if (minimumScore !== null && score === null)
      throw new RequestFailure('CAPTCHA_UNAVAILABLE');
    if (
      hostname !== expectedHostname ||
      action !== expectedAction ||
      challengeAtMs > nowMs ||
      nowMs - challengeAtMs > maxAgeMs ||
      (minimumScore !== null && score! < minimumScore)
    )
      throw new RequestFailure('CAPTCHA_DENIED');
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('CAPTCHA_UNAVAILABLE');
  }
}
