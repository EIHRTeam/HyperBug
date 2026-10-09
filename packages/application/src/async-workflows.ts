import {
  ASYNC_LIMITS,
  AsyncError,
  validateJob,
  type JobStore,
} from './async-processing.ts';
export interface WorkflowReference {
  version: 1;
  jobId: string;
}
export interface WorkflowAdapter {
  start(jobId: string, maxSteps: number): Promise<void>;
  resume(jobId: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
}
export function validateWorkflowReference(value: unknown): WorkflowReference {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AsyncError('invalid');
  const ref = value as WorkflowReference;
  if (ref.version !== 1) throw new AsyncError('unsupported');
  if (Object.keys(ref).sort().join(',') !== 'jobId,version')
    throw new AsyncError('invalid');
  validateJob(ref.jobId, 1);
  return ref;
}
/** One bounded, database-atomic conformance step. Returned checkpoints contain no body or credential. */
export async function runConformanceStep(
  store: JobStore,
  reference: WorkflowReference,
  clock: () => number = Date.now,
  expectedCheckpoint?: number,
): Promise<{ checkpoint: number; terminal: boolean }> {
  const { jobId } = validateWorkflowReference(reference),
    job = await store.get(jobId);
  if (!job) throw new AsyncError('invalid');
  if (
    job.status === 'cancelled' ||
    job.status === 'completed' ||
    job.status === 'failed'
  )
    return { checkpoint: job.checkpoint, terminal: true };
  if (expectedCheckpoint !== undefined) {
    if (
      !Number.isInteger(expectedCheckpoint) ||
      expectedCheckpoint < 0 ||
      expectedCheckpoint >= ASYNC_LIMITS.steps
    )
      throw new AsyncError('invalid');
    if (job.checkpoint > expectedCheckpoint)
      return {
        checkpoint: job.checkpoint,
        terminal: job.checkpoint === job.maxSteps,
      };
    if (job.checkpoint < expectedCheckpoint) throw new AsyncError('transient');
  }
  const token = crypto.randomUUID();
  if (!(await store.claim(jobId, token, clock())))
    throw new AsyncError('transient');
  const current = await store.get(jobId);
  if (!current) throw new AsyncError('invalid');
  if (!(await store.commitStep(jobId, token, current.checkpoint, clock())))
    throw new AsyncError('transient');
  const result = {
    checkpoint: current.checkpoint + 1,
    terminal: current.checkpoint + 1 === current.maxSteps,
  };
  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength >
    ASYNC_LIMITS.checkpointBytes
  )
    throw new AsyncError('invalid');
  return result;
}
