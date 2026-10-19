import { RequestFailure } from './errors.ts';

const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const allowedHeaders = [
  'authorization',
  'content-type',
  'if-match',
  'idempotency-key',
];

/** Origin is a browser boundary, never proof of identity or object permission. */
export function corsPolicy(
  request: Request,
  allowedOrigins: readonly string[],
) {
  const origin = request.headers.get('origin');
  const requestedMethod = request.headers.get('access-control-request-method');
  const requestedHeaders = request.headers.get(
    'access-control-request-headers',
  );
  const preflight =
    request.method === 'OPTIONS' &&
    (requestedMethod !== null || requestedHeaders !== null);
  const headers: Record<string, string> = { vary: 'Origin' };
  if (origin !== null && !allowedOrigins.includes(origin)) {
    throw new RequestFailure('ORIGIN_FORBIDDEN');
  }
  if (preflight) {
    if (
      origin === null ||
      requestedMethod === null ||
      !methods.includes(requestedMethod)
    ) {
      throw new RequestFailure('INVALID_PREFLIGHT');
    }
    if (requestedHeaders !== null && requestedHeaders.length > 256) {
      throw new RequestFailure('INVALID_PREFLIGHT');
    }
    const names =
      requestedHeaders === null
        ? []
        : requestedHeaders.split(',').map((name) => name.trim().toLowerCase());
    if (
      names.length > allowedHeaders.length ||
      names.some((name) => !allowedHeaders.includes(name)) ||
      new Set(names).size !== names.length
    ) {
      throw new RequestFailure('INVALID_PREFLIGHT');
    }
    headers.vary =
      'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';
    headers['access-control-allow-methods'] = methods.join(', ');
    headers['access-control-allow-headers'] = allowedHeaders.join(', ');
    headers['access-control-max-age'] = '300';
  }
  if (origin !== null) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-expose-headers'] =
      'x-request-id, retry-after, etag';
  }
  return { preflight, headers };
}
