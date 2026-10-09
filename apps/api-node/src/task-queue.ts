import {
  makeWorkerUtils,
  run,
  type WorkerUtils,
  type Runner,
  type TaskList,
} from 'graphile-worker';
import type { Pool } from 'pg';
import {
  ASYNC_LIMITS,
  AsyncError,
  validateTaskReference,
  type TaskQueue,
  type TaskReference,
} from '@hyperbug/application';

export function createGraphileTaskQueue(
  utils: Pick<WorkerUtils, 'addJob'>,
): TaskQueue {
  const schedule = async (reference: TaskReference, delayMs: number) => {
    validateTaskReference(reference);
    if (
      !Number.isInteger(delayMs) ||
      delayMs < 0 ||
      delayMs > ASYNC_LIMITS.maxDelayMs
    )
      throw new AsyncError('invalid');
    await utils.addJob('hyperbug_event', reference, {
      jobKey: reference.deliveryId,
      jobKeyMode: 'unsafe_dedupe',
      maxAttempts: ASYNC_LIMITS.attempts,
      runAt: new Date(Date.now() + delayMs),
    });
  };
  return { enqueue: (reference) => schedule(reference, 0), schedule };
}
export async function startGraphileTasks(
  pool: Pool,
  process: (value: unknown) => Promise<'ack' | 'retry'>,
  extraTasks: TaskList = {},
) {
  const utils = await makeWorkerUtils({ pgPool: pool });
  let runner: Runner | undefined;
  try {
    await utils.migrate();
    runner = await run({
      pgPool: pool,
      concurrency: ASYNC_LIMITS.concurrency,
      noHandleSignals: true,
      pollInterval: 1000,
      taskList: {
        ...extraTasks,
        hyperbug_event: async (value) => {
          if ((await process(value)) === 'retry')
            throw new AsyncError('transient');
        },
      },
    });
    void runner.promise.catch(() => {
      console.error('Async worker unavailable');
    });
    return {
      queue: createGraphileTaskQueue(utils),
      utils,
      async close() {
        await runner!.stop();
        await utils.release();
      },
    };
  } catch (error) {
    await runner?.stop();
    await utils.release();
    throw error;
  }
}
