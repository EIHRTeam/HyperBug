import { expect, it } from 'vitest';
import {
  taskReference,
  validateTaskReference,
  asyncBackoff,
  asyncFailure,
  AsyncError,
} from '@hyperbug/application';
it('validates private stable references and closed versions without retaining supplied payloads', () => {
  const ref = taskReference('core', '00000000-0000-4000-8000-000000000001');
  expect(validateTaskReference(ref)).toEqual(ref);
  for (const value of [
    null,
    { ...ref, version: 2 },
    { ...ref, payload: 'credential' },
    { ...ref, jobId: 'other' },
  ])
    expect(() => validateTaskReference(value)).toThrow();
  expect([1, 2, 3, 4, 5].map(asyncBackoff)).toEqual([
    1000, 2000, 4000, 8000, 16000,
  ]);
  expect(asyncFailure(new Error('private provider response'))).toBe(
    'transient',
  );
  expect(asyncFailure(new AsyncError('permanent'))).toBe('permanent');
});

import { vi } from 'vitest';
import {
  createAsyncProcessor,
  createOutboxDispatcher,
  type AsyncStore,
  type AsyncEvent,
} from '@hyperbug/application';
function runnerStore(): AsyncStore {
  return {
    claim: vi.fn(async () => []),
    published: vi.fn(async () => {}),
    publicationFailed: vi.fn(async () => {}),
    load: vi.fn(async (ref) => ({
      reference: ref,
      eventVersion: 1,
      projectId: null,
      aggregateId: null,
      eventType: 'test',
      payload: {},
      createdAt: Date.now(),
    })),
    begin: vi.fn(async () => 'acquired' as const),
    complete: vi.fn(async () => true),
    fail: vi.fn(async () => {}),
    replay: vi.fn(async () => true),
    backlog: vi.fn(async () => ({ pending: 0, failed: 0, oldestAt: null })),
    purgeTerminal: vi.fn(async () => 0),
  };
}
it('keeps native consumer capacity reserved after timeout and rejects excess/malformed work before side effects', async () => {
  vi.useFakeTimers();
  try {
    const store = runnerStore();
    let settle!: () => void;
    const stalled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const handle = vi.fn(async (_event: AsyncEvent) => stalled);
    const process = createAsyncProcessor({ store, handle });
    const refs = [1, 2, 3].map((n) =>
      taskReference(
        'core',
        `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      ),
    );
    const work = refs.slice(0, 2).map(process);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await Promise.all(work)).toEqual(['ack', 'ack']);
    expect(await process(refs[2])).toBe('retry');
    expect(await process({ private: 'never log me' })).toBe('ack');
    expect(handle).toHaveBeenCalledTimes(2);
    settle();
    await vi.advanceTimersByTimeAsync(1);
    expect(await process(refs[2])).toBe('ack');
  } finally {
    vi.useRealTimers();
  }
});
it('bounds stalled publication work across dispatcher ticks and retains durable recovery after ambiguous send', async () => {
  vi.useFakeTimers();
  try {
    const store = runnerStore(),
      ref = taskReference('core', '00000000-0000-4000-8000-000000000010');
    vi.mocked(store.claim).mockResolvedValue([ref, ref, ref]);
    let settle!: () => void;
    const stalled = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const queue = {
      enqueue: vi.fn(async () => stalled),
      schedule: vi.fn(async () => {}),
    };
    const dispatch = createOutboxDispatcher({ store, queue });
    const first = dispatch();
    expect(dispatch()).toBe(first);
    await vi.advanceTimersByTimeAsync(2001);
    await first;
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    await dispatch();
    expect(queue.enqueue).toHaveBeenCalledTimes(2);
    expect(store.published).not.toHaveBeenCalled();
    expect(store.publicationFailed).toHaveBeenCalledTimes(2);
    settle();
    await vi.advanceTimersByTimeAsync(1);
  } finally {
    vi.useRealTimers();
  }
});
