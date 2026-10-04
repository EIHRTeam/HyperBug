import type {
  Assurance,
  AuthMethod,
  OAuthAccessTokenStore,
} from '@hyperbug/application';
import { verifyCredential, type KeyProvider } from '@hyperbug/security';
import { withDeadline } from './bounds.ts';
import { RequestFailure } from './errors.ts';
import { accessTokenPattern, tokenContext } from './oauth.ts';

/**
 * The principal an `at_` access token was issued to. Every field comes from
 * the authoritative token row, never from client claims.
 */
export interface BearerPrincipal {
  readonly principalId: string;
  readonly identityId: string;
  readonly clientId: string;
  readonly scope: string;
  /** Ceremony bound to this token when it was issued; never account-wide. */
  readonly authMethod: AuthMethod;
  readonly authenticatedAtMs: number;
  readonly assurance: Assurance;
}

/** The token pattern's own anchors make a plain concatenation unmatchable. */
const bearerPattern = new RegExp(
  `^Bearer ${accessTokenPattern.source.replace(/^\^/, '').replace(/\$$/, '')}$`,
);

/**
 * Bearer-only authentication for business APIs: the presented opaque token
 * locates its row in the authoritative store, and the secret is verified
 * against the stored keyed digest under the same context that issued it.
 * A missing, malformed, unknown, revoked, expired or mismatched credential
 * returns null so the route can answer one generic 401; only dependency
 * failures throw closed.
 */
export async function authenticateBearer(
  request: Request,
  options: {
    readonly keyProvider: KeyProvider | null;
    readonly tokenStore: OAuthAccessTokenStore | null;
  },
): Promise<BearerPrincipal | null> {
  const header = request.headers.get('authorization');
  if (header === null) return null;
  const presented = header.match(bearerPattern);
  if (!presented) return null;
  const { keyProvider, tokenStore } = options;
  if (!keyProvider || !tokenStore)
    throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
  const nowMs = Date.now();
  try {
    const record = await withDeadline(request.signal, 1000, () =>
      tokenStore.loadActive(presented[1]!, nowMs),
    );
    if (!record) return null;
    const valid = await withDeadline(request.signal, 1000, () =>
      verifyCredential(
        keyProvider,
        presented[2]!,
        JSON.parse(record.digest),
        tokenContext(presented[1]!),
      ),
    );
    if (!valid) return null;
    return Object.freeze({
      principalId: record.principalId,
      identityId: record.identityId,
      clientId: record.clientId,
      scope: record.scope,
      authMethod: record.authMethod,
      authenticatedAtMs: record.authenticatedAtMs,
      assurance: record.assurance,
    });
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
    throw new RequestFailure('AUTHENTICATION_UNAVAILABLE');
  }
}
