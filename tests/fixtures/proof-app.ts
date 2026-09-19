import { createApp, withDeadline, type AppOptions } from '@hyperbug/server';
import { EchoSchema, type Echo } from '@hyperbug/contracts';
import { Elysia, t } from 'elysia';

export function createProofApp(options: AppOptions) {
  let cancellationCount = 0;
  let requestAbortCount = 0;
  let startedCount = 0;
  let readiness = 'healthy';
  return createApp({
    ...options,
    ready: async (signal) => {
      if (readiness === 'unavailable') return false;
      if (readiness === 'error')
        throw new Error('private dependency credentials must not leak');
      if (readiness === 'timeout')
        return new Promise<boolean>((resolve) =>
          signal.addEventListener('abort', () => resolve(false), {
            once: true,
          }),
        );
      return options.ready(signal);
    },
  })
    .get('/_proof/readiness/:mode', ({ params }) => {
      readiness = params.mode;
      return { ok: true };
    })
    .post('/_proof/echo', ({ body }) => body, {
      body: t.Unsafe<Echo>(EchoSchema),
      response: t.Unsafe<Echo>(EchoSchema),
    })
    .get('/_proof/cancellations', () => ({
      count: cancellationCount,
      requestAborts: requestAbortCount,
      started: startedCount,
    }))
    .get('/_proof/cancel', ({ request }) => {
      startedCount += 1;
      let finished = false;
      let timer: ReturnType<typeof setTimeout>;
      let heartbeat: ReturnType<typeof setInterval>;
      const onAbort = () => {
        requestAbortCount += 1;
        cancel();
      };
      const cancel = () => {
        if (!finished) {
          finished = true;
          cancellationCount += 1;
          clearTimeout(timer);
          clearInterval(heartbeat);
          request.signal.removeEventListener('abort', onAbort);
        }
      };
      return new Response(
        new ReadableStream({
          start(controller) {
            request.signal.addEventListener('abort', onAbort, { once: true });
            controller.enqueue(new TextEncoder().encode('ready\n'));
            // workerd detects a closed peer when it next writes to the socket.
            heartbeat = setInterval(() => {
              controller.enqueue(new TextEncoder().encode('ping\n'));
            }, 50);
            timer = setTimeout(() => {
              if (!finished) {
                finished = true;
                clearInterval(heartbeat);
                request.signal.removeEventListener('abort', onAbort);
                controller.close();
              }
            }, 3000);
          },
          cancel,
        }),
        {
          headers: {
            'content-type': 'text/plain',
            'cache-control': 'no-store, no-transform',
          },
        },
      );
    })
    .get('/_proof/error', () => {
      throw new Error(
        'provider-password=DO_NOT_LEAK /private/path database sql',
      );
    })
    .get('/_proof/timeout', ({ request }) =>
      withDeadline(
        request.signal,
        50,
        (signal) =>
          new Promise((resolve) => {
            signal.addEventListener('abort', () => resolve('cancelled'), {
              once: true,
            });
          }),
      ),
    )
    .get(
      '/_proof/stream',
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('first\n'));
              setTimeout(() => {
                controller.enqueue(new TextEncoder().encode('second\n'));
                controller.close();
              }, 250);
            },
          }),
          { headers: { 'content-type': 'text/plain' } },
        ),
    )
    .use(
      new Elysia({ name: 'scoped-proof' })
        .onBeforeHandle(({ set }) => {
          set.headers['x-scoped'] = 'yes';
        })
        .get('/_proof/scoped', () => ({ ok: true })),
    )
    .get('/_proof/unscoped', () => ({ ok: true }));
}
