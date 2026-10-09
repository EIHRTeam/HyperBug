import {
  ASYNC_LIMITS,
  AsyncError,
  validateTaskReference,
  type TaskQueue,
  type TaskReference,
} from '@hyperbug/application';
import type { Queue, MessageBatch } from '@cloudflare/workers-types';

export function createCloudflareTaskQueue(
  queue: Queue<TaskReference>,
): TaskQueue {
  const schedule = async (reference: TaskReference, delayMs: number) => {
    validateTaskReference(reference);
    if (
      !Number.isInteger(delayMs) ||
      delayMs < 0 ||
      delayMs > ASYNC_LIMITS.maxDelayMs
    )
      throw new AsyncError('invalid');
    await queue.send(reference, {
      contentType: 'json',
      delaySeconds: Math.ceil(delayMs / 1000),
    });
  };
  return { enqueue: (reference) => schedule(reference, 0), schedule };
}
export async function consumeCloudflareBatch(
  batch: MessageBatch<unknown>,
  process: (value: unknown) => Promise<'ack' | 'retry'>,
): Promise<void> {
  // Sequential within a batch, platform max_concurrency=2; excess is never silently accepted.
  await batch.messages.reduce(async (previous, message, index) => {
    await previous;
    if (index >= ASYNC_LIMITS.batch) {
      message.retry({ delaySeconds: 30 });
      return;
    }
    try {
      if ((await process(message.body)) === 'ack') message.ack();
      else message.retry({ delaySeconds: 30 });
    } catch {
      message.retry({ delaySeconds: 30 });
    }
  }, Promise.resolve());
}
