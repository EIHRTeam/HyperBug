import {
  ApiClientError,
  createApiClient,
  type Operation,
  type OperationTypes,
  type RequestInput,
} from '@hyperbug/api-client';
import type { QueryClient } from '@tanstack/react-query';
import type { RuntimeConfig } from './runtime-config.ts';

// Register this public client and the exact /oauth/callback URI on the backend.
export const publicClientId = 'hyperbug-web';
export const redirectAttemptKey = 'hyperbug.pkce.v1';
const attemptLifetime = 5 * 60 * 1000;
const callbackPath = '/oauth/callback';
const returnPaths = new Set(['/', '/instance', '/account']);
type Account = OperationTypes['GET /api/v1/account']['response'];
export interface AuthSnapshot {
  readonly epoch: number;
  readonly account: Account | null;
  readonly notice: string;
  readonly pending: boolean;
}
interface RedirectAttempt {
  state: string;
  verifier: string;
  createdAt: number;
  returnTo: string;
  origin: string;
  apiOrigin: string;
  authOrigin: string;
}

export function safeReturnRoute(value: string): string {
  if (value.length > 512) return '/account';
  const url = new URL(value, location.origin);
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    url.origin !== location.origin ||
    !returnPaths.has(url.pathname) ||
    url.hash ||
    (url.search && url.pathname !== '/instance')
  )
    return '/account';
  if (url.pathname === '/instance') {
    const section = url.searchParams.get('section');
    return section === 'limits'
      ? '/instance?section=limits'
      : '/instance?section=capabilities';
  }
  return url.pathname;
}

/** Capture once, then remove even invalid/error callbacks before any fetch. */
export function takeCallback(): URLSearchParams | null {
  if (location.pathname !== callbackPath) {
    // Abandoned attempts are never used outside the callback.
    try {
      sessionStorage.removeItem(redirectAttemptKey);
    } catch {
      /* Browsing public pages does not require storage. */
    }
    return null;
  }
  const parameters = new URLSearchParams(location.search);
  history.replaceState(null, '', callbackPath);
  return parameters;
}

