/** Core route policy; handlers/plugins cannot opt themselves into shared caching. */
const cacheableRoutes = new Set([
  'GET /api/v1/instance',
  'HEAD /api/v1/instance',
]);
export function isInstanceMetadataRequest(request: Request): boolean {
  return cacheableRoutes.has(
    request.method + ' ' + new URL(request.url).pathname,
  );
}
export function responseCacheControl(
  request: Request,
  status: number,
  setsCookie = false,
): string {
  return isInstanceMetadataRequest(request) &&
    (status === 200 || status === 304) &&
    !request.headers.has('authorization') &&
    !request.headers.has('cookie') &&
    !setsCookie
    ? 'public, max-age=60'
    : 'no-store';
}
