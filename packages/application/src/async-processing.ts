import { assertId } from '@hyperbug/domain';

/** Private references only; canonical content/configuration is loaded at execution. */
export interface TaskReference {
  version: 1;
  source: 'core' | 'plugin';
  eventId: string;
  deliveryId: string;
  jobId: string;
}
export const ASYNC_LIMITS = Object.freeze({
  batch: 10,
  concurrency: 2,
  fanout: 1,
  attempts: 5,
  leaseMs: 30_000,
  reconcileMs: 300_000,
  timeoutMs: 1_000,
  maxDelayMs: 3_600_000,
  checkpointBytes: 1_024,
  steps: 16,
});
export type AsyncFailure =
  | 'invalid'
  | 'unsupported'
  | 'permanent'
  | 'transient'
  | 'timeout'
  | 'lease-exhausted';
export class AsyncError extends Error {
  readonly reason: AsyncFailure;
  constructor(reason: AsyncFailure) {
    super(`Async ${reason}`);
    this.reason = reason;
  }
}
export function taskReference(
  source: TaskReference['source'],
  eventId: string,
): TaskReference {
  assertId(eventId);
  const identity = `${source === 'core' ? 'search-update' : 'plugin-event'}:${eventId}`;
  return { version: 1, source, eventId, deliveryId: identity, jobId: identity };
}
export function validateTaskReference(value: unknown): TaskReference {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AsyncError('invalid');
  const v = value as TaskReference;
  if (v.version !== 1) throw new AsyncError('unsupported');
  if (
    Object.keys(v).sort().join(',') !==
      'deliveryId,eventId,jobId,source,version' ||
    (v.source !== 'core' && v.source !== 'plugin')
  )
    throw new AsyncError('invalid');
  try {
    const expected = taskReference(v.source, v.eventId);
    if (v.deliveryId !== expected.deliveryId || v.jobId !== expected.jobId)
      throw new Error();
  } catch {
    throw new AsyncError('invalid');
  }
  return v;
}
export function asyncBackoff(attempt: number): number {
  if (
    !Number.isInteger(attempt) ||
    attempt < 1 ||
    attempt > ASYNC_LIMITS.attempts
  )
    throw new AsyncError('invalid');
  return Math.min(60_000, 1_000 * 2 ** (attempt - 1));
}
export function asyncFailure(error: unknown): AsyncFailure {
  return error instanceof AsyncError ? error.reason : 'transient';
}
export interface AsyncEvent {
  reference: TaskReference;
  eventVersion: number;
  projectId: string | null;
  aggregateId: string | null;
  eventType: string;
  payload: unknown;
  createdAt: number;
}
export interface AsyncBacklog {
  pending: number;
  failed: number;
  oldestAt: number | null;
}
export interface AsyncStore {
  claim(now: number, token: string, limit: number): Promise<TaskReference[]>;
  published(ref: TaskReference, token: string, now: number): Promise<void>;
  publicationFailed(
    ref: TaskReference,
    token: string,
    now: number,
    reason: AsyncFailure,
  ): Promise<void>;
  load(ref: TaskReference): Promise<AsyncEvent | null>;
  begin(
    ref: TaskReference,
    token: string,
    now: number,
  ): Promise<'acquired' | 'busy' | 'done' | 'failed'>;
  complete(ref: TaskReference, token: string, now: number): Promise<boolean>;
  fail(
    ref: TaskReference,
    token: string,
    now: number,
    reason: AsyncFailure,
  ): Promise<void>;
  /** Call only after a fresh operator authorization; never expose a raw store as an API. */
  replay(ref: TaskReference, now: number): Promise<boolean>;
  backlog(): Promise<AsyncBacklog>;
  /** Terminal references only; source retention and audit history are unaffected. */
  purgeTerminal(before: number, limit: number): Promise<number>;
}
export async function replayFailedTask(input: {
  store: AsyncStore;
  reference: TaskReference;
  now: number;
  authorize: () => Promise<boolean>;
}): Promise<boolean> {
  validateTaskReference(input.reference);
  if (!(await input.authorize())) throw new AsyncError('permanent');
  return input.store.replay(input.reference, input.now);
}
export interface TaskQueue {
  enqueue(reference: TaskReference): Promise<void>;
  schedule(reference: TaskReference, delayMs: number): Promise<void>;
}
export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';
export interface AsyncJob {
  id: string;
  kind: 'conformance';
  status: JobStatus;
  checkpoint: number;
  progress: number;
  attempts: number;
  resultReference: string | null;
  maxSteps: number;
  updatedAt: number;
}
export interface JobStore {
  create(id: string, maxSteps: number, now: number): Promise<void>;
  get(id: string): Promise<AsyncJob | null>;
  claim(id: string, token: string, now: number): Promise<boolean>;
  /** Atomically records the step witness and checkpoint; crash after commit is replay-safe. */
  commitStep(
    id: string,
    token: string,
    checkpoint: number,
    now: number,
    resultReference?: string,
  ): Promise<boolean>;
  cancel(id: string, now: number): Promise<boolean>;
}
export function validateJob(
  id: string,
  maxSteps: number,
  resultReference?: string,
): void {
  assertId(id);
  if (
    !Number.isInteger(maxSteps) ||
    maxSteps < 1 ||
    maxSteps > ASYNC_LIMITS.steps ||
    (resultReference !== undefined &&
      !/^artifacts\/[a-zA-Z0-9/_-]{1,480}$/.test(resultReference))
  )
    throw new AsyncError('invalid');
}
