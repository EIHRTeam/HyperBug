import {
  ASYNC_LIMITS,
  AsyncError,
  asyncFailure,
  validateTaskReference,
  type AsyncEvent,
  type AsyncStore,
  type TaskQueue,
} from './async-processing.ts';

export type AsyncMetric =
  | { kind: 'dispatch'; sent: number; errors: number; durationMs: number }
  | {
      kind: 'consume';
      outcome: 'done' | 'retry' | 'failed' | 'busy' | 'invalid';
      durationMs: number;
      lagMs: number;
    }
  | { kind: 'backlog'; pending: number; failed: number; ageMs: number };
export type AsyncTelemetry = (metric: AsyncMetric) => void;
const quiet: AsyncTelemetry = () => {};
function safeTelemetry(telemetry: AsyncTelemetry): AsyncTelemetry {
  return (metric) => {
    try {
      telemetry(metric);
    } catch {
      /* Diagnostics never alter delivery state. */
    }
  };
}

/** Isolate-local shedding only; durable state remains the authority. */
export function createAsyncProcessor(input: {
  store: AsyncStore;
  handle: (event: AsyncEvent, signal: AbortSignal) => Promise<void>;
  token?: () => string;
  telemetry?: AsyncTelemetry;
  clock?: () => number;
}) {
  const clock = input.clock ?? Date.now,
    report = safeTelemetry(input.telemetry ?? quiet);
  const active = new Set<string>();
  let failures = 0,
    openUntil = 0;
  return async (message: unknown): Promise<'ack' | 'retry'> => {
    const started = performance.now();
    let ref;
    try {
      ref = validateTaskReference(message);
    } catch {
      report({
        kind: 'consume',
        outcome: 'invalid',
        durationMs: performance.now() - started,
        lagMs: 0,
      });
      return 'ack';
    }
    if (
      active.size >= ASYNC_LIMITS.concurrency ||
      active.has(ref.deliveryId) ||
      clock() < openUntil
    )
      return 'retry';
    active.add(ref.deliveryId);
    const token = input.token?.() ?? crypto.randomUUID();
    let transferred = false;
    try {
      const acquired = await input.store.begin(ref, token, clock());
      if (acquired !== 'acquired') return acquired === 'busy' ? 'retry' : 'ack';
      const event = await input.store.load(ref);
      if (!event) throw new AsyncError('invalid');
      const controller = new AbortController();
      const work = Promise.resolve().then(() =>
        input.handle(event, controller.signal),
      );
      // Timeout cannot preempt trusted native code; its real completion keeps capacity reserved.
      transferred = true;
      void work.finally(() => active.delete(ref.deliveryId)).catch(() => {});
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new AsyncError('timeout'));
            }, ASYNC_LIMITS.timeoutMs);
          }),
        ]);
        if (performance.now() - started > ASYNC_LIMITS.timeoutMs)
          throw new AsyncError('timeout');
        controller.signal.throwIfAborted();
        if (!(await input.store.complete(ref, token, clock()))) return 'retry';
        failures = 0;
        report({
          kind: 'consume',
          outcome: 'done',
          durationMs: performance.now() - started,
          lagMs: Math.max(0, clock() - event.createdAt),
        });
        return 'ack';
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    } catch (error) {
      const reason = asyncFailure(error);
      await input.store.fail(ref, token, clock(), reason);
      const permanent =
        reason === 'invalid' ||
        reason === 'unsupported' ||
        reason === 'permanent';
      if (!permanent && ++failures >= 3) openUntil = clock() + 30_000;
      report({
        kind: 'consume',
        outcome: permanent ? 'failed' : 'retry',
        durationMs: performance.now() - started,
        lagMs: 0,
      });
      // Durable retry owns rescheduling, so a provider delivery can be acknowledged.
      return 'ack';
    } finally {
      if (!transferred) active.delete(ref.deliveryId);
    }
  };
}

export function createOutboxDispatcher(input: {
  store: AsyncStore;
  queue: TaskQueue;
  telemetry?: AsyncTelemetry;
  clock?: () => number;
}) {
  let running: Promise<void> | null = null;
  const clock = input.clock ?? Date.now,
    report = safeTelemetry(input.telemetry ?? quiet);
  let failures = 0,
    openUntil = 0;
  const publishing = new Set<Promise<void>>();
  const run = async () => {
    if (clock() < openUntil) return;
    const started = performance.now(),
      token = crypto.randomUUID();
    const refs = await input.store.claim(clock(), token, ASYNC_LIMITS.batch);
    let sent = 0,
      errors = 0;
    // One send per source event; no expansion or provider payload is accepted.
    await refs.reduce(async (previous, ref) => {
      await previous;
      if (publishing.size >= ASYNC_LIMITS.concurrency || clock() < openUntil)
        return;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const send = input.queue.enqueue(ref);
        publishing.add(send);
        void send.finally(() => publishing.delete(send)).catch(() => {});
        await Promise.race([
          send,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new AsyncError('timeout')),
              ASYNC_LIMITS.timeoutMs,
            );
          }),
        ]);
        await input.store.published(ref, token, clock());
        sent++;
        failures = 0;
      } catch (error) {
        await input.store.publicationFailed(
          ref,
          token,
          clock(),
          asyncFailure(error),
        );
        errors++;
        if (++failures >= 3) openUntil = clock() + 30_000;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    }, Promise.resolve());
    report({
      kind: 'dispatch',
      sent,
      errors,
      durationMs: performance.now() - started,
    });
    const backlog = await input.store.backlog();
    report({
      kind: 'backlog',
      pending: backlog.pending,
      failed: backlog.failed,
      ageMs:
        backlog.oldestAt === null ? 0 : Math.max(0, clock() - backlog.oldestAt),
    });
  };
  return () => {
    if (running) return running;
    const work = run();
    running = work;
    void work
      .finally(() => {
        if (running === work) running = null;
      })
      .catch(() => {});
    return work;
  };
}