function randomValue() {
  return btoa(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function consumeAttempt(config: RuntimeConfig, parameters: URLSearchParams) {
  const stored = sessionStorage.getItem(redirectAttemptKey);
  sessionStorage.removeItem(redirectAttemptKey);
  if (!stored || stored.length > 4096) throw new Error('INVALID_CALLBACK');
  const attempt = JSON.parse(stored) as RedirectAttempt;
  const keys = [
    'state',
    'verifier',
    'createdAt',
    'returnTo',
    'origin',
    'apiOrigin',
    'authOrigin',
  ];
  if (
    Object.keys(attempt).length !== keys.length ||
    Object.keys(attempt).some((key) => !keys.includes(key)) ||
    !/^[A-Za-z0-9_-]{43}$/.test(attempt.state) ||
    !/^[A-Za-z0-9_-]{43}$/.test(attempt.verifier) ||
    !Number.isFinite(attempt.createdAt) ||
    Date.now() < attempt.createdAt ||
    Date.now() - attempt.createdAt > attemptLifetime ||
    attempt.origin !== location.origin ||
    attempt.apiOrigin !== config.apiBaseUrl ||
    attempt.authOrigin !== config.authBaseUrl ||
    typeof attempt.returnTo !== 'string' ||
    safeReturnRoute(attempt.returnTo) !== attempt.returnTo ||
    parameters.getAll('state').length !== 1 ||
    parameters.get('state') !== attempt.state ||
    [...parameters.keys()].some(
      (key) => !['code', 'state', 'error', 'error_description'].includes(key),
    ) ||
    parameters.has('error') ||
    parameters.getAll('code').length !== 1 ||
    !/^[A-Za-z0-9_.-]{1,256}$/.test(parameters.get('code') ?? '')
  )
    throw new Error('INVALID_CALLBACK');
  return attempt;
}

/** Credentials never enter snapshots, React, Query, URLs, logs or storage. */
export class BrowserAuth {
  #token: string | null = null;
  #expiresAt = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #listeners = new Set<() => void>();
  #requests = new Set<AbortController>();
  #snapshot: AuthSnapshot = {
    epoch: 0,
    account: null,
    notice: '',
    pending: false,
  };
  #client;
  #authClient;
  #channel: BroadcastChannel | undefined;
  readonly config: RuntimeConfig;
  private readonly queries: QueryClient;

  constructor(config: RuntimeConfig, queries: QueryClient) {
    this.config = config;
    this.queries = queries;
    this.#client = createApiClient({
      baseUrl: config.apiBaseUrl,
      getToken: () => this.#readToken(),
      maxRetries: 0,
    });
    this.#authClient = createApiClient({
      baseUrl: config.authBaseUrl,
      maxRetries: 0,
      maxResponseBytes: 16384,
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.#readToken();
    });
    window.addEventListener('pageshow', (event) => {
      if (event.persisted)
        this.#invalidate(
          'Your session needs to be checked. Sign in to continue.',
        );
    });
    if (typeof BroadcastChannel !== 'undefined') {
      this.#channel = new BroadcastChannel(
        `hyperbug.auth:${config.apiBaseUrl}`,
      );
      this.#channel.onmessage = (event) => {
        if (event.data === 'signed-out')
          this.#invalidate('Signed out in another tab.');
      };
    }
  }
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  getSnapshot = () => this.#snapshot;

  #publish(change: Partial<AuthSnapshot>) {
    this.#snapshot = Object.freeze({ ...this.#snapshot, ...change });
    for (const listener of this.#listeners) listener();
  }
  #invalidate(notice: string) {
    this.#token = null;
    this.#expiresAt = 0;
    clearTimeout(this.#timer);
    for (const request of this.#requests) request.abort();
    // Cancellation starts synchronously; clearing removes private queries AND mutations.
    const instanceKey = ['instance', this.config.apiBaseUrl];
    const instance = this.queries.getQueryData(instanceKey);
    void this.queries.cancelQueries();
    this.queries.clear();
    if (instance) this.queries.setQueryData(instanceKey, instance);
    this.#publish({
      epoch: this.#snapshot.epoch + 1,
      account: null,
      notice,
      pending: false,
    });
  }
  #readToken() {
    if (this.#token && Date.now() >= this.#expiresAt)
      this.#invalidate(
        'Your session expired. Sign in to continue. Unsaved changes were cleared.',
      );
    return this.#token;
  }

  async signIn(returnTo = '/account') {
    this.#invalidate('');
    this.#publish({ pending: true });
    try {
      const state = randomValue(),
        verifier = randomValue();
      const digest = new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(verifier),
        ),
      );
      const challenge = btoa(String.fromCharCode(...digest))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
      const attempt: RedirectAttempt = {
        state,
        verifier,
        createdAt: Date.now(),
        returnTo: safeReturnRoute(returnTo),
        origin: location.origin,
        apiOrigin: this.config.apiBaseUrl,
        authOrigin: this.config.authBaseUrl,
      };
      sessionStorage.setItem(redirectAttemptKey, JSON.stringify(attempt));
      const url = new URL('/auth/authorize', this.config.authBaseUrl);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: publicClientId,
        redirect_uri: location.origin + callbackPath,
        scope: 'public-api',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();
      location.assign(url.href);
    } catch {
      sessionStorage.removeItem(redirectAttemptKey);
      this.#publish({
        pending: false,
        notice: 'Sign-in could not start. Check browser storage and try again.',
      });
    }
  }

  async completeCallback(parameters: URLSearchParams) {
    this.#invalidate('');
    try {
      const attempt = consumeAttempt(this.config, parameters);
      const token = await this.#authClient.request('POST /auth/token', {
        body: {
          grant_type: 'authorization_code',
          client_id: publicClientId,
          redirect_uri: location.origin + callbackPath,
          code: parameters.get('code')!,
          code_verifier: attempt.verifier,
        },
      });
      if (
        token.tokenType !== 'Bearer' ||
        !/^at_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token.accessToken) ||
        !Number.isInteger(token.expiresIn) ||
        token.expiresIn < 1 ||
        token.expiresIn > 900 ||
        token.scope !== 'public-api'
      )
        throw new Error('INVALID_TOKEN_RESPONSE');
      this.#token = token.accessToken;
      this.#expiresAt = Date.now() + token.expiresIn * 1000;
      this.#timer = setTimeout(() => this.#readToken(), token.expiresIn * 1000);
      const account = await this.request('GET /api/v1/account');
      if (
        !account.principalId ||
        !account.identityId ||
        !['user', 'staff'].includes(account.kind)
      )
        throw new Error('INVALID_ACCOUNT_RESPONSE');
      this.#publish({ account, notice: 'Signed in.' });
      history.replaceState(null, '', attempt.returnTo);
    } catch {
      this.#invalidate(
        'Sign-in could not be verified. Start a new sign-in attempt.',
      );
      history.replaceState(null, '', '/account');
    }
  }

  async request<K extends Operation>(
    operation: K,
    ...args: {} extends RequestInput<K>
      ? [input?: RequestInput<K>]
      : [input: RequestInput<K>]
  ): Promise<OperationTypes[K]['response']> {
    if (!this.#readToken())
      throw new ApiClientError(401, 'AUTHENTICATION_REQUIRED');
    const epoch = this.#snapshot.epoch;
    const controller = new AbortController();
    this.#requests.add(controller);
    const input = args[0];
    const abort = () => controller.abort();
    input?.signal?.addEventListener('abort', abort, { once: true });
    if (input?.signal?.aborted) controller.abort();
    try {
      const request = this.#client.request as (
        op: K,
        input: RequestInput<K>,
      ) => Promise<OperationTypes[K]['response']>;
      const result = await request(operation, {
        ...input,
        signal: controller.signal,
      } as RequestInput<K>);
      if (epoch !== this.#snapshot.epoch)
        throw new ApiClientError(0, 'CANCELLED');
      return result;
    } catch (error) {
      if (
        epoch === this.#snapshot.epoch &&
        error instanceof ApiClientError &&
        [401, 403].includes(error.status)
      )
        this.#invalidate(
          error.status === 401
            ? 'Your session is no longer valid. Sign in to continue. Unsaved changes were cleared.'
            : error.code === 'REAUTHENTICATION_REQUIRED'
              ? 'Sign in again to confirm access. Unsaved changes were cleared.'
              : 'Permission denied. Cached data and unsaved changes were cleared.',
        );
      throw error;
    } finally {
      input?.signal?.removeEventListener('abort', abort);
      this.#requests.delete(controller);
    }
  }

  async signOut() {
    const token = this.#readToken();
    this.#invalidate(
      'Signed out of this app. The authorization service may still have a first-party session.',
    );
    sessionStorage.removeItem(redirectAttemptKey);
    this.#channel?.postMessage('signed-out');
    if (!token) return;
    try {
      await this.#authClient.request('POST /auth/token/revoke', {
        body: { token },
      });
    } catch {
      this.#publish({
        notice:
          'Signed out locally. Server revocation could not be confirmed; the previous token expires within 15 minutes.',
      });
    }
  }
}
