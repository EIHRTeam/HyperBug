import { describe, expect, it } from 'vitest';
import {
  ASYNC_LIMITS,
  replayFailedTask,
  taskReference,
  type AsyncStore,
  type JobStore,
} from '@hyperbug/application';
import { nextId, type RepositoryHarness } from './repository-contract.ts';

export function asyncStoreContract(
  get: () => {
    harness: RepositoryHarness;
    store: AsyncStore &
      Omit<JobStore, 'claim'> & { claimJob: JobStore['claim'] };
  },
) {
  describe('async durable sidecars', () => {
    const now = 2_000_000_000_000;
    async function seed() {
      const { harness, store } = get();
      const projectId = nextId(),
        eventId = nextId(),
        issueId = nextId();
      await harness.query(
        'INSERT INTO projects (id,slug,name,created_at,updated_at) VALUES (?,?,?,?,?)',
        [projectId, projectId, 'Async fixture', now, now],
      );
      await harness.query(
        "INSERT INTO outbox (id,project_id,aggregate_id,event_type,payload,created_at,available_at) VALUES (?,?,?,'issue.create',?,?,?)",
        [
          eventId,
          projectId,
          issueId,
          JSON.stringify({ issueId, mutationId: nextId() }),
          now,
          now,
        ],
      );
      const ref = taskReference('core', eventId);
      return { harness, store, ref };
    }
    it('claims concurrently, reconciles publication loss, fences expired workers and atomically acknowledges the source', async () => {
      const { store, ref, harness } = await seed();
      const results = await Promise.all([
        store.claim(now, 'publisher-a', 10),
        store.claim(now, 'publisher-b', 10),
      ]);
      expect(
        results.flat().filter((r) => r.eventId === ref.eventId),
      ).toHaveLength(1);
      expect(
        (
          await store.claim(now + ASYNC_LIMITS.leaseMs + 1, 'publisher-c', 10)
        ).some((r) => r.eventId === ref.eventId),
      ).toBe(true);
      await store.published(ref, 'publisher-c', now + ASYNC_LIMITS.leaseMs + 2);
      expect(await store.begin(ref, 'worker-a', now + 40_000)).toBe('acquired');
      expect(await store.begin(ref, 'worker-b', now + 40_001)).toBe('busy');
      expect(await store.begin(ref, 'worker-b', now + 80_000)).toBe('acquired');
      expect(await store.complete(ref, 'worker-a', now + 80_001)).toBe(false);
      expect(await store.complete(ref, 'worker-b', now + 80_002)).toBe(true);
      expect(await store.begin(ref, 'duplicate', now + 80_003)).toBe('done');
      expect(
        Number(
          (
            await harness.query('SELECT delivered_at FROM outbox WHERE id=?', [
              ref.eventId,
            ])
          )[0]!.delivered_at,
        ),
      ).toBe(now + 80_002);
    });
    it('retains poison failures, denies unauthorized replay, and bounds retries across crashes', async () => {
      const { store, ref } = await seed();
      await store.claim(now, 'publisher', 10);
      await store.begin(ref, 'worker', now);
      await store.fail(ref, 'worker', now + 1, 'unsupported');
      expect(await store.begin(ref, 'worker-2', now + 60_000)).toBe('failed');
      await expect(
        replayFailedTask({
          store,
          reference: ref,
          now,
          authorize: async () => false,
        }),
      ).rejects.toThrow();
      expect(
        await replayFailedTask({
          store,
          reference: ref,
          now: now + 60_000,
          authorize: async () => true,
        }),
      ).toBe(true);
      for (let i = 0; i < 5; i++)
        expect(
          await store.begin(ref, `crash-${i}`, now + 60_000 + i * 40_000),
        ).toBe('acquired');
      expect(await store.begin(ref, 'exhausted', now + 300_000)).toBe('failed');
      expect((await store.backlog()).failed).toBeGreaterThanOrEqual(1);
      expect(
        await store.purgeTerminal(now + 400_000, 10),
      ).toBeGreaterThanOrEqual(0);
      expect(await store.begin(ref, 'retained', now + 400_001)).toBe('failed');
    });
    it('resumes bounded job checkpoints after a crash and fences cancellation and duplicate committed steps', async () => {
      const { store, harness } = get();
      const id = nextId();
      await store.create(id, 2, now);
      expect(await store.claimJob(id, 'crashed', now)).toBe(true);
      expect(await store.claimJob(id, 'resume', now + 40_000)).toBe(true);
      expect(await store.commitStep(id, 'crashed', 0, now + 40_001)).toBe(
        false,
      );
      expect(await store.commitStep(id, 'resume', 0, now + 40_002)).toBe(true);
      expect(await store.claimJob(id, 'next', now + 40_003)).toBe(true);
      expect(
        await store.commitStep(
          id,
          'next',
          1,
          now + 40_004,
          'artifacts/conformance/result',
        ),
      ).toBe(true);
      expect(await store.commitStep(id, 'next', 1, now + 40_005)).toBe(true);
      expect(await store.get(id)).toMatchObject({
        status: 'completed',
        checkpoint: 2,
        progress: 100,
        resultReference: 'artifacts/conformance/result',
      });
      expect(
        await harness.query('SELECT step FROM async_job_steps WHERE job_id=?', [
          id,
        ]),
      ).toHaveLength(2);
      const cancelled = nextId();
      await store.create(cancelled, 2, now);
      await store.claimJob(cancelled, 'cancel', now);
      expect(await store.cancel(cancelled, now + 1)).toBe(true);
      expect(await store.commitStep(cancelled, 'cancel', 0, now + 2)).toBe(
        false,
      );
      await expect(store.create(nextId(), 17, now)).rejects.toThrow();
      await expect(
        store.commitStep(id, 'next', 1, now, 'secret'.repeat(500)),
      ).rejects.toThrow();
    });
  });
}
