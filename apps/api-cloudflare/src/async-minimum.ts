import type { D1Database } from '@cloudflare/workers-types';
import {
  createD1AsyncStore,
  createD1MinimumAsyncStore,
  createD1SearchIndexStore,
  createD1PluginRegistryStore,
  createD1PluginSettingsStore,
  createD1ExpiredCleanupStore,
} from '@hyperbug/database-d1';
import {
  createAsyncProcessor,
  createAsyncEventHandler,
  runConformanceStep,
  runScheduledUploadCleanup,
  MINIMUM_ASYNC_LIMITS,
  type JobStore,
} from '@hyperbug/application';
import { loadAsyncMaintenancePolicy } from '@hyperbug/config';
import { minimumInvocationBudget } from './async-budget.ts';
import {
  configureWorkerUploads,
  type WorkerUploadBindings,
} from './uploads.ts';

/** A single phase per existing Cron tick. No queue or Workflow binding is used. */
export async function runMinimumAsyncTick(input: {
  db: D1Database;
  scheduledTime: number;
  now?: () => number;
  bindings: WorkerUploadBindings & {
    ASYNC_ORPHAN_RETENTION_SECONDS?: unknown;
    ASYNC_TERMINAL_RETENTION_SECONDS?: unknown;
  };
  sessionRetentionMs: number;
}) {
  const clock = input.now ?? Date.now,
    budget = minimumInvocationBudget(),
    db = budget.db(input.db);
  const store = createD1AsyncStore(db),
    minimum = createD1MinimumAsyncStore(db);
  const phase = Math.floor(input.scheduledTime / 300000) % 5;
  let outcome = 'done';
  let jobState: { checkpoint: number; terminal: boolean } | null = null;
  try {
    if (!(await minimum.reserve(clock()))) outcome = 'quota-exhausted';
    else if (phase === 0) {
      const token = crypto.randomUUID(),
        refs = await minimum.claim(clock(), token, true);
      const process = createAsyncProcessor({
        store: minimum.executionStore(),
        clock,
        token: () => token,
        handle: createAsyncEventHandler({
          search: createD1SearchIndexStore(db),
          registry: createD1PluginRegistryStore(db),
          settings: createD1PluginSettingsStore(db),
          tier: 'cloudflare-minimum',
        }),
      });
      if (refs[0]) await process(refs[0]);
    } else if (phase === 1) {
      await createD1ExpiredCleanupStore(db).purgeExpired(
        clock(),
        input.sessionRetentionMs,
        1,
      );
    } else if (phase === 2) {
      const uploads = configureWorkerUploads(
        db,
        {
          ...input.bindings,
          ...(input.bindings.HYPERBUG_UPLOAD_BLOB
            ? {
                HYPERBUG_UPLOAD_BLOB: budget.bucket(
                  input.bindings.HYPERBUG_UPLOAD_BLOB,
                ),
              }
            : {}),
        },
        budget.fetch,
      );
      if (uploads)
        await runScheduledUploadCleanup(
          store,
          uploads,
          loadAsyncMaintenancePolicy(input.bindings).orphanRetentionMs,
          clock,
        );
    } else if (phase === 3) {
      await store.purgeTerminal(
        Math.max(
          0,
          clock() -
            loadAsyncMaintenancePolicy(input.bindings).terminalRetentionMs,
        ),
        1,
      );
      await store.purgeJobs(
        Math.max(
          0,
          clock() -
            loadAsyncMaintenancePolicy(input.bindings).terminalRetentionMs,
        ),
        1,
      );
    } else {
      const ids = await store.recoverableJobs(clock(), 1),
        jobs: JobStore = { ...store, claim: store.claimJob };
      if (ids[0]) {
        const job = await jobs.get(ids[0]);
        if (job && job.maxSteps > MINIMUM_ASYNC_LIMITS.steps)
          await jobs.cancel(job.id, clock());
        else
          jobState = await runConformanceStep(
            jobs,
            { version: 1, jobId: ids[0] },
            clock,
          );
      }
    }
  } catch {
    // Leases/source/checkpoints survive budget limits and interrupted I/O.
    outcome = 'bounded-error';
  }
  budget.diagnostics();
  const backlog = await store.backlog().catch(() => null);
  const report = {
    component: 'async-minimum',
    phase,
    outcome,
    job: jobState,
    ...budget.snapshot(),
    backlog,
    ageMs:
      backlog?.oldestAt === null || !backlog
        ? null
        : Math.max(0, clock() - backlog.oldestAt),
  };
  console.log(JSON.stringify(report));
  return report;
}
