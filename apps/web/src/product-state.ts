import {
  ApiClientError,
  type Operation,
  type OperationTypes,
  type RequestInput,
} from '@hyperbug/api-client';
import { queryOptions } from '@tanstack/react-query';

export const projectIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export interface IssueSearch {
  q: string;
  after: string;
  sort: 'created_desc';
  invalid?: string;
}
export function validateIssueSearch(raw: Record<string, unknown>): IssueSearch {
  const q = raw.q ?? '';
  const after = raw.after ?? '';
  if (
    typeof q !== 'string' ||
    [...q].length > 512 ||
    new TextEncoder().encode(q).length > 2048
  )
    return {
      q: '',
      after: '',
      sort: 'created_desc',
      invalid: 'Search must be at most 512 characters and 2,048 bytes.',
    };
  if (
    typeof after !== 'string' ||
    after.length > 2048 ||
    [...after].some(
      (character) => /\s/u.test(character) || character.charCodeAt(0) < 32,
    )
  )
    return {
      q,
      after: '',
      sort: 'created_desc',
      invalid: 'This page cursor is invalid. Return to the first page.',
    };
  if (raw.sort !== undefined && raw.sort !== 'created_desc')
    return {
      q,
      after: '',
      sort: 'created_desc',
      invalid: 'Only newest-created sorting is available on this instance.',
    };
  return { q, after, sort: 'created_desc' };
}

export type ProductRequest = <K extends Operation>(
  operation: K,
  input: RequestInput<K>,
) => Promise<OperationTypes[K]['response']>;
export function productQuery<K extends Operation>(
  request: ProductRequest,
  origin: string,
  epoch: number,
  operation: K,
  input: RequestInput<K>,
  enabled = true,
) {
  return queryOptions({
    queryKey: ['product', origin, epoch, operation, input] as const,
    queryFn: ({ signal }) =>
      request(operation, { ...input, signal } as RequestInput<K>),
    enabled,
    staleTime: 15000,
    gcTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// Only fixed client copy crosses the error boundary. Never expose server bodies.
export function productError(error: unknown): string {
  if (!(error instanceof ApiClientError))
    return 'Something went wrong. Try again.';
  if (error.status === 401)
    return 'Your sign-in expired. Sign in again to continue.';
  if (error.code === 'REAUTHENTICATION_REQUIRED')
    return 'Use a recent verified passkey sign-in to confirm this sensitive change. Password sign-in alone is insufficient.';
  if (error.status === 403)
    return 'You no longer have permission. Sign in again or contact a project administrator.';
  if (error.status === 404)
    return 'This item is unavailable or you do not have access.';
  if (error.code === 'UPLOAD_INVALID')
    return 'The upload could not be accepted. Check the file type, name and 32 MiB size limit, then choose another file.';
  if (['UPLOAD_DESTINATION', 'UPLOAD_HEADERS'].includes(error.code))
    return 'The configured upload destination is unavailable. Ask the operator to check the approved storage configuration.';
  if (error.code === 'UPLOAD_QUOTA')
    return 'The upload quota is full. Wait for existing uploads to finish or ask the project administrator about storage limits.';
  if (error.code === 'UPLOAD_EXPIRED')
    return 'This upload expired. Retry to request a fresh upload capability.';
  if (error.status === 409)
    return 'This item changed. Reload the latest version, review your changes and try again.';
  if (error.status === 429)
    return 'This instance’s request limit was reached. Wait before trying again.';
  if (
    [
      'SEARCH_SYNTAX',
      'SEARCH_UNSUPPORTED',
      'SEARCH_VALUE',
      'SEARCH_COMPLEXITY',
    ].includes(error.code)
  )
    return 'Check the search syntax and limits. Use quoted phrases and supported filters; parentheses and wildcards are unavailable.';
  if (error.code === 'SEARCH_PRINCIPAL_REQUIRED')
    return 'Sign in to search for “me”, or use an explicit identifier.';
  if (error.code === 'SEARCH_WINDOW_EXHAUSTED')
    return 'The search result window is full. Narrow the search to continue.';
  if (error.code.startsWith('SEARCH_'))
    return 'Search is temporarily unavailable. Try again later or open an issue directly.';
  if (error.status === 0)
    return error.ambiguous
      ? 'The result is uncertain. Retry the unchanged submission to reuse its receipt and avoid a duplicate.'
      : 'The network request could not complete. Check your connection and try again.';
  return 'The request could not be completed. Review the fields and try again.';
}
