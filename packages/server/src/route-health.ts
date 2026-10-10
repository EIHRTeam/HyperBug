import { t, type AnyElysia } from 'elysia';
import type { AppOptions } from './index.ts';
import { storeReadTimeoutMs } from './bounds.ts';
import { idempotencyDigest } from '@hyperbug/security';
import {
  HealthSchema,
  ReadinessSchema,
  InstanceDocumentSchema,
  type ReadinessResponse,
  type InstanceDocument,
} from '@hyperbug/contracts';
import { withDeadline } from './bounds.ts';
export interface HealthDependencies {
  readonly config: AppOptions['config'];
  readonly ready: AppOptions['ready'];
  readonly bootstrapState: AppOptions['bootstrapState'];
  readonly readiness: (
    status: 'ok' | 'unavailable',
    pending?: boolean,
  ) => ReadinessResponse;
  readonly instanceDocument: InstanceDocument;
}
export function healthRoutes(app: AnyElysia, dependencies: HealthDependencies) {
  const { config, ready, bootstrapState, readiness, instanceDocument } =
    dependencies;
  let instanceEtag: Promise<string> | null = null;
  return app
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
          if (available) {
            let pending: boolean | undefined;
            if (bootstrapState && !request.signal.aborted) {
              try {
                pending = await withDeadline(
                  request.signal,
                  storeReadTimeoutMs(request.signal),
                  bootstrapState,
                );
              } catch {
                /* A failed state probe omits the field, never fails readiness. */
              }
            }
            return readiness('ok', pending);
          }
        } catch {
          /* Health responses intentionally hide dependency details. */
        }
        set.status = 503;
        return readiness('unavailable');
      },
      {
        response: {
          200: t.Unsafe<ReadinessResponse>(ReadinessSchema),
          503: t.Unsafe<ReadinessResponse>(ReadinessSchema),
        },
      },
    )
    .get(
      '/api/v1/instance',
      async ({ request, set }) => {
        const etag = await (instanceEtag ??= idempotencyDigest(
          JSON.stringify(instanceDocument),
        ).then((digest) => 'W/"instance-v1.' + digest + '"'));
        set.headers.etag = etag;
        const validators = request.headers
          .get('if-none-match')
          ?.split(',')
          .map((v: string) => v.trim());
        if (
          validators?.some(
            (v: string) =>
              v === '*' || v.replace(/^W\//, '') === etag.replace(/^W\//, ''),
          )
        ) {
          set.status = 304;
          return new Response(null, { status: 304, headers: { etag } });
        }
        return new Response(JSON.stringify(instanceDocument), {
          headers: { 'content-type': 'application/json', etag },
        });
      },
      {
        response: {
          200: t.Unsafe<InstanceDocument>(InstanceDocumentSchema),
          304: t.Null(),
        },
      },
    );
}
