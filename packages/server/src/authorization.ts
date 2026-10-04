import {
  authorize,
  type AuthorizationPolicy,
  type CredentialFacts,
  type AuthorizationResolver,
  type PermissionRequest,
} from '@hyperbug/security';
import { RequestFailure } from './errors.ts';

export interface AuthorizationIntent {
  readonly request: PermissionRequest;
  readonly resolver: AuthorizationResolver;
  readonly policy: AuthorizationPolicy;
  readonly signal: AbortSignal;
  readonly now?: () => number;
  /**
   * Ceremony facts of the credential that authenticated this request. A
   * verified bearer principal supplies them; omitted means anonymous.
   */
  readonly credential?: CredentialFacts | null;
}

/**
 * The presented credential's ceremony facts, or null for anonymous callers.
 * Routes pass this so assurance binds to the token, not the account.
 */
export function credentialFactsOf(
  principal: { authenticatedAtMs: number; assurance: 1 | 2 } | null,
): CredentialFacts | null {
  return principal === null
    ? null
    : {
        authenticatedAtMs: principal.authenticatedAtMs,
        assurance: principal.assurance,
      };
}

/** Resolve current server-side facts and stop the protected route on every denial. */
export async function requireAuthorizedAction(
  intent: AuthorizationIntent,
): Promise<void> {
  const signal = intent.signal;
  if (!signal || signal.aborted !== false)
    throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
  try {
    const decision = await authorize(
      intent.request,
      intent.resolver,
      intent.policy,
      {
        signal,
        credential: intent.credential ?? null,
        ...(intent.now ? { now: intent.now } : {}),
      },
    );
    if (signal.aborted) throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
    if (decision.allowed === true) return;
    if (decision.reason === 'forbidden') throw new RequestFailure('FORBIDDEN');
    if (decision.reason === 'reauthentication_required')
      throw new RequestFailure('REAUTHENTICATION_REQUIRED');
  } catch (error) {
    if (error instanceof RequestFailure) throw error;
  }
  throw new RequestFailure('AUTHORIZATION_UNAVAILABLE');
}
