import type {
  AccountSessionStore,
  OAuthAccessTokenStore,
  OAuthCodeStore,
} from '@hyperbug/application';
import type { AuthorizeRequest, TokenResponse } from '@hyperbug/contracts';
import {
  digestCredential,
  generateOpaqueCredential,
  verifyCredential,
  type KeyProvider,
  type SecretContext,
} from '@hyperbug/security';
import { currentAccountSession, requireAuthOrigin } from './account-session.ts';
import type { BoundSensitiveActionAdmission } from './sensitive-admission.ts';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';

/** A registered OAuth public client; no secret can ever be issued for it. */
export interface OAuthClientRegistration {
  readonly clientId: string;
  readonly redirectUris: readonly string[];
  readonly scopes: readonly string[];
}

const registrationLimit = 16;
const clientIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const scopeTokenPattern = /^[A-Za-z0-9_.:-]{1,64}$/;
const verifierPattern = /^[A-Za-z0-9\-._~]{43,128}$/;
const codePattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(hb1_[A-Za-z0-9_-]{43})$/;
const accessTokenPattern =
  /^at_([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(hb1_[A-Za-z0-9_-]{43})$/;
const codeLifetimeMs = 60_000;
const tokenLifetimeMs = 600_000;
const accountRule = Object.freeze({
  limit: 5,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});
const ipRule = Object.freeze({
  limit: 20,
  windowMs: 3_600_000,
  retentionMs: 86_400_000,
});

function configurationFailure(): never {
  throw new Error('Invalid OAuth client configuration');
}

function parseRedirectUri(value: string): boolean {
  if (value.length < 1 || value.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash !== '') return false;
  if (url.protocol === 'https:') return true;
  // Loopback http is a local/test exception; every other scheme is rejected.
  return (
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  );
}

function parseClientEntry(value: unknown): OAuthClientRegistration {
  if (!value || typeof value !== 'object') configurationFailure();
  const keys = Object.keys(value).sort();
  if (keys.join(',') !== 'clientId,redirectUris,scopes') configurationFailure();
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.clientId !== 'string' ||
    !clientIdPattern.test(entry.clientId) ||
    !Array.isArray(entry.redirectUris) ||
    entry.redirectUris.length < 1 ||
    entry.redirectUris.length > 16 ||
    entry.redirectUris.some(
      (uri) => typeof uri !== 'string' || !parseRedirectUri(uri),
    ) ||
    !Array.isArray(entry.scopes) ||
    entry.scopes.length < 1 ||
    entry.scopes.length > 16 ||
    entry.scopes.some(
      (scope) =>
        typeof scope !== 'string' || !scopeTokenPattern.test(scope as string),
    )
  )
    configurationFailure();
  return Object.freeze({
    clientId: entry.clientId,
    redirectUris: Object.freeze([...(entry.redirectUris as string[])]),
    scopes: Object.freeze([...(entry.scopes as string[])]),
  });
}

/**
 * Deployment-supplied public-client registry. Undefined disarms the flow;
 * any present value must parse strictly or composition refuses startup.
 */
export function parseOAuthClients(
  value: unknown,
): readonly OAuthClientRegistration[] {
  if (value === undefined) return [];
  if (typeof value !== 'string' || value.length < 1 || value.length > 65536)
    configurationFailure();
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    configurationFailure();
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length < 0 ||
    parsed.length > registrationLimit
  )
    configurationFailure();
  return Object.freeze(parsed.map((entry) => parseClientEntry(entry)));
}

function scopeTokens(scope: string): readonly string[] {
  return [...new Set(scope.split(' '))];
}

/** Exact client, exact redirect URI and scope containment; nothing else. */
export function validateAuthorizeQuery(
  clients: readonly OAuthClientRegistration[],
  query: AuthorizeRequest,
): void {
  return authorizedClient(clients, query);
}

function authorizedClient(
  clients: readonly OAuthClientRegistration[],
  query: AuthorizeRequest,
): void {
  const client = clients.find(
    (candidate) => candidate.clientId === query.clientId,
  );
  if (!client) throw new RequestFailure('OAUTH_DENIED');
  if (!client.redirectUris.includes(query.redirectUri))
    throw new RequestFailure('OAUTH_DENIED');
  const allowed = new Set(client.scopes);
  for (const token of scopeTokens(query.scope))
    if (!allowed.has(token)) throw new RequestFailure('OAUTH_DENIED');
}

function codeContext(id: string): SecretContext {
  return {
    resourceType: 'oauth-code',
    resourceId: id,
    field: 'code-secret',
    projectId: null,
    schemaVersion: 1,
  } as const;
}

function tokenContext(id: string): SecretContext {
  return {
    resourceType: 'oauth-access-token',
    resourceId: id,
    field: 'token-secret',
    projectId: null,
    schemaVersion: 1,
  } as const;
}

