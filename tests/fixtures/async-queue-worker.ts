import type { Queue, MessageBatch } from '@cloudflare/workers-types';
import { taskReference } from '@hyperbug/application';
import {
  createCloudflareTaskQueue,
  consumeCloudflareBatch,
} from '../../apps/api-cloudflare/src/task-queue.ts';
const observed: { id: string; attempts: number }[] = [];
export default {
  async fetch(request: Request, env: { TASKS: Queue }) {
    if (request.method === 'POST') {
      await createCloudflareTaskQueue(env.TASKS).enqueue(
        taskReference('core', '00000000-0000-4000-8000-000000000001'),
      );
      return new Response('sent');
    }
    return Response.json(observed);
  },
  async queue(batch: MessageBatch<unknown>) {
    await consumeCloudflareBatch(batch, async (value) => {
      const ref = value as { deliveryId: string };
      const message = batch.messages.find((m) => m.body === value)!;
      observed.push({ id: ref.deliveryId, attempts: message.attempts });
      return message.attempts === 1 ? 'retry' : 'ack';
    });
  },
};
