import instanceContract from 'virtual:hyperbug-instance-contract';
import { createApiClient } from '@hyperbug/api-client';
import { queryOptions } from '@tanstack/react-query';
import type { RuntimeConfig } from './runtime-config.ts';
import { validateInstanceDocument } from './capability-validation.ts';

export function instanceQuery(config: RuntimeConfig) {
  const client = createApiClient({
    baseUrl: config.apiBaseUrl,
    maxRetries: 0,
    maxResponseBytes: 16384,
  });
  return queryOptions({
    queryKey: ['instance', config.apiBaseUrl],
    queryFn: async ({ signal }) =>
      validateInstanceDocument(
        await client.request('GET /api/v1/instance', { signal }),
        instanceContract,
      ),
    staleTime: 60000,
    gcTime: 300000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
