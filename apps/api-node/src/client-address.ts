import { canonicalIpAddress, RateLimitFailure } from '@hyperbug/security';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Use srvx's native Node request, never client-controlled forwarding headers.
 * A reverse proxy is treated as the peer until its trust model is explicit.
 */
export function nodeSocketClientAddress(request: Request): string {
  if (!record(request) || !('runtime' in request)) throw new RateLimitFailure();
  const runtime = request.runtime;
  if (!record(runtime) || runtime.name !== 'node' || !record(runtime.node))
    throw new RateLimitFailure();
  const node = runtime.node;
  if (!record(node.req) || !record(node.req.socket))
    throw new RateLimitFailure();
  return canonicalIpAddress(node.req.socket.remoteAddress);
}
