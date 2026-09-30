import type { AccountSessionStore } from '@hyperbug/application';
import {
  digestCredential,
  generateOpaqueCredential,
  verifyCredential,
  type KeyProvider,
} from '@hyperbug/security';
import type { VerifiedAccountPassword } from './account-password.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

const cookieName = '__Host-hb_session';
const idleMs = 30 * 60 * 1000;
const absoluteMs = 7 * 24 * 60 * 60 * 1000;
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Lax';
const cookiePattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(hb1_[A-Za-z0-9_-]{43})$/;

function context(id: string) {
  return {
    resourceType: 'authorization-session',
    resourceId: id,
    field: 'cookie-secret',
    projectId: null,
    schemaVersion: 1,
  } as const;
}

function parseCookie(request: Request): { id: string; token: string } | null {
  const header = request.headers.get('cookie');
  if (!header || header.length > 4096) return null;
  let value: string | null = null;
  for (const part of header.split(';')) {
    const item = part.trim();
    if (!item.startsWith(`${cookieName}=`)) continue;
    if (value !== null) return null;
    value = item.slice(cookieName.length + 1);
  }
  const match = value?.match(cookiePattern);
  return match ? { id: match[1]!, token: match[2]! } : null;
}

/** Cookie-authenticated mutations are served only from this auth origin. */
export function requireAuthOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (
    !origin ||
    origin !== new URL(request.url).origin ||
    (fetchSite !== null && fetchSite !== 'same-origin')
  )
    throw new RequestFailure('ORIGIN_FORBIDDEN');
}

export function requireAuthReadOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (
    (origin !== null && origin !== new URL(request.url).origin) ||
    (fetchSite !== null && fetchSite !== 'same-origin' && fetchSite !== 'none')
  )
    throw new RequestFailure('ORIGIN_FORBIDDEN');
}

export function issuedSessionCookie(id: string, token: string): string {
  return `${cookieName}=${id}.${token}; Max-Age=${absoluteMs / 1000}; ${cookieAttributes}`;
}

export const clearedSessionCookie = `${cookieName}=; Max-Age=0; ${cookieAttributes}`;

/** A fresh identifier prevents login fixation; the store rechecks revision. */
export async function issueAccountSession(input: {
  readonly account: VerifiedAccountPassword;
  readonly provider: KeyProvider | null;
  readonly store: AccountSessionStore | null;
  readonly signal: AbortSignal;
  readonly nowMs: number;
}): Promise<string> {
  return issueSessionCookieFor(input);
}

/** Shared issuance for password and passkey logins; no credential is embedded. */
export async function issueSessionCookieFor(input: {
  readonly account: {
    readonly principalId: string;
    readonly identityId: string;
    readonly credentialRevision: number;
  };
  readonly provider: KeyProvider | null;
  readonly store: AccountSessionStore | null;
  readonly signal: AbortSignal;
  readonly nowMs: number;
}): Promise<string> {
  const { account, provider, store, signal, nowMs } = input;
  if (!provider || !store || signal.aborted)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  const id = crypto.randomUUID();
  const token = generateOpaqueCredential();
  try {
    const digest = await withDeadline(signal, 1000, () =>
      digestCredential(provider, token, context(id)),
    );
    const created = await withDeadline(signal, 1000, () =>
      store.createIfCurrent({
        id,
        principalId: account.principalId,
        identityId: account.identityId,
        credentialRevision: account.credentialRevision,
        digest: JSON.stringify(digest),
        nowMs,
        idleExpiresAtMs: nowMs + idleMs,
        absoluteExpiresAtMs: nowMs + absoluteMs,
      }),
    );
    if (!created || signal.aborted) throw new Error('Session not current');
    return issuedSessionCookie(id, token);
  } catch {
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  }
}

/** Primary-backed validation; revocation or credential changes deny reuse. */
export async function currentAccountSession(input: {
  readonly request: Request;
  readonly provider: KeyProvider | null;
  readonly store: AccountSessionStore | null;
  readonly nowMs: number;
}): Promise<{ principalId: string; identityId: string } | null> {
  const { request, provider, store, nowMs } = input;
  const cookie = parseCookie(request);
  if (!cookie) return null;
  if (!provider || !store || request.signal.aborted)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  try {
    const record = await withDeadline(request.signal, 1000, () =>
      store.load(cookie.id, nowMs),
    );
    if (!record) return null;
    const valid = await withDeadline(request.signal, 1000, () =>
      verifyCredential(
        provider,
        cookie.token,
        JSON.parse(record.digest),
        context(cookie.id),
      ),
    );
    if (!valid) return null;
    const touched = await withDeadline(request.signal, 1000, () =>
      store.touch({
        id: cookie.id,
        digest: record.digest,
        nowMs,
        idleExpiresAtMs: Math.min(record.absoluteExpiresAtMs, nowMs + idleMs),
      }),
    );
    if (!touched || request.signal.aborted)
      throw new Error('Session changed during validation');
    return { principalId: record.principalId, identityId: record.identityId };
  } catch {
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  }
}

export async function revokeAccountSession(input: {
  readonly request: Request;
  readonly provider: KeyProvider | null;
  readonly store: AccountSessionStore | null;
  readonly nowMs: number;
}): Promise<void> {
  const { request, provider, store, nowMs } = input;
  const cookie = parseCookie(request);
  if (!cookie) return;
  if (!provider || !store || request.signal.aborted)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  try {
    const record = await withDeadline(request.signal, 1000, () =>
      store.load(cookie.id, nowMs),
    );
    if (!record) return;
    const valid = await withDeadline(request.signal, 1000, () =>
      verifyCredential(
        provider,
        cookie.token,
        JSON.parse(record.digest),
        context(cookie.id),
      ),
    );
    if (!valid) return;
    const revoked = await withDeadline(request.signal, 1000, () =>
      store.revoke(cookie.id, record.digest, nowMs),
    );
    if (!revoked || request.signal.aborted)
      throw new Error('Session changed during revocation');
  } catch {
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  }
}
