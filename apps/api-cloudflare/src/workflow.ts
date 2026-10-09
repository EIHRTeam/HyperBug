import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from 'cloudflare:workers';
import { createD1AsyncStore } from '@hyperbug/database-d1';
import {
  runConformanceStep,
  validateWorkflowReference,
  type WorkflowReference,
  type WorkflowAdapter,
  type JobStore,
} from '@hyperbug/application';
import type { D1Database } from '@cloudflare/workers-types';
/** Only methods used by the adapter; runtime-generated and package bindings differ in optional newer APIs. */
export interface WorkflowBinding {
  create(options: { id: string; params: WorkflowReference }): Promise<unknown>;
  get(id: string): Promise<{
    status(): Promise<{ status: string }>;
    restart(): Promise<void>;
    resume(): Promise<void>;
    terminate(): Promise<void>;
  }>;
}

export function d1JobStore(db: D1Database): JobStore {
  const store = createD1AsyncStore(db);
  return { ...store, claim: store.claimJob };
}
export class HyperBugWorkflow extends WorkflowEntrypoint<
  { DB: D1Database },
  WorkflowReference
> {
  async run(event: WorkflowEvent<WorkflowReference>, step: WorkflowStep) {
    const reference = validateWorkflowReference(event.payload),
      store = d1JobStore(this.env.DB);
    // Named retry-safe steps; large results belong behind artifact references, never step state.
    const execute = async (
      index: number,
    ): Promise<{ checkpoint: number; terminal: boolean }> => {
      if (index >= 16) throw new Error('Workflow step ceiling exhausted');
      const result = await step.do(
        `checkpoint-${index}`,
        {
          retries: { limit: 4, delay: '1 second', backoff: 'exponential' },
          timeout: '1 second',
        },
        () => runConformanceStep(store, reference, Date.now, index),
      );
      return result.terminal ? result : execute(index + 1);
    };
    return execute(0);
  }
}
export function createCloudflareWorkflowAdapter(
  store: JobStore,
  binding: WorkflowBinding,
): WorkflowAdapter {
  const start = async (jobId: string, maxSteps: number) => {
    await store.create(jobId, maxSteps, Date.now());
    await binding.create({ id: jobId, params: { version: 1, jobId } });
  };
  return {
    start,
    async resume(jobId) {
      validateWorkflowReference({ version: 1, jobId });
      const job = await store.get(jobId);
      if (!job) throw new Error('Workflow missing');
      if (job.status === 'completed' || job.status === 'cancelled') return;
      let instance;
      try {
        instance = await binding.get(jobId);
      } catch {
        // A fixed ID makes creation safe to retry after an ambiguous get failure.
        // Creation errors propagate; status/restart errors never trigger creation.
        await binding.create({ id: jobId, params: { version: 1, jobId } });
        return;
      }
      const status = await instance.status();
      if (status.status === 'errored' || status.status === 'terminated')
        await instance.restart();
      else if (status.status === 'paused') await instance.resume();
    },
    async cancel(jobId) {
      validateWorkflowReference({ version: 1, jobId });
      await store.cancel(jobId, Date.now());
      await (await binding.get(jobId)).terminate();
    },
  };
}
