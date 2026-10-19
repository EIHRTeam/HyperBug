import { useQuery } from '@tanstack/react-query';
import type { Operation, RequestInput } from '@hyperbug/api-client';
import { useAuth, usePublicConfig, usePublicClient } from './app.tsx';
import { productQuery, type ProductRequest } from './product-state.ts';

export function useProductApi() {
  const { auth, state } = useAuth();
  const client = usePublicClient();
  const config = usePublicConfig();
  const request: ProductRequest = state.account
    ? auth.request.bind(auth)
    : client.request.bind(client);
  return { request, state, origin: config.apiBaseUrl };
}
export function useProductQuery<K extends Operation>(
  operation: K,
  input: RequestInput<K>,
  enabled = true,
) {
  const api = useProductApi();
  return useQuery(
    productQuery(
      api.request,
      api.origin,
      api.state.epoch,
      operation,
      input,
      enabled,
    ),
  );
}