function formString(
  body: Record<string, unknown>,
  field: string,
  maximum: number,
): string | null {
  const value = body[field];
  return typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maximum
    ? value
    : null;
}

/** Hash both sides first so the byte comparison cannot leak length position. */
async function constantTimeEquals(
  presented: string,
  stored: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(presented)),
    crypto.subtle.digest('SHA-256', encoder.encode(stored)),
  ]);
  let difference = 0;
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  for (let index = 0; index < left.length; index += 1)
    difference |= left[index]! ^ right[index]!;
  return difference === 0;
}

async function s256Challenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
  );
  return btoa(String.fromCharCode(...digest))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/**
 * Session-authenticated authorization-code issuance behind PKCE S256. The
 * registry is matched exactly (client id, redirect URI, scope containment);
 * S256 is the only supported challenge method, enforced by the request
 * schema upstream. The code lives for 60 seconds and one redemption.
 */
export async function issueAuthorizationCode(input: {
  readonly request: Request;
  readonly query: AuthorizeRequest;
  readonly admission?: Pick<BoundSensitiveActionAdmission, 'require'> | null;
  readonly keyProvider: KeyProvider | null;
  readonly sessionStore: AccountSessionStore | null;
  readonly codeStore: OAuthCodeStore | null;
  readonly clients: readonly OAuthClientRegistration[] | null;
  readonly nowMs: number;
}): Promise<{ redirectUri: string }> {
  const {
    request,
    query,
    keyProvider,
    sessionStore,
    codeStore,
    clients,
    nowMs,
  } = input;
  requireAuthOrigin(request);
  if (!keyProvider || !sessionStore || !codeStore)
    throw new RequestFailure('OAUTH_UNAVAILABLE');
  const session = await currentAccountSession({
    request,
    provider: keyProvider,
    store: sessionStore,
    nowMs,
  });
  if (!session) throw new RequestFailure('LOGIN_DENIED');
  return issueCodeForSession({
    query,
    keyProvider,
    codeStore,
    clients,
    nowMs,
    principalId: session.principalId,
    identityId: session.identityId,
    signal: input.request.signal,
  });
}

/** Code issuance for a session the caller just authenticated itself. */
export async function issueCodeForSession(input: {
  readonly query: AuthorizeRequest;
  readonly keyProvider: KeyProvider;
  readonly codeStore: OAuthCodeStore | null;
  readonly clients: readonly OAuthClientRegistration[] | null;
  readonly nowMs: number;
  readonly principalId: string;
  readonly identityId: string;
  readonly signal: AbortSignal;
}): Promise<{ redirectUri: string }> {
  const { query, keyProvider, codeStore, clients, nowMs, signal } = input;
  if (!codeStore) throw new RequestFailure('OAUTH_UNAVAILABLE');
  authorizedClient(clients ?? [], query);
  const id = crypto.randomUUID();
  const secret = generateOpaqueCredential();
  try {
    const digest = await withDeadline(signal, 1000, () =>
      digestCredential(keyProvider, secret, codeContext(id)),
    );
    if (signal?.aborted) throw new Error('Aborted');
    await withDeadline(signal, 1000, () =>
      codeStore.insert({
        id,
        digest: JSON.stringify(digest),
        clientId: query.clientId,
        redirectUri: query.redirectUri,
        scope: query.scope,
        codeChallenge: query.codeChallenge,
        principalId: input.principalId,
        identityId: input.identityId,
        nowMs,
        expiresAtMs: nowMs + codeLifetimeMs,
      }),
    );
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('OAUTH_UNAVAILABLE');
  }
  const parameters = new URLSearchParams({
    code: `${id}.${secret}`,
    state: query.state,
  });
  return {
    redirectUri: `${query.redirectUri}${query.redirectUri.includes('?') ? '&' : '?'}${parameters.toString()}`,
  };
}

/**
 * The public token endpoint: one redemption per code, PKCE verification and
 * exact client/redirect binding, then a fresh opaque bearer access token.
 * Every denial is the same generic envelope so nothing about stored codes,
 * clients or verifiers is disclosed; consuming before verifying means a
 * wrong verifier burns the code.
 */
