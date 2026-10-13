import type {
  D1Database,
  Queue,
  MessageBatch,
} from '@cloudflare/workers-types';
import {
  createD1AsyncStore,
  createD1SearchIndexStore,
  createD1PluginRegistryStore,
  createD1PluginSettingsStore,
} from '@hyperbug/database-d1';
import {
  createAsyncEventHandler,
  createAsyncProcessor,
  createOutboxDispatcher,
  type AsyncPluginBinding,
  type TaskReference,
} from '@hyperbug/application';
import {
  createCloudflareTaskQueue,
  consumeCloudflareBatch,
} from './task-queue.ts';
export function configureCloudflareAsync(
  db: D1Database,
  queue: Queue<TaskReference> | null,
  bindings: readonly AsyncPluginBinding[] = [],
) {
  const store = createD1AsyncStore(db);
  const report = (metric: unknown) =>
    console.log(JSON.stringify({ component: 'async', metric }));
  const process = createAsyncProcessor({
    store,
    handle: createAsyncEventHandler({
      search: createD1SearchIndexStore(db),
      registry: createD1PluginRegistryStore(db),
      settings: createD1PluginSettingsStore(db),
      bindings,
    }),
    telemetry: report,
  });
  const dispatch = queue
    ? createOutboxDispatcher({
        store,
        queue: createCloudflareTaskQueue(queue),
        telemetry: report,
      })
    : null;
  return {
    store,
    async dispatch() {
      if (!dispatch) throw new Error('Async queue unavailable');
      await dispatch();
    },
    queue: (batch: MessageBatch<unknown>) =>
      consumeCloudflareBatch(batch, process),
  };
}
