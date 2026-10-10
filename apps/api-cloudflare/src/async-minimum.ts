import type { D1Database } from '@cloudflare/workers-types';
import {
  createD1AsyncStore,
  createD1MinimumAsyncStore,
  createD1MinimumJobStore,
  createD1PluginRegistryStore,
  createD1PluginSettingsStore,
  createD1ExpiredCleanupStore,
} from '@hyperbug/database-d1/async';
import {
  createAsyncProcessor,
  createAsyncEventHandler,
  runConformanceStep,
  runScheduledUploadCleanup,
  MINIMUM_ASYNC_LIMITS,
} from '@hyperbug/application/async';
import { loadAsyncMaintenancePolicy } from '@hyperbug/config';
import { minimumInvocationBudget } from './async-budget.ts';
import type { WorkerUploadBindings } from './uploads.ts';

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
  const minimum = createD1MinimumAsyncStore(db);
  const phase = Math.floor(input.scheduledTime / 300000) % 5;
  let outcome = 'done';
  let jobState: { checkpoint: number; terminal: boolean } | null = null;
  try {
    if (phase === 0) {
      const token = crypto.randomUUID(),
        admission = await minimum.admitAndClaim(clock(), token),
        refs = admission.references;
      if (!admission.admitted) outcome = 'quota-exhausted';
      if (refs[0]) {
        const process = createAsyncProcessor({
          store: minimum.executionStore(),
          clock,
          token: () => token,
          handle: createAsyncEventHandler({
            search: minimum.searchStore(),
            registry: createD1PluginRegistryStore(db),
            settings: createD1PluginSettingsStore(db),
            tier: 'cloudflare-minimum',
          }),
        });
        await process(refs[0]);
      }
    } else if (phase === 4) {
      const minimumJobs = createD1MinimumJobStore(db),
        selection = await minimumJobs.admit(clock()),
        jobs = minimumJobs.store;
      if (!selection.admitted) outcome = 'quota-exhausted';
      if (selection.job) {
        if (selection.job.maxSteps > MINIMUM_ASYNC_LIMITS.steps)
          await jobs.cancel(selection.job.id, clock());
        else
          jobState = await runConformanceStep(
            jobs,
            { version: 1, jobId: selection.job.id },
            clock,
          );
      }
    } else if (!(await minimum.reserve(clock()))) outcome = 'quota-exhausted';
    else if (phase === 1) {
      await createD1ExpiredCleanupStore(db).purgeExpired(
        clock(),
        input.sessionRetentionMs,
        1,
      );
    } else if (phase === 2) {
      const store = createD1AsyncStore(db);
      const { configureWorkerUploads } = await import('./uploads.ts');
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
      const store = createD1AsyncStore(db);
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
    }
  } catch {
    // Leases/source/checkpoints survive budget limits and interrupted I/O.
    outcome = 'bounded-error';
  }
  budget.diagnostics();
  const backlog = await minimum.backlog().catch(() => null);
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
