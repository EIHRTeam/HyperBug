import { AsyncError, validateJob, type JobStore } from './async-processing.ts';
/** Conservative async allocation, separate from provider-global billing and the search allocation. */
export const MINIMUM_ASYNC_LIMITS = Object.freeze({
  batch: 1,
  steps: 4,
  checkpointBytes: 1024,
  queries: 45,
  subrequests: 45,
  dailyReads: 1500000,
  dailyWrites: 30000,
  invocationReads: 5000,
  invocationWrites: 100,
});
export async function startMinimumJob(
  store: JobStore,
  input: {
    kind: string;
    id: string;
    maxSteps: number;
    now: number;
  },
) {
  if (
    input.kind !== 'conformance' ||
    input.maxSteps > MINIMUM_ASYNC_LIMITS.steps
  )
    throw new AsyncError('unsupported');
  validateJob(input.id, input.maxSteps);
  await store.create(input.id, input.maxSteps, input.now);
}