export async function exchangeAuthorizationCode(input: {
  readonly request: Request;
  readonly body: Record<string, unknown>;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly keyProvider: KeyProvider | null;
  readonly codeStore: OAuthCodeStore | null;
  readonly tokenStore: OAuthAccessTokenStore | null;
  readonly requestId?: string | null;
}): Promise<TokenResponse> {
  const { request, body, admission, keyProvider, codeStore, tokenStore } =
    input;
  if (!body || typeof body !== 'object')
    throw new RequestFailure('OAUTH_DENIED');
  const grantType = formString(body, 'grant_type', 32);
  const clientId = formString(body, 'client_id', 128);
  const redirectUri = formString(body, 'redirect_uri', 2048);
  const code = formString(body, 'code', 256);
  const verifier = formString(body, 'code_verifier', 128);
  if (
    grantType !== 'authorization_code' ||
    !clientId ||
    !clientIdPattern.test(clientId) ||
    !redirectUri ||
    !code ||
    !verifier ||
    !verifierPattern.test(verifier)
  )
    throw new RequestFailure('OAUTH_DENIED');
  if (!keyProvider || !codeStore || !tokenStore)
    throw new RequestFailure('OAUTH_UNAVAILABLE');
  const nowMs = Date.now();
  await admission.require({
    request,
    category: 'login',
    checks: [
      { dimension: 'account', canonicalSubject: clientId, rule: accountRule },
      { dimension: 'ip', rule: ipRule },
    ],
    nowMs,
    signal: request.signal,
    timeoutMs: 1000,
    captchaAction: 'login',
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
  });
  const presented = code.match(codePattern);
  if (!presented) throw new RequestFailure('OAUTH_DENIED');
  const consumed = await withDeadline(request.signal, 1000, () =>
    codeStore.consume(presented[1]!, nowMs),
  );
  if (!consumed) throw new RequestFailure('OAUTH_DENIED');
  const challenge = await s256Challenge(verifier);
  if (
    !(await constantTimeEquals(challenge, consumed.codeChallenge)) ||
    request.signal.aborted
  )
    throw new RequestFailure('OAUTH_DENIED');
  if (consumed.clientId !== clientId || consumed.redirectUri !== redirectUri)
    throw new RequestFailure('OAUTH_DENIED');
  const id = crypto.randomUUID();
  const secret = generateOpaqueCredential();
  try {
    const digest = await withDeadline(request.signal, 1000, () =>
      digestCredential(keyProvider, secret, tokenContext(id)),
    );
    if (request.signal.aborted) throw new Error('Aborted');
    await withDeadline(request.signal, 1000, () =>
      tokenStore.insertAccessToken({
        id,
        digest: JSON.stringify(digest),
        principalId: consumed.principalId,
        identityId: consumed.identityId,
        clientId,
        scope: consumed.scope,
        nowMs,
        expiresAtMs: nowMs + tokenLifetimeMs,
      }),
    );
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('OAUTH_UNAVAILABLE');
  }
  return {
    tokenType: 'Bearer',
    accessToken: `at_${id}.${secret}`,
    expiresIn: tokenLifetimeMs / 1000,
    scope: consumed.scope,
  };
}

/**
 * API-only logout for a presented bearer token (RFC 7009 shape). Unknown,
 * malformed, already-revoked or mismatched tokens still answer 204 so the
 * endpoint reveals nothing; only dependency failures fail closed.
 */
export async function revokeAccessToken(input: {
  readonly request: Request;
  readonly body: Record<string, unknown>;
  readonly admission: Pick<BoundSensitiveActionAdmission, 'require'>;
  readonly keyProvider: KeyProvider | null;
  readonly store: OAuthAccessTokenStore | null;
  readonly requestId?: string | null;
}): Promise<void> {
  const { request, body, admission, keyProvider, store } = input;
  if (!body || typeof body !== 'object') return;
  const presented = formString(body, 'token', 256);
  if (!presented) return;
  if (!keyProvider || !store) throw new RequestFailure('OAUTH_UNAVAILABLE');
  const match = presented.match(accessTokenPattern);
  if (!match) return;
  const nowMs = Date.now();
  await admission.require({
    request,
    category: 'login',
    checks: [
      // The account bucket is keyed by the presented token id; the shared IP
      // bucket is the effective bound for this enumeration-resistant route.
      { dimension: 'account', canonicalSubject: match[1]!, rule: accountRule },
      { dimension: 'ip', rule: ipRule },
    ],
    nowMs,
    signal: request.signal,
    timeoutMs: 1000,
    captchaAction: 'login',
    ...(input.requestId === undefined || input.requestId === null
      ? {}
      : { requestId: input.requestId }),
  });
  try {
    const record = await withDeadline(request.signal, 1000, () =>
      store.loadActive(match[1]!, nowMs),
    );
    if (!record) return;
    const valid = await withDeadline(request.signal, 1000, () =>
      verifyCredential(
        keyProvider,
        match[2]!,
        JSON.parse(record.digest),
        tokenContext(match[1]!),
      ),
    );
    if (!valid) return;
    await withDeadline(request.signal, 1000, () =>
      store.revoke(match[1]!, nowMs),
    );
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('OAUTH_UNAVAILABLE');
  }
}
