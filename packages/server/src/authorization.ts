import {
  authorize,
  type AuthorizationPolicy,
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
      { signal, ...(intent.now ? { now: intent.now } : {}) },
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
