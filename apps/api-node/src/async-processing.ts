import type { Pool } from 'pg';
import {
  createPostgresAsyncStore,
  createPostgresSearchIndexStore,
  createPostgresPluginRegistryStore,
  createPostgresPluginSettingsStore,
} from '@hyperbug/database-postgres';
import {
  createAsyncEventHandler,
  createAsyncProcessor,
  createOutboxDispatcher,
  type AsyncPluginBinding,
} from '@hyperbug/application';
import { startGraphileTasks } from './task-queue.ts';

/** Queue failure never prevents canonical issue writes or opens an authorization gate. */
export function configureNodeAsync(
  pool: Pool,
  bindings: readonly AsyncPluginBinding[] = [],
) {
  const store = createPostgresAsyncStore(pool);
  const report = (metric: unknown) =>
    console.log(JSON.stringify({ component: 'async', metric }));
  const process = createAsyncProcessor({
    store,
    handle: createAsyncEventHandler({
      search: createPostgresSearchIndexStore(pool),
      registry: createPostgresPluginRegistryStore(pool),
      settings: createPostgresPluginSettingsStore(pool),
      bindings,
    }),
    telemetry: report,
  });
  let worker: Awaited<ReturnType<typeof startGraphileTasks>> | null = null;
  let dispatch: (() => Promise<void>) | null = null,
    closed = false;
  let active: Promise<void> | null = null;
  const run = () => {
    if (closed) return Promise.resolve();
    if (active) return active;
    const attempt = (async () => {
      if (!worker) {
        worker = await startGraphileTasks(pool, process);
        dispatch = createOutboxDispatcher({
          store,
          queue: worker.queue,
          telemetry: report,
        });
      }
      await dispatch!();
    })();
    active = attempt;
    void attempt
      .finally(() => {
        if (active === attempt) active = null;
      })
      .catch(() => {});
    return attempt;
  };
  return {
    store,
    run,
    async close() {
      closed = true;
      await active?.catch(() => {});
      await worker?.close();
    },
  };
}
