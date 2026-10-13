import type { Pool } from 'pg';
import type { WorkerUtils } from 'graphile-worker';
import { createPostgresAsyncStore } from '@hyperbug/database-postgres';
import {
  ASYNC_LIMITS,
  runConformanceStep,
  validateWorkflowReference,
  type WorkflowAdapter,
  type JobStore,
  type WorkflowReference,
} from '@hyperbug/application';
export function postgresJobStore(pool: Pool): JobStore {
  const store = createPostgresAsyncStore(pool);
  return { ...store, claim: store.claimJob };
}
export function createPostgresWorkflowAdapter(
  store: JobStore,
  utils: Pick<WorkerUtils, 'addJob'>,
): WorkflowAdapter {
  const resume = async (jobId: string) => {
    validateWorkflowReference({ version: 1, jobId });
    const job = await store.get(jobId);
    if (!job) throw new Error('Workflow missing');
    if (
      job.status === 'completed' ||
      job.status === 'cancelled' ||
      job.status === 'failed'
    )
      return;
    await utils.addJob(
      'hyperbug_workflow',
      { version: 1, jobId },
      {
        jobKey: `workflow:${jobId}:${job.checkpoint}`,
        jobKeyMode: 'replace',
        maxAttempts: ASYNC_LIMITS.attempts,
      },
    );
  };
  return {
    async start(jobId, maxSteps) {
      await store.create(jobId, maxSteps, Date.now());
      await resume(jobId);
    },
    resume,
    async cancel(jobId) {
      await store.cancel(jobId, Date.now());
    },
  };
}
export function createGraphileWorkflowTask(
  store: JobStore,
  schedule: (ref: WorkflowReference) => Promise<void>,
) {
  return async (value: unknown) => {
    const ref = validateWorkflowReference(value);
    const result = await runConformanceStep(store, ref);
    if (!result.terminal) await schedule(ref);
  };
}
