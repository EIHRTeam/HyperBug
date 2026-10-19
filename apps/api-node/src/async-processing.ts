import {
  postgresJobStore,
  createPostgresWorkflowAdapter,
  createGraphileWorkflowTask,
} from './workflow.ts';
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
  type UploadDependencies,
  runScheduledUploadCleanup,
} from '@hyperbug/application';
import { startGraphileTasks } from './task-queue.ts';

/** Queue failure never prevents canonical issue writes or opens an authorization gate. */
export function configureNodeAsync(
  pool: Pool,
  bindings: readonly AsyncPluginBinding[] = [],
) {
  const store = createPostgresAsyncStore(pool),
    jobs = postgresJobStore(pool);
  let uploads: UploadDependencies | null = null,
    orphanRetentionMs = 86400000,
    terminalRetentionMs = 2592000000;
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
      await store.purgeTerminal(
        Math.max(0, Date.now() - terminalRetentionMs),
        10,
      );
      await store.purgeJobs(Math.max(0, Date.now() - terminalRetentionMs), 10);
      if (uploads)
        await runScheduledUploadCleanup(store, uploads, orphanRetentionMs);
      if (!worker) {
        worker = await startGraphileTasks(pool, process, {
          hyperbug_workflow: createGraphileWorkflowTask(jobs, async (ref) => {
            await createPostgresWorkflowAdapter(jobs, worker!.utils).resume(
              ref.jobId,
            );
          }),
        });
        dispatch = createOutboxDispatcher({
          store,
          queue: worker.queue,
          telemetry: report,
        });
      }
      await dispatch!();
      await store.recoverableJobs(Date.now(), 1).then((ids) =>
        ids.reduce(async (previous, id) => {
          await previous;
          await createPostgresWorkflowAdapter(jobs, worker!.utils).resume(id);
        }, Promise.resolve()),
      );
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
    configureUploads(
      dependencies: UploadDependencies | null,
      orphanMs: number,
      terminalMs: number,
    ) {
      uploads = dependencies;
      orphanRetentionMs = orphanMs;
      terminalRetentionMs = terminalMs;
    },
    run,
    async close() {
      closed = true;
      await active?.catch(() => {});
      await worker?.close();
    },
  };
}
