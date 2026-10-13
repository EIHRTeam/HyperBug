import type {
  OutboundLimits,
  OutboundRequest,
  OutboundResult,
} from '@hyperbug/security';
import {
  createCaptchaGate,
  type CaptchaGate,
  type CaptchaVerifier,
} from './captcha.ts';

export interface OptionalTurnstileBindings {
  readonly secret?: unknown;
  readonly siteKey?: unknown;
  readonly hostname?: unknown;
  readonly environment: 'local' | 'staging' | 'production';
}

export interface TurnstileSelection {
  readonly gate: CaptchaGate;
  readonly siteKey: string | null;
}

// Cloudflare publishes these credentials for predictable tests. They cannot
// establish real challenge verification in staging or production.
const testSiteKeys = new Set([
  '1x00000000000000000000AA',
  '1x00000000000000000000BB',
  '2x00000000000000000000AB',
  '2x00000000000000000000BB',
  '3x00000000000000000000FF',
]);
const testSecrets = new Set([
  '1x0000000000000000000000000000000AA',
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

/** Only complete provider presence enables CAPTCHA; partial setup stops startup. */
export function configureOptionalTurnstile(
  bindings: OptionalTurnstileBindings,
  makeVerifier: (secret: string) => CaptchaVerifier,
): TurnstileSelection {
  const { secret, siteKey, hostname, environment } = bindings;
  if (
    environment !== 'local' &&
    environment !== 'staging' &&
    environment !== 'production'
  )
    throw new Error('Invalid Turnstile provider configuration');
  if (secret === undefined && siteKey === undefined && hostname === undefined)
    return Object.freeze({ gate: createCaptchaGate(), siteKey: null });
  if (
    typeof secret !== 'string' ||
    typeof siteKey !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,512}$/.test(siteKey) ||
    typeof hostname !== 'string' ||
    (environment !== 'local' &&
      (testSiteKeys.has(siteKey) || testSecrets.has(secret))) ||
    (environment !== 'local' &&
      (!hostname.includes('.') ||
        /^(?:\d+\.)+\d+$/.test(hostname) ||
        /\.(?:localhost|local|internal|invalid)$/.test(hostname))) ||
    typeof makeVerifier !== 'function'
  )
    throw new Error('Invalid Turnstile provider configuration');
  try {
    const gate = createCaptchaGate({
      verifier: makeVerifier(secret),
      expectedHostname: hostname,
      maxAgeMs: 300000,
      minimumScore: null,
      timeoutMs: 4000,
    });
    return Object.freeze({ gate, siteKey });
  } catch {
    throw new Error('Invalid Turnstile provider configuration');
  }
}

/** Exact Siteverify operation; secrets and tokens are never URL parameters. */
export const turnstileOutboundLimits = {
  destinations: [
    {
      id: 'turnstile',
      origin: 'https://challenges.cloudflare.com',
      operations: [{ method: 'POST', path: '/turnstile/v0/siteverify' }],
    },
  ],
  maxConcurrent: 8,
  timeoutMs: 3000,
  maxRequestBytes: 16384,
  maxResponseBytes: 8192,
} as const satisfies OutboundLimits;

export type TurnstileOutbound = (
  request: OutboundRequest,
) => Promise<OutboundResult>;

/** Build only when a backend-only provider secret has been configured. */
export function createTurnstileVerifier(
  secret: string,
  outbound: TurnstileOutbound,
): CaptchaVerifier {
  if (
    typeof secret !== 'string' ||
    secret.length < 1 ||
    secret.length > 2048 ||
    !/^[\x21-\x7e]+$/.test(secret) ||
    typeof outbound !== 'function'
  )
    throw new Error('Invalid Turnstile provider configuration');
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', {
    fatal: true,
    ignoreBOM: false,
  });
  return Object.freeze({
    async verify(token: string, signal: AbortSignal): Promise<unknown> {
      if (
        typeof token !== 'string' ||
        token.length < 1 ||
        token.length > 2048 ||
        !/^[\x21-\x7e]+$/.test(token)
      )
        return { success: false };
      const body = encoder.encode(
        new URLSearchParams({ secret, response: token }).toString(),
      );
      const result = await outbound({
        destination: 'turnstile',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal,
      });
      if (
        result.status !== 200 ||
        !(result.body instanceof Uint8Array) ||
        result.body.byteLength > turnstileOutboundLimits.maxResponseBytes ||
        !/^application\/json(?:\s*;|$)/i.test(result.contentType ?? '')
      )
        throw new Error('Turnstile response unavailable');
      const payload: unknown = JSON.parse(decoder.decode(result.body));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Turnstile response unavailable');
      const response = payload as Record<string, unknown>;
      const codes = response['error-codes'];
      if (response.success === false) {
        if (
          Array.isArray(codes) &&
          codes.length > 0 &&
          codes.every(
            (code) =>
              code === 'missing-input-response' ||
              code === 'invalid-input-response' ||
              code === 'timeout-or-duplicate',
          )
        )
          return { success: false };
        throw new Error('Turnstile response unavailable');
      }
      if (response.success !== true)
        throw new Error('Turnstile response unavailable');
      if (codes !== undefined && (!Array.isArray(codes) || codes.length > 0))
        throw new Error('Turnstile response unavailable');
      const timestamp = response.challenge_ts;
      const challengeAtMs =
        typeof timestamp === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(timestamp)
          ? Date.parse(timestamp)
          : NaN;
      return {
        success: true,
        hostname: response.hostname,
        action: response.action,
        challengeAtMs,
        score: null,
      };
    },
  });
}
