import { Elysia, t } from 'elysia';
import type { ElysiaAdapter } from 'elysia/adapter';
import type { RuntimeConfig } from '@hyperbug/config';
import type { Telemetry, RouteLabel } from '@hyperbug/observability';
import { HealthSchema } from '@hyperbug/contracts';
import { readBoundedJson, RequestFailure, withDeadline } from './bounds.ts';

export interface AppOptions {
  adapter: ElysiaAdapter;
  config: RuntimeConfig;
  telemetry: Telemetry;
  ready: (signal: AbortSignal) => Promise<boolean>;
}

export function createApp({ adapter, config, telemetry, ready }: AppOptions) {
  const starts = new WeakMap<Request, number>();
  return new Elysia({ adapter, aot: true, normalize: false })
    .onRequest(({ request, set }) => {
      starts.set(request, performance.now());
      set.headers['x-request-id'] = crypto.randomUUID();
      set.headers['cache-control'] = 'no-store';
      set.headers['x-content-type-options'] = 'nosniff';
      const length = request.headers.get('content-length');
      if (
        length !== null &&
        (!/^\d+$/.test(length) || Number(length) > config.maxBodyBytes)
      ) {
        throw new RequestFailure(
          413,
          'BODY_TOO_LARGE',
          'Request body exceeds the limit.',
        );
      }
    })
    .onParse(async ({ request, contentType }) => {
      if (contentType !== 'application/json')
        throw new RequestFailure(
          415,
          'UNSUPPORTED_MEDIA_TYPE',
          'Use application/json.',
        );
      return readBoundedJson(
        request,
        config.maxBodyBytes,
        config.requestTimeoutMs,
      );
    })
    .onError(({ code, error, set }) => {
      const source =
        code === 'PARSE' && error.cause instanceof RequestFailure
          ? error.cause
          : error;
      const failure =
        source instanceof RequestFailure
          ? source
          : code === 'VALIDATION' || code === 'PARSE'
            ? new RequestFailure(
                400,
                'INVALID_REQUEST',
                'Request validation failed.',
              )
            : code === 'NOT_FOUND'
              ? new RequestFailure(404, 'NOT_FOUND', 'Resource not found.')
              : new RequestFailure(
                  500,
                  'INTERNAL_ERROR',
                  'An internal error occurred.',
                );
      set.status = failure.status;
      return {
        error: {
          code: failure.code,
          message: failure.message,
          requestId: set.headers['x-request-id'],
        },
      };
    })
    .onAfterResponse(({ request, set, route }) => {
      const label: RouteLabel =
        route === '/health/live'
          ? 'health.live'
          : route === '/health/ready'
            ? 'health.ready'
            : route?.startsWith('/_proof')
              ? 'proof'
              : 'unmatched';
      try {
        telemetry.request({
          requestId: String(set.headers['x-request-id']),
          route: label,
          status: typeof set.status === 'number' ? set.status : 200,
          durationMs:
            performance.now() - (starts.get(request) ?? performance.now()),
        });
      } catch {
        /* Telemetry transport failure must not alter a completed response. */
      }
    })
    .get('/health/live', () => ({ status: 'ok' as const }), {
      response: t.Unsafe<{ status: 'ok' | 'unavailable' }>(HealthSchema),
    })
    .get(
      '/health/ready',
      async ({ request, set }) => {
        try {
          const available = await withDeadline(
            request.signal,
            config.requestTimeoutMs,
            ready,
          );
          if (available) return { status: 'ok' as const };
        } catch {
          /* Health responses intentionally hide dependency details. */
        }
        set.status = 503;
        return { status: 'unavailable' as const };
      },
      {
        response: {
          200: t.Unsafe<{ status: 'ok' | 'unavailable' }>(HealthSchema),
          503: t.Unsafe<{ status: 'ok' | 'unavailable' }>(HealthSchema),
        },
      },
    );
}

export { RequestFailure, withDeadline } from './bounds.ts';
